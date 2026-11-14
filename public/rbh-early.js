/* rbh-early.js (14 Nov): runs in <head> of every screen. Inside the owner shell it applies the fit-window style at the FIRST paint
   (the shell used to add it after load, so the sizes jumped). Same skips as the shell: POS, GRN, Layla and the Stock page. Any failure is ignored. */
try {
  if (top !== self && !/pos_billing|grn_workbench|layla-owner/.test(location.pathname)) {
    var h = document.documentElement;
    if (!h.hasAttribute('data-keepfont')) { h.classList.add('in-frame'); h.setAttribute('data-fc','1'); document.write('<link rel="stylesheet" href="/fit-window.css"><link rel="stylesheet" href="/frame-comfort.css">'); }
  }
} catch (e) { /* ignore */ }
