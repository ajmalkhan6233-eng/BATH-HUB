'use strict';
// CUSTOMER DATA ALLOWLIST: the customer-facing agent may only be given PUBLIC facts.
// Only the fields named here pass; everything else (costs, profit, bank, staff pay, other customers) is dropped,
// even if a caller hands over a whole database row by mistake. New fields are blocked until someone adds them here.
const PUBLIC_PRODUCT = ['item_code', 'name', 'category', 'size', 'finish', 'use', 'selling_price', 'unit', 'in_stock'];

function publicProduct(row) {
    if (!row || typeof row !== 'object') return null;
    const out = {};
    for (const k of PUBLIC_PRODUCT) if (row[k] !== undefined && row[k] !== null) out[k] = row[k];
    if (out.in_stock === undefined && row.stock_level !== undefined) out.in_stock = Number(row.stock_level) > 0;   // a yes/no, never the count
    return out;
}

const publicProducts = rows => (Array.isArray(rows) ? rows : []).map(publicProduct).filter(Boolean);

// Defence in depth: refuse an object that still carries a forbidden field name.
const FORBIDDEN = /(?:cost|profit|margin|bank|salary|wage|payroll|loan|supplier|commission|balance|owed|phone|address|password|secret|token)/i;
function assertPublic(obj) {
    for (const k of Object.keys(obj || {})) if (FORBIDDEN.test(k)) throw new Error('not a public field: ' + k);
    return obj;
}

module.exports = { publicProduct, publicProducts, assertPublic, PUBLIC_PRODUCT };
