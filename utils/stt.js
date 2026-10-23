'use strict';
// Speech to text for voice notes. OFF until a free tool is installed on the PC and LAYLA_STT_CMD is set,
// e.g.  LAYLA_STT_CMD=python C:\tools\stt.py "{file}"   (the command must print the spoken words and nothing else).
// Never sends audio to the internet by itself: it only runs the command the owner set.
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Switch: LAYLA_STT_CMD in the environment, OR the marker file data/stt_on (made by the install task) which uses scripts/stt_whisper.py.
const SCRIPT = path.join(__dirname, '..', 'scripts', 'stt_whisper.py');
const MARKER = path.join(__dirname, '..', 'data', 'stt_on');
const resolveCmd = () => process.env.LAYLA_STT_CMD || (fs.existsSync(MARKER) && fs.existsSync(SCRIPT) ? `python "${SCRIPT}" "{file}"` : '');

const enabled = (cmd = resolveCmd()) => !!(cmd && cmd.includes('{file}'));

// file must be a path the server made itself (letters, digits, dots, dashes, slashes, spaces): never text from a customer.
const SAFE_FILE = /^[\w:\\/. -]+$/;

function transcribe(file, { cmd = resolveCmd(), timeoutMs = 120000, run = exec } = {}) {
  return new Promise((resolve) => {
    if (!enabled(cmd) || !SAFE_FILE.test(String(file || ''))) return resolve(null);
    run(cmd.replace('{file}', file), { timeout: timeoutMs, maxBuffer: 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err) { console.error('[STT] failed:', err.message); return resolve(null); }
      const text = String(stdout || '').replace(/\s+/g, ' ').trim();
      resolve(text.length >= 2 ? text.slice(0, 1000) : null);
    });
  });
}

module.exports = { enabled, transcribe };
