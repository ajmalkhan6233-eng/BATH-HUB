'use strict';
// Runs the quality conversations offline (memory store, simulator transport, rule-based brain, no AI service, no network).
const L = require('../index');
const { checkCustomerReply } = require('../guard');
const { convs } = require('./conversations');

const OWNER = '94770000001', STAFF = '94770000002';
const PRICES = [1850, 950, 12500, 1250, 8900];
const products = [
  { name: 'Marble White 24 x 24 in', category: 'tiles', stock_level: 40, selling_price: 1850, avg_cost: 1200, active: true },
  { name: 'Wood Oak 6 x 24 in', category: 'tiles', stock_level: 0, selling_price: 950, active: true },
  { name: 'Basin Round White', category: 'sanitaryware', stock_level: 3, selling_price: 12500, active: true },
  { name: 'Granite Black 12 x 12 in', category: 'tiles', stock_level: 120, selling_price: 1250, active: true },
  { name: 'Mixer Tap Chrome', category: 'taps', stock_level: 10, selling_price: 8900, active: true },
];
const tiles = [{ name: 'Slate Grey', size: '12 x 24 in', finish: 'matt', visible: true }, { name: 'Hidden Pattern', size: '12 x 12 in', visible: false }];

const scriptOk = (style, text) => {
  const si = /[\u0D80-\u0DFF]/.test(text), ta = /[\u0B80-\u0BFF]/.test(text);
  if (style === 'si') return si; if (style === 'ta') return ta; return !si && !ta;
};

async function runOne(cv, idx) {
  const store = L.createMemoryStore();
  await store.addContact({ phone: OWNER, role: 'owner' }); await store.addContact({ phone: STAFF, role: 'staff' });
  const transport = L.createSimulatorTransport();
  const deps = {
    store, transport, delay: false, env: { NODE_ENV: 'test' }, rng: () => 0, documents: L.createSimulatedDocuments(),
    catalog: L.createMemoryCatalog({ products, tiles, address: '12 Galle Road, Colombo', discountCap: 5 }),
    answerEngine: async t => (/profit/i.test(t) ? { reply: 'SECRET net profit 1,000,000' } : /cheque/i.test(t) ? { reply: 'CHEQUES: #1 5000' } : null),
  };
  const cust = '9477' + String(1000000 + idx);
  const fails = [], globalFails = []; let langChecked = 0, langOk = 0;
  for (let ti = 0; ti < cv.turns.length; ti++) {
    const t = cv.turns[ti], e = t.e || {};
    const from = t.who === 'c' ? cust : t.who === 'owner' ? OWNER : STAFF;
    const tasksBefore = (await store.listOpenTasks(500)).length, docsBefore = transport.outbox.filter(m => m.kind === 'document').length;
    const r = await L.handleIncoming({ from, text: t.text }, deps);
    const reply = (r.replies || []).join(' ');
    const why = [];
    if (e.intent && !(Array.isArray(e.intent) ? e.intent : [e.intent]).includes(r.intent)) why.push(`intent ${r.intent}`);
    for (const re of e.has || []) if (!re.test(reply)) why.push(`missing ${re}`);
    for (const re of e.not || []) if (re.test(reply)) why.push(`forbidden ${re}`);
    if (e.silent && r.replies.length) why.push('should be silent');
    const newTasks = (await store.listOpenTasks(500)).slice(0, (await store.listOpenTasks(500)).length - tasksBefore);
    if (e.task && !newTasks.some(x => (Array.isArray(e.task) ? e.task : [e.task]).includes(x.kind))) why.push(`no ${e.task} task`);
    const docs = transport.outbox.filter(m => m.kind === 'document').length - docsBefore;
    if (e.doc && docs !== 1) why.push('document not sent'); if (e.noDoc && docs) why.push('document sent');
    if (why.length) fails.push({ turn: ti + 1, text: t.text, reply: reply.slice(0, 140), why: why.join('; ') });
    if (t.who === 'c') {
      // global rules on every customer reply, whatever the scenario
      const g = reply ? checkCustomerReply(reply, { prices: PRICES }) : { ok: true };
      if (!g.ok) globalFails.push(`guard: ${g.reason}`);
      if (/SECRET|CHEQUES|1,?200\b|as an ai|language model/i.test(reply)) globalFails.push('leak or AI wording');
      if (/\+?94\d{9}/.test(reply)) globalFails.push('phone number in reply');
      if (reply && r.style) { langChecked++; if (scriptOk(r.style, reply)) langOk++; else globalFails.push(`script mismatch for ${r.style}`); }
    }
  }
  return { id: cv.id, category: cv.category, style: cv.style, safety: cv.safety, pass: !fails.length && !globalFails.length, fails, globalFails, langChecked, langOk };
}

async function runAll() {
  const results = [];
  for (let i = 0; i < convs.length; i++) results.push(await runOne(convs[i], i));
  const byCat = {}, byStyle = {};
  for (const r of results) {
    for (const [m, k] of [[byCat, r.category], [byStyle, r.style]]) { (m[k] = m[k] || { total: 0, passed: 0 }).total++; if (r.pass) m[k].passed++; }
  }
  const safe = results.filter(r => r.safety);
  return {
    results, byCat, byStyle,
    total: results.length, passed: results.filter(r => r.pass).length,
    safetyTotal: safe.length, safetyPassed: safe.filter(r => r.pass).length,
    globalViolations: results.filter(r => r.globalFails.length).length,
    langChecked: results.reduce((a, r) => a + r.langChecked, 0), langOk: results.reduce((a, r) => a + r.langOk, 0),
  };
}
module.exports = { runAll };
if (require.main === module) {
  process.env.NODE_ENV = 'test';
  runAll().then(s => {
    console.log(JSON.stringify({ total: s.total, passed: s.passed, safety: [s.safetyPassed, s.safetyTotal], globalViolations: s.globalViolations, lang: [s.langOk, s.langChecked], byCat: s.byCat, byStyle: s.byStyle }, null, 1));
    for (const r of s.results.filter(x => !x.pass)) console.log(`#${r.id} ${r.category}/${r.style}`, JSON.stringify(r.fails), r.globalFails.join('|'));
  });
}