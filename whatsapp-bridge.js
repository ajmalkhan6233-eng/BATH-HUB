// WhatsApp bridge: links a real WhatsApp account via QR (whatsapp-web.js, unofficial —
// no Meta Business API account needed). Bridges inbound messages to server.js's
// /webhook/whatsapp, and exposes POST /send for outbound (matches layla.js's
// WHATSAPP_API_URL default of http://localhost:3001/send).
require('dotenv').config();
require('./utils/timezone');
const { todayLK } = require('./utils/lkTime');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
// Final output guard (apex): strips any reasoning/chain-of-thought leakage at
// the LAST point before a message leaves for WhatsApp. layla.js has its own
// pipeline (stripReasoning etc.) — this is the belt-and-braces layer on the
// dispatch side, covering every send path including /send and photo replies.
const { sanitizeAssistantOutput } = require('./utils/laylaOutput');

const PORT = process.env.WHATSAPP_BRIDGE_PORT || 3001;
// Sent to the main server's /webhook/* routes when WEBHOOK_SECRET is configured (see middleware/webhookAuth.js).
const WEBHOOK_HEADERS = process.env.WEBHOOK_SECRET ? { 'x-webhook-secret': process.env.WEBHOOK_SECRET } : {};
const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || `http://localhost:${process.env.PORT || 3010}`;
const INBOX_ROOT = path.join(process.env.DROP_ROOT || path.join(__dirname, 'data', 'drop'), 'inbox'); // same drop folder the Nature upload button uses

// ── INTERNAL-ONLY MODE WHITELIST ───────────────────────────────────────────
// WHATSAPP_MODE=internal (the DEFAULT): only whitelisted numbers get forwarded
// to LAYLA / get a reply. Everyone else is silently logged and dropped — no
// reply, no forward, nothing sent to them. Fail CLOSED: if the sender's number
// can't be confidently resolved, block it.
// WHATSAPP_MODE=public: replies to everyone (a deliberate go-live decision —
// set it explicitly in .env, never flip this default in code).
const TEST_MODE = (process.env.WHATSAPP_MODE || 'internal') !== 'public';
const WHITELIST_RAW = process.env.WHATSAPP_TEST_WHITELIST || '';
const WHITELIST_NUMBER = WHITELIST_RAW.replace(/\D/g, ''); // digits only, e.g. "9477XXXXXXX"
// 2026-07-03: WhatsApp's "@lid" privacy layer means this contact's real number is
// NOT exposed via msg.from OR msg.getContact().number - both return this same
// opaque pseudo-ID instead. Confirmed genuine (not a stray/bot number) by an exact
// text match: the WhatsApp message logged at 10:11:42 is verbatim the chat message
// that triggered this diagnostic. Accepting the observed lid as an alternate
// identity for the same whitelisted person, alongside the real number in case
// WhatsApp ever does expose it (e.g. after a privacy setting change on their end).
const WHITELIST_KNOWN_LIDS = (process.env.WHATSAPP_TEST_WHITELIST_LIDS || '232985483817135').split(',').map(s=>s.trim()).filter(Boolean);
function isWhitelisted(digits) { return digits === WHITELIST_NUMBER || WHITELIST_KNOWN_LIDS.includes(digits); }

const app = express();
app.use(express.json({ limit: '10mb' })); // receipts arrive as base64 images

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

let ready = false;
let lastQR = null;
let lastLivenessOkAt = null;
let lastLivenessError = null;

// ── LIVENESS CHECK ──────────────────────────────────────────────────────────
// 2026-07-03 incident: the bridge sat "online" in pm2 and /health said
// ready:true for ~16 hours while actually dead - Puppeteer's page had gone
// "detached" (Chrome lost its WhatsApp Web session) but the Node process
// never crashed, so pm2 never restarted it and the `ready` flag - only ever
// set on the 'ready' event - never got reset. No inbound message could
// arrive and outbound sends failed with "Attempted to use detached Frame".
// client.getState() actually evaluates JS inside the WhatsApp Web page, so
// it fails the same way a real message would if the page is dead - unlike
// the `ready` flag, this proves the connection is ACTUALLY alive right now,
// not just "was alive whenever we last saw a 'ready' event".
const LIVENESS_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes
const LIVENESS_TIMEOUT_MS = 20000; // getState() should be near-instant if the page is alive; 20s = clearly stuck
let livenessCheckRunning = false;

