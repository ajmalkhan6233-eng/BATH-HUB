/* POS: Quotation tab (same screen as billing), invoice-style quotation, hidden golden dot + live profit window.
   Reads the items on screen only. Never changes how a bill is saved. Cost is fetched from /api/sale-profit (owner only)
   and is shown ONLY in the side window. It is never put in the quotation, the WhatsApp text or the receipt. */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  var fmt = function (n) { return Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var r2 = function (n) { return Math.round((+n || 0) * 100) / 100; };
  var SHOP = { name: 'Royal Bath Hub', addr: '173/1 Kandy Road, Thihariya', phone: '074 035 5536' };
  var mode = 'bill';

  function lines() {
    return Array.prototype.map.call(document.querySelectorAll('#itemRows .item-row'), function (r) {
      return { code: r.dataset.itemCode || '', name: (r.querySelector('.i-name').value || '').trim(), qty: parseFloat(r.querySelector('.i-qty').value) || 0, price: parseFloat(r.querySelector('.i-price').value) || 0 };
    }).filter(function (l) { return l.name && l.qty > 0; });
  }
  function totals(ls) {
    var sub = r2(ls.reduce(function (s, l) { return s + r2(l.qty * l.price); }, 0)), pct = parseFloat(($('discountPct') || {}).value) || 0;
    var disc = r2(sub * pct / 100);
    return { sub: sub, disc: disc, total: r2(sub - disc), pct: Math.round(pct * 100) / 100 };
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  // ---------- tabs + mode ----------
  function tag() {
    [$('paymentMethod') && $('paymentMethod').previousElementSibling, $('paymentMethod'), $('chequeBox'), $('creditNote'), $('splitBox'), document.querySelector('details.today-d'), $('saveHint'), document.querySelector('#custRow .wa-line')]
      .forEach(function (x) { if (x) x.classList.add('pq-hide'); });
    var q = $('quoteSaveBtn'); if (q) q.classList.add('pq-gone');            // the old small quotation pop-up is replaced by the Quotation tab
  }
  function setMode(m) {
    mode = m === 'quote' ? 'quote' : 'bill';
    document.body.dataset.pq = mode;
    var tabs = $('pqTabs'); if (tabs) Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute('aria-selected', String(b.dataset.m === mode)); });
    var h = document.querySelector('.pos-h1'); if (h && h.firstChild) h.firstChild.textContent = mode === 'quote' ? 'Quotation ' : 'Generate Bill ';
    var g = $('genBtn'); if (g) { if (!g.dataset.bill) g.dataset.bill = g.textContent; g.textContent = mode === 'quote' ? 'Generate Quotation' : g.dataset.bill; }
    try { history.replaceState(null, '', mode === 'quote' ? '#quote' : location.pathname + location.search); } catch (e) { /* ignore */ }
  }
  function buildTabs() {
    var h = document.querySelector('.pos-h1'); if (!h || $('pqTabs')) return;
    var t = el('div'); t.id = 'pqTabs'; t.setAttribute('role', 'tablist');
    [['bill', 'Bill'], ['quote', 'Quotation']].forEach(function (x) {
      var b = el('button', '', x[1]); b.type = 'button'; b.dataset.m = x[0]; b.setAttribute('role', 'tab');
      b.addEventListener('click', function () { setMode(x[0]); }); t.appendChild(b);
    });
    h.parentNode.insertBefore(t, h);
  }

  // ---------- quotation text + invoice ----------
  function validUntil() { var d = new Date(Date.now() + 7 * 864e5); return d.toISOString().slice(0, 10); }
  function waText(ls, t, name, qno) {
    var o = ['*' + SHOP.name + '*', SHOP.addr, '', '*QUOTATION' + (qno ? ' ' + qno : '') + '*', new Date().toISOString().slice(0, 10) + (name ? '  |  ' + name : ''), '--------------------------'];
    ls.forEach(function (l, i) { o.push((i + 1) + '. ' + (l.code ? '[' + l.code + '] ' : '') + l.name, '    ' + l.qty + ' x ' + fmt(l.price) + ' = ' + fmt(l.qty * l.price)); });
    o.push('--------------------------');
    if (t.disc > 0) o.push('Subtotal: Rs ' + fmt(t.sub), 'Discount ' + t.pct + '%: -Rs ' + fmt(t.disc));
    o.push('*TOTAL: Rs ' + fmt(t.total) + '*', '', 'Valid until ' + validUntil() + '. Thank you!', 'Call ' + SHOP.phone);
    return o.join('\n');
  }
  function phone94(p) { var d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.indexOf('94') === 0) return d; if (d.charAt(0) === '0') return '94' + d.slice(1); return d.length === 9 ? '94' + d : d; }
  function closeInv() { var o = $('pqInv'); if (o) o.remove(); }
  function showInvoice(ls, t, name, phone, qno, saved) {
    closeInv(); closeSide();
    var o = el('div'); o.id = 'pqInv'; o.addEventListener('mousedown', function (e) { if (e.target === o) closeInv(); });
    var p = el('div', 'pq-paper');
    var head = el('div', 'pq-head'), logo = document.createElement('img'); logo.src = '/brand/logo-header-400h.png'; logo.alt = ''; logo.onerror = function () { logo.remove(); };
    var nm = el('div'); nm.append(el('b', '', SHOP.name)); nm.append(el('div', '', SHOP.addr)); nm.append(el('div', '', SHOP.phone));
    var lf = el('div'); lf.style.display = 'flex'; lf.style.alignItems = 'center'; lf.style.gap = '10px'; lf.append(logo, nm);
    var tt = el('div', 'pq-ttl'); tt.append(el('b', '', 'QUOTATION')); tt.append(el('span', '', qno || ''));
    head.append(lf, tt);
    var meta = el('div', 'pq-meta'), a = el('div'), b = el('div');
    a.append(el('div', '', 'Customer'), el('b', '', name || 'Walk-in customer'));
    if (phone) a.append(el('div', '', phone));
    b.style.textAlign = 'right'; b.append(el('div', '', 'Date: ' + new Date().toISOString().slice(0, 10)), el('div', '', 'Valid until: ' + validUntil()));
    meta.append(a, b);
    var tb = document.createElement('table'), th = document.createElement('tr');
    ['#', 'Code', 'Item', 'Qty', 'Price', 'Amount'].forEach(function (x, i) { var c = el('th', i > 2 ? 'r' : '', x); th.appendChild(c); }); tb.appendChild(th);
    ls.forEach(function (l, i) {
      var tr = document.createElement('tr');
      [i + 1, l.code || '', l.name, l.qty, fmt(l.price), fmt(l.qty * l.price)].forEach(function (x, k) { tr.appendChild(el('td', k > 2 ? 'r' : '', String(x))); }); tb.appendChild(tr);
    });
    var sum = el('div', 'pq-sum');
    if (t.disc > 0) { [['Subtotal', 'Rs ' + fmt(t.sub)], ['Discount ' + t.pct + '%', '-Rs ' + fmt(t.disc)]].forEach(function (x) { var d = el('div'); d.append(el('span', '', x[0]), el('span', '', x[1])); sum.appendChild(d); }); }
    var tot = el('div', 'pq-tot'); tot.append(el('span', '', 'TOTAL'), el('span', '', 'Rs ' + fmt(t.total))); sum.appendChild(tot);
    var foot = el('div', 'pq-foot', 'This quotation is valid for 7 days. Stock is subject to availability. Thank you for choosing ' + SHOP.name + '.');
    var act = el('div', 'pq-act');
    function btn(x, fn, gold) { var q = el('button', gold ? 'gold' : '', x); q.type = 'button'; q.addEventListener('click', fn); act.appendChild(q); }
    var text = waText(ls, t, name, qno), note = el('div', 'pq-note', saved || '');
    btn('Send on WhatsApp', function () { window.open('https://wa.me/' + (phone94(phone) || '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); }, true);
    btn('Copy', function () { try { navigator.clipboard.writeText(text).then(function () { note.textContent = 'Copied. Paste it anywhere.'; }); } catch (e) { note.textContent = 'Could not copy.'; } });
    btn('Print', function () { window.print(); });
    btn('Close', closeInv);
    p.append(head, meta, tb, sum, foot, act, note); o.appendChild(p); document.body.appendChild(o);
  }
  function jf(u, m, b) { return fetch(u, { method: m || 'GET', credentials: 'same-origin', headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }).then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, j: j }; }); }); }
  function makeQuote() {
    var ls = lines(); var err = $('errMsg');
    if (!ls.length) { if (err) { err.textContent = 'Add at least one item first.'; err.style.display = 'block'; } return; }
    if (err) { err.textContent = ''; err.style.display = ''; }
    var t = totals(ls), name = ($('customerName').value || '').trim(), raw = ($('customerPhone').value || '').trim(), ph = phone94(raw);
    function done(qno, msg) { showInvoice(ls, t, name, raw, qno, msg); }
    if (!raw) { done('', 'Not saved in the Quotations list (type the customer phone to save it there). You can still send, copy or print it.'); return; }
    jf('/api/customers').then(function (c) {
      var list = c.ok && Array.isArray(c.j) ? c.j : [], cust = list.filter(function (x) { return phone94(x.phone) === ph; })[0];
      return cust ? cust : jf('/api/customers', 'POST', { name: name || null, phone: raw, whatsapp: raw }).then(function (n) { return n.ok ? n.j : null; });
    }).then(function (cust) {
      if (!cust) return done('', 'Could not save it in the Quotations list. You can still send, copy or print it.');
      return jf('/api/quotations', 'POST', { customer_id: cust.id, discount: t.disc, notes: 'From POS Quotation tab', items: ls.map(function (l) { return { item_code: l.code || null, description: l.name, qty: l.qty, unit_price: l.price }; }) })
        .then(function (q) { done(q.ok ? q.j.quote_no : '', q.ok ? 'Saved in Quotations as ' + q.j.quote_no + '.' : 'Could not save it in the Quotations list. You can still send, copy or print it.'); });
    }).catch(function () { done('', 'Could not save it in the Quotations list. You can still send, copy or print it.'); });
  }
  // in Quotation mode the big button makes a quotation, never a bill
  document.addEventListener('click', function (e) {
    var g = e.target && e.target.closest && e.target.closest('#genBtn');
    if (g && mode === 'quote') { e.preventDefault(); e.stopImmediatePropagation(); makeQuote(); }
  }, true);

  // ---------- hidden golden dot + profit window (owner only) ----------
  var side = null, dot = null, timer = null, last = 0;
  function closeSide() { if (side) side.classList.remove('on'); }
  function row(label, id) { var r = el('div', 'pq-r'); r.append(el('span', '', label), el('b', '', '-')); r.lastChild.id = id; return r; }
  function buildSide() {
    side = el('div'); side.id = 'pqSide';
    var x = el('button', 'pq-x', '×'); x.type = 'button'; x.addEventListener('click', closeSide);
    side.append(x, el('h3', '', 'This sale'));
    side.append(row('Cost', 'pqCost'), row('Selling total', 'pqSub'), row('Discount', 'pqDisc'));
    var lab = el('label', '', 'Package price (optional)'); lab.htmlFor = 'pqPkg';
    var inp = document.createElement('input'); inp.type = 'number'; inp.id = 'pqPkg'; inp.min = '0'; inp.step = 'any'; inp.placeholder = 'e.g. 69900'; inp.inputMode = 'decimal';
    inp.addEventListener('input', soon);
    var big = el('div', 'pq-big'); big.id = 'pqProfit'; big.textContent = 'Profit -';
    var warn = el('div', 'pq-warn'); warn.id = 'pqWarn';
    side.append(lab, inp, row('Price used', 'pqPrice'), big, warn); document.body.appendChild(side);
  }
  function refresh() {
    if (!side || !side.classList.contains('on')) return;
    var ls = lines(), t = totals(ls), pk = parseFloat($('pqPkg').value) || 0, id = ++last;
    jf('/api/sale-profit', 'POST', { items: ls.map(function (l) { return { item_code: l.code, qty: l.qty, unit_price: l.price }; }), discount: t.disc, price: pk }).then(function (r) {
      if (id !== last || !r.ok || !r.j) return;
      var j = r.j, set = function (i, v) { $(i).textContent = v; };
      set('pqCost', 'Rs ' + fmt(j.cost)); set('pqSub', 'Rs ' + fmt(j.subtotal)); set('pqDisc', 'Rs ' + fmt(j.discount)); set('pqPrice', 'Rs ' + fmt(j.total));
      set('pqProfit', 'Profit Rs ' + fmt(j.profit) + '  (' + j.pct + '%)');
      set('pqWarn', j.unknown > 0 ? 'Heads-up: ' + j.unknown + ' item(s) have no cost saved, so the real profit is lower than shown.' : '');
    }).catch(function () { /* the window just keeps the last figures */ });
  }
  function soon() { clearTimeout(timer); timer = setTimeout(refresh, 350); }
  function openSide() { if (!side) buildSide(); closeInv(); side.classList.add('on'); refresh(); }
  function setupDot() {
    jf('/api/sale-profit', 'POST', { items: [] }).then(function (r) {
      if (!r.ok) return;                                              // staff: no dot, no window
      dot = document.createElement('button'); dot.type = 'button'; dot.id = 'pqDot'; dot.style.display = 'block';
      dot.addEventListener('click', function () { if (side && side.classList.contains('on')) closeSide(); else openSide(); });
      document.body.appendChild(dot);
      document.addEventListener('input', soon, true); document.addEventListener('click', soon, true); document.addEventListener('change', soon, true);
      new MutationObserver(soon).observe($('itemRows'), { childList: true, subtree: true, attributes: true, attributeFilter: ['data-item-code'] });
      var bp = $('billPanel'); if (bp) new MutationObserver(function () { if (bp.style.display && bp.style.display !== 'none') closeSide(); }).observe(bp, { attributes: true, attributeFilter: ['style'] });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSide(); });
    }).catch(function () { /* no dot */ });
  }

  // ---------- start + messages from the main menu ----------
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || typeof e.data.pq !== 'string') return;
    if (e.data.pq === 'bill' || e.data.pq === 'quote') setMode(e.data.pq);
    if (e.data.pq === 'package') { setMode('quote'); openSide(); }
  });
  buildTabs(); tag(); setMode(location.hash === '#quote' ? 'quote' : 'bill'); setupDot();
  window.PosQuote = { setMode: setMode, totals: totals, waText: waText };
})();
