require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const { Pool } = require('pg');
const { client: openRouterClient, DEFAULT_MODEL } = require('./openrouter.config');
const SHOP = require('./shop_config.json');
const { classifyAndAnswer } = require('./scripts/layla_answer_engine');

// Same whitelist number used by whatsapp-bridge.js's local test mode — the
// one person allowed to teach LAYLA permanent facts via "TEACH: <fact>".
const OWNER_NUMBER = (process.env.WHATSAPP_TEST_WHITELIST || '+94777999219').replace(/\D/g, '');
const TAUGHT_FACTS_PATH = path.join(__dirname, 'LAYLA_TAUGHT_FACTS.md');

function loadTaughtFacts() {
    try { return fs.readFileSync(TAUGHT_FACTS_PATH, 'utf8'); } catch { return ''; }
}

const _dbSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('.railway.internal')
    ? { rejectUnauthorized: false } : false;
const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: _dbSsl })
    : new Pool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     process.env.DB_PORT     || 5432,
        database: process.env.DB_NAME     || 'bathco',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD,
    });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'not-set' });

function buildSystemPrompt() {
    const s = SHOP;
    const sr = s.business.showroom;
    const pr = s.business.perfumes;
    const pkgs = s.showroom_packages.map(p => `- ${p.tier} Package: ${p.description}`).join('\n');
    const brands = s.showroom_brands.join(', ');

    const formatCollection = (list) =>
        list.map(p => `- ${p.name} — ${p.notes}${p.sizes ? ` (${p.sizes.join('/')})` : ''} (${p.origin})`).join('\n');

    const escalateOn = s.layla_rules.escalate_on.map(r => `- ${r}`).join('\n');
    const strictRules = s.layla_rules.strict_rules.map(r => `- ${r}`).join('\n');

    return `You are LAYLA, the AI sales receptionist for two businesses owned by ${s.owner.name}:

1. ${sr.name} — Premium bathroom showroom, ${sr.location}
2. ${pr.name} — ${pr.tagline}, delivered island-wide in Sri Lanka

Your personality: ${s.layla_rules.personality}

═══ BATHROOM SHOWROOM ═══

GOALS:
1. Understand bathroom renovation or construction needs
2. Qualify the lead: budget range, timeline, property type, location
3. Present our packages (Standard / Premium / Luxury)
4. Encourage a showroom visit — ${sr.hours}
5. Collect: customer name, location, rough budget

PACKAGES:
${pkgs}

BRANDS: ${brands}, quality local brands
SHOWROOM: ${sr.location} — ${sr.hours}. ${sr.services.join('. ')}.

═══ ${pr.name.toUpperCase()} — PERFUMES ═══

GOALS:
1. Identify which fragrance category interests them (Men's / Women's / Unisex / Oud)
2. Recommend 1–2 specific perfumes based on their preference
3. Never quote exact prices — always say "Message us for today's price"
4. Encourage them to send a WhatsApp message to place an order
5. Collect: name, location, which perfume they want, quantity

OUD COLLECTION:
${formatCollection(s.perfume_collections.oud)}

MEN'S COLLECTION:
${formatCollection(s.perfume_collections.mens)}

WOMEN'S COLLECTION:
${formatCollection(s.perfume_collections.womens)}

UNISEX COLLECTION:
${formatCollection(s.perfume_collections.unisex)}

ALL PERFUMES: ${pr.certifications.join(', ')}, ${pr.delivery}

═══ SHARED RULES ═══

ABSOLUTE RULES (2026-07-05 — never break these, no exceptions):
- NEVER state any price, discount, delivery time, or promise of any kind. Not an estimate, not a range, not "probably around X" — nothing. Direct the customer to the showroom or say the team will follow up.
- NEVER invent HS codes, discount tier tables, turnaround times, process steps, or any other specific-sounding detail that is not explicitly given to you above. If it's not in this prompt, it does not exist — do not fill the gap with something plausible.
- Perfume or Dubai Imports questions: this WhatsApp number is for 1st Choice Bathco only. Politely say so and do not attempt to answer or sell perfumes/imports on this number, even though you may see perfume product details elsewhere in this prompt.
- When unsure about anything — set escalate=true and say a team member will follow up. Never guess your way to a confident-sounding answer.
- If you decline to answer something (a financial figure, a price, anything off-limits above), STOP THERE. Do not immediately pivot into offering to prepare a quote, proforma invoice, discount, or any other unprompted sales pitch as a consolation — that pivot is exactly where invented numbers sneak back in. A plain decline, or escalate=true, is a complete answer by itself.

ESCALATION RULES — set escalate=true when:
${escalateOn}

STRICT RULES:
${strictRules}

TONE: Mirror the customer's own style — if they write short and casual ("hi how much tiles", "u open today?"), reply short and casual back; if they write formally, reply formally. Understand shorthand (np=net profit, gp=gross profit, cheq/chq=cheque) and casual date words (yesterday, last week, this month) the same as formal phrasing. Never invent a number you don't actually have — say plainly what's missing instead.

Respond ONLY in valid JSON — no markdown, no explanation, just the JSON object:
{
  "message": "your WhatsApp reply to the customer",
  "escalate": false,
  "reason": "reason for escalation if escalate=true, else null",
  "data": {
    "name": "extracted customer name or null",
    "location": "extracted location or null",
    "budget": "extracted budget range or null",
    "intent": "browsing|interested|ready_to_buy|complaint|inquiry"
  }
}`;
}

