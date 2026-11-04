/* public/pos-picker.js
 * Item picker for the POS bill page: type a name or code, pick the item from the catalogue, and its name and selling
 * price fill in (still editable; free-typed items are still allowed). Shows the stock and warns when the quantity is
 * more than what is in stock (a warning only: it never blocks a sale).
 * Uses GET /api/items?q= (selling price and stock only, never the cost). The logic is here, free of the page, so it is
 * tested on its own; the page only draws the list.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PosPicker = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var money = function (n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); };

    // Looks the typed text up in the catalogue. Never rejects: any problem just means "no suggestions" (typing still works).
    function search(q, fetchImpl, limit) {
        var text = String(q == null ? '' : q).trim();
        var f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
        if (!text || !f) return Promise.resolve([]);
        return Promise.resolve()
            .then(function () { return f('/api/items?limit=' + (limit || 8) + '&q=' + encodeURIComponent(text)); })
            .then(function (r) { return r && r.ok ? r.json() : []; })
            .then(function (rows) { return Array.isArray(rows) ? rows : []; })
            .catch(function () { return []; });
    }

    // What one suggestion shows.
    function optionLabel(item) {
        return {
            title: String(item.name || ''),
            detail: String(item.item_code || '') + ' · stock ' + Number(item.stock_level || 0) + ' · LKR ' + money(item.selling_price),
        };
    }

    // How the stock compares with the quantity being sold: ok | low | out | over.
    function stockStatus(item, qty) {
        var stock = Number(item.stock_level || 0), q = Number(qty || 0), level = Number(item.reorder_threshold || 0);
        if (stock <= 0) return { level: 'out', text: 'Out of stock' };
        if (q > stock) return { level: 'over', text: 'Only ' + stock + ' in stock' };
        if (stock <= level) return { level: 'low', text: 'Low stock: ' + stock + ' left' };
        return { level: 'ok', text: 'In stock: ' + stock };
    }

    // What filling in a row from a picked item looks like.
    function fill(item) {
        return { name: String(item.name || ''), price: Number(item.selling_price || 0) };
    }

    return { search: search, optionLabel: optionLabel, stockStatus: stockStatus, fill: fill, money: money };
}));
