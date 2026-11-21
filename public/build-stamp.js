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
  fetch('/health', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (h) {
    var build = h && h.build;
    if (!build || build === 'unknown') { label('Build ?'); return; }
    label('Build ' + build);
    if (!window.caches || !caches.keys) return;
    caches.keys().then(function (keys) {
      var statics = keys.filter(function (k) { return k.indexOf('apex-static-') === 0; });
      if (!statics.length || statics.indexOf('apex-static-' + build) >= 0) return;   // nothing saved yet, or the saved copy is this build
      var done = ''; try { done = sessionStorage.getItem(KEY) || ''; } catch (e) {}
      if (done === build) return;                                                     // already reloaded once for this build: never loop
      try { sessionStorage.setItem(KEY, build); } catch (e) {}
      Promise.all(keys.map(function (k) { return caches.delete(k); })).then(function () {
        return navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration().then(function (g) { return g && g.update(); }) : null;
      }).catch(function () {}).then(function () { location.reload(); });
    }).catch(function () {});
  }).catch(function () { label('Build ? (offline)'); });
})();
