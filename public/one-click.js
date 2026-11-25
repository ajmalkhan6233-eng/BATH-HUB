/* ONE CLICK = ONE SAVE (AJ 25 Nov). While a save is going, pressing again does nothing: the same request is not sent twice,
   the button is greyed out and a "Saving, please wait" note shows. Reading data (GET) is not touched. Own module. */
(function (root) {
  'use strict';
  if (!root.fetch || root.__oneClick) return; root.__oneClick = true;
  var real = root.fetch.bind(root), flying = {}, count = 0, lastBtn = null, doc = root.document;
  if (doc) doc.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button, input[type="submit"], input[type="button"]'); if (b) lastBtn = b; }, true);
  function note(on) {
    if (!doc || !doc.body) return;
    var n = doc.getElementById('one-click-note');
    if (!n) { n = doc.createElement('div'); n.id = 'one-click-note'; n.setAttribute('role', 'status'); n.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#111;color:#fff;padding:9px 18px;border-radius:20px;font:700 14px system-ui,sans-serif;z-index:2147483647;display:none;pointer-events:none'; n.textContent = 'Saving, please wait. One click is enough.'; doc.body.appendChild(n); }
    n.style.display = on ? 'block' : 'none';
  }
  root.fetch = function (url, opts) {
    var method = String((opts && opts.method) || 'GET').toUpperCase(), body = opts && opts.body;
    if (method === 'GET' || method === 'HEAD' || (body !== undefined && body !== null && typeof body !== 'string')) return real(url, opts);
    var key = method + ' ' + String((url && url.url) || url) + ' ' + (body || '');
    if (flying[key]) return flying[key].then(function (r) { return r.clone(); });
    var btn = lastBtn && !lastBtn.disabled ? lastBtn : null;
    if (btn) { btn.disabled = true; btn.style.opacity = '0.55'; }
    count++; note(true);
    var done = function () { delete flying[key]; if (btn) { btn.disabled = false; btn.style.opacity = ''; } if (--count <= 0) { count = 0; note(false); } };
    var p = real(url, opts); flying[key] = p;
    p.then(done, done);
    return p.then(function (r) { return r.clone(); });
  };
})(typeof window !== 'undefined' ? window : this);
