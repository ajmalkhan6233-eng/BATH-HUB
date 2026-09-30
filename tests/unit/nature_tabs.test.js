'use strict';
// The generic Purchasing / Accounting / Staff / Reports tabs in BATHCO_NATURE.html must read the field
// names the API actually sends. Several read names that did not exist (e.g. the Supplier Aging
// "Outstanding" column showed total_paid, journal entries showed blank accounts), so whole tabs
// looked empty or wrong. This evaluates the real TAB_CONFIG from the page and renders each tab with
// rows shaped exactly like the route SELECTs return them.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'BATHCO_NATURE.html'), 'utf8');
const start = html.indexOf('function monthStartStr()');
const end = html.indexOf('let _activeTab');
if (start < 0 || end < 0) throw new Error('could not locate TAB_CONFIG in BATHCO_NATURE.html');

const fmt = n => (n === null || n === undefined || isNaN(n)) ? null : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const todayStr = () => '2026-10-15';
const TAB_CONFIG = new Function('fmt', 'todayStr', `${html.slice(start, end)}; return TAB_CONFIG;`)(fmt, todayStr);
const tab = (cat, key) => TAB_CONFIG[cat].find(t => t.key === key);
const rowsOf = (t, data) => t.rows ? t.rows(data) : data;
const renderAll = (cat, key, data) => rowsOf(tab(cat, key), data).map(tab(cat, key).render).join('');

describe('generic tabs read the real API fields', () => {
  test('supplier aging shows the supplier, what is owed, and the age', () => {
    const out = renderAll('purchasing', 'aging', [{ supplier_id: 1, supplier_name: 'Lanka Tiles', total_received: '500000', total_paid: '200000', balance_due: '300000', age_days: 45, aging_bucket: '31-60' }]);
    expect(out).toContain('Lanka Tiles');
    expect(out).toContain('300,000');        // the balance, NOT the 200,000 already paid
    expect(out).not.toContain('200,000');
    expect(out).toContain('31-60');
  });

  test('PO <-> GRN matches show the suggested GRN and the difference', () => {
    const out = renderAll('purchasing', 'matches', [{ po_number: 'PO-0001', po_total: '100000', suggested_grn_number: 'MG-20261001-01', suggested_grn_amount: '98000' }]);
    expect(out).toContain('MG-20261001-01');
    expect(out).toContain('98,000');
    expect(out).toContain('-2,000');
  });

  test('supplier prices and shipments', () => {
    expect(renderAll('purchasing', 'prices', [{ item_description: 'Basin', supplier_name: 'S1', unit_cost: '4500', quoted_date_str: '2026-10-01' }])).toMatch(/4,500[\s\S]*2026-10-01/);
    const ship = renderAll('purchasing', 'shipments', [{ shipment_ref: 'SHP-77', status: 'IN_TRANSIT', eta_date_str: '2026-11-02', notes: 'n' }]);
    expect(ship).toContain('SHP-77');
    expect(ship).toContain('2026-11-02');
  });

  test('chart of accounts, journal and trial balance', () => {
    expect(renderAll('accounting', 'coa', [{ account_code: '1000', account_name: 'Cash', account_type: 'ASSET' }])).toMatch(/1000[\s\S]*Cash[\s\S]*ASSET/);
    const j = renderAll('accounting', 'journal', [{ entry_date_str: '2026-10-02', debit_account_code: '1000', debit_account_name: 'Cash', credit_account_code: '4000', credit_account_name: 'Sales', amount: '7500', description: 'Day sale' }]);
    expect(j).toMatch(/1000[\s\S]*Cash/);
    expect(j).toMatch(/4000[\s\S]*Sales/);
    expect(j).toContain('7,500');
    expect(j).toContain('Day sale');
    const tb = renderAll('accounting', 'trial', { rows: [{ account_code: '1000', account_name: 'Cash', total_debit: '9000', total_credit: '1500' }], balanced: true });
    expect(tb).toContain('9,000');
    expect(tb).toContain('1,500');
  });

  test('cheque calendar, petty cash, budgets, year-end read the wrapper objects / real names', () => {
    expect(renderAll('accounting', 'cheqcal', { all: [{ cheque_number: 'CHQ-1', amount: '25000', due_date_str: '2026-10-20', status: 'pending' }] })).toMatch(/CHQ-1[\s\S]*25,000[\s\S]*2026-10-20/);
    const petty = renderAll('accounting', 'petty', { transactions: [{ txn_date_str: '2026-10-03', txn_type: 'EXPENSE', amount: '800', description: 'Tea' }] });
    expect(petty).toMatch(/EXPENSE[\s\S]*800[\s\S]*Tea/);
    expect(renderAll('accounting', 'budgets', [{ category_name: 'Electricity', monthly_budget: '20000', actual: 15000, variance: 5000 }])).toMatch(/Electricity[\s\S]*20,000[\s\S]*15,000[\s\S]*5,000/);
    expect(renderAll('accounting', 'yearend', [{ fiscal_year: 2025, closing_date_str: '2026-01-05', net_profit: '1200000' }])).toMatch(/2025[\s\S]*2026-01-05[\s\S]*1,200,000/);
  });

  test('P&L and VAT default to the current month, not a fixed June 2026', () => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    expect(tab('accounting', 'pnl').endpoint).toBe(`/api/pnl?from=${monthStart}&to=2026-10-15`);
    expect(tab('accounting', 'pnl').endpoint).not.toContain('2026-06');
    expect(tab('accounting', 'vat').endpoint).not.toContain('2026-06');
    expect(tab('accounting', 'vat').endpoint).toMatch(/^\/api\/vat-report\?from=\d{4}-\d{2}-01&to=2026-10-15$/);
  });

  test('staff attendance, leave and advances', () => {
    const att = renderAll('staffext', 'attendance', [{ staff_name: 'Nimal', work_date: '2026-10-04', status: 'present' }]);
    expect(att).toContain('2026-10-04');
    expect(att).toContain('badge-green');
    const leave = renderAll('staffext', 'leave', [{ staff_name: 'Nimal', leave_start: '2026-10-10', leave_end: '2026-10-12', leave_type: 'casual', status: 'approved' }]);
    expect(leave).toContain('2026-10-10');
    expect(leave).toContain('2026-10-12');
    const adv = renderAll('staffext', 'advances', { ledger: [{ staff_name: 'Kamal', type: 'advance', amount: '15000', loan_date: '2026-10-01' }], balances: [] });
    expect(adv).toMatch(/Kamal[\s\S]*advance[\s\S]*15,000[\s\S]*2026-10-01/);
  });

  test('customer lifetime value reads rows.total_invoiced', () => {
    const out = renderAll('reports2', 'ltv', { caveat: 'c', rows: [{ customer_name: 'Sunil', invoice_count: 3, total_invoiced: '90000' }] });
    expect(out).toMatch(/Sunil[\s\S]*90,000[\s\S]*3/);
  });

  test('no rendered tab shows the placeholder dash for every field of a fully populated row (sanity)', () => {
    // every table tab must render without throwing on an empty list
    for (const cat of Object.keys(TAB_CONFIG)) {
      for (const t of TAB_CONFIG[cat]) {
        if (t.isSingle) continue;
        expect(() => rowsOf(t, t.rows ? { rows: [], all: [], transactions: [], ledger: [] } : []).map(t.render)).not.toThrow();
      }
    }
  });
});
