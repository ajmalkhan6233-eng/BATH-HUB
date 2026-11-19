/* GRN smart match (own module). After a bill photo is read, each line is matched to a shop item:
   green = sure (the shop's item name is used), amber = pick one, grey = new item. A pick is remembered for that vendor. */
(function (w) {
  'use strict';
  function post(url, body) { return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'failed'); return j; }); }); }
  function use(l, item) { if (!l.vtext) l.vtext = l.name; l.name = item.name; l.m = { status: 'green', item: item, alts: (l.m && l.m.alts) || [] }; }
  function run(d, render) {
    var lines = (d.lines || []).filter(function (l) { return l.name || l.code; }); if (!lines.length) return;
    post('/api/grn-match', { vendor: d.vendor || '', lines: lines.map(function (l) { return { name: l.vtext || l.name, code: l.code }; }) }).then(function (res) {
      lines.forEach(function (l, i) { var r = res.results[i]; if (!r) return; l.m = { status: r.status, item: r.item, alts: r.alts || [] }; if (r.status === 'green' && r.item) use(l, r.item); });
      if (render) render();
    }).catch(function () { /* matching is a helper: the GRN screen works without it */ });
  }
  function chip(text, bg, fn) { var b = document.createElement(fn ? 'button' : 'span'); b.textContent = text; if (fn) { b.type = 'button'; b.onclick = fn; }
    b.style.cssText = 'display:inline-block;margin:3px 4px 0 0;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:600;border:0;min-height:0;color:#fff;background:' + bg + (fn ? ';cursor:pointer' : ''); return b; }
  function badge(tr, d, l, render) {
    if (!l || !l.m) return; var td = tr.querySelector('td[data-l="Item"]'); if (!td) return;
    var box = document.createElement('div'); box.className = 'gm-box';
    if (l.m.status === 'green' && l.m.item) {
      box.appendChild(chip('✓ ' + (l.m.item.item_code || 'matched'), '#15803d'));
      if (l.vtext && l.vtext !== l.name) { var s = document.createElement('small'); s.textContent = 'bill says: ' + l.vtext + ' '; s.style.cssText = 'display:block;opacity:.75;font-size:11px'; box.appendChild(s);
        box.appendChild(chip('not this item', '#6b7280', function () { l.name = l.vtext; l.m = { status: 'new', item: null, alts: l.m.alts || [] }; render(); })); }
    } else if (l.m.status === 'amber') {
      box.appendChild(chip('? pick the item', '#b45309'));
      (l.m.alts || []).forEach(function (a) { box.appendChild(chip((a.item_code ? a.item_code + ' · ' : '') + a.name, '#0a6b4a', function () { var said = l.vtext || l.name; use(l, a); post('/api/grn-match/remember', { vendor: d.vendor || '', text: said, item_code: a.item_code }).catch(function () {}); render(); })); });
      box.appendChild(chip('new item', '#6b7280', function () { l.m = { status: 'new', item: null, alts: [] }; render(); }));
    } else { box.appendChild(chip('new item', '#6b7280')); }
    td.appendChild(box);
  }
  w.GrnMatch = { run: run, badge: badge };
})(window);
