/* ROYAL BATH HUB UI core (public/ui/ui-core.js): tiny helpers shared by every new screen. No libraries. */
(function (w) {
  'use strict';
  var RBH = w.RBH = {};
  RBH.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  RBH.money = function (n) { n = Math.round((Number(n) || 0) * 100) / 100; return 'Rs ' + n.toLocaleString('en-LK', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  RBH.day = function (s) { return s ? String(s).slice(0, 10) : ''; };
  RBH.api = function (url, opt) {
    opt = opt || {}; var o = { credentials: 'same-origin', headers: {} };
    if (opt.body !== undefined) { o.method = opt.method || 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opt.body); } else if (opt.method) o.method = opt.method;
    return fetch(url, o).then(function (r) {
      if (r.status === 401) { try { (w.top || w).location.href = '/'; } catch (e) {} throw new Error('Please sign in again'); }
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error((j && j.error) || ('Error ' + r.status)); e.code = j && j.code; e.status = r.status; e.data = j; throw e; } return j; });
    });
  };
  RBH.toast = function (msg, kind) { var t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); };
  RBH.theme = function (t) { try { if (t) localStorage.setItem('rbh_theme', t); else t = localStorage.getItem('rbh_theme'); } catch (e) {} if (!t) t = (w.matchMedia && w.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', t); return t; };
  RBH.lite = function () { if ((navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)) document.documentElement.classList.add('lite'); };
  RBH.me = function () { return RBH.api('/api/me').then(function (u) { RBH.user = u || {}; return RBH.user; }).catch(function () { RBH.user = {}; return RBH.user; }); };
  RBH.isCashier = function () { return !!(RBH.user && RBH.user.role === 'cashier'); };
  RBH.skel = function (n) { var s = ''; for (var i = 0; i < (n || 5); i++) s += '<tr><td colspan="9"><div class="skel"></div></td></tr>'; return s; };
  RBH.theme(); RBH.lite();
  try { w.addEventListener('storage', function (e) { if (e.key === 'rbh_theme') RBH.theme(); }); } catch (e) {}
})(window);
