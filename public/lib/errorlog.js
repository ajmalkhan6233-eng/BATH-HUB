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
  // 28 Nov: a failed screen or menu request, and a script or frame that did not load, are recorded too
  var realFetch = window.fetch;
  if (realFetch) window.fetch = function (input, init) {
    var url = String((input && input.url) || input).replace(location.origin, '').split('?')[0];
    var p = realFetch.apply(this, arguments);
    if (url.indexOf('/api/') === 0 && url !== '/api/client-error') p.then(function (r) { if (r.status >= 500) send('Request failed ' + r.status + ': ' + url); }, function (e) { if (!e || e.name !== 'AbortError') send('No answer: ' + url); });
    return p;
  };
  window.addEventListener('error', function (e) { var t = e && e.target; if (t && t !== window && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) send('Did not load: ' + String(t.src || t.href).replace(location.origin, '').split('?')[0]); }, true);
  window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; send('Promise: ' + (r && r.message ? r.message : r), r && r.stack); });
})();