// Strips reasoning-model leakage (<think> blocks, chain-of-thought preambles)
// before anything else touches the model's raw output. Applied to every AI
// path so a reasoning-capable model can never leak its monologue to a customer.
function stripReasoning(raw) {
    let s = raw;
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
    s = s.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    // Some models emit an unterminated <think> block if truncated - drop
    // everything before the first '{' in that case since the JSON is what matters.
    if (/<think>/i.test(s)) s = s.slice(s.search(/\{/) === -1 ? s.length : s.search(/\{/));
    return s.trim();
}

// Untagged chain-of-thought looks like the model talking about the conversation
// ("The user is asking...", "I should respond...") instead of talking TO the
// customer. Used as a last-resort guard when no JSON could be extracted at all.
function looksLikeReasoning(text) {
    return /\b(the user|the customer is|as (layla|an? ai)|system prompt|respond (in|with) json|json (object|format)|let me (think|analyze)|i (should|need to|will) (respond|reply|answer|say)|my (task|goal|instructions))\b/i.test(text);
}

// Pull the JSON object out of model output that may have prose around it:
// try the whole string first, then the outermost {...} span. Returns null if
// nothing parseable — callers must then decide, never echo raw output blindly.
function extractJsonObject(cleaned) {
    try {
        const p = JSON.parse(cleaned);
        if (p && typeof p === 'object') return p;
    } catch {}
    const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try {
            const p = JSON.parse(cleaned.slice(start, end + 1));
            if (p && typeof p === 'object') return p;
        } catch {}
    }
    return null;
}

const SAFE_FALLBACK_MESSAGE = "Thank you for your message! A team member will get back to you shortly. 😊";

const LAYLA_SYSTEM_PROMPT = buildSystemPrompt();

// Re-reads taught facts fresh each call (cheap, small file) so "TEACH:" facts
// take effect immediately without a server restart. Also stamps the current
// date (Asia/Colombo) — without it the model assumes its training-era year and
// treats real 2026 dates as "in the future".
function getSystemPrompt() {
    const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const base = `${LAYLA_SYSTEM_PROMPT}\n\nCURRENT DATE: Today is ${now} (Sri Lanka time). This is the real current date — dates in ${new Date().getFullYear()} are NOT in the future.`;
    const taught = loadTaughtFacts();
    return taught ? `${base}\n\n--- ADDITIONAL FACTS TAUGHT BY THE OWNER ---\n${taught}` : base;
}

// ─── BUDGET EXTRACTION ────────────────────────────────────────────────────────

function extractBudget(text) {
    if (!text) return 0;
    const s = String(text).toLowerCase().replace(/,/g, '');

    // lakh/lac: "1.5 lakh", "2 lakhs"
    const lakhMatch = s.match(/(\d+(?:\.\d+)?)\s*la(?:kh|c)s?/);
    if (lakhMatch) return Math.round(parseFloat(lakhMatch[1]) * 100000);

    // k shorthand: "150k", "50k"
    const kMatch = s.match(/(\d+(?:\.\d+)?)\s*k\b/);
    if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);

    // plain number with optional Rs prefix: "Rs. 150000", "150000 rupees", "150000"
    const nums = [...s.matchAll(/(?:rs\.?\s*)?(\d{4,})/g)].map(m => parseInt(m[1], 10));
    return nums.length ? Math.max(...nums) : 0;
}

// ─── DATABASE HELPERS ─────────────────────────────────────────────────────────

async function getOrCreateCustomer(phone, name = null) {
    const existing = await pool.query(
        'SELECT * FROM customers WHERE phone = $1',
        [phone]
    );

    if (existing.rows.length > 0) {
        await pool.query(
            'UPDATE customers SET last_contact = CURRENT_TIMESTAMP WHERE phone = $1',
            [phone]
        );
        return existing.rows[0];
    }

    const result = await pool.query(
        `INSERT INTO customers (phone, whatsapp, name, source, last_contact)
         VALUES ($1, $1, $2, 'whatsapp', CURRENT_TIMESTAMP)
         RETURNING *`,
        [phone, name]
    );
    return result.rows[0];
}

