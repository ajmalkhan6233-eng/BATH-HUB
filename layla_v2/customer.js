'use strict';
// The CUSTOMER side of LAYLA v2. A customer can only ever get: product facts read from the database, tile maths,
// a polite "let me check" (which opens a staff task), or a hand-over to a person. No finance data is reachable from here.
const { detectLanguage, usesEmoji } = require('./lang');
const { classify, cleanProfileName } = require('./intent');
const { render } = require('./phrases');
const { checkCustomerReply } = require('./guard');
const { canonicalize } = require('./glossary');
const { calcTiles, parseTileSize, parseRoomSize } = require('./quote');
const { fmtRs } = require('./catalog');
const { getConvo, sendTexts, alertOwners, snippet } = require('./core');

const MEDIA_TYPES = new Set(['image', 'audio', 'video', 'document', 'sticker', 'voice', 'ptt', 'location']);
const sizeToText = key => String(key).replace('x', ' x ') + ' in';

// "10 x 12 ft ... 24 x 24 in": the tile size is the "N x M" that is not the room.
function extractTileSize(text, room) {
    const re = /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(inches|inch|in|"|cm|mm|ft)?/gi;
    for (const m of String(text).matchAll(re)) {
        const a = +m[1], b = +m[2], unit = m[3];
        const isRoom = room && ((a === room.length && b === room.width) || (a === room.width && b === room.length)) && !/^(in|inch|inches|"|cm|mm)$/i.test(unit || '');
        if (!isRoom && parseTileSize(m[0])) return m[0];
    }
    return null;
}

async function customerTurn(ctx, msg) {
    const { store, catalog } = ctx;
    const from = String(msg.from).replace(/\D/g, '');
    const text = String(msg.text || '').trim().slice(0, 1000);
    const type = String(msg.type || 'text').toLowerCase();
    const isMedia = MEDIA_TYPES.has(type) && !text;
    if (!text && !isMedia) return { handled: true, role: 'customer', intent: 'empty', replies: [], tasks: [] };

    const history = await store.recentMessages(from, 20);
    const cust = (await store.getCustomer(from)) || {};
    const lastInLang = [...history].reverse().find(h => h.direction === 'in' && h.lang);
    const prevStyle = cust.lang || (lastInLang && lastInLang.lang) || null;
    const style = isMedia ? (prevStyle || 'en') : detectLanguage(text, prevStyle).style;
    const emoji = usesEmoji(text) || history.some(h => h.direction === 'in' && usesEmoji(h.body));
    const state = getConvo(ctx, from);
    const pending = state.pending, pdata = state.data;
    state.pending = null; state.data = null;

    let name = cust.name || cleanProfileName(msg.name) || null;
    const avoid = history.filter(h => h.direction === 'out').slice(-8).map(h => h.body);
    const say = (key, p = {}) => { const t = render(key, style, { n: name, ...p }, { rng: ctx.rng, avoid, emoji }); avoid.push(t); return t; };

    const searchText = text + ' ' + canonicalize(text);   // also the English shop words behind Sinhala/Tamil ones
    const parts = [], tasks = [], prices = [];
    const addTask = async (kind, summary, payload) => { const id = await store.createTask({ kind, phone: from, name, summary, payload }); tasks.push(id); return id; };
    const who = () => `${name || 'a customer'} (+${from})`;
    const handover = async (kind, label, phraseKey) => {
        const id = await addTask(kind, `${label}: "${snippet(text, 300)}"`);
        await alertOwners(ctx, `LAYLA: ${label}. ${who()} wrote: "${snippet(text)}". Task #${id}.`);
        parts.push(say(phraseKey));
    };

    await store.addMessage(from, 'in', isMedia ? `[${type}]` : text, style);
    await store.saveCustomer(from, { name, lang: style });   // remember who this is and which language they use

    const createDraft = async d => {
        const roomLabel = `${d.room.length} x ${d.room.width} ${d.room.unit === 'm' ? 'm' : 'ft'}`;
        const itemLabel = d.item ? d.item.name : `tile ${d.tileSize}`;
        const summary = `Quotation DRAFT for ${who()}: room ${roomLabel}, ${itemLabel}, about ${d.calc.tiles} tiles (${d.calc.sqft} sq ft + ${d.calc.wastePct}% waste). NOT SENT. Staff must check and approve.`;
        const payload = { status: 'draft', room: d.room, tileSize: d.tileSize, item: d.item ? { name: d.item.name, size: d.item.size, listed_price: d.item.price } : null, calc: d.calc, note: 'Listed price is per catalogue unit; staff must confirm unit and total.' };
        const id = await addTask('quotation_draft', summary, payload);
        await alertOwners(ctx, `LAYLA: quotation draft #${id} is ready for approval. ${summary}`);
        parts.push(say('quote_ack'));
    };

    const pickOne = found => (found.items.length === 1 || (found.items.length > 1 && found.scores[0] > found.scores[1])) ? found.items[0] : null;

    const quoteFlow = async (room, wantsQuote) => {
        const data = pdata && (pending === 'awaiting_room' || pending === 'awaiting_tile') ? pdata : {};
        room = room || data.room; wantsQuote = wantsQuote || data.wantsQuote;
        if (!room) { state.pending = 'awaiting_room'; state.data = { wantsQuote, item: data.item || null }; parts.push(say('ask_room')); return; }
        const found = await catalog.search(searchText);
        const item = pickOne(found) || data.item || state.lastItem || null;
        const tileSize = (item && item.size && sizeToText(item.size)) || extractTileSize(text, room) || data.tileSize || null;
        if (!tileSize) { state.pending = 'awaiting_tile'; state.data = { room, wantsQuote }; parts.push(say('ask_tile_size')); return; }
        const calc = calcTiles({ length: room.length, width: room.width, unit: room.unit, tileSize });
        if (!calc.ok || !calc.tiles) { state.pending = 'awaiting_room'; state.data = { wantsQuote }; parts.push(say('ask_room')); return; }
        if (item) state.lastItem = item;
        const roomLabel = `${room.length} x ${room.width} ${room.unit === 'm' ? 'm' : 'ft'}`;
        parts.push(say('tile_count', { room: roomLabel, sqft: calc.sqft, waste: calc.wastePct, tiles: calc.tiles, of: item ? ` (${item.name})` : '' }));
        const d = { room, item, calc, tileSize };
        if (wantsQuote) await createDraft(d);
        else { parts.push(say('quote_offer')); state.pending = 'quote_offer'; state.data = d; }
    };

    const productFlow = async (found, flags) => {
        let item = pickOne(found);
        if (!item && !found.items.length && !found.specific && state.lastItem && (flags.asksPrice || flags.asksStock || flags.asksSize)) item = state.lastItem;
        if (!item) {
            if (found.items.length > 1) { parts.push(say('multi', { names: found.items.map(i => i.name).join(', ') })); return; }
            if (!found.specific && !found.sizeAsked) { parts.push(say('ask_product')); return; }
            await addTask('unknown_fact', `Customer asked for an item that is not on the list: "${snippet(text, 300)}"`);
            parts.push(say('not_found'));
            return;
        }
        state.lastItem = item;
        const general = !flags.asksPrice && !flags.asksStock && !flags.asksSize;
        const bits = [];
        if (general) bits.push(say('item_found', { name: item.name }));
        if (flags.asksPrice || general) {
            if (item.price != null) { prices.push(item.price); bits.push(say('item_price', { name: item.name, price: fmtRs(item.price) })); }
            else if (flags.asksPrice) { bits.push(say('item_noprice', { name: item.name })); await addTask('unknown_fact', `No price on the list for "${item.name}". Customer asked: "${snippet(text, 200)}"`); }
        }
        if (flags.asksSize) {
            if (item.size) bits.push(say('size_line', { name: item.name, size: item.size.replace('x', ' x ') + ' in' }));
            else { bits.push(say('letcheck')); await addTask('unknown_fact', `Size of "${item.name}" is not on the list. Customer asked: "${snippet(text, 200)}"`); }
        }
        if (flags.asksStock || general) {
            if (item.inStock === true) bits.push(say('stock_in'));
            else if (item.inStock === false) { bits.push(say('stock_out')); await addTask('unknown_fact', `"${item.name}" is out of stock; customer asked when it will be back: "${snippet(text, 200)}"`); }
            else if (flags.asksStock) { bits.push(say('stock_unknown')); await addTask('unknown_fact', `Stock of "${item.name}" is not on the list. Customer asked: "${snippet(text, 200)}"`); }
        }
        parts.push(bits.join(' '));
    };

    let cls = isMedia ? { intent: 'media' } : classify(text, { pending });

    // A reply to "what is the room size / which tile?" continues the quotation even if the words look like something else.
    if ((pending === 'awaiting_room' || pending === 'awaiting_tile') && !['override', 'private', 'ai_question', 'complaint', 'refund', 'human', 'money'].includes(cls.intent)) {
        const room = parseRoomSize(text);
        if (room || pending === 'awaiting_tile') cls = { intent: 'quote', room, wantsQuote: false };
    }

    switch (cls.intent) {
        case 'media': await handover('handoff', `a ${type} was sent`, 'media'); break;
        case 'override': parts.push(say('refuse_override')); break;
        case 'private': parts.push(say('refuse_private')); break;
        case 'ai_question': parts.push(say('ai_honest')); state.pending = 'human_offer'; break;
        case 'affirm':
            if (cls.pending === 'quote_offer' && pdata && pdata.room) await createDraft(pdata);
            else if (cls.pending === 'human_offer') await handover('handoff', 'customer asked for a person', 'human');
            else parts.push(say('ask_product'));
            break;
        case 'negative': parts.push(say('thanks')); break;
        case 'human': await handover('handoff', 'customer asked to speak to a person', 'human'); break;
        case 'complaint': await handover('complaint', 'complaint', 'complaint'); break;
        case 'refund': await handover('refund', 'refund or return request', 'refund'); break;
        case 'money': await handover('money_owed', 'payment, balance or cheque question', 'money_matter'); break;
        case 'discount': {
            const cap = await catalog.discountCap();
            const capNote = cap == null ? 'no discount cap is set' : (cls.pct == null ? `the cap is ${cap}%, amount not stated` : (cls.pct > cap ? `ABOVE the ${cap}% cap` : `within the ${cap}% cap`));
            const item = state.lastItem ? ` about "${state.lastItem.name}"` : '';
            const id = await addTask('discount', `Discount request${cls.pct != null ? ` of ${cls.pct}%` : ''}${item} (${capNote}): "${snippet(text, 250)}"`);
            await alertOwners(ctx, `LAYLA: discount request${cls.pct != null ? ` (${cls.pct}%, ${capNote})` : ''} from ${who()}. Task #${id}.`);
            parts.push(say('discount'));
            break;
        }
        case 'unknown_fact':
            await addTask('unknown_fact', `Customer asked about ${cls.topic}: "${snippet(text, 300)}"`);
            parts.push(say('letcheck'));
            break;
        case 'quote': await quoteFlow(cls.room, cls.wantsQuote); break;
        case 'location': {
            const addr = await catalog.address();
            if (addr) parts.push(say('location', { addr }));
            else { await addTask('unknown_fact', `Customer asked for the showroom location and no address is saved: "${snippet(text, 200)}"`); parts.push(say('letcheck')); }
            break;
        }
        case 'product': await productFlow(await catalog.search(searchText), cls); break;
        case 'name':
            name = cls.name; await store.saveCustomer(from, { name, lang: style }); parts.push(say('name_ack', { n: name })); break;
        case 'thanks': parts.push(say('thanks')); break;
        case 'bye': parts.push(say('bye')); break;
        case 'greeting': parts.push(say('greet')); break;
        default: {
            const found = await catalog.search(searchText);
            if (found.specific && found.items.length) { await productFlow(found, { asksPrice: false, asksStock: false, asksSize: false }); break; }
            let modelText = null;
            if (ctx.model) {
                try { modelText = await ctx.model({ text, history, style }); } catch (e) { modelText = null; }
                // A model may chat, but it may not state a single number or sound like a promise: those come from the database only.
                if (modelText && (/\d/.test(modelText) || modelText.length > 300 || (style === 'si' && !/[\u0D80-\u0DFF]/.test(modelText)) || (style === 'ta' && !/[\u0B80-\u0BFF]/.test(modelText)))) modelText = null;
            }
            if (modelText) { parts.push(modelText); break; }
            if (/\?|\b(what|how|when|where|which|who|do you|can you|is there|are there|will|why)\b/i.test(text) || text.length >= 25) {
                await addTask('unknown_fact', `Customer asked something LAYLA could not answer from the database: "${snippet(text, 300)}"`);
                parts.push(say('letcheck'));
            } else parts.push(say('ask_product'));
        }
    }

    // Last safety check on everything that is about to be sent.
    let out = parts.filter(Boolean);
    for (const p of out) {
        const g = checkCustomerReply(p, { prices });
        if (!g.ok) {
            await addTask('unknown_fact', `LAYLA blocked its own reply (${g.reason}). Customer wrote: "${snippet(text, 250)}"`);
            out = [say('letcheck')];
            break;
        }
    }

    const sent = await sendTexts(ctx, from, out);
    for (const t of sent) await store.addMessage(from, 'out', t, style);
    return { handled: true, role: 'customer', intent: cls.intent, style, replies: sent, tasks };
}

module.exports = { customerTurn, extractTileSize };