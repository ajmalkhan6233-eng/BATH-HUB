const { addListPrices } = require('../../utils/listPrice');
const { cleanBill } = require('../../utils/receiptImage');

function fakePool(createdAt) {
  const saved = [];
  return { saved, query: async (sql, args) => {
    if (sql.startsWith('SELECT item_code')) return { rows: saved.filter((r) => r.bill === args[0]).map((r) => ({ item_code: r.code, list_price: r.price })) };
    if (sql.startsWith('SELECT created_at')) return { rows: [{ created_at: createdAt }] };
    if (sql.startsWith('SELECT selling_price')) return { rows: [{ selling_price: '3250.00' }] };
    if (sql.startsWith('INSERT')) saved.push({ bill: args[0], code: args[1], price: args[2] });
    return { rows: [] };
  } };
}
const bill = { billNo: 'RBH-T1', total: 2500, items: [{ name: 'Tap', code: '404', qty: 1, price: 2500 }] };

test('a new bill keeps the selling price of the day', async () => {
  const pool = fakePool(new Date());
  const out = await addListPrices(bill, pool);
  expect(out.items[0].list).toBe(3250);
  expect(pool.saved).toHaveLength(1);
  expect(cleanBill(out).items[0].list).toBe(3250);
});

test('an old bill is never given today\'s price', async () => {
  const pool = fakePool(new Date(Date.now() - 3 * 86400000));
  const out = await addListPrices(bill, pool);
  expect(out.items[0].list).toBeUndefined();
  expect(pool.saved).toHaveLength(0);
});
