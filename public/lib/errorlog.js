/* FIX 3: reports screen errors to /api/client-error. No form text, no names. Max 5 per page load. Silent if offline. */
(function () {
  if (window.__rbhErrLog) return; window.__rbhErrLog = true;
  var sent = 0, seen = {};
  function send(message, stack) {
    try {
      message = String(message || '').slice(0, 300);
      if (!message || sent >= 5 || seen[message]) return;
      seen[message] = 1; sent++;
      var body = JSON.stringify({ message: message, stack: String(stack || '').slice(0, 800), page: location.pathname });
      if (navigator.sendBeacon) { navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' })); }
      else { fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {}); }
    } catch (e) {}
  }
  window.addEventListener('error', function (e) { if (e && e.message) send(e.message + (e.lineno ? ' @' + e.lineno : ''), e.error && e.error.stack); });
  window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; send('Promise: ' + (r && r.message ? r.message : r), r && r.stack); });
})();
