// routes/investor_contacts.js: Aj registers the WhatsApp numbers of investors. Owner/admin only.
// A registered number talks to Layla and sees only its own investment (see utils/investorLayla.js).
const express = require('express');
const pool = require('../utils/pool');
const { TABLE, digitsOf } = require('../utils/investorLayla');
const router = express.Router();

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}
const ready = pool.query(TABLE).catch(e => console.error('[investor_contacts] init failed:', e.message));

router.get('/investor-contacts', ownerOnly, async (req, res) => {
    try { await ready; res.json((await pool.query(`SELECT id, phone, name, lender_name, active FROM investor_contacts ORDER BY name`)).rows); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/investor-contacts', ownerOnly, async (req, res) => {
    try {
        await ready;
        const phone = digitsOf((req.body || {}).phone), name = String((req.body || {}).name || '').trim(), lender = String((req.body || {}).lender_name || name).trim();
        if (phone.length < 9) return res.status(400).json({ error: 'Enter the full WhatsApp number' });
        if (!name) return res.status(400).json({ error: 'Enter the investor name' });
        const r = await pool.query(`INSERT INTO investor_contacts (phone, name, lender_name) VALUES ($1,$2,$3)
            ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, lender_name = EXCLUDED.lender_name, active = true RETURNING id, phone, name, lender_name, active`, [phone, name, lender]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/investor-contacts/:id', ownerOnly, async (req, res) => {
    try { await ready; await pool.query(`UPDATE investor_contacts SET active = false WHERE id = $1`, [Number(req.params.id) || 0]); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;
