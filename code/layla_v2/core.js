'use strict';
// Shared plumbing for the LAYLA v2 engine: default dependencies, per-customer conversation notes,
// sending (with the small typing delay) and the owner alert. Everything goes through deps.transport,
// which is DRY RUN unless the owner has switched live sending on (see transport.js).
const { createMemoryStore } = require('./store_memory');
const { createMemoryCatalog } = require('./catalog');
const { createDryRunTransport } = require('./transport');
const { createStubDocuments } = require('./documents_adapter');
const { splitMessages, typingDelayMs } = require('./style');
const { digits } = require('./roles');

const CONVO_TTL_MS = 30 * 60 * 1000;   // what LAYLA last asked ("quotation?") is forgotten after 30 minutes

const cache = new WeakMap();

function buildContext(deps = {}) {
    const env = deps.env || process.env;
    const log = deps.log || (() => {});
    return {
        env,
        store: deps.store || createMemoryStore(),
        catalog: deps.catalog || createMemoryCatalog(),
        transport: deps.transport || createDryRunTransport({ log: deps.log || console.log }),
        documents: deps.documents || createStubDocuments(),
        answerEngine: deps.answerEngine || null,     // async (text) => {intent, reply} | null  (owner finance questions)
        model: deps.model || null,                    // async ({text, history, style}) => string | null   (optional, guarded)
        rng: deps.rng || Math.random,
        sleep: deps.sleep || (ms => new Promise(r => setTimeout(r, ms))),
        delay: deps.delay !== undefined ? deps.delay : (env.NODE_ENV === 'test' ? false : { min: 1000, max: 4000 }),
        now: deps.now || (() => new Date()),
        log,
        convo: deps.convo || new Map(),
    };
}

// The same deps object always gets the same context, so conversation notes survive between messages.
function getContext(deps = {}) {
    if (!cache.has(deps)) cache.set(deps, buildContext(deps));
    return cache.get(deps);
}

function getConvo(ctx, phone) {
    const now = ctx.now().getTime();
    let c = ctx.convo.get(phone);
    if (!c || now - c.ts > CONVO_TTL_MS) c = { pending: null, data: null, lastItem: null, ts: now };
    c.ts = now;
    ctx.convo.set(phone, c);
    return c;
}

/** Sends each text (split to at most 3 messages), waiting a natural moment before each. Never throws. */
async function sendTexts(ctx, to, texts, { delay = true } = {}) {
    const parts = texts.flatMap(t => splitMessages(t));
    while (parts.length > 3) { const last = parts.pop(); parts[parts.length - 1] += ' ' + last; }
    const sent = [];
    for (const t of parts) {
        const ms = delay ? typingDelayMs(t, ctx.delay) : 0;
        if (ms) await ctx.sleep(ms);
        const r = await ctx.transport.sendText(to, t).catch(e => ({ ok: false, error: String(e && e.message || e) }));
        if (!r.ok) ctx.log(`[layla-v2] send failed to ***${digits(to).slice(-3)}: ${r.error}`);
        sent.push(t);
    }
    return sent;
}

/** Short alert to every owner number in layla_contacts (through the transport: a dry run until live sending is on). */
async function alertOwners(ctx, text) {
    let owners = [];
    try { owners = await ctx.store.listContacts('owner'); } catch (e) { return 0; }
    let n = 0;
    for (const o of owners) {
        const r = await ctx.transport.sendText(o.phone, String(text).slice(0, 700)).catch(() => ({ ok: false }));
        if (r.ok) n++;
    }
    return n;
}

const snippet = (t, n = 120) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

module.exports = { buildContext, getContext, getConvo, sendTexts, alertOwners, snippet, CONVO_TTL_MS };