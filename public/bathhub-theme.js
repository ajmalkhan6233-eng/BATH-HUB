/* bathhub-theme.js: Light and Gold only. Applies the saved theme before the page paints and keeps every open screen in step.
   Shares the key 'rbh_theme' (gold/light) with the new shell; 'dark' here is the Gold look the old pages know. Design only. */
(function () {
  var KEY = 'rbh_theme', OLD = 'bathhub-theme', ORDER = ['light', 'soft', 'dark'];
  function get() { try { var v = localStorage.getItem(KEY) || localStorage.getItem(OLD); return v === 'soft' ? 'soft' : (v === 'gold' || v === 'dark') ? 'dark' : 'light'; } catch (e) { return 'soft'; } }
  /* 11 Nov: AJ wants the softer look; set ONCE for everyone, a switch he makes after that is respected. */
  try { if (localStorage.getItem('rbh_theme_v3') === null) { localStorage.setItem(KEY, 'soft'); localStorage.setItem(OLD, 'soft'); localStorage.setItem('rbh_theme_v3', '1'); } } catch (e) {}
  function apply(t) { var h = document.documentElement; h.setAttribute('data-theme', t === 'soft' ? 'dark' : t); if (t === 'soft') h.setAttribute('data-tone', 'soft'); else h.removeAttribute('data-tone'); h.removeAttribute('data-style'); }
  apply(get());
  /* gentle mode (shop PC kept switching off): no blur, no endless loops. Motion itself is on. */
  /* 8 Nov: motion ON by default. The old auto 'off' (set by gentle mode) is cleared once; a switch AJ makes after that is respected. */
  try { if (localStorage.getItem('bh_motion_v2') === null) { if (localStorage.getItem('bh_motion') === 'off') localStorage.removeItem('bh_motion'); localStorage.setItem('bh_motion_v2', '1'); } } catch (e) {}
  try { var st = document.createElement('style'); st.id = 'bh-gentle'; st.textContent = '*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}*,*::before,*::after{animation-iteration-count:1!important}'; (document.head || document.documentElement).appendChild(st); } catch (e) {}
  window.BHTheme = {
    order: ORDER,
    current: get,
    set: function (t) { if (ORDER.indexOf(t) < 0) return; try { localStorage.setItem(KEY, t === 'dark' ? 'gold' : t); localStorage.setItem(OLD, t); } catch (e) {} apply(t); },
    next: function () { var t = ORDER[(ORDER.indexOf(get()) + 1) % ORDER.length]; this.set(t); return t; },
    label: function (t) { t = t || get(); return t === 'dark' ? 'Gold' : t === 'soft' ? 'Soft' : 'Light'; }
  };
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === OLD) apply(get()); });   // another open screen changed it
})();
