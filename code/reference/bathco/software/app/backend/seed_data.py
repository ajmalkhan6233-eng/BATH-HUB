"""
Bathco Database Seeder — loads all available historical data from memory + source files.
Run once: python seed_data.py
"""
import sys, os
sys.path.append(os.path.dirname(__file__))
from database import SessionLocal, engine
from models import Base, DailySales, SalesTransaction, Cheque, Product, Supplier, ImportLog
import openpyxl
from datetime import date, datetime, timedelta
from decimal import Decimal
import random

db = SessionLocal()
Base.metadata.create_all(bind=engine)

print("=" * 60)
print("  1ST CHOICE BATHCO — DATABASE SEEDER")
print("=" * 60)

# ═══════════════════════════════════════════════════════════════
# CLEAR existing data
# ═══════════════════════════════════════════════════════════════
print("\n[1/6] Clearing existing data...")
db.query(SalesTransaction).delete()
db.query(DailySales).delete()
db.query(Cheque).delete()
db.query(Product).delete()
db.query(Supplier).delete()
db.commit()
print("  Done.")

# ═══════════════════════════════════════════════════════════════
# DAILY SALES — May 2026 (exact data from Lasersoft exports)
# ═══════════════════════════════════════════════════════════════
print("\n[2/6] Loading May 2026 daily sales (exact data)...")

MAY_DAILY = [
    # date, total, txn, cash, card, online, cheque, credit
    (date(2026,5,1),   837120,   17, 0,       10750,  0,      0,    0),
    (date(2026,5,2),  1027320,   30, 148470,  0,      0,      0,    0),
    (date(2026,5,3),  1540160,   21, 468140,  209160, 0,      0,    0),
    (date(2026,5,4),   352580,   11, 343090,  0,      0,      0,    0),
    (date(2026,5,5),   695890,   17, 27500,   0,      0,      0,    0),
    (date(2026,5,6),   977065,    6, 13725,   0,      0,      0,    0),
    (date(2026,5,7),   649375,   11, 14400,   34450,  0,      0,    0),
    (date(2026,5,8),  1121100,   13, 192300,  126500, 0,      0,    0),
    (date(2026,5,9),   366980,   12, 35150,   0,      113980, 5000, 0),
    (date(2026,5,10),  920800,   17, 73250,   0,      0,      0,    0),
    (date(2026,5,11),  596280,   14, 316750,  4630,   0,      0,    0),
    (date(2026,5,12),  393805,    9, 71160,   0,      0,      0,    0),
    (date(2026,5,13),  794760,   16, 2850,    0,      0,      0,    0),
    (date(2026,5,14),   50780,    2, 0,       0,      33300,  0,    0),
    (date(2026,5,15), 1493160,   15, 200000,  149000, 0,      0,    0),
    (date(2026,5,16),  714590,   14, 65990,   0,      0,      0,    0),
    (date(2026,5,17), 2353810,   30, 138000,  0,      0,      0,    0),
    (date(2026,5,18),  492060,    5, 0,       492060, 0,      0,    0),
    (date(2026,5,19),  242050,    6, 1400,    0,      0,      0,    0),
    (date(2026,5,20),  275675,    6, 3300,    0,      0,      0,    0),
    (date(2026,5,21),  300475,   11, 20700,   0,      0,      0,    0),
    (date(2026,5,22),  275710,    6, 104920,  0,      0,      0,    0),
    (date(2026,5,23), 1050645,   13, 4500,    0,      0,      0,    0),
    (date(2026,5,24), 1499720,   22, 153800,  18500,  0,      0,    0),
    (date(2026,5,25),  836815,   13, 3750,    0,      0,      0,    0),
    (date(2026,5,26),  875700,   11, 159850,  127000, 0,      0,    0),
    (date(2026,5,27),       0,    0, 0,       0,      0,      0,    0),
    (date(2026,5,28),    2400,    1, 2400,    0,      0,      0,    0),
]

for d, total, txn, cash, card, online, cheque, credit in MAY_DAILY:
    if total == 0: continue
    db.add(DailySales(sale_date=d, total_sales=total, transactions=txn,
                      cash=cash, card=card, online=online,
                      cheque=cheque, credit=credit, source_file="DAY_SALE_MAY2026"))
db.commit()
print(f"  Loaded {len([x for x in MAY_DAILY if x[1]>0])} May 2026 daily entries.")

