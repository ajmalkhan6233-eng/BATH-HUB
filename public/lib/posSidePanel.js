/* POS side panel: shows the daily ledger next to the bill form. Self-contained: needs only <div id="ledger-panel"></div> on the page. */
(function () {
  var host = document.getElementById('ledger-panel'); if (!host) return;
  var KEY = 'bh_ledger_panel', URL = '/daily-entry-v2.html', wide = window.matchMedia('(min-width:900px)');
  var css = '#ledger-panel{margin:16px 0}#ledger-panel .lp-bar{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#0b1b3d;color:#f6efdc;border-radius:10px 10px 0 0;font-weight:700}'
    + '#ledger-panel .lp-bar a{margin-left:auto;color:#e8cf8a;font-size:14px}#ledger-panel .lp-bar button{min-height:36px;padding:4px 12px;border-radius:8px;border:0;background:#c9a24b;color:#0b1b3d;font-weight:700;cursor:pointer}'
    + '#ledger-panel iframe{display:block;width:100%;height:70vh;border:1px solid rgba(11,27,58,.2);border-top:0;background:#fff;border-radius:0 0 10px 10px}'
    + '#ledger-panel.lp-hidden iframe{display:none}#ledger-panel.lp-hidden .lp-bar{border-radius:10px}'
    + '@media(min-width:900px){body.lp-wide{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,4fr);gap:16px;align-items:start}body.lp-wide .wrap{max-width:none;grid-template-columns:1fr}'
    + 'body.lp-wide #ledger-panel{position:sticky;top:0;margin:0;height:100vh;display:flex;flex-direction:column}body.lp-wide #ledger-panel iframe{flex:1;height:auto;min-height:0}}'
    + '@media print{#ledger-panel{display:none!important}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  function saved() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (_) { /* private mode: ignore */ } }
  var hidden = saved() ? saved() === 'hidden' : !wide.matches;   // default: shown on wide screens, collapsed on small ones
  host.innerHTML = '<div class="lp-bar"><span>Daily Ledger</span><button type="button" class="lp-toggle"></button><a href="' + URL + '" target="_blank" rel="noopener">Open full page</a></div>';
  var btn = host.querySelector('.lp-toggle'), frame = null;
  function render() {
    host.classList.toggle('lp-hidden', hidden); btn.textContent = hidden ? 'Show' : 'Hide';
    document.body.classList.toggle('lp-wide', wide.matches && !hidden);
    if (!hidden && !frame) {
      frame = document.createElement('iframe'); frame.title = 'Daily ledger'; frame.loading = 'lazy'; frame.src = URL + '?embed=1';
      frame.addEventListener('load', function () {   // same origin: hide the ledger page's own header inside the panel (no change to that page)
        try { var d = frame.contentDocument, s = d.createElement('style'); s.textContent = 'header,.sidebar,.topbar{display:none!important}body{padding-top:0!important}'; d.head.appendChild(s); } catch (_) { /* cross-origin: leave as is */ }
      });
      host.appendChild(frame);
    }
  }
  btn.addEventListener('click', function () { hidden = !hidden; save(hidden ? 'hidden' : 'shown'); render(); });
  if (wide.addEventListener) wide.addEventListener('change', render);
  render();
})();
