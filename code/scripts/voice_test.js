'use strict';
// node scripts/voice_test.js <audio files...>  : prints what Gemini heard + the entries it made. Saves nothing. Never prints the key.
require('dotenv').config();
const fs = require('fs'); const path = require('path');
const { geminiVoice } = require('../utils/geminiVoice');
(async () => {
  for (const f of process.argv.slice(2)) {
    const ext = path.extname(f).toLowerCase();
    const mime = { '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' }[ext] || 'audio/ogg';
    const t = Date.now();
    const r = await geminiVoice({ key: process.env.GEMINI_API_KEY, buffer: fs.readFileSync(f), mime, hints: { customers: ['Saman', 'Nimal', 'Sam'] } });
    console.log(path.basename(f), `${Date.now() - t}ms`, r.ok ? `${r.model} conf=${r.confidence}\n  heard: ${r.text}\n  english: ${r.english}\n  entries: ${JSON.stringify((r.entries || []).map(e => [e.kind, e.party || '', e.amount || e.total_expenses || e.total_sale]))}` : 'FAILED ' + r.reason);
  }
})();
