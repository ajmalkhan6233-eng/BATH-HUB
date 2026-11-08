/* bathhub-theme.js: Light and Gold only. Applies the saved theme before the page paints and keeps every open screen in step.
   Shares the key 'rbh_theme' (gold/light) with the new shell; 'dark' here is the Gold look the old pages know. Design only. */
(function () {
  var KEY = 'rbh_theme', OLD = 'bathhub-theme', ORDER = ['light', 'dark'];
  function get() { try { var v = localStorage.getItem(KEY) || localStorage.getItem(OLD); return (v === 'gold' || v === 'dark') ? 'dark' : 'light'; } catch (e) { return 'light'; } }
  function apply(t) { var h = document.documentElement; h.setAttribute('data-theme', t); h.removeAttribute('data-style'); }
  apply(get());
  /* gentle mode (shop PC kept switching off): motion off by default, no blur. Turn motion on again from the theme palette. */
  try { if (localStorage.getItem('bh_motion') === null) localStorage.setItem('bh_motion', 'off'); } catch (e) {}
  try { var st = document.createElement('style'); st.id = 'bh-gentle'; st.textContent = '*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}*,*::before,*::after{animation-iteration-count:1!important}'; (document.head || document.documentElement).appendChild(st); } catch (e) {}
  window.BHTheme = {
    order: ORDER,
    current: get,
    set: function (t) { if (ORDER.indexOf(t) < 0) return; try { localStorage.setItem(KEY, t === 'dark' ? 'gold' : 'light'); localStorage.setItem(OLD, t); } catch (e) {} apply(t); },
    next: function () { var t = get() === 'dark' ? 'light' : 'dark'; this.set(t); return t; },
    label: function (t) { return (t || get()) === 'dark' ? 'Gold' : 'Light'; }
  };
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === OLD) apply(get()); });   // another open screen changed it
})();
