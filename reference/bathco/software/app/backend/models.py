from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, Text, Numeric
from sqlalchemy.sql import func
from database import Base


class DailySales(Base):
    __tablename__ = "daily_sales"

    id = Column(Integer, primary_key=True, index=True)
    sale_date = Column(Date, unique=True, index=True, nullable=False)
    total_sales = Column(Numeric(15, 2), default=0)
    transactions = Column(Integer, default=0)
    cash = Column(Numeric(15, 2), default=0)
    card = Column(Numeric(15, 2), default=0)
    online = Column(Numeric(15, 2), default=0)
    cheque = Column(Numeric(15, 2), default=0)
    credit = Column(Numeric(15, 2), default=0)
    source_file = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100))
    cost_price = Column(Numeric(12, 2), default=0)
    selling_price = Column(Numeric(12, 2), default=0)
    stock_qty = Column(Numeric(12, 2), default=0)
    stock_value = Column(Numeric(15, 2), default=0)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def gp_percent(self):
        if self.selling_price and self.selling_price > 0:
            return round(((self.selling_price - self.cost_price) / self.selling_price) * 100, 1)
        return 0


class SalesTransaction(Base):
    __tablename__ = "sales_transactions"

    id = Column(Integer, primary_key=True, index=True)
    sale_date = Column(Date, index=True, nullable=False)
    invoice_no = Column(String(50))
    customer = Column(String(255))
    product_code = Column(String(50), index=True)
    product_name = Column(String(255))
    category = Column(String(100))
    qty = Column(Numeric(12, 2), default=0)
    unit_price = Column(Numeric(12, 2), default=0)
    cost_price = Column(Numeric(12, 2), default=0)
    total_amount = Column(Numeric(15, 2), default=0)
    total_cost = Column(Numeric(15, 2), default=0)
    gross_profit = Column(Numeric(15, 2), default=0)
    gp_percent = Column(Numeric(6, 2), default=0)
    source_file = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())


class Cheque(Base):
    __tablename__ = "cheques"

    id = Column(Integer, primary_key=True, index=True)
    cheque_no = Column(String(50), index=True)
    supplier = Column(String(255), nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    issue_date = Column(Date)
    due_date = Column(Date, index=True)
    status = Column(String(50), default="PENDING")  # PENDING, CLEARED, CANCELLED
    bank = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    contact_person = Column(String(255))
    phone = Column(String(50))
    total_purchased = Column(Numeric(15, 2), default=0)
    total_pending_cheques = Column(Numeric(15, 2), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class ImportLog(Base):
    __tablename__ = "import_log"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    import_type = Column(String(50))  # DAILY_SALES, TRANSACTIONS, CHEQUES, STOCK
    records_imported = Column(Integer, default=0)
    status = Column(String(50), default="OK")
    error_message = Column(Text)
    imported_at = Column(DateTime, server_default=func.now())
