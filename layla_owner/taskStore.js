'use strict';
/** Tasks and reminders in Postgres. All SQL uses placeholders. Dates are stored as timestamptz (UTC). */
const iso = (d) => (d instanceof Date ? d : new Date(d)).toISOString();
const norm = (r) => r && ({ ...r, id: Number(r.id), due_at: new Date(r.due_at), snoozed_until: r.snoozed_until ? new Date(r.snoozed_until) : null, last_sent_at: r.last_sent_at ? new Date(r.last_sent_at) : null, nags_sent: Number(r.nags_sent), nag_every_min: Number(r.nag_every_min), max_nags: Number(r.max_nags) });
module.exports = function createTaskStore(pool) {
  return {
    async create({ kind, title, dueAt, source = 'owner', sourceMsgId = null, meta = null, nagEveryMin = 60, maxNags = 3, branchId = 1 }) {
      const { rows } = await pool.query(`INSERT INTO owner_tasks (branch_id, kind, title, due_at, source, source_msg_id, meta, nag_every_min, max_nags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [branchId, kind, String(title).slice(0, 300), iso(dueAt), source, sourceMsgId, meta ? JSON.stringify(meta) : null, nagEveryMin, maxNags]);
      return norm(rows[0]);
    },
    async listOpen() { const { rows } = await pool.query(`SELECT * FROM owner_tasks WHERE status='OPEN' ORDER BY due_at ASC, id ASC`); return rows.map(norm); },
    async get(id) { const { rows } = await pool.query('SELECT * FROM owner_tasks WHERE id=$1', [id]); return norm(rows[0]); },
    async done(id) { const { rows } = await pool.query(`UPDATE owner_tasks SET status='DONE', done_at=NOW() WHERE id=$1 AND status='OPEN' RETURNING *`, [id]); return norm(rows[0]); },
    async snooze(id, until) { const { rows } = await pool.query(`UPDATE owner_tasks SET snoozed_until=$2, nags_sent=0, last_sent_at=NULL WHERE id=$1 AND status='OPEN' RETURNING *`, [id, iso(until)]); return norm(rows[0]); },
    async markSent(id, at) { const { rows } = await pool.query(`UPDATE owner_tasks SET nags_sent=nags_sent+1, last_sent_at=$2 WHERE id=$1 RETURNING *`, [id, iso(at)]); return norm(rows[0]); },
    /** Records an inbound/outbound message once. Returns false if this WhatsApp message id was already seen (duplicate delivery). */
    async remember(waId, direction, kind, body) {
      if (waId) { const ex = await pool.query('SELECT id FROM owner_messages WHERE wa_message_id=$1', [waId]); if (ex.rows.length) return false; }
      await pool.query('INSERT INTO owner_messages (wa_message_id, direction, kind, body) VALUES ($1,$2,$3,$4)', [waId || null, direction, kind, String(body || '').slice(0, 4000)]);
      return true;
    },
  };
};
