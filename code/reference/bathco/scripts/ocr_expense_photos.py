"""
OCR all expense photos found in the source folder, then write expenses +
Net Profit back into BATHCO_MASTER_DATA_REBUILD.xlsx.

Rules (per user):
  - COMPLETE days (sales + GP both known): OCR photos → write Expenses → calculate Net Profit
  - MISSING COST days (sales only, no GP): OCR photos → write Expenses (Net Profit stays blank)
  - MISSING SALES days: DO NOT TOUCH — leave exactly as PENDING/blank
  - NO DATA days: DO NOT TOUCH

Aggregation logic for days with many photos (e.g. May 13 has 34):
  1. If ANY photo shows total_sale > 0  → that photo is the daily summary sheet;
     use its total_expenses (highest value among summary sheets wins).
  2. Else → sum unique expense items across all photos for the date.
  3. Write whichever of (1) or (2) is non-zero and > 0.

Resume-capable: saves results to ocr_expense_results.json between runs.
"""

import os, json, base64, time, sys, re, shutil
from pathlib import Path
from datetime import datetime
import openai as _openai_mod   # for APITimeoutError

# ── Paths ──────────────────────────────────────────────────────────────────────
SOURCE             = Path(r"C:\Users\DELL\Desktop\complet till 17-06-2026")
PENDING_REVIEW_DIR = SOURCE / '_pending_review'   # uncertain/failed photos held here for 48h
MASTER_XLSX        = Path(r"C:\BATHCO_PHASE1\scripts\BATHCO_MASTER_DATA_REBUILD.xlsx")
RESULTS_JSON       = Path(r"C:\BATHCO_PHASE1\scripts\ocr_expense_results.json")
PENDING_REVIEW_TTL = 48 * 3600  # seconds before auto-delete from _pending_review

SKIP_DIRS = {'transfer', 'tile cord', 'tile codes new', 'letter'}

# Locked to free model only — no fallback to any paid model.
FORCE_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free"

EXTRACT_PROMPT = """This is a photo from a bathroom products retail store in Sri Lanka.
It may show a handwritten daily expense/sales summary sheet OR a single receipt/invoice.
Extract all financial data. Return ONLY valid JSON, no explanation:
{
  "total_sale": 0,
  "total_expenses": 0,
  "expense_items": "item1:amount, item2:amount",
  "payments": 0,
  "salary": 0,
  "cash_in_hand": 0,
  "notes": "",
  "confidence": "high/medium/low",
  "sheet_type": "daily_summary/single_receipt/unclear"
}
Rules:
- All amounts in LKR (Sri Lankan Rupees)
- sheet_type = "daily_summary" if you can see a full day summary (total sales + multiple expenses)
- sheet_type = "single_receipt" if it shows one bill/invoice/payment
- total_sale: the day total if visible, else 0
- total_expenses: sum of ALL expense items on this sheet if visible, else 0
- expense_items: comma-separated "description:amount" pairs for each line item seen
- Use 0 for anything not visible
Return ONLY the JSON."""

# ── Install deps ───────────────────────────────────────────────────────────────
try:
    from openai import OpenAI
except ImportError:
    os.system("pip install openai -q")
    from openai import OpenAI

try:
    import openpyxl
except ImportError:
    os.system("pip install openpyxl -q")
    import openpyxl

try:
    from PIL import Image
except ImportError:
    os.system("pip install Pillow -q")
    from PIL import Image

# ── Load API key ───────────────────────────────────────────────────────────────
def load_api_key():
    env_path = Path(r"C:\BATHCO_PHASE1\.env")
    for line in env_path.read_text(encoding='utf-8', errors='replace').splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            if k.strip() == 'OPENROUTER_API_KEY':
                return v.strip()
    return ''

