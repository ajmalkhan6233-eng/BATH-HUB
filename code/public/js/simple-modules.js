/* Simple menu: hides the pages of switched-off modules (nothing is deleted) and adds one "Inactive modules" item. */
(function () {
  var hide = new Set();
  function paint() {
    var ul = document.querySelector('.sidebar-nav'); if (!ul) return;
    ul.querySelectorAll('.nav-item').forEach(function (li) { li.hidden = hide.has(li.dataset.page); });
  }
  function start() {
    fetch('/api/modules', { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
      if (!c) return;
      hide = new Set(c.hidden_keys || []);
      if (typeof addFramePage === 'function' && !document.getElementById('page-inactive')) {
        addFramePage({ key: 'inactive', label: 'Inactive modules', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-box"/></svg>', url: '/inactive_modules.html', sub: 'Switched-off modules. Nothing is deleted.' });
      }
      paint();
      var ul = document.querySelector('.sidebar-nav');
      if (ul) new MutationObserver(paint).observe(ul, { childList: true });   // menu items are added late: hide them as they arrive
    }).catch(function () {});
  }
  var st = document.createElement('style'); st.textContent = '.nav-item[hidden]{display:none!important}'; document.head.appendChild(st);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
