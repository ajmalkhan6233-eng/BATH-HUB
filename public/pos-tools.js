/* POS: no "Scan or type code" bar (AJ 16 Nov). Scan and Bill tools sit in one row with "+ Add item", under the items. Own module: remove the tag and the old bar is back.
   The hidden scan box stays in the page (scanner guns and the page's own code still use it). */
(function () {
  'use strict';
  var items = document.getElementById('itemRows'), cam = document.getElementById('camScanBtn'), tools = document.getElementById('toolsBtn');
  if (!items || !cam || !tools) return;
  var add = items.nextElementSibling; if (!add || !add.classList.contains('add-btn')) return;
  var bar = document.createElement('div'); bar.id = 'itemTools';
  add.parentNode.insertBefore(bar, add); bar.appendChild(add); bar.appendChild(cam); bar.appendChild(tools);
})();
