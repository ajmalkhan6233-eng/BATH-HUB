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
                                val = str(round(fval, 4))
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
# NON MOVING - detailed analysis
# ============================================================
print('=' * 70)
print('NON MOVING.xlsx - Detailed cost/selling analysis')
print('=' * 70)
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\NON MOVING.xlsx'
rows = open_xlsx(fpath)

header_idx = None
for i, r in enumerate(rows):
    if any('CODE' in str(v).upper() for v in r):
        header_idx = i
        break

if header_idx is not None:
    hrow = rows[header_idx]
    print('Header:', hrow)
    code_col = 0
    desc_col = 1
    cost_col = 6
    sell_col = 8  # SELLING
    qty_col = 12  # STOCK QTY
    val_col = 13  # STOCK VAL
    
    total_units = 0
    total_cost_val = 0
    total_sell_val = 0
    zero_cost = []
    below_cost = []
    item_count = 0
    
    for r in rows[header_idx+1:]:
        if not r or len(r) < 5:
            continue
        code = r[code_col] if code_col < len(r) else ''
        if not code or str(code).upper() in ('CODE', 'A/V', ''):
            continue
        try:
            float(str(code))
        except:
            continue
        
        desc = r[desc_col] if desc_col < len(r) else ''
        cost_str = r[cost_col] if cost_col < len(r) else ''
        sell_str = r[sell_col] if sell_col < len(r) else ''
        qty_str = r[qty_col] if qty_col < len(r) else ''
        
        try:
            qty = float(qty_str) if qty_str else 0
            cost = float(cost_str) if cost_str else 0
            sell = float(sell_str) if sell_str else 0
        except:
            continue
        
        if qty <= 0:
            continue
        
        item_count += 1
        total_units += qty
        total_cost_val += qty * cost
        total_sell_val += qty * sell
        
        if cost == 0:
            zero_cost.append((code, str(desc)[:40], qty, sell))
        if cost > 0 and sell < cost:
            below_cost.append((code, str(desc)[:40], qty, cost, sell))
    
    print(f'Items: {item_count} | Units: {total_units:,.0f}')
    print(f'Cost Value: Rs. {total_cost_val:,.0f}')
    print(f'Sell Value: Rs. {total_sell_val:,.0f}')
    if total_sell_val > 0:
        print(f'GP: {(total_sell_val-total_cost_val)/total_sell_val*100:.1f}%')
    print(f'Zero cost: {len(zero_cost)} | Below cost: {len(below_cost)}')

# ============================================================
# PRICE LIST
# ============================================================
print()
print('=' * 70)
print('PRICE LIST.xlsx  (As Of 22 April 2026)')
print('=' * 70)
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\PRICE LIST.xlsx'
rows = open_xlsx(fpath)

header_idx = None
for i, r in enumerate(rows):
    if any('CODE' in str(v).upper() for v in r):
        header_idx = i
        break

if header_idx is not None:
    hrow = rows[header_idx]
    print('Header:', hrow)
    item_count = 0
    code_col = 0
    for r in rows[header_idx+1:]:
        if not r:
            continue
        code = r[code_col] if code_col < len(r) else ''
        if code and str(code).upper() not in ('CODE', 'A/V', ''):
            try:
                float(str(code))
                item_count += 1
            except:
                pass
    print(f'Total items in price list: {item_count}')

# ============================================================
# T SALE - Profit by Sales
# ============================================================
print()
print('=' * 70)
print('T SALE.xlsx  (2025-10-01 Through 2026-04-22)')
print('=' * 70)
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\T SALE.xlsx'
rows = open_xlsx(fpath)

header_idx = None
for i, r in enumerate(rows):
    if any(str(v).upper() in ('DT', 'DATE') for v in r[:3]):
        header_idx = i
        break

if header_idx is not None:
    hrow = rows[header_idx]
    print('Header:', hrow)
    # DT DATE NUMBER CUSTOMER AMOUNT BALANCE COST GPA GP%
    # 0  1         5       6       11      12      16      19   20
    dt_col = 0
    date_col = 1
    num_col = 5
    cust_col = 6
    amt_col = 11
    cost_col = 16
    gpa_col = 19
    gp_col = 20
    
    total_sales = 0
    total_cost = 0
    total_gpa = 0
    trans_count = 0
    
    for r in rows[header_idx+1:]:
        if not r or len(r) < 10:
            continue
        dt = r[dt_col] if dt_col < len(r) else ''
        if str(dt).upper() not in ('SLS', 'CRT'):
            continue
        try:
            amt = float(r[amt_col]) if amt_col < len(r) and r[amt_col] else 0
            cost = float(r[cost_col]) if cost_col < len(r) and r[cost_col] else 0
            gpa = float(r[gpa_col]) if gpa_col < len(r) and r[gpa_col] else 0
            total_sales += amt
            total_cost += cost
            total_gpa += gpa
            trans_count += 1
        except:
            pass
    
    print(f'Transactions: {trans_count}')
    print(f'Total Sales: Rs. {total_sales:,.0f}')
    print(f'Total Cost: Rs. {total_cost:,.0f}')
    print(f'Total GP Amount: Rs. {total_gpa:,.0f}')
    if total_sales > 0:
        print(f'Overall GP%: {(total_sales-total_cost)/total_sales*100:.1f}%')

# ============================================================
# PHYSICAL INVENTORY WORKSHEET
# ============================================================
print()
print('=' * 70)
print('PHYSICAL INVENTORY WORKSHEET.xlsx  (As Of 22 April 2026)')
print('=' * 70)
fpath = r'C:\Users\1st Choice\bathco-data\PHYSICAL INVERNTORY WORKSHEET.xlsx'
rows = open_xlsx(fpath)

header_idx = None
for i, r in enumerate(rows):
    if any('SKU' in str(v).upper() or 'CODE' in str(v).upper() for v in r):
        header_idx = i
        break

if header_idx is not None:
    hrow = rows[header_idx]
    print('Header:', hrow)
    code_col = 0
    oh_col = 8  # ON HAND
    phys_col = 10  # PHY COUNT
    
    item_count = 0
    on_hand_total = 0
    phys_total = 0
    discrepancies = []
    
    for r in rows[header_idx+1:]:
        if not r or len(r) < 3:
            continue
        code = r[code_col] if code_col < len(r) else ''
        if not code or str(code).upper() in ('SKU', 'CODE', 'A/V', ''):
            continue
        try:
            float(str(code))
        except:
            continue
        
        desc = r[1] if 1 < len(r) else ''
        oh_str = r[oh_col] if oh_col < len(r) else ''
        phys_str = r[phys_col] if phys_col < len(r) else ''
        
        try:
            oh = float(oh_str) if oh_str else 0
            on_hand_total += oh
            item_count += 1
        except:
            oh = 0
        
        try:
            phys = float(phys_str) if phys_str else None
            if phys is not None:
                phys_total += phys
                if abs(phys - oh) > 0.5:
                    discrepancies.append((code, str(desc)[:35], oh, phys, phys-oh))
        except:
            pass
    
    print(f'Items: {item_count}')
    print(f'System On Hand total: {on_hand_total:,.0f} units')
    print(f'Physical Count total: {phys_total:,.0f} units')
    if discrepancies:
        print(f'Discrepancies ({len(discrepancies)} items):')
        for d in discrepancies[:15]:
            print(f'  Code:{d[0]} | {d[1]} | System:{d[2]} | Physical:{d[3]} | Diff:{d[4]:+.0f}')
        if len(discrepancies) > 15:
            print(f'  ... and {len(discrepancies)-15} more')
