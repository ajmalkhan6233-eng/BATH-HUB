// utils/documentFiling.js
// DOCUMENT INBOX, pure logic (no database, no network): what kinds of paper there are, how to clean up what the reader
// extracted, what must be true before a paper is filed, and how each kind becomes rows in the right table.
// Nothing here files anything by itself: the route files a paper only when Aj presses Confirm.

const money2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// doc_type -> label, and where it goes when confirmed (null = cannot be filed until the type is changed)
const DOC_TYPES = {
    manual_bill:    { label: 'Manual bill',          files_to: 'pos_bills' },
    grn:            { label: 'GRN (goods received)', files_to: 'grn_records' },
    cheque:         { label: 'Cheque',               files_to: 'cheque_register' },
    day_sheet:      { label: 'Daily sales sheet',    files_to: 'daily_summary' },
    expense_sheet:  { label: 'Expense list',         files_to: 'daily_summary' },
    invoice:        { label: 'Supplier invoice',     files_to: null },
    customer_photo: { label: 'Customer photo',       files_to: null },
    unknown:        { label: 'Not recognised',       files_to: null },
};

// The reader's names -> ours (it says "cheque_note").
function typeFromOcr(ocr) {
    const t = String(ocr && ocr.document_type || '').toLowerCase();
    if (t === 'cheque_note' || t === 'cheque') return 'cheque';
    return DOC_TYPES[t] ? t : 'unknown';
}

const str = (v, max = 200) => v == null ? '' : String(v).trim().slice(0, max);
const num = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/[, ]/g, '').replace(/^(rs\.?|lkr)/i, ''));
    return Number.isFinite(n) ? n : null;
};
const day = v => { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : ''; };
const MAX_ITEMS = 60;

// Cleans what the reader (or Aj's edit) gave us into a predictable shape. Never throws.
function normalize(docType, raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const items = a => (Array.isArray(a) ? a : []).slice(0, MAX_ITEMS);
    switch (docType) {
        case 'manual_bill':
            return {
                bill_number: str(r.bill_number, 40), date: day(r.date), customer_name: str(r.customer_name, 150), customer_phone: str(r.customer_phone, 30),
                items: items(r.items).map(i => ({ name: str(i && (i.name || i.description), 200), qty: num(i && i.qty), unit_price: num(i && i.unit_price), amount: num(i && i.amount) })),
                subtotal: num(r.subtotal), discount: num(r.discount), total: num(r.total),
                payment_method: ['cash', 'card', 'online', 'cheque', 'credit'].includes(String(r.payment_method).toLowerCase()) ? String(r.payment_method).toLowerCase() : 'cash',
                notes: str(r.notes, 500),
            };
        case 'grn':
            return {
                grn_number: str(r.grn_number, 40), date: day(r.date), supplier_name: str(r.supplier_name, 150),
                items: items(r.items).map(i => ({ description: str(i && (i.description || i.name), 200), qty: num(i && i.qty), unit_cost: num(i && i.unit_cost), amount: num(i && i.amount) })),
                total: num(r.total), notes: str(r.notes, 500),
            };
        case 'cheque':
            return {
                cheque_number: str(r.cheque_number, 50), bank: str(r.bank, 100), payee: str(r.payee, 150), amount: num(r.amount),
                due_date: day(r.due_date || r.date), direction: str(r.direction, 20), notes: str(r.notes, 500),
            };
        case 'day_sheet':
        case 'expense_sheet':
            return {
                date: day(r.date || r.report_date), total_sale: num(r.total_sale), cash_sale: num(r.cash_sale), card_sale: num(r.card_sale),
                online_sale: num(r.online_sale), credit_sale: num(r.credit_sale), total_expenses: num(r.total_expenses), expense_items: str(r.expense_items, 1000), notes: str(r.notes, 500),
            };
        case 'invoice':
            return { invoice_number: str(r.invoice_number, 60), payee: str(r.payee, 150), amount: num(r.amount), date: day(r.date), notes: str(r.notes, 500) };
        default:
            return { notes: str(r.notes, 500) };
    }
}

