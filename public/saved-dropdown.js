/* Saved-info boxes (anything with a saved list): the list drops when you click the box or press the Down arrow.
   Own module. Works in the shell and in every screen frame. Never picks anything by itself. */
(function () {
  function hook(doc) {
    try { if (!doc || doc.__sdHook) return; doc.__sdHook = 1;
      var open = function (e) { var el = e.target; if (!el || el.tagName !== 'INPUT' || !el.getAttribute('list')) return;
        if (el.type === 'checkbox' || el.type === 'radio' || el.readOnly || el.disabled) return;
        try { if (el.showPicker) el.showPicker(); } catch (x) {} };
      doc.addEventListener('click', open, true);
      doc.addEventListener('focusin', open, true);
    } catch (e) {}
  }
  hook(document);
  document.addEventListener('load', function (e) { var t = e.target; if (t && t.tagName === 'IFRAME') try { hook(t.contentDocument); } catch (x) {} }, true);
  [].forEach.call(document.querySelectorAll('iframe'), function (f) { try { hook(f.contentDocument); } catch (x) {} });
})();
