"""
BATHCO COMMAND — Historical Daily Reconciliation Script
==========================================================
Reads, for every available date:
  1. Daily Sales Excel  (DATE / RECEIPT NO / SALES / CASH / CARD / ONLINE / CHEQUE / CREDIT / REMARKS)
     Also accepts alternate column names used in newer exports:
     Invoice No, Total (LKR), Card, Cheque, etc.
  2. Lasersoft "Profit by Sales" report:
       - Invoice-level export: NUMBER, CUSTOMER NAME, AMOUNT, COST, GPA, GP(%)
       - Item-level export:    ITEM CODE, TOTAL AMOUNT, COST, TOTAL COST, PROFIT, GIVEN INVOICES
       - Screenshot image: OCR'd via OpenRouter vision model
  3. Handwritten daily expense/cash sheet photo (OCR'd — date read off the page)

Results cached to reconciled/photo_cache.json — photos already processed are skipped.
Run: python reconcile_bathco.py
"""

import os, re, json, base64, logging, time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

import openpyxl
import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
AI_DATA_ROOT   = Path(r"C:\Bathco\AI-Data")
EXCEL_DIR      = AI_DATA_ROOT / "daily-sales-excel"
PHOTOS_DIR     = AI_DATA_ROOT / "daily-reports"
LASERSOFT_DIR  = AI_DATA_ROOT / "lasersoft-reports"
OUTPUT_DIR     = AI_DATA_ROOT / "reconciled"
PHOTO_CACHE    = OUTPUT_DIR / "photo_cache.json"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions"
VISION_MODEL       = "nvidia/nemotron-nano-12b-v2-vl:free"

DATE_PATTERN = re.compile(r"(\d{2})-(\d{2})-(\d{4})")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("bathco_reconcile")


# ---------------------------------------------------------------------------
# DATA STRUCTURES
# ---------------------------------------------------------------------------
@dataclass
class Invoice:
    receipt_no: str
    amount: float
    cash: float = 0.0
    card: float = 0.0
    online: float = 0.0
    cheq: float = 0.0
    credit: float = 0.0
    remarks: str = ""

@dataclass
class ExcelDay:
    date: str
    invoices: list = field(default_factory=list)

    @property
    def total_sale(self): return sum(i.amount for i in self.invoices)
    @property
    def total_cash(self): return sum(i.cash for i in self.invoices)
    @property
    def total_card(self): return sum(i.card for i in self.invoices)
    @property
    def total_online(self): return sum(i.online for i in self.invoices)
    @property
    def total_cheq(self): return sum(i.cheq for i in self.invoices)
    @property
    def total_credit(self): return sum(i.credit for i in self.invoices)

@dataclass
class LasersoftInvoice:
    number: str
    customer: str
    amount: float
    cost: float
    gp_amount: float
    gp_percent: float
    flagged: bool = False
    flag_reason: str = ""

@dataclass
class LasersoftDay:
    date: str
    invoices: list = field(default_factory=list)

    @property
    def total_amount(self): return sum(i.amount for i in self.invoices)
    @property
    def total_gp(self): return sum(i.gp_amount for i in self.invoices if not i.flagged)

@dataclass
class ExpenseLine:
    description: str
    amount: float

@dataclass
class ExpenseDay:
    date: str
    petty_cash: float = 0.0
    expenses: list = field(default_factory=list)
    payments_in: list = field(default_factory=list)

    @property
    def total_expenses(self): return sum(e.amount for e in self.expenses)
    @property
    def total_cash_received(self): return sum(p.amount for p in self.payments_in)

@dataclass
class ReconciledDay:
    date: str
    status: str = "failed_missing_files"
    total_sale: float = 0.0
    cash_total: float = 0.0
    online_total: float = 0.0
    card_total: float = 0.0
    cheq_total: float = 0.0
    credit_total: float = 0.0
    expenses_total: float = 0.0
    cash_received: float = 0.0
    cash_in_hand: float = 0.0
    gross_profit: float = 0.0
    net_profit: Optional[float] = None
    pending_invoices: list = field(default_factory=list)
    notes: str = ""


# ---------------------------------------------------------------------------
# DATE HELPERS
# ---------------------------------------------------------------------------
def normalize_date(raw: str) -> Optional[str]:
    raw = (raw or "").strip()
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%d-%m-%y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    log.warning(f"Could not parse date string: '{raw}'")
    return None