// Money maths for a manual bill, done the way the POS does it (sum of rounded lines).
function billTotals(ex) {
    const lines = [];
    for (const i of ex.items) {
        if (!i.name) continue;
        const qty = i.qty;
        let unit = i.unit_price;
        if ((unit === null || unit === undefined) && i.amount != null && qty > 0) unit = money2(i.amount / qty);
        lines.push({ item_name: i.name, qty: qty == null ? NaN : money2(qty), unit_price: unit == null ? NaN : money2(unit) });
    }
    for (const l of lines) l.line_total = money2(l.qty * l.unit_price);
    const subtotal = money2(lines.reduce((a, l) => a + (Number.isFinite(l.line_total) ? l.line_total : 0), 0));
    const discount_amount = ex.discount == null ? 0 : money2(ex.discount);
    return { lines, subtotal, discount_amount, total: money2(subtotal - discount_amount) };
}

/**
 * What must be true before this paper can be filed.
 * @returns {{ok: boolean, errors: string[], warnings: string[]}}  warnings need an explicit "file anyway"
 */
function validateForFiling(docType, ex) {
    const errors = [], warnings = [];
    const meta = DOC_TYPES[docType];
    if (!meta || !meta.files_to) {
        return { ok: false, errors: [docType === 'invoice' ? 'Supplier invoices have no home yet: change the type to GRN (goods received) to file it, or reject it.' : 'This kind of paper cannot be filed. Change its type, or reject it.'], warnings };
    }
    if (docType === 'manual_bill') {
        if (!ex.date) errors.push('Enter the date written on the bill (YYYY-MM-DD).');
        if (!ex.items.filter(i => i.name).length) errors.push('Add at least one item.');
        const t = billTotals(ex);
        t.lines.forEach((l, n) => {
            if (!(l.qty > 0)) errors.push(`Item ${n + 1} (${l.item_name}): the quantity must be more than 0.`);
            if (!(l.unit_price >= 0)) errors.push(`Item ${n + 1} (${l.item_name}): enter the unit price (0 or more).`);
        });
        if (!errors.length) {
            if (t.discount_amount < 0 || t.discount_amount > t.subtotal) errors.push('The discount cannot be negative or more than the items add up to.');
            if (!(t.total > 0)) errors.push('The bill total must be more than 0.');
            if (ex.total != null && Math.abs(ex.total - t.total) > 0.5) warnings.push(`The total written on the paper (${money2(ex.total)}) is not what the items add up to (${t.total}). The items are used.`);
        }
    } else if (docType === 'grn') {
        if (!ex.supplier_name) errors.push('Enter the supplier name.');
        if (!ex.date) errors.push('Enter the date written on the GRN (YYYY-MM-DD).');
        const rows = ex.items.filter(i => i.description);
        if (!rows.length) errors.push('Add at least one item.');
        rows.forEach((i, n) => {
            if (!(i.qty > 0)) errors.push(`Item ${n + 1} (${i.description}): the quantity must be more than 0.`);
            const cost = i.unit_cost != null ? i.unit_cost : (i.amount != null && i.qty > 0 ? i.amount / i.qty : null);
            if (cost == null || !(cost >= 0)) errors.push(`Item ${n + 1} (${i.description}): enter the unit cost.`);
        });
        if (!errors.length && ex.total != null) {
            const sum = grnRows(ex).reduce((a, r) => a + r.total_amount, 0);
            if (Math.abs(sum - ex.total) > 0.5) warnings.push(`The total written on the paper (${money2(ex.total)}) is not what the items add up to (${money2(sum)}). The items are used.`);
        }
    } else if (docType === 'cheque') {
        if (!ex.payee) errors.push('Enter who the cheque is for (payee).');
        if (!(ex.amount > 0)) errors.push('Enter the cheque amount (more than 0).');
        if (!ex.due_date) errors.push('Enter the cheque date (YYYY-MM-DD).');
    } else if (docType === 'day_sheet' || docType === 'expense_sheet') {
        if (!ex.date) errors.push('Enter the date on the sheet (YYYY-MM-DD).');
        if ([ex.total_sale, ex.total_expenses, ex.cash_sale, ex.card_sale, ex.online_sale, ex.credit_sale].every(v => v == null)) errors.push('Enter at least one figure from the sheet.');
    }
    return { ok: !errors.length, errors, warnings };
}

// GRN: one row per item (that is how grn_records is shaped).
function grnRows(ex) {
    return ex.items.filter(i => i.description).map(i => {
        const unit_cost = i.unit_cost != null ? money2(i.unit_cost) : money2(i.amount / i.qty);
        return { item_description: i.description, quantity: money2(i.qty), unit_cost, total_amount: money2(i.qty * unit_cost) };
    });
}

module.exports = { DOC_TYPES, typeFromOcr, normalize, billTotals, validateForFiling, grnRows, money2 };