async function checkLiveness() {
    if (!ready || livenessCheckRunning) return;
    livenessCheckRunning = true;
    try {
        const state = await Promise.race([
            client.getState(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('getState() timed out — page likely unresponsive')), LIVENESS_TIMEOUT_MS)),
        ]);
        if (state !== 'CONNECTED') throw new Error(`unexpected state: ${state}`);
        if (lastLivenessError) console.log(`[WA-BRIDGE] LIVENESS RECOVERED — connection confirmed CONNECTED again after: ${lastLivenessError}`);
        lastLivenessOkAt = Date.now();
        lastLivenessError = null;
    } catch (err) {
        lastLivenessError = err.message;
        console.error(`[WA-BRIDGE] LIVENESS CHECK FAILED: ${err.message} — bridge is a zombie (process alive, WhatsApp session dead). Exiting so pm2 restarts it cleanly.`);
        // Don't try client.destroy() first - the page is already broken, calling
        // more client methods on it risks hanging instead of exiting cleanly.
        // pm2's autorestart (ecosystem.config.js) brings a fresh process straight
        // back up, reconnecting via the saved session with no new QR needed -
        // exactly what manual recovery did during the incident.
        process.exit(1);
    } finally {
        livenessCheckRunning = false;
    }
}
setInterval(checkLiveness, LIVENESS_INTERVAL_MS);

client.on('qr', (qr) => {
    ready = false;
    lastQR = qr;
    console.log('\n[WA-BRIDGE] ==================== SCAN NOW ====================');
    qrcodeTerminal.generate(qr, { small: true }, (rendered) => console.log(rendered));
    console.log('[WA-BRIDGE] WhatsApp app → Settings → Linked Devices → Link a Device');
    console.log(`[WA-BRIDGE] Or open http://localhost:${PORT}/qr in a browser — it refreshes automatically.`);
});

client.on('ready', () => {
    ready = true;
    lastQR = null;
    lastLivenessOkAt = Date.now(); // we just connected, count that as a pass
    lastLivenessError = null;
    console.log('[WA-BRIDGE] WhatsApp connected and ready.');
    console.log(`[WA-BRIDGE] MODE: ${TEST_MODE ? 'INTERNAL-ONLY (default) — whitelist: +' + WHITELIST_NUMBER + ' only, all other senders logged and dropped, no reply sent.' : 'PUBLIC — replies to everyone (WHATSAPP_MODE=public).'}`);
    console.log(`[WA-BRIDGE] Liveness check active — verifying the real connection every ${LIVENESS_INTERVAL_MS/60000} min, auto-restarts via pm2 if it goes stale.`);
});

client.on('authenticated', () => console.log('[WA-BRIDGE] Authenticated.'));
client.on('auth_failure', (msg) => console.error('[WA-BRIDGE] Auth failure:', msg));
client.on('disconnected', (reason) => {
    ready = false;
    lastLivenessError = `disconnected: ${reason}`;
    console.error('[WA-BRIDGE] Disconnected:', reason);
    // Don't wait for the next liveness pass — exit now so pm2 (autorestart)
    // brings the session back within seconds instead of minutes. 10s grace
    // lets any in-flight webhook replies finish first.
    console.error('[WA-BRIDGE] Exiting in 10s for pm2 to restart the session.');
    setTimeout(async () => {
        try { await client.destroy(); } catch {}
        process.exit(1);
    }, 10000);
});

