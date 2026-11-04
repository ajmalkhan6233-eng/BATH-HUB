from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import os, sys, tempfile, re
from datetime import date
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import DailySales, SalesTransaction, Cheque, Product, ImportLog

router = APIRouter(prefix="/import", tags=["Data Import"])


def parse_date(val) -> date | None:
    if pd.isna(val) or val is None:
        return None
    try:
        return pd.to_datetime(val).date()
    except Exception:
        return None


def safe_float(val, default=0.0) -> float:
    try:
        if pd.isna(val):
            return default
        return float(str(val).replace(",", "").strip())
    except Exception:
        return default


@router.post("/daily-sales")
async def import_daily_sales(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        df = pd.read_excel(tmp_path)
        os.unlink(tmp_path)

        imported = 0
        errors = []

        for _, row in df.iterrows():
            try:
                sale_date = parse_date(row.get("DATE") or row.get("Date") or row.get("date"))
                if not sale_date:
                    continue
                total = safe_float(row.get("TOTAL SALES") or row.get("Total Sales") or row.get("total_sales"))
                if total == 0:
                    continue

                existing = db.query(DailySales).filter(DailySales.sale_date == sale_date).first()
                if existing:
                    existing.total_sales = total
                    existing.transactions = int(safe_float(row.get("TRANSACTIONS") or row.get("Transactions") or 0))
                    existing.cash   = safe_float(row.get("CASH")   or row.get("Cash")   or 0)
                    existing.card   = safe_float(row.get("CARD")   or row.get("Card")   or 0)
                    existing.online = safe_float(row.get("ONLINE") or row.get("Online") or 0)
                    existing.cheque = safe_float(row.get("CHEQUE") or row.get("Cheque") or 0)
                    existing.credit = safe_float(row.get("CREDIT") or row.get("Credit") or 0)
                    existing.source_file = file.filename
                else:
                    db.add(DailySales(
                        sale_date   = sale_date,
                        total_sales = total,
                        transactions= int(safe_float(row.get("TRANSACTIONS") or row.get("Transactions") or 0)),
                        cash        = safe_float(row.get("CASH")   or row.get("Cash")   or 0),
                        card        = safe_float(row.get("CARD")   or row.get("Card")   or 0),
                        online      = safe_float(row.get("ONLINE") or row.get("Online") or 0),
                        cheque      = safe_float(row.get("CHEQUE") or row.get("Cheque") or 0),
                        credit      = safe_float(row.get("CREDIT") or row.get("Credit") or 0),
                        source_file = file.filename
                    ))
                imported += 1
            except Exception as e:
                errors.append(str(e))

        db.add(ImportLog(filename=file.filename, import_type="DAILY_SALES",
                         records_imported=imported, status="OK" if not errors else "PARTIAL",
                         error_message="; ".join(errors[:5]) if errors else None))
        db.commit()
        return {"imported": imported, "errors": len(errors), "file": file.filename}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cheques")
async def import_cheques(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        df = pd.read_excel(tmp_path)
        os.unlink(tmp_path)

        imported = 0
        errors = []

        for _, row in df.iterrows():
            try:
                supplier = str(row.get("SUPPLIER") or row.get("Supplier") or row.get("supplier") or "").strip()
                amount_raw = row.get("AMOUNT") or row.get("Amount") or row.get("amount")
                amount = safe_float(amount_raw)
                if not supplier or amount == 0:
                    continue

                db.add(Cheque(
                    cheque_no  = str(row.get("CHEQUE NO") or row.get("Cheque No") or row.get("cheque_no") or "").strip() or None,
                    supplier   = supplier,
                    amount     = amount,
                    issue_date = parse_date(row.get("ISSUE DATE") or row.get("Issue Date")),
                    due_date   = parse_date(row.get("DUE DATE") or row.get("Due Date") or row.get("DATE") or row.get("Date")),
                    status     = str(row.get("STATUS") or row.get("Status") or "PENDING").strip().upper(),
                    bank       = str(row.get("BANK") or row.get("Bank") or "").strip() or None,
                    notes      = str(row.get("NOTES") or row.get("Notes") or "").strip() or None
                ))
                imported += 1
            except Exception as e:
                errors.append(str(e))

        db.add(ImportLog(filename=file.filename, import_type="CHEQUES",
                         records_imported=imported, status="OK" if not errors else "PARTIAL",
                         error_message="; ".join(errors[:5]) if errors else None))
        db.commit()
        return {"imported": imported, "errors": len(errors), "file": file.filename}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
