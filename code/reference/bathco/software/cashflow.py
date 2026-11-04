from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date, timedelta
from calendar import monthrange
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import Cheque, DailySales

router = APIRouter(prefix="/cashflow", tags=["Cash Flow"])


@router.get("/forecast")
def get_cashflow_forecast(
    months: int = Query(3, description="Months to forecast ahead"),
    db: Session = Depends(get_db)
):
    today = date.today()

    # Calculate average daily sales from last 30 days
    cutoff = today - timedelta(days=30)
    avg_result = db.query(func.avg(DailySales.total_sales))\
                   .filter(DailySales.sale_date >= cutoff).scalar()
    avg_daily = float(avg_result or 740000)  # fallback to known May avg

    forecast = []
    for m in range(months):
        # Calculate month offset
        month_offset = today.month + m
        year_offset = today.year + (month_offset - 1) // 12
        month_num = ((month_offset - 1) % 12) + 1
        days_in_month = monthrange(year_offset, month_num)[1]
        month_start = date(year_offset, month_num, 1)
        month_end = date(year_offset, month_num, days_in_month)

        # Pending cheques due this month
        cheques_due = db.query(func.sum(Cheque.amount))\
                        .filter(
                            Cheque.status == "PENDING",
                            Cheque.due_date >= month_start,
                            Cheque.due_date <= month_end
                        ).scalar() or 0

        cheques_count = db.query(func.count(Cheque.id))\
                          .filter(
                              Cheque.status == "PENDING",
                              Cheque.due_date >= month_start,
                              Cheque.due_date <= month_end
                          ).scalar() or 0

        # Actual sales if month is current/past
        actual_sales = db.query(func.sum(DailySales.total_sales))\
                         .filter(
                             DailySales.sale_date >= month_start,
                             DailySales.sale_date <= min(month_end, today)
                         ).scalar() or 0

        projected_sales = avg_daily * days_in_month
        net_position = projected_sales - float(cheques_due)

        months_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

        forecast.append({
            "month": f"{months_names[month_num]} {year_offset}",
            "month_start": str(month_start),
            "projected_sales": round(projected_sales, 0),
            "actual_sales_to_date": float(actual_sales),
            "cheques_due": float(cheques_due),
            "cheques_count": cheques_count,
            "net_position": round(net_position, 0),
            "status": "HEALTHY" if net_position > 2000000 else ("WATCH" if net_position > 0 else "TIGHT")
        })

    return {
        "avg_daily_sales_used": round(avg_daily, 0),
        "forecast": forecast,
        "total_cheques_in_period": sum(f["cheques_due"] for f in forecast),
        "total_projected_sales": sum(f["projected_sales"] for f in forecast)
    }


@router.get("/cheques-by-month")
def get_cheques_by_month(db: Session = Depends(get_db)):
    rows = db.query(
        extract('year',  Cheque.due_date).label("year"),
        extract('month', Cheque.due_date).label("month"),
        func.sum(Cheque.amount).label("total"),
        func.count(Cheque.id).label("count")
    ).filter(Cheque.status == "PENDING")\
     .group_by("year", "month")\
     .order_by("year", "month").all()

    months_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [
        {
            "label": f"{months_names[int(r.month)]} {int(r.year)}",
            "amount": float(r.total or 0),
            "count": int(r.count or 0)
        }
        for r in rows
    ]
