/* public/pos2-api.js: the connection layer for the new POS screen (pos-preview2.html).
 * Only talks to the shop's existing /api routes. No screen code here, so it can be tested alone.
 * Needs pos-cart.js (PosCart) loaded first. Cost is read only when the server sends avg_cost (owner view). */
(function (root) {
  'use strict';
  var j = function (u, o) {
    o = o || {}; o.credentials = 'same-origin';
    if (o.body && typeof o.body !== 'string') { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(o.body); }
    return fetch(u, o).then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  };
  var money2 = function (n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; };

  // server item -> screen item
  function mapItem(x) {
    var nm = String(x.name || '');
    var m = /(\d+(?:\.\d+)?)\s*sqm/i.exec(nm);
    return { code: String(x.item_code || ''), name: nm, stock: Number(x.stock_level || 0), price: Number(x.selling_price || 0),
             cost: x.avg_cost == null ? null : Number(x.avg_cost), unit: String(x.unit || 'PCS').toUpperCase(), sqm: m ? Number(m[1]) : undefined, reorder: Number(x.reorder_threshold || 0), supplier: String(x.supplier || '') };
  }
  function items(q, limit) {
    return j('/api/items?limit=' + (limit || 60) + (q ? '&q=' + encodeURIComponent(q) : '')).then(function (r) {
      var a = r.ok && Array.isArray(r.d) ? r.d : [];
      return a.map(mapItem).sort(function (x, y) { return x.code.localeCompare(y.code, undefined, { numeric: true }); });
    }).catch(function () { return []; });
  }
  function itemByCode(code) {
    var c = String(code || '').trim().toLowerCase();
    return items(c, 20).then(function (a) { return a.filter(function (x) { return x.code.toLowerCase() === c; })[0] || null; });
  }

  // dd/mm/yyyy <-> yyyy-mm-dd
  function dmyToISO(s) {
    var m = /^\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s*$/.exec(String(s || '')); if (!m) return null;
    var d = +m[1], mo = +m[2], y = +m[3], t = new Date(Date.UTC(y, mo - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function isoToDMY(v) { if (!v) return ''; var p = String(v).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function todayISO() { var d = new Date(Date.now() + 19800000); return d.toISOString().slice(0, 10); }

  // payload for POST/PUT /api/pos-bills. rows: [{code,name,qty,price}], disc: total Rs off (line + extra)
  function billPayload(o) {
    var lines = o.rows.map(function (r) { return { item_name: r.name, item_code: r.code || undefined, qty: Number(r.qty), unit_price: Number(r.price) }; });
    var subtotal = money2(lines.reduce(function (s, l) { return s + money2(money2(l.qty) * money2(l.unit_price)); }, 0));
    var pct = subtotal > 0 ? Math.round(o.disc / subtotal * 1e8) / 1e6 : 0;
    var p = { customer_name: o.name || null, customer_phone: o.phone || null, items: lines, discount_pct: pct };
    if (o.salesman) p.salesman = o.salesman;
    var mode = String(o.method || 'cash').toLowerCase();
    var total = PosCart.totals(lines.map(function (l) { return { qty: l.qty, unit_price: l.unit_price }; }), pct).total;
    if (mode === 'online transfer') mode = 'online';
    if (mode === 'cheque' || mode === 'credit' || mode === 'split') {
      var b = PosCart.buildPayments(mode, total, { chequeRef: o.chequeRef, split: o.split });
      if (b.error) return { error: b.error };
      p.payments = b.payments;
    } else p.payment_method = mode;
    if (o.date && (o.editing ? o.date !== o.origDate : o.date !== todayISO())) p.sale_date = o.date;
    if (o.wholesale && !o.editing) p.bill_type = 'wholesale';
    if (o.quoteId && !o.editing) p.quotation_id = o.quoteId;
    if (o.notes) p.notes = o.notes;
    return { payload: p, total: total, subtotal: subtotal };
  }
  // saves the bill; handles the owner-approval step for a discount over the cap through askApprove()
  function saveBill(payload, editingId, askApprove) {
    var go = function (extra) {
      var body = Object.assign({}, payload, extra || {});
      return j(editingId ? '/api/pos-bills/' + editingId : '/api/pos-bills', { method: editingId ? 'PUT' : 'POST', body: body });
    };
    return go().then(function (r) {
      if (r.status === 409 && r.d && r.d.code === 'discount_over_cap' && r.d.can_override) {
        return Promise.resolve(askApprove(r.d.max_allowed)).then(function (reason) {
          if (!reason) return { ok: false, d: { error: 'Not approved. Lower the discount or approve it.' } };
          return go({ override: true, notes: 'Discount approved: ' + reason });
        });
      }
      return r;
    });
  }

  root.Pos2Api = {
    items: items, itemByCode: itemByCode, mapItem: mapItem, billPayload: billPayload, saveBill: saveBill,
    profit: function (rows, disc) { return j('/api/sale-profit', { method: 'POST', body: { items: rows.filter(function (r) { return r.code; }).map(function (r) { return { item_code: r.code, qty: r.qty, unit_price: r.price }; }), discount: disc } }).then(function (r) { return r.ok && r.d ? r.d : null; }).catch(function () { return null; }); },
    cap: function () { return j('/api/pos-bills/discount-cap').then(function (r) { return r.ok && r.d ? r.d : null; }).catch(function () { return null; }); },
    me: function () { return j('/api/me').then(function (r) { return r.ok ? r.d : null; }).catch(function () { return null; }); },
    today: function () { return j('/api/pos-bills/today').then(function (r) { return r.ok && r.d ? r.d : { bills: [], count: 0, total: 0 }; }).catch(function () { return { bills: [], count: 0, total: 0 }; }); },
    findDay: function (iso, q) { return j('/api/pos-bills?date=' + encodeURIComponent(iso || '') + '&q=' + encodeURIComponent(q || '')).then(function (r) { return r.ok && Array.isArray(r.d) ? r.d : []; }).catch(function () { return []; }); },
    find: function (q) { return j('/api/pos-bills?q=' + encodeURIComponent(q || '')).then(function (r) { return r.ok && Array.isArray(r.d) ? r.d : []; }).catch(function () { return []; }); },
    bill: function (id) { return j('/api/pos-bills/' + id).then(function (r) { return r.ok ? r.d : null; }).catch(function () { return null; }); },
    voidBill: function (id, reason) { return j('/api/pos-bills/' + id + '/void', { method: 'POST', body: { reason: reason } }); },
    quotes: function () { return j('/api/quotations').then(function (r) { return r.ok && Array.isArray(r.d) ? r.d : []; }).catch(function () { return []; }); },
    quote: function (id) { return j('/api/quotations/' + id).then(function (r) { return r.ok ? r.d : null; }).catch(function () { return null; }); },
    quoteBilled: function () { return j('/api/pos-ledger/quotation-billed').then(function (r) { return r.ok && r.d ? r.d : {}; }).catch(function () { return {}; }); },
    saveQuote: function (o) {
      var ph = function (s) { var d = String(s || '').replace(/\D/g, ''); return d.replace(/^0+/, '').replace(/^94/, ''); };
      return j('/api/customers').then(function (c) {
        var list = c.ok && Array.isArray(c.d) ? c.d : [], hit = list.filter(function (x) { return ph(x.phone) === ph(o.phone); })[0];
        return hit || j('/api/customers', { method: 'POST', body: { name: o.name || null, phone: o.phone, whatsapp: o.phone } }).then(function (n) { return n.ok ? n.d : null; });
      }).then(function (cust) {
        if (!cust) return { ok: false, d: { error: 'Could not save the customer.' } };
        return j('/api/quotations', { method: 'POST', body: { customer_id: cust.id, discount: o.disc, notes: 'From POS', items: o.rows.map(function (l) { return { item_code: l.code || null, description: l.name, qty: l.qty, unit_price: l.price }; }) } });
      });
    },
    sendReceipt: function (billId, phone, resend) { return j('/api/invoice-receipts/send', { method: 'POST', body: { bill_id: billId, customer_phone: phone, resend: resend || undefined } }); },
    checkNumber: function (phone) { return j('/api/invoice-receipts/check-number?phone=' + encodeURIComponent(phone)); },
    dmyToISO: dmyToISO, isoToDMY: isoToDMY, todayISO: todayISO, money2: money2,
  };
}(typeof self !== 'undefined' ? self : this));
