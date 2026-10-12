/* Royal Bath Hub logo lockup: BH box on the left, "Royal Bath Hub" to its right, "Thihariya" small underneath.
   Adds a slim brand strip at the top of any page that has no lockup yet. */
(function () {
  var css = '.bh-lockup{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:inherit}'
    + '.bh-lockup img{height:36px;width:auto;object-fit:contain;flex-shrink:0}'
    + '.bh-lockup .bh-name{font-weight:800;font-size:17px;line-height:1.1;letter-spacing:.3px;color:#c9a24b}'
    + '.bh-lockup .bh-sub{display:block;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:.7;margin-top:2px}'
    + '.bh-lockup-lg img{height:64px;width:auto}.bh-lockup-lg .bh-name{font-size:28px}.bh-lockup-lg .bh-sub{font-size:12px}'
    + '.bh-strip{display:flex!important;align-items:center;justify-content:center;padding:6px 10px!important;background:linear-gradient(180deg,#1b1c20,#0d0d0f)!important;border-bottom:2px solid #c9a24b}'
    + '.bh-strip img.bh-full{width:min(100%,420px);height:auto;max-height:96px;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6)) drop-shadow(0 0 12px rgba(212,175,55,.2))}'
    + '.sidebar.collapsed .bh-name,.sidebar.collapsed .bh-sub{display:none}'
    + '@media print{.bh-strip{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  window.bhLockupHTML = function (sub, large) {
    return '<span class="bh-lockup' + (large ? ' bh-lockup-lg' : '') + '"><img src="/brand/logo-header-400h.png" alt="Royal Bath Hub">'
      + '<span><span class="bh-name">Royal Bath Hub</span>' + (sub ? '<span class="bh-sub">Thihariya</span>' : '') + '</span></span>';
  };
  function ready() {
    if (document.querySelector('.bh-lockup, .sidebar-logo, .login-box')) return;
    var d = document.createElement('div'); d.className = 'bh-strip';
    d.innerHTML = '<img class="bh-full" src="/brand/logo-rbh-full.webp" alt="Royal Bath Hub, tiles and bathroom fittings" width="1037" height="300">';
    document.body.insertBefore(d, document.body.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
