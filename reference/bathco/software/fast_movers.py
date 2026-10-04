# -*- coding: utf-8 -*-
import sys, zipfile, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def get_shared_strings(zf):
    try:
        with zf.open('xl/sharedStrings.xml') as f:
            content = f.read().decode('utf-8', errors='replace')
            root = ET.fromstring(content)
            strings = []
            for si in root.findall(NS + 'si'):
                t_texts = [t.text or '' for t in si.findall('.//' + NS + 't')]
                strings.append(''.join(t_texts))
            return strings
    except:
        return []

def read_all_rows(zf, shared, sheet_path):
    rows = []
    try:
        with zf.open(sheet_path) as f:
            content = f.read().decode('utf-8', errors='replace')
            root = ET.fromstring(content)
            for row_el in root.iter(NS + 'row'):
                row_data = []
                for c in row_el.iter(NS + 'c'):
                    t = c.get('t', '')
                    v_el = c.find(NS + 'v')
                    val = v_el.text if v_el is not None else ''
                    if t == 's' and val and shared:
                        try:
                            val = shared[int(val)]
                        except:
                            pass
                    elif val:
                        try:
                            fval = float(val)
                            if fval == int(fval):
                                val = str(int(fval))
                            else:
                                val = str(round(fval, 4))
                        except:
                            pass
                    val = ''.join(ch if ord(ch) < 128 else '?' for ch in str(val))
                    row_data.append(val)
                if any(v for v in row_data):
                    rows.append(row_data)
    except Exception as e:
        rows = [['ERROR: ' + str(e)[:200]]]
    return rows

fpath2 = r'C:\Users\1st Choice\bathco-data\4.22\4.22\STOCK FAST.xlsx'
with zipfile.ZipFile(fpath2, 'r') as zf:
    shared = get_shared_strings(zf)
    sheets = [n for n in zf.namelist() if n.startswith('xl/worksheets/') and n.endswith('.xml')]
    rows2 = read_all_rows(zf, shared, sheets[0])

header_idx2 = None
for i, r in enumerate(rows2):
    if any('CODE' in str(v).upper() for v in r):
        header_idx2 = i
        break

hrow2 = rows2[header_idx2]
print('FAST MOVING Header:', hrow2)

items2 = []
for r in rows2[header_idx2+1:]:
    if not r:
        continue
    code = str(r[0]).strip()
    if not code:
        continue
    try:
        float(code)
    except:
        continue
    desc = str(r[1])[:40] if len(r) > 1 else ''
    dept = str(r[3]) if 3 < len(r) else ''
    price = str(r[7]) if 7 < len(r) else ''
    stock_qty = str(r[9]) if 9 < len(r) else ''
    stock_val = str(r[10]) if 10 < len(r) else ''
    sold_qty = str(r[15]) if 15 < len(r) else ''
    sold_amt = str(r[17]) if 17 < len(r) else ''
    try:
        sq = float(sold_qty) if sold_qty else 0
        sa = float(sold_amt) if sold_amt else 0
        st = float(stock_qty) if stock_qty else 0
        sv = float(stock_val) if stock_val else 0
    except:
        continue
    items2.append({'code': code, 'desc': desc, 'dept': dept, 'sold_qty': sq, 'sold_amt': sa, 'stock_qty': st, 'stock_val': sv, 'price': price})

print()
print('=== TOP 15 FAST MOVERS BY REVENUE (2025-11-08 to 2026-04-22) ===')
top15 = sorted(items2, key=lambda x: -x['sold_amt'])[:15]
print(f'{"Code":6s} | {"Description":<38s} | {"Dept":<12s} | {"Sold Qty":>9s} | {"Revenue Rs":>12s} | {"Stock Left":>10s}')
print('-' * 100)
for i in top15:
    print(f'  {i["code"]:6s} | {i["desc"]:<38s} | {i["dept"]:<12s} | {i["sold_qty"]:>9,.0f} | {i["sold_amt"]:>12,.0f} | {i["stock_qty"]:>10,.0f}')

print()
print('=== FAST MOVERS STOCK SUMMARY ===')
total_fast_items = len(items2)
total_fast_sold_qty = sum(i['sold_qty'] for i in items2)
total_fast_sold_amt = sum(i['sold_amt'] for i in items2)
total_fast_stock = sum(i['stock_qty'] for i in items2)
total_fast_stockval = sum(i['stock_val'] for i in items2)
print(f'Fast moving SKUs: {total_fast_items}')
print(f'Total sold qty (period): {total_fast_sold_qty:,.0f}')
print(f'Total sold revenue (period): Rs. {total_fast_sold_amt:,.0f}')
print(f'Current stock qty (fast movers): {total_fast_stock:,.0f}')
print(f'Current stock value (fast movers): Rs. {total_fast_stockval:,.0f}')

# Department breakdown
depts = {}
for i in items2:
    d = i['dept']
    if d not in depts:
        depts[d] = {'items': 0, 'sold_qty': 0, 'sold_amt': 0, 'stock_qty': 0, 'stock_val': 0}
    depts[d]['items'] += 1
    depts[d]['sold_qty'] += i['sold_qty']
    depts[d]['sold_amt'] += i['sold_amt']
    depts[d]['stock_qty'] += i['stock_qty']
    depts[d]['stock_val'] += i['stock_val']

print()
print('=== FAST MOVERS BY DEPARTMENT ===')
print(f'{"Dept":<20s} | {"SKUs":>5s} | {"Sold Qty":>10s} | {"Revenue Rs":>14s} | {"Stock Qty":>10s} | {"Stock Val Rs":>14s}')
print('-' * 85)
for d, v in sorted(depts.items(), key=lambda x: -x[1]['sold_amt']):
    if d:
        print(f'  {d:<20s} | {v["items"]:>5} | {v["sold_qty"]:>10,.0f} | {v["sold_amt"]:>14,.0f} | {v["stock_qty"]:>10,.0f} | {v["stock_val"]:>14,.0f}')
