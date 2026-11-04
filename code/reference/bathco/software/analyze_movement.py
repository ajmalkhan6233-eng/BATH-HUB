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
# FILE 2: TOTAL Q - Total Quantity On Hand
# ============================================================
print('=' * 70)
print('FILE: TOTAL Q.xlsx  (As Of 22 April 2026)')
print('=' * 70)
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\TOTAL Q.xlsx'
rows = open_xlsx(fpath)

header_idx = None
for i, r in enumerate(rows):
    if any('CODE' in str(v).upper() for v in r):
        header_idx = i
        break

if header_idx is not None:
    hrow = rows[header_idx]
    print('Header:', hrow)
    code_col = next((i for i, v in enumerate(hrow) if str(v).strip().upper() == 'CODE'), None)
    qty_col = next((i for i, v in enumerate(hrow) if 'TOTAL QTY' in str(v).upper() or 'TOTALQTY' in str(v).upper()), None)
    price_col = next((i for i, v in enumerate(hrow) if 'PRICE' in str(v).upper()), None)
    print(f'Cols -> code:{code_col} qty:{qty_col} price:{price_col}')
    
    total_units = 0
    item_count = 0
    for r in rows[header_idx+1:]:
        if not r or len(r) < 2:
            continue
        code = r[code_col] if code_col is not None and code_col < len(r) else ''
        qty_str = r[qty_col] if qty_col is not None and qty_col < len(r) else ''
        if not code or str(code).upper() in ('CODE', 'A/V', ''):
            continue
        try:
            qty = float(qty_str)
            if qty > 0:
                total_units += qty
                item_count += 1
        except:
            pass
    print(f'Items with stock: {item_count}')
    print(f'Total units: {total_units:,.0f}')

# ============================================================
# FILE 3: STOCK FAST
# ============================================================
print()
print('=' * 70)
print('FILE: STOCK FAST.xlsx  (2025-11-08 Through 2026-04-22)')
print('=' * 70)
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\STOCK FAST.xlsx'
rows = open_xlsx(fpath)

header_idx = None
for i, r in enumerate(rows):
    if any('CODE' in str(v).upper() for v in r):
        header_idx = i
        break

if header_idx is not None:
    hrow = rows[header_idx]
    print('Header:', hrow)
    code_col = next((i for i, v in enumerate(hrow) if str(v).strip().upper() == 'CODE'), None)
    desc_col = next((i for i, v in enumerate(hrow) if 'DESC' in str(v).upper()), None)
    qty_sold_col = next((i for i, v in enumerate(hrow) if 'QTY' in str(v).upper() and 'SOLD' in str(v).upper()), None)
    if qty_sold_col is None:
        qty_sold_col = next((i for i, v in enumerate(hrow) if 'QTY' in str(v).upper()), None)
    print(f'Cols -> code:{code_col} desc:{desc_col} qty_sold:{qty_sold_col}')
    item_count = 0
    for r in rows[header_idx+1:]:
        if not r:
            continue
        code = r[code_col] if code_col is not None and code_col < len(r) else ''
        if code and str(code).upper() not in ('CODE', 'A/V', ''):
            try:
                float(str(code))
                item_count += 1
            except:
                pass
    print(f'Fast moving items count: {item_count}')
    # Show first 5 items
    count = 0
    for r in rows[header_idx+1:]:
        if not r or len(r) < 3:
            continue
        code = r[code_col] if code_col is not None and code_col < len(r) else ''
        if code and str(code).upper() not in ('CODE', 'A/V', ''):
            try:
                float(str(code))
                print(f'  {r}')
                count += 1
                if count >= 5:
                    break
            except:
                pass

# ============================================================
# FILE 4: SLOW
# ============================================================
print()
print('=' * 70)
print('FILE: SLOW.xlsx  (2025-11-01 Through 2026-04-22)')
print('=' * 70)
fpath = r'C:\Users\1st Choice\bathco-data\4.22\4.22\SLOW.xlsx'
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
    code_col = next((i for i, v in enumerate(hrow) if str(v).strip().upper() == 'CODE'), None)
    for r in rows[header_idx+1:]:
        if not r:
            continue
        code = r[code_col] if code_col is not None and code_col < len(r) else ''
        if code and str(code).upper() not in ('CODE', 'A/V', ''):
            try:
                float(str(code))
                item_count += 1
            except:
                pass
    print(f'Slow moving items count: {item_count}')

# ============================================================
# FILE 5: NON MOVING
# ============================================================
print()
print('=' * 70)
print('FILE: NON MOVING.xlsx  (2025-10-01 Through 2026-04-22)')
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
    item_count = 0
    total_units = 0
    code_col = next((i for i, v in enumerate(hrow) if str(v).strip().upper() == 'CODE'), None)
    qty_col = next((i for i, v in enumerate(hrow) if 'QTY' in str(v).upper() or 'ON HAND' in str(v).upper()), None)
    cost_col = next((i for i, v in enumerate(hrow) if 'COST' in str(v).upper()), None)
    print(f'Cols -> code:{code_col} qty:{qty_col} cost:{cost_col}')
    for r in rows[header_idx+1:]:
        if not r:
            continue
        code = r[code_col] if code_col is not None and code_col < len(r) else ''
        if code and str(code).upper() not in ('CODE', 'A/V', ''):
            try:
                float(str(code))
                item_count += 1
                if qty_col is not None and qty_col < len(r):
                    try:
                        total_units += float(r[qty_col])
                    except:
                        pass
            except:
                pass
    print(f'Non-moving items count: {item_count}')
    print(f'Non-moving total units: {total_units:,.0f}')
