/* BLOCK: vendor-voucher-ui. One isolated module: window.openVendorVoucher(vendorName). Shows the voucher picture, lets AJ send it on WhatsApp. */
(function () {
  function el(t, css, html) { var e = document.createElement(t); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }
  function q(u, o) { return fetch(u, Object.assign({ credentials: 'same-origin' }, o || {})).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); }); }
  window.openVendorVoucher = function (vendor) {
    var old = document.getElementById('vvBox'); if (old) old.remove();
    var box = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:12px');
    box.id = 'vvBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Payment voucher');
    var card = el('div', 'background:#fffdf7;color:#0B1B3A;border-radius:16px;max-width:520px;width:100%;padding:14px;font:16px system-ui,sans-serif');
    var url = '/api/vendor-voucher/preview?vendor=' + encodeURIComponent(vendor);
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b>Payment voucher</b><button id="vvX" type="button" style="min-height:44px;min-width:44px;border:0;background:transparent;font-size:22px">&times;</button></div>' +
      '<div id="vvImg" style="margin:8px 0;min-height:120px;text-align:center;color:#5b6070">Drawing the voucher...</div>' +
      '<label style="display:block;font-size:14px;color:#5b6070">WhatsApp number (leave empty to use the saved one)</label>' +
      '<input id="vvPh" inputmode="tel" placeholder="0771234567" style="width:100%;min-height:44px;font-size:16px;border:1px solid #c9a24b;border-radius:10px;padding:8px;margin:4px 0 8px">' +
      '<div style="display:flex;gap:8px"><button id="vvSend" type="button" style="flex:1;min-height:48px;border:0;border-radius:12px;background:#C9A24B;color:#0B1B3A;font-weight:700;font-size:16px">Send on WhatsApp</button>' +
      '<a id="vvSave" download="payment-voucher.png" style="flex:0 0 auto;min-height:48px;display:flex;align-items:center;padding:0 14px;border:1px solid #c9a24b;border-radius:12px;color:#0B1B3A;text-decoration:none">Save</a></div>' +
      '<div id="vvMsg" role="status" style="min-height:24px;margin-top:8px;font-size:15px"></div>';
    box.appendChild(card); document.body.appendChild(box);
    function close() { box.remove(); }
    card.querySelector('#vvX').onclick = close; box.addEventListener('click', function (e) { if (e.target === box) close(); });
    var msg = card.querySelector('#vvMsg');
    fetch(url, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || 'Could not draw it'); }); return r.blob(); })
      .then(function (b) { var u = URL.createObjectURL(b); card.querySelector('#vvImg').innerHTML = '<img alt="Payment voucher" style="width:100%;border-radius:10px" src="' + u + '">'; card.querySelector('#vvSave').href = u; })
      .catch(function (e) { card.querySelector('#vvImg').textContent = e.message; });
    function send(resend) {
      msg.textContent = 'Sending...';
      q('/api/vendor-voucher/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor: vendor, phone: card.querySelector('#vvPh').value.trim(), resend: resend === true }) }).then(function (j) {
        if (j.sent) { msg.style.color = '#1b7a46'; msg.textContent = 'Sent to ' + j.to; return; }
        if (j.code === 'already_sent') { msg.style.color = '#0B1B3A'; msg.innerHTML = 'Already sent today. <button type="button" id="vvAgain" style="min-height:44px;border:1px solid #c9a24b;border-radius:10px;background:transparent">Send again</button>'; msg.querySelector('#vvAgain').onclick = function () { send(true); }; return; }
        msg.style.color = '#b3261e'; msg.textContent = j.error || 'Not sent';
      }).catch(function (e) { msg.style.color = '#b3261e'; msg.textContent = e.message; });
    }
    card.querySelector('#vvSend').onclick = function () { send(false); };
  };
})();
