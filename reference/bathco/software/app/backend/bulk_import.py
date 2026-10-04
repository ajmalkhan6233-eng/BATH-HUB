"""Bulk-imports all daily sale files from the DAY SALE folder into the database."""
import sys, os, glob
sys.path.append(os.path.dirname(__file__))
from database import SessionLocal
from models import DailySales, ImportLog
import pandas as pd
from datetime import date

DAY_SALE_FOLDER = r"C:\Users\1st Choice\BATHCO\DAY SALE"

def safe_float(val, default=0.0):
    try:
        if pd.isna(val): return default
        return float(str(val).replace(",", "").strip())
    except Exception:
        return default

def parse_date(val):
    try:
        return pd.to_datetime(val).date()
    except Exception:
        return None

def import_file(filepath: str, db) -> dict:
    filename = os.path.basename(filepath)
    try:
        df = pd.read_excel(filepath, header=None)
        # Try to find the data row — look for a date column
        target_date = None
        total_sales = 0
        transactions = 0
        cash = card = online = cheque = credit = 0

        # Try to parse date from filename first (e.g. 31-05-2026.xlsx)
        base = filename.replace(".xlsx", "").replace(".xls", "")
        parts = base.replace("_", "-").split("-")
        if len(parts) == 3:
            try:
                d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                target_date = date(y, m, d)
            except Exception:
                pass

        # Read all cells looking for sales total
        for idx, row in df.iterrows():
            for col in df.columns:
                val = row[col]
                if pd.notna(val):
                    s = str(val).strip().lower()
                    if "total" in s or "grand" in s:
                        # Check next cell for amount
                        try:
                            amt = safe_float(row[col + 1])
                            if amt > 10000:
                                total_sales = max(total_sales, amt)
                        except Exception:
                            pass
                    if target_date is None:
                        d = parse_date(val)
                        if d and d.year >= 2025:
                            target_date = d
                    try:
                        amt = safe_float(val)
                        if amt > 50000:
                            total_sales = max(total_sales, amt)
                    except Exception:
                        pass

        if target_date is None or total_sales == 0:
            return {"file": filename, "status": "SKIPPED", "reason": "Could not parse date or sales total"}

        existing = db.query(DailySales).filter(DailySales.sale_date == target_date).first()
        if existing:
            existing.total_sales = max(float(existing.total_sales), total_sales)
            existing.source_file = filename
        else:
            db.add(DailySales(
                sale_date=target_date, total_sales=total_sales,
                transactions=0, cash=0, card=0, online=0, cheque=0, credit=0,
                source_file=filename
            ))
        db.add(ImportLog(filename=filename, import_type="DAILY_SALES_BULK",
                         records_imported=1, status="OK"))
        db.commit()
        return {"file": filename, "status": "OK", "date": str(target_date), "sales": total_sales}

    except Exception as e:
        return {"file": filename, "status": "ERROR", "reason": str(e)}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    db = SessionLocal()
    files = sorted(f for f in
                   glob.glob(os.path.join(DAY_SALE_FOLDER, "*.xlsx")) +
                   glob.glob(os.path.join(DAY_SALE_FOLDER, "*.xls"))
                   if not os.path.basename(f).startswith("~$"))
    print(f"Found {len(files)} files in {DAY_SALE_FOLDER}")
    ok = err = skip = 0
    for f in files:
        result = import_file(f, db)
        status = result.get("status")
        if status == "OK":
            print(f"  OK {result['file']} -> {result['date']} Rs. {result['sales']:,.0f}")
            ok += 1
        elif status == "SKIPPED":
            print(f"  -- SKIP: {result['file']} - {result.get('reason','')}")
            skip += 1
        else:
            print(f"  XX ERROR: {result['file']} - {result.get('reason','')}")
            err += 1
    db.close()
    print(f"\nDone: {ok} imported, {skip} skipped, {err} errors")
