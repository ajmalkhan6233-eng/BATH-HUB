/* Royal Bath Hub logo lockup: BH box on the left, "Royal Bath Hub" to its right, "Thihariya" small underneath.
   Adds a slim brand strip at the top of any page that has no lockup yet. */
(function () {
  var css = '.bh-lockup{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:inherit}'
    + '.bh-lockup img{height:36px;width:auto;object-fit:contain;flex-shrink:0}'
    + '.bh-lockup .bh-name{font-weight:800;font-size:17px;line-height:1.1;letter-spacing:.3px;color:#c9a24b}'
    + '.bh-lockup .bh-sub{display:block;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:.7;margin-top:2px}'
    + '.bh-lockup-lg img{height:64px;width:auto}.bh-lockup-lg .bh-name{font-size:28px}.bh-lockup-lg .bh-sub{font-size:12px}'
    + '.bh-strip{display:flex;align-items:center;padding:8px 16px;background:#0b1b3d;border-bottom:2px solid #c9a24b}'
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
    d.innerHTML = window.bhLockupHTML(true, false);
    document.body.insertBefore(d, document.body.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
