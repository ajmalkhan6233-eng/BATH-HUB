/* POS extras (Ajmal 4 Nov 2026): live "bill so far" list, page layout switch, and Make quotation (with item codes) + send on WhatsApp.
   Reads only what is on the screen. Never changes how a bill is saved. */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  var fmt = function (n) { return Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function lines() {
    return Array.prototype.map.call(document.querySelectorAll('.item-row'), function (r) {
      return { code: r.dataset.itemCode || '', name: (r.querySelector('.i-name').value || '').trim(), qty: parseFloat(r.querySelector('.i-qty').value) || 0, price: parseFloat(r.querySelector('.i-price').value) || 0 };
    }).filter(function (l) { return l.name && l.qty > 0; });
  }
  function totals(ls) {
    var sub = ls.reduce(function (s, l) { return s + Math.round(l.qty * l.price * 100) / 100; }, 0), pct = parseFloat(($('discountPct') || {}).value) || 0;
    var disc = Math.round(sub * pct) / 100;
    return { sub: sub, disc: disc, total: Math.round((sub - disc) * 100) / 100, pct: pct };
  }
  function live() {
    var box = $('liveBill'); if (!box) return;
    var ls = lines(), t = totals(ls); box.textContent = '';
    var h = document.createElement('div'); h.className = 'lb-h'; h.textContent = ls.length ? 'Bill so far (' + ls.length + ' item' + (ls.length > 1 ? 's' : '') + ')' : 'Bill so far: nothing yet. Type an item code or name on the left.'; box.appendChild(h);
    if (!ls.length) return;
    var tb = document.createElement('table');
    ls.forEach(function (l) {
      var tr = document.createElement('tr'), c = [(l.code ? l.code + '  ' : '') + l.name, l.qty + ' x ' + fmt(l.price), fmt(l.qty * l.price)];
      c.forEach(function (x, i) { var td = document.createElement('td'); td.textContent = x; if (i) td.className = 'r'; tr.appendChild(td); }); tb.appendChild(tr);
    });
    box.appendChild(tb);
    if (t.disc > 0) { var d = document.createElement('div'); d.className = 'lb-tot'; d.style.fontSize = '14px'; d.style.fontWeight = '600'; d.innerHTML = '<span></span><span></span>'; d.children[0].textContent = 'Discount ' + t.pct + '%'; d.children[1].textContent = '- ' + fmt(t.disc); box.appendChild(d); }
    var tot = document.createElement('div'); tot.className = 'lb-tot'; tot.innerHTML = '<span>Total</span><span></span>'; tot.children[1].textContent = 'Rs ' + fmt(t.total); box.appendChild(tot);
  }
  var tmr = null; function soon() { clearTimeout(tmr); tmr = setTimeout(live, 80); }
  document.addEventListener('input', soon, true); document.addEventListener('click', soon, true); document.addEventListener('change', soon, true);
  new MutationObserver(soon).observe($('itemRows'), { childList: true, subtree: true, attributes: true, attributeFilter: ['data-item-code'] });
  // wide layout only while a finished bill is on screen
  var bp = $('billPanel'), wrap = document.querySelector('.wrap');
  function sync() { wrap.classList.toggle('has-bill', bp && bp.style.display !== 'none' && bp.style.display !== ''); }
  if (bp) { new MutationObserver(sync).observe(bp, { attributes: true, attributeFilter: ['style'] }); sync(); }
  live();

  // ---- quotation ----
  function phone94(p) { var d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.indexOf('94') === 0) return d; if (d.charAt(0) === '0') return '94' + d.slice(1); return d.length === 9 ? '94' + d : d; }
  function quoteText(ls, t, name, qno) {
    var out = ['*Royal Bath Hub Thihariya*', 'QUOTATION' + (qno ? ' ' + qno : ''), new Date().toISOString().slice(0, 10) + (name ? '   Customer: ' + name : ''), ''];
    ls.forEach(function (l, i) { out.push((i + 1) + '. ' + (l.code ? '[' + l.code + '] ' : '') + l.name + '  ' + l.qty + ' x ' + fmt(l.price) + ' = ' + fmt(l.qty * l.price)); });
    out.push('');
    if (t.disc > 0) out.push('Discount ' + t.pct + '%: -' + fmt(t.disc));
    out.push('*Total: Rs ' + fmt(t.total) + '*', 'Quote valid 7 days. Thank you!');
    return out.join('\n');
  }
  function jf(u, m, b) { return fetch(u, { method: m || 'GET', credentials: 'same-origin', headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }, function () { return { ok: false, j: {} }; }); }); }
  function show(text, phone, saved) {
    var old = $('qModal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'qModal'; m.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,10,.6);z-index:50;display:flex;align-items:center;justify-content:center;padding:12px';
    var b = document.createElement('div'); b.style.cssText = 'background:#fff;color:#111;border-radius:14px;padding:16px;max-width:520px;width:100%;max-height:92vh;overflow:auto;border-top:6px solid #C9A24B';
    var h = document.createElement('h2'); h.textContent = 'Quotation'; h.style.margin = '0 0 8px';
    var ta = document.createElement('textarea'); ta.value = text; ta.readOnly = true; ta.style.cssText = 'width:100%;height:260px;font:15px/1.4 monospace;padding:8px;box-sizing:border-box';
    var note = document.createElement('div'); note.style.cssText = 'margin:6px 0;font-size:14px'; note.textContent = saved || '';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
    function btn(t, fn, gold) { var x = document.createElement('button'); x.type = 'button'; x.textContent = t; x.style.cssText = 'padding:8px 16px;min-height:40px;border-radius:8px;border:1.5px solid #888;background:' + (gold ? '#C9A24B' : '#fff') + ';font-weight:700;cursor:pointer'; x.onclick = fn; return x; }
    row.appendChild(btn('Send on WhatsApp', function () { window.open('https://wa.me/' + (phone ? phone : '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); }, true));
    row.appendChild(btn('Copy', function () { ta.select(); try { document.execCommand('copy'); note.textContent = 'Copied. Paste it anywhere.'; } catch (e) { /* ignore */ } }));
    row.appendChild(btn('Close', function () { m.remove(); }));
    b.append(h, ta, note, row); m.appendChild(b); m.addEventListener('mousedown', function (e) { if (e.target === m) m.remove(); }); document.body.appendChild(m);
  }
  $('quoteSaveBtn').addEventListener('click', function () {
    var ls = lines(); if (!ls.length) { alert('Add at least one item first.'); return; }
    var t = totals(ls), name = ($('customerName').value || '').trim(), ph = phone94($('customerPhone').value);
    var raw = ($('customerPhone').value || '').trim();
    function finish(qno, msg) { show(quoteText(ls, t, name, qno), ph, msg); }
    if (!raw) { finish('', 'Not saved in the Quotations list (type the customer phone to save it there). You can still send or copy it.'); return; }
    // save to the Quotations list: find the customer by phone, or add them, then save the quote with item codes
    jf('/api/customers').then(function (c) {
      var list = c.ok && Array.isArray(c.j) ? c.j : [], cust = list.filter(function (x) { return phone94(x.phone) === ph; })[0];
      return cust ? cust : jf('/api/customers', 'POST', { name: name || null, phone: raw, whatsapp: raw }).then(function (n) { return n.ok ? n.j : null; });
    }).then(function (cust) {
      if (!cust) return finish('', 'Could not save it in the Quotations list. You can still send or copy it.');
      return jf('/api/quotations', 'POST', { customer_id: cust.id, discount: t.disc, notes: 'From POS', items: ls.map(function (l) { return { item_code: l.code || null, description: l.name, qty: l.qty, unit_price: l.price }; }) })
        .then(function (q) { finish(q.ok ? q.j.quote_no : '', q.ok ? 'Saved in Quotations as ' + q.j.quote_no + '. Load it later with Bill tools > Load quotation.' : 'Could not save it in the Quotations list. You can still send or copy it.'); });
    }).catch(function () { finish('', 'Could not save it in the Quotations list. You can still send or copy it.'); });
  });
})();
