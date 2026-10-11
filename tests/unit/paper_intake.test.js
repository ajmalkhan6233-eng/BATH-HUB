// Photo of a GRN / cheque -> DRAFT -> "fix" / "cancel" / "ok". Test mode: invented data, fake database, nothing real saved.
const express = require('express');
const createPaperIntake = require('../../layla_owner/paperIntake');
const { callRouter } = require('../../layla_owner/paperDeps');
const { processInbound } = require('../../layla_owner/inbound');

function fakePool() {
  const rows = []; let seq = 0;
  return {
    rows,
    query: async (sql, p = []) => {
      if (/CREATE TABLE/.test(sql)) return { rows: [] };
      if (/SELECT \* FROM paper_drafts/.test(sql)) return { rows: rows.filter((r) => r.status === 'draft').slice(-1) };
      if (/SET status='cancelled' WHERE status='draft'/.test(sql)) { rows.forEach((r) => { if (r.status === 'draft') r.status = 'cancelled'; }); return { rows: [] }; }
      if (/INSERT INTO paper_drafts/.test(sql)) { rows.push({ id: ++seq, kind: p[0], draft: JSON.parse(p[1]), engine: p[2], status: 'draft' }); return { rows: [{ id: seq }] }; }
      if (/SET status='cancelled' WHERE id/.test(sql)) { rows.find((r) => r.id === p[0]).status = 'cancelled'; return { rows: [] }; }
      if (/SET status='saved'/.test(sql)) { rows.find((r) => r.id === p[0]).status = 'saved'; return { rows: [] }; }
      if (/SET draft=/.test(sql)) { rows.find((r) => r.id === p[0]).draft = JSON.parse(p[1]); return { rows: [] }; }
      throw new Error('unexpected sql ' + sql);
    },
  };
}
const grnDoc = () => ({
  document_type: 'grn', supplier_name: 'Test Supplier Ltd', grn_number: 'INV-1001', date: '2026-10-09', total: 33800,
  items: [
    { item_code: 'T100', description: 'Basin tap', qty: 10, unit_cost: 1500, amount: 15000 },
    { item_code: 'T200', description: 'Shower set', qty: 2, unit_cost: 5000, amount: 10000 },
    { item_code: 'T300', description: 'Waste coupling', qty: 20, unit_cost: 100, amount: 2000 },
    { item_code: 'T400', description: 'Angle valve', qty: 12, unit_cost: 250, amount: 3000 },
    { item_code: 'T500', description: 'Bib cock', qty: 8, unit_cost: 475, amount: 3800 },
  ],
});
function setup(over = {}) {
  const pool = fakePool(); const saved = { grn: [], cheque: [] };
  const paper = createPaperIntake({
    pool, now: () => new Date('2026-10-11T04:00:00Z'),
    readPaper: async (file, kind) => (over.unreadable ? { ok: false } : { ok: true, doc: kind === 'cheque' ? { payee: 'Test Payee', amount_digits: 25000, amount_words: 'Twenty five thousand only', date: '2026-10-20', bank: 'Test Bank', cheque_no: '000123' } : (over.doc || grnDoc()), engine: 'fake reader' }),
    saveGrn: async (d) => { saved.grn.push(d); return { ok: true, message: 'GRN MG-TEST saved.' }; },
    saveCheque: async (d) => { saved.cheque.push(d); return { ok: true, message: 'Cheque saved.' }; },
  });
  return { pool, paper, saved };
}

