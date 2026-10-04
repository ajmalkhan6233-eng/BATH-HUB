'use strict';
/** One call wires everything. Needs .env: OWNER_WA_NUMBER (default 0777999219). Optional for WhatsApp: WA_TOKEN, WA_PHONE_NUMBER_ID, WA_APP_SECRET, WA_VERIFY_TOKEN, LAYLA_OWNER_LIVE=true, RELAY_URL, RELAY_SECRET, WHISPER_MODEL. */
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const createStore = require('./taskStore'); const createAdapters = require('./adapters'); const createRouter = require('../routes/layla_owner');
const W = require('./waCloud'); const { transcribe } = require('./transcribe'); const { tick } = require('./reminderEngine'); const { pollOnce } = require('./relayPoller');
const { processInbound } = require('./inbound'); const { createRateLimiter, LIMITS, normalizeNumber } = require('./ownerGate');

module.exports = function boot({ pool, requireAuth, env = process.env, inboxDir = path.join(process.cwd(), 'uploads', 'layla-inbox') }) {
  const store = createStore(pool); const adapters = createAdapters({ pool });
  const ownerNumber = env.OWNER_WA_NUMBER || '0777999219'; const cfg = W.cfgFromEnv(env);
  const send = async (to, text) => W.sendText(to || normalizeNumber(ownerNumber), text, cfg);
  const download = (mediaId) => W.downloadMedia(mediaId, cfg, LIMITS.maxMediaBytes);
  const saveMedia = async (buffer, mime, kind) => { fs.mkdirSync(inboxDir, { recursive: true }); const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }[String(mime).split(';')[0]] || '.bin'; const f = path.join(inboxDir, `${kind}-${crypto.randomBytes(8).toString('hex')}${ext}`); fs.writeFileSync(f, buffer); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
  const rateLimit = createRateLimiter();
  const router = createRouter({ store, adapters, requireAuth, send, download, transcribe, saveMedia, ownerNumber, env });
  let timers = [];
  function start() {
    timers.push(setInterval(() => tick({ store, send: (text) => send(null, text) }).catch((e) => console.error('[layla-owner] reminder tick:', e.message)), 60000));
    setTimeout(() => tick({ store, send: (text) => send(null, text) }).catch(() => {}), 5000);                       // catch up right after the computer starts
    if (env.RELAY_URL && env.RELAY_SECRET) timers.push(setInterval(() => pollOnce({ url: env.RELAY_URL, secret: env.RELAY_SECRET, handle: (m) => processInbound(m, { store, adapters, send, ownerNumber, download, transcribe, saveMedia, rateLimit }) }).catch((e) => console.error('[layla-owner] relay:', e.message)), 20000));
    console.log(`[layla-owner] started (${cfg.live ? 'LIVE' : 'DRY RUN: nothing is sent to WhatsApp'}${env.RELAY_URL ? ', relay on' : ''})`);
  }
  const stop = () => { timers.forEach(clearInterval); timers = []; };
  return { router, start, stop, store };
};
