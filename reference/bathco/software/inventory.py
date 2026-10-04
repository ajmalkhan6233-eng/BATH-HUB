from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import Product, SalesTransaction

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/summary")
def get_inventory_summary(db: Session = Depends(get_db)):
    totals = db.query(
        func.count(Product.id).label("total_skus"),
        func.sum(Product.stock_qty).label("total_units"),
        func.sum(Product.stock_value).label("total_value")
    ).filter(Product.is_active == True).first()

    by_category = db.query(
        Product.category,
        func.count(Product.id).label("skus"),
        func.sum(Product.stock_qty).label("units"),
        func.sum(Product.stock_value).label("value")
    ).filter(Product.is_active == True)\
     .group_by(Product.category)\
     .order_by(func.sum(Product.stock_value).desc()).all()

    low_gp = db.query(func.count(Product.id)).filter(
        Product.is_active == True,
        Product.selling_price > 0,
        ((Product.selling_price - Product.cost_price) / Product.selling_price * 100) < 15
    ).scalar() or 0

    return {
        "total_skus": int(totals.total_skus or 0),
        "total_units": float(totals.total_units or 0),
        "total_value_at_selling_price": float(totals.total_value or 0),
        "low_gp_products_count": low_gp,
        "by_category": [
            {
                "category": r.category or "UNCATEGORISED",
                "skus": r.skus,
                "units": float(r.units or 0),
                "value": float(r.value or 0)
            }
            for r in by_category
        ]
    }


@router.get("/slow-movers")
def get_slow_movers(
    days: int = Query(90, description="No sales in this many days = slow mover"),
    db: Session = Depends(get_db)
):
    from datetime import date, timedelta
    from sqlalchemy import not_, exists

    cutoff = date.today() - timedelta(days=days)

    sold_codes = db.query(SalesTransaction.product_code)\
                   .filter(SalesTransaction.sale_date >= cutoff)\
                   .distinct().subquery()

    slow = db.query(Product).filter(
        Product.is_active == True,
        Product.stock_qty > 0,
        ~Product.code.in_(db.query(sold_codes.c.product_code))
    ).order_by(Product.stock_value.desc()).all()

    return [
        {
            "code": p.code,
            "name": p.name,
            "category": p.category,
            "stock_qty": float(p.stock_qty),
            "selling_price": float(p.selling_price),
            "stock_value": float(p.stock_value),
            "days_threshold": days
        }
        for p in slow
    ]


@router.get("/low-gp")
def get_low_gp_stock(
    threshold: float = Query(15.0),
    db: Session = Depends(get_db)
):
    products = db.query(Product).filter(
        Product.is_active == True,
        Product.selling_price > 0
    ).all()

    result = []
    for p in products:
        if p.selling_price > 0:
            gp = ((p.selling_price - p.cost_price) / p.selling_price) * 100
            if gp < threshold:
                result.append({
                    "code": p.code,
                    "name": p.name,
                    "category": p.category,
                    "cost_price": float(p.cost_price),
                    "selling_price": float(p.selling_price),
                    "gp_percent": round(float(gp), 1),
                    "stock_qty": float(p.stock_qty),
                    "stock_value": float(p.stock_value),
                    "alert": "BELOW COST" if gp < 0 else ("CRITICAL" if gp < 5 else "LOW GP")
                })
    result.sort(key=lambda x: x["gp_percent"])
    return result


@router.get("/products")
def get_products(
    category: str = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(Product).filter(Product.is_active == True)
    if category:
        q = q.filter(Product.category.ilike(f"%{category}%"))
    if search:
        q = q.filter(
            (Product.code.ilike(f"%{search}%")) |
            (Product.name.ilike(f"%{search}%"))
        )
    return q.order_by(Product.category, Product.name).limit(500).all()
