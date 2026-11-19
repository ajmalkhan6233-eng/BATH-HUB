// MODULE: diary - search, tags, "on this day", PDF page, PIN. Pure functions, no screen, no Electron.
const crypto = require('crypto');
const esc = (s) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const tagsOf = (t) => (String(t || '').match(/#[\p{L}\p{N}_]+/gu) || []).map((x) => x.toLowerCase());
const day = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// q = words, date = 'YYYY-MM-DD', tag = '#word'. Newest first.
function find(diary, { q = '', date = '', tag = '', limit = 60 } = {}) {
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  const tg = String(tag || '').toLowerCase().replace(/^#?/, '#');
  return diary.filter((e) => e.role === 'user' || e.role === 'layla')
    .filter((e) => !date || day(e.ts) === date)
    .filter((e) => !tag || tagsOf(e.text).includes(tg))
    .filter((e) => words.every((w) => (e.text || '').toLowerCase().includes(w)))
    .slice(-limit).reverse();
}
// same month+day in an earlier year
function onThisDay(diary, now = new Date()) {
  return diary.filter((e) => { const d = new Date(e.ts); return e.role === 'user' && d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear(); });
}
function allTags(diary) { const m = {}; diary.forEach((e) => tagsOf(e.text).forEach((t) => (m[t] = (m[t] || 0) + 1))); return Object.keys(m).sort((a, b) => m[b] - m[a]).slice(0, 12); }
function toHtml(entries, title = 'My diary') {
  const rows = entries.map((e) => `<p><small>${esc(new Date(e.ts).toLocaleString())}${e.role === 'layla' ? ' (Layla)' : ''}</small><br>${esc(e.text).replace(/\n/g, '<br>')}${(e.files || []).length ? '<br><i>[' + e.files.length + ' attachment(s)]</i>' : ''}</p>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px Georgia,serif;max-width:680px;margin:30px auto;color:#222}h1{color:#8a6d1a}small{color:#888}p{border-bottom:1px solid #eee;padding-bottom:8px}</style><h1>${esc(title)}</h1>${rows}`;
}
function hashPin(pin, salt = crypto.randomBytes(8).toString('hex')) { return salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex'); }
function checkPin(pin, stored) { if (!stored) return true; const [salt] = stored.split(':'); return hashPin(pin, salt) === stored; }
function streak(diary, now = new Date()) { const days = new Set(diary.filter((e) => e.role === 'user').map((e) => new Date(e.ts).toDateString())); let n = 0; const d = new Date(now); if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); } return n; }
module.exports = { streak, find, onThisDay, allTags, toHtml, hashPin, checkPin, tagsOf, day };
