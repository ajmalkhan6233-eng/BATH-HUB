/* Red strip on top while TEST_MODE=true. Does nothing (and shows nothing) otherwise. */
(function () {
  fetch('/api/test-mode', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.test || document.getElementById('bh-test-banner')) return;
    var d = document.createElement('div'); d.id = 'bh-test-banner';
    d.textContent = 'TEST MODE: practice data. It will be wiped before opening. Receipts go only to the owner.';
    d.style.cssText = 'position:sticky;top:0;z-index:99999;background:#c0392b;color:#fff;font:600 13px/1.3 system-ui,sans-serif;text-align:center;padding:6px 10px';
    document.body.insertBefore(d, document.body.firstChild);
  }).catch(function () {});
})();
