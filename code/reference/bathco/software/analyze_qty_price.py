import zipfile, xml.etree.ElementTree as ET, os

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def get_shared_strings(zf):
    try:
        with zf.open('xl/sharedStrings.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
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
                                val = str(round(fval, 2))
                        except:
                            pass
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
# FILE 1: QUANTITY AND PRICE - main stock valuation file
# ============================================================
print('=' * 70)
print('FILE: QUANTITY AND PRICE.xlsx  (As Of 22 April 2026)')
print('=' * 70)
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\QUANTITY AND PRICE.xlsx'
rows = open_xlsx(fpath)

# Find header row
header_idx = None
for i, r in enumerate(rows):
    if any('CODE' in str(v).upper() for v in r):
        header_idx = i
        break

if header_idx is not None:
    print('Header row:', rows[header_idx])
    
    # Find column positions
    hrow = rows[header_idx]
    code_col = next((i for i, v in enumerate(hrow) if 'CODE' in str(v).upper()), None)
    desc_col = next((i for i, v in enumerate(hrow) if 'DESC' in str(v).upper()), None)
    cost_col = next((i for i, v in enumerate(hrow) if 'COST' in str(v).upper()), None)
    price_col = next((i for i, v in enumerate(hrow) if 'PRICE' in str(v).upper()), None)
    qty_col = next((i for i, v in enumerate(hrow) if 'QTY' in str(v).upper() or 'TOTALQTY' in str(v).upper()), None)
    print(f'Cols -> code:{code_col} desc:{desc_col} cost:{cost_col} price:{price_col} qty:{qty_col}')
    
    total_units = 0
    total_cost_val = 0
    total_sell_val = 0
    zero_cost_items = []
    below_cost_items = []
    code_1676 = None
    item_count = 0
    
    for r in rows[header_idx+1:]:
        if not r or not any(r):
            continue
        # Skip group header rows (A/V, etc.) - they have no qty/cost
        code = r[code_col] if code_col is not None and code_col < len(r) else ''
        desc = r[desc_col] if desc_col is not None and desc_col < len(r) else ''
        cost_str = r[cost_col] if cost_col is not None and cost_col < len(r) else ''
        price_str = r[price_col] if price_col is not None and price_col < len(r) else ''
        qty_str = r[qty_col] if qty_col is not None and qty_col < len(r) else ''
        
        if not code or not qty_str:
            continue
        # Skip rows that look like totals or headers
        if str(code).upper() in ('CODE', 'A/V', 'TOTAL', ''):
            continue
        
        try:
            qty = float(qty_str)
            cost = float(cost_str) if cost_str else 0
            price = float(price_str) if price_str else 0
        except:
            continue
        
        if qty <= 0:
            continue
        
        item_count += 1
        total_units += qty
        cost_val = qty * cost
        sell_val = qty * price
        total_cost_val += cost_val
        total_sell_val += sell_val
        
        if cost == 0:
            zero_cost_items.append((code, desc[:40], qty, price))
        if cost > 0 and price < cost:
            below_cost_items.append((code, desc[:40], qty, cost, price, round((price-cost)/cost*100,1)))
        if str(code) == '1676' or str(code).strip() == '1676':
            code_1676 = (code, desc[:50], qty, cost, price)
    
    print(f'\nTOTAL ITEMS WITH STOCK: {item_count}')
    print(f'TOTAL UNITS: {total_units:,.0f}')
    print(f'TOTAL COST VALUE: Rs. {total_cost_val:,.0f}')
    print(f'TOTAL SELLING VALUE: Rs. {total_sell_val:,.0f}')
    gp = (total_sell_val - total_cost_val) / total_sell_val * 100 if total_sell_val else 0
    print(f'POTENTIAL GP: {gp:.1f}%')
    
    print(f'\nZERO COST ITEMS ({len(zero_cost_items)}):')
    for it in zero_cost_items[:20]:
        print(f'  Code:{it[0]} | {it[1]} | Qty:{it[2]} | Price:{it[3]}')
    if len(zero_cost_items) > 20:
        print(f'  ... and {len(zero_cost_items)-20} more')
    
    print(f'\nBELOW COST ITEMS ({len(below_cost_items)}):')
    for it in below_cost_items[:20]:
        print(f'  Code:{it[0]} | {it[1]} | Qty:{it[2]} | Cost:{it[3]} | Price:{it[4]} | Margin:{it[5]}%')
    if len(below_cost_items) > 20:
        print(f'  ... and {len(below_cost_items)-20} more')
    
    print(f'\nCODE 1676:')
    if code_1676:
        c, d, q, co, p = code_1676
        gp1676 = (p-co)/p*100 if p else 0
        print(f'  Code:{c} | {d} | Qty:{q} | Cost:{co} | Price:{p} | GP:{gp1676:.1f}%')
        if p < co:
            print('  *** BELOW COST - SELLING AT A LOSS ***')
    else:
        print('  Not found in this file')
else:
    print('Could not find header row')
    for r in rows[:10]:
        print(r)
