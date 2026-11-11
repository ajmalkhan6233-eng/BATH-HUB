const VM = require('../utils/vendor_master'); const SL = require('../utils/stock_ledger');
const fake = (rowsBySql = {}) => { const calls = []; return { calls, query: async (sql, params) => { calls.push({ sql, params }); for (const k of Object.keys(rowsBySql)) if (sql.includes(k)) { const v = rowsBySql[k]; if (v instanceof Error) throw v; return { rows: v }; } return { rows: [{ id: 1 }] }; } }; };
test('vendor names that differ only by spaces or case become ONE vendor', async () => {
  const pool = fake({ 'FROM grn_records': [{ n: 'Eskema  Ceramic' }, { n: 'eskema ceramic ' }], 'FROM vendor_bills': [{ n: 'Fazal Hardware' }] });
  const r = await VM.backfill(pool);
  expect(r.total).toBe(2); expect(r.added).toBe(2);
  expect(pool.calls.filter(c => c.sql.includes('INSERT INTO vendors')).map(c => c.params[1]).sort()).toEqual(['eskema ceramic', 'fazal hardware']);
});
test('a missing vendor_bills table is skipped, not an error', async () => {
  const pool = fake({ 'FROM grn_records': [{ n: 'Eskema' }], 'FROM vendor_bills': new Error('relation does not exist') });
  expect((await VM.backfill(pool)).total).toBe(1);
});
test('upsert needs a name and keeps an old phone when none is given', async () => {
  await expect(VM.upsert(fake(), { phone: '1' })).rejects.toThrow('name is required');
  const pool = fake(); await VM.upsert(pool, { name: ' Eskema  Ceramic ', phone: '' });
  expect(pool.calls[0].params).toEqual(['Eskema Ceramic', 'eskema ceramic', null, null]); expect(pool.calls[0].sql).toContain('COALESCE(EXCLUDED.phone');
});
test('ledger refuses empty code and zero quantity', async () => {
  await expect(SL.record(fake(), { item_code: '', qty_change: 1 })).rejects.toThrow('item_code');
  await expect(SL.record(fake(), { item_code: 'A', qty_change: 0 })).rejects.toThrow('non-zero');
});
test('a failed ledger line never spoils the bill: rolls back to its own savepoint', async () => {
  const calls = []; const client = { query: async (sql) => { calls.push(sql); if (sql.includes('INSERT INTO stock_movements')) throw new Error('boom'); return { rows: [] }; } };
  const r = await SL.recordSafe(client, { item_code: 'A', qty_change: -2, reason: 'sale' });
  expect(r).toBeNull(); expect(calls[0]).toBe('SAVEPOINT stock_ledger'); expect(calls).toContain('ROLLBACK TO SAVEPOINT stock_ledger'); expect(calls).not.toContain('RELEASE SAVEPOINT stock_ledger');
});
test('a good ledger line is kept and the savepoint released', async () => {
  const calls = []; const client = { query: async (sql) => { calls.push(sql); return { rows: [{ id: 7 }] }; } };
  expect((await SL.recordSafe(client, { item_code: 'A', qty_change: -2, reason: 'sale', ref_id: 55 }))).toEqual({ id: 7 }); expect(calls).toContain('RELEASE SAVEPOINT stock_ledger');
});

test('ledger phase 2: hooks present at every stock-change path', () => {
  const fs = require('fs');
  for (const f of ['grn_workbench', 'grn_manual', 'grn_dupes', 'pos_bill_corrections', 'pos_bills']) expect(fs.readFileSync(__dirname + '/../routes/' + f + '.js', 'utf8')).toContain("stock_ledger').recordSafe");
});
