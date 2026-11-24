/* POS "+ Outside" item (AJ 24 Nov). Own module: remove the script tag and the button is gone.
   Shown to owner/admin always, and to the cashier only if the owner switched it on in Settings (default off). The customer never sees cost or profit.
   Popup: item name, qty, selling price (each), rough profit (each), cost (each, optional). All boxes start EMPTY.
   Save -> POST /api/outside-items (code OUT-001..., stock +qty so the sale nets it to 0) -> the line is added to the bill. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  var back = null, editing = null, editInfo = null;   // editing = the code of the outside item opened with a double-click

  function field(label, id, ph) {
    var w = el('div', 'margin:6px 0'); var l = el('label', 'display:block;font-size:12px;font-weight:600;margin-bottom:2px', label); l.setAttribute('for', id);
    var i = el('input', 'width:100%;font-size:16px;padding:7px 8px;border:1px solid #bbb;border-radius:6px;box-sizing:border-box');
    i.id = id; i.autocomplete = 'off'; i.placeholder = ph || ''; if (id !== 'outName') i.setAttribute('inputmode', 'decimal');
    w.appendChild(l); w.appendChild(i); return w;
  }
  function num(id) { var v = String($(id).value || '').replace(/,/g, '').trim(); return v === '' ? null : Number(v); }
  function close() { if (back) { back.remove(); back = null; } editing = null; editInfo = null; }
  function say(t) { var m = $('outMsg'); if (m) m.textContent = t || ''; }

  // double-click edit: change the name, price and cost of the outside item (same window as + Outside). "Real cost" also closes the estimate.
  function saveEdit(btn, name, qty, price, cost) {
    var code = editing, real = $('outReal') && $('outReal').checked, pid = editInfo && editInfo.pending_id;
    fetch('/api/outside-items/' + encodeURIComponent(code), { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, price: price, cost: cost }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (r) {
        if (!r.ok) { btn.disabled = false; return say(r.d && r.d.error ? r.d.error : 'Could not save.'); }
        var pid2 = r.d.pending_id || pid, done = function () { if (typeof window.PosEditLine === 'function') window.PosEditLine(code, { name: name, price: price, cost: cost, qty: qty }); close(); setTimeout(pay, 800); };
        if (real && pid2) fetch('/api/outside-items/' + pid2 + '/real-cost', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cost: cost, reason: 'Real cost typed in the bill window' }) }).then(done, done); else done();
      }).catch(function () { btn.disabled = false; say('No connection. Nothing was saved.'); });
  }

  function save() {
    var name = String($('outName').value || '').trim(), qty = num('outQty'), price = num('outPrice'), profit = num('outProfit'), cost = num('outCost');
    if (!name) return say('Type the item name.');
    if (!(qty > 0)) return say('Type the quantity.');
    if (!(price > 0)) return say('Type the selling price.');
    if (cost === null && profit === null) return say('Type the rough profit (or the cost).');
    var useCost = cost !== null ? cost : price - profit;
    if (useCost < 0 || price - useCost < 0) return say('No loss: the price must be above the cost.');
    var btn = $('outSave'); btn.disabled = true; say('Saving...');
    if (editing) return saveEdit(btn, name, qty, price, useCost);
    fetch('/api/outside-items', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, qty: qty, price: price, profit: profit === null ? undefined : profit, cost: cost === null ? undefined : cost }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (r) {
        btn.disabled = false;
        if (!r.ok) return say(r.d && r.d.error ? r.d.error : 'Could not save.');
        var d = r.d;
        if (typeof window.PosAddItem === 'function') window.PosAddItem({ code: d.item_code, name: d.name, price: d.price, cost: d.cost, stock: 0, unit: 'PCS' }, d.qty);
        close();
      }).catch(function () { btn.disabled = false; say('No connection. Nothing was saved.'); });
  }

  function open(code) {
    if (back) return; editing = typeof code === 'string' ? code : null;
    back = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center');
    var box = el('div', 'background:#fff;color:#111;border-radius:10px;padding:14px 16px;width:min(360px,92vw);box-shadow:0 8px 30px rgba(0,0,0,.35)');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.appendChild(el('div', 'font-size:16px;font-weight:800;margin-bottom:4px', editing ? 'Edit special item ' + editing : 'Special item'));
    box.appendChild(el('div', 'font-size:11px;color:#666;margin-bottom:4px', 'Bought from another shop for this customer. Price and profit are per piece.'));
    box.appendChild(field('Item name', 'outName', ''));
    box.appendChild(field('Qty', 'outQty', ''));
    box.appendChild(field('Selling price (each)', 'outPrice', ''));
    box.appendChild(field('Rough profit (each)', 'outProfit', ''));
    box.appendChild(field('Cost (each, optional)', 'outCost', ''));
    box.appendChild(el('div', 'font-size:11px;color:#8a6d2f;margin:2px 0', 'Cost is an estimate until you enter the real cost later.'));
    if (editing) { var rw = el('label', 'display:flex;gap:6px;align-items:center;font-size:13px;margin:4px 0'); var cb = el('input'); cb.type = 'checkbox'; cb.id = 'outReal'; rw.appendChild(cb); rw.appendChild(document.createTextNode(' This is the real cost (closes the estimate)')); box.appendChild(rw); }
    var msg = el('div', 'min-height:18px;font-size:12px;color:#b00;margin:4px 0'); msg.id = 'outMsg'; box.appendChild(msg);
    var row = el('div', 'display:flex;gap:8px;justify-content:flex-end');
    var c = el('button', 'padding:8px 14px;border:1px solid #999;background:#fff;border-radius:6px;font-size:14px', 'Cancel'); c.type = 'button'; c.onclick = close;
    var s = el('button', 'padding:8px 16px;border:0;background:#c9a24a;color:#111;border-radius:6px;font-size:14px;font-weight:700', 'Add to bill'); s.type = 'button'; s.id = 'outSave'; s.onclick = save;
    row.appendChild(c); row.appendChild(s); box.appendChild(row);
    back.appendChild(box); back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', function esc(e) { if (!back) { document.removeEventListener('keydown', esc); return; } if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    var order = ['outName', 'outQty', 'outPrice', 'outProfit', 'outCost'];   // Enter moves to the next box; Enter in the last box saves
    back.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return;
      var i = order.indexOf(e.target.id); if (i < 0) return; e.preventDefault();
      if (i < order.length - 1) { var n = $(order[i + 1]); n.focus(); n.select && n.select(); } else if ($('outSave')) $('outSave').click();
    });
    document.body.appendChild(back); $('outName').focus();
    if (editing) { var ln = typeof window.PosGetLine === 'function' ? window.PosGetLine(editing) : null; if (ln) { $('outName').value = ln.name || ''; $('outQty').value = ln.qty; $('outPrice').value = ln.price; }
      fetch('/api/outside-items/item/' + encodeURIComponent(editing), { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (!d || !back) return; editInfo = d; if (!ln) { $('outName').value = d.name; $('outPrice').value = d.price; } $('outCost').value = d.cost; $('outProfit').value = Math.round((Number($('outPrice').value || d.price) - d.cost) * 100) / 100; }); }
  }

  function mkBtn() { var b = el('button', '', '+ Special item'); b.type = 'button'; b.className = 'secondary outside-btn'; b.title = 'Sell an item bought from another shop'; b.onclick = open; return b; }
  function mount() {
    var top = document.querySelector('#picker .picker-top'), foot = document.querySelector('.item-foot'), add = $('addItemBtn');
    if (top && !top.querySelector('.outside-btn')) { var scan = $('scanBox'); var b1 = mkBtn(); if (scan && scan.nextSibling) top.insertBefore(b1, scan.nextSibling); else top.appendChild(b1); }
  }
  // The server decides: owner/admin always, the cashier only when the owner switched it on in Settings (default off).
  // 24 Nov (AJ): the answer is asked again until the server really answers (the page can open before the login is ready), and the button is re-checked every 2 s, so it never disappears until a refresh.
  var allowed = false, tries = 0;
  function pay() {
    if (!allowed) return;
    fetch('/api/outside-items/today-pay', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return; var foot = document.querySelector('.item-foot'); if (!foot) return;
      var c = $('outPay'); if (!c) { c = el('span', 'margin-left:8px;padding:3px 9px;border:1px solid #c9a24a;border-radius:12px;background:#fff8e6;font-size:12px;font-weight:700;color:#5a4300;white-space:nowrap'); c.id = 'outPay'; c.title = 'Total to pay the shops for items taken today'; foot.appendChild(c); }
      c.textContent = 'Shops to pay: today Rs ' + Number(d.total || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' \u00b7 all Rs ' + Number(d.all_total || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
      c.title = (d.items || []).map(function (i) { return i.name + ' ' + i.qty + ' x ' + i.cost + (i.real ? '' : ' (estimate)'); }).join(', ') || 'Nothing today';
    }).catch(function () {});
  }
  function check() {
    fetch('/api/outside-items/allowed', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) { if (++tries < 20) setTimeout(check, 1500); return; }
      if (d.allowed && !allowed) { allowed = true; setInterval(function () { mount(); }, 2000); setInterval(pay, 60000); mount(); pay(); }
    }).catch(function () { if (++tries < 20) setTimeout(check, 1500); });
  }
  check();

  var oldSave = save; save = function () { oldSave(); setTimeout(pay, 1500); };
  // double-click a special item line (SP-nnn) -> same window, filled in. Two quick clicks are counted by hand, because the bill redraws its lines after the first click and a browser dblclick event is then lost.
  var lastClick = { t: 0, code: '' };
  document.addEventListener('click', function (e) {
    var row = e.target.closest && e.target.closest('.item-row'); if (!row || e.target.closest('[data-field="price"],[data-field="qty"],[data-field="disc"],[data-field="total"],button')) return;
    var c = row.querySelector('[data-field="code"]'), code = c ? String(c.value || '').trim() : '', now = Date.now();
    if (!/^(OUT|OSH|SP)-\d+$/.test(code)) { lastClick = { t: 0, code: '' }; return; }
    if (lastClick.code === code && now - lastClick.t < 600) { lastClick = { t: 0, code: '' }; if (allowed) open(code); return; }
    lastClick = { t: now, code: code };
  }, true);
  // 24 Nov (AJ): the item list is a FLOATING window: drag its header row to move it, pull the corner arrow to resize it. It never pushes the bill down. Size and place are remembered.
  var st = document.createElement('style');
  st.textContent = '#picker.open{position:fixed!important;left:var(--pl,120px)!important;top:var(--pt,150px)!important;right:auto!important;width:var(--pw,720px);height:var(--ph,300px);max-width:98vw;max-height:95vh!important;min-width:340px;min-height:150px;margin:0!important;resize:both;overflow:hidden!important;display:flex!important;flex-direction:column;z-index:9999;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.35);border:2px solid #c9a24a;border-radius:10px}#picker.open .picker-results{flex:1 1 auto;max-height:none!important;height:auto!important;overflow:auto!important;min-height:40px}#picker.open .picker-head{cursor:move;user-select:none;background:#fff8e6}';
  document.head.appendChild(st);
  function fl() {
    var p = document.getElementById('picker'); if (!p || p.dataset.fl) return; p.dataset.fl = '1';
    try { var o = JSON.parse(localStorage.getItem('rbh_pick_box') || '{}'); ['pl', 'pt', 'pw', 'ph'].forEach(function (k) { if (o[k] > 0) p.style.setProperty('--' + k, o[k] + 'px'); }); } catch (x) {}
    function keep(k, v) { var o = {}; try { o = JSON.parse(localStorage.getItem('rbh_pick_box') || '{}'); } catch (x) {} o[k] = v; localStorage.setItem('rbh_pick_box', JSON.stringify(o)); }
    if (window.ResizeObserver) new ResizeObserver(function () { if (p.classList.contains('open') && p.offsetWidth > 300) { p.style.setProperty('--pw', p.offsetWidth + 'px'); p.style.setProperty('--ph', p.offsetHeight + 'px'); keep('pw', p.offsetWidth); keep('ph', p.offsetHeight); } }).observe(p);
    p.addEventListener('mousedown', function (ev) {
      if (!ev.target.closest('.picker-head')) return; ev.preventDefault();
      var x0 = ev.clientX, y0 = ev.clientY, l0 = p.offsetLeft, t0 = p.offsetTop;
      function mv(e) { var l = Math.max(0, Math.min(window.innerWidth - 120, l0 + e.clientX - x0)), t = Math.max(0, Math.min(window.innerHeight - 40, t0 + e.clientY - y0)); p.style.setProperty('--pl', l + 'px'); p.style.setProperty('--pt', t + 'px'); }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); keep('pl', parseInt(p.style.getPropertyValue('--pl'), 10) || p.offsetLeft); keep('pt', parseInt(p.style.getPropertyValue('--pt'), 10) || p.offsetTop); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  }
  setInterval(fl, 1000);
  window.PosOutside = { open: open };
})();
