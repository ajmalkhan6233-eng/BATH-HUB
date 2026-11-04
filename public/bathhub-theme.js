/* bathhub-theme.js: applies the saved theme (gold = dark default, water, light) before the page paints and keeps all open
   screens (the owner shell and its frames) in step. Design only. */
(function () {
  var KEY = 'bathhub-theme', ORDER = ['dark', 'water', 'light', 'sand', 'glass', 'aurora', 'midnight', 'emerald', 'rose', 'win7', 'win10', 'win11', 'apple', 'kinetic', 'aqua'], GLASSY = ['glass', 'aurora', 'midnight', 'emerald', 'rose'];
  function get() { try { var v = localStorage.getItem(KEY); return ORDER.indexOf(v) >= 0 ? v : 'dark'; } catch (e) { return 'dark'; } }
  function apply(t) { var h = document.documentElement; h.setAttribute('data-theme', t); if (GLASSY.indexOf(t) >= 0) h.setAttribute('data-style', 'glass'); else h.removeAttribute('data-style'); }
  apply(get());
  window.BHTheme = {
    order: ORDER,
    current: get,
    set: function (t) { if (ORDER.indexOf(t) < 0) return; try { localStorage.setItem(KEY, t); } catch (e) {} apply(t); },
    next: function () { var t = ORDER[(ORDER.indexOf(get()) + 1) % ORDER.length]; this.set(t); return t; },
    label: function (t) { return { dark: 'Gold', water: 'Water', light: 'Light', sand: 'Sand', glass: 'Ocean glass', aurora: 'Aurora', midnight: 'Midnight', emerald: 'Emerald', rose: 'Sunset', win7: 'Windows 7 Aero', win10: 'Windows 10', win11: 'Windows 11', apple: 'Apple glass', kinetic: 'Kinetic', aqua: 'Aqua' }[t || get()]; }
  };
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(get()); });   // another open screen changed it
})();