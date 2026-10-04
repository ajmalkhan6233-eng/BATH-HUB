"""Build BATHCO_MASTER_DATA.xlsx - consolidated master workbook."""
import openpyxl
from openpyxl.styles import (
    Font, PatternFill, Alignment, Border, Side, numbers
)
from openpyxl.utils import get_column_letter
from openpyxl.styles.numbers import FORMAT_NUMBER_COMMA_SEPARATED1
import os, sys
from datetime import datetime

# ── paths ──────────────────────────────────────────────────────────────
BASE      = r"C:\Users\1st Choice\bathco-data"
EXTRACTED = os.path.join(BASE, "extracted")
OUT       = r"C:\Users\1st Choice\Desktop\BATHCO_MASTER_DATA.xlsx"

SRC_MAIN   = os.path.join(BASE, "BATHCO COMPLETE BUSINESS REPORT 29MAY2026.xlsx")
SRC_SIMPLE = os.path.join(EXTRACTED, "URGENT", "URGENT", "BATHCO_SIMPLE_REPORT.xlsx")
SRC_CHEQ   = os.path.join(EXTRACTED, "URGENT", "URGENT", "OUTBOUND_CHEQ_CLEAN.xlsx")

DAILY_FILES = [
    os.path.join(EXTRACTED,"URGENT","URGENT","12-05","12-05-2026.xlsx"),
    os.path.join(EXTRACTED,"URGENT","URGENT","13-05","13-05-2026.xlsx"),
    os.path.join(EXTRACTED,"URGENT","URGENT","14-05","14-05-2026.xlsx"),
    os.path.join(EXTRACTED,"URGENT","URGENT","15-05","15-05-2026.xlsx"),
    os.path.join(EXTRACTED,"URGENT","URGENT","19-05-2026","19-05-2026.xlsx"),
    os.path.join(EXTRACTED,"DALY SALES","DALY SALES","DALY SALES REPORT.xlsx"),
]

# ── colour palette ──────────────────────────────────────────────────────
C_HEADER   = "1F3864"   # dark navy
C_SUBHEAD  = "2E75B6"   # mid blue
C_ALT      = "D6E4F0"   # light blue alternating row
C_YELLOW   = "FFF2CC"   # alert highlight
C_GREEN    = "E2EFDA"   # good/positive
C_RED      = "FCE4D6"   # warning/negative
C_TOTAL    = "D9E1F2"   # total row

def hfont(bold=True, size=11, color="FFFFFF"):
    return Font(bold=bold, size=size, color=color, name="Calibri")

def bfont(bold=False, size=10):
    return Font(bold=bold, size=size, name="Calibri")

def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def border_thin():
    s = Side(style="thin", color="BFBFBF")
    return Border(left=s, right=s, top=s, bottom=s)

def center():
    return Alignment(horizontal="center", vertical="center", wrap_text=True)

def right():
    return Alignment(horizontal="right", vertical="center")

def write_header_row(ws, row, cols, bg=C_HEADER):
    for c, val in enumerate(cols, 1):
        cell = ws.cell(row=row, column=c, value=val)
        cell.font      = hfont()
        cell.fill      = fill(bg)
        cell.alignment = center()
        cell.border    = border_thin()

def style_data_row(ws, row, num_cols, alt=False, fmt_cols=None):
    bg = C_ALT if alt else "FFFFFF"
    for c in range(1, num_cols+1):
        cell = ws.cell(row=row, column=c)
        cell.fill      = fill(bg)
        cell.border    = border_thin()
        cell.font      = bfont()
        cell.alignment = right() if (fmt_cols and c in fmt_cols) else Alignment(vertical="center")
        if fmt_cols and c in fmt_cols:
            cell.number_format = "#,##0"

def autofit(ws, min_w=8, max_w=40):
    for col in ws.columns:
        length = max_w
        try:
            length = max(
                min(max(len(str(c.value or "")), min_w), max_w)
                for c in col if c.value is not None
            )
        except:
            pass
        ws.column_dimensions[get_column_letter(col[0].column)].width = length + 2

def read_ws(path, sheet=0):
    """Return list-of-lists from a sheet. sheet can be index or name."""
    try:
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb.worksheets[sheet] if isinstance(sheet, int) else wb[sheet]
        rows = []
        for row in ws.iter_rows(values_only=True):
            if any(v is not None for v in row):
                rows.append(list(row))
        return rows
    except Exception as e:
        print(f"  [WARN] Cannot read {os.path.basename(path)} sheet={sheet}: {e}")
        return []

# ══════════════════════════════════════════════════════════════════════
#  BUILD
# ══════════════════════════════════════════════════════════════════════
print("Building BATHCO_MASTER_DATA.xlsx ...")
wb_out = openpyxl.Workbook()
wb_out.remove(wb_out.active)   # remove default sheet

# ──────────────────────────────────────────────────────────────────────
# SHEET 1 — EXECUTIVE SUMMARY
# ──────────────────────────────────────────────────────────────────────
print("  Sheet 1: Executive Summary")
ws = wb_out.create_sheet("SUMMARY")
ws.sheet_view.showGridLines = False
ws.column_dimensions["A"].width = 36
ws.column_dimensions["B"].width = 22
ws.column_dimensions["C"].width = 30

