/* bathhub-theme.js: applies the saved theme (gold = dark default, water, light) before the page paints and keeps all open
   screens (the owner shell and its frames) in step. Design only. */
(function () {
  var KEY = 'bathhub-theme', ORDER = ['dark', 'water', 'light'];
  function get() { try { var v = localStorage.getItem(KEY); return ORDER.indexOf(v) >= 0 ? v : 'dark'; } catch (e) { return 'dark'; } }
  function apply(t) { document.documentElement.setAttribute('data-theme', t); }
  apply(get());
  window.BHTheme = {
    current: get,
    set: function (t) { if (ORDER.indexOf(t) < 0) return; try { localStorage.setItem(KEY, t); } catch (e) {} apply(t); },
    next: function () { var t = ORDER[(ORDER.indexOf(get()) + 1) % ORDER.length]; this.set(t); return t; },
    label: function (t) { return { dark: 'Gold', water: 'Water', light: 'Light' }[t || get()]; }
  };
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(get()); });   // another open screen changed it
})();