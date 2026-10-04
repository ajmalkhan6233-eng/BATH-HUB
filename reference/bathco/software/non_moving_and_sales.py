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

def open_xlsx(fpath):
    with zipfile.ZipFile(fpath, 'r') as zf:
        shared = get_shared_strings(zf)
        sheets = [n for n in zf.namelist() if n.startswith('xl/worksheets/') and n.endswith('.xml')]
        rows = read_all_rows(zf, shared, sheets[0])
    return rows

# NON MOVING - below cost items
print('=== NON MOVING - BELOW COST ITEMS ===')
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\NON MOVING.xlsx'
rows = open_xlsx(fpath)

header_idx = None
for i, r in enumerate(rows):
    if any('CODE' in str(v).upper() for v in r):
        header_idx = i
        break

hrow = rows[header_idx]
print('Header:', hrow[:14])

# CODE=0 DESC=1 COST=6 SELL=8 QTY=12
below_cost = []
for r in rows[header_idx+1:]:
    if not r or len(r) < 9:
        continue
    code = str(r[0]).strip()
    if not code:
        continue
    try:
        float(code)
    except:
        continue
    
    desc = str(r[1])[:45] if len(r) > 1 else ''
    cost_str = r[6] if 6 < len(r) else ''
    sell_str = r[8] if 8 < len(r) else ''
    qty_str = r[12] if 12 < len(r) else ''
    
    try:
        qty = float(qty_str) if qty_str else 0
        cost = float(cost_str) if cost_str else 0
        sell = float(sell_str) if sell_str else 0
    except:
        continue
    
    if qty > 0 and cost > 0 and sell > 0 and sell < cost:
        margin = (sell - cost) / cost * 100
        below_cost.append((code, desc, qty, cost, sell, margin, qty*(sell-cost)))

print(f'Below-cost items in non-moving stock: {len(below_cost)}')
total_loss = sum(i[6] for i in below_cost)
print(f'Total loss if sold: Rs. {total_loss:,.0f}')
for i in sorted(below_cost, key=lambda x: x[6]):
    print(f'  {i[0]:6s} | {i[1]:<45s} | Qty:{i[2]:.0f} | Cost:{i[3]:.0f} | Sell:{i[4]:.0f} | Margin:{i[5]:.1f}% | Loss:Rs.{i[6]:,.0f}')

# T SALE - top selling items by amount
print()
print('=== TOP 10 BEST SELLING ITEMS (by revenue, 2025-10-01 to 2026-04-22) ===')
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\T SALE.xlsx'
rows = open_xlsx(fpath)

# Find header row
header_idx = None
for i, r in enumerate(rows):
    if any(str(v).upper() == 'DT' for v in r[:3]):
        header_idx = i
        break

if header_idx is None:
    # T SALE is by transaction, let me check STOCK FAST for top by sold qty
    print('(Checking STOCK FAST for top sellers by quantity...)')
    fpath2 = r'C:\Users\1st Choice\bathco-data\4.22\4.22\STOCK FAST.xlsx'
    rows2 = open_xlsx(fpath2)
    header_idx2 = None
    for i, r in enumerate(rows2):
        if any('CODE' in str(v).upper() for v in r):
            header_idx2 = i
            break
    hrow2 = rows2[header_idx2]
    print('Header:', hrow2)
    # sold qty at col 15, sold amount at col 17
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
        price = str(r[7]) if 7 < len(r) else ''
        stock_qty = str(r[9]) if 9 < len(r) else ''
        sold_qty = str(r[15]) if 15 < len(r) else ''
        sold_amt = str(r[17]) if 17 < len(r) else ''
        try:
            sq = float(sold_qty) if sold_qty else 0
            sa = float(sold_amt) if sold_amt else 0
            st = float(stock_qty) if stock_qty else 0
        except:
            continue
        items2.append({'code': code, 'desc': desc, 'sold_qty': sq, 'sold_amt': sa, 'stock_qty': st, 'price': price})
    
    top10 = sorted(items2, key=lambda x: -x['sold_amt'])[:10]
    print(f'{"Code":6s} | {"Description":<40s} | {"Sold Qty":>9s} | {"Sold Amt Rs":>12s} | {"Stock Left":>10s}')
    print('-' * 90)
    for i in top10:
        print(f'  {i["code"]:6s} | {i["desc"]:<40s} | {i["sold_qty"]:>9,.0f} | {i["sold_amt"]:>12,.0f} | {i["stock_qty"]:>10,.0f}')