async function getConversationHistory(customerId) {
    const result = await pool.query(
        `SELECT messages FROM conversations
         WHERE customer_id = $1
         ORDER BY updated_at DESC LIMIT 1`,
        [customerId]
    );
    if (!result.rows.length) return [];
    try {
        const msgs = result.rows[0].messages;
        return Array.isArray(msgs) ? msgs : JSON.parse(msgs);
    } catch {
        return [];
    }
}

async function saveConversation(customerId, messages) {
    const existing = await pool.query(
        'SELECT id FROM conversations WHERE customer_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [customerId]
    );

    if (existing.rows.length > 0) {
        await pool.query(
            `UPDATE conversations SET messages = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [JSON.stringify(messages), existing.rows[0].id]
        );
    } else {
        await pool.query(
            `INSERT INTO conversations (customer_id, channel, agent, messages)
             VALUES ($1, 'whatsapp', 'LAYLA', $2)`,
            [customerId, JSON.stringify(messages)]
        );
    }
}

async function createOrUpdateLead(customerId, intent, notes = null) {
    // Valid enum: new, engaged, visit_scheduled, visited, converted, lost
    const intentMap = {
        interested:   'engaged',
        ready_to_buy: 'visit_scheduled',
        inquiry:      'new',
        browsing:     'new',
        complaint:    'new',
    };
    const status = intentMap[intent] || 'new';

    const existing = await pool.query(
        `SELECT id FROM leads WHERE customer_id = $1 AND status NOT IN ('converted','lost')
         ORDER BY created_at DESC LIMIT 1`,
        [customerId]
    );

    if (existing.rows.length > 0) {
        await pool.query(
            `UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [status, existing.rows[0].id]
        );
    } else {
        await pool.query(
            `INSERT INTO leads (customer_id, source, status, notes)
             VALUES ($1, 'whatsapp', $2, $3)`,
            [customerId, status, notes]
        );
    }
}

async function alertAjmal(phone, reason, customerMessage) {
    const ajmalNumber = process.env.WHATSAPP_NUMBER;
    const alertText = `🚨 *LAYLA ALERT*\n\nCustomer: ${phone}\nReason: ${reason}\nMessage: "${customerMessage}"\n\nPlease follow up!`;

    try {
        await axios.post(
            process.env.WHATSAPP_API_URL || 'http://localhost:3001/send',
            { to: ajmalNumber, message: alertText },
            { timeout: 5000 }
        );
        console.log(`[LAYLA] Alert sent to Ajmal for ${phone}`);
    } catch (err) {
        console.error('[LAYLA] WhatsApp alert failed, saving to DB:', err.message);
        await pool.query(
            `INSERT INTO alerts (type, message, priority)
             VALUES ('escalation', $1, 'high')`,
            [alertText]
        );
    }
}

// ─── AI CALLERS ───────────────────────────────────────────────────────────────

async function callAnthropic(messages) {
    const response = await anthropic.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: [
            {
                type: 'text',
                text: getSystemPrompt(),
                cache_control: { type: 'ephemeral' },
            },
        ],
        messages,
    });
    const raw = response.content[0].text.trim();
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
}

async function callOllama(messages) {
    const ollamaMessages = [
        { role: 'system', content: getSystemPrompt() },
        ...messages,
    ];
    const response = await axios.post(
        process.env.OLLAMA_URL || 'http://localhost:11434/api/chat',
        // keep_alive keeps the model resident in memory between customer
        // messages so it's rarely a cold ~2min load - warm calls are ~3s.
        { model: process.env.OLLAMA_MODEL || 'llama3.2:1b', messages: ollamaMessages, stream: false, keep_alive: '30m' },
        { timeout: 15000 } // fail fast to the OpenRouter fallback on a cold start rather than stall the customer
    );
    const raw = stripReasoning(response.data.message.content.trim());
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    console.log('[LAYLA] Using Ollama fallback (llama3.2) — raw:', cleaned.slice(0, 200));

    let parsed = extractJsonObject(cleaned);
    if (!parsed) {
        // Plain text: only usable as a reply if it doesn't read like the model's
        // internal monologue — otherwise swallow it and send the safe fallback.
        if (looksLikeReasoning(cleaned)) {
            console.warn('[LAYLA] Ollama output looked like leaked reasoning — suppressed');
            parsed = { message: SAFE_FALLBACK_MESSAGE, escalate: true, data: {} };
        } else {
            parsed = { message: cleaned, escalate: false, data: {} };
        }
    }
    if (!parsed.message || looksLikeReasoning(parsed.message)) parsed.message = SAFE_FALLBACK_MESSAGE;
    if (!parsed.data) parsed.data = {};
    return parsed;
}

