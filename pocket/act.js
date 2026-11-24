/* RBH Pocket: SELL tab and ORDER list (module). The phone locks the request with the passcode, the shop PC does it with the app's normal rules
   and sends back a locked answer (bill number + receipt picture). Nothing here talks to the shop data directly.
   LOOK v5 POS: search first, tap to add (the page is NOT rebuilt, so the search box keeps your typing), a bar above the tabs shows the bill,
   one tap to review, one big Send button. Sending and waiting are the same as before (same locked request, same 90 s wait). */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.RBHP) return;
  var P = window.RBHP, el = P.el, rs = P.rs, card = P.card;
  var cart = [], pay = 'cash', dmode = 'rs', dval = '', cust = '', phone = '', busy = false, last = null, msg = '', mcls = '', view = 'find', sq = '';
  var ocart = [], vendor = '', onote = '', omsg = '', obusy = false;
  var Q = window.RBHQ ? window.RBHQ.make({ LS: P.LS, toShop: function (c) { return P.toShop(c); }, fromShop: function (id) { return P.fromShop(id); } }) : null, draining = false;
  var MAXLINES = 30;   // the shop PC takes 1 to 30 lines in one bill

  // ---------- bill maths (one place, so every number on the screen agrees)
  function key(x) { return x[4] != null ? 'p' + x[4] : 'c' + x[0] + '|' + x[1]; }   // a line is ONE item, even when the item has no id
  function sub() { return cart.reduce(function (a, l) { return a + l.qty * l.price; }, 0); }
  function count() { return cart.reduce(function (a, l) { return a + l.qty; }, 0); }
  function pct() {   // the shop PC takes the discount as a percent (0 to 100, two decimals). Rs is turned into that percent here.
    var v = Number(dval) || 0, s = sub(), p = dmode === 'pct' ? v : (s > 0 ? v / s * 100 : 0);
    return Math.round(Math.max(0, Math.min(100, p)) * 1e6) / 1e6;   // 6 decimals: the shop PC multiplies exactly, so Rs 350 off Rs 1,850 stays Rs 350.00 (two decimals made it 349.98, AJ 24 Nov)
  }
  function total() { return Math.round(sub() * (1 - pct() / 100) * 100) / 100; }
  function online() { return navigator.onLine !== false; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function answer(id, secs) {   // wait for the shop PC's locked answer
    for (var i = 0; i < secs / 3; i++) { var a = await P.fromShop(id); if (a) return a; await wait(3000); }
    return null;
  }
  function pending() { try { return JSON.parse(P.LS.get('rbh_pending') || 'null'); } catch (e) { return null; } }
  function say(t, c) { msg = t; mcls = c || ''; }

  // ---------- small parts
  function qtyBox(l, onChange) {
    var w = el('div', 'qty'), m = el('button', '', '−'), n = el('span', '', String(l.qty)), pl = el('button', '', '+');
    m.setAttribute('aria-label', 'One less ' + l.name); pl.setAttribute('aria-label', 'One more ' + l.name);
    m.addEventListener('click', function (e) { e.stopPropagation(); l.qty = Math.max(0, l.qty - 1); n.textContent = String(l.qty); onChange(l.qty === 0); });
    pl.addEventListener('click', function (e) { e.stopPropagation(); l.qty += 1; n.textContent = String(l.qty); onChange(false); });
    w.appendChild(m); w.appendChild(n); w.appendChild(pl); return w;
  }
  function addItem(x) {
    var k = key(x), ex = cart.filter(function (l) { return l.k === k; })[0];
    if (ex) { ex.qty += 1; return ex; }
    var l = { k: k, pid: x[4], code: x[0], name: x[1], qty: 1, price: x[3], stock: x[2] }; cart.push(l); return l;
  }
  function tidy() { cart = cart.filter(function (l) { return l.qty > 0; }); }
  function stockNote(l) { return l.stock < l.qty ? 'Only ' + l.stock + ' in stock' : ''; }

  // ---------- the bar above the tabs (bill or order). Updated in place, never a full redraw.
  function bar(tab) {
    var b = document.getElementById('bar2'); if (!b) return; tab = tab || P.tab(); b.textContent = '';
    var shown = false, inn = el('div', 'in'), left = el('div', 'num'), btn = null;
    if (tab === 'stock' && ocart.length) {
      left.appendChild(el('div', 'k', 'Order list')); left.appendChild(el('div', 'tot', P.plural(ocart.length, 'item', 'items')));
      btn = el('button', 'gold', 'Review'); btn.addEventListener('click', function () { P.redraw(); window.scrollTo(0, 0); }); shown = true;
    } else if (cart.length && !last) {
      if (tab === 'sell' && view === 'bill') {
        left.appendChild(el('div', 'k', 'Total to collect · ' + P.cap(pay))); left.appendChild(el('div', 'tot', rs(total())));
        var ok = !busy && cart.length <= MAXLINES;
        btn = el('button', 'gold', busy ? 'Sending…' : 'Send bill'); btn.disabled = !ok; btn.addEventListener('click', sendBill);
      } else {
        left.appendChild(el('div', 'k', 'This bill · ' + P.plural(count(), 'item', 'items'))); left.appendChild(el('div', 'tot', rs(total())));
        btn = el('button', 'gold', 'Review bill'); btn.addEventListener('click', function () { view = 'bill'; if (P.tab() === 'sell') { P.redraw(); window.scrollTo(0, 0); } else P.go('sell'); });
      }
      shown = true;
    }
    if (shown) { inn.appendChild(left); inn.appendChild(btn); b.appendChild(inn); }
    b.hidden = !shown; document.body.classList.toggle('withbar', shown);
  }

  // ---------- receipt
  function receipt(box, r) {
    var c = card('Receipt ready', P.pill('Shop PC confirmed', 'ok')); c.className += ' rcpt';
    c.appendChild(el('div', 'big md', 'Bill ' + r.no)); c.appendChild(el('div', 'note', 'Total ' + rs(r.total)));
    if (r.png) {
      var img = el('img'); img.src = 'data:image/png;base64,' + r.png; img.alt = 'Receipt'; c.appendChild(img);
      var a = el('a', 'btn gold wide', 'Download receipt'); a.href = img.src; a.download = 'receipt-' + r.no + '.png'; c.appendChild(a);
    } else c.appendChild(el('div', 'note', 'Bill saved. The receipt picture is on the shop PC.'));
    box.appendChild(c);
    var nb = el('button', 'wide', 'New bill'); nb.addEventListener('click', function () { last = null; view = 'find'; sq = ''; P.redraw(); }); box.appendChild(nb);
  }

  function newId() { return Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(12)), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
  // AJ 24 Nov: the bill is SAVED on the phone first (one id), then sent. The spinner never runs more than about 16 seconds; if the shop PC is off the bill waits in "Pending bills" and goes by itself.
  async function sendBill() {
    if (busy || !cart.length) return;
    if (cart.length > MAXLINES) { say('One bill can have up to ' + MAXLINES + ' lines. Split it into two bills.', 'bad'); P.redraw(); return; }
    if (!Q) { say('Heads-up: this phone app needs a refresh (pull down).', 'bad'); P.redraw(); return; }
    Q.add({ type: 'bill', pay: pay, disc: pct(), name: cust, phone: phone,
      items: cart.map(function (l) { return { pid: l.pid, code: l.code, qty: l.qty, price: l.price }; }) }, rs(total()) + ' · ' + P.plural(count(), 'item', 'items') + (cust ? ' · ' + cust : ''), newId());
    cart = []; dval = ''; cust = ''; phone = ''; view = 'find'; sq = '';
    busy = true; say('Sending to the shop PC…', 'pulse'); P.redraw();
    await drain(true); busy = false; P.redraw();
  }
  // one pass over the saved bills: send what is not sent, collect answers. Used by the Send button, "Send now", a timer and "back online".
  async function drain(justSent) {
    if (!Q || draining) return; draining = true;
    try {
      var q = await Q.tick(), done = false;
      q.forEach(function (it) {
        if (!it.answer) return; done = true; Q.remove(it.id);
        if (it.answer.ok) { last = it.answer; say(''); } else say('Heads-up: bill not made. ' + (it.answer.error || 'unknown'), 'bad');
      });
      if (!done) { var left = Q.load(); if (left.length) say(justSent ? 'Saved on this phone. It will be sent when the shop PC is on (see Pending bills).' : '', justSent ? 'amber' : ''); else if (justSent) say(''); }
    } finally { draining = false; }
    if (!justSent) P.redraw();
  }
  function pendingList(box) {
    var items = Q ? Q.load() : []; if (!items.length) return;
    var c = el('div', 'status amber'); c.appendChild(el('b', null, 'Pending bills (' + items.length + ')'));
    items.forEach(function (it) {
      var r = el('div', null); r.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:8px';
      var t = new Date(it.at), hm = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
      r.appendChild(el('span', null, it.label + ' · ' + hm + (it.posted ? ' · sent, waiting for the shop PC' : ' · saved, not sent yet')));
      var go = el('button', null, 'Send now'), del = el('button', null, 'Delete'); go.style.minHeight = del.style.minHeight = '44px';
      go.addEventListener('click', function () { say('Sending…', 'pulse'); P.redraw(); drain(true).then(function () { P.redraw(); }); });
      del.addEventListener('click', function () { if (window.confirm(it.posted ? 'This bill may already be at the shop. Take it off THIS list only?' : 'Delete this saved bill? It was not sent.')) { Q.remove(it.id); P.redraw(); } });
      r.appendChild(go); r.appendChild(del); c.appendChild(r);
    });
    box.appendChild(c);
  }
  if (Q) { setInterval(function () { if (Q.load().length) drain(false); }, 20000); window.addEventListener('online', function () { drain(false); }); document.addEventListener('visibilitychange', function () { if (!document.hidden && Q.load().length) drain(false); }); }

  function status(box) { if (!msg) return; var m = el('div', 'status' + (mcls ? ' ' + mcls : ''), msg); m.setAttribute('role', 'status'); box.appendChild(m); }

  // ---------- SELL: find view
  function findView(s, box) {
    status(box); pendingList(box);
    var c = card('Find items', s.items ? s.items.length.toLocaleString('en-US') + ' items' : null);
    var q = el('input', 'search'); q.type = 'search'; q.placeholder = 'Type item name or code'; q.autocomplete = 'off'; q.setAttribute('aria-label', 'Find item'); q.value = sq;
    var res = el('div', 'results'); c.appendChild(q); c.appendChild(res); box.appendChild(c);
    function control(x) {   // + Add, or the stepper once it is in the bill
      var l = cart.filter(function (y) { return y.k === key(x); })[0];
      if (l) return qtyBox(l, function (gone) { if (gone) { tidy(); draw(); } bar(); });
      var b = el('button', 'gold add', '+ Add'); b.setAttribute('aria-label', 'Add ' + x[1]);
      b.addEventListener('click', function (e) { e.stopPropagation(); addItem(x); b.replaceWith(control(x)); bar(); });
      return b;
    }
    function itemRow(x) {
      var r = P.row2(x[1], (x[0] ? x[0] + ' · ' : '') + rs(x[3]) + ' · ' + (x[2] <= 0 ? '0 left' : x[2] + ' in stock'), null);
      if (x[2] <= 0) r.lastChild.lastChild.className = 's down';
      var ctl = control(x); r.appendChild(ctl);
      r.firstChild.style.cursor = 'pointer';
      r.firstChild.addEventListener('click', function () { if (r.lastChild.tagName === 'BUTTON') r.lastChild.click(); else { addItem(x); var n = control(x); r.replaceChild(n, r.lastChild); bar(); } });
      return r;
    }
    function draw() {
      sq = q.value; res.textContent = '';
      if (!s.items) { res.appendChild(el('div', 'note', 'No data yet. Update the shop PC app, then refresh.')); return; }
      var frag = document.createDocumentFragment();
      if (!q.value.trim()) {   // 23 Nov (AJ): every item is listed by default; the list scrolls inside its own box
        s.items.slice(0, 600).forEach(function (x) { frag.appendChild(itemRow(x)); });
        if (s.items.length > 600) frag.appendChild(el('div', 'note', 'Showing the first 600. Type a name or code to find the rest.'));
        res.appendChild(frag); return;
      }
      var f = P.find(s.items, q.value, 60); if (!f.length) { res.appendChild(el('div', 'note', 'No matching items. Try a shorter word or the code.')); return; }
      f.forEach(function (x) { frag.appendChild(itemRow(x)); }); res.appendChild(frag);
    }
    q.addEventListener('input', draw); draw();
  }

  // ---------- SELL: review the bill
  function billView(s, box) {
    var back = el('button', 'back', '← Add more items'); back.addEventListener('click', function () { view = 'find'; P.redraw(); }); box.appendChild(back);
    var sumBox = { sub: null, disc: null, tot: null, hint: null };
    function refresh() {   // numbers only, in place: typing never loses the cursor
      if (sumBox.sub) sumBox.sub.textContent = rs(sub());
      if (sumBox.disc) sumBox.disc.textContent = (sub() - total() > 0 ? '− ' : '') + rs(sub() - total());
      if (sumBox.tot) sumBox.tot.textContent = rs(total());
      if (sumBox.hint) sumBox.hint.textContent = !(Number(dval) > 0) ? '' : dmode === 'rs' ? '= ' + pct().toFixed(2) + '% off (the shop PC counts in %)' : '= ' + rs(sub() - total()) + ' off';
      bar();
    }
    var c = card('This bill', P.plural(count(), 'item', 'items'));
    cart.forEach(function (l) {
      var ln = el('div', 'line'), L = el('div', 'l'); L.appendChild(el('div', 't', l.name));
      var pw = el('label', 'pricew'), pr = el('input', 'price'); pr.type = 'text'; pr.inputMode = 'decimal'; pr.value = String(l.price); pr.setAttribute('aria-label', 'Price each for ' + l.name);
      pw.appendChild(el('span', null, 'Rs')); pw.appendChild(pr); pw.appendChild(el('span', null, 'each'));
      var lineTxt = function () { return (l.code ? l.code + ' · ' : '') + 'line ' + rs(l.qty * l.price); };
      var lt = el('div', 's', lineTxt());
      pr.addEventListener('input', function () { var v = Number(pr.value.replace(/,/g, '')); if (pr.value.trim() !== '' && isFinite(v) && v >= 0) { l.price = v; lt.textContent = lineTxt(); refresh(); } });
      pr.addEventListener('blur', function () { pr.value = String(l.price); });
      L.appendChild(pw); L.appendChild(lt);
      var sn = stockNote(l); var sw = el('div', 's warnc', sn); if (!sn) sw.hidden = true; L.appendChild(sw);
      ln.appendChild(L);
      ln.appendChild(qtyBox(l, function (gone) { if (gone) { tidy(); if (!cart.length) view = 'find'; P.redraw(); return; } lt.textContent = lineTxt(); var n = stockNote(l); sw.textContent = n; sw.hidden = !n; refresh(); }));
      c.appendChild(ln);
    });
    if (cart.length > MAXLINES) c.appendChild(el('div', 'status bad', 'One bill can have up to ' + MAXLINES + ' lines. Split it into two bills.'));
    box.appendChild(c);

    var d = card('Discount'), dr = el('div', 'grid');
    var seg = P.segc([['rs', 'Rs'], ['pct', '%']], dmode, function (v) { dmode = v; dval = ''; P.redraw(); });
    var di = el('input', 'inp num'); di.type = 'text'; di.inputMode = 'decimal'; di.placeholder = dmode === 'rs' ? 'Rs off' : '% off'; di.value = dval; di.setAttribute('aria-label', 'Discount ' + (dmode === 'rs' ? 'in rupees' : 'in percent'));
    di.addEventListener('input', function () { dval = di.value.replace(/,/g, ''); refresh(); });
    dr.appendChild(seg); dr.appendChild(di); d.appendChild(dr);
    sumBox.hint = el('div', 'note', ''); sumBox.hint.style.marginTop = '6px'; d.appendChild(sumBox.hint);
    box.appendChild(d);

    var cu = card('Customer (optional)'), cg = el('div', 'grid');
    var cn = el('input', 'inp'); cn.type = 'text'; cn.placeholder = 'Name'; cn.value = cust; cn.setAttribute('aria-label', 'Customer name'); cn.autocomplete = 'off'; cn.addEventListener('input', function () { cust = cn.value; });
    var cp = el('input', 'inp'); cp.type = 'tel'; cp.placeholder = 'Phone'; cp.value = phone; cp.setAttribute('aria-label', 'Customer phone'); cp.addEventListener('input', function () { phone = cp.value; });
    cg.appendChild(cn); cg.appendChild(cp); cu.appendChild(cg); box.appendChild(cu);

    var pc = card('Payment');
    pc.appendChild(P.segc([['cash', 'Cash'], ['card', 'Card'], ['online', 'Online']], pay, function (v) { pay = v; P.redraw(); }));
    box.appendChild(pc);

    var sm = card(null);
    var r1 = el('div', 'sumrow'); r1.appendChild(el('span', null, 'Subtotal')); sumBox.sub = el('span', 'num'); r1.appendChild(sumBox.sub); sm.appendChild(r1);
    var r2 = el('div', 'sumrow'); r2.appendChild(el('span', null, 'Discount')); sumBox.disc = el('span', 'num'); r2.appendChild(sumBox.disc); sm.appendChild(r2);
    var r3 = el('div', 'sumrow total'); r3.appendChild(el('span', null, 'Total to collect')); sumBox.tot = el('span', 'tot'); r3.appendChild(sumBox.tot); sm.appendChild(r3);
    box.appendChild(sm);
    status(box);
    refresh();
  }

  function sell(s, box) {
    var pd = pending();
    if (pd && !busy) { P.fromShop(pd.id).then(function (a) { if (a) { P.LS.del('rbh_pending'); if (a.ok) last = a; else say('Heads-up: bill not made. ' + a.error, 'bad'); P.redraw(); } }).catch(function () {}); }
    if (last) { receipt(box, last); return; }
    tidy(); if (!cart.length) view = 'find';
    if (view === 'bill') billView(s, box); else findView(s, box);
  }

  // ---- ORDER LIST (shown in the Stock tab): saved as a draft purchase order on the shop PC. Nothing is sent to the vendor.
  async function sendOrder() {
    if (obusy || !ocart.length) return; if (!vendor.trim()) { omsg = 'Type the vendor name.'; P.redraw(); return; }
    if (!online()) { omsg = 'Offline. Connect to send. Nothing was sent.'; P.redraw(); return; }
    obusy = true; omsg = 'Sending to the shop PC…'; P.redraw();
    try {
      var id = await P.toShop({ type: 'order', supplier: vendor, note: onote, items: ocart.map(function (l) { return { code: l.code, name: l.name, qty: l.qty }; }) });
      var a = await answer(id, 60);
      if (!a) omsg = 'Sent. The shop PC has not answered yet. It is saved. Do NOT send it again.';
      else if (!a.ok) omsg = 'Heads-up: not saved. ' + (a.error || 'unknown');
      else { omsg = 'Saved as ' + a.po + ' (a draft on the shop PC, nothing sent to the vendor).'; ocart = []; onote = ''; }
    } catch (e) { omsg = 'Heads-up: ' + (e.message || 'could not send.'); }
    obusy = false; P.redraw();
  }
  function addOrder(code, name) {
    var ex = ocart.filter(function (l) { return l.code === code && l.name === name; })[0];
    if (ex) ex.qty += 1; else ocart.push({ code: code, name: name, qty: 1 }); omsg = ''; bar();
  }
  function order(s, box) {
    ocart = ocart.filter(function (l) { return l.qty > 0; });
    if (!ocart.length && !omsg) return;
    var c = card('Order list', ocart.length ? P.plural(ocart.length, 'item', 'items') : null);
    ocart.forEach(function (l) { var ln = el('div', 'line'), L = el('div', 'l'); L.appendChild(el('div', 't', l.name)); if (l.code) L.appendChild(el('div', 's', l.code)); ln.appendChild(L); ln.appendChild(qtyBox(l, function (gone) { if (gone) P.redraw(); })); c.appendChild(ln); });
    if (ocart.length) {
      var v = el('input', 'inp'); v.type = 'text'; v.placeholder = 'Vendor name'; v.value = vendor; v.setAttribute('list', 'vlist'); v.setAttribute('aria-label', 'Vendor'); v.style.marginTop = '8px';
      var dl = el('datalist'); dl.id = 'vlist'; (s.vendors || []).forEach(function (x) { var o = el('option'); o.value = x.who; dl.appendChild(o); });
      v.addEventListener('input', function () { vendor = v.value; }); c.appendChild(v); c.appendChild(dl);
      var n = el('input', 'inp'); n.type = 'text'; n.placeholder = 'Note (optional)'; n.value = onote; n.setAttribute('aria-label', 'Note'); n.style.marginTop = '8px'; n.addEventListener('input', function () { onote = n.value; }); c.appendChild(n);
      var go = el('button', 'gold wide', obusy ? 'Working…' : !online() ? 'Connect to send' : 'Save order'); go.disabled = obusy || !online(); go.style.marginTop = '10px'; go.addEventListener('click', function () { vendor = v.value; onote = n.value; sendOrder(); }); c.appendChild(go);
      c.appendChild(el('div', 'note', 'Saved as a draft on the shop PC. Nothing is sent to the vendor.')); c.lastChild.style.marginTop = '8px';
    }
    if (omsg) { var m = el('div', 'status' + (/^Heads-up|Offline|Type the/.test(omsg) ? ' amber' : /^Saved/.test(omsg) ? ' ok' : ''), omsg); m.style.marginTop = '10px'; m.setAttribute('role', 'status'); c.appendChild(m); }
    box.appendChild(c);
  }

  P.EXTRA.sell = sell; P.EXTRA.stockExtras.push(order); P.EXTRA.addOrder = addOrder; P.EXTRA.after = bar;
  window.addEventListener('online', function () { bar(); }); window.addEventListener('offline', function () { bar(); });
})();
