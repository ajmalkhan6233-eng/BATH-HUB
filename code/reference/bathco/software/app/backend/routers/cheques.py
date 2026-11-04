from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import Cheque
from schemas import ChequeCreate, ChequeOut

router = APIRouter(prefix="/cheques", tags=["Cheques"])


@router.get("/", response_model=list[ChequeOut])
def get_cheques(
    status: str = Query(None, description="PENDING, CLEARED, CANCELLED"),
    supplier: str = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(Cheque)
    if status:
        q = q.filter(Cheque.status == status.upper())
    if supplier:
        q = q.filter(Cheque.supplier.ilike(f"%{supplier}%"))
    return q.order_by(Cheque.due_date).all()


@router.get("/summary")
def get_cheque_summary(db: Session = Depends(get_db)):
    today = date.today()

    total_pending = db.query(func.sum(Cheque.amount))\
                      .filter(Cheque.status == "PENDING").scalar() or 0
    count_pending = db.query(func.count(Cheque.id))\
                      .filter(Cheque.status == "PENDING").scalar() or 0

    overdue = db.query(func.sum(Cheque.amount))\
                .filter(Cheque.status == "PENDING", Cheque.due_date < today).scalar() or 0
    overdue_count = db.query(func.count(Cheque.id))\
                      .filter(Cheque.status == "PENDING", Cheque.due_date < today).scalar() or 0

    due_7d = db.query(func.sum(Cheque.amount))\
               .filter(Cheque.status == "PENDING",
                       Cheque.due_date >= today,
                       Cheque.due_date <= today + timedelta(days=7)).scalar() or 0
    due_30d = db.query(func.sum(Cheque.amount))\
                .filter(Cheque.status == "PENDING",
                        Cheque.due_date >= today,
                        Cheque.due_date <= today + timedelta(days=30)).scalar() or 0

    next_cheque = db.query(Cheque)\
                    .filter(Cheque.status == "PENDING", Cheque.due_date >= today)\
                    .order_by(Cheque.due_date).first()

    by_supplier = db.query(
        Cheque.supplier,
        func.sum(Cheque.amount).label("total"),
        func.count(Cheque.id).label("count")
    ).filter(Cheque.status == "PENDING")\
     .group_by(Cheque.supplier)\
     .order_by(func.sum(Cheque.amount).desc()).limit(10).all()

    return {
        "total_pending": float(total_pending),
        "count_pending": count_pending,
        "overdue_amount": float(overdue),
        "overdue_count": overdue_count,
        "due_next_7_days": float(due_7d),
        "due_next_30_days": float(due_30d),
        "next_cheque": {
            "supplier": next_cheque.supplier,
            "amount": float(next_cheque.amount),
            "due_date": str(next_cheque.due_date),
            "cheque_no": next_cheque.cheque_no
        } if next_cheque else None,
        "top_suppliers": [
            {"supplier": r.supplier, "total": float(r.total), "cheques": r.count}
            for r in by_supplier
        ]
    }


@router.get("/calendar")
def get_cheque_calendar(
    months: int = Query(3, description="Number of months ahead to show"),
    db: Session = Depends(get_db)
):
    today = date.today()
    end = today + timedelta(days=months * 30)

    rows = db.query(Cheque)\
             .filter(Cheque.status == "PENDING",
                     Cheque.due_date >= today,
                     Cheque.due_date <= end)\
             .order_by(Cheque.due_date).all()

    grouped = {}
    for c in rows:
        key = str(c.due_date)
        if key not in grouped:
            grouped[key] = {"date": key, "total": 0, "cheques": []}
        grouped[key]["total"] += float(c.amount)
        grouped[key]["cheques"].append({
            "id": c.id,
            "cheque_no": c.cheque_no,
            "supplier": c.supplier,
            "amount": float(c.amount),
            "bank": c.bank
        })
    return sorted(grouped.values(), key=lambda x: x["date"])


@router.put("/{cheque_id}/clear")
def mark_cheque_cleared(cheque_id: int, db: Session = Depends(get_db)):
    c = db.query(Cheque).filter(Cheque.id == cheque_id).first()
    if not c:
        return {"error": "Cheque not found"}
    c.status = "CLEARED"
    db.commit()
    return {"message": f"Cheque {c.cheque_no} marked as CLEARED", "supplier": c.supplier, "amount": float(c.amount)}


@router.post("/", response_model=ChequeOut)
def add_cheque(cheque: ChequeCreate, db: Session = Depends(get_db)):
    db_cheque = Cheque(**cheque.model_dump())
    db.add(db_cheque)
    db.commit()
    db.refresh(db_cheque)
    return db_cheque
