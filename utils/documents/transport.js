'use strict';
// ONE transport interface for sending a document on WhatsApp:  transport.send({ to, filePath, fileName, caption, mime }) -> { id? }
//   dryRunTransport  : DEFAULT. Logs "would send" with the last 3 digits only. Sends nothing, stores nothing.
//   cloudApiTransport: Meta's official WhatsApp Business Cloud API. Only chosen when WHATSAPP_LIVE=true AND WHATSAPP_AUTO_SEND=true
//                      (the existing flags) AND the keys exist. NEVER run in this build (UNVERIFIED against the real service).
//   simulatorTransport: for tests. Records the calls in memory.
// Never the unofficial QR bridge. Tokens and full numbers are never logged.
const fs = require('fs');
const axios = require('axios');

const GRAPH = 'https://graph.facebook.com/v20.0';
const flag = v => String(v || '').toLowerCase() === 'true';
const last3 = p => String(p || '').replace(/\D/g, '').slice(-3) || '???';
const liveOn = (env = process.env) => flag(env.WHATSAPP_LIVE) && flag(env.WHATSAPP_AUTO_SEND);
const haveKeys = (env = process.env) => !!(env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);

const dryRunTransport = {
    name: 'dry_run', live: false,
    async send({ to, fileName }) {
        console.log(`[documents] DRY RUN: would send "${fileName}" to ***${last3(to)} (nothing was sent)`);
        return { dry: true };
    },
};

function cloudApiTransport(env = process.env, http = axios) {
    return {
        name: 'cloud_api', live: true,
        async send({ to, filePath, fileName, caption, mime }) {
            const auth = { Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}` };
            const base = `${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}`;
            const form = new FormData();
            form.append('messaging_product', 'whatsapp');
            form.append('type', mime);
            form.append('file', new Blob([fs.readFileSync(filePath)], { type: mime }), fileName);
            const up = await http.post(`${base}/media`, form, { headers: auth, timeout: 30000 });
            const mediaId = up.data && up.data.id;
            if (!mediaId) throw new Error('WhatsApp did not accept the file upload');
            const body = { messaging_product: 'whatsapp', to: String(to).replace(/\D/g, ''), type: 'document', document: { id: mediaId, filename: fileName, caption: String(caption || '').slice(0, 300) } };
            const res = await http.post(`${base}/messages`, body, { headers: { ...auth, 'Content-Type': 'application/json' }, timeout: 30000 });
            return { id: res.data && res.data.messages && res.data.messages[0] && res.data.messages[0].id };
        },
    };
}

function simulatorTransport({ fail = false } = {}) {
    const t = { name: 'simulator', live: true, calls: [], async send(m) { t.calls.push(m); if (fail) throw new Error('simulated failure'); return { id: 'sim-' + t.calls.length }; } };
    return t;
}

// The transport the app uses. Live only with both flags AND keys; otherwise dry run.
function pickTransport(env = process.env) { return liveOn(env) && haveKeys(env) ? cloudApiTransport(env) : dryRunTransport; }

// Error text may echo request parts: strip the token and long digit runs (phone numbers) before it is stored.
function safeReason(e, env = process.env) {
    let m = String((e && e.response && e.response.data && e.response.data.error && e.response.data.error.message) || (e && e.message) || 'unknown error');
    if (env.WHATSAPP_API_TOKEN) m = m.split(env.WHATSAPP_API_TOKEN).join('[token]');
    return m.replace(/\d{7,}/g, n => '***' + n.slice(-3)).slice(0, 200);
}

module.exports = { dryRunTransport, cloudApiTransport, simulatorTransport, pickTransport, liveOn, haveKeys, last3, safeReason };
