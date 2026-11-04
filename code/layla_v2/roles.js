'use strict';
// Who is talking? The owner and staff numbers come ONLY from the layla_contacts allow-list table (empty by default).
// Everyone else is a CUSTOMER. A customer can never become owner/staff by what they type (see intent.js 'override').
const digits = v => String(v == null ? '' : v).replace(/\D/g, '');

// 0771234567 / +94 77 123 4567 / 771234567 all mean 94771234567. Anything else is only stripped to digits.
function normalizePhone(raw) {
    let d = digits(raw);
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 10 && d.startsWith('07')) d = '94' + d.slice(1);
    else if (d.length === 9 && d.startsWith('7')) d = '94' + d;
    return d;
}

/** @returns {Promise<{role:'owner'|'staff'|'customer', name?:string|null}>} */
async function resolveRole(store, phone) {
    const p = normalizePhone(phone);
    if (!p) return { role: 'customer' };
    const c = await store.getContact(p);
    if (c && (c.role === 'owner' || c.role === 'staff')) return { role: c.role, name: c.name || null };
    return { role: 'customer' };
}

module.exports = { resolveRole, normalizePhone, digits };