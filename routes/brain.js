'use strict';
// RBH Brain: owner-only private notes. Notes link with [[Title]], tags are #words, backlinks are computed.
// Own tables only (brain_notes, brain_links), created IF NOT EXISTS. Never touches shop data.
const express = require('express');
const pool = require('../utils/pool');
const refs = require('../utils/brainRefs');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const q = (sql, p) => pool.query(sql, p).then(r => r.rows);
const MAX_BODY = 100000, MAX_TITLE = 200;

let ready = null;
function ensure() {
  if (!ready) ready = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS brain_notes (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '',
      pinned BOOLEAN NOT NULL DEFAULT FALSE, archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await pool.query('ALTER TABLE brain_notes ADD COLUMN IF NOT EXISTS remind_on DATE');
    await pool.query(`CREATE TABLE IF NOT EXISTS brain_photos (id SERIAL PRIMARY KEY, note_id INTEGER NOT NULL, data TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS brain_refs (id SERIAL PRIMARY KEY, note_id INTEGER NOT NULL, kind TEXT NOT NULL, ref_key TEXT NOT NULL)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS brain_links (from_id INTEGER NOT NULL, to_key TEXT NOT NULL)`);
  })().catch(e => { ready = null; throw e; });
  return ready;
}

const keyOf = t => String(t || '').trim().toLowerCase();
function parseLinks(body) { const s = new Set(); String(body || '').replace(/\[\[([^\[\]\n]{1,200})\]\]/g, (_m, t) => { const k = keyOf(t.split('|')[0]); if (k) s.add(k); return ''; }); return [...s]; }
function parseTags(body) { const s = new Set(); String(body || '').replace(/(^|\s)#([\p{L}\p{N}_-]{1,40})/gu, (_m, _a, t) => { s.add(t.toLowerCase()); return ''; }); return [...s]; }
const cleanTitle = t => String(t || '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_TITLE);

async function saveLinks(id, body) {
  await pool.query('DELETE FROM brain_links WHERE from_id = $1', [id]);
  for (const k of parseLinks(body)) await pool.query('INSERT INTO brain_links (from_id, to_key) VALUES ($1,$2)', [id, k]);
}
async function titleTaken(title, exceptId) {
  const rows = await q('SELECT id FROM brain_notes WHERE archived = FALSE AND LOWER(title) = $1', [keyOf(title)]);
  return rows.some(r => Number(r.id) !== Number(exceptId));
}
const dayStr = v => { if (!v) return null; if (!(v instanceof Date)) return String(v).slice(0, 10); const p2 = x => String(x).padStart(2, '0'); return v.getFullYear() + '-' + p2(v.getMonth() + 1) + '-' + p2(v.getDate()); };   // pg gives a DATE as local midnight: read it with local parts, not UTC
const shape = r => ({ id: r.id, title: r.title, pinned: r.pinned, remind_on: dayStr(r.remind_on), tags: r.tags ? r.tags.split(',') : [], updated_at: r.updated_at, snippet: String(r.body || '').replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').slice(0, 110) });

router.use('/brain', ownerOnly, async (_req, res, next) => { try { await ensure(); next(); } catch (e) { console.error('[brain] setup:', e.message); res.status(500).json({ error: 'Brain is not ready' }); } });

router.get('/brain/notes', async (req, res) => {
  try {
    const term = String(req.query.q || '').trim().slice(0, 100).toLowerCase();
    const tag = String(req.query.tag || '').trim().toLowerCase().replace(/^#/, '');
    let rows = await q('SELECT id, title, body, tags, pinned, remind_on, updated_at FROM brain_notes WHERE archived = FALSE ORDER BY pinned DESC, updated_at DESC LIMIT 500');
    if (term) rows = rows.filter(r => r.title.toLowerCase().includes(term) || String(r.body).toLowerCase().includes(term));
    if (tag) rows = rows.filter(r => (r.tags || '').split(',').includes(tag));
    res.json({ notes: rows.map(shape) });
  } catch (e) { console.error('[brain] list:', e.message); res.status(500).json({ error: 'Could not load notes' }); }
});

// Map: every live note and the links between them (resolved [[links]] only)
router.get('/brain/graph', async (_req, res) => {
  try {
    const notes = await q('SELECT id, title, pinned FROM brain_notes WHERE archived = FALSE ORDER BY pinned DESC, updated_at DESC LIMIT 120');
    const byKey = {}; notes.forEach(n => { byKey[keyOf(n.title)] = n.id; });
    const ids = new Set(notes.map(n => Number(n.id)));
    const links = await q('SELECT from_id, to_key FROM brain_links');
    const seen = new Set(), edges = [];
    links.forEach(l => { const a = Number(l.from_id), b = byKey[l.to_key]; if (b && a !== b && ids.has(a)) { const k = a + '>' + b; if (!seen.has(k)) { seen.add(k); edges.push({ from: a, to: b }); } } });
    res.json({ nodes: notes.map(n => ({ id: n.id, title: n.title, pinned: n.pinned })), edges });
  } catch (e) { console.error('[brain] graph:', e.message); res.status(500).json({ error: 'Could not build the map' }); }
});

// Notes whose reminder day is today or earlier (shown at the top of the Brain screen; nothing is sent anywhere)
router.get('/brain/due', async (_req, res) => {
  try {
    const rows = await q('SELECT id, title, body, tags, pinned, remind_on, updated_at FROM brain_notes WHERE archived = FALSE AND remind_on IS NOT NULL ORDER BY remind_on, id');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
    res.json({ today, notes: rows.map(shape).filter(n => n.remind_on && n.remind_on <= today) });
  } catch (e) { res.status(500).json({ error: 'Could not load reminders' }); }
});

router.get('/brain/tags', async (_req, res) => {
  try {
    const rows = await q('SELECT tags FROM brain_notes WHERE archived = FALSE');
    const c = {}; rows.forEach(r => (r.tags ? r.tags.split(',') : []).forEach(t => { c[t] = (c[t] || 0) + 1; }));
    res.json({ tags: Object.entries(c).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n) });
  } catch (e) { res.status(500).json({ error: 'Could not load tags' }); }
});

router.get('/brain/notes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (!id) return res.status(400).json({ error: 'Bad id' });
    const [n] = await q('SELECT * FROM brain_notes WHERE id = $1 AND archived = FALSE', [id]);
    if (!n) return res.status(404).json({ error: 'Not found' });
    const live = await q('SELECT id, title FROM brain_notes WHERE archived = FALSE');
    const byKey = {}; live.forEach(r => { byKey[keyOf(r.title)] = r; });
    const links = parseLinks(n.body).map(k => ({ key: k, id: byKey[k] ? byKey[k].id : null, title: byKey[k] ? byKey[k].title : k }));
    const from = await q('SELECT from_id FROM brain_links WHERE to_key = $1', [keyOf(n.title)]);
    const ids = new Set(from.map(r => Number(r.from_id)));
    const backlinks = live.filter(r => ids.has(Number(r.id)) && Number(r.id) !== id).map(r => ({ id: r.id, title: r.title }));
    const photos = (await q('SELECT id FROM brain_photos WHERE note_id = $1 ORDER BY id', [id])).map(r => r.id);
    const rr = await q('SELECT id, kind, ref_key FROM brain_refs WHERE note_id = $1 ORDER BY id', [id]);
    const records = [];
    for (const r of rr) { const x = await refs.one(r.kind, r.ref_key); records.push(x ? { ref_id: r.id, ...x } : { ref_id: r.id, kind: r.kind, key: r.ref_key, label: r.ref_key, facts: 'not found any more' }); }
    res.json({ note: { id: n.id, title: n.title, body: n.body, tags: n.tags ? n.tags.split(',') : [], pinned: n.pinned, remind_on: dayStr(n.remind_on), updated_at: n.updated_at }, links, backlinks, photos, records });
  } catch (e) { console.error('[brain] get:', e.message); res.status(500).json({ error: 'Could not open note' }); }
});

router.post('/brain/notes', async (req, res) => {
  try {
    const title = cleanTitle(req.body && req.body.title); const body = String((req.body && req.body.body) || '').slice(0, MAX_BODY);
    if (!title) return res.status(400).json({ error: 'Title needed' });
    if (await titleTaken(title, 0)) return res.status(409).json({ error: 'A note with this title already exists' });
    const [n] = await q('INSERT INTO brain_notes (title, body, tags) VALUES ($1,$2,$3) RETURNING id', [title, body, parseTags(body).join(',')]);
    await saveLinks(n.id, body);
    res.status(201).json({ id: n.id });
  } catch (e) { console.error('[brain] create:', e.message); res.status(500).json({ error: 'Could not save note' }); }
});

router.put('/brain/notes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (!id) return res.status(400).json({ error: 'Bad id' });
    const [cur] = await q('SELECT * FROM brain_notes WHERE id = $1 AND archived = FALSE', [id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const title = b.title === undefined ? cur.title : cleanTitle(b.title);
    const body = b.body === undefined ? cur.body : String(b.body).slice(0, MAX_BODY);
    const pinned = b.pinned === undefined ? cur.pinned : !!b.pinned;
    let remind = cur.remind_on;
    if (b.remind_on !== undefined) { if (!b.remind_on) remind = null; else if (/^\d{4}-\d{2}-\d{2}$/.test(String(b.remind_on)) && !isNaN(new Date(b.remind_on))) remind = String(b.remind_on); else return res.status(400).json({ error: 'Bad reminder date' }); }
    if (!title) return res.status(400).json({ error: 'Title needed' });
    if (await titleTaken(title, id)) return res.status(409).json({ error: 'A note with this title already exists' });
    await pool.query('UPDATE brain_notes SET title=$1, body=$2, tags=$3, pinned=$4, remind_on=$5, updated_at=NOW() WHERE id=$6', [title, body, parseTags(body).join(','), pinned, remind, id]);
    await saveLinks(id, body);
    res.json({ ok: true });
  } catch (e) { console.error('[brain] update:', e.message); res.status(500).json({ error: 'Could not save note' }); }
});

// Delete = archive (kept in the database and in the backup, hidden from the screen).
router.delete('/brain/notes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (!id) return res.status(400).json({ error: 'Bad id' });
    await pool.query('UPDATE brain_notes SET archived = TRUE, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Could not delete note' }); }
});