# ── Collect unique expense photos ─────────────────────────────────────────────
def collect_photos():
    """Walk entire source folder, group by date, deduplicate by filename."""
    seen_names = set()
    by_date    = {}

    def walk(p, depth=0):
        if depth > 6 or not p.exists(): return
        for entry in sorted(p.iterdir()):
            if entry.name.startswith('.') or entry.name.startswith('~$'): continue
            if entry.is_dir():
                if any(s in entry.name.lower() for s in SKIP_DIRS): continue
                walk(entry, depth + 1)
            elif re.search(r'\.(jpg|jpeg|png)$', entry.name, re.I) and \
                 re.search(r'whatsapp', entry.name, re.I):
                m = re.search(r'(\d{4})-(\d{2})-(\d{2})', entry.name)
                if not m: continue
                date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
                # Only valid dates in our range
                if date_str < '2025-12-21' or date_str > '2026-06-17': continue
                # Deduplicate by filename
                if entry.name in seen_names: continue
                seen_names.add(entry.name)
                by_date.setdefault(date_str, []).append(entry)

    walk(SOURCE)
    return by_date

# ── Prepare image for API ──────────────────────────────────────────────────────
def prepare_image(p: Path):
    raw   = p.read_bytes()
    ext   = p.suffix.lower().lstrip('.')
    mtype = {'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png'}.get(ext,'image/jpeg')
    if len(raw) <= 900_000:
        return raw, mtype
    im = Image.open(p)
    if im.mode not in ('RGB','L'): im = im.convert('RGB')
    if max(im.size) > 1600:
        r = 1600 / max(im.size)
        im = im.resize((int(im.width*r), int(im.height*r)))
    buf = __import__('io').BytesIO()
    im.save(buf, 'JPEG', quality=80)
    return buf.getvalue(), 'image/jpeg'

# ── Single OCR call — always uses FORCE_MODEL, no fallback ────────────────────
def ocr_one(client, img_path: Path) -> dict:
    raw, mtype = prepare_image(img_path)
    b64        = base64.standard_b64encode(raw).decode()
    resp = client.chat.completions.create(
        model=FORCE_MODEL, max_tokens=500, timeout=50,
        messages=[{'role':'user','content':[
            {'type':'image_url','image_url':{'url':f'data:{mtype};base64,{b64}'}},
            {'type':'text','text':EXTRACT_PROMPT}
        ]}]
    )
    text = resp.choices[0].message.content.strip()
    if text.startswith('```'):
        text = text.split('```')[1]
        if text.startswith('json'): text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except Exception:
        s, e = text.find('{'), text.rfind('}')
        try:    data = json.loads(text[s:e+1]) if s >= 0 else {'raw':text[:200],'confidence':'low'}
        except: data = {'raw':text[:200],'confidence':'low'}
    data['_file']  = img_path.name
    data['_model'] = FORCE_MODEL
    return data

# ── Aggregate expense results for one date ─────────────────────────────────────
def aggregate_expenses(results_for_date: list) -> dict:
    """
    Returns { 'total': float, 'method': str, 'items': str, 'confidence': str }
    Method:
      'summary_sheet' - at least one photo had total_sale > 0 (daily summary page)
      'sum_of_items'  - summed unique expense_items across all photos
      'sum_of_totals' - summed total_expenses across all photos (fallback)
    """
    def safe(v):
        try: return float(v or 0)
        except: return 0.0

    summary_sheets   = [r for r in results_for_date
                        if r.get('sheet_type') == 'daily_summary' or safe(r.get('total_sale',0)) > 0]
    low_conf_count   = sum(1 for r in results_for_date if r.get('confidence') == 'low')
    error_count      = sum(1 for r in results_for_date if r.get('confidence') == 'error')

    if summary_sheets:
        # Use the summary sheet with the highest total_expenses
        best = max(summary_sheets, key=lambda r: safe(r.get('total_expenses', 0)))
        total = safe(best.get('total_expenses', 0))
        items = best.get('expense_items', '') or ''
        return {
            'total': total,
            'method': 'summary_sheet',
            'source_file': best.get('_file',''),
            'items': items,
            'confidence': best.get('confidence','low'),
            'low_conf_photos': low_conf_count,
            'error_photos': error_count,
        }

    # No summary sheet → sum unique expense items across all photos
    all_items = {}  # "desc:amt" → float
    for r in results_for_date:
        items_str = r.get('expense_items','') or ''
        for item in items_str.split(','):
            item = item.strip()
            if ':' not in item: continue
            desc, amt_str = item.rsplit(':',1)
            try:
                amt = float(amt_str.strip().replace(',',''))
            except: continue
            key = f"{desc.strip().lower()}:{amt:.0f}"
            all_items[key] = (desc.strip(), amt)

    if all_items:
        total  = sum(v for _, v in all_items.values())
        items  = ', '.join(f"{d}:{a:.0f}" for d,(d,a) in all_items.items())
        return {
            'total': total, 'method': 'sum_of_items',
            'source_file': 'multiple',
            'items': items,
            'confidence': 'medium' if low_conf_count == 0 else 'low',
            'low_conf_photos': low_conf_count, 'error_photos': error_count,
        }

    # Final fallback: sum total_expenses fields
    total = sum(safe(r.get('total_expenses',0)) for r in results_for_date
                if r.get('confidence') != 'error')
    return {
        'total': total, 'method': 'sum_of_totals',
        'source_file': 'multiple',
        'items': '',
        'confidence': 'low',
        'low_conf_photos': low_conf_count, 'error_photos': error_count,
    }

