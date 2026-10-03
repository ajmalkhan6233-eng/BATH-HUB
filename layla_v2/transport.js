'use strict';
// LAYLA v2 transport: the ONLY place that can send a WhatsApp message.
//   createDryRunTransport()    default. Logs "would send" (last 3 digits only, no message body) and sends nothing.
//   createSimulatorTransport() for tests. Keeps every message in memory (.outbox) and lets a test push incoming ones.
//   createCloudApiTransport()  official WhatsApp Cloud API. Refuses to do anything unless WHATSAPP_LIVE=true AND the
//                              token + phone number id exist. The HTTP call is an injected `fetch` so tests never touch the network.
//   selectTransport(env)       live adapter only when the flag and keys are present, otherwise dry run.
// Every send function returns {ok, id?, error?, dryRun?} and never throws.

const GRAPH = 'https://graph.facebook.com/v20.0';

const digits = v => String(v == null ? '' : v).replace(/\D/g, '');
const mask = p => '***' + digits(p).slice(-3);
const isLive = (env = process.env) => String(env.WHATSAPP_LIVE || '').toLowerCase() === 'true';
const haveKeys = (env = process.env) => !!(env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);

function checkArgs(to, kind, payload) {
    if (!digits(to)) return 'no phone number';
    if (kind === 'text' && !String(payload.text || '').trim()) return 'empty message';
    if (kind === 'image' && !(payload.url || payload.buffer || payload.mediaId)) return 'no image';
    if (kind === 'document' && !(payload.url || payload.buffer || payload.mediaId)) return 'no document';
    return null;
}

function createDryRunTransport({ log = console.log } = {}) {
    const sent = [];   // metadata only (never the body), so tests and the owner can see what WOULD have gone out
    const make = kind => async (to, payload = {}) => {
        const bad = checkArgs(to, kind, payload);
        if (bad) return { ok: false, error: bad };
        const entry = { kind, to_last3: digits(to).slice(-3), at: new Date().toISOString(), chars: kind === 'text' ? String(payload.text).length : undefined };
        sent.push(entry);
        log(`[layla-v2] DRY RUN would send ${kind} to ${mask(to)}${entry.chars ? ' (' + entry.chars + ' chars)' : ''}`);
        return { ok: true, dryRun: true, id: 'dry-' + sent.length };
    };
    return { name: 'dry-run', sendText: (to, text) => make('text')(to, { text }), sendImage: make('image'), sendDocument: make('document'), sent };
}

function createSimulatorTransport() {
    const outbox = [];
    const inbox = [];
    const make = kind => async (to, payload = {}) => {
        const bad = checkArgs(to, kind, payload);
        if (bad) return { ok: false, error: bad };
        outbox.push({ kind, to: digits(to), ...payload });
        return { ok: true, id: 'sim-' + outbox.length };
    };
    return {
        name: 'simulator',
        sendText: (to, text) => make('text')(to, { text }),
        sendImage: make('image'),
        sendDocument: make('document'),
        outbox, inbox,
        receive(from, text, extra = {}) { const m = { from: digits(from), text: String(text || ''), ...extra }; inbox.push(m); return m; },
        textsTo(to) { return outbox.filter(m => m.kind === 'text' && m.to === digits(to)).map(m => m.text); },
        reset() { outbox.length = 0; inbox.length = 0; },
    };
}

// Turns a Cloud API webhook body into [{from, text, name, id, type}]. Pure; used by the optional route.
function parseCloudWebhook(body) {
    const out = [];
    try {
        for (const entry of body.entry || []) for (const ch of entry.changes || []) {
            const v = ch.value || {};
            const names = {};
            for (const c of v.contacts || []) names[c.wa_id] = c.profile && c.profile.name;
            for (const m of v.messages || []) {
                out.push({
                    from: m.from, id: m.id, type: m.type, name: names[m.from] || null,
                    text: m.type === 'text' ? (m.text && m.text.body) || '' : (m.type === 'button' ? (m.button && m.button.text) || '' : ''),
                });
            }
        }
    } catch (e) { /* malformed body: return what we have */ }
    return out;
}

