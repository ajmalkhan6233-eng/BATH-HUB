-- DEV / TEST ONLY. A reconstructed core schema for a throwaway database (e.g. bathco_test) so every screen of the app
-- loads without errors. It is rebuilt from what the code queries; it is NOT the live shop schema (that one is cloned
-- from a live database with scripts/create_instance.js). Safe to run repeatedly. Needs a UTF8 database.
-- Load with:  node scripts/dev/load_test_schema.js   (it refuses any database that is not a UTF8 "...test..." one)

CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', staff_id INT, active BOOLEAN NOT NULL DEFAULT TRUE, totp_secret TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS staff (id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT, role TEXT, base_salary NUMERIC DEFAULT 0,
  commission_pct NUMERIC DEFAULT 0, join_date DATE, active BOOLEAN DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS staff_salary (id SERIAL PRIMARY KEY, staff_id INT, pay_date DATE, amount NUMERIC DEFAULT 0, commission NUMERIC DEFAULT 0,
  period_start DATE, period_end DATE, notes TEXT);
CREATE TABLE IF NOT EXISTS staff_loans (id SERIAL PRIMARY KEY, staff_id INT, loan_date DATE, amount NUMERIC, repaid NUMERIC DEFAULT 0,
  type TEXT DEFAULT 'loan', notes TEXT);
CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT NOT NULL, category TEXT, stock_level NUMERIC DEFAULT 0,
  reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, whatsapp TEXT, location TEXT, source TEXT, notes TEXT,
  last_contact TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE customers ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contact TIMESTAMPTZ DEFAULT NOW();
