import zipfile, xml.etree.ElementTree as ET, os, re

files = {
    'STOCK FAST': r'C:\Users\1st Choice\bathco-data\4.22\4.22\STOCK FAST.xlsx',
    'SLOW': r'C:\Users\1st Choice\bathco-data\4.22\4.22\SLOW.xlsx',
    'NON MOVING': r'C:\Users\1st Choice\bathco-data\4.22\4.22\NON MOVING.xlsx',
    'TOTAL Q': r'C:\Users\1st Choice\bathco-data\4.22\4.22\TOTAL Q.xlsx',
    'QTY+PRICE': r'C:\Users\1st Choice\bathco-data\4.22\4.22\QUANTITY AND PRICE.xlsx',
    'PRICE LIST': r'C:\Users\1st Choice\bathco-data\4.22\4.22\PRICE LIST.xlsx',
    'T SALE': r'C:\Users\1st Choice\bathco-data\4.22\4.22\T SALE.xlsx',
    'PHYS INV': r'C:\Users\1st Choice\bathco-data\PHYSICAL INVERNTORY WORKSHEET.xlsx',
}

ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def get_shared_strings(zf):
    try:
        with zf.open('xl/sharedStrings.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            strings = []
            for si in root.findall(ns + 'si'):
                t_texts = [t.text or '' for t in si.findall('.//' + ns + 't')]
                strings.append(''.join(t_texts))
            return strings
    except:
        return []

def read_sheet(zf, shared, sheet_path, max_rows=8):
    rows = []
    try:
        with zf.open(sheet_path) as f:
            content = f.read().decode('utf-8', errors='replace')
            root = ET.fromstring(content)
            for row_el in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                row_data = []
                for c in row_el.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    t = c.get('t', '')
                    v_el = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    val = v_el.text if v_el is not None else ''
                    if t == 's' and val and shared:
                        try:
                            val = shared[int(val)]
                        except:
                            pass
                    row_data.append(val)
                rows.append(row_data)
                if len(rows) >= max_rows:
                    break
    except Exception as e:
        rows = [['ERROR: ' + str(e)[:200]]]
    return rows

for name, fpath in files.items():
    print('=' * 60)
    print('FILE:', name)
    try:
        with zipfile.ZipFile(fpath, 'r') as zf:
            names = zf.namelist()
            sheets = [n for n in names if n.startswith('xl/worksheets/') and n.endswith('.xml')]
            shared = get_shared_strings(zf)
            print('Sheets found:', sheets)
            for s in sheets[:2]:
                print('---', s, '---')
                rows = read_sheet(zf, shared, s, max_rows=8)
                for r in rows:
                    print('  ', r)
    except Exception as e:
        print('ZIP ERROR:', e)
