// routes/branches.js
// M8 BRANCH PROFILE: what the agent may do at each branch, and its spend cap.
//
// Every new branch starts READ-ONLY with a 0 cap. Permissions widen only when the owner
// says so: creating a branch ignores any actions sent in, and widening an existing
// branch needs an explicit widen_confirm: true. Narrowing is always allowed.
// Even the widest permission only lets the agent DRAFT or STAGE work for `approver`;
// nothing is sent, posted, priced or paid by itself. Owner/admin only. Own table `branches`.

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

// read: look at data | draft: write drafts | stage_order / stage_post: prepare for the approver to OK
const ACTIONS = ['read', 'draft', 'stage_order', 'stage_post'];

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}
const clean = v => String(v == null ? '' : v).trim();

// -> array of valid actions ('read' always first), or null when something is unknown.
function normActions(v) {
    const list = (Array.isArray(v) ? v : clean(v).split(',')).map(x => clean(x).toLowerCase()).filter(Boolean);
    if (list.some(x => !ACTIONS.includes(x))) return null;
    return ACTIONS.filter(a => a === 'read' || list.includes(a));
}

function createRouter(pool) {
    const router = express.Router();

    const ready = pool.query(`CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        agent_allowed_actions TEXT NOT NULL DEFAULT 'read',
        spend_cap_lkr NUMERIC NOT NULL DEFAULT 0,
        approver TEXT NOT NULL DEFAULT 'Aj',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(e => console.error('[branches] init failed:', e.message));

    const out = r => ({ ...r, agent_allowed_actions: r.agent_allowed_actions.split(','), spend_cap_lkr: Number(r.spend_cap_lkr) });
    const load = async id => (await pool.query(`SELECT * FROM branches WHERE id = $1`, [Number(id) || 0])).rows[0];

    router.get('/branches', ownerOnly, async (req, res) => {
        try {
            await ready;
            res.json((await pool.query(`SELECT * FROM branches ORDER BY id`)).rows.map(out));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Always read-only, cap 0. Anything sent for actions/cap is ignored on purpose.
    router.post('/branches', ownerOnly, async (req, res) => {
        try {
            await ready;
            const b = req.body || {};
            const name = clean(b.name);
            if (!name) return res.status(400).json({ error: 'name is required' });
            const r = await pool.query(
                `INSERT INTO branches (name, agent_allowed_actions, spend_cap_lkr, approver) VALUES ($1, 'read', 0, $2) RETURNING *`,
                [name, clean(b.approver) || 'Aj']);
            res.status(201).json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/branches/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const old = await load(req.params.id);
            if (!old) return res.status(404).json({ error: 'Branch not found' });
            const b = req.body || {};
            const name = b.name !== undefined ? clean(b.name) : old.name;
            if (!name) return res.status(400).json({ error: 'name cannot be empty' });
            const approver = b.approver !== undefined ? clean(b.approver) : old.approver;
            if (!approver) return res.status(400).json({ error: 'approver cannot be empty' });

            const oldActions = old.agent_allowed_actions.split(',');
            const actions = b.agent_allowed_actions !== undefined ? normActions(b.agent_allowed_actions) : oldActions;
            if (actions === null) return res.status(400).json({ error: 'actions must be from: ' + ACTIONS.join(', ') });

            let cap = Number(old.spend_cap_lkr);
            if (b.spend_cap_lkr !== undefined) {
                cap = Number(b.spend_cap_lkr);
                if (b.spend_cap_lkr === '' || !Number.isFinite(cap) || cap < 0) return res.status(400).json({ error: 'spend_cap_lkr must be 0 or more' });
            }

            const widening = actions.some(a => !oldActions.includes(a)) || cap > Number(old.spend_cap_lkr);
            if (widening && b.widen_confirm !== true) {
                return res.status(400).json({ error: 'Widening needs widen_confirm: true (only when Aj has said so)' });
            }
            if (cap > 0 && !actions.includes('stage_order')) {
                return res.status(400).json({ error: 'A spend cap needs the stage_order action' });
            }

            const r = await pool.query(
                `UPDATE branches SET name=$1, agent_allowed_actions=$2, spend_cap_lkr=$3, approver=$4 WHERE id=$5 RETURNING *`,
                [name, actions.join(','), cap, approver, old.id]);
            res.json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // For the agent to ask before acting: is this action allowed at this branch?
    // `needs_approval` is always true: allowed means "may prepare", never "may do by itself".
    router.get('/branches/:id/can', ownerOnly, async (req, res) => {
        try {
            await ready;
            const row = await load(req.params.id);
            if (!row) return res.status(404).json({ error: 'Branch not found' });
            const action = clean(req.query.action).toLowerCase();
            if (!ACTIONS.includes(action)) return res.status(400).json({ error: 'action must be one of: ' + ACTIONS.join(', ') });
            res.json({ branch: row.name, action, allowed: row.agent_allowed_actions.split(',').includes(action),
                needs_approval: action !== 'read', approver: row.approver, spend_cap_lkr: Number(row.spend_cap_lkr) });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

let _router;
module.exports = function (req, res, next) {
    if (!_router) _router = createRouter(new Pool({
        host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    }));
    _router(req, res, next);
};
module.exports.createRouter = createRouter;
module.exports.ACTIONS = ACTIONS;