# Title
ws.merge_cells("A1:C1")
t = ws["A1"]
t.value     = "1ST CHOICE BATHCO (PVT) LTD — MASTER BUSINESS REPORT"
t.font      = Font(bold=True, size=14, color="FFFFFF", name="Calibri")
t.fill      = fill(C_HEADER)
t.alignment = center()
ws.row_dimensions[1].height = 28

ws.merge_cells("A2:C2")
t2 = ws["A2"]
t2.value     = f"Generated: {datetime.now().strftime('%d %B %Y %H:%M')}  |  Data Period: Dec 2025 – May 2026"
t2.font      = Font(bold=False, size=10, color="FFFFFF", name="Calibri")
t2.fill      = fill(C_SUBHEAD)
t2.alignment = center()
ws.row_dimensions[2].height = 18

# P&L block
def section_title(ws, row, text):
    ws.merge_cells(f"A{row}:C{row}")
    c = ws[f"A{row}"]
    c.value     = text
    c.font      = hfont(size=10)
    c.fill      = fill(C_SUBHEAD)
    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[row].height = 16

def kpi_row(ws, row, label, value, notes="", highlight=None):
    cells = [ws.cell(row=row, column=i) for i in range(1,4)]
    cells[0].value = label
    cells[1].value = value
    cells[2].value = notes
    bg = highlight if highlight else ("FFFFFF" if row % 2 == 0 else C_ALT)
    for c in cells:
        c.fill   = fill(bg)
        c.border = border_thin()
        c.font   = bfont()
    cells[0].alignment = Alignment(vertical="center", indent=1)
    cells[1].alignment = right()
    cells[2].alignment = Alignment(vertical="center", wrap_text=True)
    if isinstance(value, (int, float)):
        cells[1].number_format = "#,##0"

r = 3
section_title(ws, r, "PROFIT & LOSS — Oct 2025 to Apr 2026"); r+=1
kpi_row(ws, r, "Gross Sales (Billed)",       97259677.49, "Total invoiced to customers"); r+=1
kpi_row(ws, r, "Less: Discounts",            -733970.77,  "Discounts given"); r+=1
kpi_row(ws, r, "Net Revenue",                96525706.72, "After discounts"); r+=1
kpi_row(ws, r, "Cost of Goods Sold (COGS)", -78615069.87, "Purchase cost of items sold"); r+=1
kpi_row(ws, r, "GROSS PROFIT",               17910636.85, "GP Margin: 18.4%  ⚠ Below industry avg 25-35%", C_YELLOW); r+=1
kpi_row(ws, r, "Est. Expenses (Rs.50K/day)", -6500000,    "Assumption only — verify with accountant"); r+=1
kpi_row(ws, r, "EST. NET PROFIT",            11410636.85, "Estimate — true figure needs actual expense data", C_GREEN); r+=1

r+=1
section_title(ws, r, "KEY KPIs — As at 30 May 2026"); r+=1
kpi_row(ws, r, "Total Revenue (Oct–Apr)",   96525706.72, "6 months cumulative"); r+=1
kpi_row(ws, r, "May 2026 Sales (28 days)",  20736825,    "Rs. 740,601 avg/day"); r+=1
kpi_row(ws, r, "GP Margin",                 "18.4%",     "Industry benchmark: 25-35%  ⚠ Below target"); r+=1
kpi_row(ws, r, "Total Purchases (GRN)",     129652474,   "Dec 2025 – Apr 2026"); r+=1
kpi_row(ws, r, "Stock Units on Hand",       66996,       "991 SKUs"); r+=1
kpi_row(ws, r, "Stock Value (Selling Price)",138315113,  "Est. Rs. 138.3M at selling price"); r+=1
kpi_row(ws, r, "Total Transactions",        1619,        "Oct 2025 – Apr 2026"); r+=1
kpi_row(ws, r, "Best Day (May 2026)",       2353810,     "17 May 2026 — 30 transactions"); r+=1

r+=1
section_title(ws, r, "CHEQUE / PAYABLES POSITION"); r+=1
kpi_row(ws, r, "Total Cheques Written",    250,         "Rs. 114,487,524 total"); r+=1
kpi_row(ws, r, "Cheques Cleared",          154,         "Rs. 64,953,447 cleared"); r+=1
kpi_row(ws, r, "CHEQUES PENDING",          96,          "Rs. 49,534,077 — committed to Aug 2026  ⚠", C_RED); r+=1

r+=1
section_title(ws, r, "ALERTS"); r+=1
alerts = [
    ("⚠  GP Margin 18.4%",       "Below industry avg of 25-35%. Review pricing and discount policy."),
    ("⚠  Rs. 49.5M pending cheques", "Committed supplier payments through Aug 2026. Monitor cash flow."),
    ("⚠  Stock Rs. 138M vs Revenue Rs. 97M", "Stock turning slowly. Consider promotions on slow movers."),
    ("⚠  Negative-GP transactions exist", "Some items sold below cost. Pull price list and fix immediately."),
    ("⚠  Expense data missing",  "Rs. 50K/day is an assumption. Get actual P&L from accountant."),
]
for label, note in alerts:
    kpi_row(ws, r, label, "", note, C_RED); r+=1

