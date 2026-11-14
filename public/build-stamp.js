/* BLOCK: build-stamp (11 Nov 19:10). Tiny label bottom-left of the owner screen: which build this browser really loaded.
   Change BUILD each release. If it shows an old time, press Ctrl+F5. Display only, no data, no network. */
(function () {
  var BUILD = 'Build 14 Nov 17:10 · Cheque Calendar';
  try {
    var d = document.createElement('div'); d.id = 'rbh-build'; d.textContent = BUILD;
    d.style.cssText = 'position:fixed;left:6px;bottom:2px;z-index:99998;font:10px/1 system-ui,sans-serif;color:var(--text-muted,#888);opacity:.8;pointer-events:none';
    document.body.appendChild(d);
  } catch (e) {}
})();
