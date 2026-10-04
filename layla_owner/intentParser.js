'use strict';
/**
 * Rule-based understanding of the owner's messages (typed, or a voice note after speech-to-text).
 * No AI, no network, free. Writes nothing: it only returns an intent. Unknown messages return UNKNOWN (an optional LLM fallback can be added later).
 */
const T = require('./timeParse');

const STOP = new Set(['layla', 'leila', 'laila', 'hey', 'hi', 'hello', 'please', 'pls', 'tell', 'note', 'remember', 'remind', 'me', 'that', 'about', 'the', 'from', 'at', 'of', 'a', 'an', 'and', 'also', 'quick', 'just', 'ok', 'okay', 'so', 'one', 'more', 'thing', 'if', 'i', 'said', 'say']);
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function vendorBefore(text, re) {
  const m = text.match(re); if (!m) return null;
  let part = clean(m[1]); if (part.includes(',')) part = part.slice(part.lastIndexOf(',') + 1);
  let words = part.split(' ').filter(Boolean);
  const FILL = new Set(['has', 'have', 'there', 'is', 'are', 'a', 'an', 'one', 'the', 'got', 'pending', 'new', 'another']);
  while (words.length && FILL.has(words[words.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) words.pop();
  while (words.length && STOP.has(words[0].toLowerCase().replace(/[^a-z]/g, ''))) words.shift();
  words = words.slice(-3);
  const name = words.join(' ').replace(/[,.;:]+$/g, '');
  return name || null;
}
function vendorAfter(text, re) {
  const m = text.match(re); if (!m) return null;
  const name = clean(m[1]).split(/\s+(?:and|but|it|will|which|for|,|that|realiz|clear)/i)[0].replace(/[,.;:]+$/g, '').split(' ').slice(0, 3).join(' ');
  return name || null;
}
function extractVendor(text) {
  return vendorBefore(text, /([A-Za-z][\w&.'-]*(?:\s+[A-Za-z][\w&.'-]*){0,4})\s+(?:has\s+|have\s+|there\s+is\s+|there's\s+|got\s+)?(?:a\s+|an\s+|one\s+|the\s+)?(?:pending\s+)?(?:bill|invoice)/i)
    || vendorAfter(text, /\b(?:from|at|to|for)\s+([A-Za-z][\w&.'-]*(?:\s+[A-Za-z][\w&.'-]*){0,2})/i);
}
const stripTimeWords = (s) => clean(s.replace(/\b(by|this|in the|at|on|next)?\s*(evening|tonight|tomorrow|today|morning|afternoon|noon|eod|end of day|night)\b/gi, ' ').replace(/\b(in|after)\s+\d+\s*\w+/gi, ' ').replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, ' '));

function parseOwnerMessage(raw, now = new Date()) {
  const text = clean(raw); const t = text.toLowerCase();
  if (!t) return { type: 'EMPTY' };
  if (/^(help|menu|\?|commands)$/.test(t)) return { type: 'HELP' };
  let m;
  if ((m = t.match(/^(?:done|finished|entered|complete[d]?)\s*#?(\d+)/))) return { type: 'DONE', id: +m[1] };
  if ((m = t.match(/^snooze\s*#?(\d+)\s*(.*)$/))) { const w = T.parseWhen(m[2] ? (/^\d/.test(m[2]) ? `in ${m[2]}` : m[2]) : 'in 1 hour', now) || T.parseWhen('in 1 hour', now); return { type: 'SNOOZE', id: +m[1], until: w.at }; }
  if (/\b(what'?s pending|what is pending|pending tasks|my tasks|to ?do|open tasks|reminders)\b/.test(t)) return { type: 'TASKS' };

  const hasCheque = /\b(cheque|cheques|check|chq)\b/.test(t);
  const amount = T.parseAmount(t);
  if (hasCheque && amount && /\b(wrote|written|writing|issued|gave|given|giving|made|signed|post.?dated)\b/.test(t)) {
    const date = T.parseDate(t, now) || T.isoLocalDate(now);
    const vendor = vendorAfter(text, /\b(?:to|for)\s+([A-Za-z][\w&.'-]*(?:\s+[A-Za-z][\w&.'-]*){0,2})/i);
    const ri = t.search(/\bremind\b/); const when = ri >= 0 ? T.parseWhen(t.slice(ri), now) : null;   // only the words after "remind" say when to remind
    return { type: 'CHEQUE_NOTE', amount, date, vendor, remindAt: (when || T.parseWhen('evening', now)).at };
  }
  if (/\b(bill|invoice)\b/.test(t) && /(pending|not entered|haven'?t entered|have not entered|didn'?t enter|did not enter|not in (the )?grn|yet to enter|still to enter|to be entered|forgot to enter|not yet entered)/.test(t)) {
    const when = T.parseWhen(t, now) || T.parseWhen('evening', now);
    return { type: 'PENDING_BILL', vendor: extractVendor(text), amount, remindAt: when.at };
  }
  if (/\b(remind me|reminder|don'?t let me forget|alert me|wake me)\b/.test(t)) {
    const when = T.parseWhen(t, now) || T.parseWhen('evening', now);
    const subject = stripTimeWords(text.replace(/^(layla[, ]*)?/i, '').replace(/\b(please|pls)\b/ig, '').replace(/\b(remind me|reminder|don'?t let me forget|alert me)\b( to| about| that)?/ig, ''));
    return { type: 'REMIND', subject: subject || 'Reminder', remindAt: when.at };
  }
  if ((m = t.match(/\b(?:price|rate|selling price)\s+(?:of|for)\s+(.+)$/))) return { type: 'PRICE_QUERY', q: clean(m[1]) };
  if (/\b(cash gap|short of cash|need cash|how much cash|cash i need|money i need)\b/.test(t)) return { type: 'CASH_GAP' };
  if (/\bcheques?\b.*\b(today|tomorrow|monday|this week|due|coming|falling|next)\b|\b(today|tomorrow|monday)\b.*\bcheques?\b/.test(t)) return { type: 'CHEQUES_DUE' };
  if ((m = t.match(/\b(?:payable|owe|owed|outstanding)\b(?:\s+(?:to|for))?\s*(.*)$/)) && /\b(payable|owe|owed|outstanding)\b/.test(t)) return { type: 'PAYABLE', vendor: clean(m[1].replace(/^[?.\s]+|[?.\s]+$/g, '')) || null };
  if (/\b(sales|sale|sold)\b.*\b(today|yesterday)\b|\b(today|yesterday)'?s?\b.*\bsales?\b/.test(t)) return { type: 'SALES', day: /yesterday/.test(t) ? 'yesterday' : 'today' };
  if (/\b(brief|summary|morning report|how are we doing|status)\b/.test(t)) return { type: 'BRIEF' };
  if (/\b(stock|in stock|available|availability|do we have|have we got|how many|left)\b/.test(t)) {
    const q = clean(t.replace(/\b(layla|please|stock|in stock|availability|available|do we have|have we got|how many|left|of|is there|are there|any|check|tell me|let me know|what is the|what's the|the)\b/g, ' ').replace(/[?.!,]/g, ' '));
    return { type: 'STOCK_QUERY', q };
  }
  return { type: 'UNKNOWN', text };
}
module.exports = { parseOwnerMessage, extractVendor };
