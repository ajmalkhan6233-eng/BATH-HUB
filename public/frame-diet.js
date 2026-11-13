/* 13 Nov: frame diet. Screens you left more than 40 s ago are emptied (they reload fresh when you open them again), so the browser stays light after many clicks. POS and GRN are kept (unsaved bill / lines). Own module: touches only hidden iframes. */
(function () {
  var seen = {}, KEEP = /pos|grn|stock/i, IDLE = 40000;
  function tick() {
    try {
      var now = Date.now();
      Array.prototype.forEach.call(document.querySelectorAll('iframe'), function (f) {
        if (!f.getAttribute('src') || f.getAttribute('src') === 'about:blank') return;
        var id = f.id || f.getAttribute('src');
        var sec = f.closest('.page'), active = !sec || sec.classList.contains('active');
        if (active || seen[id] === undefined) { seen[id] = now; return; }
        if (KEEP.test(id) || KEEP.test(f.getAttribute('src'))) return;
        if (now - seen[id] < IDLE) return;
        try { f.contentWindow.location.replace('about:blank'); } catch (e) { /* ignore */ }
        f.removeAttribute('src'); delete seen[id];
      });
    } catch (e) { /* never break the app */ }
  }
  setInterval(tick, 8000);
})();
