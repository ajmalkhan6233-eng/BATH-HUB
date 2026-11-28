// A price typed on a POS line stays on that line (Bill, Hold and Quotation use the same rule, public/pos2-api.js keptLines).
global.PosCart = require('../../public/pos-cart.js');
const root = {};
new Function('self', require('fs').readFileSync(require('path').join(__dirname, '../../public/pos2-api.js'), 'utf8'))(root);
const { keptLines } = root.Pos2Api;

const rows = [{ code: '001', name: 'A', qty: 2, price: 1000, disc: '100', typed: true }, { code: '002', name: 'B', qty: 1, price: 500, disc: '0' }];

test('typed price is saved on its own line, not spread as a bill discount', () => {
    const k = keptLines(rows, 200);
    expect(k.lines.map((l) => l.unit_price)).toEqual([900, 500]);
    expect(k.billDisc).toBe(0);
    expect(k.pct).toBe(0);
});

test('an extra discount on top stays a bill discount and the total is unchanged', () => {
    const k = keptLines(rows, 430);
    expect(k.billDisc).toBe(230);
    expect(global.PosCart.totals(k.lines, k.pct).total).toBe(2070);
});
