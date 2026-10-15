'use strict';
/** One call wires everything. Needs .env: OWNER_WA_NUMBER (default 0777999219). Optional for WhatsApp: WA_TOKEN, WA_PHONE_NUMBER_ID, WA_APP_SECRET, WA_VERIFY_TOKEN, LAYLA_OWNER_LIVE=true, RELAY_URL, RELAY_SECRET, WHISPER_MODEL. */
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const createStore = require('./taskStore'); const createAdapters = require('./adapters'); const createRouter = require('../routes/layla_owner');
const W = require('./waCloud'); const { transcribe } = require('./transcribe'); const { tick } = require('./reminderEngine'); const { pollOnce } = require('./relayPoller');
const { runChequeAlerts } = require('../utils/chequeAlerts'); const { setSender } = require('../utils/ownerNotify'); const notify = require('../utils/notify'); const automations = require('../utils/automations');
const createPaperIntake = require('./paperIntake'); const { createPaperDeps } = require('./paperDeps');
const { processInbound } = require('./inbound'); const { loadSettings, describe } = require('./settings'); const { createSafeSend } = require('./safeSend'); const { createCustomerHandler } = require('./customerDryRun'); const { bridgeSendText } = require('./bridgeSend'); const { createBridgeIn } = require('./bridgeIn'); const createFamilyNotes = require('./familyStore'); const { createFamily, familyTick } = require('./familyBrain'); const { createRateLimiter, LIMITS, normalizeNumber } = require('./ownerGate');

module.exports = function boot({ pool, requireAuth, env = process.env, inboxDir = path.join(process.cwd(), 'uploads', 'layla-inbox') }) {
  const store = createStore(pool); const adapters = createAdapters({ pool });
  const S = loadSettings(env); const ownerNumber = S.ownerNumber; const cfg = { token: S.token, phoneId: S.phoneId, version: S.version, live: S.liveAllowed };
  const send = createSafeSend({ settings: S, sendText: S.transport === 'bridge' ? bridgeSendText : W.sendText });                                  // live sends go to the owner only
  const download = (mediaId) => W.downloadMedia(mediaId, cfg, LIMITS.maxMediaBytes);
  const saveMedia = async (buffer, mime, kind) => { fs.mkdirSync(inboxDir, { recursive: true }); const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }[String(mime).split(';')[0]] || '.bin'; const f = path.join(inboxDir, `${kind}-${crypto.randomBytes(8).toString('hex')}${ext}`); fs.writeFileSync(f, buffer); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
  const rateLimit = createRateLimiter();
  const paper = createPaperIntake({ pool, ...createPaperDeps() });                         // photo captioned GRN / cheque -> draft -> saved only on "ok"
  const customer = createCustomerHandler({ onInbound: (m) => notify.enqueue(pool, `Customer ...${String(m.from).slice(-3)} wrote: "${String(m.text).slice(0, 200).replace(/\s+/g, ' ')}" (not answered: Layla does not reply to customers yet)`, 'customer').catch(() => {}) });                                                              // customer chats: dry run, logged, never sent
  const family = createFamily({ numbers: S.familyNumbers, store, notes: createFamilyNotes(pool) });      // family mode: reminders + notes only, separate from the shop
  const familyRateLimit = createRateLimiter(20);
  const router = createRouter({ store, adapters, requireAuth, send, download, transcribe, saveMedia, ownerNumber, paper, customer, family, familyRateLimit, env });
  const { safeInboxPath } = require('../middleware/webhookAuth');                                  // free bridge: owner messages arrive here from whatsapp-bridge.js
  const bridgeIn = createBridgeIn({ inboxRoot: path.join(process.env.DROP_ROOT || path.join(process.cwd(), 'data', 'drop'), 'inbox'), safeInboxPath, deps: () => ({ store, adapters, ownerNumber, transcribe, saveMedia, paper, customer, family, familyRateLimit, rateLimit }) });
  setSender((text) => notify.enqueue(pool, text, 'alert'));                                  // RULE 11: every notification waits for the 06:00 morning message
  let timers = [];
  function start() {
    timers.push(setInterval(() => tick({ store, send: (text) => notify.enqueue(pool, text, 'reminder') }).catch((e) => console.error('[layla-owner] reminder tick:', e.message)), 60000));
    setTimeout(() => tick({ store, send: (text) => notify.enqueue(pool, text, 'reminder') }).catch(() => {}), 5000);                       // catch up right after the computer starts
    const chequeTick = () => runChequeAlerts({ pool, send: (text) => notify.enqueue(pool, text, 'cheque') }).catch((e) => console.error('[layla-owner] cheque alerts:', e.message));
    timers.push(setInterval(chequeTick, 10 * 60000)); setTimeout(chequeTick, 20000);                                  // 4 cheque alerts to the owner, never repeated
    const autoTick = () => Promise.all([automations.runDaily({ pool, adapters, enqueue: (text, src) => notify.enqueue(pool, text, src) }), require('../utils/automations2').runDaily2({ pool, enqueue: (text, src) => notify.enqueue(pool, text, src) }), require('../utils/nightlyReport').runNightly({ pool, enqueue: (text, src) => notify.enqueue(pool, text, src) })]).catch((e) => console.error('[layla-owner] automations:', e.message));
    timers.push(setInterval(autoTick, 30 * 60000)); setTimeout(autoTick, 45000);                                           // morning brief, reorder list (Mon), weekly profit (Sun), accountant pack (1st)
    const flushTick = () => notify.flush({ pool, send: (text) => send(null, text) }).catch((e) => console.error('[layla-owner] morning batch:', e.message));
    timers.push(setInterval(flushTick, 60000)); setTimeout(flushTick, 30000);                                             // sends only at 06:00 (to 06:10) Sri Lanka time, once a day
    if (family.members().length) timers.push(setInterval(() => familyTick({ store, send }).catch((e) => console.error('[layla-family] reminder tick:', e.message)), 60000));   // each family reminder goes to ITS OWN number at its own time
    if (env.RELAY_URL && env.RELAY_SECRET) timers.push(setInterval(() => pollOnce({ url: env.RELAY_URL, secret: env.RELAY_SECRET, phoneId: S.phoneId, handle: (m) => processInbound(m, { customer, family, familyRateLimit, store, adapters, send, ownerNumber, download, transcribe, saveMedia, paper, rateLimit }) }).catch((e) => console.error('[layla-owner] relay:', e.message)), 20000));
    console.log(`[layla-owner] started (${cfg.live ? 'LIVE, owner only' : 'DRY RUN: nothing is sent to WhatsApp'}${env.RELAY_URL ? ', relay on' : ''}) ${JSON.stringify(describe(S))}`);
  }
  const stop = () => { timers.forEach(clearInterval); timers = []; };
  return { router, start, stop, store, bridgeIn };
};
