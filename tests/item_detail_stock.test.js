/* Item edit box: stock correction is saved and logged, duplicate item codes are refused. Mocked database, nothing real touched. */
jest.mock('../utils/pool', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }), connect: jest.fn() }));
jest.mock('../routes/item_catalog', () => ({ savePhoto: () => '/x.jpg', schemaReady: Promise.resolve() }));
const pool = require('../utils/pool');
const router = require('../routes/item_detail');
const layer = router.stack.find(l => l.route && l.route.path === '/item-detail/:code' && l.route.methods.post);
const handler = layer.route.stack[layer.route.stack.length - 1].handle;
function run(body, dbRows) {
  const calls = [];
  const client = { release: jest.fn(), query: jest.fn(async (sql, p) => {
    calls.push([String(sql), p]);
    if (/FOR UPDATE/.test(sql)) return { rows: [{ id: 1, stock_level: 10 }] };
    if (/UPPER\(item_code\)/.test(sql)) return { rows: dbRows || [] };
    if (/RETURNING/.test(sql)) return { rows: [{ item_code: '001', name: 'A', stock_level: 8, avg_cost: 100, selling_price: 300 }] };
    if (/information_schema/.test(sql)) return { rows: [] };
    return { rows: [] };
  }) };
  pool.connect.mockResolvedValue(client);
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
  return handler({ params: { code: '001' }, body, session: { user: { role: 'owner' } } }, res).then(() => ({ res, calls }));
}
test('stock 10 to 8 is saved and logged with the reason', async () => {
  const { res, calls } = await run({ stock_level: '8', stock_reason: 'damage' });
  expect(res.statusCode).toBe(200);
  expect(calls.some(c => /stock_level = \$1/.test(c[0]) && c[1][0] === 8)).toBe(true);
  const log = calls.find(c => /INSERT INTO product_stock_edits/.test(c[0]));
  expect(log[1]).toEqual(['001', 10, 8, 'damage', 'owner']);
});
test('same stock number writes no log line', async () => {
  const { calls } = await run({ stock_level: '10', name: 'A' });
  expect(calls.some(c => /INSERT INTO product_stock_edits/.test(c[0]))).toBe(false);
});
test('a code that already belongs to another item (any letter case) is refused', async () => {
  const { res, calls } = await run({ new_code: 'pr7531' }, [{ item_code: 'PR7531', name: 'Kathakali sink' }]);
  expect(res.statusCode).toBe(409);
  expect(res.body.error).toMatch(/already used by PR7531/);
  expect(calls.some(c => /^ROLLBACK/.test(c[0]))).toBe(true);
});
test('a stock that is not a number is refused', async () => {
  const { res } = await run({ stock_level: 'abc' });
  expect(res.statusCode).toBe(400);
});
