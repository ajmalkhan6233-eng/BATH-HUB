'use strict';
// BUGS2 B01: PATCH /api/cheques/:id/status used to set a column (updated_at) the real cheques table does not have, so "Mark cleared"
// on the Cheques screen always failed with a 500. These tests run the REAL server route against an in-memory database whose money tables
// have the exact columns of the real database (taken from a backup dump), and prove the fix changes the cheque's status and nothing else.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('bcryptjs', () => ({ ...jest.requireActual('bcryptjs'), compare: jest.fn().mockResolvedValue(true) }));
jest.mock('../../layla', () => {
  const { Pool } = require('pg');                                   // pg is the in-memory one here
  return { pool: new Pool(), processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn() };
});

const request = require('supertest');
const pg = require('pg');
const db = pg.__db.public;

// real column lists of the money tables (from the live schema; ids simplified to SERIAL)
const MONEY_TABLES = [
  ["cheques", "id SERIAL PRIMARY KEY, customer_id integer, amount numeric DEFAULT 0, due_date date, bank text, cheque_no text, cheque_number text, status text DEFAULT 'pending', notes text, created_at timestamp with time zone DEFAULT now(), payee character varying(150)"],
  ["cheque_register", "id SERIAL PRIMARY KEY, cheque_no character varying(50), bank character varying(100), payee character varying(150), amount numeric(12,2), due_date date, status character varying(20) DEFAULT 'pending', notes text, created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP, updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP, account_id integer, held_from_date date"],
  ["bank_accounts", "id SERIAL PRIMARY KEY, account_label character varying(100), bank character varying(100), current_balance numeric(14,2) DEFAULT 0, active boolean DEFAULT true, updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP"],
  ["acc_bank_transactions", "id SERIAL PRIMARY KEY, txn_date date, description text, amount numeric DEFAULT 0, txn_type text, bank_name text, notes text, matched boolean DEFAULT false, matched_ref text"],
  ["daily_summary", "id SERIAL PRIMARY KEY, report_date date, total_sale numeric DEFAULT 0, cash_sale numeric DEFAULT 0, card_sale numeric DEFAULT 0, online_sale numeric DEFAULT 0, credit_sale numeric DEFAULT 0, cheq_payment numeric DEFAULT 0, cash_received numeric DEFAULT 0, cash_in numeric DEFAULT 0, cash_out numeric DEFAULT 0, cash_in_hand numeric DEFAULT 0, total_expenses numeric DEFAULT 0, payments numeric DEFAULT 0, salary numeric DEFAULT 0, gross_profit numeric DEFAULT 0, net_profit numeric DEFAULT 0, gp_status text DEFAULT 'NOT_AVAILABLE', day_status text DEFAULT 'ESTIMATED', lasersoft_total numeric DEFAULT 0, manual_sale_total numeric DEFAULT 0, manual_gp_estimate numeric DEFAULT 0, gp_blend_note text, sales_source text, expenses_source text, source text, sales_conflict boolean DEFAULT false, sales_conflict_excel numeric, checker_flags jsonb DEFAULT '[]', details jsonb DEFAULT '{}', photo_data jsonb, notes text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), invoice_seq_start text, invoice_seq_end text, override_log jsonb DEFAULT '[]'"],
  ["supplier_payments", "id SERIAL PRIMARY KEY, supplier_id integer, amount numeric DEFAULT 0, pay_date date, method text, notes text"],
  ["investor_loans", "id SERIAL PRIMARY KEY, lender_name character varying(150), amount numeric(12,2), profit_rate numeric(5,2) DEFAULT 0, date_given date, due_date date, status character varying(20) DEFAULT 'active', notes text, created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP, updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP, qr_outstanding numeric(12,2) DEFAULT 0"],
  ["investor_loan_payments", "id SERIAL PRIMARY KEY, loan_id integer, amount numeric(12,2), payment_date date, notes text, created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP"],
  ["money_allocations", "id SERIAL PRIMARY KEY, label character varying(150), category character varying(30), amount numeric(12,2), planned_date date, status character varying(20) DEFAULT 'planned', notes text, created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP"],
  ["pos_bills", "id SERIAL PRIMARY KEY, bill_number character varying(30), customer_name character varying(150), customer_phone character varying(30), subtotal numeric(12,2), discount_pct numeric(5,2) DEFAULT 0, discount_amount numeric(12,2) DEFAULT 0, total numeric(12,2), payment_method character varying(30) DEFAULT 'cash', notes text, created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP, discount_override boolean DEFAULT false, source character varying(20) DEFAULT 'pos', attachment_path text"],
  ["sale_commissions", "id SERIAL PRIMARY KEY, staff_id integer, entry_type character varying(20), sale_date date, amount numeric(12,2), commission_pct numeric(5,2) DEFAULT 0, commission_amount numeric(12,2), linked_sale_id integer, reference_note text, notes text, created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP"],
  ["staff_loans", "id SERIAL PRIMARY KEY, staff_id integer, loan_date date, amount numeric, repaid numeric DEFAULT 0, type text DEFAULT 'loan', notes text"],
  ["expenses_detail", "id SERIAL PRIMARY KEY, report_date date, category text, description text, amount numeric DEFAULT 0, created_at timestamp with time zone DEFAULT now()"],
  ["daily_payment_breakdown", "id SERIAL PRIMARY KEY, report_date date, mode character varying(30), amount numeric(12,2) DEFAULT 0"],
  ["acc_petty_cash_txns", "id SERIAL PRIMARY KEY, txn_date date, txn_type text, amount numeric DEFAULT 0, description text, category text"],
];
for (const [name, cols] of MONEY_TABLES) db.none(`CREATE TABLE ${name} (${cols})`);
db.none(`CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT, name TEXT, password_hash TEXT, role TEXT, staff_id INT, active BOOLEAN DEFAULT true, totp_enabled BOOLEAN DEFAULT false, totp_secret TEXT)`);
db.none(`INSERT INTO users (username, name, role, password_hash) VALUES ('admin1', 'Admin', 'admin', 'x'), ('staff1', 'Staff', 'staff', 'x')`);

