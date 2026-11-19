/* home-play.js (13 Nov, AJ): Home screen card with a play button "Run day close" and a small activity log underneath (sample look AJ chose).
   Own module. READ ONLY: it reads today's summary, writes the steps into the log, then opens Daily Ledger. Saves nothing to the shop data.
   Log lives in this browser only (localStorage bh_homelog, last 8 lines). Off switch for motion: bh_motion=off. */
(function () {
  'use strict';
  var KEY = 'bh_homelog', ID = 'home-play-card';
  function rs(n) { n = Math.round(parseFloat(n) || 0); return 'Rs ' + n.toLocaleString('en-US'); }
  function hm() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 8))); } catch (e) { /* ignore */ } }
  var css = '#page-dashboard.dp-on>#' + ID + '{display:block!important}#' + ID + '{background:var(--bg-surface,#fff);border:1px solid var(--card-border,#e5e5e5);border-radius:12px;padding:12px;margin:0 0 10px;transition:border-color .2s,transform .2s}'
    + '#' + ID + ':hover{border-color:var(--c-gold,#C9A24B);transform:translateY(-2px)}'
    + '#' + ID + ' .hp-run{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;padding:10px;border-radius:8px;cursor:pointer;border:1px solid var(--c-gold,#C9A24B);background:transparent;color:inherit}'
    + '#' + ID + ' .hp-run:active{transform:scale(.97)}#' + ID + ' .hp-run svg{width:16px;height:16px}'
    + '#' + ID + ' ul{list-style:none;margin:8px 0 0;padding:0;font-size:13px}'
    + '#' + ID + ' li{padding:5px 0;border-top:1px solid var(--card-border,#e5e5e5);opacity:.85}#' + ID + ' li b{font-weight:600;margin-right:6px}'
    + '#' + ID + ' li.new{animation:hpIn .25s ease-out}@keyframes hpIn{from{opacity:0;transform:translateY(6px)}to{opacity:.85;transform:none}}'
    + 'html.mo-off #' + ID + ' *{animation:none!important;transition:none!important}';
  function render(fresh) {
    var c = document.getElementById(ID); if (!c) return;
    var ul = c.querySelector('ul'); ul.innerHTML = '';
    load().forEach(function (l, i) { var li = document.createElement('li'); if (fresh && i === 0) li.className = 'new'; var b = document.createElement('b'); b.textContent = l.t; li.appendChild(b); li.appendChild(document.createTextNode(l.m)); ul.appendChild(li); });
  }
  function add(m) { var a = load(); a.unshift({ t: hm(), m: m }); save(a); render(true); }
  function run() {
    var d = new Date(), iso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    add('Day close started');
    fetch('/api/daily-summary/' + iso, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
      if (s && s.total_sale !== undefined) { setTimeout(function () { add('Sales ' + rs(s.total_sale) + ', expenses ' + rs(s.total_expenses)); }, 350); }
      else { setTimeout(function () { add('No entry for today yet'); }, 350); }
      setTimeout(function () { add('Opening Daily Ledger'); try { if (typeof navigate === 'function') navigate('dailyledger'); } catch (e) { /* ignore */ } }, 900);
    }).catch(function () { add('Could not read today; opening Daily Ledger'); try { navigate('dailyledger'); } catch (e) { /* ignore */ } });
  }
  function mount() {
    var p = document.getElementById('page-dashboard'); if (!p || document.getElementById(ID)) return !!p && !!document.getElementById(ID);
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var c = document.createElement('div'); c.id = ID;
    c.innerHTML = '<button type="button" class="hp-run"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>Run day close</button><ul></ul>';
    p.insertBefore(c, p.firstChild); c.querySelector('.hp-run').addEventListener('click', run); render(false); return true;
  }
  var n = 0, t = setInterval(function () { if (mount() || ++n > 20) clearInterval(t); }, 300);
})();
