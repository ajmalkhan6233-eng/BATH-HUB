// routes/agent_rulebook.js
// M1 AGENT RULEBOOK: rules Aj teaches the agent. Owner/admin only.
//
// - Own table `agent_rules`; nothing else is touched.
// - A correction never overwrites: editing a rule inserts a NEW row (same rule_key,
//   version + 1, active) and deactivates the previous version. History stays.
// - GET /agent/rulebook returns the active rules as plain text for the agent to load.
// - Seeded once (only when the table is empty) with the standing business rules.

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const SEED_RULES = [
    ['commission', 'Commission is paid weekly, calculated on net sales.'],
    ['exchange', 'An exchange reverses the original commission, then reapplies commission on the new sale.'],
    ['returns', 'The 15-day return window is a soft flag only: flag the sale, do not block it. Aj decides.'],
    ['overhead', 'Overhead reserve = monthly overhead total / days in the month, set aside per day.'],
    ['cheques', 'A held cheque shows its old date crossed out beside the new date.'],
];

function isOwner(req) {
    const u = req.session && req.session.user;
    return !!u && (u.role === 'admin' || u.role === 'owner');
}

function ownerOnly(req, res, next) {
    if (!isOwner(req)) return res.status(403).json({ error: 'Owner only' });
    next();
}

function clean(v) { return String(v == null ? '' : v).trim(); }

function createRouter(pool) {
    const router = express.Router();

    const ready = (async () => {
        await pool.query(`CREATE TABLE IF NOT EXISTS agent_rules (
            id SERIAL PRIMARY KEY,
            rule_key INTEGER NOT NULL,
            topic TEXT NOT NULL,
            rule_text TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'taught by Aj',
            version INTEGER NOT NULL DEFAULT 1,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_rules_key ON agent_rules(rule_key, version)`);
        const c = await pool.query(`SELECT COUNT(*)::int AS n FROM agent_rules`);
        if (c.rows[0].n === 0) {
            for (const [topic, text] of SEED_RULES) await insertFirst(topic, text, 'taught by Aj');
        }
    })().catch(e => console.error('[agent_rulebook] init failed:', e.message));

    // rule_key = id of the first version. Insert v1, then point rule_key at its own id.
    async function insertFirst(topic, text, source) {
        const r = await pool.query(
            `INSERT INTO agent_rules (rule_key, topic, rule_text, source) VALUES (0, $1, $2, $3) RETURNING id`,
            [topic, text, source]);
        const id = r.rows[0].id;
        const u = await pool.query(`UPDATE agent_rules SET rule_key = id WHERE id = $1 RETURNING *`, [id]);
        return u.rows[0];
    }

    router.get('/agent/rules', ownerOnly, async (req, res) => {
        try {
            await ready;
            const all = req.query.all === '1';
            const r = await pool.query(
                `SELECT * FROM agent_rules ${all ? '' : 'WHERE active = TRUE'} ORDER BY topic, rule_key, version DESC`);
            res.json(r.rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Every version of one rule, oldest first: what Aj taught, and each correction after it.
    router.get('/agent/rules/:id/history', ownerOnly, async (req, res) => {
        try {
            await ready;
            const cur = await pool.query(`SELECT rule_key FROM agent_rules WHERE id = $1`, [Number(req.params.id) || 0]);
            if (!cur.rows[0]) return res.status(404).json({ error: 'Rule not found' });
            const r = await pool.query(`SELECT * FROM agent_rules WHERE rule_key = $1 ORDER BY version ASC`, [cur.rows[0].rule_key]);
            res.json(r.rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/agent/rules', ownerOnly, async (req, res) => {
        try {
            await ready;
            const topic = clean(req.body.topic), text = clean(req.body.rule_text);
            if (!topic || !text) return res.status(400).json({ error: 'topic and rule_text are required' });
            res.status(201).json(await insertFirst(topic, text, clean(req.body.source) || 'taught by Aj'));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Edit = new version. The old row is kept, inactive.
    router.put('/agent/rules/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const cur = await pool.query(`SELECT * FROM agent_rules WHERE id = $1`, [Number(req.params.id) || 0]);
            const old = cur.rows[0];
            if (!old) return res.status(404).json({ error: 'Rule not found' });
            if (!old.active) return res.status(409).json({ error: 'Only the active version can be edited' });
            const topic = clean(req.body.topic) || old.topic, text = clean(req.body.rule_text);
            if (!text) return res.status(400).json({ error: 'rule_text is required' });
            await pool.query(`UPDATE agent_rules SET active = FALSE WHERE id = $1`, [old.id]);
            const ins = await pool.query(
                `INSERT INTO agent_rules (rule_key, topic, rule_text, source, version)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [old.rule_key, topic, text, clean(req.body.source) || old.source, old.version + 1]);
            res.json(ins.rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/agent/rules/:id/deactivate', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(`UPDATE agent_rules SET active = FALSE WHERE id = $1 RETURNING *`,
                [Number(req.params.id) || 0]);
            if (!r.rows[0]) return res.status(404).json({ error: 'Rule not found' });
            res.json(r.rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Plain text for the agent to load.
    router.get('/agent/rulebook', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(`SELECT topic, rule_text, version FROM agent_rules WHERE active = TRUE ORDER BY topic, rule_key`);
            const body = ['ROYAL BATH HUB AGENT RULEBOOK', 'Rules taught by Aj. Follow them. Draft only; Aj approves.', '']
                .concat(r.rows.map((x, i) => `${i + 1}. [${x.topic}] ${x.rule_text} (v${x.version})`))
                .join('\n') + '\n';
            res.type('text/plain').send(body);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

const defaultPool = () => require('../utils/pool');

// Lazy: requiring this file for tests must not open a DB connection.
let _router;
module.exports = function (req, res, next) {
    if (!_router) _router = createRouter(defaultPool());
    _router(req, res, next);
};
module.exports.createRouter = createRouter;
module.exports.SEED_RULES = SEED_RULES;