CREATE TABLE IF NOT EXISTS conversations (id SERIAL PRIMARY KEY, customer_id INT, channel TEXT, agent TEXT, messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS suppliers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, category TEXT, notes TEXT, active BOOLEAN DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS supplier_payments (id SERIAL PRIMARY KEY, supplier_id INT, amount NUMERIC DEFAULT 0, pay_date DATE, method TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS login_audit (id SERIAL PRIMARY KEY, username TEXT, success BOOLEAN, ip TEXT, reason TEXT, attempted_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS feature_flags (id SERIAL PRIMARY KEY, module_key TEXT UNIQUE NOT NULL, category TEXT, label TEXT, description TEXT,
  is_core BOOLEAN DEFAULT FALSE, enabled BOOLEAN DEFAULT FALSE, built BOOLEAN DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS "session" (sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" (expire);

-- the heart of the system: one row per business day
CREATE TABLE IF NOT EXISTS daily_summary (
  id SERIAL PRIMARY KEY, report_date DATE UNIQUE NOT NULL,
  total_sale NUMERIC DEFAULT 0, cash_sale NUMERIC DEFAULT 0, card_sale NUMERIC DEFAULT 0, online_sale NUMERIC DEFAULT 0, credit_sale NUMERIC DEFAULT 0,
  cheq_payment NUMERIC DEFAULT 0, cash_received NUMERIC DEFAULT 0, cash_in NUMERIC DEFAULT 0, cash_out NUMERIC DEFAULT 0, cash_in_hand NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0, payments NUMERIC DEFAULT 0, salary NUMERIC DEFAULT 0,
  gross_profit NUMERIC DEFAULT 0, net_profit NUMERIC DEFAULT 0, gp_status TEXT DEFAULT 'NOT_AVAILABLE', day_status TEXT DEFAULT 'ESTIMATED',
  lasersoft_total NUMERIC DEFAULT 0, manual_sale_total NUMERIC DEFAULT 0, manual_gp_estimate NUMERIC DEFAULT 0, gp_blend_note TEXT,
  sales_source TEXT, expenses_source TEXT, source TEXT, sales_conflict BOOLEAN DEFAULT FALSE, sales_conflict_excel NUMERIC,
  checker_flags JSONB DEFAULT '[]', details JSONB DEFAULT '{}', photo_data JSONB, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS daily_reports (id SERIAL PRIMARY KEY, report_date DATE, invoice_no TEXT, total_sale NUMERIC DEFAULT 0, cash_amount NUMERIC DEFAULT 0,
  card_amount NUMERIC DEFAULT 0, online_amount NUMERIC DEFAULT 0, cheque_amount NUMERIC DEFAULT 0, credit_amount NUMERIC DEFAULT 0, is_refund BOOLEAN DEFAULT FALSE,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS expenses_detail (id SERIAL PRIMARY KEY, report_date DATE, category TEXT, description TEXT, amount NUMERIC DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS cheques (id SERIAL PRIMARY KEY, customer_id INT, amount NUMERIC DEFAULT 0, due_date DATE, bank TEXT, cheque_no TEXT, cheque_number TEXT,
  status TEXT DEFAULT 'pending', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS credit_customers (id SERIAL PRIMARY KEY, customer_id INT, name TEXT, invoice_date DATE, invoice_no TEXT, amount NUMERIC DEFAULT 0,
  paid NUMERIC DEFAULT 0, due_date DATE, notes TEXT, quarantined BOOLEAN DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS grn_records (id SERIAL PRIMARY KEY, grn_number TEXT, supplier_id INT, supplier_name TEXT, grn_date DATE, item_description TEXT,
  quantity NUMERIC, unit_cost NUMERIC, total_amount NUMERIC, source_file_path TEXT, status TEXT DEFAULT 'PENDING_REVIEW', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS quotations (id SERIAL PRIMARY KEY, customer_id INT, quote_date DATE, valid_until DATE, status TEXT DEFAULT 'draft', subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0, total NUMERIC DEFAULT 0, notes TEXT, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS quotation_items (id SERIAL PRIMARY KEY, quotation_id INT, product_id INT, item_code TEXT, description TEXT, qty NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0, line_total NUMERIC DEFAULT 0, sort_order INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS whatsapp_draft_entries (id SERIAL PRIMARY KEY, from_number TEXT, photo_path TEXT, report_date DATE, total_sale NUMERIC, cash_sale NUMERIC,
  card_sale NUMERIC, online_sale NUMERIC, credit_sale NUMERIC, total_expenses NUMERIC, expense_items TEXT, confidence TEXT, ocr_notes TEXT, ocr_raw JSONB,
  status TEXT DEFAULT 'PENDING_CONFIRM', confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());

-- purchasing
CREATE TABLE IF NOT EXISTS pur_purchase_orders (id SERIAL PRIMARY KEY, po_number TEXT UNIQUE, supplier_id INT, supplier_name TEXT, po_date DATE, expected_date DATE,
  total_amount NUMERIC DEFAULT 0, notes TEXT, status TEXT DEFAULT 'PENDING', linked_grn_id INT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS pur_supplier_prices (id SERIAL PRIMARY KEY, item_description TEXT, supplier_id INT, supplier_name TEXT, unit_cost NUMERIC, quoted_date DATE, notes TEXT);
CREATE TABLE IF NOT EXISTS pur_landed_costs (id SERIAL PRIMARY KEY, po_id INT, po_total NUMERIC DEFAULT 0, freight NUMERIC DEFAULT 0, duty NUMERIC DEFAULT 0,
  other_costs NUMERIC DEFAULT 0, total_landed_cost NUMERIC DEFAULT 0, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS pur_shipments (id SERIAL PRIMARY KEY, shipment_ref TEXT, supplier_id INT, supplier_name TEXT, po_id INT, origin_port TEXT, eta_date DATE,
  status TEXT DEFAULT 'ORDERED', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- accounting
CREATE TABLE IF NOT EXISTS acc_chart_of_accounts (account_code TEXT PRIMARY KEY, account_name TEXT, account_type TEXT, parent_code TEXT, active BOOLEAN DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS acc_journal_entries (id SERIAL PRIMARY KEY, entry_date DATE, description TEXT, debit_account_code TEXT, credit_account_code TEXT,
  amount NUMERIC DEFAULT 0, reference TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS acc_bank_transactions (id SERIAL PRIMARY KEY, txn_date DATE, description TEXT, amount NUMERIC DEFAULT 0, txn_type TEXT, bank_name TEXT,
  notes TEXT, matched BOOLEAN DEFAULT FALSE, matched_ref TEXT);
CREATE TABLE IF NOT EXISTS acc_petty_cash_txns (id SERIAL PRIMARY KEY, txn_date DATE, txn_type TEXT, amount NUMERIC DEFAULT 0, description TEXT, category TEXT);
CREATE TABLE IF NOT EXISTS acc_expense_categories (id SERIAL PRIMARY KEY, category_name TEXT UNIQUE, monthly_budget NUMERIC DEFAULT 0, notes TEXT);
CREATE TABLE IF NOT EXISTS acc_year_end_closings (id SERIAL PRIMARY KEY, fiscal_year INT, closing_date DATE DEFAULT CURRENT_DATE, total_revenue NUMERIC, total_expenses NUMERIC,
  net_profit NUMERIC, notes TEXT);
INSERT INTO acc_chart_of_accounts (account_code, account_name, account_type) VALUES
  ('1000','Cash','ASSET'),('1100','Bank','ASSET'),('1200','Stock','ASSET'),('2000','Suppliers payable','LIABILITY'),('3000','Owner equity','EQUITY'),
  ('4000','Sales','INCOME'),('5000','Cost of goods','EXPENSE'),('6000','Running expenses','EXPENSE')
ON CONFLICT (account_code) DO NOTHING;

-- late additions found by probing every screen
ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS invoice_seq_start TEXT;
ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS invoice_seq_end TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE TABLE IF NOT EXISTS alerts (id SERIAL PRIMARY KEY, type TEXT, message TEXT, priority TEXT DEFAULT 'normal', read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS audit_invoice_items (id SERIAL PRIMARY KEY, sale_date DATE, invoice_no TEXT, item_code TEXT, description TEXT, qty NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0, line_total NUMERIC DEFAULT 0, unit_cost NUMERIC, line_cogs NUMERIC, line_gp NUMERIC, cost_source TEXT);
