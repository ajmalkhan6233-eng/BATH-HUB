'use strict';
// Postgres store for LAYLA v2. Only touches the layla_* tables created by migrations/001_layla_v2.sql.
// `pool` is anything with query(text, params) (pg Pool, or pg-mem in tests). No shop/finance table is read here.
const fs = require('fs');
const path = require('path');

const { normalizePhone: digits } = require('./roles');   // 0771234567, +94 77 123 4567 and 94771234567 are the same person
const KEEP_MESSAGES = 60;   // per phone; LAYLA only reads the latest 20

function createPgStore(pool) {
    let ready = null;
    const ensureSchema = () => ready || (ready = (async () => {
        const have = await pool.query(`SELECT 1 FROM layla_messages LIMIT 1`).then(() => true).catch(() => false);
        if (have) return;   // already migrated (also keeps pg-mem happy: it dislikes IF NOT EXISTS on an existing table)
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_layla_v2.sql'), 'utf8')
            .split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
        for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(stmt);
    })().catch(e => { ready = null; throw e; }));
    const q = async (text, params) => { await ensureSchema(); return pool.query(text, params); };

    return {
        name: 'pg',
        ensureSchema,
        async getContact(phone) {
            const r = await q(`SELECT phone, role, name FROM layla_contacts WHERE phone = $1 AND active = TRUE`, [digits(phone)]);
            return r.rows[0] || null;
        },
        async addContact({ phone, role = 'staff', name = null }) {
            if (!['owner', 'staff'].includes(role)) throw new Error('role must be owner or staff');
            await q(`INSERT INTO layla_contacts (phone, role, name) VALUES ($1,$2,$3)
                     ON CONFLICT (phone) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, active = TRUE`, [digits(phone), role, name]);
        },
        async removeContact(phone) { await q(`UPDATE layla_contacts SET active = FALSE WHERE phone = $1`, [digits(phone)]); },
        async listContacts(role) {
            const r = role ? await q(`SELECT phone, role, name FROM layla_contacts WHERE active = TRUE AND role = $1 ORDER BY id`, [role])
                           : await q(`SELECT phone, role, name FROM layla_contacts WHERE active = TRUE ORDER BY id`);
            return r.rows;
        },
        async createTask({ kind, phone = null, name = null, summary, payload = null }) {
            const r = await q(`INSERT INTO layla_tasks (kind, phone, cust_name, summary, payload) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
                [kind, phone ? digits(phone) : null, name, String(summary).slice(0, 1000), payload ? JSON.stringify(payload) : null]);
            return r.rows[0].id;
        },
        async getTask(id) { const r = await q(`SELECT * FROM layla_tasks WHERE id = $1`, [Number(id)]); return r.rows[0] || null; },
        async listOpenTasks(limit = 20) { return (await q(`SELECT * FROM layla_tasks WHERE status = 'open' ORDER BY id DESC LIMIT $1`, [limit])).rows; },
        async closeTask(id, by = 'staff') {
            const r = await q(`UPDATE layla_tasks SET status = 'done', closed_at = CURRENT_TIMESTAMP, closed_by = $2 WHERE id = $1 AND status = 'open' RETURNING id`, [Number(id), by]);
            return r.rows.length > 0;
        },
        async getState(key) { const r = await q(`SELECT value FROM layla_state WHERE key = $1`, [key]); return r.rows.length ? r.rows[0].value : null; },
        async setState(key, value) {
            await q(`INSERT INTO layla_state (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`, [key, String(value)]);
        },
        async getCustomer(phone) { const r = await q(`SELECT phone, name, lang FROM layla_customers WHERE phone = $1`, [digits(phone)]); return r.rows[0] || null; },
        async saveCustomer(phone, { name, lang } = {}) {
            await q(`INSERT INTO layla_customers (phone, name, lang) VALUES ($1,$2,$3)
                     ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, layla_customers.name), lang = COALESCE(EXCLUDED.lang, layla_customers.lang), updated_at = CURRENT_TIMESTAMP`,
                [digits(phone), name || null, lang || null]);
        },
        async addMessage(phone, direction, body, lang = null) {
            const p = digits(phone);
            await q(`INSERT INTO layla_messages (phone, direction, body, lang) VALUES ($1,$2,$3,$4)`, [p, direction, String(body).slice(0, 2000), lang]);
            await q(`DELETE FROM layla_messages WHERE phone = $1 AND id <= (SELECT MAX(id) FROM layla_messages WHERE phone = $1) - $2`, [p, KEEP_MESSAGES]);
        },
        async recentMessages(phone, n = 20) {
            const r = await q(`SELECT direction, body, lang FROM layla_messages WHERE phone = $1 ORDER BY id DESC LIMIT $2`, [digits(phone), n]);
            return r.rows.reverse();
        },
    };
}

module.exports = { createPgStore };