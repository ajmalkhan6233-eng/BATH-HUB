/* 13 Nov: simple left menu. Main 10 always visible; Layla's helpers and everything else sit in two folded groups. Own module: only reorders/hides sidebar items. */
(function () {
  var MAIN = ['dashboard', 'pos', 'dailyledger', 'daily-sales', 'stock', 'grn', 'purchasing', 'expenses', 'cheques', 'layla'];
  var LAYLA = ['brain', 'assistant', 'agentreview', 'agent-rules', 'morningbrief', 'reports', 'reports2', 'documents', 'dueboard', 'auditacc', 'adminaudit', 'moneyplan'];
  var GONE = ['posledger', 'competitors'];
  function item(ul, k) { return ul.querySelector('.nav-item[data-page="' + k + '"]'); }
  function head(id, text, ul) {
    var h = document.getElementById(id);
    if (!h) { h = document.createElement('li'); h.id = id; h.className = 'nav-sep rbh-fold'; h.setAttribute('role', 'button'); h.tabIndex = 0; h.style.cursor = 'pointer'; h.dataset.open = '0';
      var tg = function () { var o = h.dataset.open === '1' ? '0' : '1'; h.dataset.open = o; paint(); };
      h.addEventListener('click', tg); h.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tg(); } }); }
    h.dataset.text = text; ul.appendChild(h); return h;
  }
  var groups = {};
  function paint() {
    Object.keys(groups).forEach(function (id) {
      var g = groups[id], h = document.getElementById(id); if (!h) return;
      var open = h.dataset.open === '1';
      h.textContent = (open ? '▾ ' : '▸ ') + h.dataset.text;
      g.forEach(function (li) { li.style.display = open ? '' : 'none'; });
    });
  }
  function apply() {
    try {
      var ul = document.querySelector('.sidebar-nav'); if (!ul) return;
      GONE.forEach(function (k) { var li = item(ul, k); if (li) { li.style.display = 'none'; li.dataset.gone = '1'; } });
      var all = Array.prototype.slice.call(ul.querySelectorAll('.nav-item')), used = {};
      MAIN.forEach(function (k) { var li = item(ul, k); if (li) { li.style.display = ''; ul.appendChild(li); used[k] = 1; } });
      var lay = [], more = [];
      LAYLA.forEach(function (k) { var li = item(ul, k); if (li) { lay.push(li); used[k] = 1; } });
      all.forEach(function (li) { var k = li.dataset.page; if (!used[k] && GONE.indexOf(k) < 0) more.push(li); });
      var old = ul.querySelectorAll('.nav-sep:not(.rbh-fold)'); Array.prototype.forEach.call(old, function (s) { s.style.display = 'none'; });
      var h1 = head('fold-layla', 'Layla tools', ul); lay.forEach(function (li) { ul.appendChild(li); });
      var h2 = head('fold-more', 'More', ul); more.forEach(function (li) { ul.appendChild(li); });
      groups = { 'fold-layla': lay, 'fold-more': more };
      var cur = ul.querySelector('.nav-item.active');
      if (cur) { if (lay.indexOf(cur) >= 0) h1.dataset.open = '1'; if (more.indexOf(cur) >= 0) h2.dataset.open = '1'; }
      paint();
    } catch (e) { /* menu is a nicety */ }
  }
  function openFor() { var ul = document.querySelector('.sidebar-nav'); if (!ul) return; var cur = ul.querySelector('.nav-item.active'); if (!cur) return;
    Object.keys(groups).forEach(function (id) { if (groups[id].indexOf(cur) >= 0) document.getElementById(id).dataset.open = '1'; }); paint(); }
  window.RBHSimpleMenu = { apply: apply };
  window.addEventListener('hashchange', function () { setTimeout(openFor, 200); });
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.nav-item')) setTimeout(openFor, 150); });
})();
