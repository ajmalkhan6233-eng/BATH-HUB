/* OLD-COPY NOTICE (19 Nov audit #13). When the PC is slow or the network drops, the app shows its last saved numbers.
   Before, that was silent, so screens could disagree. Now a thin red strip says so, and goes away by itself when fresh numbers arrive. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  var bar = null, hideT = null;
  function show() {
    if (!bar) {
      bar = document.createElement('div'); bar.setAttribute('role', 'status');
      bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;padding:6px 10px;text-align:center;font:600 13px system-ui,sans-serif;background:#7a1f1f;color:#fff';
      bar.textContent = 'Showing an OLD saved copy. Numbers may be behind. Tap here to reload.';
      bar.addEventListener('click', function () { location.reload(); });
      document.body.appendChild(bar);
    }
    clearTimeout(hideT); hideT = setTimeout(function () { if (bar) { bar.remove(); bar = null; } }, 20000);
  }
  navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'saved-copy') show(); });
})();