# ──────────────────────────────────────────────────────────────────────
# SHEET 2 — MONTHLY SALES
# ──────────────────────────────────────────────────────────────────────
print("  Sheet 2: Monthly Sales")
ws2 = wb_out.create_sheet("MONTHLY SALES")
ws2.sheet_view.showGridLines = False

monthly = [
    ("Nov 2025",   60340,        10640,        49700,        82.4,  1),
    ("Dec 2025",   9378470.5,    6789952.24,   2588518.26,   27.6,  110),
    ("Jan 2026",   16653296.08,  12953918.41,  3699377.67,   22.2,  307),
    ("Feb 2026",   16365839,     13492232.83,  2873606.17,   17.6,  331),
    ("Mar 2026",   22486857.08,  17740564.96,  4746292.12,   21.1,  413),
    ("Apr 2026",   24952865.98,  19376140.05,  5576725.93,   22.3,  451),
    ("May 2026*",  20736825,     None,         None,         None,  349),
]

ws2.merge_cells("A1:F1")
h = ws2["A1"]
h.value = "MONTHLY SALES BREAKDOWN — Dec 2025 to May 2026"
h.font  = hfont(size=12); h.fill = fill(C_HEADER); h.alignment = center()
ws2.row_dimensions[1].height = 24

ws2.merge_cells("A2:F2")
s = ws2["A2"]
s.value = "* May 2026 is partial (28 days). GP% not yet available from system."
s.font  = Font(italic=True, size=9, name="Calibri"); s.alignment = Alignment(horizontal="center")

cols2 = ["MONTH","REVENUE (Rs.)","COGS (Rs.)","GROSS PROFIT (Rs.)","GP %","TRANSACTIONS"]
write_header_row(ws2, 3, cols2)

num_cols2 = {2,3,4,6}
for i,(month,rev,cogs,gp,gp_pct,txn) in enumerate(monthly):
    r2 = 4+i
    ws2.cell(r2,1,month)
    ws2.cell(r2,2,rev)
    ws2.cell(r2,3,cogs)
    ws2.cell(r2,4,gp)
    ws2.cell(r2,5, f"{gp_pct}%" if gp_pct else "—")
    ws2.cell(r2,6,txn)
    style_data_row(ws2, r2, 6, alt=(i%2==1), fmt_cols=num_cols2)
    if gp_pct and gp_pct < 20:
        ws2.cell(r2,5).fill = fill(C_YELLOW)

# Totals row
tr = 4 + len(monthly)
ws2.cell(tr,1,"TOTAL (excl. May)").font = bfont(bold=True)
ws2.cell(tr,2, sum(r[1] for r in monthly[:-1]))
ws2.cell(tr,3, sum(r[2] for r in monthly[:-1] if r[2]))
ws2.cell(tr,4, sum(r[3] for r in monthly[:-1] if r[3]))
ws2.cell(tr,5,"18.4%")
ws2.cell(tr,6, sum(r[5] for r in monthly[:-1]))
for c in range(1,7):
    ws2.cell(tr,c).fill   = fill(C_TOTAL)
    ws2.cell(tr,c).font   = bfont(bold=True)
    ws2.cell(tr,c).border = border_thin()
    if c in num_cols2: ws2.cell(tr,c).number_format = "#,##0"

autofit(ws2)

# ──────────────────────────────────────────────────────────────────────
# SHEET 3 — MAY 2026 DAILY SALES
# ──────────────────────────────────────────────────────────────────────
print("  Sheet 3: May 2026 Daily Sales")
ws3 = wb_out.create_sheet("MAY 2026 DAILY")
ws3.sheet_view.showGridLines = False

may_days = [
    ("01-May-26", 837120,  17, 0,       10750, 0,      0,    0),
    ("02-May-26", 1027320, 30, 148470,  0,     0,      0,    0),
    ("03-May-26", 1540160, 21, 468140,  209160,0,      0,    0),
    ("04-May-26", 352580,  11, 343090,  0,     0,      0,    0),
    ("05-May-26", 695890,  17, 27500,   0,     0,      0,    0),
    ("06-May-26", 977065,  6,  13725,   0,     0,      0,    0),
    ("07-May-26", 649375,  11, 14400,   34450, 0,      0,    0),
    ("08-May-26", 1121100, 13, 192300,  126500,0,      0,    0),
    ("09-May-26", 366980,  12, 35150,   0,     113980, 5000, 0),
    ("10-May-26", 920800,  17, 73250,   0,     0,      0,    0),
    ("11-May-26", 596280,  14, 316750,  4630,  0,      0,    0),
    ("12-May-26", 393805,  9,  71160,   0,     0,      0,    0),
    ("13-May-26", 794760,  16, 2850,    0,     0,      0,    0),
    ("14-May-26", 50780,   2,  0,       0,     33300,  0,    0),
    ("15-May-26", 1493160, 15, 200000,  149000,0,      0,    0),
    ("16-May-26", 714590,  14, 65990,   0,     0,      0,    0),
    ("17-May-26", 2353810, 30, 138000,  0,     0,      0,    0),
    ("18-May-26", 492060,  5,  0,       680000,0,      0,    0),
    ("19-May-26", 242050,  6,  1400,    0,     0,      0,    0),
    ("20-May-26", 275675,  6,  3300,    0,     0,      0,    0),
    ("21-May-26", 300475,  11, 20700,   0,     0,      0,    0),
    ("22-May-26", 275710,  6,  104920,  0,     0,      0,    0),
    ("23-May-26", 1050645, 13, 4500,    0,     0,      0,    0),
    ("24-May-26", 1499720, 22, 153800,  18500, 0,      0,    0),
    ("25-May-26", 836815,  13, 3750,    0,     0,      0,    0),
    ("26-May-26", 875700,  11, 159850,  127000,0,      0,    0),
    ("27-May-26", 0,       0,  0,       0,     0,      0,    0),
    ("28-May-26", 2400,    1,  2400,    0,     0,      0,    0),
]

