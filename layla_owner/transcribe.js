'use strict';
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path'); const crypto = require('crypto');
const { geminiVoice } = require('../utils/geminiVoice');
/**
 * Voice note bytes -> text. Gemini first when GEMINI_API_KEY is set (it understands Sinhala, Tamil and mixed Sinhala-English, and also
 * returns an English version and, for a dictated day's expenses/sales, the figures). If Gemini is not set or fails, the local Python
 * script is used (English only in practice). Never throws: returns { ok:false } so the chat can ask the owner to type it.
 * Returns { ok, text, language, english?, entry?, warnings?, engine }. `text` is what the existing English intent parser reads:
 * the English version when there is one, with the original wording kept in `original`.
 */
async function transcribe(buffer, mime, { key = process.env.GEMINI_API_KEY, hintsFn = null, geminiFn = geminiVoice, python = process.env.PYTHON || 'python', script = path.join(__dirname, '..', 'scripts', 'transcribe.py'), timeoutMs = 90000, spawnFn = spawn } = {}) {
  if (key) {
    const hints = typeof hintsFn === 'function' ? await Promise.resolve(hintsFn()).catch(() => null) : null;
    const g = await geminiFn({ key, buffer, mime, hints }).catch((e) => ({ ok: false, reason: e.message }));
    if (g && g.ok) { console.log('[transcribe] heard via', g.model, '|', String(g.english || g.text).slice(0, 120)); }
    if (g && g.ok) return { ok: true, text: g.english || g.text, original: g.text, language: g.language, entry: g.entry, entries: g.entries, warnings: g.warnings, confidence: g.confidence, engine: g.model };
    console.error('[transcribe] Gemini failed, trying the local reader:', g && g.reason);
    timeoutMs = Math.min(timeoutMs, 20000); // the chat bridge gives up at 90s: Gemini (<=55s) + this must fit
  }
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
