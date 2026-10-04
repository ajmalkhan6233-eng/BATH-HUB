import openpyxl
import psycopg2
from datetime import datetime
import json

FILE = r'C:\BATHCO_PHASE1\DALI\DAY SALE\04-26\DALY SALES REPORT 01-01-2026 TO 04-26.xlsx'

wb = openpyxl.load_workbook(FILE, data_only=True)
ws = wb['Sheet1']

def num(v):
    if v is None:
        return 0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0

# accumulate per date
data = {}  # date_str -> dict of sums
order = []  # preserve order of first appearance

current_date = None

for row in ws.iter_rows(min_row=1, max_row=1300, values_only=True):
    a, b, c, d, e, f, g, h = row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7]

    # Try to parse a date in column A
    parsed_date = None
    if a is not None:
        if isinstance(a, datetime):
            parsed_date = a.date()
        elif isinstance(a, str):
            s = a.strip()
            for sep in ('/', '-', '.'):
                if sep in s:
                    parts = s.split(sep)
                    if len(parts) == 3:
                        try:
                            day, month, year = (int(p) for p in parts)
                            parsed_date = datetime(year, month, day).date()
                        except ValueError:
                            parsed_date = None
                    break

    if a is not None and parsed_date is None:
        # This is a non-date string in column A (e.g. "TOTAL SALE", header, etc.)
        # If it's the header row, skip; if "TOTAL..." row, skip entirely.
        continue

    if parsed_date is not None:
        current_date = parsed_date

    # Data row criteria: column B not None, and current_date is set,
    # and this row wasn't a "TOTAL..." text row (already filtered above)
    if b is not None and current_date is not None:
        ds = current_date.strftime('%Y-%m-%d')
        if ds not in data:
            data[ds] = {'sales': 0, 'cash': 0, 'card': 0, 'online': 0, 'cheq': 0, 'credit': 0}
            order.append(ds)
        data[ds]['sales'] += num(c)
        data[ds]['cash'] += num(d)
        data[ds]['card'] += num(e)
        data[ds]['online'] += num(f)
        data[ds]['cheq'] += num(g)
        data[ds]['credit'] += num(h)

import os
conn = psycopg2.connect(host=os.environ.get('DB_HOST','localhost'), port=int(os.environ.get('DB_PORT','5432')), dbname=os.environ.get('DB_NAME','bathhub'), user=os.environ.get('DB_USER','postgres'), password=os.environ['DB_PASSWORD'])  # was hardcoded in BATHCO; now from .env
cur = conn.cursor()

inserted_dates = []

for ds in order:
    d = data[ds]
    cur.execute("SELECT 1 FROM daily_summary WHERE report_date = %s", (ds,))
    exists = cur.fetchone()
    if exists:
        print(f"{ds}  total_sale={d['sales']}  SKIPPED (already exists)")
        continue

    notes = f"Cheque payments: {d['cheq']}" if d['cheq'] > 0 else None

    cur.execute("""
        INSERT INTO daily_summary
        (report_date, total_sale, cash_sale, card_sale, online_sale, credit_sale,
         cash_in, cash_out, cash_in_hand, gross_profit, net_profit, total_expenses,
         payments, salary, source, notes, checker_flags)
        VALUES (%s, %s, %s, %s, %s, %s, 0, 0, %s, 0, 0, 0, 0, 0, %s, %s, '[]'::jsonb)
    """, (ds, d['sales'], d['cash'], d['card'], d['online'], d['credit'],
          d['cash'], 'import_dali_master', notes))

    inserted_dates.append(ds)
    print(f"{ds}  total_sale={d['sales']}  INSERTED")

conn.commit()
cur.close()
conn.close()

print(f"AGENT1 INSERTED: {len(inserted_dates)} new days")
print(", ".join(inserted_dates))
