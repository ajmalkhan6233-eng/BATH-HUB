'use strict';
// The OWNER / STAFF side of LAYLA v2 (numbers from the layla_contacts allow-list). Plain English commands:
//   pause LAYLA / resume LAYLA      owner only
//   status, tasks, task 5, done 5   owner + staff
//   send me today's report          owner only (documents module)
//   send quotation 12 [to Mr X 0771234567] / send invoice 101   owner + staff (documents module)
//   cheques due this week           owner + staff (old answer engine, read only)
//   net profit yesterday, sales for june, credit balance of X   owner only (old answer engine, read only)
//   stock marble white              owner + staff (price and stock from the catalogue)
// Staff never get profit, sales, loans, salary or balances. Finance answers come from scripts/layla_answer_engine.js, which is only CALLED.
const { normalizePhone } = require('./roles');
const { sendTexts, snippet } = require('./core');
const { fmtRs } = require('./catalog');

const HELP = 'You can say: today\'s report, cheques due this week, send quotation 12, send invoice 101, stock marble white, tasks, task 5, done 5, status, pause LAYLA, resume LAYLA.';
const OWNER_ONLY = 'Sorry, that one is for the owner only.';
const FINANCE = /\b(profit|np|gp|sales?|revenue|turnover|balance|outstanding|credit|loans?|salary|salaries|expenses?|net|gross)\b/i;
const PHONE = /(?:\+?94|0)\s?7\d[\s-]?\d{3}[\s-]?\d{4}\b/;

const DOC_REASON = {
    not_wired: 'The documents module is not connected to LAYLA yet, so I cannot send documents.',
    not_found: 'I could not find that document.',
    unsupported: 'I do not know how to make that kind of document yet.',
    error: 'Something went wrong while making that document.',
};