ws3.merge_cells("A1:H1")
h3 = ws3["A1"]
h3.value = "MAY 2026 — DAILY SALES BREAKDOWN"
h3.font  = hfont(size=12); h3.fill = fill(C_HEADER); h3.alignment = center()
ws3.row_dimensions[1].height = 24

cols3 = ["DATE","TOTAL SALES (Rs.)","TRANSACTIONS","CASH (Rs.)","CARD (Rs.)","ONLINE (Rs.)","CHEQUE (Rs.)","CREDIT (Rs.)"]
write_header_row(ws3, 2, cols3)

num_cols3 = {2,4,5,6,7,8}
avg = 20736825 / 28
for i, row_data in enumerate(may_days):
    r3 = 3+i
    for c,v in enumerate(row_data, 1):
        ws3.cell(r3,c,v)
    style_data_row(ws3, r3, 8, alt=(i%2==1), fmt_cols=num_cols3)
    sales = row_data[1]
    if sales == max(d[1] for d in may_days):
        ws3.cell(r3,2).fill = fill(C_GREEN)
        ws3.cell(r3,2).font = bfont(bold=True)
    elif sales < 400000 and sales > 0:
        ws3.cell(r3,2).fill = fill(C_RED)
    elif sales == 0:
        ws3.cell(r3,2).fill = fill(C_YELLOW)

# totals
tr3 = 3 + len(may_days)
ws3.cell(tr3,1,"TOTAL").font = bfont(bold=True)
ws3.cell(tr3,2, 20736825)
ws3.cell(tr3,3, 349)
for c in range(1,9):
    ws3.cell(tr3,c).fill   = fill(C_TOTAL)
    ws3.cell(tr3,c).font   = bfont(bold=True)
    ws3.cell(tr3,c).border = border_thin()
    if c in num_cols3: ws3.cell(tr3,c).number_format = "#,##0"

tr3b = tr3+1
ws3.cell(tr3b,1,"DAILY AVERAGE")
ws3.cell(tr3b,2, round(avg))
for c in range(1,9):
    ws3.cell(tr3b,c).fill = fill(C_ALT)
    ws3.cell(tr3b,c).font = bfont(bold=True)
    ws3.cell(tr3b,c).border = border_thin()
    if c in num_cols3: ws3.cell(tr3b,c).number_format = "#,##0"

autofit(ws3, min_w=10)

# ──────────────────────────────────────────────────────────────────────
# SHEET 4 — ALL TRANSACTIONS (from main report)
# ──────────────────────────────────────────────────────────────────────
print("  Sheet 4: All Transactions")
ws4 = wb_out.create_sheet("ALL TRANSACTIONS")
ws4.sheet_view.showGridLines = False
ws4.freeze_panes = "A3"

txn_rows = read_ws(SRC_MAIN, "MONTHLY SALES DETAIL")

ws4.merge_cells("A1:G1")
h4 = ws4["A1"]
h4.value = "ALL TRANSACTIONS — Oct 2025 to Apr 2026 (1,619 Transactions)"
h4.font  = hfont(size=12); h4.fill = fill(C_HEADER); h4.alignment = center()
ws4.row_dimensions[1].height = 24

cols4 = ["DATE","INVOICE","CUSTOMER","AMOUNT (Rs.)","COST (Rs.)","GP (Rs.)","GP %"]
write_header_row(ws4, 2, cols4)
ws4.row_dimensions[2].height = 18

num_cols4 = {4,5,6}
skipping_header = True
row4 = 3
count = 0
for row_data in txn_rows:
    # skip header rows from source
    first = str(row_data[0] or "").strip()
    if first in ("DATE","MONTHLY SALES DETAIL — OCT 2025 TO APR 2026 (1,619 Transactions)", ""):
        continue
    if first.startswith("MONTHLY"):
        continue
    for c, v in enumerate(row_data[:7], 1):
        ws4.cell(row4, c, v)
    style_data_row(ws4, row4, 7, alt=(count%2==1), fmt_cols=num_cols4)
    # highlight negative GP
    gp_val = row_data[5] if len(row_data) > 5 else None
    if isinstance(gp_val, (int,float)) and gp_val < 0:
        for c in range(1,8): ws4.cell(row4,c).fill = fill(C_RED)
    # format GP% column
    ws4.cell(row4,7).number_format = "0.0%"
    row4 += 1
    count += 1

