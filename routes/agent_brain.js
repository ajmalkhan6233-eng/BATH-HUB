// routes/agent_brain.js
// M9 AGENT BRAIN: LAYLA drafts replies to customer messages; Aj reviews each one. NOTHING IS EVER SENT here:
// this file has no WhatsApp/email/network code, and a draft only moves between draft / approved / rejected
// (M6's reply_drafts table). "I sent it" stays a manual step in M6.
//
// For each incoming customer message:
//   1. load the ACTIVE rules from M1 (agent_rules)
//   2. ask LAYLA's answer engine what the message is about (it also tells us if the data is missing)
//   3. build a CUSTOMER-SAFE reply (the engine's own replies are owner-facing and contain cost/profit)
//   4. run the four checks (utils/agentBrain.js) and save the draft into reply_drafts as status 'draft'
//   5. log the reasoning, the rules used and the check results in agent_checks
// A draft whose checks failed cannot be approved (only rejected or edited; an edit is re-checked).
// Owner/admin only.

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { classifyAndAnswer } = require('../scripts/layla_answer_engine');
const {
    checkReply, markPriceIfNeeded, customerText, hasPrice,
    screenIncoming, markApproval, OVERRIDE_REPLY, INTEREST_REPLY, APPROVAL_SENTENCE,
    INTERNAL_INTENTS, SAFE_REFUSAL, UNKNOWN_REPLY,
} = require('../utils/agentBrain');

const CHANNELS = ['whatsapp', 'email'];

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}
const clean = v => String(v == null ? '' : v).trim();

