'use strict';
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path'); const crypto = require('crypto');
/** Voice note bytes -> text via the local Python script. Never throws: returns { ok:false } so the chat can ask the owner to type it. */
async function transcribe(buffer, mime, { python = process.env.PYTHON || 'python', script = path.join(__dirname, '..', 'scripts', 'transcribe.py'), timeoutMs = 90000, spawnFn = spawn } = {}) {
  const ext = /ogg|opus/.test(mime || '') ? '.ogg' : /mp4|m4a|aac/.test(mime || '') ? '.m4a' : /mpeg|mp3/.test(mime || '') ? '.mp3' : '.audio';
  const tmp = path.join(os.tmpdir(), `layla-${crypto.randomBytes(8).toString('hex')}${ext}`);
  fs.writeFileSync(tmp, buffer);
  try {
    return await new Promise((resolve) => {
      let out = ''; const p = spawnFn(python, [script, tmp], { windowsHide: true });
      const timer = setTimeout(() => { try { p.kill(); } catch (_) {} resolve({ ok: false, reason: 'timeout' }); }, timeoutMs);
      p.stdout.on('data', (d) => { out += d; });
      p.on('error', () => { clearTimeout(timer); resolve({ ok: false, reason: 'python not available' }); });
      p.on('close', (code) => { clearTimeout(timer); try { const j = JSON.parse(out); resolve(code === 0 && j.text ? { ok: true, text: j.text, language: j.language } : { ok: false, reason: 'no speech found' }); } catch (_) { resolve({ ok: false, reason: 'bad output' }); } });
    });
  } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
}
module.exports = { transcribe };