def date_from_filename(stem: str) -> Optional[str]:
    m = DATE_PATTERN.search(stem)
    if not m:
        return None
    dd, mm, yyyy = m.groups()
    return f"{yyyy}-{mm}-{dd}"


# ---------------------------------------------------------------------------
# VISION OCR
# ---------------------------------------------------------------------------
def _api_call_raw(b64: str, prompt: str, timeout: int = 60) -> str:
    """Make one OpenRouter vision call, retry up to 5x on 429 with backoff."""
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set — put it in .env next to this script.")
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": VISION_MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ]}],
    }
    for attempt in range(5):
        try:
            resp = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=timeout)
            if resp.status_code == 429:
                wait = 15 * (2 ** attempt)
                log.warning(f"  429 rate limit — waiting {wait}s before retry {attempt+1}/5")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except requests.exceptions.Timeout:
            if attempt < 4:
                time.sleep(10)
            else:
                raise
    raise RuntimeError("Max retries exceeded on rate limit")


CLASSIFY_PROMPT = """
Look at this image and answer ONE WORD only.
If it shows a handwritten cash/expense ledger sheet (with dates, expense names, and amounts written by hand), reply: EXPENSE
If it shows a Lasersoft software screenshot or ERP report printout, reply: LASERSOFT
Otherwise reply: OTHER
Reply with exactly one word.
"""

EXPENSE_PROMPT = """
You are reading a handwritten daily cash sheet from a Sri Lankan retail shop.
Extract ONLY what is written. Return strict JSON, no markdown, no commentary:

{
  "date": "DD/MM/YY exactly as written at the top",
  "petty_cash": number or null,
  "expenses": [{"description": "...", "amount": number}, ...],
  "payments_in": [{"description": "...", "amount": number}, ...]
}

"expenses" is the LEFT column (tea, cement, commission, lunch, salary, rent,
coffee, electricity, etc). "payments_in" is the RIGHT column — money that
came IN to the shop (e.g. staff returning loan money), not an expense.
If a field is illegible, use null rather than guessing a number.
"""


