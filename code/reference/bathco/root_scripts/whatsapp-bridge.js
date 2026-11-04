// WhatsApp bridge: links a real WhatsApp account via QR (whatsapp-web.js, unofficial —
// no Meta Business API account needed). Bridges inbound messages to server.js's
// /webhook/whatsapp, and exposes POST /send for outbound (matches layla.js's
// WHATSAPP_API_URL default of http://localhost:3001/send).
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const PORT = process.env.WHATSAPP_BRIDGE_PORT || 3001;
const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || 'http://localhost:3000';
const INBOX_ROOT = 'C:\\BATHCO_DROP\\inbox'; // same drop folder the Nature upload button uses

// ── LOCAL TEST MODE WHITELIST ──────────────────────────────────────────────
// Only this number gets forwarded to LAYLA / gets a reply. Everyone else is
// silently logged and dropped — no reply, no forward, nothing sent to them.
// Fail CLOSED: if the sender's number can't be confidently resolved, block it.
const TEST_MODE = true;
const WHITELIST_RAW = process.env.WHATSAPP_TEST_WHITELIST || '<PHONE>';
const WHITELIST_NUMBER = WHITELIST_RAW.replace(/\D/g, ''); // digits only, e.g. "<PHONE>"
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
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    // 2026-07-18: WhatsApp's ~Jul-15 web rollout breaks whatsapp-web.js
    // 1.34.7 during pairing (inject races the post-scan page reload —
    // "Execution context was destroyed"; phone shows "linking…" then bounces
    // back, bridge never gets 'authenticated'). The old local pin
    // (2.3000.1042951012, 07-10) had meanwhile aged out so linking failed
    // silently either way. Pin a build from Jul 14 — the last day before the
    // breaking rollout, still fresh enough that servers accept new-device
    // pairing — served from the wppconnect wa-version archive. A pin only
    // stays linkable for a week or two: if re-linking ever fails silently
    // again, move the pin to the newest pre-breakage build (or drop it once
    // whatsapp-web.js >1.34.7 handles the current rollout).
    // 2026-07-18 night: pin RESTORED after LAYLA finally linked. The live
    // (post-Jul-15) web build breaks whatsapp-web.js 1.34.7's inbound
    // 'message' events (send works, receive never fires — verified with a
    // live round-trip). The Jul-14 build predates the breakage and restoring
    // an EXISTING session under it is proven to work (Aj session, 18:32).
    // Rule of thumb from today: PAIR on live (unpin temporarily if a relink
    // is ever needed — pairing fails under a stale pin), then RUN pinned.
    webVersion: '2.3000.1043140922-alpha',
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
        strict: true,
    },
    // 2026-07-18: whatsapp-web.js's default spoofed UA is Chrome 101 on macOS
    // 10.14 (2022-era). WhatsApp silently rejects NEW device links from
    // outdated browser signatures — the phone scans, nothing ever reaches the
    // bridge. Present a current Chrome-on-Windows UA instead.
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    // 2026-07-18: WhatsApp's Jul-15 rollout rejects pairing from automated
    // browsers — the same phone+account linked instantly on web.whatsapp.com
    // in a normal Chrome while the headless bridge bounced every scan
    // ("linking…" → back, no 'authenticated'). Run headful and drop
    // puppeteer's --enable-automation banner flag so the pairing handshake
    // sees a normal-looking Chrome. The window is minimized, not hidden —
    // do NOT close it, that kills LAYLA's session.
    puppeteer: {
        headless: false,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        ignoreDefaultArgs: ['--enable-automation'],
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-minimized', '--window-position=-32000,-32000'],
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

// ── INIT WATCHDOG ───────────────────────────────────────────────────────────
// 2026-07-10 incident: the liveness check above only runs once `ready` is true,
// so a bridge that gets stuck DURING initialize is invisible to it. The 16:41
// liveness restart authenticated at 16:42 but the 'ready' event never fired -
// /health sat at ready:false for 17+ minutes with nothing watching, and it
// would have stayed wedged until someone noticed. This watchdog covers the
// init phase: if we're not ready and no progress event (qr/authenticated) has
// landed within INIT_TIMEOUT_MS, exit so pm2 restarts us - same recovery path
// as the liveness check. While a QR is on screen we're waiting on a HUMAN to
// scan, not stuck, so don't restart-loop then (each new qr event also counts
// as progress, so a dead page that stops emitting QRs still gets caught).
const INIT_TIMEOUT_MS = 5 * 60 * 1000; // auth→ready is normally ~30s; 5 min = clearly stuck
let initProgressAt = Date.now();
const initWatchdog = setInterval(() => {
    if (ready) { clearInterval(initWatchdog); return; }
    if (lastQR) return; // QR displayed — waiting for a human scan, not stuck
    if (Date.now() - initProgressAt > INIT_TIMEOUT_MS) {
        console.error(`[WA-BRIDGE] INIT WATCHDOG: not ready and no init progress for ${Math.round((Date.now()-initProgressAt)/60000)} min — initialize is stuck (the liveness check can't see this phase). Exiting so pm2 restarts it cleanly.`);
        process.exit(1);
    }
}, 30000);

client.on('qr', (qr) => {
    ready = false;
    lastQR = qr;
    initProgressAt = Date.now();
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
    // Identity check: which account this session actually belongs to (guards
    // against relinking with the wrong phone during a session recovery).
    const acct = client.info && client.info.wid ? client.info.wid.user : 'unknown';
    console.log(`[WA-BRIDGE] Linked account: +${acct} (pushname: "${client.info ? client.info.pushname : '?'}")`);
    console.log(`[WA-BRIDGE] LOCAL TEST MODE ${TEST_MODE ? 'ACTIVE' : 'DISABLED'} — whitelist: +${WHITELIST_NUMBER} only. All other senders are logged and dropped, no reply sent.`);
    console.log(`[WA-BRIDGE] Liveness check active — verifying the real connection every ${LIVENESS_INTERVAL_MS/60000} min, auto-restarts via pm2 if it goes stale.`);
});

client.on('authenticated', () => {
    // Clear any QR left over from before the scan — a stale lastQR here would
    // suppress the init watchdog during the exact auth→ready window it guards.
    lastQR = null;
    initProgressAt = Date.now();
    console.log('[WA-BRIDGE] Authenticated.');
});
client.on('auth_failure', (msg) => console.error('[WA-BRIDGE] Auth failure:', msg));
client.on('disconnected', (reason) => {
    ready = false;
    lastLivenessError = `disconnected: ${reason}`;
    console.error('[WA-BRIDGE] Disconnected:', reason);
    // Don't wait for the next liveness pass — exit now so pm2 (autorestart)
    // brings the session back within seconds instead of minutes. 10s grace
    // lets any in-flight webhook replies finish first. destroy() first so the
    // Chrome child dies with us — a bare exit orphans it and the next launch
    // fails with "browser already running".
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
            const todayDir = new Date().toISOString().slice(0, 10);
            const destDir = path.join(INBOX_ROOT, todayDir);
            fs.mkdirSync(destDir, { recursive: true });
            const destPath = path.join(destDir, `${Date.now()}-whatsapp-${resolved}.${ext}`);
            fs.writeFileSync(destPath, Buffer.from(media.data, 'base64'));
            console.log(`[WA-BRIDGE] photo saved: ${destPath} — handing off for OCR`);

            const res = await axios.post(`${MAIN_SERVER_URL}/webhook/whatsapp-photo`, {
                from: resolved, filePath: destPath,
            }, { timeout: 60000 });
            if (res.data?.reply) await msg.reply(res.data.reply);
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
        }, { timeout: 60000 });
        if (res.data?.reply) {
            await msg.reply(res.data.reply);
        }
    } catch (err) {
        console.error('[WA-BRIDGE] Failed to forward inbound message or send reply:', err.message);
    }
});

