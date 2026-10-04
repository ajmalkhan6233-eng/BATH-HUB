/* Sidebar preferences for this device: Dashboard, POS, Daily Ledger always lead; the owner ticks which other items to show. Saved in localStorage (try/catch). */
(function () {
  var KEY = 'bh_menu_hidden', FIRST = ['dashboard', 'pos', 'dailyledger', 'posledger'];
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (_) { /* private mode: not remembered */ } }
  function items() { return Array.prototype.slice.call(document.querySelectorAll('.sidebar-nav .nav-item')); }
  function apply() {
    var ul = document.querySelector('.sidebar-nav'); if (!ul) return;
    for (var i = FIRST.length - 1; i >= 0; i--) { var li = ul.querySelector('.nav-item[data-page="' + FIRST[i] + '"]'); if (li) ul.insertBefore(li, ul.firstChild); }
    var hidden = load();
    items().forEach(function (li) { var k = li.dataset.page; li.style.display = (k !== 'dashboard' && hidden.indexOf(k) >= 0) ? 'none' : ''; });
  }
  function dialog() {
    var hidden = load(), box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px';
    var card = document.createElement('div');
    card.style.cssText = 'background:#10224a;color:#f6efdc;border:1px solid #c9a24b;border-radius:14px;max-width:420px;width:100%;max-height:85vh;overflow:auto;padding:16px;font:15px system-ui,sans-serif';
    card.innerHTML = '<div style="font-weight:800;font-size:18px;margin-bottom:4px">Customize menu</div><div style="opacity:.75;font-size:13px;margin-bottom:10px">Tick what you want to see on the left. Saved on this device.</div><div id="mp-list"></div>'
      + '<div style="display:flex;gap:8px;margin-top:12px"><button type="button" id="mp-all" style="flex:1;min-height:44px;border-radius:10px;border:1px solid #c9a24b;background:transparent;color:inherit">Show all</button><button type="button" id="mp-done" style="flex:1;min-height:44px;border-radius:10px;border:0;background:#c9a24b;color:#0b1b3d;font-weight:800">Done</button></div>';
    var list = card.querySelector('#mp-list');
    items().forEach(function (li) {
      var k = li.dataset.page, name = (li.querySelector('.nav-label') || {}).textContent || k;
      var row = document.createElement('label'); row.style.cssText = 'display:flex;align-items:center;gap:10px;min-height:44px;border-top:1px solid rgba(232,207,138,.15)';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = hidden.indexOf(k) < 0; cb.disabled = k === 'dashboard'; cb.style.cssText = 'width:20px;height:20px';
      cb.addEventListener('change', function () { hidden = hidden.filter(function (x) { return x !== k; }); if (!cb.checked) hidden.push(k); save(hidden); apply(); });
      row.appendChild(cb); row.appendChild(document.createTextNode(name)); list.appendChild(row);
    });
    card.querySelector('#mp-all').onclick = function () { hidden = []; save(hidden); list.querySelectorAll('input').forEach(function (c) { c.checked = true; }); apply(); };
    card.querySelector('#mp-done').onclick = function () { document.body.removeChild(box); };
    box.addEventListener('click', function (e) { if (e.target === box) document.body.removeChild(box); });
    box.appendChild(card); document.body.appendChild(box);
  }
  function addButton() {
    var f = document.querySelector('.sidebar-footer'); if (!f || document.getElementById('mp-btn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'mp-btn'; b.textContent = 'Customize menu';
    b.style.cssText = 'width:100%;min-height:40px;margin-bottom:8px;border-radius:10px;border:1px solid var(--card-border,#555);background:transparent;color:inherit;cursor:pointer;font:inherit';
    b.addEventListener('click', dialog); f.insertBefore(b, f.firstChild);
  }
  window.BHMenuPrefs = { apply: apply, dialog: dialog };
  function boot() { addButton(); apply(); setTimeout(apply, 1500); setTimeout(apply, 4000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