# ---------------------------------------------------------------------------
# PHOTO CACHE
# ---------------------------------------------------------------------------
def load_photo_cache() -> dict:
    if PHOTO_CACHE.exists():
        try:
            return json.loads(PHOTO_CACHE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

def save_photo_cache(cache: dict):
    PHOTO_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_expense_photo(image_path: Path, cache: dict) -> Optional[ExpenseDay]:
    key = image_path.name

    # Serve from cache if already classified
    if key in cache:
        cached = cache[key]
        if cached.get("type") == "EXPENSE" and cached.get("date"):
            day = ExpenseDay(
                date=normalize_date(cached["date"]),
                petty_cash=float(cached.get("petty_cash") or 0),
            )
            for e in cached.get("expenses", []):
                if e.get("amount"):
                    day.expenses.append(ExpenseLine(e["description"], float(e["amount"])))
            for p in cached.get("payments_in", []):
                if p.get("amount"):
                    day.payments_in.append(ExpenseLine(p["description"], float(p["amount"])))
            return day
        elif cached.get("type") in ("LASERSOFT", "OTHER"):
            return None
        # If previously failed, retry

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    # Step 1: Classify
    log.info(f"Classifying {image_path.name} ...")
    try:
        raw_type = _api_call_raw(b64, CLASSIFY_PROMPT, timeout=30).upper()
        if "EXPENSE" in raw_type:
            photo_type = "EXPENSE"
        elif "LASERSOFT" in raw_type:
            photo_type = "LASERSOFT"
        else:
            photo_type = "OTHER"
    except Exception as exc:
        log.error(f"Classify failed for {image_path.name}: {exc}")
        return None  # Don't cache failures — retry next run

    if photo_type != "EXPENSE":
        cache[key] = {"type": photo_type}
        save_photo_cache(cache)
        log.info(f"  → {photo_type} — skipping")
        return None

    # Step 2: Extract expense data
    log.info(f"  → EXPENSE sheet — extracting ...")
    try:
        raw = _api_call_raw(b64, EXPENSE_PROMPT, timeout=60).strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
        data = json.loads(raw)
    except Exception as exc:
        log.error(f"Expense extraction failed for {image_path.name}: {exc}")
        cache[key] = {"type": "EXPENSE", "error": str(exc)}
        save_photo_cache(cache)
        return None

    cache[key] = {"type": "EXPENSE", **data}
    save_photo_cache(cache)

    date_str = normalize_date(data.get("date", ""))
    day = ExpenseDay(date=date_str, petty_cash=float(data.get("petty_cash") or 0))
    for e in data.get("expenses", []):
        if e.get("amount"):
            day.expenses.append(ExpenseLine(e["description"], float(e["amount"])))
    for p in data.get("payments_in", []):
        if p.get("amount"):
            day.payments_in.append(ExpenseLine(p["description"], float(p["amount"])))
    return day


# ---------------------------------------------------------------------------
# EXCEL PARSER — handles both old and new column name variants
# ---------------------------------------------------------------------------
def _col(df_cols: list, *candidates) -> Optional[str]:
    upper = [c.upper() for c in df_cols]
    for c in candidates:
        if c.upper() in upper:
            return df_cols[upper.index(c.upper())]
    return None

def parse_excel_day(filepath: Path, date_str: str) -> ExcelDay:
    df = pd.read_excel(filepath, sheet_name=0)
    df.columns = [str(c).strip() for c in df.columns]
    cols = list(df.columns)

    receipt_col = _col(cols, "RECEPT NO", "RECEIPT NO", "Invoice No", "INVOICE NO", "INVOICE", "REF")
    amount_col  = _col(cols, "SALES", "TOTAL (LKR)", "TOTAL", "AMOUNT", "SALE")
    cash_col    = _col(cols, "CASH PAYMENT", "CASH", "Cash")
    card_col    = _col(cols, "CARD PAYMENT", "CARD", "Card")
    online_col  = _col(cols, "ONLINE PAYMENT", "ONLINE", "Online")
    cheq_col    = _col(cols, "CHEQ PAYMENT", "CHEQUE", "CHEQ", "Cheque")
    credit_col  = _col(cols, "CREDIT", "Credit")
    remarks_col = _col(cols, "REMARKS", "Remarks", "NOTES", "Notes")

    day = ExcelDay(date=date_str)
    for _, row in df.iterrows():
        receipt_no = str(row.get(receipt_col, "")).strip() if receipt_col else ""
        sales = float(row.get(amount_col, 0) or 0) if amount_col else 0.0
        if not receipt_no or receipt_no.lower() == "nan" or sales == 0:
            continue
        day.invoices.append(Invoice(
            receipt_no=receipt_no,
            amount=sales,
            cash=float(row.get(cash_col, 0) or 0) if cash_col else 0.0,
            card=float(row.get(card_col, 0) or 0) if card_col else 0.0,
            online=float(row.get(online_col, 0) or 0) if online_col else 0.0,
            cheq=float(row.get(cheq_col, 0) or 0) if cheq_col else 0.0,
            credit=float(row.get(credit_col, 0) or 0) if credit_col else 0.0,
            remarks=str(row.get(remarks_col, "") or "") if remarks_col else "",
        ))
    return day


# ---------------------------------------------------------------------------
# LASERSOFT PARSERS — invoice-level and item-level exports, plus screenshots
# ---------------------------------------------------------------------------
def _parse_lasersoft_item_openpyxl(filepath: Path, date_str: str) -> LasersoftDay:
    """Read item-level Lasersoft xlsx via openpyxl — handles files where pandas
    stops before reaching the GIVEN INVOICES column."""
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.active
    day = LasersoftDay(date=date_str)
    header = None
    groups: dict = {}
    for row in ws.iter_rows(values_only=True):
        if all(v is None for v in row):
            break  # stop at first fully-empty row
        if header is None:
            header = [str(h).strip().upper() if h else "" for h in row]
            continue
        if not any(row):
            continue

        def gcol(name):
            try:
                return row[header.index(name)] if name in header else None
            except (ValueError, IndexError):
                return None

        inv_no = str(gcol("GIVEN INVOICES") or "").strip()
        if not inv_no or inv_no == "NONE" or inv_no == "NAN":
            continue

        amt  = float(gcol("TOTAL AMOUNT") or 0)
        cost = float(gcol("TOTAL COST") or 0)
        gp   = float(gcol("PROFIT") or 0)

        if inv_no not in groups:
            groups[inv_no] = {"amount": 0.0, "cost": 0.0, "gp": 0.0}
        groups[inv_no]["amount"] += amt
        groups[inv_no]["cost"]   += cost
        groups[inv_no]["gp"]     += gp

    for inv_no, totals in groups.items():
        gp = totals["gp"]
        inv = LasersoftInvoice(
            number=inv_no,
            customer="",
            amount=totals["amount"],
            cost=totals["cost"],
            gp_amount=gp,
            gp_percent=(gp / totals["amount"] * 100) if totals["amount"] else 0.0,
        )
        if gp <= 0:
            inv.flagged, inv.flag_reason = True, "zero_or_negative_gp"
        day.invoices.append(inv)

    log.info(f"  openpyxl: {len(groups)} invoices from {filepath.name}")
    return day


def parse_lasersoft_export(filepath: Path, date_str: str) -> LasersoftDay:
    df = pd.read_csv(filepath) if filepath.suffix.lower() == ".csv" else pd.read_excel(filepath)
    df.columns = [str(c).strip() for c in df.columns]
    cols = list(df.columns)
    upper_cols = [c.upper() for c in cols]

    day = LasersoftDay(date=date_str)

    # Invoice-level: has NUMBER / CUSTOMER NAME / GPA
    if "NUMBER" in upper_cols or "GPA" in upper_cols:
        num_col  = _col(cols, "NUMBER", "INVOICE NO", "INVOICE")
        cust_col = _col(cols, "CUSTOMER NAME", "CUSTOMER", "NAME")
        amt_col  = _col(cols, "AMOUNT", "TOTAL AMOUNT")
        cost_col = _col(cols, "COST", "TOTAL COST")
        gpa_col  = _col(cols, "GPA", "GP AMOUNT", "PROFIT", "GP")
        gpp_col  = _col(cols, "GP(%)", "GP %", "GP_PCT")

        for _, row in df.iterrows():
            inv_no = str(row.get(num_col, "")).strip() if num_col else ""
            amount = float(row.get(amt_col, 0) or 0) if amt_col else 0.0
            if not inv_no or inv_no.lower() == "nan":
                continue
            gp = float(row.get(gpa_col, 0) or 0) if gpa_col else 0.0
            inv = LasersoftInvoice(
                number=inv_no,
                customer=str(row.get(cust_col, "") or "") if cust_col else "",
                amount=amount,
                cost=float(row.get(cost_col, 0) or 0) if cost_col else 0.0,
                gp_amount=gp,
                gp_percent=float(row.get(gpp_col, 0) or 0) if gpp_col else 0.0,
            )
            if gp <= 0:
                inv.flagged, inv.flag_reason = True, "zero_or_negative_gp"
            day.invoices.append(inv)

    # Item-level: has GIVEN INVOICES — group by invoice and sum PROFIT
    # Pandas may miss this column; fall through to openpyxl path below
    elif "GIVEN INVOICES" in upper_cols or "ITEM CODE" in upper_cols:
        inv_col  = _col(cols, "GIVEN INVOICES", "INVOICE NO", "INVOICE")
        amt_col  = _col(cols, "TOTAL AMOUNT", "AMOUNT", "SELLING PRICE")
        cost_col = _col(cols, "TOTAL COST", "COST")
        gp_col   = _col(cols, "PROFIT", "GP", "GPA")

        groups: dict = {}
        for _, row in df.iterrows():
            inv_no = str(row.get(inv_col, "")).strip() if inv_col else ""
            if not inv_no or inv_no.lower() == "nan":
                continue
            if inv_no not in groups:
                groups[inv_no] = {"amount": 0.0, "cost": 0.0, "gp": 0.0}
            groups[inv_no]["amount"] += float(row.get(amt_col, 0) or 0) if amt_col else 0.0
            groups[inv_no]["cost"]   += float(row.get(cost_col, 0) or 0) if cost_col else 0.0
            groups[inv_no]["gp"]     += float(row.get(gp_col, 0) or 0) if gp_col else 0.0

        for inv_no, totals in groups.items():
            gp = totals["gp"]
            inv = LasersoftInvoice(
                number=inv_no,
                customer="",
                amount=totals["amount"],
                cost=totals["cost"],
                gp_amount=gp,
                gp_percent=(gp / totals["amount"] * 100) if totals["amount"] else 0.0,
            )
            if gp <= 0:
                inv.flagged, inv.flag_reason = True, "zero_or_negative_gp"
            day.invoices.append(inv)

    else:
        # Pandas may cut off columns — try openpyxl to read full column range
        log.info(f"Trying openpyxl for {filepath.name} (pandas missed some columns)")
        day = _parse_lasersoft_item_openpyxl(filepath, date_str)
        return day

    return day


def parse_lasersoft_image(image_path: Path, date_str: str) -> LasersoftDay:
    LASERSOFT_PROMPT = """
You are reading a screenshot of a "Profit by Sales" report from Lasersoft ERP software.
Extract every transaction row into strict JSON, no markdown:

{
  "date": "the report date shown, YYYY-MM-DD if visible, else as written",
  "invoices": [
    {"number": "...", "customer": "...", "amount": number, "cost": number,
     "gp_amount": number, "gp_percent": number}, ...
  ]
}

If a MEMO column contains something like "APPROVED BY ..." on a zero or negative GP row,
still include that row — do not drop it.
"""
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    raw = _api_call_raw(b64, LASERSOFT_PROMPT, timeout=60).strip("`")
    if raw.lower().startswith("json"):
        raw = raw[4:].strip()
    data = json.loads(raw)

    day = LasersoftDay(date=date_str)
    for r in data.get("invoices", []):
        gp = float(r.get("gp_amount") or 0)
        inv = LasersoftInvoice(
            number=str(r.get("number", "")).strip(),
            customer=str(r.get("customer", "")).strip(),
            amount=float(r.get("amount") or 0),
            cost=float(r.get("cost") or 0),
            gp_amount=gp,
            gp_percent=float(r.get("gp_percent") or 0),
        )
        if gp <= 0:
            inv.flagged, inv.flag_reason = True, "zero_or_negative_gp"
        day.invoices.append(inv)
    return day


def parse_lasersoft_file(filepath: Path, date_str: str) -> LasersoftDay:
    if filepath.suffix.lower() in (".xlsx", ".xls", ".csv"):
        return parse_lasersoft_export(filepath, date_str)
    return parse_lasersoft_image(filepath, date_str)


# ---------------------------------------------------------------------------
# FILE DISCOVERY
# ---------------------------------------------------------------------------
def find_excel_files() -> dict:
    mapping = {}
    for f in EXCEL_DIR.glob("*.xlsx"):
        d = date_from_filename(f.stem)
        if d:
            mapping[d] = f
        else:
            log.warning(f"No date found in Excel filename: {f.name}")
    return mapping

def find_lasersoft_files() -> dict:
    mapping = {}
    for f in LASERSOFT_DIR.iterdir():
        if not f.is_file():
            continue
        d = date_from_filename(f.stem)
        if d:
            mapping[d] = f
        else:
            log.warning(f"No date found in Lasersoft filename: {f.name}")
    return mapping

def find_expense_photos(cache: dict) -> dict:
    mapping = {}
    all_photos = [f for f in PHOTOS_DIR.iterdir()
                  if f.is_file() and f.suffix.lower() in (".jpg", ".jpeg", ".png")]
    total = len(all_photos)
    log.info(f"Processing {total} photos (cached results skip API calls)...")
    for i, f in enumerate(all_photos, 1):
        log.info(f"Photo {i}/{total}: {f.name}")
        try:
            day = parse_expense_photo(f, cache)
            if day and day.date:
                if day.date in mapping:
                    # Merge if two sheets for same date
                    existing = mapping[day.date]
                    existing.expenses.extend(day.expenses)
                    existing.payments_in.extend(day.payments_in)
                    existing.petty_cash = existing.petty_cash or day.petty_cash
                else:
                    mapping[day.date] = day
            elif day and not day.date:
                log.warning(f"Could not read a date off {f.name} — skipping.")
        except Exception as exc:
            log.error(f"Failed to process {f.name}: {exc}")
    return mapping


# ---------------------------------------------------------------------------
# RECONCILIATION
# ---------------------------------------------------------------------------
def reconcile(date_str, excel, lasersoft, expense) -> ReconciledDay:
    result = ReconciledDay(date=date_str)

    if excel is None and lasersoft is None:
        result.notes = "No Excel or Lasersoft data found for this date."
        return result

    if excel:
        result.total_sale   = excel.total_sale
        result.cash_total   = excel.total_cash
        result.card_total   = excel.total_card
        result.online_total = excel.total_online
        result.cheq_total   = excel.total_cheq
        result.credit_total = excel.total_credit

    if lasersoft:
        result.gross_profit = lasersoft.total_gp
        for inv in lasersoft.invoices:
            if inv.flagged:
                result.pending_invoices.append(
                    f"Lasersoft invoice {inv.number} has zero/negative GP "
                    f"(LKR {inv.gp_amount:,.0f}) — flagged, excluded from profit."
                )

    if excel and lasersoft:
        laser_numbers = {i.number for i in lasersoft.invoices}
        for inv in excel.invoices:
            if inv.receipt_no not in laser_numbers:
                result.pending_invoices.append(
                    f"Pending Lasersoft entry — Invoice {inv.receipt_no}, "
                    f"LKR {inv.amount:,.2f} — not yet confirmed in Lasersoft."
                )

    if expense:
        result.expenses_total = expense.total_expenses
        result.cash_received  = expense.total_cash_received

    result.cash_in_hand = result.cash_total + result.cash_received - result.expenses_total

    if lasersoft and expense:
        result.net_profit = result.gross_profit - result.expenses_total
        result.status = "reconciled"
    elif excel and not lasersoft:
        result.status = "partial_missing_lasersoft"
        result.notes  = "Sale data present but no Lasersoft GP — Net Profit pending."
    elif excel and lasersoft and not expense:
        result.status     = "partial_missing_photo"
        result.notes      = "No expense photo found — Net Profit shown as GP only."
        result.net_profit = result.gross_profit
    else:
        result.status = "partial"

    return result


# ---------------------------------------------------------------------------
# BATCH RUNNER + REPORT
# ---------------------------------------------------------------------------
def run_batch() -> list:
    excel_files     = find_excel_files()
    lasersoft_files = find_lasersoft_files()

    log.info(f"Found {len(excel_files)} Excel files, {len(lasersoft_files)} Lasersoft files.")
    log.info("Processing expense photos (slow — uses OCR API; cached results skip API calls)...")

    cache = load_photo_cache()
    expense_by_date = find_expense_photos(cache)
    log.info(f"Expense photos yielded {len(expense_by_date)} unique dates.")

    all_dates = sorted(set(excel_files) | set(lasersoft_files) | set(expense_by_date))
    log.info(f"{len(all_dates)} candidate dates to reconcile.")

    results = []
    for date_str in all_dates:
        log.info(f"Reconciling {date_str} ...")
        excel_day   = parse_excel_day(excel_files[date_str], date_str) if date_str in excel_files else None
        laser_day   = parse_lasersoft_file(lasersoft_files[date_str], date_str) if date_str in lasersoft_files else None
        expense_day = expense_by_date.get(date_str)
        results.append(reconcile(date_str, excel_day, laser_day, expense_day))

    return results


def write_report(results: list):
    rows = [{
        "date":             r.date,
        "status":           r.status,
        "total_sale":       r.total_sale,
        "cash_total":       r.cash_total,
        "online_total":     r.online_total,
        "card_total":       r.card_total,
        "cheq_total":       r.cheq_total,
        "credit_total":     r.credit_total,
        "expenses_total":   r.expenses_total,
        "cash_received":    r.cash_received,
        "cash_in_hand":     r.cash_in_hand,
        "gross_profit":     r.gross_profit,
        "net_profit":       r.net_profit,
        "pending_invoices": " | ".join(r.pending_invoices),
        "notes":            r.notes,
    } for r in results]

    df = pd.DataFrame(rows)
    csv_path  = OUTPUT_DIR / "reconciliation_report.csv"
    json_path = OUTPUT_DIR / "reconciliation_report.json"
    df.to_csv(csv_path,   index=False)
    df.to_json(json_path, orient="records", indent=2)

    log.info(f"Written: {csv_path}")
    log.info(f"Written: {json_path}")
    print("\n" + "=" * 80)
    print(df[["date", "status", "total_sale", "gross_profit", "net_profit"]].to_string(index=False))
    print("=" * 80)
    print(f"\nTotal dates: {len(results)}")
    reconciled = [r for r in results if r.status == "reconciled"]
    print(f"Fully reconciled: {len(reconciled)}")
    if reconciled:
        print(f"Total net profit (reconciled days): LKR {sum(r.net_profit for r in reconciled):,.0f}")


if __name__ == "__main__":
    all_results = run_batch()
    write_report(all_results)
