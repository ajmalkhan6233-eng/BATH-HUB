-- RBH AI CHANGE GUARD, step 1: change log + no-delete lock for the AI database users.
-- Run ONCE as a database administrator (install.js does it). Safe to run again. No passwords in this file.
-- Works on the REAL tables of the app: a trigger is made only for tables that exist. It logs the whole row as JSON, so extra columns never break it.
CREATE SCHEMA IF NOT EXISTS guard;
CREATE TABLE IF NOT EXISTS guard.change_log (
  id          BIGSERIAL PRIMARY KEY,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       TEXT NOT NULL,          -- ai_chat / ai_pc are the real database login; anything else = owner/staff/app
  task_number TEXT,                   -- set by guarded_task.js (PGOPTIONS -c guard.task=N)
  table_name  TEXT NOT NULL,
  row_id      TEXT,
  operation   TEXT NOT NULL,          -- INSERT / UPDATE / DELETE
  before_json JSONB,
  after_json  JSONB
);
CREATE INDEX IF NOT EXISTS change_log_task_idx ON guard.change_log (task_number);
CREATE INDEX IF NOT EXISTS change_log_tbl_idx  ON guard.change_log (table_name, row_id);

-- the log can never be edited, deleted or emptied (not even by the owner, short of dropping the trigger as administrator)
CREATE OR REPLACE FUNCTION guard.no_edit() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN RAISE EXCEPTION 'guard.change_log is append-only'; END $f$;
DROP TRIGGER IF EXISTS change_log_no_edit ON guard.change_log;
CREATE TRIGGER change_log_no_edit BEFORE UPDATE OR DELETE ON guard.change_log FOR EACH ROW EXECUTE FUNCTION guard.no_edit();
DROP TRIGGER IF EXISTS change_log_no_truncate ON guard.change_log;
CREATE TRIGGER change_log_no_truncate BEFORE TRUNCATE ON guard.change_log FOR EACH STATEMENT EXECUTE FUNCTION guard.no_edit();

-- one trigger function for every protected table. SECURITY DEFINER so the AI users can cause a log line without being able to touch the log.
CREATE OR REPLACE FUNCTION guard.capture_row_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = guard, pg_catalog AS $f$
DECLARE who text; rid text; j_old jsonb; j_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN j_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN j_old := to_jsonb(OLD); j_new := to_jsonb(NEW); IF j_old = j_new THEN RETURN NEW; END IF;
  ELSE j_old := to_jsonb(OLD); END IF;
  -- the AI users cannot choose their own name: for them the actor is always the real login
  IF session_user IN ('ai_chat','ai_pc') THEN who := session_user;
  ELSE who := COALESCE(NULLIF(current_setting('guard.actor', true), ''), session_user); END IF;
  rid := COALESCE(COALESCE(j_new, j_old)->>'id', COALESCE(j_new, j_old)->>'item_code', COALESCE(j_new, j_old)->>'bill_id', COALESCE(j_new, j_old)->>'cheque_id');
  INSERT INTO guard.change_log (actor, task_number, table_name, row_id, operation, before_json, after_json)
  VALUES (who, NULLIF(current_setting('guard.task', true), ''), TG_TABLE_NAME, rid, TG_OP, j_old, j_new);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $f$;

-- attach to the money / stock / paper tables that exist in this database
DO $do$
DECLARE t text;
DECLARE tabs text[] := ARRAY['products','price_history','stock_movements','stock_adjustments','grn_records','grn_records_archive','grn_invoice_meta','grn_audit','grn_diff_reason',
  'suppliers','vendor_bills','vendor_payments','vendor_bill_cheques','vendor_credit_notes','vendor_return_lines','vendor_pending_items','cheque_register','cheque_deposits',
  'pos_bills','pos_bill_items','pos_bill_payments','pos_bill_voids','pos_bill_history','daily_summary','daily_payment_breakdown','daily_cash_plan','expenses_detail','fixed_overheads',
  'credit_customers','customers','customer_credit_limits','quotations','quotation_items','sale_commissions','acc_journal_entries','acc_petty_cash_txns','acc_bank_transactions',
  'money_audit_log','oversold_owed','pur_purchase_orders','pur_landed_costs','pur_shipments','pur_supplier_prices'];
BEGIN
  FOREACH t IN ARRAY tabs LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS guard_capture ON public.%I', t);
      EXECUTE format('CREATE TRIGGER guard_capture AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION guard.capture_row_change()', t);
    END IF;
  END LOOP;
END $do$;

-- the AI database users: can read, add and change, can NEVER delete or empty a table, cannot make or alter tables, cannot see the log
DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bathco_ai') THEN CREATE ROLE bathco_ai NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_chat')  THEN CREATE ROLE ai_chat LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_pc')    THEN CREATE ROLE ai_pc LOGIN; END IF;
END $do$;
GRANT bathco_ai TO ai_chat, ai_pc;
REVOKE ALL ON SCHEMA guard FROM PUBLIC, bathco_ai, ai_chat, ai_pc;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, bathco_ai, ai_chat, ai_pc;
GRANT USAGE ON SCHEMA public TO bathco_ai;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO bathco_ai;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO bathco_ai;
-- direct grants count too: take DELETE / TRUNCATE away from the group AND from each AI login separately
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM bathco_ai, ai_chat, ai_pc;
-- logins, sessions and keys are not the AI's business: read nothing, change nothing
DO $do$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename ~* '(user|login|session|token|password|secret|apikey|api_key)' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM bathco_ai, ai_chat, ai_pc', r.tablename);
  END LOOP;
END $do$;
