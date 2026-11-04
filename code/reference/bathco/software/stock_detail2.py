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
                    # sanitize non-printable
                    val = ''.join(ch if ord(ch) < 128 else '?' for ch in str(val))
                    row_data.append(val)
                if any(v for v in row_data):
                    rows.append(row_data)
    except Exception as e:
        rows = [['ERROR: ' + str(e)[:200]]]
    return rows

fpath = r'C:\Users\1st Choice\bathco-data\STOCK_COUNT_REPORT_20_04_2026.xlsx'

with zipfile.ZipFile(fpath, 'r') as zf:
    shared = get_shared_strings(zf)
    
    # Sheet 2: Physical Inventory - COUNTED items
    print('=== SHEET 2: PHYSICAL INVENTORY (COUNTED ITEMS) ===')
    rows = read_all_rows(zf, shared, 'xl/worksheets/sheet2.xml')
    print(f'Total rows: {len(rows)}')
    for r in rows[:5]:
        print(' ', r)
    
    header_idx = None
    for i, r in enumerate(rows):
        if any('CODE' in str(v).upper() for v in r[:3]):
            header_idx = i
            break
    
    if header_idx is not None:
        hrow = rows[header_idx]
        print('Header:', hrow)
        for i, v in enumerate(hrow):
            if v:
                print(f'  Col {i}: {repr(v)}')
        
        code_col = 0
        desc_col = 1
        sys_qty_col = next((i for i, v in enumerate(hrow) if 'SYSTEM' in str(v).upper() or ('ON' in str(v).upper() and 'HAND' in str(v).upper())), None)
        phys_col = next((i for i, v in enumerate(hrow) if 'PHY' in str(v).upper()), None)
        cost_col = next((i for i, v in enumerate(hrow) if 'COST' in str(v).upper()), None)
        val_col = next((i for i, v in enumerate(hrow) if 'VALUE' in str(v).upper() or 'VAL' in str(v).upper()), None)
        print(f'sys_qty:{sys_qty_col} phys:{phys_col} cost:{cost_col} val:{val_col}')
        
        items_counted = 0
        total_sys = 0
        total_phys_counted = 0
        total_cost_val = 0
        
        for r in rows[header_idx+1:]:
            if not r:
                continue
            code = str(r[0]).strip()
            if not code:
                continue
            try:
                float(code)
            except:
                continue
            
            sys_qty = 0
            if sys_qty_col and sys_qty_col < len(r):
                try: sys_qty = float(r[sys_qty_col]) if r[sys_qty_col] else 0
                except: pass
            
            phys = None
            if phys_col and phys_col < len(r):
                try: phys = float(r[phys_col]) if r[phys_col] else None
                except: pass
            
            cost = 0
            if cost_col and cost_col < len(r):
                try: cost = float(r[cost_col]) if r[cost_col] else 0
                except: pass
            
            val = 0
            if val_col and val_col < len(r):
                try: val = float(r[val_col]) if r[val_col] else 0
                except: pass
            
            items_counted += 1
            total_sys += sys_qty
            if phys is not None:
                total_phys_counted += phys
            total_cost_val += val if val else sys_qty * cost
        
        print(f'Items: {items_counted}')
        print(f'Total system qty: {total_sys:,.0f}')
        print(f'Total physical qty: {total_phys_counted:,.0f}')
        print(f'Total stock value: Rs. {total_cost_val:,.0f}')
    
    # Sheet 3: Variance
    print()
    print('=== SHEET 3: VARIANCE REPORT ===')
    rows3 = read_all_rows(zf, shared, 'xl/worksheets/sheet3.xml')
    print(f'Total rows: {len(rows3)}')
    for r in rows3[:5]:
        print(' ', r)
    
    header_idx3 = None
    for i, r in enumerate(rows3):
        if any('CODE' in str(v).upper() for v in r):
            header_idx3 = i
            break
    
    if header_idx3 is not None:
        hrow3 = rows3[header_idx3]
        print('Header:', hrow3)
        for i, v in enumerate(hrow3):
            if v:
                print(f'  Col {i}: {repr(v)}')
        
        # show 10 sample items
        print('Sample variance items:')
        count = 0
        for r in rows3[header_idx3+1:]:
            if not r:
                continue
            code = str(r[0]).strip()
            if not code:
                continue
            try:
                float(code)
            except:
                continue
            print(f'  {r}')
            count += 1
            if count >= 10:
                break
        
        # Aggregate: find shortage and surplus counts and values
        shortage_count = 0
        surplus_count = 0
        shortage_val = 0
        surplus_val = 0
        
        # Find variance value column (look for largest magnitude numbers)
        # Columns to check: typically col 4-8
        for r in rows3[header_idx3+1:]:
            if not r or len(r) < 5:
                continue
            code = str(r[0]).strip()
            if not code:
                continue
            try:
                float(code)
            except:
                continue
            
            # look at all numeric values in row
            nums = []
            for i, v in enumerate(r[2:], 2):
                try:
                    nums.append((i, float(v)))
                except:
                    pass
            
            # The variance value is usually the largest absolute number
            if nums:
                max_val = max(nums, key=lambda x: abs(x[1]))
                if max_val[1] < 0:
                    shortage_count += 1
                    shortage_val += abs(max_val[1])
                elif max_val[1] > 0:
                    surplus_count += 1
                    surplus_val += max_val[1]
        
        print(f'Shortage items: {shortage_count} | Value: Rs. {shortage_val:,.0f}')
        print(f'Surplus items: {surplus_count} | Value: Rs. {surplus_val:,.0f}')
    
    # Sheet 4: Items NOT COUNTED
    print()
    print('=== SHEET 4: ITEMS NOT COUNTED ===')
    rows4 = read_all_rows(zf, shared, 'xl/worksheets/sheet4.xml')
    print(f'Total rows: {len(rows4)}')
    for r in rows4[:5]:
        print(' ', r)
    
    header_idx4 = None
    for i, r in enumerate(rows4):
        if any('CODE' in str(v).upper() for v in r):
            header_idx4 = i
            break
    
    if header_idx4 is not None:
        hrow4 = rows4[header_idx4]
        print('Header:', hrow4)
        for i, v in enumerate(hrow4):
            if v:
                print(f'  Col {i}: {repr(v)}')
        
        nc_items = 0
        nc_units = 0
        nc_val = 0
        
        code_col = 0
        qty_col = 2
        cost_col = 3
        val_col = 4
        
        for r in rows4[header_idx4+1:]:
            if not r:
                continue
            code = str(r[0]).strip()
            if not code:
                continue
            try:
                float(code)
            except:
                continue
            
            try:
                qty = float(r[qty_col]) if qty_col < len(r) and r[qty_col] else 0
                cost = float(r[cost_col]) if cost_col < len(r) and r[cost_col] else 0
                val = float(r[val_col]) if val_col < len(r) and r[val_col] else qty * cost
            except:
                qty = cost = val = 0
            
            nc_items += 1
            nc_units += qty
            nc_val += val
        
        print(f'Not counted items: {nc_items}')
        print(f'Not counted units: {nc_units:,.0f}')
        print(f'Not counted cost value: Rs. {nc_val:,.0f}')