async function callOpenRouter(messages) {
    const orMessages = [
        { role: 'system', content: getSystemPrompt() },
        ...messages,
    ];
    const response = await openRouterClient.chat.completions.create({
        model: DEFAULT_MODEL,
        max_tokens: 1024,
        messages: orMessages,
    });
    const raw = stripReasoning(response.choices[0].message.content.trim());
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    console.log('[LAYLA] Using OpenRouter fallback — raw:', cleaned.slice(0, 200));

    let parsed = extractJsonObject(cleaned);
    if (!parsed) {
        // No JSON anywhere — try the message field via regex, else treat as
        // plain text but never echo something that reads like internal reasoning.
        const msgMatch = cleaned.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (msgMatch) {
            parsed = { message: msgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'), escalate: false, data: {} };
        } else if (looksLikeReasoning(cleaned) || !cleaned) {
            console.warn('[LAYLA] OpenRouter output looked like leaked reasoning/empty — suppressed');
            parsed = { message: SAFE_FALLBACK_MESSAGE, escalate: true, data: {} };
        } else {
            parsed = { message: cleaned, escalate: false, data: {} };
        }
    }
    // If message is itself a JSON string (double-encoded), unwrap it
    if (typeof parsed.message === 'string' && parsed.message.trim().startsWith('{')) {
        try {
            const inner = JSON.parse(parsed.message);
            if (inner.message) parsed = inner;
        } catch {}
    }
    if (!parsed.message || looksLikeReasoning(parsed.message)) parsed.message = SAFE_FALLBACK_MESSAGE;
    if (!parsed.data) parsed.data = {};
    return parsed;
}

// ─── CORE MESSAGE PROCESSOR ───────────────────────────────────────────────────

async function processMessage(phone, incomingMessage, isVoiceNote = false) {
    if (isVoiceNote) {
        // Speech-to-text is deferred (not built) — always ask for text instead.
        await alertAjmal(phone, 'Customer sent a voice note', '[Voice Note]');
        return {
            message: "Thanks for the voice message. I can't listen to audio yet, so if you can send it as a text message I'll answer right away. 🙂",
            escalate: true,
        };
    }

    const digits = String(phone).replace(/\D/g, '');

    // Teaching mode — owner-only, permanent (appends to LAYLA_TAUGHT_FACTS.md,
    // picked up on the very next message via getSystemPrompt()).
    const teachMatch = incomingMessage.match(/^\s*TEACH:\s*(.+)$/is);
    if (teachMatch && digits === OWNER_NUMBER) {
        const fact = teachMatch[1].trim();
        fs.appendFileSync(TAUGHT_FACTS_PATH, `- (${new Date().toISOString().slice(0, 10)}) ${fact}\n`);
        console.log(`[LAYLA] Taught fact stored: ${fact}`);
        return { message: `Got it, I'll remember: "${fact}" ✅`, escalate: false };
    }

    // HARD ESCALATION GUARD (2026-07-05) — added after the test batch showed
    // the AI inventing discount tiers, HS codes, and turnaround promises on
    // exactly these kinds of messages. This runs BEFORE any model call, is not
    // an AI decision, and cannot be talked around by phrasing. Does not apply
    // to the owner's own number (customer-sales guard, not for internal use).
    const ESCALATION_KEYWORDS = [
        'price', 'discount', '%', 'offer', 'invoice', 'proforma', 'bank',
        'bulk', 'project', 'apartments', 'quotation', 'complaint', 'refund', 'warranty',
    ];
    if (digits !== OWNER_NUMBER) {
        const lowerMsg = incomingMessage.toLowerCase();
        const hitKeyword = ESCALATION_KEYWORDS.find(k => lowerMsg.includes(k));
        if (hitKeyword) {
            console.log(`[LAYLA] hard escalation guard fired (keyword="${hitKeyword}") phone=${digits}`);
            await alertAjmal(phone, `Escalation guard fired (keyword: "${hitKeyword}")`, incomingMessage);
            return {
                message: 'Our team will reply to you shortly regarding this, In sha Allah.',
                escalate: true,
            };
        }
    }

    // Business-question answer engine — deterministic DB lookups for money/
    // stock figures, bypasses the AI entirely so numbers can't be hallucinated.
    let businessAnswer = null;
    try {
        businessAnswer = await classifyAndAnswer(pool, incomingMessage);
    } catch (e) {
        console.error('[LAYLA] answer engine error:', e.message);
    }
    console.log(`[LAYLA] intent=${businessAnswer ? businessAnswer.intent : 'shop_ai_or_unknown'} phone=${digits}`);
    if (businessAnswer) {
        const customer = await getOrCreateCustomer(phone);
        const history = await getConversationHistory(customer.id);
        await saveConversation(customer.id, [
            ...history,
            { role: 'user', content: incomingMessage },
            { role: 'assistant', content: businessAnswer.reply },
        ]);
        return { message: businessAnswer.reply, escalate: false };
    }

    const customer = await getOrCreateCustomer(phone);
    const history = await getConversationHistory(customer.id);

    const messages = [
        ...history,
        { role: 'user', content: incomingMessage },
    ];

    // Cost chain: Ollama (local, free) FIRST for everything that reaches here
    // (DB-backed questions never get this far — see the answer engine above).
    // OpenRouter's free-tier model is only used when Ollama's own answer is
    // genuinely weak. Anthropic is OUT of the chain until credits are topped
    // up — callAnthropic() is still defined/exported below if needed again.
    const LOW_QUALITY_MARKERS = ["i don't know", "i do not know", "i'm not sure", "as an ai", "i cannot help"];
    function isLowQuality(resp) {
        const msg = (resp?.message || '').trim();
        if (msg.length < 15) return true;
        const lower = msg.toLowerCase();
        return LOW_QUALITY_MARKERS.some(m => lower.includes(m));
    }

    let laylaResponse;
    try {
        laylaResponse = await callOllama(messages);
        if (isLowQuality(laylaResponse)) {
            console.warn('[LAYLA] Ollama answer looked weak — escalating to OpenRouter');
            laylaResponse = await callOpenRouter(messages);
        }
    } catch (ollamaErr) {
        console.warn('[LAYLA] Ollama error:', ollamaErr.message, '— trying OpenRouter');
        try {
            laylaResponse = await callOpenRouter(messages);
        } catch (openRouterErr) {
            console.error('[LAYLA] All AI fallbacks failed:', openRouterErr.message);
            await alertAjmal(phone, 'AI error — needs manual reply', incomingMessage);
            return {
                message: "Thanks for reaching out to 1st Choice Bathco. I'm having a technical hiccup right now, please resend your message in a moment. We're open daily from 9:30 AM.",
                escalate: true,
            };
        }
    }

    // Save updated conversation history
    const updatedHistory = [
        ...messages,
        { role: 'assistant', content: laylaResponse.message },
    ];
    await saveConversation(customer.id, updatedHistory);

    // Update customer record with extracted data
    if (laylaResponse.data) {
        const { name, location, budget, intent } = laylaResponse.data;

        if (name || location) {
            await pool.query(
                `UPDATE customers SET
                    name     = COALESCE($1, name),
                    location = COALESCE($2, location),
                    notes    = COALESCE($3, notes)
                 WHERE id = $4`,
                [name || null, location || null, budget ? `Budget: ${budget}` : null, customer.id]
            );
        }

        if (intent && intent !== 'browsing') {
            await createOrUpdateLead(customer.id, intent, budget ? `Budget: ${budget}` : null);
        }
    }

    // High-value check — always runs, falls back to raw message if AI missed the budget
    const budgetNum = extractBudget(laylaResponse.data?.budget) || extractBudget(incomingMessage);
    if (budgetNum >= 50000) {
        const alertText = `💰 *HIGH-VALUE INQUIRY*\n\nCustomer: ${phone}\nBudget: Rs. ${budgetNum.toLocaleString()}\nMessage: "${incomingMessage}"\n\nFollow up immediately!`;
        // Always write to DB so dashboard shows it
        await pool.query(
            `INSERT INTO alerts (type, message, priority) VALUES ('high_value', $1, 'high')`,
            [alertText]
        );
        // Also fire WhatsApp notification
        await alertAjmal(phone, `High-value inquiry — budget Rs. ${budgetNum.toLocaleString()}`, incomingMessage);
        console.log(`[LAYLA] High-value alert — ${phone} budget Rs. ${budgetNum.toLocaleString()}`);
    }

    if (laylaResponse.escalate) {
        await alertAjmal(
            phone,
            laylaResponse.reason || 'Customer needs attention',
            incomingMessage
        );
    }

    return {
        message: laylaResponse.message,
        escalate: laylaResponse.escalate || false,
    };
}

module.exports = { processMessage, alertAjmal, getOrCreateCustomer, pool, callAnthropic };
