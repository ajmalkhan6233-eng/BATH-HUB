'use strict';
// BILL PICTURE + VENDOR STATEMENT for the PC link (28 Nov 2026, idea 8.3). Read only on shop data. Nothing is sent to anyone.
// The file is written into outbox/ of the PC link folder, which pclink.js pushes to its branch in the PRIVATE bridge repo.
const fs = require('fs'), path = require('path'), os = require('os');
const outDir = () => path.join(process.env.PCLINK_DIR || path.join(os.homedir(), 'pclink_repo'), 'outbox');
const safeName = (s) => String(s).replace(/[^\w-]+/g, '_').slice(0, 60) || 'file';

// The bill as the receipt drawing wants it. Voided and unknown bills are refused. The customer's phone is left off.
async function billForReceipt(pool, billNo) {
    const no = String(billNo || '').trim();
    if (!no) throw new Error('args.bill_number is needed, for example RBH-S042');
    const bill = (await pool.query('SELECT * FROM pos_bills WHERE UPPER(bill_number) = UPPER($1)', [no])).rows[0];
    if (!bill) throw new Error('no bill with number ' + no);
    if ((await pool.query('SELECT 1 FROM pos_bill_voids WHERE bill_id = $1', [bill.id])).rows.length) throw new Error(bill.bill_number + ' is voided: no picture made');
    const items = (await pool.query('SELECT item_code, item_name, qty, unit_price FROM pos_bill_items WHERE bill_id = $1 ORDER BY id', [bill.id])).rows;
    return {
        billNo: String(bill.bill_number), customer: bill.customer_name || '', customerPhone: null, paymentMethod: bill.payment_method || null,
        total: Number(bill.total), discount: Number(bill.discount_amount) || 0,
        date: new Date(bill.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        items: items.map((i) => ({ code: i.item_code || null, name: i.item_name, qty: Number(i.qty), price: Number(i.unit_price) })),
    };
}

async function receiptPng(pool, args, draw = require('./receiptImage').renderReceiptPng) {
    const data = await billForReceipt(pool, args && args.bill_number);
    const made = await draw(data);
    fs.mkdirSync(outDir(), { recursive: true });
    const file = 'receipt_' + safeName(data.billNo) + '.png';
    fs.copyFileSync(made.file, path.join(outDir(), file));
    return 'saved outbox/' + file + ' (bill ' + data.billNo + ', total ' + data.total + ')';
}

// The same statement Vendor 360 makes (same numbers, same print name), as a PDF.
async function vendorStatement(args, voucher = require('../routes/vendor_voucher')) {
    const vendor = String((args && args.vendor) || '').trim();
    if (!vendor) throw new Error('args.vendor is needed (the vendor name as in the app)');
    const data = await voucher.build(vendor, Array.isArray(args.bills) && args.bills.length ? args.bills.map(String) : null);
    const pdf = await voucher.png(data, true);
    fs.mkdirSync(outDir(), { recursive: true });
    const file = 'statement_' + safeName(data.vendor.name) + '_' + safeName(data.voucher_no) + '.pdf';
    fs.writeFileSync(path.join(outDir(), file), pdf);
    return 'saved outbox/' + file + ' (' + data.bills.length + ' bill(s), balance ' + data.balance + ')';
}
module.exports = { billForReceipt, receiptPng, vendorStatement, outDir };
