/* public/pos2-screen.js: screen logic for the new POS (pos-preview2.html), wired to the real shop data through Pos2Api.
 * Items, stock, bills, void, edit, quotations, WhatsApp receipt all use the existing /api routes. Nothing is stored in this file. */
(function () {
  'use strict';
  var api = Pos2Api, $ = function (id) { return document.getElementById(id); };
  var money = function (n) { return 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rows = [], bills = [], currentBill = null, quotationMode = false, wholesale = false, discountLimit = 10, extra = 0, editingId = null, isOwner = false, quoteId = null, billedMap = {};
  var HELD = 'pos2_held';

  // ---------- date: dd/mm/yyyy ----------
  var sd = $('saleDate'); sd.value = api.isoToDMY(api.todayISO());
  sd.addEventListener('input', function () { var d = sd.value.replace(/\D/g, '').slice(0, 8), o = d.slice(0, 2); if (d.length > 2) o += '/' + d.slice(2, 4); if (d.length > 4) o += '/' + d.slice(4); if (sd.value !== o) sd.value = o; });
  function saleISO() { return api.dmyToISO(sd.value); }
  function dmyOf(ts) { try { return new Date(ts).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo' }); } catch (e) { return ''; } }

  // ---------- numbers ----------
  function lineDiscount(r) { var raw = String(r.disc == null ? '0' : r.disc).trim(); if (/%$/.test(raw)) return r.qty * r.price * Math.max(0, parseFloat(raw) || 0) / 100; return Math.max(0, parseFloat(raw) || 0) * r.qty; }
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
      return '<div class="item-row" data-index="' + i + '"><div class="item-ident"><input class="code-input" data-field="code" value="' + esc(r.code) + '" aria-label="Item code" title="Enter item code or press Down to browse"><div class="item-name"><strong>' + esc(r.name) + '</strong><small>' + esc(r.unit || '') + (r.sqm ? ' · ' + r.sqm + ' sqm/box' : '') + (r.stock != null && isFinite(r.stock) ? ' · stock ' + r.stock : '') + '</small></div></div>' +
        '<div class="qtybox"><button data-act="minus" aria-label="Decrease quantity">−</button><input data-field="qty" value="' + r.qty + '" inputmode="decimal" aria-label="Quantity"><button data-act="plus" aria-label="Increase quantity">+</button></div>' +
        '<input class="price-input" data-field="price" value="' + Number(r.price).toFixed(2) + '" inputmode="decimal" aria-label="Selling price"><input class="disc-input" data-field="disc" value="' + esc(r.disc) + '" aria-label="Discount rupees or percent">' +
        '<div class="line-total">' + money(lineTotal(r)).replace('Rs ', '') + '</div><button class="remove" data-act="remove" aria-label="Remove item">×</button></div>';
    }).join('');
    var t = totals();
    $('itemCount').textContent = rows.length + ' items'; $('netTotal').textContent = money(t.net);
    profitSoon(t);
    $('miniList').innerHTML = rows.map(function (r) { return '<div class="mini-line"><span>' + esc(r.code) + ' · ' + esc(r.name) + ' × ' + r.qty + '</span><strong>' + money(lineTotal(r)) + '</strong></div>'; }).join('') || '<div class="muted" style="padding:12px 0">No items added</div>';
    if (document.activeElement !== $('sellPrice')) $('sellPrice').value = t.net.toFixed(2);
    if (document.activeElement !== $('discountAmt')) $('discountAmt').value = t.disc.toFixed(2);
    if (document.activeElement !== $('discountPct')) $('discountPct').value = t.gross ? (t.disc / t.gross * 100).toFixed(2) : '0';
    var held = loadHeld(); $('heldCount').textContent = held.length; $('heldBtn').textContent = 'Held (' + held.length + ')';
    $('todayCount').textContent = '(' + bills.filter(function (b) { return !b.voided; }).length + ')';
    $('todayList').innerHTML = bills.slice(0, 8).map(function (b) { return '<div' + (b.voided ? ' style="text-decoration:line-through;opacity:.6"' : '') + '>' + esc(b.bill_number) + ' · ' + esc(b.customer_name || 'Walk-in') + ' · ' + money(b.total) + '</div>'; }).join('') || 'No bills yet.';
    var low = rows.filter(function (r) { return r.stock != null && r.qty > r.stock; });
    $('stockWarning').textContent = low.length ? 'Stock warning: ' + low.map(function (r) { return r.code; }).join(', ') + ' · only ' + low.map(function (r) { return r.stock; }).join(', ') + ' in stock' : '';
    $('stockWarning').style.color = low.length ? 'var(--warn)' : '';
    var last = bills[0]; if (last) { $('lastBillLabel').textContent = 'Last bill: ' + last.bill_number; $('docRef').textContent = 'Bill last ' + last.bill_number; }
  }
  var ptm, pseq = 0;   // profit comes from the owner-only /api/sale-profit; staff get nothing back, so the box stays empty
  function profitSoon(t) { clearTimeout(ptm); if (!rows.some(function (r) { return r.code; })) { $('profitValue').textContent = ''; return; } var mine = ++pseq; ptm = setTimeout(function () { api.profit(rows, t.disc).then(function (j) { if (mine !== pseq) return; $('profitValue').textContent = j ? Number(j.profit).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }); }, 350); }
  function loadToday() { return api.today().then(function (d) { bills = d.bills || []; render(); }); }

  // ---------- items ----------
  function addItem(item) {
    var ex = rows.filter(function (r) { return r.code && r.code === item.code; })[0];
    if (ex) ex.qty += 1; else rows.push(Object.assign({}, item, { qty: 1, disc: '0' }));
    render(); $('picker').classList.add('hidden'); scanMsg('');
  }
  var seq = 0;
  function openPicker() { $('picker').classList.remove('hidden'); $('scanBox').value = ''; $('scanBox').focus(); renderPicker(); }
  function renderPicker() {
    var mine = ++seq, q = $('scanBox').value.trim();
    api.items(q, 60).then(function (found) {
      if (mine !== seq) return;
      $('pickerResults').innerHTML = found.map(function (x) { return '<div class="pick-row" data-code="' + esc(x.code) + '"><span class="pick-code">' + esc(x.code) + '</span><span class="pick-name"><strong>' + esc(x.name) + '</strong><small>' + esc(x.unit) + (x.sqm ? ' · ' + x.sqm + ' sqm/box' : '') + '</small></span><span class="pick-stock">' + x.stock + '</span><span class="pick-price">' + money(x.price) + '</span></div>'; }).join('') || '<div class="muted" style="padding:12px">No matching items</div>';
      $('pickerResults')._found = found;
    });
  }
  var pt; $('scanBox').addEventListener('input', function () { clearTimeout(pt); pt = setTimeout(renderPicker, 200); });
  $('scanBox').addEventListener('keydown', function (e) {   // a scanner or typed exact code + Enter adds the item
    if (e.key !== 'Enter') return; e.preventDefault(); var v = $('scanBox').value.trim(); if (!v) return;
    api.itemByCode(v).then(function (it) { if (it) addItem(it); else { var f = $('pickerResults')._found || []; if (f.length === 1) addItem(f[0]); else scanMsg('No item with that code.', true); } });
  });
  $('pickerResults').addEventListener('click', function (e) { var row = e.target.closest('[data-code]'); if (!row) return; var it = ($('pickerResults')._found || []).filter(function (x) { return x.code === row.dataset.code; })[0]; if (it) addItem(it); });

  $('itemRows').addEventListener('click', function (e) { var row = e.target.closest('.item-row'); if (!row) return; var i = +row.dataset.index, a = e.target.dataset.act; if (a === 'remove') rows.splice(i, 1); if (a === 'plus') rows[i].qty += 1; if (a === 'minus') rows[i].qty = Math.max(0.01, rows[i].qty - 1); if (a) render(); });
  $('itemRows').addEventListener('change', function (e) {
    var row = e.target.closest('.item-row'); if (!row) return; var r = rows[+row.dataset.index], f = e.target.dataset.field;
    if (f === 'code') { api.itemByCode(e.target.value).then(function (it) { if (it) { r.code = it.code; r.name = it.name; r.stock = it.stock; r.price = it.price; r.cost = it.cost; r.unit = it.unit; r.sqm = it.sqm; scanMsg(''); } else scanMsg('Item code not found. Use Down arrow to browse.', true); render(); }); return; }
    if (f === 'qty') r.qty = Math.max(0.01, Number(e.target.value) || 1);
    if (f === 'price') r.price = Math.max(0, Number(e.target.value) || 0);
    if (f === 'disc') r.disc = e.target.value || '0';
    render();
  });
  $('itemRows').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' && e.target.dataset.field === 'code') { e.preventDefault(); openPicker(); return; }
    if (e.key !== 'Enter') return; e.preventDefault();
    var row = e.target.closest('.item-row'), i = +row.dataset.index, inputs = [].slice.call(row.querySelectorAll('input')), n = inputs.indexOf(e.target);
    e.target.dispatchEvent(new Event('change', { bubbles: true }));
    if (n < 3) inputs[n + 1].focus(); else { var all = $('itemRows').querySelectorAll('.item-row'); if (all[i + 1]) all[i + 1].querySelector('input').focus(); else openPicker(); }
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
  function askReason(title, label, btn) {
    return new Promise(function (res) {
      modal(title, '<label>' + esc(label) + '</label><input id="reasonBox" style="width:100%" autocomplete="off">', btn, function () { var v = $('reasonBox').value.trim(); if (v.length < 3) { $('reasonBox').style.borderColor = 'var(--warn)'; return; } modalDone = null; $('modalBack').classList.add('hidden'); res(v); });
      modalDone = function () { res(null); }; setTimeout(function () { var b = $('reasonBox'); if (b) b.focus(); }, 30);
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
    var phone = $('customerPhone').value.trim(); if (!phoneValid(phone)) { showError('Enter a valid Sri Lankan number (07x xxx xxxx) or an international number starting with + or 00.'); return; }
    var iso = saleISO(); if (!iso) { showError('Type the date as dd/mm/yyyy.'); return; } if (iso > api.todayISO()) { showError('The bill date cannot be in the future.'); return; }
    var p = $('paymentMethod').value; if (p === 'Credit' && !$('customerName').value.trim() && !phone) { showError('A credit bill needs the customer name or phone.'); return; }
    var cd = $('chequeDate').value ? ' ' + api.isoToDMY($('chequeDate').value) : '';
    var t = totals();
    var pl = api.billPayload({ rows: rows, disc: t.disc, name: $('customerName').value.trim(), phone: phone, method: p, chequeRef: $('chequeRef').value.trim() ? $('chequeRef').value.trim() + cd : '', split: [{ method: 'cash', amount: $('splitCash').value }, { method: 'card', amount: $('splitOther').value }], date: iso, wholesale: wholesale, quoteId: quoteId, editing: !!editingId });
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
    if (editingId) askReason('Edit bill', 'Why is this bill being changed?', 'Save changes').then(function (rs) { if (rs) go(rs); }); else go();
  }
  function clearForNext() { rows = []; extra = 0; $('customerName').value = ''; $('customerPhone').value = ''; $('chequeRef').value = ''; $('chequeDate').value = ''; $('splitCash').value = '0'; $('splitOther').value = '0'; $('paymentMethod').value = 'Cash'; sd.value = api.isoToDMY(api.todayISO()); wholesale = false; wsTag(); paymentUI(); showError(''); render(); }
  function endEdit() { editingId = null; $('editBanner').classList.add('hidden'); $('cancelEditBtn').classList.add('hidden'); $('genBtn').textContent = 'Generate Bill'; }

  // ---------- receipt ----------
  function showReceipt(b, fresh) {
    currentBill = b; var vd = !!b.voided;
    $('receiptMeta').innerHTML = '<span>' + esc(b.bill_number) + ' · ' + dmyOf(b.created_at) + (vd ? ' · <b style="color:var(--warn)">VOID</b>' : '') + '</span><span>' + esc(b.customer_name || 'Walk-in customer') + '</span>';
    $('rItems').innerHTML = (b.items || []).map(function (r) { return '<tr><td>' + esc(r.item_name) + '<br><small>' + esc(r.item_code || '') + '</small></td><td>' + Number(r.qty) + '</td><td>' + money(r.unit_price) + '</td><td>' + money(r.line_total) + '</td></tr>'; }).join('');
    var pay = (b.payments && b.payments.length) ? b.payments.map(function (p) { return p.method + ' ' + money(p.amount); }).join(' + ') : (b.payment_method || '');
    $('rTotals').innerHTML = 'Subtotal: ' + money(b.subtotal) + (Number(b.discount_amount) > 0 ? '<br>Discount: ' + money(b.discount_amount) : '') + '<br>Total: <b>' + money(b.total) + '</b><br>Payment: ' + esc(pay) + (vd && b.void_reason ? '<br>Void reason: ' + esc(b.void_reason) : '');
    $('voidBtn').classList.toggle('hidden', vd || !isOwner); $('editReceiptBtn').classList.toggle('hidden', vd || !isOwner);
    $('waReceiptMsg').textContent = ''; $('billAttach').textContent = '';
    var mt = 'mailto:?subject=' + encodeURIComponent('Your bill from Royal Bath Hub') + '&body=' + encodeURIComponent(b.bill_number + '\nTotal ' + money(b.total) + '\nRoyal Bath Hub, 074 035 5536');
    $('emailBtn').dataset.href = mt;
    var img = $('rImg'), card = img.closest('.receipt-card'); card.classList.remove('img-ok'); $('rImgWrap').classList.add('hidden');
    img.onload = function () { card.classList.add('img-ok'); $('rImgWrap').classList.remove('hidden'); };
    img.onerror = function () { card.classList.remove('img-ok'); $('rImgWrap').classList.add('hidden'); };
    img.src = '/api/pos-bills/' + b.id + '/receipt.png?t=' + Date.now();
    $('receipt').classList.remove('hidden'); $('formPanel').classList.add('hidden');
    if (fresh && $('waCheck').checked && b.customer_phone && !vd) sendWa(true);
  }
  function backToPOS() { $('receipt').classList.add('hidden'); $('formPanel').classList.remove('hidden'); }
  function sendWa(auto) {
    if (!currentBill) return; var phone = (currentBill.customer_phone || '').trim();
    if (!phone) { if (auto) return; phone = (prompt('Customer WhatsApp number for this receipt (e.g. 0771234567):') || '').trim(); if (!phone) return; }
    $('waReceiptMsg').textContent = 'Sending the receipt…';
    api.sendReceipt(currentBill.id, phone).then(function (r) {
      if (r.status === 409 && r.d && r.d.code === 'already_sent') { if (auto) return 'Receipt was already sent to this customer.'; if (!confirm(r.d.error)) return 'Not sent again.'; return api.sendReceipt(currentBill.id, phone, true).then(function (r2) { return r2.ok ? 'Receipt sent to ' + r2.d.to + '.' : 'Receipt not sent: ' + ((r2.d && r2.d.error) || r2.status); }); }
      return r.ok ? 'Receipt sent to ' + r.d.to + '.' : 'Receipt not sent: ' + ((r.d && r.d.error) || r.status);
    }).then(function (m) { $('waReceiptMsg').textContent = m || ''; }).catch(function (e) { $('waReceiptMsg').textContent = 'Receipt not sent: ' + e.message; });
  }
  $('waBtn').onclick = function () { sendWa(false); };
  $('waReceiptBtn').onclick = function () { if (!currentBill) return; var a = document.createElement('a'); a.href = '/api/pos-bills/' + currentBill.id + '/receipt.png?download=1'; a.download = currentBill.bill_number + '.png'; document.body.appendChild(a); a.click(); a.remove(); };
  $('printBtn').onclick = function () { window.print(); };
  $('emailBtn').onclick = function () { if (this.dataset.href) location.href = this.dataset.href; };
  $('voidBtn').onclick = function () {
    if (!currentBill) return; askReason('Void this bill', 'Reason (stock goes back, the bill stays on record as VOID)', 'Void bill').then(function (rs) {
      if (!rs) return; api.voidBill(currentBill.id, rs).then(function (r) { if (!r.ok) { $('waReceiptMsg').textContent = (r.d && r.d.error) || 'Could not void.'; return; } api.bill(currentBill.id).then(function (b) { showReceipt(b, false); loadToday(); }); });
    });
  };
  $('editReceiptBtn').onclick = function () {
    if (!currentBill) return; var b = currentBill; editingId = b.id;
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
      var foot = document.querySelector('.item-foot'), gr = document.querySelector('.gen-row'); if (foot && gr) foot.appendChild(gr);
    } catch (e) {}
    var row = $('custRow'), sum = $('custSum'), open = false;
    function inside() { return row.contains(document.activeElement); }
    function label() {
      var n = $('customerName').value.trim(), ph = $('customerPhone').value.trim(), d = $('saleDate').value.trim();
      sum.innerHTML = '<b>' + esc(n || 'Walk-in customer') + '</b> <span>· ' + esc(ph || 'no phone') + ' · ' + esc(d) + ($('waCheck').checked && ph ? ' · WhatsApp receipt' : '') + '</span><em>Change ✎</em>';
    }
    function tick() {
      var both = $('customerName').value.trim() && $('customerPhone').value.trim(), any = $('customerName').value.trim() || $('customerPhone').value.trim();
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
  function clearBill() { if (rows.length && !confirm('Clear everything on the screen?')) return; endEdit(); clearForNext(); }
  $('toolMenu').addEventListener('click', function (e) { var id = e.target.id; if (!id) return; $('toolMenu').classList.add('hidden');
    if (id === 'findBtn') findBill(); if (id === 'lastBtn') lastBill(); if (id === 'quoteBtn') loadQuotes(); if (id === 'quoteSaveBtn') { if (!rows.length) showError('Add at least one item first.'); else saveQuotation(); }
    if (id === 'wholesaleBtn') { wholesale = !wholesale; wsTag(); } if (id === 'clearAllBtn') clearBill(); });
  $('toolsBtn').onclick = $('toolsBtnBottom').onclick = function () { $('toolMenu').classList.toggle('hidden'); };
  $('holdBtn').onclick = $('holdBtnTop').onclick = holdBill; $('heldBtn').onclick = showHeld; $('recallTop').onclick = showHeld; $('findTop').onclick = function () { findBill(true); }; $('heldPanel').onclick = showHeld;
  $('addItemBtn').onclick = $('scanBtn').onclick = openPicker; $('pickerClose').onclick = function () { $('picker').classList.add('hidden'); };
  $('camScanBtn').onclick = function () { if (window.PosCamScan && PosCamScan.open) PosCamScan.open(function (code) { api.itemByCode(code).then(function (it) { if (it) addItem(it); else scanMsg('No item with that code.', true); }); }); else modal('Camera scan', 'The camera scanner is on the old POS screen for now.'); };
  $('paymentMethod').onchange = paymentUI; $('genBtn').onclick = generateBill;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { $('picker').classList.add('hidden'); $('toolMenu').classList.add('hidden'); closeModal(null); } if (e.key === 'F2') { e.preventDefault(); openPicker(); } if (e.key === 'F4') { e.preventDefault(); $('customerName').focus(); } });
  setInterval(function () { $('clock').textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo' }); }, 1000);

  // ---------- inside the owner app: no second menu; Quotation / Bill modes from the menu bar ----------
  try { if (window.self !== window.top) document.documentElement.classList.add('in-frame'); } catch (e) { document.documentElement.classList.add('in-frame'); }
  if (location.hash === '#quote') setMode(true);
  window.addEventListener('message', function (e) { if (e.origin !== location.origin || !e.data) return; if (e.data.pq === 'quote') setMode(true); if (e.data.pq === 'bill') setMode(false); });

  // ---------- start ----------
  api.me().then(function (u) { isOwner = !!(u && u.role === 'admin'); });
  api.cap().then(function (c) { if (c && c.max_allowed != null) discountLimit = Number(c.max_allowed); });
  paymentUI(); render(); loadToday();
  window.Pos2 = { rows: function () { return rows; }, addItem: addItem, totals: totals, generateBill: generateBill, loadToday: loadToday };
}());