# ── Update master Excel ────────────────────────────────────────────────────────
def update_master_excel(expense_by_date: dict) -> dict:
    """
    Reads BATHCO_MASTER_DATA_REBUILD.xlsx (Date Spine sheet).
    For each date in expense_by_date that is COMPLETE or MISSING COST:
      - Writes Expenses
      - If COMPLETE (GP known), writes Net Profit = GP - Expenses
    Does NOT touch MISSING SALES or NO DATA rows.
    Returns stats dict.
    """
    wb = openpyxl.load_workbook(MASTER_XLSX)
    ws = wb['Date Spine']

    # Build header map
    headers = {cell.value: cell.column for cell in ws[1] if cell.value}
    col = lambda name: headers.get(name)

    DATE_COL      = col('Date')
    STATUS_COL    = col('Status')
    GP_COL        = col('Gross Profit')
    NP_COL        = col('Net Profit')
    EXP_PHOTO_COL = col('Expense Photo')
    EXP_PATH_COL  = col('Expense Photo Path')
    FLAGS_COL     = col('Flags')

    # Find or create Expenses column
    EXP_COL = col('Expenses (OCR)')
    if not EXP_COL:
        EXP_COL = ws.max_column + 1
        ws.cell(row=1, column=EXP_COL, value='Expenses (OCR)')

    DO_NOT_TOUCH = {'MISSING SALES', 'NO DATA', 'MISSING SALES + COST'}

    updated = {}
    skipped = {}

    for row_idx in range(2, ws.max_row + 1):
        date_val   = ws.cell(row=row_idx, column=DATE_COL).value   if DATE_COL else None
        status_val = ws.cell(row=row_idx, column=STATUS_COL).value if STATUS_COL else None

        if not date_val or not status_val: continue
        date_str = str(date_val).strip()
        if date_str not in expense_by_date: continue
        if status_val in DO_NOT_TOUCH:
            skipped[date_str] = f'Status={status_val} — not touched'
            continue

        agg = expense_by_date[date_str]
        exp_total = agg['total']

        # Write Expenses (OCR) column
        ws.cell(row=row_idx, column=EXP_COL, value=round(exp_total, 2) if exp_total else 0)

        # Update Expense Photo marker (in case URGENT photos weren't tracked)
        if EXP_PHOTO_COL:
            ws.cell(row=row_idx, column=EXP_PHOTO_COL, value='YES')

        # Recalculate Net Profit only if GP is known (COMPLETE status)
        if status_val == 'COMPLETE' and GP_COL and NP_COL and exp_total > 0:
            gp_val = ws.cell(row=row_idx, column=GP_COL).value
            try:
                gp = float(gp_val or 0)
                net = round(gp - exp_total, 2)
                ws.cell(row=row_idx, column=NP_COL, value=net)
            except (TypeError, ValueError):
                net = None

        updated[date_str] = {
            'status': status_val,
            'expenses': exp_total,
            'method': agg['method'],
            'confidence': agg['confidence'],
            'net_profit': ws.cell(row=row_idx, column=NP_COL).value if NP_COL else None,
            'low_conf_photos': agg.get('low_conf_photos', 0),
            'error_photos': agg.get('error_photos', 0),
        }

        # Append to flags
        if FLAGS_COL:
            existing = ws.cell(row=row_idx, column=FLAGS_COL).value or ''
            flag = f"OCR expenses={exp_total:.0f} [{agg['method']}, {agg['confidence']} conf]"
            ws.cell(row=row_idx, column=FLAGS_COL, value=(existing + '; ' + flag).strip('; '))

    wb.save(MASTER_XLSX)
    return {'updated': updated, 'skipped': skipped}

