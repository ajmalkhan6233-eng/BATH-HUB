'use strict';
// OWNER DIARY (module): the Layla desk-notepad brain, copied in. Plain writing = saved in the diary; real reminders are handed to
// Layla's own reminder engine; no-time items wait under "keep in mind". Free, rule-based, no API key. Data: data/owner-diary/state.json
// (the data/ folder is git-ignored, so it never reaches the public repo). Owner/admin only (the route checks).
const path = require('path'); const fs = require('fs');
const store = require('./store'); const local = require('./local'); const dy = require('./diary');

let ready = false;
function init(dir = path.join(process.cwd(), 'data', 'owner-diary')) { fs.mkdirSync(dir, { recursive: true }); store.init(dir); ready = true; }
const nice = (iso) => { const d = new Date(iso); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
const line = (e) => `${nice(e.ts)}  ${e.text}`;

function handle(text, now = new Date()) {
  if (!ready) init();
  const raw = String(text || '').trim().slice(0, 2000);
  if (!raw) return { reply: 'Write anything. I keep it like a diary.' };
  const low = raw.toLowerCase().replace(/[.!\s]+$/, '');
  if (/^(clear|clean|clean up|cler|clr|tidy)$/.test(low)) return { reply: 'Tidied. Nothing deleted.', clear: true };
  let m;
  if ((m = low.match(/^(?:find|search)\s+(.+)$/))) {
    const hits = dy.find(store.allDiary(), { q: m[1], limit: 8 });
    return { reply: hits.length ? hits.map(line).join('\n') : 'Nothing found.' };
  }
  if (/^on this day$/.test(low)) { const h = dy.onThisDay(store.allDiary(), now); return { reply: h.length ? h.slice(0, 6).map(line).join('\n') : 'Nothing from earlier years yet.' }; }
  if (/^(keep in mind|kept|waiting)$/.test(low)) { const k = store.openTasks().filter((t) => !store.effectiveDue(t)); return { reply: k.length ? k.map((t) => '• ' + t.title).join('\n') : 'Nothing waiting. 🌿' }; }
  if ((m = low.match(/^mood\s*(.*)$/))) { store.addDiary({ role: 'user', text: 'Mood: ' + (m[1] || '🙂').slice(0, 6) + ' #mood' }); return { reply: 'Noted. 🙂' }; }
  if (/^streak$/.test(low)) return { reply: '🔥 ' + dy.streak(store.allDiary(), now) + ' day(s)' };

  const before = new Set(store.listTasks().map((t) => t.id));
  store.addDiary({ role: 'user', text: raw });
  const r = local.ask(raw, now);
  const added = store.listTasks().filter((t) => !before.has(t.id));
  const timed = added.filter((t) => store.effectiveDue(t));
  if (timed.length) { timed.forEach((t) => store.removeTask(t.id)); return { reply: r.reply, forward: raw }; } // a real timed reminder rings through Layla's own reminder engine
  store.addDiary({ role: 'layla', text: r.reply });
  return { reply: r.reply };
}
module.exports = { init, handle, store };