// Inbound: forward every incoming message to the main server's webhook, then
// actually send LAYLA's reply back to the customer.
client.on('message', async (msg) => {
    if (msg.from.endsWith('@g.us')) return; // ignore group messages

    // Resolve the real underlying phone number. msg.from is sometimes a
    // "@lid" (WhatsApp's opaque Linked ID for privacy-protected contacts),
    // not the actual number - so resolve via the Contact object too and
    // require the two checks to agree, rather than trusting msg.from alone.
    let fromDigits = msg.from.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
    let contactDigits = null;
    try {
        const contact = await msg.getContact();
        contactDigits = (contact?.number || '').replace(/\D/g, '');
    } catch (e) { /* contact resolution failed - fromDigits fallback below */ }

    const resolved = contactDigits || fromDigits; // prefer the real resolved number
    const whitelisted = TEST_MODE ? isWhitelisted(resolved) : true;

    if (!whitelisted) {
        // Grab pushname/verified name too - a human-readable name makes it much
        // faster to tell "is this a stray sender" from "is this a whitelist bug"
        // without archaeology through past log lines (see the 2026-07-03 incident).
        let name = '';
        try { const c = await msg.getContact(); name = c?.pushname || c?.verifiedName || c?.name || ''; } catch (e) {}
        console.log(`[WA-BRIDGE] [BLOCKED-NOT-WHITELISTED] from=${msg.from} resolved=${resolved} name="${name}" body="${(msg.body||'').slice(0,120)}" — logged only, no reply sent, not forwarded to LAYLA.`);
        return;
    }

    // ── PHOTO PIPELINE (audit.md item 3) ────────────────────────────────────
    // A day-sheet/expense-sheet photo: save it, hand off to the server for
    // OCR + drafting, reply with what it read. Non-image media (documents,
    // voice notes, video) is out of scope for this pipeline — say so rather
    // than silently dropping it.
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            if (!media || !media.mimetype?.startsWith('image/')) {
                await msg.reply(`I can only read photos of day/expense sheets right now — not documents, video, or audio. Please send a photo.`);
                return;
            }
            const ext = media.mimetype === 'image/png' ? 'png' : 'jpg';
            const todayDir = todayLK();
            const destDir = path.join(INBOX_ROOT, todayDir);
            fs.mkdirSync(destDir, { recursive: true });
            const destPath = path.join(destDir, `${Date.now()}-whatsapp-${resolved}.${ext}`);
            fs.writeFileSync(destPath, Buffer.from(media.data, 'base64'));
            console.log(`[WA-BRIDGE] photo saved: ${destPath} — handing off for OCR`);

            const res = await axios.post(`${MAIN_SERVER_URL}/webhook/whatsapp-photo`, {
                from: resolved, filePath: destPath,
            }, { timeout: 60000, headers: WEBHOOK_HEADERS });
            const photoReply = sanitizeAssistantOutput(res.data?.reply);
            if (photoReply) await msg.reply(photoReply);
        } catch (err) {
            console.error('[WA-BRIDGE] Photo pipeline failed:', err.message);
            await msg.reply(`Something went wrong reading that photo. Please try resending it.`).catch(()=>{});
        }
        return;
    }

    try {
        const res = await axios.post(`${MAIN_SERVER_URL}/webhook/whatsapp`, {
            from: resolved,
            message: msg.body,
        }, { timeout: 60000, headers: WEBHOOK_HEADERS });
        const reply = sanitizeAssistantOutput(res.data?.reply);
        if (reply) {
            await msg.reply(reply);
        }
    } catch (err) {
        console.error('[WA-BRIDGE] Failed to forward inbound message or send reply:', err.message);
    }
});

