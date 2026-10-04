// Cheque Register — server-side home for the daily ledger's own Cheques tab
// (public/daily-entry-v2.html). Added 2026-07-26.
//
// WHY THIS FILE EXISTS: the ledger's Cheques tab was found to have been
// silently failing to save to the server this whole time. It was POSTing
// to /api/cheques (server.js), but that route is a COMPLETELY DIFFERENT,
// pre-existing feature — a customer-linked cheque tracker (CLAUDE.md §7.3:
// "cheques" table joined to "customers" via customer_id, no free-text
// payee field at all). The shapes never matched (this page posts a whole
// array; that route expects one object with a required customer_id), so
// every save has always come back 400 and been silently swallowed
// (".catch(()=>{})"), leaving localStorage as the only real copy of every
// cheque entered through this tab — including, as of the same day this was
// found, cheque photos. This file is a SEPARATE table and a SEPARATE URL
// so the two features can never collide or overwrite each other's data
// again. /api/cheques (server.js) is NOT touched by this file.
//
// MOUNTED 2026-07-27 (hotfix): was left unmounted on purpose per an earlier
// session's "no live DB, no restarts" instruction — every device hit a
// uniform 401 because /api/cheque-register matched no auth-bypass prefix
// AND this file was never require()'d in server.js at all. Both fixed in
// the same hotfix: app.use('/', require('./routes/cheque_register')) added
// to server.js, plus a bypass entry for /api/cheque-register. Live and
// verified on the running server before this file was brought into master.
//
// SAFETY NOTES:
// - Migration (idempotent CREATE TABLE IF NOT EXISTS) is purely additive —
//   it creates one new table and touches nothing that already exists.
// - Reuses the SAME pool already used for the live "bathco" database
//   (imported from layla.js, exactly like server.js itself does) rather
//   than opening a second, redundant connection pool.
// - POST is a whole-register replace (client always sends its full current
//   list, same "server-first overwrite" model already established by
//   routes/daily_entry_sync.js) wrapped in a single transaction — either
//   every row replaces successfully, or the table is left exactly as it
//   was before the request. No partial-write state is possible.
const { pool } = require('../layla');
const express = require('express');
const router = express.Router();

pool.query(`
  CREATE TABLE IF NOT EXISTS cheque_register (
    id           TEXT PRIMARY KEY,
    no           TEXT NOT NULL DEFAULT '',
    bank         TEXT NOT NULL DEFAULT '',
    payee        TEXT NOT NULL DEFAULT '',
    amount       NUMERIC NOT NULL DEFAULT 0,
    cheque_date  DATE,
    due_date     DATE,
    status       TEXT NOT NULL DEFAULT 'Pending',
    notes        TEXT NOT NULL DEFAULT '',
    photo        TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`).catch((e) => console.error('[cheque_register] migration failed:', e.message));

function toDateOrNull(v) {
  return (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null;
}

router.get('/api/cheque-register', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, no, bank, payee, amount, cheque_date, due_date, status, notes, photo, updated_at ' +
      'FROM cheque_register ORDER BY due_date ASC NULLS LAST, id ASC'
    );
    res.json(result.rows.map((r) => ({
      id: r.id, no: r.no, bank: r.bank, payee: r.payee, amount: Number(r.amount) || 0,
      chqDate: r.cheque_date ? String(r.cheque_date).slice(0, 10) : '',
      due: r.due_date ? String(r.due_date).slice(0, 10) : '',
      status: r.status, notes: r.notes, photo: r.photo || null,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Whole-register replace. Body: { cheques: [ {id, no, bank, payee, amount,
// chqDate, due, status, notes, photo}, ... ] } — same field names the
// client already uses internally, no translation layer to get wrong.
router.post('/api/cheque-register', async (req, res) => {
  const { cheques } = req.body || {};
  if (!Array.isArray(cheques)) {
    return res.status(400).json({ error: 'cheques (array) required' });
  }
  const bad = [];
  const valid = cheques.filter((c, i) => {
    if (!c || typeof c !== 'object' || !c.id || typeof c.id !== 'string') { bad.push(i); return false; }
    return true;
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM cheque_register');
    for (const c of valid) {
      await client.query(
        `INSERT INTO cheque_register (id, no, bank, payee, amount, cheque_date, due_date, status, notes, photo, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())`,
        [
          c.id, String(c.no || ''), String(c.bank || ''), String(c.payee || ''), Number(c.amount) || 0,
          toDateOrNull(c.chqDate), toDateOrNull(c.due), String(c.status || 'Pending'), String(c.notes || ''),
          c.photo ? String(c.photo) : null,
        ]
      );
    }
    const countResult = await client.query('SELECT COUNT(*)::int AS n FROM cheque_register');
    await client.query('COMMIT');
    res.json({
      ok: true,
      received: cheques.length,
      saved: valid.length,
      skipped: bad.length, // rows missing a usable id — never silently dropped without saying so
      skippedIndexes: bad,
      count: countResult.rows[0].n,
      server_time: new Date().toISOString(),
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
module.exports._internal = { pool, toDateOrNull };
