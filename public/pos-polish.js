/* POS polish (AJ 11 Nov 2026): wraps the bill page's own functions, changes none of them.
   - item rows get a Discount Rs box and column labels; the 1, 2, 3 stepper steps by whole numbers
   - the item list floats on top; down arrow and Enter work; empty rows are ignored on Generate Bill
   - bill page: Back / New bill on top, WhatsApp opens the desktop app, Download shows a message instead of a "not found" page
   Loaded after pos_extra.js. Safe to remove: the page then works as before. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var rows = function () { return Array.prototype.slice.call(document.querySelectorAll('#itemRows .item-row')); };

  // ---- labels above the rows ----
  var host = $('itemRows');
  if (host && !document.querySelector('.item-head')) {
    var head = document.createElement('div'); head.className = 'item-head';
    ['Item', 'Qty', 'Price (Rs)', 'Discount Rs', ''].forEach(function (t) { var s = document.createElement('span'); s.textContent = t; head.appendChild(s); });
    host.parentNode.insertBefore(head, host);
  }

  // ---- per item discount: the sum of the line discounts becomes the bill discount (the bill already works that out) ----
  function sumDisc() { return rows().reduce(function (s, r) { var d = r.querySelector('.i-disc'); return s + (d ? Math.max(0, parseFloat(d.value) || 0) : 0); }, 0); }
  function applyDisc() {
    var amt = $('discountAmt'); if (!amt) return;
    var s = Math.round(sumDisc() * 100) / 100;
    if (s <= 0 && !amt.dataset.fromLines) return;          // never touch a discount the cashier typed by hand
    amt.dataset.fromLines = s > 0 ? '1' : '';
    amt.value = s > 0 ? s : '';
    amt.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function decorate(row) {
    if (!row || row.dataset.polished) return; row.dataset.polished = '1';
    var q = row.querySelector('.i-qty'); if (q) q.step = 'any';
    var rm = row.querySelector('.remove-btn');
    var d = document.createElement('input'); d.type = 'number'; d.className = 'i-disc'; d.min = '0'; d.step = 'any'; d.placeholder = '0';
    d.setAttribute('inputmode', 'decimal'); d.setAttribute('aria-label', 'Discount in rupees for this item'); d.onfocus = function () { d.select(); };
    d.addEventListener('input', applyDisc);
    row.insertBefore(d, rm);
    if (rm) rm.addEventListener('click', function () { setTimeout(applyDisc, 0); });
  }
  rows().forEach(decorate);
  if (typeof window.addItemRow === 'function') {
    var origAdd = window.addItemRow;
    window.addItemRow = function () { var r = origAdd.apply(this, arguments); rows().forEach(decorate); return r; };
  }

  // ---- the floating item list: placed under the box it belongs to, flips above when there is no room ----
  function place(list) {
    var wrap = list.closest('.pick-wrap'); var box = wrap && wrap.querySelector('.i-name'); if (!box) return;
    var r = box.getBoundingClientRect(), vh = window.innerHeight, below = vh - r.bottom - 8, above = r.top - 8;
    var h = Math.min(320, Math.max(below, above), vh * 0.5);
    list.style.left = Math.max(4, r.left) + 'px'; list.style.width = Math.max(300, r.width) + 'px'; list.style.maxWidth = (window.innerWidth - 8) + 'px';
    list.style.maxHeight = h + 'px';
    list.style.top = r.bottom + 2 + 'px'; list.style.bottom = 'auto'; list.style.maxHeight = Math.max(140, Math.min(320, below)) + 'px';   // AJ 11 Nov: always BELOW the box, never flips
  }
  function placeAll() { Array.prototype.forEach.call(document.querySelectorAll('.pick-list.open'), place); }
  if (host) {
    new MutationObserver(placeAll).observe(host, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    host.addEventListener('scroll', placeAll); window.addEventListener('resize', placeAll);
  }

  // ---- keys in the item box: Down opens the list, Enter picks the best match (exact code first) ----
  function listOpen(row) { var l = row.querySelector('.pick-list'); return l && l.classList.contains('open') && l.children.length; }
  function pickBest(row, text) {
    var tries = 0, t = setInterval(function () {
      var opts = row.querySelectorAll('.pick-opt'); tries++;
      if (opts.length) {
        clearInterval(t); var want = String(text).trim().toLowerCase(), hit = opts[0];
        Array.prototype.forEach.call(opts, function (o) { var d = o.querySelector('span'); if (d && String(d.textContent).split(' · ')[0].trim().toLowerCase() === want) hit = o; });
        hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      } else if (tries > 15) { clearInterval(t); }
    }, 120);
  }
  document.addEventListener('keydown', function (e) {
    var el = e.target; if (!el || !el.classList || !el.classList.contains('i-name')) return;
    var row = el.closest('.item-row'), text = el.value; if (!row || !text.trim() || listOpen(row)) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); el.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (!row.dataset.itemCode) { el.dispatchEvent(new Event('input', { bubbles: true })); pickBest(row, text); } }
  }, true);

  // ---- Generate Bill: ignore empty rows (the extra row that opens after Enter) ----
  if (typeof window.generateBill === 'function') {
    var origGen = window.generateBill;
    window.generateBill = function () {
      var all = rows();
      all.forEach(function (r) { var n = r.querySelector('.i-name'), p = r.querySelector('.i-price'); if (all.length > 1 && n && !n.value.trim() && p && !p.value) r.remove(); });
      var dp = $('discountPct'); if (dp && parseFloat(dp.value) >= 100 && !confirm('This whole bill is FREE (100% discount). Continue?')) return;
      return origGen.apply(this, arguments);
    };
  }

  // ---- the bill page ----
  function waNumber(raw) { var d = String(raw || '').replace(/\D/g, ''); if (!d) return ''; if (d.indexOf('94') === 0) return d; if (d.charAt(0) === '0') return '94' + d.slice(1); return d; }
  function wire(bill) {
    var panel = $('billPanel'); if (!panel || !bill) return;
    var sym = 'Rs', sub = Number(bill.subtotal), disc = Number(bill.discount_amount) || 0;
    var text = ($('rShopName') ? $('rShopName').textContent : 'Royal Bath Hub Thihariya') + '\nBill: ' + bill.bill_number + '\nTotal: ' + sym + ' ' + Number(bill.total).toFixed(2) +
      (disc > 0 ? '\nReal price: ' + sym + ' ' + sub.toFixed(2) + '\nYou saved: ' + sym + ' ' + disc.toFixed(2) : '') + '\nThank you for shopping with us!';
    var temp0 = !!bill.temp;
    var wa = $('waBtn'), em = $('emailBtn'), dl = $('downloadBtn'), msg = $('waReceiptMsg'), num = waNumber(bill.customer_phone);
    // WhatsApp = the receipt as a PICTURE through the shop WhatsApp (not typed text). The text link only shows if the picture fails.
    if (wa) {
      wa.removeAttribute('target'); wa.href = '#'; wa.title = 'Sends the bill as a picture on WhatsApp';
      wa.onclick = function (ev) {
        ev.preventDefault(); if (temp0 || typeof window.sendWhatsAppReceipt !== 'function') return;
        window.sendWhatsAppReceipt(false).then(function () {
          if (msg && /not sent/i.test(msg.textContent)) {
            var a = document.createElement('a'); a.textContent = ' Send as text instead'; a.href = 'whatsapp://send?' + (num ? 'phone=' + num + '&' : '') + 'text=' + encodeURIComponent(text); a.style.fontWeight = '700';
            msg.appendChild(a);
          }
        });
      };
    }
    if (em) { em.target = '_blank'; em.rel = 'noopener'; em.href = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent('Your bill from Royal Bath Hub Thihariya') + '&body=' + encodeURIComponent(text); }
    var temp = !!bill.temp;
    var note = panel.querySelector('.temp-note');
    if (note) { note.style.display = temp ? 'block' : 'none'; note.textContent = temp ? 'Not saved on the server yet: the app was signed out. Sign in again and this bill sends by itself. Download and the WhatsApp image wait until then.' : ''; }
    [dl, $('waReceiptBtn')].forEach(function (b) { if (b) { b.classList.toggle('is-off', temp); if (b.tagName === 'BUTTON') b.disabled = temp; } });
    // Void (saved bill, owner only) or Discard (offline bill not yet on the server). One tap, asks a reason.
    var vb = $('voidBtn');
    if (vb) {
      if (bill.voided) { vb.style.display = 'none'; }
      else if (temp || (typeof isOwner !== 'undefined' && isOwner)) {
        vb.style.display = ''; vb.textContent = temp ? 'Discard this offline bill' : 'Void this bill';
        vb.onclick = function () {
          var reason = prompt(temp ? 'Why discard this bill? (it was never saved)' : 'Why void this bill? (stock goes back, cash total drops)', 'dummy bill');
          if (!reason || reason.trim().length < 3) return;
          msg.className = 'wa-receipt-msg'; msg.textContent = 'Working…';
          var done = function (t) { msg.className = 'wa-receipt-msg ok'; msg.textContent = t; vb.style.display = 'none'; if (typeof window.loadToday === 'function') window.loadToday(); };
          var fail = function (t) { msg.className = 'wa-receipt-msg err'; msg.textContent = t; };
          if (temp) {
            var q = window.OfflineQueue && window.OfflineQueue.instance;
            if (!q) return fail('Offline queue not found.');
            q.discardTempBill(bill.bill_number).then(function (ok) { ok ? done('Discarded. It was never saved, nothing to undo.') : fail('Already sent to the server: open Edit & Void and void it there.'); });
          } else {
            fetch('/api/pos-bills/' + encodeURIComponent(bill.id) + '/void', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }) })
              .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || ('error ' + r.status)); return d; }); })
              .then(function () { done('Bill voided. Stock is back and the till total dropped.'); }).catch(function (e) { fail('Could not void: ' + e.message); });
          }
        };
      } else { vb.style.display = 'none'; }
    }
    // A bill made just now with a customer number: send the picture by itself when the box is ticked. Never for an old bill opened again.
    if (!temp && num && window.__freshBillId === bill.id) {
      window.__freshBillId = null;
      var aw = $('autoWa');
      if (aw && aw.checked && typeof window.sendWhatsAppReceipt === 'function') setTimeout(function () { window.sendWhatsAppReceipt(true); }, 400);
    }
    if (dl) {
      dl.removeAttribute('target');
      dl.onclick = function (ev) {
        ev.preventDefault(); if (temp) return;
        msg.className = 'wa-receipt-msg'; msg.textContent = 'Preparing the PDF…';
        fetch('/api/pos-bills/' + encodeURIComponent(bill.id) + '/pdf', { credentials: 'same-origin' }).then(function (r) {
          if (!r.ok) throw new Error(r.status === 401 ? 'Please sign in again.' : 'The bill is not on the server yet.');
          return r.blob();
        }).then(function (b) {
          var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = String(bill.bill_number || 'bill') + '.pdf';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          msg.className = 'wa-receipt-msg ok'; msg.textContent = 'PDF saved in your Downloads.';
        }).catch(function (err) { msg.className = 'wa-receipt-msg err'; msg.textContent = 'Download failed: ' + err.message; });
      };
    }
  }
  if (typeof window.renderBill === 'function') {
    var origRender = window.renderBill;
    window.renderBill = function (bill) { var r = origRender.apply(this, arguments); try { wire(bill); } catch (e) { /* the page still works */ } return r; };
  }
})();
