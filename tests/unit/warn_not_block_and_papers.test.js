// 28 Nov: bill picture / statement jobs refuse bad input; a payment above what is owed warns and can be confirmed.
const fs = require('fs'), path = require('path');
const { billForReceipt } = require('../../utils/pclinkPapers');
const db = (voided) => ({ query: async (sql) => {
    if (/FROM pos_bills/.test(sql)) return { rows: [{ id: 1, bill_number: 'B-1', total: '900', discount_amount: '100', created_at: '2026-11-27T05:00:00Z', customer_phone: '0770000000' }] };
    if (/pos_bill_voids/.test(sql)) return { rows: voided ? [{}] : [] };
    return { rows: [{ item_code: '001', item_name: 'Tap', qty: '1', unit_price: '1000' }] };
} });

test('receipt data leaves the customer phone off', async () => {
    const d = await billForReceipt(db(false), 'b-1');
    expect(d.customerPhone).toBeNull();
    expect(d.items).toEqual([{ code: '001', name: 'Tap', qty: 1, price: 1000 }]);
});
test('a voided bill gets no picture', async () => { await expect(billForReceipt(db(true), 'B-1')).rejects.toThrow(/voided/); });

test('over-payment is saved only after the warning is confirmed, and the screen asks', () => {
    const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
    expect(read('routes/vendor_ledger.js')).toMatch(/amount > owed \+ 0\.005 && p\.confirm_over !== true/);
    expect(read('public/vendor360.js')).toMatch(/o\.code === 'over_owed'/);
    expect(read('public/lib/offlineSave.js')).toMatch(/code: r\.json && r\.json\.code/);
});
