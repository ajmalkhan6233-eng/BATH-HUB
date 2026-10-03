'use strict';
const { splitMessages, typingDelayMs } = require('../../layla_v2/style');
const { checkCustomerReply } = require('../../layla_v2/guard');
const { render, PHRASES, STYLES } = require('../../layla_v2/phrases');

describe('LAYLA v2 style: splitting and delay', () => {
    test('short text stays as one message', () => {
        expect(splitMessages('Hello there. How can I help?')).toEqual(['Hello there. How can I help?']);
        expect(splitMessages('')).toEqual([]);
    });
    test('long text is split at sentence ends into 2 or 3 messages, nothing lost', () => {
        const long = 'Marble White is listed at Rs 1,850. We have it in stock right now. For a 10 x 12 ft room that is about 120 sq ft. With 10% extra for cuts you would need about 33 tiles. This is an estimate and our team will confirm the exact number. Would you like me to ask the team to prepare a quotation?';
        const parts = splitMessages(long);
        expect(parts.length).toBeGreaterThanOrEqual(2);
        expect(parts.length).toBeLessThanOrEqual(3);
        expect(parts.join(' ')).toBe(long);
        parts.forEach(p => expect(p.endsWith('.') || p.endsWith('?')).toBe(true));
    });
    test('never more than 3 parts, even for very long text', () => {
        const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
        expect(splitMessages(long).length).toBe(3);
    });
    test('a decimal or an amount does not split a sentence', () => {
        const t = 'The tile is 2.5 mm thick and priced at Rs 1,850.50 per unit on our list. ' + 'Padding sentence goes here for length. '.repeat(6);
        expect(splitMessages(t).join(' ')).toBe(t.trim());
        expect(splitMessages(t).some(p => /2\.$/.test(p))).toBe(false);
    });
    test('typing delay is 1 to 4 seconds by length, and 0 when off', () => {
        expect(typingDelayMs('ok', { min: 1000, max: 4000 })).toBe(1000);
        expect(typingDelayMs('x'.repeat(1000), { min: 1000, max: 4000 })).toBe(4000);
        const mid = typingDelayMs('x'.repeat(60), { min: 1000, max: 4000 });
        expect(mid).toBeGreaterThan(1000); expect(mid).toBeLessThan(4000);
        expect(typingDelayMs('hello', false)).toBe(0);
        expect(typingDelayMs('hello', null)).toBe(0);
    });
});

describe('LAYLA v2 phrases', () => {
    test('every phrase has all five styles', () => {
        for (const [k, v] of Object.entries(PHRASES)) for (const s of STYLES) expect([k, s, (v[s] || []).length > 0]).toEqual([k, s, true]);
    });
    test('Sinhala and Tamil phrases are in their own script, Singlish and Tanglish are in English letters', () => {
        const p = { n: 'Nimal', name: 'Marble White', price: 'Rs 1,850', size: '24x24', names: 'A, B', addr: 'Colombo', room: '10 x 12 ft', sqft: 120, waste: 10, tiles: 33, of: '' };
        for (const k of Object.keys(PHRASES)) {
            expect(render(k, 'si', p)).toMatch(/[\u0D80-\u0DFF]/);
            expect(render(k, 'ta', p)).toMatch(/[\u0B80-\u0BFF]/);
            expect(render(k, 'singlish', p)).not.toMatch(/[\u0D80-\u0DFF\u0B80-\u0BFF]/);
            expect(render(k, 'tanglish', p)).not.toMatch(/[\u0D80-\u0DFF\u0B80-\u0BFF]/);
        }
    });
    test('no "As an AI", no markdown lists or bullets in any phrase', () => {
        const p = { n: 'Nimal', name: 'X', price: 'Rs 1', size: '1x1', names: 'A, B', addr: 'Y', room: '1 x 1 ft', sqft: 1, waste: 10, tiles: 1, of: '' };
        for (const k of Object.keys(PHRASES)) for (const s of STYLES) {
            const t = render(k, s, p);
            expect(t).not.toMatch(/as an ai|language model|^\s*[-*•]\s|^\s*\d+\.\s/im);
        }
    });
    test('rendering avoids a recently used variant and is repeatable with a fixed rng', () => {
        const first = render('greet', 'en', {}, { rng: () => 0 });
        const next = render('greet', 'en', {}, { rng: () => 0, avoid: [first] });
        expect(next).not.toBe(first);
        expect(render('greet', 'en', {}, { rng: () => 0 })).toBe(first);
        expect(() => render('nope', 'en')).toThrow();
    });
    test('emoji only on request and only for friendly keys', () => {
        expect(render('greet', 'en', {}, { rng: () => 0, emoji: false })).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
        expect(render('greet', 'en', {}, { rng: () => 0, emoji: true })).toMatch(/[\u{1F300}-\u{1FAFF}]/u);
        expect(render('complaint', 'en', {}, { rng: () => 0, emoji: true })).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    });
    test('every phrase passes the customer guard (with its own price allowed)', () => {
        const p = { n: 'Nimal', name: 'Marble White', price: 'Rs 1,850', size: '24x24', names: 'A, B', addr: '12 Galle Road', room: '10 x 12 ft', sqft: 120, waste: 10, tiles: 33, of: ' (Marble White)' };
        for (const k of Object.keys(PHRASES)) for (const s of STYLES) {
            const r = checkCustomerReply(render(k, s, p), { prices: [1850] });
            expect([k, s, r.ok]).toEqual([k, s, true]);
        }
    });
});

describe('LAYLA v2 guard (last safety check)', () => {
    const bad = [
        ['our profit this month is high', 'books'], ['the supplier is X', 'books'], ['Rs 9,999 only', 'amount'], ['LKR 500 per box', 'amount'],
        ['we open daily from 9', 'hours'], ['open on Sunday', 'hours'], ['we are open 9 am to 6 pm', 'hours'], ['delivery within 3 days', 'time'], ['delivery in 2-3 days', 'time'],
        ['free delivery for you', 'promise'], ['I can give 10% off', 'promise'], ['2 years warranty', 'promise'], ['we guarantee it', 'promise'], ['cheque is due', 'books'],
    ];
    test.each(bad)('blocks: %s', t => expect(checkCustomerReply(t, { prices: [1850] }).ok).toBe(false));
    test('allows a database price, with or without comma formatting', () => {
        expect(checkCustomerReply('It is listed at Rs 1,850.', { prices: [1850] }).ok).toBe(true);
        expect(checkCustomerReply('It is listed at Rs 1850.', { prices: ['1,850'] }).ok).toBe(true);
        expect(checkCustomerReply('It is listed at Rs 1,850.', { prices: [] }).ok).toBe(false);
    });
    test('plain friendly text and empty text', () => {
        expect(checkCustomerReply('Let me check that and come back to you.').ok).toBe(true);
        expect(checkCustomerReply('  ').ok).toBe(false);
    });
});