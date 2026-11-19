/* POS phone-camera barcode scan (own module, 10 Nov 2026).
   Uses ZXing from the local file /lib/zxing.min.js (no CDN). iPhone Safari has no BarcodeDetector, so ZXing does the reading.
   It only READS a code and hands it to the POS (onCode). It never saves a bill and never touches the cart itself.
   Camera needs https (or localhost). Nothing is recorded or uploaded: frames stay on the phone. */
(function (root) {
  'use strict';

  var SAME_CODE_GAP_MS = 2000;   // the same code seen again inside 2 s is the same scan, not a second item

  // Pure: should this read count as a new scan?
  function accept(text, last, now) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return false;
    if (last && last.text === t && (now - last.at) < SAME_CODE_GAP_MS) return false;
    return true;
  }

  var state = { overlay: null, video: null, reader: null, controls: null, last: null, busy: false, loading: null };

  function loadZXing() {
    if (root.ZXing && root.ZXing.BrowserMultiFormatReader) return Promise.resolve();
    if (state.loading) return state.loading;
    state.loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/lib/zxing.min.js';
      s.onload = function () { (root.ZXing && root.ZXing.BrowserMultiFormatReader) ? resolve() : reject(new Error('Scanner file did not load')); };
      s.onerror = function () { state.loading = null; reject(new Error('Scanner file did not load')); };
      document.head.appendChild(s);
    });
    return state.loading;
  }

  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; return e; }

  function buildOverlay() {
    var o = el('div', 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;');
    o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Camera barcode scan');
    var v = el('video', 'flex:1;min-height:0;width:100%;object-fit:cover;background:#000;');
    v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.muted = true; v.autoplay = true;
    var frame = el('div', 'position:absolute;left:10%;right:10%;top:30%;height:22%;border:3px solid #d4af37;border-radius:12px;pointer-events:none;');
    var msg = el('div', 'padding:10px 14px;font-size:16px;color:#fff;background:#111;min-height:44px;text-align:center;', 'Point at the barcode');
    msg.setAttribute('role', 'status');
    var done = el('button', 'min-height:56px;font-size:18px;font-weight:700;border:0;background:#d4af37;color:#000;', 'Done');
    done.type = 'button';
    o.appendChild(v); o.appendChild(frame); o.appendChild(msg); o.appendChild(done);
    return { overlay: o, video: v, msg: msg, done: done };
  }

  function close() {
    try { if (state.controls && state.controls.stop) state.controls.stop(); } catch (e) {}
    try { if (state.reader && state.reader.reset) state.reader.reset(); } catch (e) {}
    try { var st = state.video && state.video.srcObject; if (st && st.getTracks) st.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    if (state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    state.overlay = state.video = state.reader = state.controls = state.last = null; state.busy = false;
  }

  function friendly(err) {
    var n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Camera is blocked. Allow the camera for this site in Safari settings, then try again.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No camera found on this device.';
    if (n === 'NotReadableError') return 'The camera is busy in another app. Close it and try again.';
    return (err && err.message) || 'Could not start the camera.';
  }

  /* open(onCode): onCode(code) may return a promise and/or a short status string to show on the screen. */
  function open(onCode) {
    if (state.overlay) return;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      if (onCode) { try { onCode(null, 'Camera scan needs https. Type the code instead.'); } catch (e) {} }
      return;
    }
    var ui = buildOverlay();
    state.overlay = ui.overlay; state.video = ui.video;
    document.body.appendChild(ui.overlay);
    ui.done.addEventListener('click', close);

    loadZXing().then(function () {
      if (!state.overlay) return;                              // closed while loading
      var Z = root.ZXing, hints = new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8,
        Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.QR_CODE]);
      hints.set(Z.DecodeHintType.TRY_HARDER, true);
      state.reader = new Z.BrowserMultiFormatReader(hints, 300);
      return state.reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, ui.video, function (result) {
        if (!result || state.busy || !state.overlay) return;
        var text = result.getText(), now = Date.now();
        if (!accept(text, state.last, now)) return;
        state.last = { text: String(text).trim(), at: now };
        state.busy = true;
        try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
        var out;
        try { out = onCode ? onCode(state.last.text) : null; } catch (e) { out = 'Could not add that code.'; }
        Promise.resolve(out).then(function (m) { if (typeof m === 'string' && ui.msg) ui.msg.textContent = m; })
          .catch(function () { if (ui.msg) ui.msg.textContent = 'Could not add that code.'; })
          .then(function () { state.busy = false; });
      }).then(function (controls) { state.controls = controls; if (!state.overlay) close(); });
    }).catch(function (err) {
      if (ui.msg) ui.msg.textContent = friendly(err);
    });
  }

  root.PosCameraScan = { open: open, close: close, _accept: accept };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PosCameraScan;
})(typeof window !== 'undefined' ? window : globalThis);