ws4.column_dimensions["A"].width = 14
ws4.column_dimensions["B"].width = 14
ws4.column_dimensions["C"].width = 26
ws4.column_dimensions["D"].width = 16
ws4.column_dimensions["E"].width = 16
ws4.column_dimensions["F"].width = 16
ws4.column_dimensions["G"].width = 10

# ──────────────────────────────────────────────────────────────────────
# SHEET 5 — STOCK ON HAND
# ──────────────────────────────────────────────────────────────────────
print("  Sheet 5: Stock on Hand")
ws5 = wb_out.create_sheet("STOCK ON HAND")
ws5.sheet_view.showGridLines = False
ws5.freeze_panes = "A4"

stock_rows = read_ws(SRC_MAIN, "STOCK ON HAND")

ws5.merge_cells("A1:F1")
h5 = ws5["A1"]
h5.value = "STOCK ON HAND — 991 SKUs | Total 66,996 Units | Est. Value Rs. 138,315,113"
h5.font  = hfont(size=12); h5.fill = fill(C_HEADER); h5.alignment = center()
ws5.row_dimensions[1].height = 24

# Category summary first
cat_data = [
    ("TILE",         53833, 50485005),
    ("COMMODE",        440, 19083150),
    ("SHOWERS",       1275, 12185240),
    ("BASIN",          478, 10745200),
    ("TAP",           2327, 10525686),
    ("VALVE",         1654,  6935440),
    ("MIRROR",         399,  4581750),
    ("ACCESSORIES",   1170,  4333790),
    ("CABINET",         55,  3595650),
    ("SINK",           165,  2815300),
    ("GULLY COVER",    621,  1831016),
    ("SOAP DISH",      535,  1662933),
    ("OTHER",          462,  1381725),
    ("DOOR",           119,  1201450),
    ("BASIN WASTE",    545,  1147650),
    ("BATH TUB",        10,   944850),
    ("CABLE",          787,   886618),
    ("TOWEL BAR",      198,   869270),
    ("REMAINING",     1717,  3658945),
]

write_header_row(ws5, 2, ["CATEGORY","UNITS","EST. VALUE (Rs.)","% OF VALUE"], bg=C_SUBHEAD)
total_val = 138315113
for i,(cat,qty,val) in enumerate(cat_data):
    r5 = 3+i
    ws5.cell(r5,1,cat)
    ws5.cell(r5,2,qty)
    ws5.cell(r5,3,val)
    ws5.cell(r5,4,round(val/total_val*100,1))
    style_data_row(ws5, r5, 4, alt=(i%2==1), fmt_cols={2,3,4})
    ws5.cell(r5,2).number_format = "#,##0"
    ws5.cell(r5,3).number_format = "#,##0"
    ws5.cell(r5,4).number_format = "0.0%"

tr5 = 3+len(cat_data)
ws5.cell(tr5,1,"TOTAL"); ws5.cell(tr5,2,66996); ws5.cell(tr5,3,138315113); ws5.cell(tr5,4,"100%")
for c in range(1,5):
    ws5.cell(tr5,c).fill=fill(C_TOTAL); ws5.cell(tr5,c).font=bfont(bold=True)
    ws5.cell(tr5,c).border=border_thin()
ws5.cell(tr5,2).number_format="#,##0"; ws5.cell(tr5,3).number_format="#,##0"

# Full SKU list below
r5_detail = tr5+2
ws5.merge_cells(f"A{r5_detail}:F{r5_detail}")
sep = ws5[f"A{r5_detail}"]
sep.value = "FULL STOCK DETAIL — All 991 SKUs"
sep.font  = hfont(size=10); sep.fill = fill(C_SUBHEAD); sep.alignment = center()
r5_detail += 1

write_header_row(ws5, r5_detail, ["CODE","DESCRIPTION","CATEGORY","SELLING PRICE","QTY ON HAND","EST. VALUE (Rs.)"], bg=C_SUBHEAD)
r5_detail += 1

in_detail = False
count5 = 0
for row_data in stock_rows:
    first = str(row_data[0] or "").strip()
    if first == "FULL STOCK DETAIL":
        in_detail = True; continue
    if first in ("CODE","STOCK ON HAND — 991 SKUs | Total Qty: 66,996 Units | Est. Value: Rs. 138,315,113","CATEGORY SUMMARY","CATEGORY"):
        continue
    if not in_detail: continue
    if first == "": continue
    for c,v in enumerate(row_data[:6],1):
        ws5.cell(r5_detail,c,v)
    style_data_row(ws5, r5_detail, 6, alt=(count5%2==1), fmt_cols={4,5,6})
    r5_detail += 1; count5 += 1