// Tap an unresolved [[link]]: open the note with that title, or create it empty.
router.post('/brain/open', async (req, res) => {
  try {
    const title = cleanTitle(req.body && req.body.title); if (!title) return res.status(400).json({ error: 'Title needed' });
    const rows = await q('SELECT id FROM brain_notes WHERE archived = FALSE AND LOWER(title) = $1', [keyOf(title)]);
    if (rows[0]) return res.json({ id: rows[0].id, created: false });
    const [n] = await q('INSERT INTO brain_notes (title, body, tags) VALUES ($1,$2,$3) RETURNING id', [title, '', '']);
    res.status(201).json({ id: n.id, created: true });
  } catch (e) { res.status(500).json({ error: 'Could not open link' }); }
});

// Shop records a note can point at (read-only lookups; see utils/brainRefs.js)
router.get('/brain/lookup', async (req, res) => {
  try {
    const kind = String(req.query.kind || ''); if (!refs.KINDS.includes(kind)) return res.status(400).json({ error: 'Bad kind' });
    res.json({ results: await refs.find(kind, req.query.q) });
  } catch (e) { res.status(500).json({ error: 'Search failed' }); }
});
router.post('/brain/notes/:id/refs', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (!id) return res.status(400).json({ error: 'Bad id' });
    const [n] = await q('SELECT id FROM brain_notes WHERE id = $1 AND archived = FALSE', [id]);
    if (!n) return res.status(404).json({ error: 'Not found' });
    const kind = String((req.body && req.body.kind) || ''); if (!refs.KINDS.includes(kind)) return res.status(400).json({ error: 'Bad kind' });
    const rec = await refs.one(kind, (req.body && req.body.key) || '');
    if (!rec) return res.status(404).json({ error: 'Record not found' });
    const dup = await q('SELECT id FROM brain_refs WHERE note_id = $1 AND kind = $2 AND ref_key = $3', [id, kind, rec.key]);
    if (dup[0]) return res.json({ id: dup[0].id, existed: true });
    const cnt = await q('SELECT COUNT(*) AS n FROM brain_refs WHERE note_id = $1', [id]);
    if (Number(cnt[0].n) >= 30) return res.status(409).json({ error: 'Up to 30 linked records per note' });
    const [r] = await q('INSERT INTO brain_refs (note_id, kind, ref_key) VALUES ($1,$2,$3) RETURNING id', [id, kind, rec.key]);
    await pool.query('UPDATE brain_notes SET updated_at = NOW() WHERE id = $1', [id]);
    res.status(201).json({ id: r.id });
  } catch (e) { console.error('[brain] ref:', e.message); res.status(500).json({ error: 'Could not link record' }); }
});
router.delete('/brain/refs/:rid', async (req, res) => {
  try { const rid = parseInt(req.params.rid, 10); if (!rid) return res.status(400).json({ error: 'Bad id' }); await pool.query('DELETE FROM brain_refs WHERE id = $1', [rid]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: 'Could not unlink' }); }
});

