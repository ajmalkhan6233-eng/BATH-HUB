/* public/pos2-screen.js: screen logic for the new POS (pos-preview2.html), wired to the real shop data through Pos2Api.
 * Items, stock, bills, void, edit, quotations, WhatsApp receipt all use the existing /api routes. Nothing is stored in this file. */
(function () {
  'use strict';
  var api = Pos2Api, stubs = {}, $ = function (id) { return document.getElementById(id) || (stubs[id] = stubs[id] || document.createElement('div')); };   // 21 Nov: a box this page does not have (the POS shown inside the ledger) gets an inert stand-in, so one missing box can never stop the whole screen
  var money = function (n) { return 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rows = [], bills = [], currentBill = null, quotationMode = false, wholesale = false, discountLimit = 10, extra = 0, editingId = null, origBill = null, origDate = null, isOwner = false, quoteId = null, billedMap = {};
  var HELD = 'pos2_held';

  // ---------- date: dd/mm/yyyy ----------
  var sd = $('saleDate'); sd.value = api.isoToDMY(api.todayISO());
  sd.addEventListener('input', function () {
    var pos = sd.selectionStart == null ? sd.value.length : sd.selectionStart, before = sd.value.slice(0, pos).replace(/\D/g, '').length;
    var d = sd.value.replace(/\D/g, '').slice(0, 8), o = d.slice(0, 2); if (d.length > 2) o += '/' + d.slice(2, 4); if (d.length > 4) o += '/' + d.slice(4);
    if (sd.value !== o) { sd.value = o; var np = 0, cnt = 0; while (np < o.length && cnt < before) { if (/\d/.test(o[np])) cnt++; np++; } try { sd.setSelectionRange(np, np); } catch (e) {} }
  });
  // 20 Nov (AJ): drop-down of the last 30 days to back-date a bill; typing dd/mm/yyyy still works
  (function () { var sel = $('saleDay'); if (!sel) return; var DN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], t0 = Date.parse(api.todayISO() + 'T00:00:00Z');
    for (var i = 0; i < 31; i++) { var iso = new Date(t0 - i * 86400000).toISOString().slice(0, 10), o = document.createElement('option'); o.value = iso; o.textContent = (i === 0 ? 'Today' : i === 1 ? 'Yesterday' : DN[new Date(iso + 'T00:00:00Z').getUTCDay()]) + ' ' + api.isoToDMY(iso); sel.appendChild(o); }
    sel.addEventListener('change', function () { sd.value = api.isoToDMY(sel.value); });
    sd.addEventListener('input', function () { var m = sd.value.length === 10 && api.dmyToISO(sd.value); sel.value = m && sel.querySelector('option[value="' + m + '"]') ? m : ''; }); })();
  // click anywhere in a field = caret goes exactly there (the anti-autofill readonly is lifted BEFORE the click lands)
    var smEl = $('salesman'); if (smEl) smEl.value = 'Jazeel';   // Jazeel is the default salesman on every bill (AJ 18 Nov); pick Ajmal for his own sales
  ['customerName', 'customerPhone', 'saleDate'].forEach(function (id) { var e = $(id); if (e) { e.addEventListener('pointerdown', function () { e.removeAttribute('readonly'); }); e.addEventListener('mousedown', function () { e.removeAttribute('readonly'); }); } });
  function saleISO() { return api.dmyToISO(sd.value); }
  function dmyOf(ts) { try { return new Date(ts).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo' }); } catch (e) { return ''; } }

  // ---------- numbers ----------
  function lineDiscount(r) { var raw = String(r.disc == null ? '0' : r.disc).trim(); if (/%$/.test(raw)) return r.qty * r.price * Math.max(0, parseFloat(raw) || 0) / 100; return Math.max(0, parseFloat(raw) || 0) * r.qty; }
  function effPrice(r) { return r.qty > 0 ? Math.max(0, r.price - lineDiscount(r) / r.qty) : r.price; }
  function setPrice(r, typed) {   // list price stays permanent; a lower typed price becomes a per-unit discount automatically
    typed = Math.max(0, Number(typed) || 0); if (r.list == null) r.list = r.price;
    if (typed <= r.list) { r.price = r.list; r.disc = String(Math.round((r.list - typed) * 100) / 100); } else { r.price = typed; r.disc = '0'; }
  }
  function lineTotal(r) { return Math.max(0, r.qty * r.price - lineDiscount(r)); }
  function totals() {
    var gross = 0, ld = 0, cost = 0, known = rows.length > 0;
    rows.forEach(function (r) { gross += r.qty * r.price; ld += lineDiscount(r); if (r.cost == null) known = false; else cost += r.qty * r.cost; });
    var lineNet = Math.max(0, gross - ld); if (extra > lineNet) extra = lineNet; if (extra < 0) extra = 0;
    var net = lineNet - extra;
    return { gross: gross, lineDisc: ld, lineNet: lineNet, disc: ld + extra, net: net, profit: known ? net - cost : null };
  }
  function showError(m) { $('errMsg').textContent = m || ''; }
  function scanMsg(m, bad) { var e = $('scanMsg'); e.textContent = m || ''; e.style.color = bad ? 'var(--warn)' : ''; }

  // ---------- draw ----------
  function render() {
    $('itemRows').innerHTML = rows.map(function (r, i) {
      return '<div class="item-row" data-index="' + i + '"><div class="item-ident"><span class="rno">' + (i + 1) + '</span><input class="code-input" data-field="code" value="' + esc(r.code) + '" aria-label="Item code" title="Enter item code or press Down to browse"><div class="item-name"><strong title="Double-click to edit the name on this bill">' + esc(r.name) + '</strong><small>' + esc(r.unit || '') + (r.sqm ? ' · ' + r.sqm + ' sqm/box' : '') + (r.stock != null && isFinite(r.stock) ? ' · stock ' + r.stock : '') + '</small></div>' + (r.cost != null ? '<span class="rcost" title="Cost price (owner only)">cost ' + money(r.cost).replace('Rs ', '') + '</span>' : '') + '</div>' +
        '<div class="qtybox"><button data-act="minus" aria-label="Decrease quantity">−</button><input data-field="qty" value="' + r.qty + '" inputmode="decimal" aria-label="Quantity"><button data-act="plus" aria-label="Increase quantity">+</button></div>' +
        '<input class="price-input" data-field="price" value="' + effPrice(r).toFixed(2) + '" inputmode="decimal" aria-label="Selling price"><input class="disc-input" data-field="disc" value="' + esc(r.disc) + '" aria-label="Discount rupees or percent">' +
        '<input class="price-input line-total" data-field="total" value="' + lineTotal(r).toFixed(2) + '" inputmode="decimal" aria-label="Line total" title="Type the line total: the price follows"><button class="remove" data-act="remove" aria-label="Remove item">×</button></div>';
    }).join('');
    var t = totals();
    $('itemCount').textContent = rows.length + ' items'; $('netTotal').textContent = money(t.net);
    profitSoon(t); lineProfits(t);
    $('miniList').innerHTML = rows.map(function (r) { return '<div class="mini-line"><span>' + esc(r.code) + ' · ' + esc(r.name) + ' × ' + r.qty + '</span><strong>' + money(lineTotal(r)) + '</strong></div>'; }).join('') || '<div class="muted" style="padding:12px 0">No items added</div>';
    if (document.activeElement !== $('sellPrice')) $('sellPrice').value = t.net.toFixed(2);
    if (document.activeElement !== $('discountAmt')) $('discountAmt').value = t.disc.toFixed(2);
    if ($('lessAmt') && document.activeElement !== $('lessAmt')) $('lessAmt').value = extra > 0 ? extra.toFixed(2) : '';
    if (document.activeElement !== $('discountPct')) $('discountPct').value = t.gross ? (t.disc / t.gross * 100).toFixed(2) : '0';
    var held = loadHeld(); $('heldCount').textContent = held.length; $('heldBtn').textContent = 'Held (' + held.length + ')';
    $('todayCount').textContent = '(' + bills.filter(function (b) { return !b.voided; }).length + ')';
    $('todayList').innerHTML = bills.slice(0, 8).map(function (b) { return '<div' + (b.voided ? ' style="text-decoration:line-through;opacity:.6"' : '') + '>' + esc(b.bill_number) + ' · ' + esc(b.customer_name || 'Walk-in') + ' · ' + money(b.total) + '</div>'; }).join('') || 'No bills yet.';
    var low = rows.filter(function (r) { return r.stock != null && r.qty > r.stock; });
    $('stockWarning').textContent = low.length ? 'Stock warning: ' + low.map(function (r) { return r.code; }).join(', ') + ' · only ' + low.map(function (r) { return r.stock; }).join(', ') + ' in stock' : '';
    $('stockWarning').style.color = low.length ? 'var(--warn)' : '';
    var last = bills[0]; if (last) { $('lastBillLabel').textContent = 'Last bill: ' + last.bill_number; $('docRef').textContent = 'Bill last ' + last.bill_number; }
  }
  // 22 Nov (AJ): owner only. One light line under the items: profit of line 1, line 2, line 3 ... and the bill total in the corner. Hidden when no cost is known (staff never get a cost).
  function lineProfits(t) {
    var el = $('lineProfits'); if (!el) return; var have = rows.filter(function (r) { return r.code && r.cost != null; });
    if (!have.length) { el.hidden = true; el.textContent = ''; return; }
    var fmt = function (n) { return Number(n).toLocaleString('en-LK', { maximumFractionDigits: 0 }); }, sum = 0;
    var parts = rows.map(function (r, i) { if (!r.code) return ''; if (r.cost == null) return '<span>' + (i + 1) + ': —</span>'; var p = lineTotal(r) - r.qty * r.cost; sum += p; return '<span' + (p < 0 ? ' class="neg"' : '') + '>' + (i + 1) + ': ' + fmt(p) + '</span>'; }).join('');
    var tot = t.profit != null ? t.profit : sum;
    el.innerHTML = '<div class="lp-list"><b>Profit</b> ' + parts + '</div><div class="lp-total">Total ' + fmt(tot) + '</div>'; el.hidden = false;
  }
  var ptm, pseq = 0;   // profit comes from the owner-only /api/sale-profit; staff get nothing back, so the box stays empty
  function profitSoon(t) { clearTimeout(ptm); if (!rows.some(function (r) { return r.code; })) { $('profitValue').textContent = ''; return; } var mine = ++pseq; ptm = setTimeout(function () { api.profit(rows, t.disc).then(function (j) { if (mine !== pseq) return; $('profitValue').textContent = j ? Number(j.profit).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }); }, 350); }
  function loadToday() { return api.today().then(function (d) { bills = d.bills || []; render(); }); }

  // ---------- items ----------
  function addItem(item) {
    var ex = rows.filter(function (r) { return r.code && r.code === item.code; })[0], idx;
    if (ex) { ex.qty += 1; idx = rows.indexOf(ex); } else { rows.push(Object.assign({}, item, { qty: 1, disc: '0', list: item.price })); idx = rows.length - 1; }
    render(); $('scanBox').value = ''; $('picker').classList.remove('open'); renderPicker(); scanMsg('');
    focusField(idx, 'qty');
  }
  window.PosAddItem = function (item, qty) { var ex = rows.filter(function (r) { return r.code && r.code === item.code; })[0], base = ex ? ex.qty : 0; addItem(item); var r = rows.filter(function (x) { return x.code === item.code; })[0]; if (r) { r.qty = base + Number(qty || 1); render(); } };   // used by pos-outside.js
  function focusField(i, f) { setTimeout(function () { var row = $('itemRows').querySelector('.item-row[data-index="' + i + '"]'), el = row && row.querySelector('[data-field="' + f + '"]'); if (el) { el.focus(); el.select(); } else $('scanBox').focus(); }, 30); }
  var seq = 0;
  // 21 Nov (AJ): the item list used to open ON TOP of the customer name and phone boxes. Always open it just under the customer row.
  function placePicker() { var p = $('picker'), c = $('custRow'); if (!p || !c || !p.offsetParent) return; var low = c.getBoundingClientRect().bottom; [].forEach.call(c.querySelectorAll('input,select'), function (e) { var r = e.getBoundingClientRect(); if (r.height > 0 && r.bottom > low) low = r.bottom; });   /* the lowest box in the row, even if the row is shorter */
    var top = low - p.offsetParent.getBoundingClientRect().top + 6; if (top > 0) p.style.top = Math.round(top) + 'px'; }
  function openPicker() { $('picker').classList.remove('hidden'); $('picker').classList.add('open'); $('scanBox').value = ''; $('scanBox').focus(); placePicker(); renderPicker(); }
  function renderPicker() { placePicker();
    var mine = ++seq, q = $('scanBox').value.trim();
    api.items(q, 2000).then(function (found) {   // 22 Nov (AJ): all items, the list scrolls inside its own box
      if (mine !== seq) return;
      $('pickerResults').innerHTML = found.map(function (x) { return '<div class="pick-row" data-code="' + esc(x.code) + '"><span class="pick-code">' + esc(x.code) + '</span><span class="pick-name">' + (x.supplier ? '<span class="pick-sup">' + esc(x.supplier) + '</span>' : '') + '<strong>' + esc(x.name) + '</strong><small>' + esc(x.unit) + (x.sqm ? ' · ' + x.sqm + ' sqm/box' : '') + '</small></span><span class="pick-cost">' + (x.cost == null ? '' : money(x.cost)) + '</span><span class="pick-stock">' + x.stock + '</span><span class="pick-price">' + money(x.price) + '</span></div>'; }).join('') || '<div class="muted" style="padding:12px">No matching items</div>';
      $('pickerResults')._found = found; sel = -1;
    });
  }
  $('scanBox').addEventListener('click', function () { $('picker').classList.remove('hidden'); $('picker').classList.add('open'); placePicker(); renderPicker(); });   // 23 Nov (AJ): touching the item box opens the list (it only opened after typing)
  var pt; $('scanBox').addEventListener('input', function () { $('picker').classList.add('open'); placePicker(); clearTimeout(pt); pt = setTimeout(renderPicker, 200); });
  var sel = -1;
  function pickRows() { return [].slice.call($('pickerResults').querySelectorAll('.pick-row')); }
  function pickMark(n) { var r = pickRows(); if (!r.length) { sel = -1; return; } sel = Math.max(0, Math.min(r.length - 1, n)); r.forEach(function (x, i) { x.classList.toggle('selected', i === sel); }); r[sel].scrollIntoView({ block: 'nearest' }); }
  $('scanBox').addEventListener('keydown', function (e) {   // arrows walk the list, Enter picks the highlighted item
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); $('picker').classList.add('open'); pickMark(sel < 0 ? 0 : sel + (e.key === 'ArrowDown' ? 1 : -1)); return; }
    if (e.key === 'Enter' && sel >= 0) { var f0 = $('pickerResults')._found || [], r0 = pickRows()[sel], it0 = r0 && f0.filter(function (x) { return x.code === r0.dataset.code; })[0]; if (it0) { e.preventDefault(); sel = -1; addItem(it0); return; } }
  });
  $('scanBox').addEventListener('keydown', function (e) {   // a scanner or typed exact code + Enter adds the item
    if (e.key !== 'Enter') return; e.preventDefault(); var v = $('scanBox').value.trim(); if (!v) return;
    api.itemByCode(v).then(function (it) { if (it) addItem(it); else { var f = $('pickerResults')._found || []; if (f.length === 1) addItem(f[0]); else scanMsg('No item with that code.', true); } });
  });
  $('pickerResults').addEventListener('click', function (e) { var row = e.target.closest('[data-code]'); if (!row) return; var it = ($('pickerResults')._found || []).filter(function (x) { return x.code === row.dataset.code; })[0]; if (it) addItem(it); });

  $('itemRows').addEventListener('click', function (e) { var row = e.target.closest('.item-row'); if (!row) return; var i = +row.dataset.index, a = e.target.dataset.act; if (a === 'remove') rows.splice(i, 1); if (a === 'plus') rows[i].qty += 1; if (a === 'minus') rows[i].qty = Math.max(0.01, rows[i].qty - 1); if (a) render(); });
  $('itemRows').addEventListener('dblclick', function (e) {   // 22 Nov (AJ): double-click the item name to edit it on this bill (the stock item itself is not changed)
    var st = e.target.closest('.item-name strong'); if (!st) return; var row = st.closest('.item-row'), r = rows[+row.dataset.index]; if (!r) return;
    var inp = document.createElement('input'); inp.value = r.name; inp.style.cssText = 'width:100%;font-weight:700'; st.replaceWith(inp); inp.focus(); inp.select();
    var done = false; function fin(ok) { if (done) return; done = true; if (ok && inp.value.trim()) r.name = inp.value.trim(); render(); }
    inp.addEventListener('keydown', function (k) { if (k.key === 'Enter') { k.preventDefault(); fin(true); } else if (k.key === 'Escape') fin(false); }); inp.addEventListener('blur', function () { fin(true); });
  });
  $('itemRows').addEventListener('change', function (e) {
    var row = e.target.closest('.item-row'); if (!row) return; var r = rows[+row.dataset.index], f = e.target.dataset.field;
    if (f === 'code') { api.itemByCode(e.target.value).then(function (it) { if (it) { r.code = it.code; r.name = it.name; r.stock = it.stock; r.price = it.price; r.list = it.price; r.disc = '0'; r.cost = it.cost; r.unit = it.unit; r.sqm = it.sqm; scanMsg(''); } else scanMsg('Item code not found. Use Down arrow to browse.', true); render(); }); return; }
    if (f === 'qty') r.qty = Math.max(0.01, Number(e.target.value) || 1);
    if (f === 'price') setPrice(r, e.target.value);
    if (f === 'total') { var T = Math.max(0, parseFloat(String(e.target.value).replace(/,/g, '')) || 0); if (r.qty > 0) setPrice(r, T / r.qty); }
    if (f === 'disc') r.disc = e.target.value || '0';
    render();
  });
  $('itemRows').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' && e.target.dataset.field === 'code') { e.preventDefault(); openPicker(); return; }
    if (e.key !== 'Enter') return; e.preventDefault();
    var row = e.target.closest('.item-row'), i = +row.dataset.index, f = e.target.dataset.field;
    e.target.dispatchEvent(new Event('change', { bubbles: true }));   // commits (and redraws) first
    if (f === 'code') focusField(i, 'qty'); else if (f === 'qty') focusField(i, 'price'); else { $('scanBox').value = ''; setTimeout(function () { $('scanBox').focus(); }, 30); }
  });

  // ---------- overall price / discount ----------
  $('sellPrice').addEventListener('change', function () { var t = totals(), target = Math.max(0, Number($('sellPrice').value) || 0); extra = Math.max(0, t.lineNet - target); render(); });
  $('discountAmt').addEventListener('change', function () { var t = totals(), amt = Math.max(0, Number($('discountAmt').value) || 0); extra = Math.max(0, amt - t.lineDisc); render(); capHint(); });
  $('discountPct').addEventListener('change', function () { var t = totals(), pct = Math.max(0, Number($('discountPct').value) || 0); extra = Math.max(0, t.gross * pct / 100 - t.lineDisc); render(); capHint(); });
  function capHint() { var t = totals(), pct = t.gross ? t.disc / t.gross * 100 : 0; $('capHint').textContent = pct > discountLimit ? 'Over ' + discountLimit + '%: the owner must approve this discount.' : ''; }

  // ---------- modal helpers ----------
  var modalDone = null;
  function closeModal(v) { $('modalBack').classList.add('hidden'); var f = modalDone; modalDone = null; if (f) f(v); }
  function modal(title, body, confirmText, fn) { $('modalTitle').textContent = title; $('modalBody').innerHTML = body; $('modalBack').classList.remove('hidden'); $('modalConfirm').classList.toggle('hidden', !confirmText); $('modalConfirm').textContent = confirmText || 'Confirm'; $('modalConfirm').onclick = function () { if (fn) fn(); }; modalDone = null; }
  function askReason(title, label, btn, info, prefill) {
    return new Promise(function (res) {
      modal(title, (info || '') + '<label>' + esc(label) + '</label><input id="reasonBox" style="width:100%" autocomplete="off" value="' + esc(prefill || '') + '">', btn, function () { var v = $('reasonBox').value.trim(); if (v.length < 3) { $('reasonBox').style.borderColor = 'var(--warn)'; return; } modalDone = null; $('modalBack').classList.add('hidden'); res(v); });
      modalDone = function () { res(null); }; setTimeout(function () { var b = $('reasonBox'); if (b) { b.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); $('modalConfirm').click(); } }); b.focus(); b.select(); } }, 30);
    });
  }
  $('modalCancel').onclick = function () { closeModal(null); };
  $('modalBack').onclick = function (e) { if (e.target === $('modalBack')) closeModal(null); };

  // ---------- phone ----------
  function phoneValid(v) { var s = v.trim(); if (!s) return true; var d = s.replace(/\D/g, ''); if (s.charAt(0) === '+' || s.slice(0, 2) === '00') return d.length >= 8 && d.length <= 15; if (/^0\d/.test(s)) return (d.length === 10 && /^0(?:7\d|1\d)/.test(d)) || (d.length === 9 && /^0\d/.test(d)); return false; }
  function paymentUI() { var p = $('paymentMethod').value; $('chequeBox').classList.toggle('hidden', p !== 'Cheque'); $('creditNote').classList.toggle('hidden', p !== 'Credit'); $('splitBox').classList.toggle('hidden', p !== 'Split'); }

  // ---------- generate / save bill ----------
  function generateBill() {
    showError(''); if (!rows.length) { showError('Add at least one item.'); return; }
    if (quotationMode) { return saveQuotation(); }
    var phone = $('customerPhone').value.trim();   // 21 Nov (AJ): a missing or odd phone number never blocks or nags a sale; the WhatsApp receipt is just skipped and counted in the bottom line
    var iso = saleISO(); if (!iso) { showError('Type the date as dd/mm/yyyy.'); return; } if (iso > api.todayISO()) { showError('The bill date cannot be in the future.'); return; }
    var p = $('paymentMethod').value; if (p === 'Credit' && !$('customerName').value.trim() && !phone) { showError('A credit bill needs the customer name or phone.'); return; }
    var cd = $('chequeDate').value ? ' ' + api.isoToDMY($('chequeDate').value) : '';
    var t = totals();
    var pl = api.billPayload({ rows: rows, disc: t.disc, salesman: ($('salesman') || {}).value, name: $('customerName').value.trim(), phone: phone, method: p, chequeRef: $('chequeRef').value.trim() ? $('chequeRef').value.trim() + cd : '', split: [{ method: 'cash', amount: $('splitCash').value }, { method: 'card', amount: $('splitOther').value }], date: iso, wholesale: wholesale, quoteId: quoteId, editing: !!editingId, origDate: origDate });
    if (pl.error) { showError(pl.error); return; }
    var go = function (reason) {
      if (editingId) pl.payload.reason = reason;
      var gb = $('genBtn'); gb.disabled = true; gb.textContent = editingId ? 'Saving…' : 'Generating…';
      api.saveBill(pl.payload, editingId, function () { return askReason('Discount approval', 'Reason for the extra discount (owner approval)', 'Approve & continue'); }).then(function (r) {
        if (!r.ok) throw new Error((r.d && r.d.error) || 'The bill was not saved.');
        var wasEdit = !!editingId, fresh = r.d;
        endEdit(); quoteId = null; return api.bill(fresh.id).then(function (full) { showReceipt(full || fresh, !wasEdit); clearForNext(); loadToday(); });
      }).catch(function (e) { showError(e.message); }).then(function () { gb.disabled = false; gb.textContent = editingId ? 'Save changes' : 'Generate Bill'; });
    };
    if (editingId) { var ck = editCheck(iso, t); askReason('Edit bill', 'Why is this bill being changed?', 'Save changes', ck.html, ck.only === 'date' ? 'Date changed' : '').then(function (rs) { if (rs) go(rs); }); } else go();
  }
  // 20 Nov (AJ): before an edit is saved, list exactly what differs from the saved bill (so he can see only the date, or only what he meant, changed)
  function editCheck(iso, t) {
    var b = origBill || {}, ch = [], D = api.isoToDMY, old = (b.items || []).map(function (i) { return { k: (i.item_code || '') + '|' + i.item_name, q: Number(i.qty), p: Number(i.unit_price) }; });
    if (iso !== origDate) ch.push({ k: 'date', m: 'Date: ' + D(origDate) + ' to ' + D(iso) });
    if (($('customerName').value.trim()) !== (b.customer_name || '')) ch.push({ k: 'x', m: 'Customer name' });
    if (($('customerPhone').value.trim()) !== (b.customer_phone || '')) ch.push({ k: 'x', m: 'Customer phone' });
    var nw = rows.map(function (r) { return { k: (r.code || '') + '|' + r.name, q: Number(r.qty), p: Number(r.price) }; });
    old.forEach(function (o) { var n = nw.filter(function (x) { return x.k === o.k; })[0]; if (!n) ch.push({ k: 'x', m: 'Removed: ' + o.k.split('|')[1] }); else if (n.q !== o.q || n.p !== o.p) ch.push({ k: 'x', m: o.k.split('|')[1] + ': qty ' + o.q + ' to ' + n.q + ', price ' + o.p + ' to ' + n.p }); });
    nw.forEach(function (n) { if (!old.some(function (o) { return o.k === n.k; })) ch.push({ k: 'x', m: 'Added: ' + n.k.split('|')[1] }); });
    if (Math.abs((Number(b.discount_amount) || 0) - t.disc) > 0.5) ch.push({ k: 'x', m: 'Discount: ' + money(b.discount_amount || 0) + ' to ' + money(t.disc) });
    var only = ch.length && ch.every(function (c) { return c.k === 'date'; }) ? 'date' : '';
    var head = !ch.length ? '<b>Nothing is different from the saved bill.</b>' : only ? '<b style="color:#1a7f37">Only the date is changing. Nothing else.</b>' : '<b>Changes found (' + ch.length + '):</b>';
    return { only: only, html: '<div style="margin:0 0 10px">' + head + (only || !ch.length ? '' : '<br>' + ch.map(function (c) { return '&bull; ' + esc(c.m); }).join('<br>') ) + (only ? '<br>' + esc(ch[0].m) : '') + '</div>' };
  }
  function clearForNext() { if ($('salesman')) $('salesman').value = 'Jazeel'; rows = []; extra = 0; $('customerName').value = ''; $('customerPhone').value = ''; $('chequeRef').value = ''; $('chequeDate').value = ''; $('splitCash').value = '0'; $('splitOther').value = '0'; $('paymentMethod').value = 'Cash'; sd.value = api.isoToDMY(api.todayISO()); if ($('saleDay')) $('saleDay').selectedIndex = 0; wholesale = false; wsTag(); paymentUI(); showError(''); render(); }
  function endEdit() { editingId = null; origBill = null; origDate = null; $('editBanner').classList.add('hidden'); $('cancelEditBtn').classList.add('hidden'); $('genBtn').textContent = 'Generate Bill'; }

  // ---------- receipt ----------
  function showReceipt(b, fresh) { unsentTally();
    currentBill = b; var vd = !!b.voided;
    $('receiptMeta').innerHTML = '<span>' + esc(b.bill_number) + ' · ' + dmyOf(b.created_at) + (vd ? ' · <b style="color:var(--warn)">VOID</b>' : '') + '</span><span>' + esc(b.customer_name || 'Walk-in customer') + '</span>';
    $('rItems').innerHTML = (b.items || []).map(function (r) { return '<tr><td>' + esc(r.item_name) + '<br><small>' + esc(r.item_code || '') + '</small></td><td>' + Number(r.qty) + '</td><td>' + money(r.unit_price) + '</td><td>' + money(r.line_total) + '</td></tr>'; }).join('');
    var pay = (b.payments && b.payments.length) ? b.payments.map(function (p) { return p.method + ' ' + money(p.amount); }).join(' + ') : (b.payment_method || '');
    $('rTotals').innerHTML = 'Subtotal: ' + money(b.subtotal) + (Number(b.discount_amount) > 0 ? '<br>Discount: ' + money(b.discount_amount) : '') + '<br>Total: <b>' + money(b.total) + '</b><br>Payment: ' + esc(pay) + (vd && b.void_reason ? '<br>Void reason: ' + esc(b.void_reason) : '');
    $('voidBtn').classList.toggle('hidden', vd || !isOwner); $('editReceiptBtn').classList.toggle('hidden', vd || !isOwner);
    $('waReceiptMsg').textContent = ''; $('billAttach').textContent = '';
    var mt = 'mailto:?subject=' + encodeURIComponent('Your bill from Royal Bath Hub') + '&body=' + encodeURIComponent(b.bill_number + '\nTotal ' + money(b.total) + '\nRoyal Bath Hub, 074 035 5536');
    $('emailBtn').dataset.href = mt;
    var img = $('rImg'), card = img.closest('.receipt-card'); card.classList.add('img-ok'); $('rImgWrap').classList.remove('hidden'); $('rImgWrap').classList.add('loading');
    var tries = 0, wrap = $('rImgWrap'), ld = wrap.querySelector('.rload');
    ld.textContent = 'Drawing your receipt…';
    img.onload = function () { card.classList.add('img-ok'); wrap.classList.remove('loading'); };
    img.onerror = function () {
      if (tries++ < 3) { ld.textContent = 'Drawing your receipt… (try ' + (tries + 1) + ')'; setTimeout(function () { img.src = '/api/pos-bills/' + b.id + '/receipt.png?t=' + Date.now(); }, 1500); return; }
      ld.innerHTML = 'Picture not ready yet. <button type="button" id="rRetry" style="padding:4px 12px">Try again</button>';
      var rb = document.getElementById('rRetry'); if (rb) rb.onclick = function () { tries = 0; ld.textContent = 'Drawing your receipt…'; img.src = '/api/pos-bills/' + b.id + '/receipt.png?t=' + Date.now(); };
    };
    img.src = '/api/pos-bills/' + b.id + '/receipt.png?t=' + Date.now();
    $('receipt').classList.remove('hidden'); $('formPanel').classList.add('hidden');
    if (fresh && $('waCheck').checked && b.customer_phone && !vd) sendWa(true);
  }
  function backToPOS() { $('receipt').classList.add('hidden'); $('formPanel').classList.remove('hidden'); $('picker').classList.remove('hidden'); renderPicker(); setTimeout(function () { var d = $('saleDate'); if (d) { d.removeAttribute('readonly'); d.focus(); d.select(); } }, 60); }
  // quiet running count under the screen: receipts not sent today (no phone or failed). Information only.
  function unsentTally() { fetch('/api/invoice-receipts/unsent', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { var el = document.getElementById('waTally'); if (!el || !d) return; el.textContent = d.unsent ? 'Receipts not sent today: ' + d.unsent + ' (no phone ' + d.today.no_phone + ', failed ' + d.today.failed + ')' : ''; }).catch(function () {}); }
  setTimeout(unsentTally, 1500);
  function sendWa(auto) {
    if (!currentBill) return; var phone = (currentBill.customer_phone || '').trim();
    if (!phone) { if (auto) return; phone = (prompt('Customer WhatsApp number for this receipt (e.g. 0771234567):') || '').trim(); if (!phone) return; }
    $('waReceiptMsg').textContent = 'Sending the receipt…';
    api.sendReceipt(currentBill.id, phone).then(function (r) {
      if (r.status === 409 && r.d && r.d.code === 'already_sent') { if (auto) return 'Receipt was already sent to this customer.'; if (!confirm(r.d.error)) return 'Not sent again.'; return api.sendReceipt(currentBill.id, phone, true).then(function (r2) { return r2.ok ? 'Receipt sent to ' + r2.d.to + '.' : 'Receipt not sent: ' + ((r2.d && r2.d.error) || r2.status); }); }
      return r.ok ? 'Receipt sent to ' + r.d.to + '.' : (auto ? 'Receipt not sent, counted.' : 'Receipt not sent: ' + ((r.d && r.d.error) || r.status));
    }).then(function (m) { $('waReceiptMsg').textContent = m || ''; }).catch(function (e) { $('waReceiptMsg').textContent = auto ? 'Receipt not sent, counted.' : 'Receipt not sent: ' + e.message; }).then(unsentTally);
  }
  if ($('waBtn')) $('waBtn').onclick = function () { sendWa(false); };
  if ($('waReceiptBtn')) $('waReceiptBtn').onclick = function () { if (!currentBill) return; window.open('/api/pos-bills/' + currentBill.id + '/receipt.png', '_blank'); };
  if ($('rImgDl')) $('rImgDl').onclick = function () { if (!currentBill) return; var a = document.createElement('a'); a.href = '/api/pos-bills/' + currentBill.id + '/receipt.png?download=1'; a.download = currentBill.bill_number + '.png'; document.body.appendChild(a); a.click(); a.remove(); };
  if ($('printBtn')) $('printBtn').onclick = function () { window.print(); };
  if ($('emailBtn')) $('emailBtn').onclick = function () { if (this.dataset.href) location.href = this.dataset.href; };
  if ($('voidBtn')) $('voidBtn').onclick = function () {
    if (!currentBill) return; askReason('Void this bill', 'Reason (stock goes back, the bill stays on record as VOID)', 'Void bill').then(function (rs) {
      if (!rs) return; api.voidBill(currentBill.id, rs).then(function (r) { if (!r.ok) { $('waReceiptMsg').textContent = (r.d && r.d.error) || 'Could not void.'; return; } api.bill(currentBill.id).then(function (b) { showReceipt(b, false); loadToday(); }); });
    });
  };
  $('editReceiptBtn').onclick = function () {
    if (!currentBill) return; var b = currentBill; editingId = b.id; origBill = b; origDate = new Date(b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }); sd.value = api.isoToDMY(origDate); if ($('saleDay')) $('saleDay').value = origDate;
    rows = (b.items || []).map(function (i) { return { code: i.item_code || '', name: i.item_name, qty: Number(i.qty), price: Number(i.unit_price), disc: '0', stock: null, cost: null, unit: '' }; });
    extra = Number(b.discount_amount) || 0; $('customerName').value = b.customer_name || ''; $('customerPhone').value = b.customer_phone || '';
    $('editBanner').textContent = 'Editing ' + b.bill_number + '. Change it and press Save changes.'; $('editBanner').classList.remove('hidden'); $('cancelEditBtn').classList.remove('hidden'); $('genBtn').textContent = 'Save changes';
    backToPOS(); render();
    rows.forEach(function (r) { if (r.code) api.itemByCode(r.code).then(function (it) { if (it) { r.stock = it.stock; r.cost = it.cost; r.unit = it.unit; render(); } }); });
  };
  $('cancelEditBtn').onclick = function () { endEdit(); clearForNext(); };
  $('backPosBtn').onclick = backToPOS; $('newBillBtn').onclick = function () { backToPOS(); clearForNext(); };

  // ---------- held bills: the SAME store as the old POS (this browser, key pos_held_bills), so held bills carry over both ways ----------
  function loadHeld() { return PosCart.loadHeld(); }
  function holdBill() {
    if (!rows.length) { showError('Add at least one item before holding.'); return; }
    var t = totals(), pct = t.gross ? Math.round(t.disc / t.gross * 1e8) / 1e6 : 0;   // item discounts + extra become one bill discount %
    var r = PosCart.holdAdd(loadHeld(), PosCart.makeHeld({ customer_name: $('customerName').value, customer_phone: $('customerPhone').value, discount_pct: pct, payment_method: $('paymentMethod').value.toLowerCase(),
      rows: rows.map(function (x) { return { item_code: x.code, name: x.name, qty: x.qty, unit_price: x.price }; }) }));
    if (!r.ok) { showError(r.reason === 'full' ? 'Held bills are full (max ' + PosCart.MAX_HELD + '). Resume or delete one first.' : 'Nothing to hold: add an item first.'); return; }
    PosCart.saveHeld(undefined, r.list); clearForNext(); $('heldPanel').innerHTML = 'Held bills: <strong id="heldCount">' + loadHeld().length + '</strong> · Last held bill saved on this device.'; render();
  }
  function heldCountSync() { try { var n = loadHeld().length; $('recallN').textContent = n; $('heldPanel').innerHTML = 'Held bills: <strong id="heldCount">' + n + '</strong> · ' + (n ? 'Tap here or Recall held to bring one back' : 'No held bills'); $('heldBtn').textContent = 'Held (' + n + ')'; } catch (e) {} }
  setInterval(heldCountSync, 1500); setTimeout(heldCountSync, 300);

  // ---------- 17 Nov: one top line + customer details fold up once typed ----------
  (function layoutTidy() {
    try {
      var dl = document.querySelector('.docline'), tabs = dl && dl.querySelector('.doc-tabs');
      if (dl && tabs) { tabs.appendChild($('lastBillLabel')); dl.appendChild($('posTools')); }
      var ih = document.querySelector('.item-head'); if (ih && $('picker') && ih.parentNode) { ih.parentNode.insertBefore($('picker'), ih); $('picker').classList.remove('hidden'); renderPicker(); }
      var foot = document.querySelector('.item-foot'), gr = document.querySelector('.gen-row'); if (foot && gr) foot.appendChild(gr);
    } catch (e) {}
    var row = $('custRow'), sum = $('custSum'), open = false;
    function inside() { return row.contains(document.activeElement); }
    function label() {
      var n = $('customerName').value.trim(), ph = $('customerPhone').value.trim(), d = $('saleDate').value.trim();
      sum.innerHTML = '<b>' + esc(n || 'Walk-in customer') + '</b> <span>· ' + esc(ph || 'no phone') + ' · ' + esc(d) + ($('waCheck').checked && ph ? ' · WhatsApp receipt' : '') + '</span><em>Change ✎</em>';
    }
    function tick() {
      var nm = $('customerName').value.trim(), both = $('customerPhone').value.trim() || (nm && nm.toLowerCase() !== 'cash'), any = $('customerName').value.trim() || $('customerPhone').value.trim();
      var fold = both && !inside() && !open;
      if (!any) open = false;
      row.classList.toggle('folded', !!fold); sum.classList.toggle('hidden', !fold);
      if (fold) label();
    }
    sum.onclick = function () { open = true; row.classList.remove('folded'); sum.classList.add('hidden'); $('customerName').focus(); };
    row.addEventListener('focusout', function () { setTimeout(function () { if (!inside()) { open = false; tick(); } }, 150); });
    setInterval(tick, 700); setTimeout(tick, 300);
  })();
  ['customerName', 'customerPhone'].forEach(function (id) { var e = $(id); if (e) { e.setAttribute('autocomplete', 'nope'); e.setAttribute('data-lpignore', 'true'); } });
  // 22 Nov (AJ): no old-number suggestions (the browser's saved-entries list) on any money/qty/code box; only the customer boxes keep their own rule above
  (function () { var off = function (e) { if (e && e.tagName === 'INPUT' && e.id !== 'customerName' && e.id !== 'customerPhone') { e.setAttribute('autocomplete', 'off'); e.setAttribute('data-lpignore', 'true'); } };
    document.querySelectorAll('input').forEach(off); document.addEventListener('focusin', function (ev) { off(ev.target); }, true); })();
  var cn = $('customerName'); if (cn) cn.addEventListener('input', function () {
    var v = cn.value, o = v.replace(/(^|[\s.\-'])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
    if (o !== v) { var st = cn.selectionStart; cn.value = o; try { cn.setSelectionRange(st, st); } catch (e) {} }
  });
  // total-bill reduction: 'Less (Rs)' takes an amount off the final total
  var la = $('lessAmt'); if (la) la.addEventListener('change', function () { extra = Math.max(0, Number(la.value) || 0); render(); capHint(); });
  // Enter walks the top row: date -> customer -> WhatsApp phone -> item box (no mouse needed)
  [['saleDate', 'customerName'], ['customerName', 'customerPhone'], ['customerPhone', 'scanBox']].forEach(function (p2) {
    var a = $(p2[0]); if (!a) return;
    a.addEventListener('keydown', function (e) { if (e.key !== 'Enter') return; e.preventDefault(); var b = $(p2[1]); if (b) { b.removeAttribute('readonly'); b.focus(); if (b.select && p2[1] !== 'scanBox') b.select(); } });
  });
  // 22 Nov (AJ): press Enter on a known customer's name and his phone number appears in the phone box (only when that box is empty; the name is matched against the saved customers, exact first, then the only name that starts with what was typed)
  var custList = null;
  function loadCusts() { return custList ? Promise.resolve(custList) : fetch('/api/customers', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) { custList = Array.isArray(d) ? d : (d && Array.isArray(d.rows) ? d.rows : []); return custList; }).catch(function () { return []; }); }
  var cnEl = $('customerName'); if (cnEl) cnEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return; var q = cnEl.value.trim().toLowerCase(), ph = $('customerPhone'); if (!q || !ph || ph.value.trim()) return;
    loadCusts().then(function (list) {
      var withPh = list.filter(function (c) { return c && c.name && c.phone; }), hit = withPh.filter(function (c) { return String(c.name).trim().toLowerCase() === q; })[0];
      if (!hit) { var pre = withPh.filter(function (c) { return String(c.name).trim().toLowerCase().indexOf(q) === 0; }); if (pre.length === 1) hit = pre[0]; }
      if (hit && !ph.value.trim()) { cnEl.value = hit.name; ph.value = hit.phone; ph.removeAttribute('readonly'); ph.focus(); ph.select(); }
    });
  });
  setTimeout(function () { if (document.activeElement === document.body && $('saleDate')) { $('saleDate').focus(); $('saleDate').select(); } }, 900);
  function showHeld() {
    var h = loadHeld(); if (!h.length) { modal('Held bills', '<p>No held bills.</p>'); return; }
    modal('Held bills', h.map(function (x) { var tt = PosCart.totals(x.rows, x.discount_pct).total; return '<p><b>' + new Date(x.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '</b> · ' + esc(x.customer_name || 'Walk-in') + ' · ' + x.rows.length + ' item(s) · ' + money(tt) + ' <button class="secondary small" data-r="' + esc(x.id) + '">Resume</button> <button class="secondary small" data-d="' + esc(x.id) + '">Delete</button></p>'; }).join(''));
    $('modalBody').onclick = function (e) {
      var r = e.target.dataset.r, d = e.target.dataset.d;
      if (d) { PosCart.saveHeld(undefined, PosCart.holdRemove(loadHeld(), d)); closeModal(null); render(); return; }
      if (!r) return; var x = PosCart.holdGet(loadHeld(), r); if (!x) return;
      if (rows.length && !confirm('Replace the items on the screen with this held bill?')) return;
      PosCart.saveHeld(undefined, PosCart.holdRemove(loadHeld(), r)); closeModal(null);
      rows = x.rows.map(function (y) { return { code: y.item_code, name: y.name, qty: y.qty, price: y.unit_price, disc: '0', stock: null, cost: null, unit: '' }; });
      var sub = rows.reduce(function (a, y) { return a + y.qty * y.price; }, 0); extra = sub * (x.discount_pct || 0) / 100;
      $('customerName').value = x.customer_name || ''; $('customerPhone').value = x.customer_phone || '';
      var pm = { cash: 'Cash', card: 'Card', online: 'Online transfer', cheque: 'Cheque', credit: 'Credit', split: 'Split' }[x.payment_method]; if (pm) $('paymentMethod').value = pm; paymentUI(); render();
      rows.forEach(function (y) { if (y.code) api.itemByCode(y.code).then(function (it) { if (it) { y.stock = it.stock; y.cost = it.cost; y.unit = it.unit; render(); } }); });
    };
  }

  // ---------- find bill / last bill ----------
  function openBill(id) { api.bill(id).then(function (b) { if (b) { closeModal(null); showReceipt(b, false); } }); }
  function findBill(openToday) {
    modal('Find bill', '<div class="findbar"><label>Date</label><input id="findDate" style="width:110px" placeholder="dd/mm/yyyy" maxlength="10" inputmode="numeric" autocomplete="nope"><button class="secondary small" id="fdToday">Today</button><button class="secondary small" id="fdYest">Yesterday</button><button class="secondary small" id="fdAll">All days</button></div>' +
      '<div class="findbar"><input id="findBox" style="flex:1" placeholder="Bill number, customer or phone (e.g. RBH-S012)" autocomplete="nope"></div><div id="findResults"></div>');
    var inp = $('findBox'), out = $('findResults'), dt = $('findDate'), tm;
    function iso(off) { var d = new Date(Date.now() + 19800000 - (off || 0) * 86400000); return d.toISOString().slice(0, 10); }
    function setDay(off) { dt.value = api.isoToDMY(iso(off)); run(); }
    function day(b) { return dmyOf(b.created_at); }
    function rowHtml(b) { return '<div class="billrow"><span><b>' + esc(b.bill_number) + '</b> · ' + esc(b.customer_name || 'Walk-in') + ' · ' + money(b.total) + (b.voided ? ' · <b style="color:var(--warn)">VOID</b>' : '') + '</span><button class="secondary small" data-open="' + b.id + '">Open</button></div>'; }
    function run() {
      var d = dt.value.trim(), isoD = d ? api.dmyToISO(d) : '';
      if (d && !isoD) { out.innerHTML = '<p class="muted">Type the date as dd/mm/yyyy</p>'; return; }
      (isoD ? api.findDay(isoD, inp.value) : api.find(inp.value)).then(function (a) {
        if (!a.length) { out.innerHTML = '<p class="muted">No bills found' + (isoD ? ' on ' + esc(d) : '') + '.</p>'; return; }
        if (isoD) { var tot = a.filter(function (b) { return !b.voided; }).reduce(function (x, b) { return x + Number(b.total); }, 0); out.innerHTML = '<div class="dayhead"><span>' + esc(d) + ' · ' + a.length + ' bills</span><span>' + money(tot) + '</span></div>' + a.map(rowHtml).join(''); return; }
        var cur = '', h = ''; a.slice(0, 60).forEach(function (b) { var dd = day(b); if (dd !== cur) { cur = dd; h += '<div class="dayhead"><span>' + esc(dd) + '</span></div>'; } h += rowHtml(b); }); out.innerHTML = h;
      });
    }
    dt.oninput = function () { var v = dt.value.replace(/[^0-9]/g, '').slice(0, 8); if (v.length > 4) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4); else if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); dt.value = v; clearTimeout(tm); tm = setTimeout(run, 250); };
    inp.oninput = function () { clearTimeout(tm); tm = setTimeout(run, 200); };
    $('fdToday').onclick = function () { setDay(0); }; $('fdYest').onclick = function () { setDay(1); }; $('fdAll').onclick = function () { dt.value = ''; run(); };
    out.onclick = function (e) { if (e.target.dataset.open) openBill(e.target.dataset.open); };
    setDay(0); inp.focus();
  }
  function lastBill() { api.today().then(function (d) { var b = (d.bills || [])[0]; if (b) openBill(b.id); else modal('Last bill', 'No bill has been made today.'); }); }

  // ---------- quotations ----------
  function saveQuotation() {
    var t = totals(), ph = $('customerPhone').value.trim(); if (!ph) { showError('Type the customer phone to save a quotation.'); return; }
    if (!phoneValid(ph)) { showError('Check the phone number.'); return; }
    api.saveQuote({ rows: rows, disc: t.disc, name: $('customerName').value.trim(), phone: ph }).then(function (r) { if (r.ok && r.d) { modal('Quotation saved', 'Saved as <b>' + esc(r.d.quote_no || '') + '</b>.'); } else showError((r.d && r.d.error) || 'Could not save the quotation.'); });
  }
  function loadQuotes() {
    modal('Load quotation', '<div id="quotePanel"><input id="quoteBox" style="width:100%" placeholder="Quote number or customer" autocomplete="off"><div id="quoteResults" style="margin-top:10px">Loading…</div></div>');
    var list = [];
    function draw() { var f = $('quoteBox').value.trim().toLowerCase(), o = $('quoteResults'); var a = list.filter(function (q) { return !f || String(q.quote_no || '').toLowerCase().indexOf(f) >= 0 || String(q.customer_name || '').toLowerCase().indexOf(f) >= 0; }).slice(0, 15); o.innerHTML = a.map(function (q) { return '<p>' + esc(q.quote_no || 'Q-' + q.id) + ' · ' + esc(q.customer_name || 'No customer') + ' · ' + money(q.total) + (billedMap[q.id] ? ' · Already billed (' + esc(billedMap[q.id]) + ')' : '') + ' <button class="secondary small" data-q="' + q.id + '">Load</button></p>'; }).join('') || 'No quotations.'; }
    Promise.all([api.quotes(), api.quoteBilled()]).then(function (x) { list = x[0]; billedMap = x[1] || {}; draw(); });
    $('quoteBox').oninput = draw;
    $('quoteResults').onclick = function (e) { var id = e.target.dataset.q; if (!id) return; if (billedMap[id] && !confirm('This quotation was already billed as ' + billedMap[id] + '. Load it again?')) return;
      api.quote(id).then(function (qj) { if (!qj) { scanMsg('Could not open that quotation.', true); return; } var c = PosCart.quotationToCart(qj); if (!c.rows.length) { scanMsg('That quotation has no items.', true); return; } if (rows.length && !confirm('Replace the items on the screen with ' + c.quote_no + '?')) return;
        closeModal(null); rows = c.rows.map(function (r) { return { code: r.item_code, name: r.name, qty: r.qty, price: r.unit_price, disc: '0', stock: null, cost: null, unit: '' }; });
        var sub = rows.reduce(function (s, r) { return s + r.qty * r.price; }, 0); extra = sub * c.discount_pct / 100; quoteId = qj.id || id; $('customerName').value = c.customer_name; $('customerPhone').value = c.customer_phone; render();
        scanMsg('Loaded ' + c.quote_no + (c.matches ? '.' : ': the quotation said ' + money(c.quote_total) + '. Check the prices.'), !c.matches);
        rows.forEach(function (r) { if (r.code) api.itemByCode(r.code).then(function (it) { if (it) { r.stock = it.stock; r.cost = it.cost; r.unit = it.unit; render(); } }); }); });
    };
  }
  function setMode(q) { quotationMode = q; $('quotationTab').classList.toggle('active', q); $('billTab').classList.toggle('active', !q); $('modeLabel').textContent = q ? 'Quotation mode' : 'New sale · LKR'; $('genBtn').textContent = q ? 'Save quotation' : 'Generate Bill'; }
  $('billTab').onclick = function () { setMode(false); }; $('quotationTab').onclick = function () { setMode(true); };

  // ---------- tools ----------
  function wsTag() { var b = $('wholesaleBtn'); b.textContent = 'Wholesale bill: ' + (wholesale ? 'ON' : 'OFF'); b.style.fontWeight = wholesale ? '700' : ''; }
  function newBill() { if (rows.length && !confirm('Start a new bill? Everything on this bill will be cleared.')) return; endEdit(); clearForNext(); backToPOS(); }
  function clearBill() { if (rows.length && !confirm('Clear everything on the screen?')) return; endEdit(); clearForNext(); backToPOS(); }
  if ($('newBillTop')) $('newBillTop').onclick = newBill;
  $('toolMenu').addEventListener('click', function (e) { var id = e.target.id; if (!id) return; $('toolMenu').classList.add('hidden');
    if (id === 'findBtn') findBill(); if (id === 'lastBtn') lastBill(); if (id === 'quoteBtn') loadQuotes(); if (id === 'quoteSaveBtn') { if (!rows.length) showError('Add at least one item first.'); else saveQuotation(); }
    if (id === 'wholesaleBtn') { wholesale = !wholesale; wsTag(); } if (id === 'clearAllBtn') clearBill(); });
  $('toolsBtn').onclick = $('toolsBtnBottom').onclick = function () { $('toolMenu').classList.toggle('hidden'); };
  $('holdBtn').onclick = $('holdBtnTop').onclick = holdBill; $('heldBtn').onclick = showHeld; $('recallTop').onclick = showHeld; $('findTop').onclick = function () { findBill(true); }; $('heldPanel').onclick = showHeld;
  $('addItemBtn').onclick = $('scanBtn').onclick = openPicker; $('pickerClose').onclick = function () { $('picker').classList.remove('open'); $('scanBox').value = ''; };
  $('camScanBtn').onclick = function () { if (window.PosCamScan && PosCamScan.open) PosCamScan.open(function (code) { api.itemByCode(code).then(function (it) { if (it) addItem(it); else scanMsg('No item with that code.', true); }); }); else modal('Camera scan', 'The camera scanner is on the old POS screen for now.'); };
  $('paymentMethod').onchange = paymentUI; $('genBtn').onclick = generateBill;
  document.addEventListener('keydown', function (e) {
    if ($('receipt') && !$('receipt').classList.contains('hidden')) return;
    var k = e.key, rowsEl = $('itemRows'), last = rowsEl && rowsEl.querySelector('.item-row:last-child');
    function go(el) { if (el) { e.preventDefault(); el.removeAttribute && el.removeAttribute('readonly'); el.focus(); if (el.select) el.select(); } }
    function fld(n) { return last && last.querySelector('[data-field="' + n + '"]'); }
    if (k === 'F2') { go($('scanBox')); }
    else if (k === 'F3') { e.preventDefault(); openPicker(); }
    else if (k === 'F4') { e.preventDefault(); $('custRow').classList.remove('folded'); $('custSum').classList.add('hidden'); $('customerName').focus(); }
    else if (k === 'F6') { go(fld('qty')); } else if (k === 'F7') { go(fld('price')); } else if (k === 'F8') { go(fld('disc')); }
    else if (k === 'F9') { go($('paymentMethod')); } else if (k === 'F10') { go($('genBtn')); }
    else if (k === 'Enter' && e.ctrlKey && $('genBtn') && !$('genBtn').disabled) { e.preventDefault(); $('genBtn').click(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { $('picker').classList.add('hidden'); $('toolMenu').classList.add('hidden'); closeModal(null); } if (e.key === 'F2') { e.preventDefault(); openPicker(); } if (e.key === 'F4') { e.preventDefault(); $('customerName').focus(); } });
  setInterval(function () { $('clock').textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo' }); }, 1000);

  // ---------- inside the owner app: no second menu; Quotation / Bill modes from the menu bar ----------
  try { if (window.self !== window.top) document.documentElement.classList.add('in-frame'); } catch (e) { document.documentElement.classList.add('in-frame'); }
  if (location.hash === '#quote') setMode(true);
  window.addEventListener('message', function (e) { if (e.origin !== location.origin || !e.data) return; if (e.data.pq === 'quote') setMode(true); if (e.data.pq === 'bill') setMode(false); if (e.data.pq === 'openbill') openBillById(e.data.id); });
  // 21 Nov: open an existing bill (full receipt + Edit button) from another screen: message {pq:'openbill', id} or the address #bill=ID
  function openBillById(id) { id = Number(id); if (!id) return; api.bill(id).then(function (b) { if (b && b.id) showReceipt(b, false); }); }
  var hb = /^#bill=(\d+)$/.exec(location.hash || ''); if (hb) openBillById(hb[1]);

  // ---------- start ----------
  api.me().then(function (u) { isOwner = !!(u && u.role === 'admin'); });
  api.cap().then(function (c) { if (c && c.max_allowed != null) discountLimit = Number(c.max_allowed); });
  paymentUI(); render(); loadToday();
  window.Pos2 = { rows: function () { return rows; }, addItem: addItem, totals: totals, generateBill: generateBill, loadToday: loadToday };
}());
