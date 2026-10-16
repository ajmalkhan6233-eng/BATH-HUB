const { newDb } = require('pg-mem');
const createBillSale = require('../../layla_owner/billSale');
const { normalizeSriLankaPhone } = require('../../utils/whatsappReceiptSender');
const { parseCaption, receiptText } = createBillSale;

const doc = (over = {}) => ({ document_type: 'manual_bill', items: [{ name: 'Basin', qty: 2, unit_price: 5000, amount: 10000 }, { name: 'Tap', qty: 1, unit_price: 2500, amount: 2500 }], total: 12500, ...over });
function setup({ live = true, sendFail = false, ocr = doc() } = {}) {
  const { Pool } = newDb().adapters.createPg(); const pool = new Pool();
  const sent = []; const made = [];
  const bill = { create: 0 };
  const api = createBillSale({
    pool, normalizePhone: normalizeSriLankaPhone, receiptsLive: () => live,
    readPaper: async () => ({ ok: true, doc: ocr }),
    sendCustomer: async (to, text) => { if (sendFail) throw new Error('not on WhatsApp'); sent.push({ to, text }); },
    createBill: async (p) => { made.push(p); const b = { id: ++bill.create, bill_number: 'B' + bill.create, customer_name: p.customer_name, customer_phone: p.customer_phone, total: p.payments[0].amount, payment_method: p.payments[0].method, discount_amount: 0, created_at: new Date(), items: p.items.map(i => ({ item_name: i.item_name, qty: i.qty, unit_price: i.unit_price, line_total: i.qty * i.unit_price })) }; return { ok: true, bill: b }; },
  });
  return { api, pool, sent, made };
}

test('caption: phone, payment word, name; nothing said = cash', () => {
  expect(parseCaption('bill')).toEqual({ phone: null, method: 'cash', name: '' });
  expect(parseCaption('bill 0771234567 credit Nimal')).toEqual({ phone: '0771234567', method: 'credit', name: 'Nimal' });
  expect(parseCaption('Bill +94 77 123 4567 card').phone).toBe('+94771234567');
});

test('clean reading + phone: draft shows the number back; "ok" makes the CASH sale and sends the text receipt', async () => {
  const { api, sent, made } = setup();
  const d = await api.start('bill', 'x.jpg', 'bill 0771234567');
  expect(made).toHaveLength(0); expect(sent).toHaveLength(0); expect(d.reply).toMatch(/Receipt will go to 077 123 4567[\s\S]*Reply: ok/);
  const r = await api.handleText('ok');
  expect(made).toHaveLength(1); expect(made[0].payments).toEqual([{ method: 'cash', amount: 12500, reference: undefined }]);
  expect(sent).toHaveLength(1); expect(sent[0].to).toBe('94771234567'); expect(sent[0].text).toMatch(/Basin[\s\S]*TOTAL: Rs\. 12,500\.00/);
  expect(r.reply).toMatch(/Sale B1 saved[\s\S]*Receipt sent/);
});
test('credit is taken when the caption says so', async () => {
  const { api, made } = setup();
  await api.start('bill', 'x.jpg', 'bill 0771234567 credit Nimal'); await api.handleText('ok');
  expect(made[0].payments[0].method).toBe('credit'); expect(made[0].customer_name).toBe('Nimal');
});
test('lines do not add up: nothing saved, draft waits for ok', async () => {
  const { api, made } = setup({ ocr: doc({ total: 13000 }) });
  const r = await api.start('bill', 'x.jpg', 'bill 0771234567');
  expect(made).toHaveLength(0); expect(r.reply).toMatch(/BILL DRAFT[\s\S]*add up/);
  const ok = await api.handleText('ok'); expect(made).toHaveLength(1); expect(ok.reply).toMatch(/Sale B1 saved/);
});
test('no number: sale saved, no receipt; "phone" then sends it and fixes the number', async () => {
  const { api, sent, pool } = setup();
  await pool.query('CREATE TABLE pos_bills (id SERIAL PRIMARY KEY, bill_number TEXT, customer_name TEXT, customer_phone TEXT, total NUMERIC, payment_method TEXT, discount_amount NUMERIC, created_at TIMESTAMP DEFAULT NOW())');
  await pool.query('CREATE TABLE pos_bill_items (id SERIAL PRIMARY KEY, bill_id INT, item_name TEXT, qty NUMERIC, unit_price NUMERIC, line_total NUMERIC)');
  await pool.query("INSERT INTO pos_bills (bill_number, total, payment_method, discount_amount) VALUES ('B1', 12500, 'cash', 0)");
  await pool.query("INSERT INTO pos_bill_items (bill_id, item_name, qty, unit_price, line_total) VALUES (1,'Basin',2,5000,10000)");
  await api.start('bill', 'x.jpg', 'bill'); const r = await api.handleText('ok');
  expect(r.reply).toMatch(/No customer number/); expect(sent).toHaveLength(0);
  expect((await api.handleText('receipts')).reply).toMatch(/B1: no phone/);
  const f = await api.handleText('phone 0771234567'); expect(f.reply).toMatch(/Receipt sent/); expect(sent).toHaveLength(1);
  expect((await pool.query('SELECT customer_phone FROM pos_bills WHERE id=1')).rows[0].customer_phone).toBe('94771234567');
  expect((await api.handleText('receipts')).reply).toMatch(/Nothing waiting/);
});
test('delivery fails: owner told, number can be corrected', async () => {
  const { api, pool } = setup({ sendFail: true });
  await pool.query('CREATE TABLE pos_bills (id SERIAL PRIMARY KEY, bill_number TEXT, customer_phone TEXT, total NUMERIC, payment_method TEXT, discount_amount NUMERIC, created_at TIMESTAMP DEFAULT NOW(), customer_name TEXT)');
  await pool.query('CREATE TABLE pos_bill_items (id SERIAL PRIMARY KEY, bill_id INT, item_name TEXT, qty NUMERIC, unit_price NUMERIC, line_total NUMERIC)');
  await pool.query("INSERT INTO pos_bills (bill_number, total, payment_method, discount_amount) VALUES ('B1', 12500, 'cash', 0)");
  await api.start('bill', 'x.jpg', 'bill 0771234567'); const r = await api.handleText('ok');
  expect(r.reply).toMatch(/NOT delivered[\s\S]*Wrong number/);
});
test('sending switched off: sale saved, owner told receipt not sent', async () => {
  const { api, sent } = setup({ live: false });
  await api.start('bill', 'x.jpg', 'bill 0771234567'); const r = await api.handleText('ok');
  expect(sent).toHaveLength(0); expect(r.reply).toMatch(/Sale B1 saved[\s\S]*switched off/);
});
test('a non-Sri-Lanka number is refused, never guessed', async () => {
  const { api, sent } = setup();
  await api.start('bill', 'x.jpg', 'bill 0112345678'); const r = await api.handleText('ok');
  expect(sent).toHaveLength(0); expect(r.reply).toMatch(/NOT delivered|No customer number|not a Sri Lanka/);
});
test('receipt text has no cost or profit words', () => {
  const t = receiptText({ bill_number: 'B9', total: 100, payment_method: 'cash', items: [{ item_name: 'X', qty: 1, unit_price: 100, line_total: 100 }] });
  expect(t).not.toMatch(/cost|profit|margin/i);
});