async function staffTurn(ctx, msg, role) {
    const { store } = ctx;
    const from = normalizePhone(msg.from);
    const text = String(msg.text || '').trim().slice(0, 500);
    const low = text.toLowerCase();
    const isOwner = role === 'owner';
    const replies = [];
    const reply = t => { replies.push(t); };

    // --- pause / resume (owner only; works even while paused) ---
    if (/^\s*(?:pause|stop)\s+layla\b|^\s*layla\s+(?:pause|stop)\b|^\s*pause\s*$/.test(low)) {
        if (!isOwner) reply(OWNER_ONLY);
        else { await store.setState('paused', 'true'); reply('LAYLA is paused. She will not reply to customers until you say "resume LAYLA". Customer messages are still saved.'); }
    } else if (/^\s*(?:resume|unpause|start)\s+layla\b|^\s*layla\s+(?:resume|start|on)\b|^\s*resume\s*$/.test(low)) {
        if (!isOwner) reply(OWNER_ONLY);
        else { await store.setState('paused', 'false'); reply('LAYLA is back on and will reply to customers again.'); }
    } else if (/^\s*(?:layla\s+)?status\s*$/.test(low)) {
        const paused = (await store.getState('paused')) === 'true';
        const open = (await store.listOpenTasks(100)).length;
        reply(`LAYLA is ${paused ? 'PAUSED' : 'on'}. Open tasks: ${open}.`);
    } else if (/^\s*(?:open\s+)?tasks?\s*$|^\s*(?:todo|pending\s+tasks?)\s*$/.test(low)) {
        const open = await store.listOpenTasks(10);
        if (!open.length) reply('No open tasks.');
        else reply(open.map(t => `#${t.id} ${t.kind}${t.phone ? ' (***' + String(t.phone).slice(-3) + ')' : ''}: ${snippet(t.summary, 90)}`).join('\n'));
    } else if (/^\s*(?:show\s+)?(?:task|draft)\s+#?(\d+)\s*$/.test(low)) {
        const t = await store.getTask(low.match(/(\d+)/)[1]);
        if (!t) reply('I cannot find that task.');
        else reply(`#${t.id} ${t.kind} (${t.status})${t.phone ? ' +' + t.phone : ''}${t.cust_name ? ' ' + t.cust_name : ''}\n${t.summary}${t.payload ? '\n' + snippet(t.payload, 400) : ''}`);
    } else if (/^\s*(?:done|close|closed|finish(?:ed)?)\s+(?:task\s+)?#?(\d+)\b/.test(low)) {
        const id = low.match(/(\d+)/)[1];
        reply((await store.closeTask(id, role)) ? `Task #${id} is closed.` : `I cannot find an open task #${id}.`);
    }
    // --- documents ---
    else if (/\bsend\b[^.\n]*\b(quotation|quote|invoice)\s*(?:no\.?|number|#)?\s*(\d+)/i.test(text)) {
        const m = text.match(/\b(quotation|quote|invoice)\s*(?:no\.?|number|#)?\s*(\d+)/i);
        const type = /^inv/i.test(m[1]) ? 'invoice' : 'quotation';
        await sendDoc(ctx, replies, from, { type, ref: m[2] }, text);
    } else if (/(?:today'?s?|todays|daily)\s+(?:report|summary)|report\s+for\s+today|send\s+me\s+(?:the\s+)?report/i.test(low)) {
        if (!isOwner) reply(OWNER_ONLY);
        else await sendDoc(ctx, replies, from, { type: 'daily_report', date: ctx.now().toISOString().slice(0, 10) }, text);
    } else if (/\bstock\s+report\b/.test(low)) {
        await sendDoc(ctx, replies, from, { type: 'stock_report' }, text);
    }
    // --- cheques (owner + staff), other money questions (owner only) ---
    else if (/\bcheques?\b|\bcheqs?\b|\bchq\b/.test(low)) {
        reply(await viaEngine(ctx, text.replace(/this\s+week/i, 'next 7 days')));
    } else if (FINANCE.test(low)) {
        reply(isOwner ? await viaEngine(ctx, text) : OWNER_ONLY);
    }
    // --- stock / price from the catalogue ---
    else if (/^\s*(?:stock|price)\b/.test(low)) {
        const found = await ctx.catalog.search(text.replace(/^\s*(?:stock|price)\s*(?:of|for)?\s*/i, ''));
        if (!found.items.length) reply('I cannot find that on the item list.');
        else reply(found.items.map(i => `${i.name}: ${i.price != null ? fmtRs(i.price) : 'no price on the list'}, ${i.inStock === true ? 'in stock' : i.inStock === false ? 'out of stock' : 'stock not on the list'}`).join('\n'));
    } else if (/^\s*(?:help|commands|\?)\s*$/.test(low)) {
        reply(HELP);
    } else {
        // Owner: anything else the old engine understands (item code, etc). Staff: help.
        const viaOld = isOwner && ctx.answerEngine ? await ctx.answerEngine(text).catch(() => null) : null;
        reply(viaOld && viaOld.reply ? viaOld.reply : 'Sorry, I did not get that. ' + HELP);
    }

    const sent = await sendTexts(ctx, from, replies, { delay: false });
    return { handled: true, role, intent: 'staff_command', replies: sent, tasks: [] };
}

async function viaEngine(ctx, text) {
    if (!ctx.answerEngine) return 'The business-question engine is not connected here.';
    try {
        const r = await ctx.answerEngine(text);
        return r && r.reply ? r.reply : 'I did not understand that question.';
    } catch (e) { return 'I could not look that up right now.'; }
}

async function sendDoc(ctx, replies, requester, req, text) {
    let doc;
    try { doc = await ctx.documents.getDocument(req); } catch (e) { doc = { ok: false, reason: 'error' }; }
    if (!doc || !doc.ok) { replies.push((DOC_REASON[doc && doc.reason] || DOC_REASON.error) + (req.ref ? ` (${req.type} ${req.ref})` : '')); return; }
    const pm = text.match(PHONE);
    const target = pm ? normalizePhone(pm[0]) : requester;
    const r = await ctx.transport.sendDocument(target, { buffer: doc.buffer, url: doc.url, mime: doc.mime, filename: doc.filename, caption: doc.caption }).catch(e => ({ ok: false, error: String(e.message || e) }));
    if (!r.ok) { replies.push('I made the document but could not send it: ' + (r.error || 'unknown error')); return; }
    const toMe = target === requester;
    const fm = text.match(/\bto\s+((?:mr|mrs|ms|miss|dr)\.?\s+[A-Za-z]+)/i) || text.match(/\bto\s+([A-Z][a-z]+)\b/);
    const forwardTo = fm && !/^(you|me|him|her|them)$/i.test(fm[1]) ? fm : null;
    replies.push(`Sent ${req.type.replace('_', ' ')}${req.ref ? ' ' + req.ref : ''}${toMe ? ' to you' : ' to ***' + target.slice(-3)}.` + (toMe && forwardTo ? ` I do not have ${forwardTo[1]}'s number, so please forward it, or send me the number and I will send it.` : ''));
}

module.exports = { staffTurn, HELP };