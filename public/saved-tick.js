/* Saved tick: a small "Saved" pill after any save (POST/PUT/PATCH/DELETE) that really succeeded.
   Own module: touches nothing else. Works in the shell and in every screen frame. */
(function () {
  function pill(doc) {
    var el = doc.getElementById('rbh-saved-tick');
    if (!el) { el = doc.createElement('div'); el.id = 'rbh-saved-tick';
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:10px;z-index:99999;background:#2b2b2b;color:#e8d9a8;font:600 13px "RBH Sans","Segoe UI",sans-serif;padding:7px 14px;border-radius:18px;opacity:0;transition:opacity .15s;pointer-events:none';
      (doc.body || doc.documentElement).appendChild(el); }
    return el;
  }
  function show(win, ok) {
    try { var t = win.top || win, el = pill(t.document); el.textContent = ok ? '✓ Saved' : 'Not saved';
      el.style.opacity = 1; clearTimeout(el._t); el._t = setTimeout(function () { el.style.opacity = 0; }, 1800); } catch (e) {}
  }
  function wrap(win) {
    try { if (!win.fetch || win.__tickWrapped) return; win.__tickWrapped = true;
      var orig = win.fetch.bind(win);
      win.fetch = function (u, o) { var m = ((o && o.method) || 'GET').toUpperCase();
        var p = orig(u, o);
        if (m !== 'GET' && m !== 'HEAD' && !/\/(heartbeat|ping|log|track)/i.test(String(u && u.url || u)))
          p.then(function (r) { show(win, r.ok); }, function () { show(win, false); });
        return p; }; } catch (e) {}
  }
  wrap(window);
  document.addEventListener('load', function (e) { var t = e.target; if (t && t.tagName === 'IFRAME') try { wrap(t.contentWindow); } catch (x) {} }, true);
  [].forEach.call(document.querySelectorAll('iframe'), function (f) { try { wrap(f.contentWindow); } catch (x) {} });
})();
