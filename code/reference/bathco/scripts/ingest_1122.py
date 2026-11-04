#!/usr/bin/env python
"""
BATHCO 1122 Ingestion Agent
Processes Desktop\1122 folder: DALY SALES REPORT, day files, RepSalesAnalysis, PDFs
Usage:
  python ingest_1122.py           # dry-run (default)
  python ingest_1122.py --commit  # actually insert
"""
import os, sys, glob, hashlib, re
from datetime import datetime, date
import openpyxl
import pdfplumber
import psycopg2
from psycopg2.extras import execute_values
from dotenv import dotenv_values

# ---------------------------------------------------------------------------
DRY_RUN   = '--commit' not in sys.argv
ROOT      = r'C:\Users\DELL\Desktop\1122'
ARCHIVE   = r'C:\BATHCO_PHASE1\archive\1122'
ENV_PATH  = r'C:\BATHCO_PHASE1\.env'
# ---------------------------------------------------------------------------

env = dotenv_values(ENV_PATH)
DB_PW = env.get('DB_PASSWORD', '')

def get_conn():
    return psycopg2.connect(host='localhost', port=5432, database='bathco',
                            user='postgres', password=DB_PW)

# ---------------------------------------------------------------------------
# STEP 0: Create tables (idempotent)
# ---------------------------------------------------------------------------
CREATE_SQL = """
CREATE TABLE IF NOT EXISTS daily_expenses (
  id SERIAL PRIMARY KEY, date DATE, item TEXT, amount NUMERIC,
  category TEXT, created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, item, amount)
);
CREATE TABLE IF NOT EXISTS daily_payments (
  id SERIAL PRIMARY KEY, date DATE, payee TEXT, amount NUMERIC,
  type TEXT, notes TEXT, created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS lasersoft_invoices (
  id SERIAL PRIMARY KEY, date DATE, invoice_no TEXT, customer TEXT,
  amount NUMERIC, cost NUMERIC, gross_profit NUMERIC, gp_pct NUMERIC,
  user_id TEXT, notes TEXT, created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, invoice_no)
);
CREATE TABLE IF NOT EXISTS reconciliation_flags (
  id SERIAL PRIMARY KEY, date DATE, flag_type TEXT, description TEXT,
  amount NUMERIC, priority TEXT, resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pdf_extracts (
  id SERIAL PRIMARY KEY, filename TEXT, file_path TEXT,
  extract_date DATE, raw_text TEXT, identified_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS grn_records (
  id SERIAL PRIMARY KEY, date DATE, supplier TEXT,
  invoice_ref TEXT, amount NUMERIC, notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cheque_payments (
  id SERIAL PRIMARY KEY, date DATE, cheque_no TEXT,
  payee TEXT, amount NUMERIC, bank TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS file_archive (
  id SERIAL PRIMARY KEY, original_path TEXT, archive_path TEXT,
  file_type TEXT, processed_at TIMESTAMP DEFAULT NOW()
);
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def md5(path):
    h = hashlib.md5()
    try:
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None

MIN_DATE = date(2025, 1, 1)

def to_date(val):
    if val is None: return None
    if isinstance(val, (date, datetime)):
        d = val.date() if isinstance(val, datetime) else val
        return d if d >= MIN_DATE else None
    s = str(val).strip()
    for fmt in ('%d-%m-%Y','%d/%m/%Y','%Y-%m-%d','%d.%m.%y','%d.%m.%Y'):
        try:
            d = datetime.strptime(s, fmt).date()
            return d if d >= MIN_DATE else None
        except: pass
    return None

def to_num(val):
    if val is None: return None
    try: return float(str(val).replace(',','').strip())
    except: return None

def find_files(pattern):
    return sorted(glob.glob(os.path.join(ROOT, '**', pattern), recursive=True))

def dedup(files):
    seen = {}
    out  = []
    for f in files:
        h = md5(f)
        if h and h not in seen:
            seen[h] = f
            out.append(f)
    return out

# ---------------------------------------------------------------------------
# PARSE: DALY SALES REPORT style (invoice-level rows, date forward-fill)
# Returns list of dicts per invoice row
# ---------------------------------------------------------------------------
def parse_sales_report(path):
    rows = []
    try:
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb.active
        cur_date = None
        header_found = False
        for row in ws.iter_rows(values_only=True):
            vals = list(row)
            if not any(v for v in vals if v is not None):
                continue
            # Header row detection
            if not header_found:
                if vals[0] and str(vals[0]).strip().upper() == 'DATE':
                    header_found = True
                continue
            # Date forward-fill
            d = to_date(vals[0])
            if d: cur_date = d
            if not cur_date: continue
            invoice_no = str(vals[1]).strip() if vals[1] else None
            if not invoice_no: continue
            rows.append({
                'date':       cur_date,
                'invoice_no': invoice_no,
                'amount':     to_num(vals[2]),
                'cash':       to_num(vals[3]),
                'card':       to_num(vals[4]),
                'online':     to_num(vals[5]),
                'cheque':     to_num(vals[6]),
                'credit':     to_num(vals[7]),
                'source':     os.path.basename(path),
            })
    except Exception as e:
        print(f'  WARN parse_sales_report {os.path.basename(path)}: {e}')
    return rows

# ---------------------------------------------------------------------------
# PARSE: RepSalesAnalysis (product-level GP per date range)
# ---------------------------------------------------------------------------
def parse_rep_sales(path):
    rows = []
    try:
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb.active
        date_from = date_to = None
        rep_name  = None
        in_data   = False
        for row in ws.iter_rows(values_only=True):
            vals = list(row)
            if not any(v for v in vals if v is not None): continue
            cell0 = str(vals[0]).strip() if vals[0] else ''
            # Extract date range
            if cell0.startswith('DATE:'):
                m = re.findall(r'\d{4}-\d{2}-\d{2}', cell0)
                if len(m) >= 1: date_from = datetime.strptime(m[0], '%Y-%m-%d').date()
                if len(m) >= 2: date_to   = datetime.strptime(m[1], '%Y-%m-%d').date()
                else:           date_to   = date_from
            elif cell0.startswith('REP:'):
                rep_name = cell0
            elif cell0 == 'CODE':
                in_data = True
            elif in_data and vals[0] and str(vals[0]).strip() not in ('', 'CODE'):
                code     = str(vals[0]).strip()
                desc     = str(vals[1]).strip() if vals[1] else ''
                net_sls  = to_num(vals[7])
                net_pro  = to_num(vals[8])
                if net_sls is None: continue
                gp_pct   = round(net_pro/net_sls*100, 2) if net_sls and net_pro else None
                rows.append({
                    'date_from':  date_from,
                    'date_to':    date_to,
                    'invoice_no': f'REP-{code}',
                    'customer':   desc[:100] if desc else None,
                    'amount':     net_sls,
                    'gross_profit': net_pro,
                    'gp_pct':     gp_pct,
                    'user_id':    rep_name,
                    'notes':      os.path.basename(path),
                })
    except Exception as e:
        print(f'  WARN parse_rep_sales {os.path.basename(path)}: {e}')
    return rows

# ---------------------------------------------------------------------------
# PARSE: PDF — extract raw text
# ---------------------------------------------------------------------------
def parse_pdf(path):
    try:
        text_parts = []
        with pdfplumber.open(path) as pdf:
            for pg in pdf.pages:
                t = pg.extract_text()
                if t: text_parts.append(t)
        raw = '\n'.join(text_parts)
        identified = 'INVOICE' if re.search(r'invoice|receipt', raw, re.I) else \
                     'GRN'     if re.search(r'grn|goods received', raw, re.I) else \
                     'REPORT'  if re.search(r'sales|profit|analysis', raw, re.I) else 'UNKNOWN'
        return raw[:50000], identified
    except Exception as e:
        return None, f'ERROR:{e}'

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print(f'\n{"DRY RUN" if DRY_RUN else "LIVE COMMIT"} — BATHCO 1122 Ingestion')
    print('='*55)

    conn = get_conn()
    cur  = conn.cursor()

    # Step 0: Tables
    if not DRY_RUN:
        cur.execute(CREATE_SQL)
        conn.commit()
        print('Tables: ensured (CREATE IF NOT EXISTS)')
    else:
        print('Tables: would CREATE IF NOT EXISTS (8 tables)')

    # ---------------------------------------------------------------------------
    # STEP 1: DALY SALES REPORT files -> lasersoft_invoices
    # Use DALY SALES REPORT.xlsx as master (largest/latest wins by row count)
    # ---------------------------------------------------------------------------
    print('\n[1] DALY SALES REPORT -> lasersoft_invoices')
    report_files = dedup(find_files('DALY SALES REPORT*.xlsx') +
                         find_files('DALY SALES REPORT - Copy.xlsx'))
    # Also include per-day files from DAY SALE folder
    day_files = dedup(find_files('[0-9][0-9]-[0-9][0-9]-2026.xlsx'))
    print(f'    Report files (deduped): {len(report_files)} | Day files: {len(day_files)}')

    invoice_rows = []
    seen_invoices = set()
    for f in report_files + day_files:
        parsed = parse_sales_report(f)
        for r in parsed:
            key = (r['date'], r['invoice_no'])
            if key not in seen_invoices:
                seen_invoices.add(key)
                invoice_rows.append(r)

    print(f'    Unique invoices: {len(invoice_rows)}')
    dates_covered = sorted(set(r['date'] for r in invoice_rows))
    if dates_covered:
        print(f'    Date range: {dates_covered[0]} -> {dates_covered[-1]} ({len(dates_covered)} dates)')

    if not DRY_RUN and invoice_rows:
        inserted = 0
        for r in invoice_rows:
            try:
                cur.execute("""
                  INSERT INTO lasersoft_invoices
                    (date, invoice_no, customer, amount, notes)
                  VALUES (%s,%s,%s,%s,%s)
                  ON CONFLICT (date, invoice_no) DO NOTHING
                """, (r['date'], r['invoice_no'], None, r['amount'], r['source']))
                inserted += cur.rowcount
            except Exception as e:
                print(f'    WARN insert invoice: {e}')
        conn.commit()
        print(f'    Inserted: {inserted} / {len(invoice_rows)} (rest: ON CONFLICT DO NOTHING)')

    # ---------------------------------------------------------------------------
    # STEP 2: RepSalesAnalysis -> lasersoft_invoices (product-level GP)
    # Single-date files only (date_from == date_to) — these are usable as daily GP ref
    # ---------------------------------------------------------------------------
    print('\n[2] RepSalesAnalysis -> lasersoft_invoices (GP reference)')
    rep_files = dedup(find_files('RepSalesAnalysis_*.xlsx'))
    print(f'    RepSalesAnalysis files (deduped): {len(rep_files)}')

    rep_rows        = []
    rep_date_totals = {}  # date -> {net_sls, net_pro}
    seen_rep        = set()
    for f in rep_files:
        parsed = parse_rep_sales(f)
        for r in parsed:
            # Only store single-date entries in lasersoft_invoices
            if r['date_from'] == r['date_to']:
                key = (r['date_from'], r['invoice_no'], r.get('user_id',''))
                if key not in seen_rep:
                    seen_rep.add(key)
                    rep_rows.append(r)
                # Accumulate totals for flag check
                d = r['date_from']
                if d not in rep_date_totals:
                    rep_date_totals[d] = {'net_sls': 0, 'net_pro': 0}
                rep_date_totals[d]['net_sls'] += r['amount'] or 0
                rep_date_totals[d]['net_pro'] += r['gross_profit'] or 0

    print(f'    Single-date product rows: {len(rep_rows)}')
    print(f'    Dates with GP data: {len(rep_date_totals)} ({sorted(rep_date_totals.keys())[:3]}...)')

    if not DRY_RUN and rep_rows:
        inserted = 0
        for r in rep_rows:
            try:
                cur.execute("""
                  INSERT INTO lasersoft_invoices
                    (date, invoice_no, customer, amount, gross_profit, gp_pct, user_id, notes)
                  VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                  ON CONFLICT (date, invoice_no) DO NOTHING
                """, (r['date_from'], r['invoice_no'], r['customer'],
                      r['amount'], r['gross_profit'], r['gp_pct'],
                      r['user_id'], r['notes']))
                inserted += cur.rowcount
            except Exception as e:
                print(f'    WARN insert rep: {e}')
        conn.commit()
        print(f'    Inserted: {inserted}')

    # ---------------------------------------------------------------------------
    # STEP 3: MANUAL_BILLING flags — Excel total vs Lasersoft total per day
    # ---------------------------------------------------------------------------
    print('\n[3] MANUAL_BILLING flags (Excel vs Lasersoft GP dates)')
    # Build Excel daily totals from invoice_rows
    excel_totals = {}
    for r in invoice_rows:
        d = r['date']
        excel_totals[d] = excel_totals.get(d, 0) + (r['amount'] or 0)

    flags = []
    for d, gp_data in rep_date_totals.items():
        excel_amt = excel_totals.get(d)
        las_amt   = gp_data['net_sls']
        if excel_amt is not None and las_amt > 0:
            diff = abs(excel_amt - las_amt)
            if diff > 100:  # tolerance Rs. 100
                flags.append({
                    'date':        d,
                    'flag_type':   'MANUAL_BILLING',
                    'description': f'Excel total {excel_amt:,.0f} vs Lasersoft {las_amt:,.0f} (diff {diff:,.0f})',
                    'amount':      diff,
                    'priority':    'HIGH' if diff > 50000 else 'MEDIUM',
                })

    print(f'    MANUAL_BILLING flags: {len(flags)}')
    for fl in flags:
        print(f'    [{fl["priority"]}] {fl["date"]} — {fl["description"]}')

    if not DRY_RUN and flags:
        for fl in flags:
            cur.execute("""
              INSERT INTO reconciliation_flags (date, flag_type, description, amount, priority)
              VALUES (%s,%s,%s,%s,%s)
            """, (fl['date'], fl['flag_type'], fl['description'], fl['amount'], fl['priority']))
        conn.commit()
        print(f'    Flags written: {len(flags)}')

    # ---------------------------------------------------------------------------
    # STEP 4: PDF files -> pdf_extracts
    # ---------------------------------------------------------------------------
    print('\n[4] PDF files -> pdf_extracts')
    pdf_files = dedup(find_files('*.pdf'))
    print(f'    PDF files (deduped): {len(pdf_files)}')

    pdf_rows = []
    for f in pdf_files:
        raw, identified = parse_pdf(f)
        if raw:
            pdf_rows.append({
                'filename':       os.path.basename(f),
                'file_path':      f,
                'extract_date':   date.today(),
                'raw_text':       raw,
                'identified_type': identified,
            })
        else:
            print(f'    SKIP (empty/error): {os.path.basename(f)} — {identified}')

    print(f'    PDFs parsed OK: {len(pdf_rows)}')
    type_counts = {}
    for r in pdf_rows:
        type_counts[r['identified_type']] = type_counts.get(r['identified_type'], 0) + 1
    for t, c in type_counts.items():
        print(f'      {t}: {c}')

    if not DRY_RUN and pdf_rows:
        inserted = 0
        for r in pdf_rows:
            try:
                cur.execute("""
                  INSERT INTO pdf_extracts (filename, file_path, extract_date, raw_text, identified_type)
                  VALUES (%s,%s,%s,%s,%s)
                  ON CONFLICT DO NOTHING
                """, (r['filename'], r['file_path'], r['extract_date'],
                      r['raw_text'], r['identified_type']))
                inserted += cur.rowcount
            except Exception as e:
                print(f'    WARN insert pdf: {e}')
        conn.commit()
        print(f'    Inserted: {inserted}')

    # ---------------------------------------------------------------------------
    # STEP 5: file_archive — record ALL files processed (copy ref only)
    # ---------------------------------------------------------------------------
    print('\n[5] file_archive — cataloguing all source files')
    all_files = []
    for ext in ('*.xlsx', '*.pdf', '*.txt'):
        all_files += find_files(ext)
    all_files = list(set(all_files))
    print(f'    Total files to catalogue: {len(all_files)}')

    if not DRY_RUN:
        inserted = 0
        for f in all_files:
            ext = os.path.splitext(f)[1].upper().lstrip('.')
            rel = os.path.relpath(f, ROOT)
            archive_path = os.path.join(ARCHIVE, rel)
            try:
                cur.execute("""
                  INSERT INTO file_archive (original_path, archive_path, file_type)
                  VALUES (%s,%s,%s)
                  ON CONFLICT DO NOTHING
                """, (f, archive_path, ext))
                inserted += cur.rowcount
            except Exception as e:
                pass
        conn.commit()
        print(f'    Catalogued: {inserted}')

    # ---------------------------------------------------------------------------
    # STEP 8: FINAL SUMMARY REPORT
    # ---------------------------------------------------------------------------
    total_rows = len(invoice_rows) + len(rep_rows) + len(pdf_rows)
    critical   = [fl for fl in flags if fl['priority'] == 'HIGH']
    high       = flags

    d_range = f'{dates_covered[0]} to {dates_covered[-1]}' if dates_covered else 'N/A'
    rows_str    = '(DRY RUN - 0)' if DRY_RUN else str(total_rows)
    archive_str = '(DRY RUN)'    if DRY_RUN else str(len(all_files))
    print()
    print('+--------------------------------------------------+')
    print('|         BATHCO INGESTION COMPLETE                |')
    print('+--------------------------------------------------+')
    print(f'| Files scanned:          {len(all_files):<25}|')
    print(f'| Excel files processed:  {len(report_files)+len(day_files)+len(rep_files):<25}|')
    print(f'| PDF files processed:    {len(pdf_rows):<25}|')
    print(f'| Dates covered:          {d_range:<25}|')
    print(f'| Rows inserted:          {rows_str:<25}|')
    print(f'| Flags raised:           {len(flags):<25}|')
    print(f'| CRITICAL flags:         {len(critical):<25}|')
    print(f'| Files archived:         {archive_str:<25}|')
    print('+--------------------------------------------------+')

    if flags:
        print('\nCRITICAL / HIGH flags:')
        for fl in flags:
            print(f'  [{fl["priority"]}] {fl["date"]} — {fl["flag_type"]}: {fl["description"]}')

    if DRY_RUN:
        print('\n** DRY RUN complete. Run with --commit to insert. **')

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