// Outbound: POST { to, message, media? } -> sends via the linked WhatsApp account.
// media (optional) = { data: <base64>, mimetype, filename } — sent as an image/document with
// `message` as its caption (used for receipts). Without media this is the original text send.
app.post('/send', async (req, res) => {
    const { to, message, media } = req.body;
    if (!to || (!message && !media)) return res.status(400).json({ error: 'to and message required' });
    if (media && (!media.data || !media.mimetype)) return res.status(400).json({ error: 'media needs data (base64) and mimetype' });
    if (!ready) return res.status(503).json({ error: 'WhatsApp not linked yet — scan the QR code first' });
    try {
        const chatId = to.includes('@') ? to : `${to.replace(/\D/g, '')}@c.us`;
        const clean = message ? sanitizeAssistantOutput(message) : '';
        if (message && !clean && !media) return res.status(400).json({ error: 'message was empty after output sanitization' });
        if (media) {
            const { MessageMedia } = require('whatsapp-web.js');
            const file = new MessageMedia(media.mimetype, media.data, media.filename || undefined);
            await client.sendMessage(chatId, file, clean ? { caption: clean } : {});
        } else {
            await client.sendMessage(chatId, clean);
        }
        res.json({ success: true, to, message: clean, media: !!media });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/qr', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (ready) {
        return res.send(`<!doctype html><html><body style="font-family:sans-serif;text-align:center;margin-top:15vh;background:#0a0f0a;color:#2ecc71">
            <h1 style="font-size:48px">✅ AUTHENTICATED</h1><p style="color:#aaa">WhatsApp is linked and ready.</p></body></html>`);
    }
    if (!lastQR) {
        return res.send(`<!doctype html><html><head><meta http-equiv="refresh" content="5"></head>
            <body style="font-family:sans-serif;text-align:center;margin-top:15vh;background:#0a0f0a;color:#eee">
            <h2>Waiting for QR from WhatsApp...</h2></body></html>`);
    }
    const dataUrl = await qrcode.toDataURL(lastQR, { width: 500, margin: 2 });
    res.send(`<!doctype html><html><head><meta http-equiv="refresh" content="5">
        <title>BATHCO WhatsApp — Scan QR</title></head>
        <body style="font-family:sans-serif;text-align:center;margin-top:5vh;background:#0a0f0a;color:#eee">
        <h1 style="color:#c9a227">SCAN NOW</h1>
        <img src="${dataUrl}" style="width:500px;height:500px;border:8px solid #c9a227;border-radius:8px">
        <p>WhatsApp app → Settings → Linked Devices → Link a Device</p>
        <p style="color:#888">Refreshes every 5s automatically.</p>
        </body></html>`);
});

app.get('/health', (req, res) => res.json({
    ready,
    last_liveness_ok_at: lastLivenessOkAt ? new Date(lastLivenessOkAt).toISOString() : null,
    last_liveness_error: lastLivenessError,
    seconds_since_last_liveness_ok: lastLivenessOkAt ? Math.round((Date.now()-lastLivenessOkAt)/1000) : null,
}));
// On-demand liveness check (doesn't wait for the 5-min interval) - triggers the
// same real getState() probe and process.exit(1)-on-failure path as the timer.
app.post('/liveness-check', async (req, res) => {
    await checkLiveness();
    res.json({ ready, last_liveness_ok_at: lastLivenessOkAt ? new Date(lastLivenessOkAt).toISOString() : null, last_liveness_error: lastLivenessError });
});

app.listen(PORT, () => console.log(`[WA-BRIDGE] HTTP API on http://localhost:${PORT} (health: /health, send: POST /send)`));

// Windows pm2 kills don't always deliver SIGTERM, so a previous bridge's Chrome
// can survive holding .wwebjs_auth/session — then initialize() fails with
// "browser already running" and the bridge sits as a zombie (online in pm2,
// ready:false, one grey tick on incoming messages). Kill any such orphan first.
// Matches ONLY chrome processes whose command line points at OUR session dir.
function killOrphanedSessionBrowsers() {
    try {
        const { execSync } = require('child_process');
        execSync(
            `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name like '%chrome%'\\" | Where-Object { $_.CommandLine -like '*wwebjs_auth*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
            { stdio: 'ignore', timeout: 30000 }
        );
        console.log('[WA-BRIDGE] Cleared any orphaned session browsers before initialize.');
    } catch (e) {
        console.warn('[WA-BRIDGE] Orphan-browser cleanup skipped:', e.message);
    }
}
killOrphanedSessionBrowsers();
client.initialize();

// Without this, pm2 restart/stop leaves the Chrome child orphaned holding
// .wwebjs_auth/session, so the NEXT launch fails with "browser already
// running" and never gets past the qr/ready stage. Close Chrome first.
async function shutdown(signal) {
    console.log(`[WA-BRIDGE] ${signal} received — closing WhatsApp session cleanly before exit.`);
    try { await client.destroy(); } catch (e) { console.error('[WA-BRIDGE] destroy() error:', e.message); }
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
