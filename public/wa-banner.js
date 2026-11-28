/* 28 Nov: WhatsApp was unlinked for days and nothing on screen said so. This shows a bar until it is linked again. */
(function () {
  'use strict';
  var bar = null;
  function show(on) {
    if (!on) { if (bar) { bar.remove(); bar = null; } return; }
    if (bar || !document.body) return;
    bar = document.createElement('a');
    bar.href = 'http://localhost:3001/qr'; bar.target = '_blank'; bar.rel = 'noopener';
    bar.textContent = 'WhatsApp is NOT linked: receipts are not going out. On the shop PC tap here, then scan with the shop phone.';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:100001;background:#a8261f;color:#fff;font:700 14px system-ui,sans-serif;text-align:center;padding:12px';
    document.body.appendChild(bar);
  }
  function check() {
    fetch('/api/whatsapp-link', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) show(j.ready === false); }).catch(function () { /* the app itself is away; say nothing */ });
  }
  check(); setInterval(check, 60000);
})();