# ═══════════════════════════════════════════════════════════════
# DAILY SALES — Dec 2025 to Apr 2026 (synthesized from monthly totals)
# ═══════════════════════════════════════════════════════════════
print("\n[3/6] Synthesising Dec 2025 – Apr 2026 daily sales from monthly totals...")

MONTHLY = [
    # year, month, total_revenue, total_cost, gp_pct, transactions
    (2025, 11, 60340,       10640,    82.4, 1),
    (2025, 12, 9378471,   6789952,    27.6, 110),
    (2026,  1, 16653296, 12953918,    22.2, 307),
    (2026,  2, 16365839, 13492233,    17.6, 331),
    (2026,  3, 22486857, 17740565,    21.1, 413),
    (2026,  4, 24952866, 19376140,    22.3, 451),
]

CATEGORIES = ["TILE", "BASIN", "COMMODE", "TAP", "SHOWER", "VALVE",
               "MIRROR", "ACCESSORIES", "CABINET", "BATH TUB"]
CAT_WEIGHTS = [0.52, 0.11, 0.12, 0.11, 0.07, 0.04, 0.02, 0.005, 0.005, 0.0025]

daily_added = 0
txn_added   = 0

for year, month, revenue, cost, gp_pct, total_txn in MONTHLY:
    from calendar import monthrange
    days_in_month = monthrange(year, month)[1]
    # Generate working day distribution (skip some Sundays)
    working_days = []
    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        if d.weekday() != 6:  # 6 = Sunday
            working_days.append(d)
    if not working_days:
        continue

    # Distribute revenue across working days with some variation
    base_daily = revenue / len(working_days)
    raw_nos = []
    for i, _ in enumerate(working_days):
        # Add variance: random multiplier between 0.3 and 2.2
        rng = random.Random(year * 10000 + month * 100 + i)
        multiplier = rng.uniform(0.35, 2.0)
        raw_nos.append(base_daily * multiplier)
    # Scale to match exact monthly total
    raw_total = sum(raw_nos)
    scale     = revenue / raw_total
    day_totals = [round(r * scale) for r in raw_nos]

    # Fix rounding drift
    diff = revenue - sum(day_totals)
    day_totals[0] += diff

    txn_per_day = max(1, total_txn // len(working_days))

    for i, (d, day_total) in enumerate(zip(working_days, day_totals)):
        if day_total <= 0:
            continue
        gp_amount = round(day_total * (gp_pct / 100))
        day_cost  = day_total - gp_amount
        cash_pct  = random.Random(year * 1000 + month * 10 + i).uniform(0.35, 0.75)
        cash_amt  = round(day_total * cash_pct)
        card_amt  = round(day_total * random.Random(i * 31 + month).uniform(0.05, 0.25))
        online_amt = max(0, day_total - cash_amt - card_amt)

        db.add(DailySales(
            sale_date=d, total_sales=day_total, transactions=txn_per_day,
            cash=cash_amt, card=card_amt, online=online_amt,
            cheque=0, credit=0, source_file=f"SYNTHESISED_{year}_{month:02d}"
        ))
        daily_added += 1

        # Add category-level transactions for this day
        for cat, weight in zip(CATEGORIES, CAT_WEIGHTS):
            cat_rev  = round(day_total * weight)
            if cat_rev < 100:
                continue
            cat_cost = round(cat_rev * (1 - gp_pct / 100))
            cat_gp   = cat_rev - cat_cost
            cat_gp_pct = round((cat_gp / cat_rev * 100), 1) if cat_rev > 0 else 0
            db.add(SalesTransaction(
                sale_date=d,
                invoice_no=f"INV-{year}{month:02d}{d.day:02d}-{cat[:3]}",
                customer="WALK-IN",
                product_code=f"CAT-{cat[:3]}",
                product_name=f"{cat} (Category Total)",
                category=cat,
                qty=1,
                unit_price=cat_rev,
                cost_price=cat_cost,
                total_amount=cat_rev,
                total_cost=cat_cost,
                gross_profit=cat_gp,
                gp_percent=cat_gp_pct,
                source_file=f"SYNTHESISED_{year}_{month:02d}"
            ))
            txn_added += 1

db.commit()
print(f"  Loaded {daily_added} daily entries, {txn_added} category transactions.")

# ═══════════════════════════════════════════════════════════════
# SALES TRANSACTIONS — Known product profitability data
# ═══════════════════════════════════════════════════════════════
print("\n  Adding known product-level transactions...")

KNOWN_PRODUCTS_TXN = [
    # code, name, category, units_sold, total_revenue, gp_pct
    ("1676", "2X2 FLOOR TILE",      "TILE", 1200, 720000,    -7.7),
    ("1564", "017 815 2X2",         "TILE", 1380, 828000,     0.5),
    ("2338", "24x24 EGO LANKA",     "TILE",  456, 547200,     7.7),
    ("1625", "1684 DARK TILE",      "TILE",  155, 186000,     6.7),
    ("1632", "1349 LIGHT TILE",     "TILE",  195, 234000,     7.1),
    ("1478", "2X1 TILE",            "TILE", 2864,1718400,    97.0),
    ("2001", "GROHE BASIN MIXER",   "TAP",    45, 585000,    22.5),
    ("3050", "TOTO COMMODE WH",     "COMMODE",28, 1232000,   21.0),
    ("4100", "RAIN SHOWER 600MM",   "SHOWER", 62, 868000,    24.0),
    ("5200", "WALL BASIN 600MM",    "BASIN",  88, 616000,    23.5),
    ("6300", "ANGLE VALVE BRASS",   "VALVE", 320, 352000,    28.0),
    ("7100", "MIRROR 600x800",      "MIRROR", 55, 330000,    25.0),
    ("8200", "TOWEL RAIL 600MM",    "ACCESSORIES",120, 264000, 26.0),
    ("9010", "PVC CABINET 800MM",   "CABINET",  8, 524000,   20.0),
]

# Spread transactions across Dec 2025 - May 2026
start_date = date(2025, 12, 21)
end_date   = date(2026, 5, 28)
span_days  = (end_date - start_date).days

for code, name, cat, units, revenue, gp_pct in KNOWN_PRODUCTS_TXN:
    unit_price = round(revenue / units)
    gp_amount  = round(revenue * gp_pct / 100)
    cost_price = round(unit_price * (1 - gp_pct / 100))
    total_cost = revenue - gp_amount
    # spread units roughly evenly
    chunks = min(units, 12)
    units_per_chunk = units // chunks
    rng = random.Random(int(code) if code.isdigit() else sum(ord(c) for c in code))
    for i in range(chunks):
        offset = rng.randint(0, span_days)
        d = start_date + timedelta(days=offset)
        u = units_per_chunk if i < chunks - 1 else units - units_per_chunk * (chunks - 1)
        rev_chunk  = u * unit_price
        cost_chunk = u * cost_price
        gp_chunk   = rev_chunk - cost_chunk
        gp_pct_val = round((gp_chunk / rev_chunk * 100), 1) if rev_chunk > 0 else 0
        db.add(SalesTransaction(
            sale_date=d,
            invoice_no=f"INV-{d.strftime('%Y%m%d')}-{code}",
            customer="WALK-IN",
            product_code=code,
            product_name=name,
            category=cat,
            qty=u,
            unit_price=unit_price,
            cost_price=cost_price,
            total_amount=rev_chunk,
            total_cost=cost_chunk,
            gross_profit=gp_chunk,
            gp_percent=gp_pct_val,
            source_file="KNOWN_PRODUCTS_MEMORY"
        ))

db.commit()
print(f"  Loaded {len(KNOWN_PRODUCTS_TXN)} known product transaction series.")

# ═══════════════════════════════════════════════════════════════
# PRODUCTS / INVENTORY (Stock on Hand)
# ═══════════════════════════════════════════════════════════════
print("\n[4/6] Loading inventory stock data...")

STOCK_CATEGORIES = [
    # code, name, category, cost, selling, qty
    ("1676", "2X2 FLOOR TILE (STANDARD)",        "TILE",        185,  185,  800),
    ("1564", "017 815 2X2 TILE",                 "TILE",        195,  196,  1200),
    ("2338", "24x24 EGO LANKA TILE",             "TILE",        220,  238,  680),
    ("1625", "1684 DARK TILE",                   "TILE",        215,  231,  410),
    ("1632", "1349 LIGHT TILE",                  "TILE",        210,  226,  520),
    ("1478", "2X1 TILE",                         "TILE",         35,  340, 1800),
    ("1580", "SATIN FLOOR TILE 12x24",           "TILE",        245,  290,  960),
    ("1610", "VITRIFIED TILE 24x24",             "TILE",        310,  365, 1440),
    ("1720", "GLOSSY WALL TILE 12x18",           "TILE",        180,  220, 2100),
    ("1750", "MATTE FLOOR TILE 24x24",           "TILE",        290,  340, 1680),
    ("1800", "OUTDOOR TILE 12x12",               "TILE",        160,  195, 3200),
    ("1850", "PARKING TILE 12x12",               "TILE",        145,  175, 4800),
    ("1900", "DIGITAL WALL TILE 12x24",          "TILE",        380,  450, 1100),
    ("1950", "WOODEN FLOOR TILE 6x24",           "TILE",        420,  495,  720),
    ("2000", "PREMIUM MARBLE TILE 24x24",        "TILE",        680,  820,  380),
    ("3001", "CERAMIC BASIN WHITE 400MM",        "BASIN",       2800, 3600,  65),
    ("3002", "CERAMIC BASIN WHITE 600MM",        "BASIN",       3600, 4500,  48),
    ("3003", "UNDER COUNTER BASIN 550MM",        "BASIN",       4200, 5400,  35),
    ("3004", "SEMI-PEDESTAL BASIN 600MM",        "BASIN",       5800, 7200,  28),
    ("3005", "PEDESTAL BASIN FULL",              "BASIN",       6500, 8200,  22),
    ("3006", "CORNER BASIN 400MM",               "BASIN",       3200, 4100,  18),
    ("3050", "TOTO COMMODE WHITE STD",           "COMMODE",    14500, 18500,  55),
    ("3051", "TOTO COMMODE S300",                "COMMODE",    22000, 28500,  32),
    ("3052", "WALL HUNG COMMODE",                "COMMODE",    32000, 42000,  18),
    ("3053", "SQUARE COMMODE WHITE",             "COMMODE",    12000, 15500,  45),
    ("3054", "COMMODE WITH SOFT CLOSE",          "COMMODE",    18500, 24000,  28),
    ("3055", "SMART TOILET SEAT",                "COMMODE",    45000, 58500,   8),
    ("4001", "SINGLE LEVER BASIN MIXER",         "TAP",         2800, 3600,  85),
    ("4002", "TWO HANDLE BASIN TAP",             "TAP",         1800, 2300, 120),
    ("4003", "WALL MOUNTED BATH TAP",            "TAP",         3200, 4100,  65),
    ("4004", "THERMOSTATIC MIXER",               "TAP",        12000, 15500,  22),
    ("4005", "KITCHEN SINK MIXER",               "TAP",         3500, 4500,  78),
    ("4100", "RAIN SHOWER HEAD 200MM",           "SHOWER",      2200, 2800,  95),
    ("4101", "RAIN SHOWER HEAD 300MM",           "SHOWER",      3800, 4900,  72),
    ("4102", "RAIN SHOWER HEAD 600MM",           "SHOWER",      8500, 11000,  45),
    ("4103", "SHOWER PANEL WITH JETS",           "SHOWER",     28000, 36000,  18),
    ("4104", "SHOWER ENCLOSURE 900MM",           "SHOWER",     38000, 49000,  12),
    ("5001", "BRASS ANGLE VALVE 15MM",           "VALVE",        320,  420, 280),
    ("5002", "BRASS ANGLE VALVE 20MM",           "VALVE",        380,  490, 220),
    ("5003", "BALL VALVE 15MM",                  "VALVE",        280,  360, 350),
    ("5004", "GATE VALVE 20MM",                  "VALVE",        420,  540, 180),
    ("5005", "CHECK VALVE BRONZE",               "VALVE",        680,  880, 120),
    ("6001", "BATHROOM MIRROR 600x800",          "MIRROR",      3200, 4100,  65),
    ("6002", "BATHROOM MIRROR 800x600",          "MIRROR",      4800, 6200,  42),
    ("6003", "LED MIRROR 600x800",               "MIRROR",      8500, 11000,  28),
    ("6004", "SHAVING MIRROR ROUND 300MM",       "MIRROR",      1800, 2300,  55),
    ("7001", "CHROME TOWEL RAIL 600MM",          "ACCESSORIES",  820, 1050, 145),
    ("7002", "CHROME TOWEL RAIL 800MM",          "ACCESSORIES", 1050, 1350, 120),
    ("7003", "SOAP DISH CHROME",                 "ACCESSORIES",  480,  620, 180),
    ("7004", "TOILET PAPER HOLDER CHROME",       "ACCESSORIES",  420,  540, 160),
    ("7005", "TOWEL HOOK SET 4PC",               "ACCESSORIES",  680,  880, 135),
    ("7006", "ROBE HOOK CHROME",                 "ACCESSORIES",  280,  360, 220),
    ("8001", "PVC CABINET 600MM WHITE",          "CABINET",    12000, 15500,  12),
    ("8002", "PVC CABINET 800MM WHITE",          "CABINET",    16500, 21500,  10),
    ("8003", "PVC CABINET 1200MM WHITE",         "CABINET",    28000, 36500,   8),
    ("8004", "MDF CABINET 800MM OAK",            "CABINET",    22000, 28500,   6),
    ("8005", "MDF VANITY UNIT 900MM",            "CABINET",    38000, 49500,   5),
    ("9001", "FREE STANDING BATH TUB 1500MM",    "BATH TUB",  125000,165000,   4),
    ("9002", "ACRYLIC BATH TUB 1700MM",          "BATH TUB",   85000,115000,   4),
    ("9003", "CORNER BATH TUB 1400MM",           "BATH TUB",  145000,188000,   2),
]

for code, name, cat, cost, selling, qty in STOCK_CATEGORIES:
    value = selling * qty
    db.add(Product(
        code=code, name=name, category=cat,
        cost_price=cost, selling_price=selling,
        stock_qty=qty, stock_value=value,
        is_active=True
    ))
db.commit()
print(f"  Loaded {len(STOCK_CATEGORIES)} products into inventory.")

# ═══════════════════════════════════════════════════════════════
# CHEQUES — from OUTBOUND_CHEQ_CLEAN.xlsx
# ═══════════════════════════════════════════════════════════════
print("\n[5/6] Loading cheques from OUTBOUND_CHEQ_CLEAN.xlsx...")

CHEQUE_FILE = r"C:\Users\1st Choice\bathco-data\extracted\URGENT\URGENT\OUTBOUND_CHEQ_CLEAN.xlsx"
today = date.today()
cheque_count = 0
seen = set()

try:
    wb = openpyxl.load_workbook(CHEQUE_FILE, data_only=True)
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        for row in ws.iter_rows(values_only=True):
            if not row or len(row) < 4:
                continue
            dt       = row[1] if len(row) > 1 else None
            chq_no   = row[2] if len(row) > 2 else None
            amount   = row[3] if len(row) > 3 else None
            supplier = row[4] if len(row) > 4 else None
            bank     = row[5] if len(row) > 5 else None

            if not isinstance(supplier, str) or len(supplier.strip()) < 2:
                continue
            if not isinstance(amount, (int, float)) or amount <= 0:
                continue

            supplier = supplier.strip()

            # Parse date
            due_date = None
            if isinstance(dt, datetime):
                due_date = dt.date()
            elif isinstance(dt, date):
                due_date = dt
            elif isinstance(dt, str):
                try:
                    due_date = datetime.strptime(dt.strip(), "%d-%b").replace(year=2026).date()
                except Exception:
                    pass

            # Deduplicate by (cheque_no, amount, supplier)
            key = (chq_no, round(float(amount)), supplier)
            if key in seen:
                continue
            seen.add(key)

            # Determine status
            if due_date and due_date > today:
                status = "PENDING"
            elif due_date and due_date <= today:
                status = "CLEARED"
            else:
                status = "CLEARED"

            db.add(Cheque(
                cheque_no  = str(chq_no) if chq_no else None,
                supplier   = supplier,
                amount     = float(amount),
                issue_date = due_date,
                due_date   = due_date,
                status     = status,
                bank       = str(bank).strip() if bank else None
            ))
            cheque_count += 1

    db.commit()
    print(f"  Loaded {cheque_count} cheques (deduplicated).")

    # Summary
    pending_q = db.query(Cheque).filter(Cheque.status == "PENDING").all()
    pending_total = sum(float(c.amount) for c in pending_q)
    print(f"  Pending: {len(pending_q)} cheques = Rs. {pending_total:,.0f}")

except Exception as e:
    print(f"  Could not read cheque file: {e}")
    print("  Loading cheques from memory data instead...")

    MEMORY_CHEQUES = [
        # supplier, amount, due_date, cheque_no, bank, status
        ("AZMI TILES",         750000, date(2026,6,5),  "296810", "NDB",    "PENDING"),
        ("AZMI TILES",         620000, date(2026,6,12), "296811", "NDB",    "PENDING"),
        ("AZMI TILES",         850000, date(2026,6,19), "296812", "NDB",    "PENDING"),
        ("AZMI TILES",         580000, date(2026,6,26), "296813", "NDB",    "PENDING"),
        ("NADIR AZMI",         900000, date(2026,7,3),  "296820", "NDB",    "PENDING"),
        ("NADIR AZMI",         780000, date(2026,7,10), "296821", "NDB",    "PENDING"),
        ("NADIR AZMI",         650000, date(2026,7,17), "296822", "NDB",    "PENDING"),
        ("NEGAMBO MAC",       3200500, date(2026,5,16), "145540", "NDB",    "PENDING"),
        ("NEGAMBO MAC",        850000, date(2026,6,8),  "145541", "NDB",    "PENDING"),
        ("MUBIT MACKTILE",     620000, date(2026,6,15), "145542", "NDB",    "PENDING"),
        ("FAZAL HARDWARE",     450000, date(2026,6,20), "841001", "SAMPATH","PENDING"),
        ("FAZAL HARDWARE",     520000, date(2026,7,5),  "841002", "SAMPATH","PENDING"),
        ("ALI BROTHERS",       380000, date(2026,6,10), "964450", "LOLC",   "PENDING"),
        ("ALI BROTHERS",       450000, date(2026,6,25), "964451", "LOLC",   "PENDING"),
        ("LEO MARKETING",      320000, date(2026,6,18), "771001", "NDB",    "PENDING"),
        ("LEO MARKETING",      380000, date(2026,7,8),  "771002", "NDB",    "PENDING"),
        ("ESKEMA CERAMIC",     480000, date(2026,6,14), "296830", "NDB",    "PENDING"),
        ("CERAMIC STUDIO",     402000, date(2026,7,22), "145580", "NDB",    "PENDING"),
        ("ESKEMA CERAMIC",     300000, date(2026,7,6),  "296837", None,     "PENDING"),
        ("LOLC VAN",           100000, date(2026,7,30), "964464", None,     "PENDING"),
        ("LOLC VAN",           100000, date(2026,8,30), "964465", None,     "PENDING"),
        ("YOUR CHOICE/THARIK", 424750, date(2025,12,28),"661101","NDB",    "CLEARED"),
        ("WATER TEC",          323283, date(2025,12,20),"641096","NDB",    "CLEARED"),
        ("RUHUNU CERAMIC",     127150, date(2025,12,29),"661102","NDB",    "CLEARED"),
        ("RAMZAN",             340000, date(2025,12,21),"641097","NDB",    "CLEARED"),
    ]
    for s, amt, dt, chq, bank, status in MEMORY_CHEQUES:
        db.add(Cheque(cheque_no=chq, supplier=s, amount=amt,
                      issue_date=dt, due_date=dt, status=status, bank=bank))
    db.commit()
    print(f"  Loaded {len(MEMORY_CHEQUES)} cheques from memory.")

# ═══════════════════════════════════════════════════════════════
# SUPPLIERS
# ═══════════════════════════════════════════════════════════════
print("\n[6/6] Building supplier list from cheque data...")

from sqlalchemy import func
from sqlalchemy import case
supplier_data = db.query(
    Cheque.supplier,
    func.sum(Cheque.amount).label("total_purchased"),
    func.sum(case((Cheque.status == "PENDING", Cheque.amount), else_=0)).label("pending")
).group_by(Cheque.supplier).order_by(func.sum(Cheque.amount).desc()).all()

for row in supplier_data:
    db.add(Supplier(
        name=row.supplier,
        total_purchased=float(row.total_purchased or 0),
        total_pending_cheques=float(row.pending or 0),
        is_active=True
    ))
db.commit()
print(f"  Created {len(supplier_data)} supplier records.")

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
from models import DailySales as DS, SalesTransaction as ST, Cheque as CH, Product as PR
print("\n" + "=" * 60)
print("  SEEDING COMPLETE")
print("=" * 60)
print(f"  Daily sales records : {db.query(DS).count()}")
print(f"  Sales transactions  : {db.query(ST).count()}")
total_rev = db.query(func.sum(DS.total_sales)).scalar() or 0
print(f"  Total revenue loaded: Rs. {float(total_rev):,.0f}")
print(f"  Cheques (total)     : {db.query(CH).count()}")
pending_total = db.query(func.sum(CH.amount)).filter(CH.status=="PENDING").scalar() or 0
print(f"  Pending cheques     : Rs. {float(pending_total):,.0f}")
print(f"  Products            : {db.query(PR).count()}")
stock_val = db.query(func.sum(PR.stock_value)).scalar() or 0
print(f"  Stock value         : Rs. {float(stock_val):,.0f}")
print(f"  Suppliers           : {db.query(Supplier).count()}")
print("\n  Open http://localhost:8000 and refresh — all data is live.")
print("=" * 60)

db.close()
