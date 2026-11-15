/* layla-tabs.js (15 Nov, AJ: "One Layla: AI assistant, agent review, agent rules, morning brief, audit log, everything under Layla").
   One strip of tabs under the top menu, shown on every Layla screen. Own module: touches only this strip; every screen keeps its own code. Roll back: delete the script line. */
(function () {
  var TABS = [['layla', '\u2190 Back to Layla']];   // 15 Nov: ONE Layla. The other tools open by talking to her (layla-commands.js); only a Back button shows on them.
  var KEYS = TABS.map(function (t) { return t[0]; });
  var bar;
  function css() {
    if (document.getElementById('layla-tabs-css')) return;
    var s = document.createElement('style'); s.id = 'layla-tabs-css';
    s.textContent = '#layla-tabs{display:none;gap:6px;padding:6px 12px;background:#f4f4f2;border-bottom:1px solid #d4d4cf;flex-wrap:wrap}#layla-tabs.on{display:flex}' +
      '#layla-tabs button{border:1.5px solid #9a9a93;border-radius:8px;background:#fff;color:#111;min-height:32px;padding:2px 14px;font:inherit;font-weight:600;cursor:pointer}' +
      '#layla-tabs button.sel{background:#c9a227;border-color:#c9a227;color:#0b0b0c}';
    document.head.appendChild(s);
  }
  function build() {
    if (bar) return true;
    var anchor = document.getElementById('rbh-menubar'); if (!anchor) return false;
    css(); bar = document.createElement('div'); bar.id = 'layla-tabs'; bar.setAttribute('role', 'tablist');
    TABS.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.dataset.k = t[0]; b.textContent = t[1]; b.setAttribute('role', 'tab');
      b.onclick = function () { try { navigate(t[0]); } catch (e) { /* ignore */ } };
      bar.appendChild(b);
    });
    anchor.parentNode.insertBefore(bar, anchor.nextSibling); return true;
  }
  function current() { var p = document.querySelector('.page.active'); return p && p.id ? p.id.replace(/^page-/, '') : ''; }
  function sync() {
    if (!build()) return;
    var k = current(), on = ['assistant', 'brain', 'morningbrief', 'agentreview', 'agent-rules'].indexOf(k) >= 0;
    bar.classList.toggle('on', on);
    Array.prototype.forEach.call(bar.children, function (b) { b.classList.toggle('sel', b.dataset.k === k); b.setAttribute('aria-selected', b.dataset.k === k ? 'true' : 'false'); });
  }
  function start() {
    var nav = window.navigate;
    if (typeof nav === 'function' && !nav.__lt) { var w = function () { var r = nav.apply(this, arguments); try { sync(); } catch (e) { /* ignore */ } return r; }; w.__lt = 1; window.navigate = w; }
    sync(); setTimeout(sync, 600); setTimeout(sync, 1800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
