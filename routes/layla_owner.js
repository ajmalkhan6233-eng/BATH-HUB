'use strict';
/**
 * Owner assistant routes. Mount (after login middleware, plus the idempotency middleware):
 *   const lo = require('./layla_owner/boot')({ pool, requireAuth });      // returns { router, start, stop }
 *   app.use('/api/layla-owner', lo.router);  lo.start();                  // start() begins the reminder tick and the WhatsApp relay poll
 * Endpoints (all behind the owner login except the Meta webhook, which checks Meta's signature):
 *   POST /message {text}            in-app chat, same brain as WhatsApp
 *   POST /media {kind,mime,data,caption}  photo or voice note as base64 (max ~12 MB)
 *   GET  /tasks                      open tasks
 *   GET/POST /wa                     Meta webhook (only needed if the computer is reachable; the Cloudflare relay is the free default)
 */
const express = require('express');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { handleOwnerMessage } = require('../layla_owner/brain');
const { processInbound } = require('../layla_owner/inbound');
const { verifySignature, LIMITS } = require('../layla_owner/ownerGate');
const { parseWebhook } = require('../layla_owner/waCloud');

module.exports = function createRouter({ store, adapters, requireAuth, send, download, transcribe, saveMedia, ownerNumber, env = process.env, now = () => new Date() }) {
  const r = express.Router();
  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error('[layla-owner]', e.message); res.status(500).json({ error: 'Something went wrong' }); });

  // Meta webhook: raw body needed for the signature. Registered BEFORE login (Meta cannot log in) but protected by the signature.
  r.get('/wa', (req, res) => (req.query['hub.mode'] === 'subscribe' && env.WA_VERIFY_TOKEN && req.query['hub.verify_token'] === env.WA_VERIFY_TOKEN ? res.send(String(req.query['hub.challenge'])) : res.sendStatus(403)));
  r.post('/wa', express.raw({ type: '*/*', limit: '1mb' }), wrap(async (req, res) => {
    if (!verifySignature(req.body, req.get('X-Hub-Signature-256'), env.WA_APP_SECRET)) return res.sendStatus(403);
    res.sendStatus(200);                                   // answer Meta first, work after
    for (const m of parseWebhook(JSON.parse(req.body.toString('utf8')))) processInbound(m, inboundDeps()).catch((e) => console.error('[layla-owner]', e.message));
  }));

  if (requireAuth) r.use(requireAuth);
  r.use(express.json({ limit: '16mb' }));
  const inboundDeps = () => ({ store, adapters, send, ownerNumber, download, transcribe, saveMedia, now });

  r.post('/message', wrap(async (req, res) => {
    const text = String((req.body && req.body.text) || '').slice(0, LIMITS.maxTextChars);
    if (!text.trim()) return res.status(400).json({ error: 'text is required' });
    await store.remember(null, 'in', 'app-text', text);
    const out = await handleOwnerMessage({ id: null, text }, { store, adapters, now });
    await store.remember(null, 'out', 'app-text', out.reply);
    res.json({ reply: out.reply, intent: out.intent.type });
  }));

  r.post('/media', wrap(async (req, res) => {
    const { kind, mime, data, caption } = req.body || {};
    if (!['image', 'audio'].includes(kind) || typeof data !== 'string') return res.status(400).json({ error: 'kind (image or audio) and base64 data are required' });
    const buffer = Buffer.from(data, 'base64'); if (!buffer.length || buffer.length > LIMITS.maxMediaBytes) return res.status(400).json({ error: 'file is empty or too large (max 12 MB)' });
    const replies = []; const id = 'app-' + crypto.randomBytes(6).toString('hex');
    const result = await processInbound({ id, from: ownerNumber, type: kind, mediaId: 'inline', mime, caption }, { ...inboundDeps(), send: async (_to, text) => replies.push(text), download: async () => ({ buffer, mime }) });
    res.json({ reply: replies.join('\n'), status: result.status });
  }));

  r.get('/tasks', wrap(async (req, res) => { res.json(await store.listOpen()); }));
  return r;
};
