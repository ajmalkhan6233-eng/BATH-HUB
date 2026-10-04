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

# ============================================================
# QUANTITY AND PRICE - Complete analysis
# ============================================================
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\QUANTITY AND PRICE.xlsx'
rows = open_xlsx(fpath)

header_idx = None
for i, r in enumerate(rows):
    if any('CODE' in str(v).upper() for v in r):
        header_idx = i
        break

hrow = rows[header_idx]
code_col = 0; desc_col = 1; cost_col = 6; price_col = 8; qty_col = 11

items = []
for r in rows[header_idx+1:]:
    if not r or len(r) < 5:
        continue
    code = str(r[0]).strip()
    if not code or code.upper() in ('CODE', 'A/V', ''):
        continue
    try:
        float(code)
    except:
        continue
    
    desc = str(r[desc_col])[:45] if desc_col < len(r) else ''
    cost_str = r[cost_col] if cost_col < len(r) else ''
    price_str = r[price_col] if price_col < len(r) else ''
    qty_str = r[qty_col] if qty_col < len(r) else ''
    
    try:
        qty = float(qty_str) if qty_str else 0
        cost = float(cost_str) if cost_str else 0
        price = float(price_str) if price_str else 0
    except:
        continue
    
    if qty <= 0:
        continue
    items.append({'code': code, 'desc': desc, 'qty': qty, 'cost': cost, 'price': price})

print('=== COMPLETE ZERO COST ITEMS (with stock, zero cost) ===')
zero = [i for i in items if i['cost'] == 0]
print(f'Total zero-cost items with stock: {len(zero)}')
total_zero_sell = sum(i['qty'] * i['price'] for i in zero)
total_zero_units = sum(i['qty'] for i in zero)
print(f'Units: {total_zero_units:.0f} | Inflated sell value: Rs. {total_zero_sell:,.0f}')
print()
for i in zero:
    gp = 'N/A (zero cost)' if i['price'] > 0 else 'No price either'
    print(f'  {i["code"]:6s} | {i["desc"]:<45s} | Qty:{i["qty"]:.0f} | Price:{i["price"]:.0f}')

print()
print('=== COMPLETE BELOW COST ITEMS (selling price < cost) ===')
below = [i for i in items if i['cost'] > 0 and i['price'] < i['cost'] and i['price'] > 0]
print(f'Total below-cost items: {len(below)}')
total_loss = sum(i['qty'] * (i['price'] - i['cost']) for i in below)
print(f'Total loss exposure: Rs. {total_loss:,.0f}')
print()
for i in sorted(below, key=lambda x: x['qty'] * (x['price'] - x['cost'])):
    margin = (i['price'] - i['cost']) / i['cost'] * 100
    loss = i['qty'] * (i['price'] - i['cost'])
    print(f'  {i["code"]:6s} | {i["desc"]:<45s} | Qty:{i["qty"]:.0f} | Cost:{i["cost"]:.0f} | Price:{i["price"]:.0f} | Margin:{margin:.1f}% | Loss:Rs.{loss:,.0f}')

print()
print('=== ITEMS WITH ZERO PRICE (no price set at all, has cost) ===')
no_price = [i for i in items if i['cost'] > 0 and i['price'] == 0]
print(f'Total: {len(no_price)}')
cost_exposure = sum(i['qty'] * i['cost'] for i in no_price)
print(f'Cost value at risk: Rs. {cost_exposure:,.0f}')
for i in no_price[:10]:
    print(f'  {i["code"]:6s} | {i["desc"]:<45s} | Qty:{i["qty"]:.0f} | Cost:{i["cost"]:.0f}')
if len(no_price) > 10:
    print(f'  ... and {len(no_price)-10} more')

print()
print('=== CODE 1676 (2x2 Floor Tile) ===')
for i in items:
    if i['code'] == '1676':
        gp = (i['price'] - i['cost']) / i['price'] * 100 if i['price'] > 0 else 0
        below = 'YES - LOSS ON EVERY SALE' if i['price'] < i['cost'] else 'NO'
        print(f'  Code: {i["code"]}')
        print(f'  Desc: {i["desc"]}')
        print(f'  Qty on hand: {i["qty"]:.0f}')
        print(f'  Cost: Rs. {i["cost"]:,.0f}')
        print(f'  Selling Price: Rs. {i["price"]:,.0f}')
        print(f'  GP%: {gp:.1f}%')
        print(f'  Below cost? {below}')
        print(f'  Margin per unit: Rs. {i["price"]-i["cost"]:.0f}')
