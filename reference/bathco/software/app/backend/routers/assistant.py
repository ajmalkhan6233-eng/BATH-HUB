from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date, timedelta
import os, sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import get_db
from models import DailySales, SalesTransaction, Cheque, Product
from schemas import AssistantRequest, AssistantResponse

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


def build_context(db: Session) -> str:
    today = date.today()
    m, y = today.month, today.year

    # Today sales
    today_row = db.query(DailySales).filter(DailySales.sale_date == today).first()
    today_sales = float(today_row.total_sales) if today_row else 0

    # This month
    month_q = db.query(
        func.sum(SalesTransaction.total_amount).label("rev"),
        func.sum(SalesTransaction.gross_profit).label("gp"),
        func.count(SalesTransaction.id).label("txn")
    ).filter(
        extract('month', SalesTransaction.sale_date) == m,
        extract('year',  SalesTransaction.sale_date) == y
    ).first()
    month_rev = float(month_q.rev or 0)
    month_gp  = float(month_q.gp  or 0)
    month_txn = int(month_q.txn   or 0)
    month_gp_pct = (month_gp / month_rev * 100) if month_rev > 0 else 0

    # Cheques
    pending_total = db.query(func.sum(Cheque.amount)).filter(Cheque.status == "PENDING").scalar() or 0
    pending_count = db.query(func.count(Cheque.id)).filter(Cheque.status == "PENDING").scalar() or 0
    overdue = db.query(func.sum(Cheque.amount)).filter(
        Cheque.status == "PENDING", Cheque.due_date < today
    ).scalar() or 0

    next_c = db.query(Cheque).filter(
        Cheque.status == "PENDING", Cheque.due_date >= today
    ).order_by(Cheque.due_date).first()

    # Stock
    stock_val = db.query(func.sum(Product.stock_value)).filter(Product.is_active == True).scalar() or 0
    stock_skus = db.query(func.count(Product.id)).filter(Product.is_active == True).scalar() or 0

    low_gp_count = 0
    for p in db.query(Product).filter(Product.is_active == True, Product.selling_price > 0).all():
        if p.selling_price > 0:
            gp = ((p.selling_price - p.cost_price) / p.selling_price) * 100
            if gp < 15:
                low_gp_count += 1

    ctx = f"""BATHCO LIVE DATA (as of {today}):

SALES TODAY: Rs. {today_sales:,.0f}
THIS MONTH ({today.strftime('%B %Y')}): Rs. {month_rev:,.0f} revenue | GP Rs. {month_gp:,.0f} ({month_gp_pct:.1f}%) | {month_txn} transactions

CHEQUES:
- Total pending: Rs. {float(pending_total):,.0f} ({int(pending_count)} cheques)
- Overdue: Rs. {float(overdue):,.0f}
- Next due: {f"{next_c.supplier} Rs. {float(next_c.amount):,.0f} on {next_c.due_date}" if next_c else "None"}

STOCK:
- Total SKUs: {int(stock_skus)}
- Stock value: Rs. {float(stock_val):,.0f}
- Products below 15% GP: {low_gp_count}

BUSINESS: 1st Choice Bathco (Pvt) Ltd, Thihariya, Sri Lanka. Owner: Ajmal Khan.
Opened 21 Dec 2025. Sells tiles, basins, commodes, taps, showers, cabinets, accessories.
GP ~18% is accepted Sri Lanka tile market reality."""
    return ctx


@router.post("/ask", response_model=AssistantResponse)
async def ask_assistant(request: AssistantRequest, db: Session = Depends(get_db)):
    try:
        import anthropic
        context = build_context(db)
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=f"""You are the AI business assistant for 1st Choice Bathco (Pvt) Ltd, Sri Lanka.
Answer Ajmal Khan's questions about his business using the live data provided.
Rules:
- Answer in plain English. No jargon.
- Give the exact Rs. number first, then explain.
- If something needs urgent action, say so directly.
- Be brief. One paragraph maximum unless the question needs detail.
- Use Rs. for all currency amounts.

{context}""",
            messages=[{"role": "user", "content": request.question}]
        )
        return AssistantResponse(
            answer=message.content[0].text,
            data_used=f"Live database data as of {date.today()}"
        )
    except Exception as e:
        return AssistantResponse(
            answer=f"Assistant error: {str(e)}. Check ANTHROPIC_API_KEY in .env file.",
            data_used=None
        )
