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
    except:
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
    
    # ---- Sheet 1: Summary ----
    print('=== SHEET 1: STOCK COUNT REPORT SUMMARY ===')
    rows = read_all_rows(zf, shared, 'xl/worksheets/sheet1.xml')
    for r in rows:
        print(' ', r)
    
    # ---- Sheet 2: Physical Inventory (counted items) ----
    print()
    print('=== SHEET 2: PHYSICAL INVENTORY WORKSHEET ===')
    rows = read_all_rows(zf, shared, 'xl/worksheets/sheet2.xml')
    print(f'Total rows: {len(rows)}')
    print('Header row search...')
    for i, r in enumerate(rows[:10]):
        print(f'  Row {i}: {r}')
    
    # find header
    header_idx = None
    for i, r in enumerate(rows):
        if any('CODE' in str(v).upper() for v in r):
            header_idx = i
            print(f'Header at row {i}: {r}')
            break
    
    if header_idx is not None:
        hrow = rows[header_idx]
        # identify columns - look for system qty and physical count
        print('Column headers:')
        for i, v in enumerate(hrow):
            if v:
                print(f'  Col {i}: {v}')
        
        # Read data
        code_col = 0
        desc_col = 1
        # find system qty and physical count columns
        sys_qty_col = next((i for i, v in enumerate(hrow) if 'SYSTEM' in str(v).upper() or 'ON HAND' in str(v).upper()), None)
        phys_col = next((i for i, v in enumerate(hrow) if 'PHY' in str(v).upper() and 'COUNT' in str(v).upper()), None)
        cost_col = next((i for i, v in enumerate(hrow) if 'COST' in str(v).upper()), None)
        val_col = next((i for i, v in enumerate(hrow) if 'VALUE' in str(v).upper()), None)
        print(f'sys_qty:{sys_qty_col} phys:{phys_col} cost:{cost_col} val:{val_col}')
        
        # Count items with physical count filled in
        items_counted = 0
        items_not_counted = 0
        total_sys = 0
        total_phys = 0
        total_cost_val = 0
        matching = 0
        discrepancies = []
        
        for r in rows[header_idx+1:]:
            if not r:
                continue
            code = str(r[0]).strip() if len(r) > 0 else ''
            if not code or code.upper() in ('CODE', 'A/V', 'SKU', ''):
                continue
            try:
                float(code)
            except:
                continue
            
            desc = str(r[1])[:40] if len(r) > 1 else ''
            
            sys_qty = 0
            if sys_qty_col is not None and sys_qty_col < len(r):
                try:
                    sys_qty = float(r[sys_qty_col]) if r[sys_qty_col] else 0
                except:
                    sys_qty = 0
            
            phys = None
            if phys_col is not None and phys_col < len(r):
                try:
                    phys = float(r[phys_col]) if r[phys_col] else None
                except:
                    phys = None
            
            cost = 0
            if cost_col is not None and cost_col < len(r):
                try:
                    cost = float(r[cost_col]) if r[cost_col] else 0
                except:
                    cost = 0
            
            val = 0
            if val_col is not None and val_col < len(r):
                try:
                    val = float(r[val_col]) if r[val_col] else 0
                except:
                    val = 0
            
            if phys is not None:
                items_counted += 1
                total_sys += sys_qty
                total_phys += phys
                total_cost_val += val if val else phys * cost
                if abs(phys - sys_qty) > 0.01:
                    discrepancies.append((code, desc, sys_qty, phys, phys-sys_qty))
            else:
                items_not_counted += 1
        
        print(f'Items with physical count: {items_counted}')
        print(f'Items not counted: {items_not_counted}')
        print(f'Total system qty (counted items): {total_sys:,.0f}')
        print(f'Total physical count: {total_phys:,.0f}')
        print(f'Total stock value: Rs. {total_cost_val:,.0f}')
        print(f'Discrepancies: {len(discrepancies)}')
    
    # ---- Sheet 3: Variance Report ----
    print()
    print('=== SHEET 3: VARIANCE REPORT ===')
    rows = read_all_rows(zf, shared, 'xl/worksheets/sheet3.xml')
    print(f'Total rows: {len(rows)}')
    for r in rows[:8]:
        print(' ', r)
    
    header_idx = None
    for i, r in enumerate(rows):
        if any('CODE' in str(v).upper() for v in r):
            if len(r) >= 4:
                header_idx = i
                break
    
    if header_idx is not None:
        hrow = rows[header_idx]
        print('Header:', hrow)
        
        total_shortage_val = 0
        total_surplus_val = 0
        shortage_items = 0
        surplus_items = 0
        
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
            
            # Look for variance qty and value
            # Find columns with negative/positive variance
            for col_idx in range(len(r)):
                v = str(r[col_idx]).strip()
                if not v:
                    continue
                try:
                    fv = float(v)
                    if col_idx >= 3:  # skip code/desc cols
                        pass
                except:
                    pass
            
            # Try columns - variance qty usually col 4-6, value col 6-8
            vals = []
            for v in r[3:]:
                try:
                    vals.append(float(v) if v else 0)
                except:
                    vals.append(0)
            
            if vals:
                # Find the value column (largest absolute value)
                for j, fv in enumerate(vals):
                    if fv < 0:
                        total_shortage_val += abs(fv)
                        break
                    elif fv > 0:
                        total_surplus_val += fv
                        break
        
        # Just show first 10 variance items
        print('Sample variance rows:')
        count = 0
        for r in rows[header_idx+1:]:
            if not r:
                continue
            code = str(r[0]).strip()
            if not code or code.upper() in ('CODE', 'A/V', ''):
                continue
            try:
                float(code)
                print(f'  {r}')
                count += 1
                if count >= 8:
                    break
            except:
                pass
