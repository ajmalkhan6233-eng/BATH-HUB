from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date, timedelta
from decimal import Decimal
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import DailySales, SalesTransaction
from schemas import DailySalesOut, SalesSummary

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.get("/daily", response_model=list[DailySalesOut])
def get_daily_sales(
    days: int = Query(30, description="Number of days to return"),
    db: Session = Depends(get_db)
):
    cutoff = date.today() - timedelta(days=days)
    return db.query(DailySales).filter(DailySales.sale_date >= cutoff)\
             .order_by(DailySales.sale_date.desc()).all()


@router.get("/summary")
def get_sales_summary(
    month: int = Query(None),
    year: int = Query(None),
    db: Session = Depends(get_db)
):
    today = date.today()
    m = month or today.month
    y = year or today.year

    rows = db.query(
        func.sum(SalesTransaction.total_amount).label("revenue"),
        func.sum(SalesTransaction.total_cost).label("cost"),
        func.sum(SalesTransaction.gross_profit).label("gp"),
        func.count(SalesTransaction.id).label("txn")
    ).filter(
        extract('month', SalesTransaction.sale_date) == m,
        extract('year',  SalesTransaction.sale_date) == y
    ).first()

    revenue = float(rows.revenue or 0)
    cost    = float(rows.cost or 0)
    gp      = float(rows.gp or 0)
    txn     = int(rows.txn or 0)
    days_in_month = db.query(func.count(func.distinct(SalesTransaction.sale_date)))\
                      .filter(
                          extract('month', SalesTransaction.sale_date) == m,
                          extract('year',  SalesTransaction.sale_date) == y
                      ).scalar() or 1

    return {
        "month": m, "year": y,
        "total_sales": round(revenue, 2),
        "total_cost": round(cost, 2),
        "gross_profit": round(gp, 2),
        "gp_percent": round((gp / revenue * 100) if revenue > 0 else 0, 1),
        "transactions": txn,
        "avg_daily_sales": round(revenue / days_in_month, 2),
        "days_with_sales": days_in_month
    }


@router.get("/monthly-breakdown")
def get_monthly_breakdown(db: Session = Depends(get_db)):
    rows = db.query(
        extract('year',  SalesTransaction.sale_date).label("year"),
        extract('month', SalesTransaction.sale_date).label("month"),
        func.sum(SalesTransaction.total_amount).label("revenue"),
        func.sum(SalesTransaction.total_cost).label("cost"),
        func.sum(SalesTransaction.gross_profit).label("gp"),
        func.count(SalesTransaction.id).label("txn")
    ).group_by("year", "month").order_by("year", "month").all()

    months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    result = []
    for r in rows:
        rev = float(r.revenue or 0)
        gp  = float(r.gp or 0)
        result.append({
            "label": f"{months[int(r.month)]} {int(r.year)}",
            "revenue": round(rev, 2),
            "cost": round(float(r.cost or 0), 2),
            "gross_profit": round(gp, 2),
            "gp_percent": round((gp / rev * 100) if rev > 0 else 0, 1),
            "transactions": int(r.txn or 0)
        })
    return result


@router.get("/top-products")
def get_top_products(
    limit: int = Query(10),
    month: int = Query(None),
    year: int = Query(None),
    db: Session = Depends(get_db)
):
    today = date.today()
    m = month or today.month
    y = year or today.year

    rows = db.query(
        SalesTransaction.product_code,
        SalesTransaction.product_name,
        SalesTransaction.category,
        func.sum(SalesTransaction.total_amount).label("revenue"),
        func.sum(SalesTransaction.gross_profit).label("gp"),
        func.sum(SalesTransaction.qty).label("units")
    ).filter(
        extract('month', SalesTransaction.sale_date) == m,
        extract('year',  SalesTransaction.sale_date) == y
    ).group_by(
        SalesTransaction.product_code,
        SalesTransaction.product_name,
        SalesTransaction.category
    ).order_by(func.sum(SalesTransaction.total_amount).desc()).limit(limit).all()

    result = []
    for r in rows:
        rev = float(r.revenue or 0)
        gp  = float(r.gp or 0)
        result.append({
            "code": r.product_code,
            "name": r.product_name,
            "category": r.category,
            "revenue": round(rev, 2),
            "gross_profit": round(gp, 2),
            "gp_percent": round((gp / rev * 100) if rev > 0 else 0, 1),
            "units_sold": round(float(r.units or 0), 1)
        })
    return result


@router.get("/low-gp-products")
def get_low_gp_products(
    threshold: float = Query(15.0),
    db: Session = Depends(get_db)
):
    rows = db.query(
        SalesTransaction.product_code,
        SalesTransaction.product_name,
        SalesTransaction.category,
        func.sum(SalesTransaction.total_amount).label("revenue"),
        func.sum(SalesTransaction.gross_profit).label("gp"),
        func.sum(SalesTransaction.qty).label("units")
    ).group_by(
        SalesTransaction.product_code,
        SalesTransaction.product_name,
        SalesTransaction.category
    ).having(
        func.sum(SalesTransaction.total_amount) > 0
    ).all()

    result = []
    for r in rows:
        rev = float(r.revenue or 0)
        gp  = float(r.gp or 0)
        gp_pct = (gp / rev * 100) if rev > 0 else 0
        if gp_pct < threshold:
            result.append({
                "code": r.product_code,
                "name": r.product_name,
                "category": r.category,
                "revenue": round(rev, 2),
                "gross_profit": round(gp, 2),
                "gp_percent": round(gp_pct, 1),
                "units_sold": round(float(r.units or 0), 1),
                "alert": "BELOW COST" if gp_pct < 0 else ("CRITICAL" if gp_pct < 5 else "LOW GP")
            })

    result.sort(key=lambda x: x["gp_percent"])
    return result