ws5.column_dimensions["A"].width = 8
ws5.column_dimensions["B"].width = 50
ws5.column_dimensions["C"].width = 16
ws5.column_dimensions["D"].width = 16
ws5.column_dimensions["E"].width = 14
ws5.column_dimensions["F"].width = 18

# ──────────────────────────────────────────────────────────────────────
# SHEET 6 — PURCHASES / GRN
# ──────────────────────────────────────────────────────────────────────
print("  Sheet 6: Purchases GRN")
ws6 = wb_out.create_sheet("PURCHASES GRN")
ws6.sheet_view.showGridLines = False
ws6.freeze_panes = "A3"

ws6.merge_cells("A1:F1")
h6 = ws6["A1"]
h6.value = "PURCHASES / GRN — Dec 2025 to Apr 2026 | Total: Rs. 129,652,474"
h6.font  = hfont(size=12); h6.fill = fill(C_HEADER); h6.alignment = center()
ws6.row_dimensions[1].height = 24

# monthly summary
monthly_purchases = [
    ("Dec 2025", 22859976.02),
    ("Jan 2026", 10319895),
    ("Feb 2026", 31657908.50),
    ("Mar 2026", 41082654.41),
    ("Apr 2026", 22757040),
]
write_header_row(ws6, 2, ["MONTH","PURCHASES (Rs.)"], bg=C_SUBHEAD)
for i,(m,v) in enumerate(monthly_purchases):
    r6=3+i; ws6.cell(r6,1,m); ws6.cell(r6,2,v)
    style_data_row(ws6,r6,2,alt=(i%2==1),fmt_cols={2})
tr6=3+len(monthly_purchases)
ws6.cell(tr6,1,"TOTAL"); ws6.cell(tr6,2,129652474)
for c in [1,2]: ws6.cell(tr6,c).fill=fill(C_TOTAL); ws6.cell(tr6,c).font=bfont(bold=True); ws6.cell(tr6,c).border=border_thin()
ws6.cell(tr6,2).number_format="#,##0"

# Full GRN detail
r6_detail = tr6+2
ws6.merge_cells(f"A{r6_detail}:F{r6_detail}")
sep6=ws6[f"A{r6_detail}"]; sep6.value="FULL GRN DETAIL"; sep6.font=hfont(size=10)
sep6.fill=fill(C_SUBHEAD); sep6.alignment=center(); r6_detail+=1

write_header_row(ws6, r6_detail, ["GRN NO","SI NO","CODE","DESCRIPTION","QTY","AMOUNT (Rs.)"], bg=C_SUBHEAD)
r6_detail+=1

grn_rows = read_ws(SRC_MAIN, "PURCHASES GRN")
in_grn = False; count6=0
for row_data in grn_rows:
    first=str(row_data[0] or "").strip()
    if first=="FULL GRN DETAIL": in_grn=True; continue
    if first in ("GRN NO","MONTHLY PURCHASE SUMMARY","MONTH","PURCHASES / GRN REPORT — Dec 2025 to Apr 2026 | Total: Rs. 129,652,474"): continue
    if not in_grn: continue
    if all(v is None for v in row_data): continue
    for c,v in enumerate(row_data[:6],1): ws6.cell(r6_detail,c,v)
    style_data_row(ws6,r6_detail,6,alt=(count6%2==1),fmt_cols={5,6})
    r6_detail+=1; count6+=1

autofit(ws6, max_w=50)

# ──────────────────────────────────────────────────────────────────────
# SHEET 7 — PENDING CHEQUES
# ──────────────────────────────────────────────────────────────────────
print("  Sheet 7: Pending Cheques")
ws7 = wb_out.create_sheet("PENDING CHEQUES")
ws7.sheet_view.showGridLines = False
ws7.freeze_panes = "A3"

ws7.merge_cells("A1:E1")
h7=ws7["A1"]; h7.value="PENDING CHEQUES — 96 cheques | Rs. 49,534,077 | Due through Aug 2026"
h7.font=hfont(size=12); h7.fill=fill(C_RED); h7.alignment=center()
ws7.row_dimensions[1].height=24

cols7=["CLEARING DATE","CHEQUE NO","AMOUNT (Rs.)","ISSUED TO","BANK"]
write_header_row(ws7, 2, cols7)

cheq_rows = read_ws(SRC_SIMPLE, "CHEQUES")
count7=0; r7=3
for row_data in cheq_rows:
    first=str(row_data[0] or "").strip()
    if first in ("","CLEARING DATE","1ST CHOICE BATHCO — CHEQUE REPORT  |  As at 29 Apr 2026",
                 "CHEQUE WRITTEN","CHEQUE PASSED","CHEQUE PENDING","PENDING CHEQUES DETAIL"): continue
    if "CHEQUE" in first.upper() and len(str(row_data[1] or "")) < 4: continue
    for c,v in enumerate(row_data[:5],1): ws7.cell(r7,c,v)
    style_data_row(ws7,r7,5,alt=(count7%2==1),fmt_cols={3})
    # highlight large cheques
    amt=row_data[2] if len(row_data)>2 else None
    if isinstance(amt,(int,float)) and amt>=1000000:
        ws7.cell(r7,3).fill=fill(C_RED)
        ws7.cell(r7,3).font=bfont(bold=True)
    ws7.cell(r7,1).number_format="DD-MMM-YY"
    r7+=1; count7+=1

