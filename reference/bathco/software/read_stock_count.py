import zipfile, xml.etree.ElementTree as ET, os

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def get_shared_strings(zf):
    try:
        with zf.open('xl/sharedStrings.xml') as f:
            content = f.read().decode('utf-8', errors='replace')
            # Strip BOM if present
            if content.startswith('﻿'):
                content = content[1:]
            root = ET.fromstring(content)
            strings = []
            for si in root.findall(NS + 'si'):
                t_texts = [t.text or '' for t in si.findall('.//' + NS + 't')]
                strings.append(''.join(t_texts))
            return strings
    except Exception as e:
        print('sharedStrings error:', e)
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
        rows = [['ERROR: ' + str(e)[:300]]]
    return rows

print('=' * 70)
print('FILE: STOCK_COUNT_REPORT_20_04_2026.xlsx')
print('=' * 70)
fpath = r'C:\Users\1st Choice\bathco-data\STOCK_COUNT_REPORT_20_04_2026.xlsx'
try:
    with zipfile.ZipFile(fpath, 'r') as zf:
        all_files = zf.namelist()
        print('All zip contents:', [f for f in all_files if not f.endswith('/')])
        shared = get_shared_strings(zf)
        print(f'Shared strings count: {len(shared)}')
        sheets = [n for n in all_files if n.startswith('xl/worksheets/') and n.endswith('.xml')]
        print('Sheet files:', sheets)
        for s in sheets[:1]:
            rows = read_all_rows(zf, shared, s)
            print(f'Total data rows: {len(rows)}')
            print('First 12 rows:')
            for r in rows[:12]:
                print(' ', r)
except Exception as e:
    print('ERROR:', e)