// Outbound: POST { to, message } -> sends via the linked WhatsApp account.
app.post('/send', async (req, res) => {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });
    if (!ready) return res.status(503).json({ error: 'WhatsApp not linked yet — scan the QR code first' });
    try {
        const chatId = to.includes('@') ? to : `${to.replace(/\D/g, '')}@c.us`;
        await client.sendMessage(chatId, message);
        res.json({ success: true, to, message });
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

// 2026-07-18: QR pairing kept failing during the session-recovery saga (scans
// bounced, and out-of-band manual links never persisted into this profile).
// Pairing-code flow links the phone directly to THIS browser instance — no QR,
// no second window. Only valid while unauthenticated (after a 'qr' event).
app.post('/pair', async (req, res) => {
    try {
        if (ready) return res.status(400).json({ error: 'already linked' });
        const number = String((req.body && req.body.number) || '').replace(/\D/g, '');
        if (!number) return res.status(400).json({ error: 'number required, digits only with country code' });
        const code = await client.requestPairingCode(number);
        console.log(`[WA-BRIDGE] Pairing code for +${number}: ${code} — enter it on the phone: Linked devices → Link a device → Link with phone number instead.`);
        res.json({ code });
    } catch (e) {
        console.error('[WA-BRIDGE] Pairing code failed:', e.message);
        res.status(500).json({ error: e.message });
    }
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
