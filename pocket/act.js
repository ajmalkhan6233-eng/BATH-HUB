/* RBH Pocket: SELL tab and ORDER card (module). The phone locks the request with the passcode, the shop PC does it with the app's normal rules
   and sends back a locked answer (bill number + receipt picture). Nothing here talks to the shop data directly. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.RBHP) return;
  var P = window.RBHP, el = P.el, rs = P.rs, row = P.row, card = P.card;
  var cart = [], pay = 'cash', disc = '', cust = '', phone = '', busy = false, last = null, msg = '';
  var ocart = [], vendor = '', onote = '', omsg = '', obusy = false;

  function find(s, q) { return s.items ? P.find(s.items, q, 12) : []; }
  function total() { var t = cart.reduce(function (a, l) { return a + l.qty * l.price; }, 0); var d = Number(disc) || 0; return Math.round(t * (1 - d / 100) * 100) / 100; }
  function qtyBox(l, onChange) {
    var w = el('div', 'qty'); w.style.cssText = 'display:flex;gap:6px;align-items:center';
    var m = el('button', '', '−'), pl = el('button', '', '+'), n = el('span', '', String(l.qty)); n.style.minWidth = '28px'; n.style.textAlign = 'center';
    m.addEventListener('click', function () { l.qty = Math.max(0, l.qty - 1); onChange(); }); pl.addEventListener('click', function () { l.qty += 1; onChange(); });
    m.setAttribute('aria-label', 'less'); pl.setAttribute('aria-label', 'more'); w.appendChild(m); w.appendChild(n); w.appendChild(pl); return w;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function answer(id, secs) {   // wait for the shop PC's locked answer
    for (var i = 0; i < secs / 3; i++) { var a = await P.fromShop(id); if (a) return a; await wait(3000); }
    return null;
  }
  function pending() { try { return JSON.parse(P.LS.get('rbh_pending') || 'null'); } catch (e) { return null; } }

  function receipt(box, r) {
    var c = card('Bill ' + r.no); c.appendChild(el('div', 'big', rs(r.total)));
    if (r.png) {
      var img = el('img'); img.src = 'data:image/png;base64,' + r.png; img.alt = 'Receipt'; img.style.cssText = 'width:100%;border-radius:12px;margin:10px 0;background:#fff';
      c.appendChild(img);
      var a = el('a', 'gold', 'Download receipt'); a.href = img.src; a.download = 'receipt-' + r.no + '.png';
      a.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:14px;font-weight:700;text-decoration:none;color:#1a1403;background:linear-gradient(180deg,var(--gold2),var(--gold))';
      c.appendChild(a);
    } else c.appendChild(el('div', 'dim', 'Bill saved. The receipt picture is on the shop PC.'));
    box.appendChild(c);
  }

  async function sendBill() {
    if (busy || !cart.length) return; busy = true; msg = 'Sending to the shop PC…'; P.redraw();
    try {
      var id = await P.toShop({ type: 'bill', pay: pay, disc: Number(disc) || 0, name: cust, phone: phone,
        items: cart.map(function (l) { return { pid: l.pid, code: l.code, qty: l.qty, price: l.price }; }) });
      P.LS.set('rbh_pending', JSON.stringify({ id: id, at: Date.now(), kind: 'bill' }));
      msg = 'Waiting for the shop PC (up to 90 seconds)…'; P.redraw();
      var a = await answer(id, 90);
      if (!a) msg = 'Sent. The shop PC has not answered yet (it may be off). It is saved. Do NOT send it again, check this tab in a minute.';
      else if (!a.ok) { msg = 'Not made: ' + (a.error || 'unknown'); P.LS.del('rbh_pending'); }
      else { last = a; cart = []; disc = ''; cust = ''; phone = ''; msg = ''; P.LS.del('rbh_pending'); }
    } catch (e) { msg = e.message || 'Could not send.'; }
    busy = false; P.redraw();
  }

  function sell(s, box) {
    var pd = pending();
    if (pd && !busy) { P.fromShop(pd.id).then(function (a) { if (a) { P.LS.del('rbh_pending'); if (a.ok) last = a; else msg = 'Not made: ' + a.error; P.redraw(); } }).catch(function () {}); }
    if (last) { receipt(box, last); var nb = el('button', 'gold', 'New bill'); nb.style.cssText = 'width:100%;margin-bottom:12px'; nb.addEventListener('click', function () { last = null; P.redraw(); }); box.appendChild(nb); return; }
    var c = card('Make a bill');
    var q = el('input', 'search'); q.type = 'search'; q.placeholder = 'Type item name or code'; q.autocomplete = 'off'; q.setAttribute('aria-label', 'Find item'); var res = el('div', 'results');
    c.appendChild(q); c.appendChild(res);
    q.addEventListener('input', function () {
      res.textContent = ''; if (!q.value.trim()) return;
      var f = find(s, q.value); if (!f.length) { res.appendChild(el('div', 'dim', 'No match')); return; }
      f.forEach(function (x) { res.appendChild(P.tapRow(x[1] + (x[0] ? ' · ' + x[0] : ''), rs(x[3]) + ' · ' + x[2] + ' in stock', '', function () {
        var ex = cart.filter(function (l) { return l.pid === x[4]; })[0]; if (ex) ex.qty += 1; else cart.push({ pid: x[4], code: x[0], name: x[1], qty: 1, price: x[3], stock: x[2] }); P.redraw(); })); });
    });
    box.appendChild(c);
    if (cart.length) {
      var b = card('Items');
      cart = cart.filter(function (l) { return l.qty > 0; });
      cart.forEach(function (l) {
        var r = el('div', 'row'); var left = el('div', 'l'); left.appendChild(el('div', '', l.name));
        var pr = el('input', 'search'); pr.type = 'number'; pr.inputMode = 'decimal'; pr.value = l.price; pr.style.cssText = 'max-width:140px;min-height:40px;margin:6px 0 0'; pr.setAttribute('aria-label', 'Price for ' + l.name);
        pr.addEventListener('change', function () { var v = Number(pr.value); if (isFinite(v) && v >= 0) l.price = v; P.redraw(); });
        left.appendChild(pr); if (l.stock < l.qty) left.appendChild(el('div', 'dim', 'Only ' + l.stock + ' in stock'));
        r.appendChild(left); r.appendChild(qtyBox(l, P.redraw)); b.appendChild(r);
      });
      box.appendChild(b);
      var d = card('Customer and payment');
      [['Customer name (optional)', 'text', cust, function (v) { cust = v; }], ['Phone (optional)', 'tel', phone, function (v) { phone = v; }], ['Discount % (optional)', 'number', disc, function (v) { disc = v; }]].forEach(function (f) {
        var i = el('input', 'search'); i.type = f[1]; i.placeholder = f[0]; i.value = f[2]; i.setAttribute('aria-label', f[0]); i.addEventListener('change', function () { f[3](i.value); P.redraw(); }); d.appendChild(i); });
      var pb = el('div'); pb.style.cssText = 'display:flex;gap:8px;margin:8px 0';
      ['cash', 'card', 'online'].forEach(function (m) { var x = el('button', pay === m ? 'gold' : '', m[0].toUpperCase() + m.slice(1)); x.style.flex = '1'; x.addEventListener('click', function () { pay = m; P.redraw(); }); pb.appendChild(x); });
      d.appendChild(pb); d.appendChild(row('Total', rs(total()), 'up'));
      var go = el('button', 'gold', busy ? 'Working…' : 'Make bill'); go.disabled = busy; go.style.cssText = 'width:100%;margin-top:10px'; go.addEventListener('click', sendBill); d.appendChild(go);
      box.appendChild(d);
    }
    if (msg) { var m = el('div', 'dim', msg); m.style.margin = '0 4px 12px'; m.setAttribute('role', 'status'); box.appendChild(m); }
  }

  // ---- ORDER STOCK (shown in the Stock tab): saved as a draft purchase order on the shop PC. Nothing is sent to the vendor.
  async function sendOrder() {
    if (obusy || !ocart.length) return; if (!vendor.trim()) { omsg = 'Type the vendor name.'; P.redraw(); return; }
    obusy = true; omsg = 'Sending to the shop PC…'; P.redraw();
    try {
      var id = await P.toShop({ type: 'order', supplier: vendor, note: onote, items: ocart.map(function (l) { return { code: l.code, name: l.name, qty: l.qty }; }) });
      var a = await answer(id, 60);
      if (!a) omsg = 'Sent. The shop PC has not answered yet. It is saved. Do NOT send it again.';
      else if (!a.ok) omsg = 'Not saved: ' + (a.error || 'unknown');
      else { omsg = 'Saved as ' + a.po + ' (a draft on the shop PC, nothing sent to the vendor).'; ocart = []; onote = ''; }
    } catch (e) { omsg = e.message || 'Could not send.'; }
    obusy = false; P.redraw();
  }
  function order(s, box) {
    var c = card('Order stock');
    var q = el('input', 'search'); q.type = 'search'; q.placeholder = 'Add an item to order'; q.autocomplete = 'off'; q.setAttribute('aria-label', 'Item to order'); var res = el('div', 'results'); c.appendChild(q); c.appendChild(res);
    q.addEventListener('input', function () { res.textContent = ''; if (!q.value.trim()) return; find(s, q.value).forEach(function (x) { res.appendChild(P.tapRow(x[1] + (x[0] ? ' · ' + x[0] : ''), x[2] + ' in stock · add', '', function () {
      var ex = ocart.filter(function (l) { return l.code === x[0] && l.name === x[1]; })[0]; if (ex) ex.qty += 1; else ocart.push({ code: x[0], name: x[1], qty: 1 }); P.redraw(); })); }); });
    ocart = ocart.filter(function (l) { return l.qty > 0; });
    ocart.forEach(function (l) { var r = el('div', 'row'); r.appendChild(el('div', 'l', l.name)); r.appendChild(qtyBox(l, P.redraw)); c.appendChild(r); });
    if (ocart.length) {
      var v = el('input', 'search'); v.type = 'text'; v.placeholder = 'Vendor name'; v.value = vendor; v.setAttribute('list', 'vlist'); v.setAttribute('aria-label', 'Vendor');
      var dl = el('datalist'); dl.id = 'vlist'; (s.vendors || []).forEach(function (x) { var o = el('option'); o.value = x.who; dl.appendChild(o); });
      v.addEventListener('change', function () { vendor = v.value; }); c.appendChild(v); c.appendChild(dl);
      var n = el('input', 'search'); n.type = 'text'; n.placeholder = 'Note (optional)'; n.value = onote; n.setAttribute('aria-label', 'Note'); n.addEventListener('change', function () { onote = n.value; }); c.appendChild(n);
      var go = el('button', 'gold', obusy ? 'Working…' : 'Save order'); go.disabled = obusy; go.style.cssText = 'width:100%;margin-top:8px'; go.addEventListener('click', function () { vendor = v.value; onote = n.value; sendOrder(); }); c.appendChild(go);
    }
    if (omsg) { var m = el('div', 'dim', omsg); m.style.marginTop = '8px'; m.setAttribute('role', 'status'); c.appendChild(m); }
    box.appendChild(c);
  }

  P.EXTRA.sell = sell; P.EXTRA.stockExtras.push(order);
})();
