/* BLOCK: shell-fit (AJ 11 Nov 17:10). On a computer, a screen that is an embedded page (POS, GRN, ...) fills the window under the menu:
   slim title bar, frame height = what is left of the window, so the OUTER page never scrolls and the inside gets every pixel. */
(function () {
  'use strict';
  var css = '@media(min-width:900px){body.rbh-framepage .topbar{padding-top:2px!important;padding-bottom:2px!important}body.rbh-framepage .topbar .brand-logo{height:30px!important;max-width:none!important}body.rbh-framepage #page-sub{display:none}body.rbh-framepage #page-title{font-size:14px!important}body.rbh-framepage .live-clock{font-size:13px;padding:2px 8px}html.rbh-nopage,body.rbh-framepage{overflow:hidden!important}body.rbh-framepage .main-content{padding-bottom:0!important}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  function visFrame() { var f = document.querySelectorAll('.page.active iframe, #pos-frame, iframe[id^="frame-"]'); for (var i = 0; i < f.length; i++) { var r = f[i].getBoundingClientRect(); if (r.width > 200 && r.height > 50 && f[i].offsetParent) return f[i]; } return null; }
  function fit() {
    var on = window.innerWidth >= 900, f = on ? visFrame() : null;
    document.body.classList.toggle('rbh-framepage', !!f); document.documentElement.classList.toggle('rbh-nopage', !!f);
    if (!f) return;
    var top = f.getBoundingClientRect().top + (window.scrollY || 0);
    var h = Math.max(300, window.innerHeight - top - 6);
    if (Math.abs((parseFloat(f.style.height) || 0) - h) > 1) { f.style.setProperty('height', h + 'px', 'important'); f.style.setProperty('min-height', '300px', 'important'); }
  }
  var t = null; function soon() { clearTimeout(t); t = setTimeout(fit, 80); }
  window.addEventListener('resize', soon); window.addEventListener('hashchange', function () { setTimeout(fit, 150); setTimeout(fit, 600); });
  document.addEventListener('click', function () { setTimeout(fit, 200); });
  setInterval(fit, 1500); setTimeout(fit, 400);
})();