# ── Post-OCR file disposal ─────────────────────────────────────────────────────
def dispose_photo(img_path: Path, result: dict):
    """
    Called only for photos newly processed in this run (never for historical files).
    high/medium confidence → delete source image.
    error / skipped / low confidence → move to _pending_review for 48-h manual window.
    """
    conf = result.get('confidence', 'error')
    try:
        if conf in ('high', 'medium'):
            img_path.unlink(missing_ok=True)
        else:
            PENDING_REVIEW_DIR.mkdir(parents=True, exist_ok=True)
            dest = PENDING_REVIEW_DIR / img_path.name
            if dest.exists():
                dest = PENDING_REVIEW_DIR / f"{int(time.time())}_{img_path.name}"
            shutil.move(str(img_path), str(dest))
    except Exception as exc:
        print(f'  [dispose] WARNING: could not dispose {img_path.name}: {exc}')

def cleanup_pending_review():
    """Delete files from _pending_review older than PENDING_REVIEW_TTL seconds."""
    if not PENDING_REVIEW_DIR.exists():
        return
    cutoff = time.time() - PENDING_REVIEW_TTL
    cleaned = 0
    for f in PENDING_REVIEW_DIR.iterdir():
        if f.is_file() and f.stat().st_mtime < cutoff:
            try:
                f.unlink()
                cleaned += 1
            except Exception as exc:
                print(f'  [cleanup] WARNING: could not delete {f.name}: {exc}')
    if cleaned:
        print(f'  [cleanup] Removed {cleaned} file(s) from _pending_review (>{PENDING_REVIEW_TTL//3600}h old)')

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    api_key = load_api_key()
    if not api_key:
        print('ERROR: OPENROUTER_API_KEY not found in .env'); sys.exit(1)

    client = OpenAI(
        base_url='https://openrouter.ai/api/v1',
        api_key=api_key, timeout=60, max_retries=0,
        default_headers={'HTTP-Referer':'https://bathco.lk','X-Title':'Bathco AI'}
    )

    # Purge _pending_review files older than 48 h before doing anything else
    cleanup_pending_review()

    # Collect all unique expense photos
    print('=== BATHCO EXPENSE PHOTO OCR ===')
    by_date = collect_photos()
    total_photos = sum(len(v) for v in by_date.values())
    print(f'Dates found: {len(by_date)}  |  Unique photos: {total_photos}')
    for d in sorted(by_date):
        print(f'  {d}: {len(by_date[d])} photo(s)')

    # Load existing results (resume capability).
    # Entries marked 'skipped' (prior timeouts) are cleared so they get retried.
    results_by_file = {}
    if RESULTS_JSON.exists():
        try:
            saved = json.loads(RESULTS_JSON.read_text(encoding='utf-8'))
            results_by_file = {r['_file']: r for r in saved
                               if '_file' in r and r.get('confidence') != 'skipped'}
            skipped_prior = sum(1 for r in saved if r.get('confidence') == 'skipped')
            real_done = len(results_by_file)
            print(f'\nResuming — {real_done} photos already OCR\'d'
                  + (f', {skipped_prior} prior timeout(s) will be retried' if skipped_prior else ''))
        except Exception as e:
            print(f'  Warning: could not load resume file: {e}')

    # Snapshot filenames that existed before this run — these are historical and
    # must never be disposed regardless of confidence (rule: don't touch historical data).
    historical_files: set = set(results_by_file.keys())

    # OCR loop — FORCE_MODEL only, no fallback, timeouts logged and skipped
    print(f'\nModel: {FORCE_MODEL}  (free tier only — no fallback)')
    total_done    = len(results_by_file)
    total_err     = 0
    total_timeout = 0

    all_photos_flat = [(d, p) for d in sorted(by_date) for p in sorted(by_date[d], key=lambda x: x.name)]
    to_process      = [(d, p) for d, p in all_photos_flat if p.name not in results_by_file]

    print(f'To process: {len(to_process)} photos (already done: {total_done})\n')

    skipped_log = []  # (filename, reason) for final report

    for i, (date_str, img_path) in enumerate(to_process, 1):
        # One retry on 429; timeout → immediate skip
        for attempt in range(2):
            try:
                result = ocr_one(client, img_path)
                results_by_file[img_path.name] = result
                total_done += 1
                conf  = result.get('confidence', '?')
                sale  = result.get('total_sale', 0)
                exp   = result.get('total_expenses', 0)
                stype = result.get('sheet_type', '?')
                print(f'  [{i:2d}/{len(to_process)}] {img_path.name[:45]:<45} '
                      f'exp={str(exp):<9} sale={str(sale):<9} [{conf}] [{stype}]')
                RESULTS_JSON.write_text(
                    json.dumps(list(results_by_file.values()), indent=2), encoding='utf-8')
                if img_path.name not in historical_files:
                    dispose_photo(img_path, result)
                break

            except (_openai_mod.APITimeoutError, TimeoutError) as e:
                # Timeout — skip this photo, do not stall the run
                total_timeout += 1
                skip_result = {
                    '_file': img_path.name, '_date': date_str,
                    'confidence': 'skipped', 'total_expenses': 0, 'total_sale': 0,
                    'expense_items': '', 'sheet_type': 'skipped',
                    'error': f'timeout after 50s: {str(e)[:80]}', '_model': FORCE_MODEL
                }
                results_by_file[img_path.name] = skip_result
                skipped_log.append((img_path.name, date_str, 'timeout'))
                print(f'  [{i:2d}/{len(to_process)}] TIMEOUT — skipped: {img_path.name[:50]}')
                RESULTS_JSON.write_text(
                    json.dumps(list(results_by_file.values()), indent=2), encoding='utf-8')
                if img_path.name not in historical_files:
                    dispose_photo(img_path, skip_result)
                break

            except Exception as e:
                err_msg = str(e)

                # Hard daily limit — stop cleanly, run aggregation on what we have
                if 'free-models-per-day' in err_msg or 'daily' in err_msg.lower():
                    print(f'\n  STOPPED: Free-tier daily limit reached after {total_done} photos.')
                    print('  Re-run tomorrow to continue.')
                    RESULTS_JSON.write_text(
                        json.dumps(list(results_by_file.values()), indent=2), encoding='utf-8')
                    goto_summary(results_by_file, by_date, skipped_log)
                    return

                # Rate limit — one wait then retry
                if ('429' in err_msg or 'rate limit' in err_msg.lower()) and attempt == 0:
                    print(f'  [{i:2d}] Rate limit — waiting 15s...')
                    time.sleep(15)
                    continue  # retry

                # Any other error (after retry or on second attempt) — log and skip
                total_err += 1
                err_result = {
                    '_file': img_path.name, '_date': date_str,
                    'confidence': 'error', 'total_expenses': 0, 'total_sale': 0,
                    'expense_items': '', 'sheet_type': 'error',
                    'error': err_msg[:120], '_model': FORCE_MODEL
                }
                results_by_file[img_path.name] = err_result
                skipped_log.append((img_path.name, date_str, f'error: {err_msg[:60]}'))
                print(f'  [{i:2d}/{len(to_process)}] ERROR — skipped: {img_path.name[:40]} | {err_msg[:60]}')
                RESULTS_JSON.write_text(
                    json.dumps(list(results_by_file.values()), indent=2), encoding='utf-8')
                if img_path.name not in historical_files:
                    dispose_photo(img_path, err_result)
                break

        time.sleep(0.5)

    goto_summary(results_by_file, by_date, skipped_log)

