/* rbh-scale (AJ 22 Nov): at browser zoom 100% show the owner app at 90%, so it looks the same as when AJ sets Chrome to 90%.
   Browser zoom is read from outerWidth/innerWidth (1 = 100%). Below 0.96 (AJ already zoomed out) nothing is changed. Desktop only. */
(function () {
  var h = document.documentElement;
  function fit() {
    try {
      var z = window.outerWidth / window.innerWidth;
      var on = window.innerWidth >= 900 && z >= 0.96 && !/[?&]noscale=1/.test(location.search);
      // innerWidth grows when we zoom the page by CSS, so judge from the state BEFORE our own class
      h.classList.toggle('rbh-s90', on);
    } catch (e) {}
  }
  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fit, 150); });
  fit();
})();
