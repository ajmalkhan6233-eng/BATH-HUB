'use strict';
// OPTIONAL webhook route for LAYLA v2 (WhatsApp Cloud API). Not mounted anywhere by default.
// To try it later (owner decision), add ONE line to server.js:
//   app.use('/layla-v2', require('./layla_v2/route').createRouter(require('./layla_v2').createDeps({ pool })));   // LAYLA v2, off unless LAYLA_V2_ENABLED=true
// Safety:
//   - answers 404 to everything unless LAYLA_V2_ENABLED=true
//   - refuses to work without WHATSAPP_APP_SECRET (503): every POST must carry a valid X-Hub-Signature-256, because the
//     sender number in the body decides whether someone is the owner. An unsigned body could pretend to be the owner.
//   - GET is Meta's one-time verification (LAYLA_V2_VERIFY_TOKEN)
//   - replies 200 straight away and works in the background; the same message id is never handled twice
const express = require('express');
const crypto = require('crypto');
const { handleIncoming } = require('./engine');
const { parseCloudWebhook } = require('./transport');

const isTrue = v => String(v || '').toLowerCase() === 'true';

function validSignature(secret, rawBody, header) {
    if (!secret || !rawBody || !header) return false;
    const want = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(want), b = Buffer.from(String(header));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createRouter(deps = {}, { env = process.env } = {}) {
    const router = express.Router();
    if (!isTrue(env.LAYLA_V2_ENABLED)) {
        router.use((req, res) => res.status(404).json({ error: 'Not found' }));
        router.idle = () => Promise.resolve();
        return router;
    }
    const seen = new Set();
    let chain = Promise.resolve();
    router.idle = () => chain;

    router.get('/webhook', (req, res) => {
        const token = env.LAYLA_V2_VERIFY_TOKEN;
        if (token && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) return res.status(200).send(String(req.query['hub.challenge'] || ''));
        res.status(403).json({ error: 'Forbidden' });
    });

    router.post('/webhook', express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }), (req, res) => {
        if (!env.WHATSAPP_APP_SECRET) return res.status(503).json({ error: 'LAYLA v2 is not configured' });
        if (!validSignature(env.WHATSAPP_APP_SECRET, req.rawBody, req.get('x-hub-signature-256'))) return res.status(401).json({ error: 'Bad signature' });
        const msgs = parseCloudWebhook(req.body).filter(m => {
            if (m.id && seen.has(m.id)) return false;
            if (m.id) { seen.add(m.id); if (seen.size > 500) seen.delete(seen.values().next().value); }
            return true;
        });
        for (const m of msgs) chain = chain.then(() => handleIncoming(m, deps)).catch(() => {});
        res.status(200).json({ ok: true, received: msgs.length });
    });
    return router;
}

module.exports = { createRouter, validSignature };