function createCloudApiTransport({ env = process.env, fetch: fetchFn, retries = 1, waitMs = 0 } = {}) {
    const doFetch = fetchFn || (typeof fetch === 'function' ? fetch : null);
    async function post(path, body, { form = false } = {}) {
        // The three gates. If any fails nothing leaves this function.
        if (!isLive(env)) return { ok: false, error: 'WHATSAPP_LIVE is not true' };
        if (!haveKeys(env)) return { ok: false, error: 'WhatsApp credentials are not set' };
        if (!doFetch) return { ok: false, error: 'no fetch available' };
        const url = `${GRAPH}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/${path}`;
        let lastErr = 'unknown error';
        for (let i = 0; i <= retries; i++) {
            try {
                const res = await doFetch(url, {
                    method: 'POST',
                    headers: form ? { Authorization: 'Bearer ' + env.WHATSAPP_API_TOKEN } : { Authorization: 'Bearer ' + env.WHATSAPP_API_TOKEN, 'Content-Type': 'application/json' },
                    body: form ? body : JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) return { ok: true, id: (data.messages && data.messages[0] && data.messages[0].id) || data.id };
                lastErr = `HTTP ${res.status}` + (data.error && data.error.message ? ' ' + String(data.error.message).slice(0, 120) : '');
                if (res.status < 500 && res.status !== 429) break;   // a bad request will not get better by retrying
            } catch (e) { lastErr = 'network error'; }
            if (waitMs) await new Promise(r => setTimeout(r, waitMs));
        }
        return { ok: false, error: lastErr };   // never contains the token
    }
    const base = to => ({ messaging_product: 'whatsapp', recipient_type: 'individual', to: digits(to) });
    // A file given as a Buffer is uploaded first (POST /media), then sent by its media id.
    async function withMedia(p) {
        if (!p.buffer || p.mediaId) return { p };
        const FormDataCls = globalThis.FormData, BlobCls = globalThis.Blob;
        if (!FormDataCls || !BlobCls) return { error: 'file upload is not available in this Node version' };
        const form = new FormDataCls();
        form.append('messaging_product', 'whatsapp');
        form.append('type', p.mime || 'application/octet-stream');
        form.append('file', new BlobCls([p.buffer], { type: p.mime || 'application/octet-stream' }), p.filename || 'file');
        const up = await post('media', form, { form: true });
        return up.ok && up.id ? { p: { ...p, mediaId: up.id } } : { error: up.error || 'upload failed' };
    }
    const guard = async (kind, to, payload, build) => {
        const bad = checkArgs(to, kind, payload);
        if (bad) return { ok: false, error: bad };
        if (kind === 'text') return post('messages', build(payload));
        const m = await withMedia(payload);
        if (m.error) return { ok: false, error: m.error };
        return post('messages', build(m.p));
    };
    return {
        name: 'cloud-api',
        sendText: (to, text) => guard('text', to, { text }, () => ({ ...base(to), type: 'text', text: { body: String(text).slice(0, 4000), preview_url: false } })),
        // Images and documents are sent by public link (Cloud API also accepts an uploaded media id as `id`).
        sendImage: (to, p = {}) => guard('image', to, p, q => ({ ...base(to), type: 'image', image: q.mediaId ? { id: q.mediaId, caption: q.caption } : { link: q.url, caption: q.caption } })),
        sendDocument: (to, p = {}) => guard('document', to, p, q => ({ ...base(to), type: 'document', document: q.mediaId ? { id: q.mediaId, filename: q.filename, caption: q.caption } : { link: q.url, filename: q.filename, caption: q.caption } })),
    };
}

function selectTransport(env = process.env, opts = {}) {
    if (isLive(env) && haveKeys(env)) return createCloudApiTransport({ env, ...opts });
    return createDryRunTransport(opts);
}

module.exports = { createDryRunTransport, createSimulatorTransport, createCloudApiTransport, selectTransport, parseCloudWebhook, isLive, haveKeys, mask, digits };