const app = require('../../server');   // after the tables exist: the route files only CREATE TABLE IF NOT EXISTS

const snapshot = skip => Object.fromEntries(MONEY_TABLES.map(([n]) => n).filter(n => n !== skip).map(n => [n, JSON.stringify(db.many(`SELECT * FROM ${n} ORDER BY id`))]));
let agent, ids;

beforeAll(async () => {
  db.none(`INSERT INTO bank_accounts (account_label, bank, current_balance) VALUES ('Main', 'BOC', 250000.00), ('Second', 'Sampath', 40000.00)`);
  db.none(`INSERT INTO cheque_register (cheque_no, bank, payee, amount, due_date, status) VALUES ('C100', 'BOC', 'Supplier A', 15000, '2026-10-10', 'pending'), ('C101', 'BOC', 'Supplier B', 22000, '2026-10-12', 'held')`);
  db.none(`INSERT INTO cheques (customer_id, amount, due_date, bank, cheque_no, status) VALUES (1, 50000, '2026-10-05', 'BOC', 'CH-1', 'pending'), (1, 30000, '2026-10-06', 'BOC', 'CH-2', 'pending'), (2, 12500, '2026-10-07', 'Sampath', 'CH-3', 'bounced')`);
  db.none(`INSERT INTO daily_summary (report_date, total_sale, cash_sale) VALUES ('2026-10-03', 120000, 80000)`);
  db.none(`INSERT INTO supplier_payments (supplier_id, amount, pay_date, method) VALUES (1, 5000, '2026-10-02', 'cash')`);
  db.none(`INSERT INTO acc_bank_transactions (txn_date, description, amount, txn_type) VALUES ('2026-10-01', 'deposit', 9000, 'credit')`);
  db.none(`INSERT INTO investor_loans (lender_name, amount, profit_rate, date_given) VALUES ('Uncle', 100000, 10, '2026-09-01')`);
  db.none(`INSERT INTO money_allocations (label, category, amount) VALUES ('Rent', 'fixed', 60000)`);
  ids = db.many(`SELECT id FROM cheques ORDER BY id`).map(r => r.id);
  agent = request.agent(app);
  await agent.post('/api/login').send({ username: 'admin1', password: 'pass' }).expect(200);
});

const clear = id => agent.patch(`/api/cheques/${id}/status`).send({ status: 'cleared' });

describe('PATCH /api/cheques/:id/status (B01)', () => {
  test('the real cheques table has no updated_at column (this is why the old query failed)', () => {
    expect(Object.keys(db.many(`SELECT * FROM cheques LIMIT 1`)[0])).not.toContain('updated_at');
  });

  test('marking a cheque cleared works: 200, the row comes back cleared', async () => {
    const r = await clear(ids[0]);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: ids[0], status: 'cleared', cheque_no: 'CH-1' });
    expect(Number(r.body.amount)).toBe(50000);
    expect(db.one(`SELECT status FROM cheques WHERE id = ${ids[0]}`).status).toBe('cleared');
  });

  test('only that cheque changes: the other cheques and every other money table are the same', async () => {
    const before = snapshot('cheques'), othersBefore = JSON.stringify(db.many(`SELECT * FROM cheques WHERE id <> ${ids[1]} ORDER BY id`));
    const r = await clear(ids[1]);
    expect(r.status).toBe(200);
    expect(snapshot('cheques')).toEqual(before);                                  // bank balances, cheque register, daily summary, loans ... untouched
    expect(JSON.stringify(db.many(`SELECT * FROM cheques WHERE id <> ${ids[1]} ORDER BY id`))).toBe(othersBefore);
    expect(db.one(`SELECT status FROM cheques WHERE id = ${ids[1]}`).status).toBe('cleared');
  });

  test('bank balances and the cheque register change by exactly 0 (this route only sets the status; it never moves money)', () => {
    expect(db.many(`SELECT current_balance FROM bank_accounts ORDER BY id`).map(r => Number(r.current_balance))).toEqual([250000, 40000]);
    expect(db.many(`SELECT cheque_no, status, amount FROM cheque_register ORDER BY id`).map(r => [r.cheque_no, r.status, Number(r.amount)])).toEqual([['C100', 'pending', 15000], ['C101', 'held', 22000]]);
  });

  test('doing it twice is safe: same answer, nothing counted twice, nothing else moves', async () => {
    const before = snapshot(null);
    const again = await clear(ids[0]);
    const third = await clear(ids[0]);
    expect(again.status).toBe(200); expect(third.status).toBe(200);
    expect(again.body.status).toBe('cleared'); expect(third.body).toEqual(again.body);
    expect(snapshot(null)).toEqual(before);                                       // the whole money picture is identical after repeats
    expect(Number(db.one(`SELECT COUNT(*) AS n FROM cheques WHERE status = 'cleared'`).n)).toBe(2);
  });

  test('other statuses still work, an unknown cheque is 404, and it needs a login', async () => {
    expect((await agent.patch(`/api/cheques/${ids[2]}/status`).send({ status: 'pending' })).body.status).toBe('pending');
    expect((await agent.patch('/api/cheques/99999/status').send({ status: 'cleared' })).status).toBe(404);
    expect((await request(app).patch(`/api/cheques/${ids[0]}/status`).send({ status: 'cleared' })).status).toBe(401);
  });
});