// Photos: the screen shrinks each photo to a JPEG first; the server checks it really is a JPEG and small.
const MAX_PHOTO_B64 = 900000, MAX_PHOTOS = 12;
router.post('/brain/notes/:id/photos', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (!id) return res.status(400).json({ error: 'Bad id' });
    const [n] = await q('SELECT id FROM brain_notes WHERE id = $1 AND archived = FALSE', [id]);
    if (!n) return res.status(404).json({ error: 'Not found' });
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body && req.body.data) || ''));
    if (!m) return res.status(400).json({ error: 'Photo must be a JPEG' });
    if (m[1].length > MAX_PHOTO_B64) return res.status(413).json({ error: 'Photo is too big' });
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return res.status(400).json({ error: 'Photo must be a JPEG' });
    const have = await q('SELECT COUNT(*) AS n FROM brain_photos WHERE note_id = $1', [id]);
    if (Number(have[0].n) >= MAX_PHOTOS) return res.status(409).json({ error: 'Up to ' + MAX_PHOTOS + ' photos per note' });
    const [p] = await q('INSERT INTO brain_photos (note_id, data) VALUES ($1,$2) RETURNING id', [id, m[1]]);
    await pool.query('UPDATE brain_notes SET updated_at = NOW() WHERE id = $1', [id]);
    res.status(201).json({ id: p.id });
  } catch (e) { console.error('[brain] photo:', e.message); res.status(500).json({ error: 'Could not save photo' }); }
});
router.get('/brain/photos/:pid', async (req, res) => {
  try {
    const pid = parseInt(req.params.pid, 10); if (!pid) return res.status(400).end();
    const [p] = await q('SELECT data FROM brain_photos WHERE id = $1', [pid]);
    if (!p) return res.status(404).end();
    res.set({ 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, max-age=86400' }).send(Buffer.from(p.data, 'base64'));
  } catch (e) { res.status(500).end(); }
});
router.delete('/brain/photos/:pid', async (req, res) => {
  try {
    const pid = parseInt(req.params.pid, 10); if (!pid) return res.status(400).json({ error: 'Bad id' });
    await pool.query('DELETE FROM brain_photos WHERE id = $1', [pid]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Could not delete photo' }); }
});

router.get('/brain/export', async (_req, res) => {
  try {
    const rows = await q('SELECT title, body, tags, updated_at FROM brain_notes WHERE archived = FALSE ORDER BY title');
    const md = rows.map(r => `# ${r.title}\n\n${r.body}\n`).join('\n---\n\n');
    res.set('Content-Type', 'text/markdown; charset=utf-8').set('Content-Disposition', 'attachment; filename="rbh-brain.md"').send(md || '# RBH Brain\n\n(no notes yet)\n');
  } catch (e) { res.status(500).json({ error: 'Could not export' }); }
});

module.exports = router;
module.exports._test = { parseLinks, parseTags };
