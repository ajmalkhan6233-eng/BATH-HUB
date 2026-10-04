from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal


class DailySalesBase(BaseModel):
    sale_date: date
    total_sales: Decimal = 0
    transactions: int = 0
    cash: Decimal = 0
    card: Decimal = 0
    online: Decimal = 0
    cheque: Decimal = 0
    credit: Decimal = 0

class DailySalesCreate(DailySalesBase):
    source_file: Optional[str] = None

class DailySalesOut(DailySalesBase):
    id: int
    source_file: Optional[str] = None
    class Config: from_attributes = True


class ProductOut(BaseModel):
    id: int
    code: str
    name: str
    category: Optional[str]
    cost_price: Decimal
    selling_price: Decimal
    stock_qty: Decimal
    stock_value: Decimal
    class Config: from_attributes = True


class ChequeBase(BaseModel):
    cheque_no: Optional[str]
    supplier: str
    amount: Decimal
    issue_date: Optional[date]
    due_date: Optional[date]
    status: str = "PENDING"
    bank: Optional[str]
    notes: Optional[str]

class ChequeCreate(ChequeBase): pass

class ChequeOut(ChequeBase):
    id: int
    class Config: from_attributes = True


class SalesSummary(BaseModel):
    period: str
    total_sales: Decimal
    total_cost: Decimal
    gross_profit: Decimal
    gp_percent: float
    transactions: int
    avg_daily_sales: Decimal


class DashboardSnapshot(BaseModel):
    today_sales: Decimal
    today_transactions: int
    month_sales: Decimal
    month_gp_percent: float
    pending_cheques_total: Decimal
    pending_cheques_count: int
    next_cheque_due: Optional[date]
    next_cheque_amount: Optional[Decimal]
    low_gp_products: int
    stock_value: Decimal


class AssistantRequest(BaseModel):
    question: str

class AssistantResponse(BaseModel):
    answer: str
    data_used: Optional[str] = None