autofit(ws7)

# ──────────────────────────────────────────────────────────────────────
# SHEET 8 — SUPPLIER PAYMENTS
# ──────────────────────────────────────────────────────────────────────
print("  Sheet 8: Supplier Payments")
ws8 = wb_out.create_sheet("SUPPLIER PAYMENTS")
ws8.sheet_view.showGridLines = False

suppliers = {
    "AZMI / NADIR AZMI":         {"count":20, "total":12500000, "notes":"Weekly Rs.500K-1M, major tile/sanitary supplier"},
    "MACKSONS / MACKTILE":       {"count":18, "total":15000000, "notes":"Tile supplier — multiple entities"},
    "ESKEMA CERAMIC":            {"count":14, "total":7000000,  "notes":"Rs.500K fortnightly"},
    "JANATHA CERAMIC":           {"count":6,  "total":6000000,  "notes":"Tile supplier"},
    "FAZAL HARDWARE":            {"count":8,  "total":3700000,  "notes":"Hardware/fittings"},
    "LEO MARKETING":             {"count":8,  "total":4300000,  "notes":"Regular supplier"},
    "ALI BROTHERS":              {"count":4,  "total":2100000,  "notes":"Supplier"},
    "AR MARKETING":              {"count":6,  "total":2600000,  "notes":"Rs.300K-600K per batch"},
    "FR MARKETING / ADHIL F.R":  {"count":6,  "total":4488000,  "notes":"Marketing/supply"},
    "VOOS":                      {"count":5,  "total":2500000,  "notes":"Brand supplier — cabinets, mirrors, taps"},
    "JAZULI (SHOP)":             {"count":6,  "total":2340000,  "notes":"Rs.150K-520K per cheque"},
    "ARROW TILE":                {"count":2,  "total":1330000,  "notes":"Tile supplier"},
    "MUWAD GREAT IMPEX":         {"count":4,  "total":1742000,  "notes":"Importer"},
    "RUHUNU CERAMIC":            {"count":2,  "total":1045000,  "notes":"Ceramic supplier"},
    "LOLC VAN":                  {"count":8,  "total":800000,   "notes":"Vehicle loan — Rs.100K/month"},
    "CERAMIC STUDIO":            {"count":4,  "total":1800000,  "notes":"Ceramic supplier"},
    "AKRAM":                     {"count":4,  "total":1000000,  "notes":"Supplier"},
    "OTHER SUPPLIERS":           {"count":35, "total":5000000,  "notes":"Various smaller suppliers"},
}

ws8.merge_cells("A1:E1")
h8=ws8["A1"]; h8.value="SUPPLIER PAYMENT SUMMARY — Dec 2025 to May 2026"
h8.font=hfont(size=12); h8.fill=fill(C_HEADER); h8.alignment=center()
ws8.row_dimensions[1].height=24

write_header_row(ws8, 2, ["SUPPLIER","CHEQUE COUNT","TOTAL PAID (Rs.)","NOTES","CATEGORY"])

r8=3
for i,(name, data) in enumerate(suppliers.items()):
    ws8.cell(r8,1,name); ws8.cell(r8,2,data["count"])
    ws8.cell(r8,3,data["total"]); ws8.cell(r8,4,data["notes"])
    cat = "VEHICLE" if "LOLC" in name else ("TILES" if any(x in name.upper() for x in ["CERAMIC","TILE","MACTILE","ESKEMA","ARROW","RUHUNU"]) else "STOCK")
    ws8.cell(r8,5,cat)
    style_data_row(ws8,r8,5,alt=(i%2==1),fmt_cols={2,3})
    if data["total"]>=5000000:
        ws8.cell(r8,3).fill=fill(C_RED); ws8.cell(r8,3).font=bfont(bold=True)
    r8+=1

autofit(ws8)

# ──────────────────────────────────────────────────────────────────────
# SHEET 9 — DATA SOURCES LOG
# ──────────────────────────────────────────────────────────────────────
print("  Sheet 9: Data Sources")
ws9 = wb_out.create_sheet("DATA SOURCES")
ws9.sheet_view.showGridLines = False

ws9.merge_cells("A1:D1")
h9=ws9["A1"]; h9.value="DATA SOURCES — Files Read to Build This Report"
h9.font=hfont(size=12); h9.fill=fill(C_HEADER); h9.alignment=center()
ws9.row_dimensions[1].height=24

write_header_row(ws9, 2, ["FILE NAME","STATUS","SHEETS / CONTENT","SOURCE"])

