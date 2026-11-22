/* BLOCK: build-stamp. Tiny label bottom-left of the owner screen: which build the SERVER runs (from /health, which reads the
   service worker VERSION, the one build number). 21 Nov (AJ startup audit): if this browser still holds a saved copy of an
   older build, the old copies are cleared and the page reloads ONCE, quietly. No data, no pop-up. */
(function () {
  var KEY = 'rbh-build-reloaded';
  function label(text) {
    try {
      var d = document.getElementById('rbh-build') || document.createElement('div');
      d.id = 'rbh-build'; d.textContent = text;
      d.style.cssText = 'position:fixed;left:6px;bottom:2px;z-index:99998;font:10px/1 system-ui,sans-serif;color:var(--text-muted,#888);opacity:.8;pointer-events:none';
      if (!d.parentNode) document.body.appendChild(d);
    } catch (e) {}
  }
  // 22 Nov (AJ): "update available" bar when this browser still holds an older build than the server runs. One tap = hard refresh.
  function banner(build) {
    if (document.getElementById('rbh-upd-bar')) return;
    var b = document.createElement('button'); b.id = 'rbh-upd-bar'; b.type = 'button';
    b.textContent = 'Update available: build ' + build + '. Tap to load it.';
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:99999;padding:10px 18px;border-radius:22px;border:0;background:#C9A24B;color:#0B1B3A;font:600 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)';
    b.onclick = function () {
      var go = function () { location.replace(location.pathname + '?hr=' + Date.now() + (location.hash || '')); };
      Promise.all([window.caches ? caches.keys().then(function (k) { return Promise.all(k.map(function (x) { return caches.delete(x); })); }) : 0,
        navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(function (r) { return Promise.all(r.map(function (x) { return x.unregister(); })); }) : 0]).then(go, go);
    };
    document.body.appendChild(b);
  }
  fetch('/health', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (h) {
    var build = h && h.build;
    if (!build || build === 'unknown') { label('Build ?'); return; }
    label('Build ' + build);
    if (!window.caches || !caches.keys) return;
    caches.keys().then(function (keys) {
      var statics = keys.filter(function (k) { return k.indexOf('apex-static-') === 0; });
      if (!statics.length || statics.indexOf('apex-static-' + build) >= 0) return;   // nothing saved yet, or the saved copy is this build
      var done = ''; try { done = sessionStorage.getItem(KEY) || ''; } catch (e) {}
      if (done === build) { banner(build); return; }                                  // already reloaded once and still old: ask, never loop
      try { sessionStorage.setItem(KEY, build); } catch (e) {}
      Promise.all(keys.map(function (k) { return caches.delete(k); })).then(function () {
        return navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration().then(function (g) { return g && g.update(); }) : null;
      }).catch(function () {}).then(function () { location.reload(); });
    }).catch(function () {});
  }).catch(function () { label('Build ? (offline)'); });
})();
