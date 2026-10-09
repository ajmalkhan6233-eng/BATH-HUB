/* public/pos-cart.js
 * Cart logic for the POS bill page (barcode scan, quantity steps, hold / resume, totals preview).
 * Pure functions, no page and no network, so they are tested on their own (tests/unit/posCart.test.js).
 * Nothing here saves a bill: held carts live only in this device's browser storage (never the database).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PosCart = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var MAX_HELD = 10;
    var HELD_KEY = 'pos_held_bills';
    var money2 = function (n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; };

    // The scanned text, tidied: scanners add a newline or spaces. Empty = nothing to look up.
    function cleanCode(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, '').trim(); }

    // From a list of catalogue items (search results) the one whose code is exactly the scanned code, or null.
    function findExact(items, code) {
        var c = cleanCode(code).toLowerCase();
        if (!c || !Array.isArray(items)) return null;
        for (var i = 0; i < items.length; i++) if (String(items[i] && items[i].item_code || '').trim().toLowerCase() === c) return items[i];
        return null;
    }

    // Adds a scanned item to the cart rows: a second scan of the same code adds 1 to the quantity.
    // rows: [{ item_code, name, qty, unit_price }]. Returns a new array (the old one is not changed).
    function addScanned(rows, item) {
        var out = (rows || []).map(function (r) { return Object.assign({}, r); });
        var code = String(item.item_code || '').trim();
        for (var i = 0; i < out.length; i++) {
            if (code && String(out[i].item_code || '').trim() === code) { out[i].qty = money2(Number(out[i].qty || 0) + 1); return out; }
        }
        out.push({ item_code: code, name: String(item.name || ''), qty: 1, unit_price: Number(item.selling_price || 0) });
        return out;
    }

    // Quantity buttons: + / - by delta (default 1). The quantity never goes below 1 (use the x button to remove a row).
    function stepQty(qty, delta) {
        var n = money2(Number(qty || 0) + Number(delta || 0));
        return n < 1 ? 1 : n;
    }

    // What the server will work out: line totals to 2 decimals, subtotal = sum of lines, discount to 2 decimals.
    function totals(rows, discountPct) {
        var subtotal = money2((rows || []).reduce(function (s, r) { return s + money2(money2(r.qty) * money2(r.unit_price)); }, 0));
        var pct = Number(discountPct) || 0;
        var discount = money2(subtotal * pct / 100);
        return { subtotal: subtotal, discount: discount, total: money2(subtotal - discount) };
    }

    // ---- HOLD / RESUME (browser storage only) ----
    function makeHeld(cart, now) {
        var t = now || Date.now();
        return {
            id: 'h' + t + '-' + Math.floor(Math.random() * 1e6),
            at: t,
            customer_name: String(cart.customer_name || ''),
            customer_phone: String(cart.customer_phone || ''),
            discount_pct: Number(cart.discount_pct) || 0,
            payment_method: String(cart.payment_method || 'cash'),
            pay_extra: cart.pay_extra && typeof cart.pay_extra === 'object' ? cart.pay_extra : null,   // cheque reference / split rows typed so far
            rows: (cart.rows || []).map(function (r) { return { item_code: String(r.item_code || ''), name: String(r.name || ''), qty: Number(r.qty) || 1, unit_price: Number(r.unit_price) || 0 }; }),
        };
    }
    // Returns { ok:true, list } or { ok:false, reason }. At most MAX_HELD carts; an empty cart is not held.
    function holdAdd(list, held) {
        var l = Array.isArray(list) ? list.slice() : [];
        if (!held || !held.rows || !held.rows.some(function (r) { return String(r.name || '').trim(); })) return { ok: false, reason: 'empty' };
        if (l.length >= MAX_HELD) return { ok: false, reason: 'full' };
        l.push(held);
        return { ok: true, list: l };
    }
    function holdRemove(list, id) { return (Array.isArray(list) ? list : []).filter(function (h) { return h.id !== id; }); }
    function holdGet(list, id) { return (Array.isArray(list) ? list : []).filter(function (h) { return h.id === id; })[0] || null; }

    // Storage is wrapped: a blocked or full storage never breaks the screen (it just remembers nothing).
    function loadHeld(storage) {
        try {
            var v = JSON.parse((storage || localStorage).getItem(HELD_KEY) || '[]');
            return Array.isArray(v) ? v.filter(function (h) { return h && h.id && Array.isArray(h.rows); }).slice(0, MAX_HELD) : [];
        } catch (e) { return []; }
    }
    function saveHeld(storage, list) {
        try { (storage || localStorage).setItem(HELD_KEY, JSON.stringify((list || []).slice(0, MAX_HELD))); return true; }
        catch (e) { return false; }
    }

    // ---- PAYMENT TYPES (screen side; the server checks the same rules again) ----
    // Builds the `payments` list for cheque, credit or split. Returns { payments } or { error }. Cash / card / online singles send no list.
    function buildPayments(mode, total, opts) {
        var o = opts || {}, t = money2(total);
        if (mode === 'cheque') {
            if (!String(o.chequeRef || '').trim()) return { error: 'Type the cheque number, bank and date.' };
            return { payments: [{ method: 'cheque', amount: t, reference: String(o.chequeRef).trim() }] };
        }
        if (mode === 'credit') return { payments: [{ method: 'credit', amount: t }] };
        if (mode === 'split') {
            var rows = (o.split || []).map(function (r) { return { method: String(r.method || 'cash'), amount: money2(r.amount), reference: String(r.reference || '').trim() }; })
                .filter(function (r) { return r.amount > 0; });
            if (rows.length < 2) return { error: 'A split bill needs at least two payments.' };
            var sum = money2(rows.reduce(function (a, r) { return a + r.amount; }, 0));
            if (sum !== t) return { error: 'The payments add up to ' + sum.toFixed(2) + ' but the bill total is ' + t.toFixed(2) + '.' };
            for (var i = 0; i < rows.length; i++) if (rows[i].method === 'cheque' && !rows[i].reference) return { error: 'Type the cheque number for the cheque payment.' };
            return { payments: rows.map(function (r) { var p = { method: r.method, amount: r.amount }; if (r.reference) p.reference = r.reference; return p; }) };
        }
        return { payments: null };
    }
    // How much of the total is still not covered by the split rows (can be negative when over).
    function splitRemaining(total, rows) {
        return money2(money2(total) - (rows || []).reduce(function (a, r) { return a + money2(r.amount); }, 0));
    }

    // ---- QUOTATION TO CART (read only: the quotation is never changed) ----
    // A quotation has a money discount; the POS bill has a percentage. The percentage is worked out so the bill total matches the quote total.
    function quotationToCart(q) {
        var rows = ((q && q.items) || []).map(function (i) {
            return { item_code: String(i.item_code || '').trim(), name: String(i.description || i.item_code || '').trim(), qty: Number(i.qty) || 1, unit_price: Number(i.unit_price) || 0 };
        }).filter(function (r) { return r.name; });
        var sub = totals(rows, 0).subtotal, disc = Math.max(0, Number(q && q.discount) || 0);
        var pct = sub > 0 ? Math.min(100, Math.round(disc / sub * 100 * 1e8) / 1e8) : 0;
        var billTotal = totals(rows, pct).total, quoteTotal = money2(q && q.total);
        return { rows: rows, customer_name: String((q && q.customer_name) || ''), customer_phone: String((q && q.customer_phone) || ''), discount_pct: pct,
                 quote_no: String((q && q.quote_no) || ''), quote_total: quoteTotal, bill_total: billTotal, matches: billTotal === quoteTotal };
    }

    return { quotationToCart: quotationToCart, buildPayments: buildPayments, splitRemaining: splitRemaining, MAX_HELD: MAX_HELD, HELD_KEY: HELD_KEY, money2: money2, cleanCode: cleanCode, findExact: findExact, addScanned: addScanned,
             stepQty: stepQty, totals: totals, makeHeld: makeHeld, holdAdd: holdAdd, holdRemove: holdRemove, holdGet: holdGet, loadHeld: loadHeld, saveHeld: saveHeld };
}));
