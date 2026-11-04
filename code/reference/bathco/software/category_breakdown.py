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
# QUANTITY AND PRICE - Category breakdown
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

current_category = 'UNCATEGORIZED'
categories = {}

for r in rows[header_idx+1:]:
    if not r or len(r) < 2:
        continue
    
    # Check if this is a category header row
    code = str(r[0]).strip()
    if not code:
        continue
    
    is_numeric = False
    try:
        float(code)
        is_numeric = True
    except:
        pass
    
    # Category headers have text in col 0, nothing in other cols
    if not is_numeric:
        # Only a few meaningful vals - treat as category
        non_empty = [v for v in r if v and str(v).strip()]
        if len(non_empty) <= 3:
            current_category = str(r[0]).strip()
            if current_category not in categories:
                categories[current_category] = {'units': 0, 'cost_val': 0, 'sell_val': 0, 'items': 0, 'zero_cost': 0, 'zero_price': 0}
        continue
    
    # It's an item
    if current_category not in categories:
        categories[current_category] = {'units': 0, 'cost_val': 0, 'sell_val': 0, 'items': 0, 'zero_cost': 0, 'zero_price': 0}
    
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
    
    categories[current_category]['items'] += 1
    categories[current_category]['units'] += qty
    categories[current_category]['cost_val'] += qty * cost
    categories[current_category]['sell_val'] += qty * price
    if cost == 0:
        categories[current_category]['zero_cost'] += 1
    if price == 0:
        categories[current_category]['zero_price'] += 1

print('=== STOCK BY CATEGORY (As Of 22 April 2026) ===')
print(f'{"Category":<25} {"Items":>6} {"Units":>8} {"Cost Value":>14} {"Sell Value":>14} {"GP%":>6} {"Issues"}')
print('-' * 90)

total_items = 0
total_units = 0
total_cost = 0
total_sell = 0

for cat, d in sorted(categories.items()):
    gp = (d['sell_val'] - d['cost_val']) / d['sell_val'] * 100 if d['sell_val'] > 0 else 0
    flags = []
    if d['zero_cost'] > 0: flags.append(f'{d["zero_cost"]} zero-cost')
    if d['zero_price'] > 0: flags.append(f'{d["zero_price"]} no-price')
    flag_str = ', '.join(flags)
    
    print(f'{cat:<25} {d["items"]:>6} {d["units"]:>8,.0f} {d["cost_val"]:>14,.0f} {d["sell_val"]:>14,.0f} {gp:>5.1f}% {flag_str}')
    total_items += d['items']
    total_units += d['units']
    total_cost += d['cost_val']
    total_sell += d['sell_val']

print('-' * 90)
total_gp = (total_sell - total_cost) / total_sell * 100 if total_sell > 0 else 0
print(f'{"TOTAL":<25} {total_items:>6} {total_units:>8,.0f} {total_cost:>14,.0f} {total_sell:>14,.0f} {total_gp:>5.1f}%')

# List all zero-price items
print()
print('=== ALL 44 ZERO-PRICE ITEMS (cost > 0 but no selling price) ===')
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\QUANTITY AND PRICE.xlsx'
rows = open_xlsx(fpath)

header_idx = None
for i, r in enumerate(rows):
    if any('CODE' in str(v).upper() for v in r):
        header_idx = i
        break

no_price_items = []
for r in rows[header_idx+1:]:
    if not r or len(r) < 5:
        continue
    code = str(r[0]).strip()
    if not code:
        continue
    try:
        float(code)
    except:
        continue
    
    cost_str = r[6] if 6 < len(r) else ''
    price_str = r[8] if 8 < len(r) else ''
    qty_str = r[11] if 11 < len(r) else ''
    desc = str(r[1])[:45] if 1 < len(r) else ''
    
    try:
        qty = float(qty_str) if qty_str else 0
        cost = float(cost_str) if cost_str else 0
        price = float(price_str) if price_str else 0
    except:
        continue
    
    if qty > 0 and cost > 0 and price == 0:
        no_price_items.append((code, desc, qty, cost, qty*cost))

print(f'Total cost value of unpriced stock: Rs. {sum(i[4] for i in no_price_items):,.0f}')
print()
for i in sorted(no_price_items, key=lambda x: -x[4]):
    print(f'  {i[0]:6s} | {i[1]:<45s} | Qty:{i[2]:.0f} | Cost:{i[3]:.0f} | StockVal:Rs.{i[4]:,.0f}')
