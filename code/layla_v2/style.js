'use strict';
// Human style helpers: split long answers into 2 or 3 WhatsApp messages, and a small natural typing delay.
// Pure functions (the delay is returned as milliseconds; the engine decides whether to actually wait).

const MAX_PARTS = 3;
const SPLIT_OVER = 220;   // characters; shorter messages are never split

function sentences(text) {
    // Split where . ! ? is followed by whitespace, so decimals (2.5) and amounts (Rs 1,850.50) stay whole.
    return String(text).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}

/** Splits one long text into at most 3 messages at sentence boundaries. Short text stays one message. */
function splitMessages(text, { over = SPLIT_OVER, max = MAX_PARTS } = {}) {
    const t = String(text || '').trim();
    if (!t) return [];
    if (t.length <= over) return [t];
    const sents = sentences(t);
    if (sents.length < 2) return [t];
    const target = Math.ceil(t.length / Math.min(max, Math.max(2, Math.ceil(t.length / over))));
    const parts = [];
    let cur = '';
    for (const s of sents) {
        if (cur && (cur + ' ' + s).length > target && parts.length < max - 1) { parts.push(cur); cur = s; }
        else cur = cur ? cur + ' ' + s : s;
    }
    if (cur) parts.push(cur);
    return parts;
}

/** 1 to 4 seconds depending on length (like someone typing), or 0 when delays are switched off. */
function typingDelayMs(text, cfg) {
    if (!cfg) return 0;
    const min = Number.isFinite(cfg.min) ? cfg.min : 1000, max = Number.isFinite(cfg.max) ? cfg.max : 4000;
    const ms = 700 + String(text || '').length * 25;
    return Math.max(min, Math.min(max, ms));
}

module.exports = { splitMessages, typingDelayMs, sentences, SPLIT_OVER, MAX_PARTS };