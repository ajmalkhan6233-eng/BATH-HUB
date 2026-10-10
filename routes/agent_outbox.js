'use strict';
// OWNER SCREEN API for the egress gate: see what agents want to send, approve (sends once) or reject.
const express = require('express');
const { getDefaultGate } = require('../utils/egressGate');
const audit = require('../utils/agentAudit');

const router = express.Router();
const user = req => (req.session && req.session.user) || null;
const ownerOnly = (req, res, next) => {
    const u = user(req);
    if (!u || !['admin', 'owner'].includes(u.role)) return res.status(403).json({ error: 'Only the owner can decide what an agent sends.' });
    next();
};

router.get('/agent-outbox', ownerOnly, async (req, res) => {
    try {
        const rows = await getDefaultGate().list(req.query.status || 'draft');
        audit.log({ agent: 'owner-screen', action: 'read', subject: 'agent-outbox' });
        // phone shown as last 3 digits only
        res.json(rows.map(r => ({ id: r.id, agent: r.agent, kind: r.kind, to: '***' + String(r.to || r.to_phone || '').slice(-3), text: r.kind === 'text' ? (r.payload || {}).text : undefined, origin: r.origin, status: r.status, created_at: r.created_at })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/agent-outbox/:id/approve', ownerOnly, async (req, res) => {
    const r = await getDefaultGate().approve(req.params.id, user(req).username || 'owner');
    res.status(r.status || (r.ok ? 200 : 500)).json(r);
});
router.post('/agent-outbox/:id/reject', ownerOnly, async (req, res) => {
    const r = await getDefaultGate().reject(req.params.id, user(req).username || 'owner');
    res.status(r.ok ? 200 : (r.status || 500)).json(r);
});
module.exports = router;