def goto_summary(results_by_file, by_date, skipped_log=None):
    print('\n=== AGGREGATING EXPENSES PER DATE ===')

    expense_by_date = {}
    for date_str, photos in sorted(by_date.items()):
        # Exclude timeouts and errors from aggregation — only real OCR results count
        date_results = [results_by_file[p.name] for p in photos
                        if p.name in results_by_file
                        and results_by_file[p.name].get('confidence') not in ('skipped', 'error')]
        if not date_results:
            print(f'  {date_str}: no OCR results available — skipping')
            continue
        agg = aggregate_expenses(date_results)
        expense_by_date[date_str] = agg
        print(f'  {date_str}: expenses={agg["total"]:.0f}  method={agg["method"]}  '
              f'conf={agg["confidence"]}  photos={len(date_results)}'
              + (f'  LOW-CONF: {agg["low_conf_photos"]}' if agg.get("low_conf_photos") else '')
              + (f'  ERRORS: {agg["error_photos"]}'      if agg.get("error_photos") else ''))
        if agg.get('items'):
            print(f'           items: {agg["items"][:120]}')

    print('\n=== UPDATING MASTER EXCEL ===')
    stats = update_master_excel(expense_by_date)

    print('\n── Updated rows ──')
    net_profit_count = 0
    for date_str, info in sorted(stats['updated'].items()):
        np_str = f'  Net Profit = {info["net_profit"]:,.0f}' if isinstance(info.get('net_profit'), (int,float)) else ''
        print(f'  {date_str}  [{info["status"]}]  Expenses={info["expenses"]:,.0f}'
              f'  [{info["method"]}, {info["confidence"]}]{np_str}')
        if isinstance(info.get('net_profit'), (int,float)):
            net_profit_count += 1

    if stats.get('skipped'):
        print('\n── Skipped (policy: not touching these statuses) ──')
        for date_str, reason in sorted(stats['skipped'].items()):
            print(f'  {date_str}: {reason}')

    # Photos that failed OCR
    failed = [r for r in results_by_file.values() if r.get('confidence') == 'error']
    low    = [r for r in results_by_file.values()
              if r.get('confidence') == 'low' and r.get('confidence') != 'error']

    print(f'\n=== FINAL SUMMARY ===')
    print(f'Total unique photos OCR\'d: {len(results_by_file)}')
    print(f'Days with expenses written: {len(stats["updated"])}')
    print(f'Days now with real Net Profit: {net_profit_count}')
    print(f'Master Excel updated: {MASTER_XLSX}')

    skipped_timeout = [r for r in results_by_file.values() if r.get('confidence') == 'skipped']
    if skipped_timeout:
        print(f'\nPHOTOS SKIPPED (timeout — {len(skipped_timeout)}) — re-run to retry:')
        for r in skipped_timeout:
            print(f'  {r["_file"]} [{r.get("_date","")}]: {r.get("error","timeout")}')

    if failed:
        print(f'\nPHOTOS THAT FAILED OCR ({len(failed)}) — need manual entry:')
        for r in failed:
            print(f'  {r["_file"]}: {r.get("error","unknown error")}')

    if skipped_log:
        print(f'\nSKIPPED LOG ({len(skipped_log)} total):')
        for fname, dstr, reason in skipped_log:
            print(f'  {dstr}  {fname[:50]}: {reason}')

    if low:
        print(f'\nLOW CONFIDENCE results ({len(low)}) — check manually before trusting:')
        for r in low:
            exp = r.get("total_expenses", 0)
            if exp:
                print(f'  {r["_file"]}: expenses={exp}  model={r.get("_model","")}')

    print('\nDone.\n')

if __name__ == '__main__':
    main()