function createRouter(pool, { answerFn = classifyAndAnswer } = {}) {
    const router = express.Router();

    // reply_drafts is M6's table; the same CREATE IF NOT EXISTS keeps M9 working on its own.
    const ready = (async () => {
        // Both M6 and M9 start on the first request, so only create it if it is missing and accept losing the race.
        const have = await pool.query(`SELECT to_regclass('reply_drafts') AS t`).then(r => r.rows[0].t).catch(() => null);
        if (!have) {
            await pool.query(`CREATE TABLE IF NOT EXISTS reply_drafts (
                id SERIAL PRIMARY KEY, channel TEXT NOT NULL, customer_ref TEXT NOT NULL DEFAULT '', incoming_text TEXT NOT NULL DEFAULT '',
                draft_text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
                .catch(e => { if (e.code !== '23505' && e.code !== '42P07') throw e; });
        }
        await pool.query(`CREATE TABLE IF NOT EXISTS agent_checks (
            id SERIAL PRIMARY KEY,
            draft_id INTEGER NOT NULL,
            kind TEXT NOT NULL DEFAULT 'created',
            intent TEXT,
            rules_used TEXT NOT NULL DEFAULT '[]',
            reasoning TEXT NOT NULL DEFAULT '',
            checks TEXT NOT NULL DEFAULT '[]',
            passed BOOLEAN NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    })().catch(e => console.error('[agent_brain] init failed:', e.message));

    // 1. Active rules from M1 (empty list if the rulebook table does not exist yet).
    async function loadRules() {
        try {
            const r = await pool.query(`SELECT id, topic, rule_text, version FROM agent_rules WHERE active = TRUE ORDER BY topic, rule_key`);
            return r.rows;
        } catch (e) { return []; }
    }

    // 2-3. Work out the customer-safe reply and why.
    async function compose(incoming, { allowPrice = false, rules = [] } = {}) {
        const steps = [];
        // The active rules are instructions to the agent, not customer content: their wording must never appear in a reply.
        const ctx = { dataMissing: false, internalValues: rules.map(r => r.rule_text).filter(t => String(t).length >= 20) };

        // 2a. Screen the customer's message first. Blocked messages never reach the answer engine at all.
        const screen = screenIncoming(incoming);
        if (screen.block) {
            const label = { override: 'an attempt to change the agent\'s rules', internal: 'a request for internal data', interest: 'an interest-based / guaranteed-return request' }[screen.block];
            steps.push(`BLOCKED: the message is ${label} (${screen.reasons.join('; ')}). It was not sent to the answer engine; the customer gets a polite refusal and nothing was looked up.`);
            if (screen.block === 'override') steps.push('The rulebook is unchanged by anything a customer writes.');
            let text = screen.block === 'override' ? OVERRIDE_REPLY : screen.block === 'interest' ? INTEREST_REPLY : SAFE_REFUSAL;
            if (screen.approval.length) { text = markApproval(text, screen.approval); steps.push(`Also marked "needs Aj approval": ${screen.approval.join('; ')}.`); }
            return { text, intent: `blocked_${screen.block}`, ctx, steps };
        }

        let answer = null;
        try { answer = await answerFn(pool, incoming); } catch (e) { steps.push(`Answer engine failed (${e.message}): treated as no data.`); }
        let intent = answer && answer.intent || 'unrecognised';
        let text;

        if (!answer) {
            steps.push('The engine did not recognise a business question: nothing to answer from, so "I don\'t know".');
            text = UNKNOWN_REPLY; ctx.dataMissing = true;
        } else if (INTERNAL_INTENTS.has(answer.intent)) {
            steps.push(`Intent "${answer.intent}" is internal (profit, credit or cheque data). A customer is never given it; refusing politely.`);
            text = SAFE_REFUSAL;
        } else if (answer.intent === 'item_lookup' && answer.data) {
            const d = answer.data;
            ctx.internalValues.push(d.avg_cost);               // the cost figure must never appear in the reply
            steps.push(`Found item ${d.item_code} (${d.name}). Using only its name, availability and (if allowed) selling price; the cost is left out.`);
            const avail = d.stock_level > 0 ? 'is available' : 'is out of stock at the moment';
            text = `${d.name} ${avail}.`;
            if (allowPrice) { text += ` Price: LKR ${Number(d.selling_price).toLocaleString('en-US')}.`; steps.push('Price included because it was asked for; it will be marked for Aj to approve.'); }
            else { text += ' For the price, please ask us and Aj will confirm.'; steps.push('Public prices are "ask us" by default, so no price is quoted.'); }
        } else if (answer.intent === 'item_lookup') {
            text = UNKNOWN_REPLY; ctx.dataMissing = true;
            steps.push(`The engine said: "${clean(answer.reply)}". No item data, so "I don't know".`);
        } else {
            text = UNKNOWN_REPLY; ctx.dataMissing = true;
            steps.push(`Intent "${answer.intent}" has no customer-safe answer: "I don't know".`);
        }
        // Discounts, special / bulk prices and credit are Aj's decision: answer politely, promise nothing, mark for Aj.
        if (screen.approval.length) {
            text = `${text} ${APPROVAL_SENTENCE}`.replace(/\s+/g, ' ').trim();
            text = markApproval(text, screen.approval);
            steps.push(`Marked "needs Aj approval": ${screen.approval.join('; ')}. No discount or special price was offered.`);
        }
        text = markPriceIfNeeded(text);
        if (hasPrice(text)) steps.push('The reply contains a price, so it is marked "needs Aj approval".');
        return { text, intent, ctx, steps };
    }

    const parse = r => ({ ...r, checks: safeJson(r.checks, []), rules_used: safeJson(r.rules_used, []) });
    function safeJson(s, d) { try { return JSON.parse(s); } catch (e) { return d; } }

    async function saveCheck(draftId, kind, intent, rules, steps, result) {
        const r = await pool.query(
            `INSERT INTO agent_checks (draft_id, kind, intent, rules_used, reasoning, checks, passed) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [draftId, kind, intent, JSON.stringify(rules.map(x => ({ id: x.id, topic: x.topic, version: x.version }))), steps.join('\n'), JSON.stringify(result.checks), result.passed]);
        return parse(r.rows[0]);
    }

    // The whole drafting pipeline in one place, used by the Agent Review tab AND by the WhatsApp webhook (draft-only mode).
    // Always saves a 'draft'. Throws an Error with .status = 400 for bad input.
    async function createDraft({ channel, customer_ref, incoming_text, allow_price = false } = {}) {
        await ready;
        const ch = clean(channel) || 'whatsapp', incoming = clean(incoming_text);
        const bad = m => { const e = new Error(m); e.status = 400; return e; };
        if (!CHANNELS.includes(ch)) throw bad('channel must be one of: ' + CHANNELS.join(', '));
        if (!incoming) throw bad('incoming_text is required');
        if (incoming.length > 2000) throw bad('incoming_text is too long (max 2000 characters)');

        const rules = await loadRules();
        const steps = [`Loaded ${rules.length} active rule(s) from the rulebook${rules.length ? ': ' + rules.map(r => `[${r.topic}] v${r.version}`).join(', ') : ' (the rulebook is empty)'}.`];
        const c = await compose(incoming, { allowPrice: allow_price === true, rules });
        steps.push(...c.steps);
        let result = checkReply(c.text, c.ctx);
        let text = c.text;
        if (!result.passed) {
            steps.push('A check failed on the first wording: ' + result.checks.filter(x => !x.pass).map(x => `${x.id} (${x.detail})`).join('; ') + '. Falling back to the safe reply.');
            text = c.ctx.dataMissing ? UNKNOWN_REPLY : SAFE_REFUSAL;
            result = checkReply(text, c.ctx);
        }
        steps.push(result.passed ? 'All four checks passed.' : 'Checks still failing: Aj can edit or reject, not approve.');

        const d = await pool.query(
            `INSERT INTO reply_drafts (channel, customer_ref, incoming_text, draft_text, status) VALUES ($1,$2,$3,$4,'draft') RETURNING *`,
            [ch, clean(customer_ref), incoming, text]);
        const check = await saveCheck(d.rows[0].id, 'created', c.intent, rules, steps, result);
        return { draft: d.rows[0], customer_text: customerText(text), needs_approval: /needs\s+aj\s+approval/i.test(text), check };
    }

    // How many drafts this customer has already caused recently (flood guard for the WhatsApp webhook).
    async function recentCount(customer_ref, minutes = 60) {
        await ready;
        const since = new Date(Date.now() - minutes * 60000);
        const r = await pool.query(`SELECT COUNT(*) AS n FROM reply_drafts WHERE customer_ref = $1 AND created_at > $2`, [clean(customer_ref), since]);
        return Number(r.rows[0].n);
    }
    router.brain = { createDraft, recentCount, ready };

    // POST /agent-brain/draft  { channel, customer_ref, incoming_text, allow_price? }
    router.post('/agent-brain/draft', ownerOnly, async (req, res) => {
        try {
            const out = await createDraft(req.body || {});
            res.status(201).json(out);
        } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
    });

    // GET /agent-brain/reviews?status=draft|approved|rejected|all  (agent-made drafts only, newest first, with the latest check)
    router.get('/agent-brain/reviews', ownerOnly, async (req, res) => {
        try {
            await ready;
            const st = clean(req.query.status) || 'draft';
            if (!['draft', 'approved', 'rejected', 'sent', 'all'].includes(st)) return res.status(400).json({ error: 'status must be draft, approved, rejected, sent or all' });
            const drafts = (await pool.query(`SELECT * FROM reply_drafts WHERE id IN (SELECT DISTINCT draft_id FROM agent_checks) ORDER BY id DESC LIMIT 200`)).rows;
            const checks = (await pool.query(`SELECT * FROM agent_checks ORDER BY id ASC`)).rows.map(parse);
            const latest = new Map();
            for (const c of checks) latest.set(c.draft_id, c);
            const out = drafts.filter(d => st === 'all' || d.status === st)
                .map(d => ({ ...d, customer_text: customerText(d.draft_text), needs_approval: /needs\s+aj\s+approval/i.test(d.draft_text), check: latest.get(d.id) || null }));
            res.json(out);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/agent-brain/drafts/:id/checks', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(`SELECT * FROM agent_checks WHERE draft_id = $1 ORDER BY id ASC`, [Number(req.params.id) || 0]);
            if (!r.rows.length) return res.status(404).json({ error: 'No checks logged for that draft' });
            res.json(r.rows.map(parse));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    async function loadAgentDraft(id) {
        const d = (await pool.query(`SELECT * FROM reply_drafts WHERE id = $1`, [Number(id) || 0])).rows[0];
        if (!d) return {};
        const chk = (await pool.query(`SELECT * FROM agent_checks WHERE draft_id = $1 ORDER BY id DESC LIMIT 1`, [d.id])).rows[0];
        return { d, chk: chk ? parse(chk) : null };
    }

    // Aj edits the wording: it is re-checked and the draft goes back to 'draft'. A new log row is written.
    router.put('/agent-brain/drafts/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const { d, chk } = await loadAgentDraft(req.params.id);
            if (!d || !chk) return res.status(404).json({ error: 'Agent draft not found' });
            if (d.status === 'sent') return res.status(409).json({ error: 'Already sent; create a new draft' });
            const text = clean(req.body && req.body.draft_text);
            if (!text) return res.status(400).json({ error: 'draft_text is required' });
            const sd = chk.checks.find(x => x.id === 'says_dont_know');
            const dataMissing = !!sd && !/data needed was found/i.test(sd.detail);   // same data situation as when the draft was made
            const marked = markPriceIfNeeded(text);
            const result = checkReply(marked, { dataMissing });
            const u = await pool.query(`UPDATE reply_drafts SET draft_text = $1, status = 'draft', approved_at = NULL WHERE id = $2 RETURNING *`, [marked, d.id]);
            const check = await saveCheck(d.id, 'edited', chk.intent, chk.rules_used.map(r => ({ id: r.id, topic: r.topic, version: r.version })),
                [`Aj edited the wording${marked !== text ? ' (price mark added)' : ''}.`, result.passed ? 'All four checks passed.' : 'A check failed: ' + result.checks.filter(x => !x.pass).map(x => x.id).join(', ') + '.'], result);
            res.json({ draft: u.rows[0], customer_text: customerText(marked), check });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Approve = "the wording is fine". It does NOT send anything. Only a draft whose latest checks passed.
    router.post('/agent-brain/drafts/:id/approve', ownerOnly, async (req, res) => {
        try {
            await ready;
            const { d, chk } = await loadAgentDraft(req.params.id);
            if (!d || !chk) return res.status(404).json({ error: 'Agent draft not found' });
            if (d.status !== 'draft') return res.status(409).json({ error: `A ${d.status} draft cannot be approved` });
            if (!chk.passed) return res.status(409).json({ error: 'The checks failed for this draft: edit it until they pass, or reject it' });
            const r = await pool.query(`UPDATE reply_drafts SET status = 'approved', approved_at = NOW() WHERE id = $1 RETURNING *`, [d.id]);
            res.json({ draft: r.rows[0], customer_text: customerText(r.rows[0].draft_text), note: 'Approved. Nothing was sent: copy the text and send it yourself.' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/agent-brain/drafts/:id/reject', ownerOnly, async (req, res) => {
        try {
            await ready;
            const { d, chk } = await loadAgentDraft(req.params.id);
            if (!d || !chk) return res.status(404).json({ error: 'Agent draft not found' });
            if (!['draft', 'approved'].includes(d.status)) return res.status(409).json({ error: `A ${d.status} draft cannot be rejected` });
            const r = await pool.query(`UPDATE reply_drafts SET status = 'rejected', approved_at = NULL WHERE id = $1 RETURNING *`, [d.id]);
            res.json({ draft: r.rows[0] });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

let _router;
function init() {
    if (!_router) _router = createRouter(new Pool({
        host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    }));
    return _router;
}
module.exports = function (req, res, next) { init()(req, res, next); };
module.exports.createRouter = createRouter;
// For the WhatsApp webhook (draft-only mode): the same drafting pipeline, on this module's own database pool.
module.exports.getBrain = () => init().brain;