sources = [
    ("BATHCO COMPLETE BUSINESS REPORT 29MAY2026.xlsx", "READ OK", "Executive Summary, May Daily Sales, Monthly Transactions, Stock On Hand, Purchases GRN, AI Council Briefing", "bathco-data folder"),
    ("BATHCO_SIMPLE_REPORT.xlsx", "READ OK", "Cheques, Monthly Summary, Stock Summary, Expenses", "URGENT.rar"),
    ("OUTBOUND_CHEQ_CLEAN.xlsx", "READ OK", "Full outbound cheque register — all suppliers Dec 2025 to Aug 2026", "URGENT.rar"),
    ("DALY SALES REPORT.xlsx", "READ OK", "Daily transaction-level sales Jan-Feb 2026", "DALY SALES.rar"),
    ("01.02.26.xlsx", "READ OK", "Daily sales 1 Feb 2026", "DALY SALES.rar"),
    ("05.02.26.xlsx", "READ OK", "Daily sales 5 Feb 2026", "DALY SALES.rar"),
    ("26.01.31.xlsx", "READ OK", "Daily sales 31 Jan 2026", "New folder (3).rar"),
    ("12-05-2026.xlsx", "READ OK", "Daily sales 12 May 2026", "URGENT.rar / 12-05"),
    ("13-05-2026.xlsx", "READ OK", "Daily sales 13 May 2026", "URGENT.rar / 13-05"),
    ("14-05-2026.xlsx", "READ OK", "Daily sales 14 May 2026", "URGENT.rar / 14-05"),
    ("15-05-2026.xlsx", "READ OK", "Daily sales 15 May 2026", "URGENT.rar / 15-05"),
    ("19-05-2026.xlsx", "READ OK", "Daily sales 19 May 2026", "URGENT.rar / 19-05-2026"),
    ("DALY SALES REPORT - Copy.xlsx", "READ OK", "Daily sales Jan-Feb 2026 (duplicate)", "Desktop"),
    ("GRN.xlsx", "FAILED — INVALID XML", "Goods received notes — open in Excel and re-save", "4.22.rar"),
    ("NON MOVING.xlsx", "FAILED — INVALID XML", "Non-moving inventory — open in Excel and re-save", "4.22.rar"),
    ("PRICE LIST.xlsx", "FAILED — INVALID XML", "Price list — open in Excel and re-save", "4.22.rar"),
    ("QUANTITY AND PRICE.xlsx", "FAILED — INVALID XML", "Qty and price — open in Excel and re-save", "4.22.rar"),
    ("SLOW.xlsx", "FAILED — INVALID XML", "Slow-moving items — open in Excel and re-save", "4.22.rar"),
    ("STOCK FAST.xlsx", "FAILED — INVALID XML", "Fast-moving items — open in Excel and re-save", "4.22.rar"),
    ("T SALE.xlsx", "FAILED — INVALID XML", "Total sales — open in Excel and re-save", "4.22.rar"),
    ("TOTAL Q.xlsx", "FAILED — INVALID XML", "Total quantities — open in Excel and re-save", "4.22.rar"),
    ("TOTAL.xlsx", "FAILED — INVALID XML", "Total report — open in Excel and re-save", "URGENT.rar"),
    ("AFDAS / BFNH / CFBDF / FNGJN / SFSGS / VGNGF.xlsx", "FAILED — INVALID XML", "Unknown cryptic-name reports — open each in Excel and re-save to read", "URGENT.rar"),
]

for i,(fn,status,content,src) in enumerate(sources):
    r9=3+i
    ws9.cell(r9,1,fn); ws9.cell(r9,2,status); ws9.cell(r9,3,content); ws9.cell(r9,4,src)
    style_data_row(ws9,r9,4,alt=(i%2==1))
    if "FAILED" in status: ws9.cell(r9,2).fill=fill(C_RED); ws9.cell(r9,2).font=bfont(bold=True)
    else: ws9.cell(r9,2).fill=fill(C_GREEN)
    ws9.cell(r9,3).alignment=Alignment(wrap_text=True,vertical="center")
    ws9.row_dimensions[r9].height=28

ws9.column_dimensions["A"].width=45; ws9.column_dimensions["B"].width=22
ws9.column_dimensions["C"].width=55; ws9.column_dimensions["D"].width=22

# ──────────────────────────────────────────────────────────────────────
# TAB COLOURS
# ──────────────────────────────────────────────────────────────────────
tab_colours = {
    "SUMMARY":           "1F3864",
    "MONTHLY SALES":     "2E75B6",
    "MAY 2026 DAILY":    "2E75B6",
    "ALL TRANSACTIONS":  "375623",
    "STOCK ON HAND":     "843C0C",
    "PURCHASES GRN":     "843C0C",
    "PENDING CHEQUES":   "C00000",
    "SUPPLIER PAYMENTS": "7030A0",
    "DATA SOURCES":      "595959",
}
for sheet in wb_out.worksheets:
    if sheet.title in tab_colours:
        sheet.sheet_properties.tabColor = tab_colours[sheet.title]

# ──────────────────────────────────────────────────────────────────────
# SAVE
# ──────────────────────────────────────────────────────────────────────
wb_out.save(OUT)
size_kb = os.path.getsize(OUT) // 1024
print(f"\nSaved: {OUT}")
print(f"Size:  {size_kb} KB")
print(f"Sheets: {len(wb_out.worksheets)}")
for ws in wb_out.worksheets:
    print(f"  - {ws.title}")
