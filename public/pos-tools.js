/* POS: no "Scan or type code" bar (AJ 16 Nov). Scan and Bill tools sit in one row with "+ Add item", under the items. Own module: remove the tag and the old bar is back.
   The hidden scan box stays in the page (scanner guns and the page's own code still use it). */
(function () {
  'use strict';
  var items = document.getElementById('itemRows'), cam = document.getElementById('camScanBtn'), tools = document.getElementById('toolsBtn');
  if (!items || !cam || !tools) return;
  var add = items.nextElementSibling; if (!add || !add.classList.contains('add-btn')) return;
  var bar = document.createElement('div'); bar.id = 'itemTools';
  add.parentNode.insertBefore(bar, add); bar.appendChild(add);
  // AJ 16 Nov: Hold and Held bills are always visible (they were hidden inside Bill tools)
  var hold = document.createElement('button'); hold.type = 'button'; hold.id = 'holdQuick'; hold.className = 'tools-btn'; hold.textContent = 'Hold bill'; hold.addEventListener('click', function () { if (typeof window.holdBill === 'function') window.holdBill(); });
  var held = document.createElement('button'); held.type = 'button'; held.id = 'heldQuick'; held.className = 'tools-btn'; held.textContent = 'Held (0)'; held.addEventListener('click', function () { if (typeof window.toggleTool === 'function') window.toggleTool('heldPanel'); });
  bar.appendChild(hold); bar.appendChild(held); bar.appendChild(cam); bar.appendChild(tools);
  var hb = document.getElementById('heldBtn');
  if (hb) { var sync = function () { var m = /\((\d+)\)/.exec(hb.textContent || ''); var t = 'Held (' + (m ? m[1] : '0') + ')'; if (held.textContent !== t) held.textContent = t; }; sync(); new MutationObserver(sync).observe(hb, { childList: true, characterData: true, subtree: true }); }
})();
