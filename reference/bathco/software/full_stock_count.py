import zipfile, xml.etree.ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def get_shared_strings(zf):
    try:
        with zf.open('xl/sharedStrings.xml') as f:
            content = f.read().decode('utf-8', errors='replace')
            if content.startswith('﻿'):
                content = content[1:]
            root = ET.fromstring(content)
            strings = []
            for si in root.findall(NS + 'si'):
                t_texts = [t.text or '' for t in si.findall('.//' + NS + 't')]
                strings.append(''.join(t_texts))
            return strings
    except Exception as e:
        return []

def read_all_rows(zf, shared, sheet_path):
    rows = []
    try:
        with zf.open(sheet_path) as f:
            content = f.read().decode('utf-8', errors='replace')
            if content.startswith('﻿'):
                content = content[1:]
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

fpath = r'C:\Users\1st Choice\bathco-data\STOCK_COUNT_REPORT_20_04_2026.xlsx'

with zipfile.ZipFile(fpath, 'r') as zf:
    shared = get_shared_strings(zf)
    all_sheets = sorted([n for n in zf.namelist() if n.startswith('xl/worksheets/') and n.endswith('.xml')])
    
    # Check each sheet to understand what they contain
    for s in all_sheets:
        rows = read_all_rows(zf, shared, s)
        if rows:
            print(f'Sheet: {s} | Rows: {len(rows)} | First: {rows[0]}')

print()
print('Reading ALL sheets to get complete stock picture...')
print()

# Now read all sheets and aggregate stock count data
with zipfile.ZipFile(fpath, 'r') as zf:
    shared = get_shared_strings(zf)
    all_sheets = sorted([n for n in zf.namelist() if n.startswith('xl/worksheets/') and n.endswith('.xml')])
    
    total_items = 0
    total_units = 0
    total_cost_val = 0
    zero_cost_items = []
    code_1676 = None
    sheet_names_seen = []
    
    for s in all_sheets:
        rows = read_all_rows(zf, shared, s)
        if not rows:
            continue
        
        title = str(rows[0][0]) if rows[0] else ''
        
        # Find header
        header_idx = None
        for i, r in enumerate(rows):
            if len(r) >= 3 and any('CODE' in str(v).upper() for v in r[:3]):
                if any('DESC' in str(v).upper() or 'QTY' in str(v).upper() for v in r):
                    header_idx = i
                    break
        
        if header_idx is None:
            print(f'{s}: No recognizable header. Title: {title[:60]}')
            continue
        
        hrow = rows[header_idx]
        code_col = next((i for i, v in enumerate(hrow) if str(v).strip().upper() == 'CODE'), 0)
        desc_col = next((i for i, v in enumerate(hrow) if 'DESC' in str(v).upper()), 1)
        qty_col = next((i for i, v in enumerate(hrow) if 'QTY' in str(v).upper() or 'COUNT' in str(v).upper()), 2)
        cost_col = next((i for i, v in enumerate(hrow) if 'COST' in str(v).upper()), None)
        val_col = next((i for i, v in enumerate(hrow) if 'VALUE' in str(v).upper()), None)
        
        sheet_items = 0
        sheet_units = 0
        sheet_val = 0
        
        for r in rows[header_idx+1:]:
            if not r or len(r) < 3:
                continue
            code = str(r[code_col]).strip() if code_col < len(r) else ''
            if not code or code.upper() in ('CODE', 'A/V', ''):
                continue
            # check it's a numeric code
            try:
                float(code)
            except:
                continue
            
            qty_str = r[qty_col] if qty_col is not None and qty_col < len(r) else ''
            cost_str = r[cost_col] if cost_col is not None and cost_col < len(r) else ''
            val_str = r[val_col] if val_col is not None and val_col < len(r) else ''
            desc = str(r[desc_col])[:40] if desc_col < len(r) else ''
            
            try:
                qty = float(qty_str) if qty_str else 0
            except:
                qty = 0
            try:
                cost = float(cost_str) if cost_str else 0
            except:
                cost = 0
            try:
                val = float(val_str) if val_str else qty * cost
            except:
                val = qty * cost
            
            if qty == 0:
                continue
            
            sheet_items += 1
            sheet_units += qty
            sheet_val += val
            
            if cost == 0 and qty > 0:
                zero_cost_items.append((code, desc, qty, s))
            
            if code == '1676':
                code_1676 = (code, desc, qty, cost, s)
        
        total_items += sheet_items
        total_units += sheet_units
        total_cost_val += sheet_val
        
        print(f'{s}: Title="{title[:50]}" | Items:{sheet_items} | Units:{sheet_units:.0f} | CostVal:Rs.{sheet_val:,.0f}')
    
    print()
    print('GRAND TOTAL:')
    print(f'  Total SKUs with stock: {total_items}')
    print(f'  Total Units: {total_units:,.0f}')
    print(f'  Total Cost Value: Rs. {total_cost_val:,.0f}')
    print(f'  Zero Cost items: {len(zero_cost_items)}')
    for zc in zero_cost_items[:10]:
        print(f'    Code:{zc[0]} | {zc[1]} | Qty:{zc[2]} | Sheet:{zc[3]}')
    print()
    print('Code 1676:')
    if code_1676:
        print(f'  {code_1676}')
    else:
        print('  Not found in STOCK COUNT REPORT')
