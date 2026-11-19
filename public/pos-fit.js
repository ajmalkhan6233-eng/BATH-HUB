/* POS fit (AJ 16 Nov): Payment method and Generate Bill share one row (saves a whole row of height). Ids stay, so nothing else changes.
   Remove the tag to go back. */
(function () {
  'use strict';
  var sel = document.getElementById('paymentMethod'), gen = document.getElementById('genBtn'); if (!sel || !gen || document.getElementById('payRow')) return;
  var lab = sel.previousElementSibling; if (lab && lab.tagName === 'LABEL') lab.style.display = 'none';
  var row = document.createElement('div'); row.id = 'payRow';
  sel.parentNode.insertBefore(row, sel); row.appendChild(sel); row.appendChild(gen);
})();

/* The item drop-down never runs off the bottom of the window: it opens upward when there is more room above, and shrinks to fit (it scrolls inside itself). */
(function () {
  'use strict';
  var busy = false;
  function fit(list) {
    if (busy || !list.classList.contains('open')) return; busy = true;
    try {
      var row = list.closest('.item-row'), inp = row && row.querySelector('.i-name'); if (!inp) return;
      var r = inp.getBoundingClientRect(), vh = window.innerHeight, below = vh - r.bottom - 8, above = r.top - 8;
      list.style.maxHeight = ''; var need = Math.min(list.scrollHeight, 320);
      if (need <= below || below >= above) { list.style.top = (r.bottom + 2) + 'px'; list.style.bottom = 'auto'; list.style.maxHeight = Math.max(80, Math.min(320, below)) + 'px'; }
      else { var h = Math.max(80, Math.min(need, above)); list.style.maxHeight = h + 'px'; list.style.top = Math.max(4, r.top - h - 2) + 'px'; list.style.bottom = 'auto'; }
      list.style.overflowY = 'auto';
    } finally { busy = false; }
  }
  var host = document.getElementById('itemRows'); if (!host) return;
  new MutationObserver(function (ms) { ms.forEach(function (m) { var t = m.target; if (t.classList && t.classList.contains('pick-list')) fit(t); else if (t.closest && t.closest('.pick-list')) fit(t.closest('.pick-list')); }); })
    .observe(host, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
})();
