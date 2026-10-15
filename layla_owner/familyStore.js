'use strict';
/** Family notes (names, numbers, small facts). One table, every row belongs to ONE user_key; no query ever crosses users. All SQL uses placeholders. */
module.exports = function createFamilyNotes(pool) {
  let ready;
  const init = () => ready || (ready = pool.query(`CREATE TABLE IF NOT EXISTS family_notes (id SERIAL PRIMARY KEY, user_key TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`));
  const norm = (r) => r && ({ id: Number(r.id), body: r.body, created_at: r.created_at });
  return {
    async add(userKey, body) { await init(); const { rows } = await pool.query('INSERT INTO family_notes (user_key, body) VALUES ($1,$2) RETURNING *', [userKey, String(body).slice(0, 500)]); return norm(rows[0]); },
    async count(userKey) { await init(); const { rows } = await pool.query('SELECT COUNT(*) AS n FROM family_notes WHERE user_key=$1', [userKey]); return Number(rows[0].n); },
    async list(userKey, limit = 10) { await init(); const { rows } = await pool.query('SELECT * FROM family_notes WHERE user_key=$1 ORDER BY id DESC LIMIT $2', [userKey, limit]); return rows.map(norm); },
    async find(userKey, q, limit = 10) { await init(); const { rows } = await pool.query('SELECT * FROM family_notes WHERE user_key=$1 AND POSITION(LOWER($2) IN LOWER(body)) > 0 ORDER BY id DESC LIMIT $3', [userKey, String(q).slice(0, 100), limit]); return rows.map(norm); },
    async remove(userKey, id) { await init(); const { rows } = await pool.query('DELETE FROM family_notes WHERE user_key=$1 AND id=$2 RETURNING id', [userKey, id]); return rows.length > 0; },
  };
};
