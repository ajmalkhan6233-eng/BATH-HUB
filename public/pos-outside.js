/* POS "+ Outside" item (AJ 24 Nov). Own module: remove the script tag and the button is gone.
   Shown to owner/admin always, and to the cashier only if the owner switched it on in Settings (default off). The customer never sees cost or profit.
   Popup: item name, qty, selling price (each), rough profit (each), cost (each, optional). All boxes start EMPTY.
   Save -> POST /api/outside-items (code OUT-001..., stock +qty so the sale nets it to 0) -> the line is added to the bill. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  var back = null;

  function field(label, id, ph) {
    var w = el('div', 'margin:6px 0'); var l = el('label', 'display:block;font-size:12px;font-weight:600;margin-bottom:2px', label); l.setAttribute('for', id);
    var i = el('input', 'width:100%;font-size:16px;padding:7px 8px;border:1px solid #bbb;border-radius:6px;box-sizing:border-box');
    i.id = id; i.autocomplete = 'off'; i.placeholder = ph || ''; if (id !== 'outName') i.setAttribute('inputmode', 'decimal');
    w.appendChild(l); w.appendChild(i); return w;
  }
  function num(id) { var v = String($(id).value || '').replace(/,/g, '').trim(); return v === '' ? null : Number(v); }
  function close() { if (back) { back.remove(); back = null; } }
  function say(t) { var m = $('outMsg'); if (m) m.textContent = t || ''; }

  function save() {
    var name = String($('outName').value || '').trim(), qty = num('outQty'), price = num('outPrice'), profit = num('outProfit'), cost = num('outCost');
    if (!name) return say('Type the item name.');
    if (!(qty > 0)) return say('Type the quantity.');
    if (!(price > 0)) return say('Type the selling price.');
    if (cost === null && profit === null) return say('Type the rough profit (or the cost).');
    var useCost = cost !== null ? cost : price - profit;
    if (useCost < 0 || price - useCost < 0) return say('No loss: the price must be above the cost.');
    var btn = $('outSave'); btn.disabled = true; say('Saving...');
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

  function open() {
    if (back) return;
    back = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center');
    var box = el('div', 'background:#fff;color:#111;border-radius:10px;padding:14px 16px;width:min(360px,92vw);box-shadow:0 8px 30px rgba(0,0,0,.35)');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.appendChild(el('div', 'font-size:16px;font-weight:800;margin-bottom:4px', 'Outside item'));
    box.appendChild(el('div', 'font-size:11px;color:#666;margin-bottom:4px', 'Bought outside for this customer. Price and profit are per piece.'));
    box.appendChild(field('Item name', 'outName', ''));
    box.appendChild(field('Qty', 'outQty', ''));
    box.appendChild(field('Selling price (each)', 'outPrice', ''));
    box.appendChild(field('Rough profit (each)', 'outProfit', ''));
    box.appendChild(field('Cost (each, optional)', 'outCost', ''));
    box.appendChild(el('div', 'font-size:11px;color:#8a6d2f;margin:2px 0', 'Cost is an estimate until you enter the real cost later.'));
    var msg = el('div', 'min-height:18px;font-size:12px;color:#b00;margin:4px 0'); msg.id = 'outMsg'; box.appendChild(msg);
    var row = el('div', 'display:flex;gap:8px;justify-content:flex-end');
    var c = el('button', 'padding:8px 14px;border:1px solid #999;background:#fff;border-radius:6px;font-size:14px', 'Cancel'); c.type = 'button'; c.onclick = close;
    var s = el('button', 'padding:8px 16px;border:0;background:#c9a24a;color:#111;border-radius:6px;font-size:14px;font-weight:700', 'Add to bill'); s.type = 'button'; s.id = 'outSave'; s.onclick = save;
    row.appendChild(c); row.appendChild(s); box.appendChild(row);
    back.appendChild(box); back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', function esc(e) { if (!back) { document.removeEventListener('keydown', esc); return; } if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    document.body.appendChild(back); $('outName').focus();
  }

  function mkBtn() { var b = el('button', '', '+ Outside'); b.type = 'button'; b.className = 'secondary outside-btn'; b.title = 'Sell an item bought from outside'; b.onclick = open; return b; }
  function mount() {
    var top = document.querySelector('#picker .picker-top'), foot = document.querySelector('.item-foot'), add = $('addItemBtn');
    if (top && !top.querySelector('.outside-btn')) { var scan = $('scanBox'); var b1 = mkBtn(); if (scan && scan.nextSibling) top.insertBefore(b1, scan.nextSibling); else top.appendChild(b1); }
    if (foot && add && !foot.querySelector('.outside-btn')) { var b2 = mkBtn(); add.insertAdjacentElement('afterend', b2); }
  }
  // The server decides: owner/admin always, the cashier only when the owner switched it on in Settings (default off).
  fetch('/api/outside-items/allowed', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (d && d.allowed) mount();
  }).catch(function () { /* no button when unknown */ });
  window.PosOutside = { open: open };
})();