describe('paper intake: GRN', () => {
  test('photo -> summary with every line, totals and checks; NOTHING saved yet', async () => {
    const { paper, saved } = setup();
    const r = await paper.start('grn', 'x.jpg');
    expect(r.reply).toContain('GRN DRAFT #1 (nothing saved yet)');
    expect(r.reply).toContain('Test Supplier Ltd'); expect(r.reply).toContain('INV-1001');
    expect(r.reply).toContain('5. T500 Bib cock x8 @ 475.00 = 3,800.00');
    expect(r.reply).toContain('Total on paper: 33,800.00');
    expect(saved.grn).toHaveLength(0);
  });
  test('check catches a wrong line total, "fix line 5 qty 20" edits, "ok" saves once', async () => {
    const { paper, saved } = setup({ doc: { ...grnDoc(), items: grnDoc().items.map((l, i) => (i === 4 ? { ...l, amount: 9999 } : l)), total: 40000 } });
    const s = (await paper.start('grn', 'x.jpg')).reply;
    expect(s).toContain('line 5: qty x price = 3800.00 but the paper says 9999.00');
    const f = (await paper.handleText('fix line 5 qty 20')).reply;
    expect(f).toContain('5. T500 Bib cock x20 @ 475.00 = 9,500.00');
    expect(saved.grn).toHaveLength(0);
    const ok = (await paper.handleText('ok')).reply;
    expect(ok).toContain('Saved. GRN MG-TEST saved.');
    expect(saved.grn).toHaveLength(1);
    expect(saved.grn[0].lines[4].qty).toBe(20);
    expect(await paper.handleText('ok')).toBeNull();                 // nothing pending any more, no double save
    expect(saved.grn).toHaveLength(1);
  });
  test('"cancel" drops it and saves nothing', async () => {
    const { paper, saved, pool } = setup();
    await paper.start('grn', 'x.jpg');
    expect((await paper.handleText('cancel')).reply).toContain('Nothing was saved');
    expect(saved.grn).toHaveLength(0); expect(pool.rows[0].status).toBe('cancelled');
    expect(await paper.handleText('ok')).toBeNull();
  });
  test('a new photo replaces the old pending draft; unrelated text is not touched', async () => {
    const { paper, pool } = setup();
    await paper.start('grn', 'a.jpg'); await paper.start('grn', 'b.jpg');
    expect(pool.rows.filter((r) => r.status === 'draft')).toHaveLength(1);
    expect(await paper.handleText('how much stock of taps')).toBeNull();
  });
  test('negative quantities = purchase return: "ok" refuses to save it as a GRN', async () => {
    const { paper, saved } = setup({ doc: { ...grnDoc(), total: null, items: [{ item_code: 'R1', description: 'Returned tap', qty: -2, unit_cost: 1500, amount: -3000 }] } });
    await paper.start('grn', 'x.jpg');
    expect((await paper.handleText('ok')).reply).toContain('purchase RETURN');
    expect(saved.grn).toHaveLength(0);
  });
  test('unreadable photo gives a clear message and no draft', async () => {
    const { paper, pool } = setup({ unreadable: true });
    expect((await paper.start('grn', 'x.jpg')).reply).toContain('could not read');
    expect(pool.rows).toHaveLength(0);
  });
  test('bad fix commands and unknown line numbers are answered, not crashed', async () => {
    const { paper } = setup(); await paper.start('grn', 'x.jpg');
    expect((await paper.handleText('fix line 99 qty 1')).reply).toContain('no line 99');
    expect((await paper.handleText('fix banana')).reply).toContain('did not understand');
  });
});

describe('paper intake: cheque', () => {
  test('digits and words match -> all OK; fix amount makes the mismatch visible; ok saves', async () => {
    const { paper, saved } = setup();
    expect((await paper.start('cheque', 'c.jpg')).reply).toContain('CHECKS: all OK');
    expect((await paper.handleText('fix amount 52000')).reply).toContain('digits say 52,000 but words say 25,000');
    await paper.handleText('fix amount 25000');
    expect((await paper.handleText('ok')).reply).toContain('Cheque saved.');
    expect(saved.cheque[0]).toMatchObject({ payee: 'Test Payee', amount_digits: 25000, date: '2026-10-20' });
  });
});

describe('inbound routing (owner only, caption decides)', () => {
  const mk = () => {
    const { paper, saved } = setup(); const out = []; const mem = new Set();
    const deps = {
      paper, ownerNumber: '0771234567', send: async (_to, t) => out.push(t), now: () => new Date('2026-10-11T04:00:00Z'),
      store: { remember: async (id) => { if (id && mem.has(id)) return false; if (id) mem.add(id); return true; }, create: async () => ({ id: 1 }) },
      adapters: {}, download: async () => ({ buffer: Buffer.from('x'), mime: 'image/jpeg' }), saveMedia: async () => 'saved.jpg', transcribe: async () => ({ ok: false }),
    };
    return { deps, out, saved };
  };
  test('photo captioned GRN from the owner makes a draft; "ok" in a text saves it', async () => {
    const { deps, out, saved } = mk();
    const r = await processInbound({ id: 'm1', from: '94771234567', type: 'image', mediaId: 'a', caption: 'GRN' }, deps);
    expect(r.intent).toBe('paper_draft'); expect(out[0]).toContain('GRN DRAFT #1'); expect(saved.grn).toHaveLength(0);
    const r2 = await processInbound({ id: 'm2', from: '94771234567', type: 'text', text: 'ok' }, deps);
    expect(r2.intent).toBe('paper_reply'); expect(saved.grn).toHaveLength(1);
  });
  test('the same photo from a stranger is ignored and nothing is read or saved', async () => {
    const { deps, out, saved } = mk();
    const r = await processInbound({ id: 'm3', from: '94770000000', type: 'image', mediaId: 'a', caption: 'GRN' }, deps);
    expect(r.status).toBe('ignored'); expect(out).toHaveLength(0); expect(saved.grn).toHaveLength(0);
  });
});

describe('callRouter (how an approved draft reaches the existing route code)', () => {
  test('reaches a real express router and returns its status and body', async () => {
    const r = express.Router();
    r.post('/thing', (req, res) => (req.body.x ? res.status(201).json({ got: req.body.x }) : res.status(400).json({ error: 'x required' })));
    expect(await callRouter(r, 'POST', '/thing', { x: 5 })).toEqual({ status: 201, body: { got: 5 } });
    expect(await callRouter(r, 'POST', '/thing', {})).toEqual({ status: 400, body: { error: 'x required' } });
    expect((await callRouter(r, 'POST', '/nope', {})).status).toBe(404);
  });
});
