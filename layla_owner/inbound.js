'use strict';
const { isOwner, LIMITS } = require('./ownerGate');
const { handleOwnerMessage } = require('./brain');
const { parseOwnerMessage } = require('./intentParser');
const { fmtLocal } = require('./timeParse');

/**
 * One inbound WhatsApp message from anyone. Strangers are ignored silently (nothing is revealed).
 * deps: { store, adapters, send(to,text), ownerNumber, download(mediaId)->{buffer,mime}, transcribe(buffer,mime)->{ok,text}, saveMedia(buffer,mime,kind)->string, rateLimit()->bool, now() }
 */
// A photo sent with NO caption is held for 10 minutes. The next text "GRN" or "cheque" turns it into a draft (WhatsApp shows photo and text as two messages).
const HOLD_MS = 10 * 60 * 1000; let heldPhoto = null;
async function processInbound(m, deps) {
  const { store, adapters, send, ownerNumber, now = () => new Date() } = deps;
  if (!isOwner(m.from, ownerNumber) && deps.family && deps.family.isMember(m.from)) {
    // FAMILY MODE: reminders and notes only, no shop data. Her words are never written to the shared message log (body stays empty).
    if (deps.familyRateLimit && !deps.familyRateLimit()) return { status: 'rate_limited' };
    if (!(await store.remember(m.id, 'in', 'family', ''))) return { status: 'duplicate' };
    let out;
    try { out = m.type === 'text' ? await deps.family.handle(m) : 'I can read text messages only.'; }
    catch (e) { console.error('[layla-family] error:', e.message); out = 'Something went wrong on my side. Please try again.'; }
    await send(m.from, out);
    return { status: 'family' };
  }
  if (!isOwner(m.from, ownerNumber)) {
    await store.remember(m.id, 'in', 'blocked', '');
    const c = deps.customer ? await deps.customer(m).catch(() => null) : null;                    // customer chats: dry run only, nothing is ever sent
    return c ? { status: 'ignored', customer: c } : { status: 'ignored' };
  }
  if (deps.rateLimit && !deps.rateLimit()) return { status: 'rate_limited' };
  const fresh = await store.remember(m.id, 'in', m.type, m.text || m.caption || '');
  if (!fresh) return { status: 'duplicate' };
  const reply = async (text) => { await store.remember(null, 'out', 'text', text); await send(m.from, text); };
  let text = ''; let heard = '';
  try {
    if (m.type === 'text') text = String(m.text || '').slice(0, LIMITS.maxTextChars);
    else if (m.type === 'audio') {
      const media = await deps.download(m.mediaId);
      const t = await deps.transcribe(media.buffer, media.mime || m.mime);
      if (!t.ok) { await reply('I could not hear that clearly. Please send it again or type it.'); return { status: 'transcribe_failed' }; }
      text = t.text.slice(0, LIMITS.maxTextChars); heard = t.original && t.original !== t.text ? `I heard: "${t.original.slice(0, 600)}"\n(in English: "${text}")\n` : `I heard: "${text}"\n`;
      // A dictated day's expenses or sales -> a Document Inbox DRAFT. Never filed here: the owner checks it in the app and presses Confirm.
      const KINDS = ['expense_list', 'day_sheet', 'credit_given', 'credit_paid', 'customer_create'];
      const found = (t.entries && t.entries.length ? t.entries : (t.entry ? [t.entry] : [])).filter((e) => e && KINDS.includes(e.kind));
      if (deps.voiceDraft && found.length) {
        const lines = [heard.trim()]; let firstId = null; const drafted = [];
        for (const entry of found) {   // one voice note can hold expenses AND a loan: one draft each
          const d = await deps.voiceDraft({ entry, buffer: media.buffer, mime: media.mime || m.mime, original: t.original || t.text, english: t.text, warnings: t.warnings, confidence: t.confidence, from: m.from, engine: t.engine });
          if (firstId == null) firstId = d.id; drafted.push(d);
          const lab = deps.inboxCmd ? deps.inboxCmd.label(d) : `${entry.kind} ${entry.party || ''} Rs ${Number(entry.total_expenses || entry.total_sale || entry.amount || 0).toLocaleString('en-LK')}`;
          lines.push(`Draft: ${lab}.`);
        }
        lines.push('NOTHING is filed yet.');
        if (t.warnings && t.warnings.length) lines.push('! ' + t.warnings.join(' '));
        if (t.confidence && t.confidence !== 'high') lines.push('! I am not fully sure I heard it right. If a name or number is wrong, reply "cancel" and say it again, or "edit amount 600".');
        lines.push(drafted.length > 1 ? 'Reply "ok all" to file all, or say a name: "ok saman", "ok expenses". "cancel" drops the latest, "edit amount 600" changes it. Or use the Document Inbox in the app.' : 'Reply "ok" to file it, "cancel" to drop it, or "edit amount 600". Or use the Document Inbox in the app.');
        await reply(lines.join('\n')); return { status: 'ok', intent: 'voice_draft', draftId: firstId };
      }
    } else if (m.type === 'image' || m.type === 'document') {
      const paperKind = deps.paper && m.type === 'image' ? deps.paper.captionKind(m.caption) : null;   // caption "GRN" or "cheque": read into a DRAFT, saved only on "ok"
      const cap = String(m.caption || '').slice(0, 500); const it = cap ? parseOwnerMessage(cap, now()) : { type: 'UNKNOWN' };
      if (deps.paper && m.type === 'image' && !cap && !paperKind) {   // no caption at all: keep the photo and ask what it is
        const media0 = await deps.download(m.mediaId); const file0 = await deps.saveMedia(media0.buffer, media0.mime || m.mime, m.type);
        heldPhoto = { file: file0, at: Date.now() };
        await reply('Got the photo. What is it? Reply GRN or CHEQUE within 10 minutes (or send it again with the word under it).');
        return { status: 'ok', file: file0, intent: 'photo_held' };
      }
      // ONE LAYLA: a photo this assistant has no job for (no GRN/cheque caption, no bill/cheque/reminder words) goes on to the original Layla's photo pipeline (day and expense sheets).
      if (deps.fallbackOriginal && m.type === 'image' && !paperKind && !['PENDING_BILL', 'CHEQUE_NOTE', 'REMIND'].includes(it.type)) return { status: 'fallback_photo' };
      const media = await deps.download(m.mediaId); const file = await deps.saveMedia(media.buffer, media.mime || m.mime, m.type);
      if (paperKind) { const p = await deps.paper.start(paperKind, file, cap); await reply(p.reply); return { status: 'ok', file, intent: 'paper_draft' }; }
      if (['PENDING_BILL', 'CHEQUE_NOTE', 'REMIND'].includes(it.type)) { const r = await handleOwnerMessage({ id: m.id, text: cap }, { store, adapters, now }); await reply(`Saved the ${m.type}. ${r.reply}`); return { status: 'ok', file }; }
      const t = await store.create({ kind: 'PHOTO_REVIEW', title: `Review the ${m.type} you sent${cap ? `: ${cap}` : ''} (${file})`, dueAt: now(), nagEveryMin: 120, maxNags: 1, sourceMsgId: m.id });
      await reply(`Saved the ${m.type}. Reading bills from photos is not switched on yet, so I made task #${t.id} to review it. Add a caption like "Eskema bill 213200 pending" and I will remind you.`);
      return { status: 'ok', file };
    } else { await reply('I can read text, voice notes and photos.'); return { status: 'unsupported' }; }
  } catch (e) { console.error('[layla-owner] inbound error:', e.message); await reply('Something went wrong on my side. Please try again.'); return { status: 'error' }; }
  if (heldPhoto && m.type === 'text' && deps.paper) {   // the word that follows a captionless photo
    const kind = deps.paper.captionKind(text);
    if (kind && Date.now() - heldPhoto.at <= HOLD_MS) {
      const h = heldPhoto; heldPhoto = null;
      try { const p = await deps.paper.start(kind, h.file, text); await reply(p.reply); return { status: 'ok', file: h.file, intent: 'paper_draft' }; }
      catch (e) { console.error('[layla-owner] held photo:', e.message); await reply('Something went wrong reading that photo. Please send it again with GRN under it.'); return { status: 'error' }; }
    }
    if (Date.now() - heldPhoto.at > HOLD_MS) heldPhoto = null;
  }
  if (deps.fallbackOriginal && m.type === 'text' && /^\s*teach\s*:/i.test(text)) return { status: 'fallback' };   // ONE LAYLA: "TEACH: <fact>" is the original Layla's permanent-fact command
  if (deps.inboxCmd && deps.inboxCmd.handle && (m.type === 'text' || m.type === 'audio')) {   // reply to a draft from WhatsApp: ok / cancel / edit / create customer (owner only: we are past the owner check)
    const c = await deps.inboxCmd.handle(text, { from: m.from, paperPending: deps.paper ? await deps.paper.hasPending().catch(() => false) : false }).catch((e) => { console.error('[layla-owner] inbox command:', e.message); return null; });
    if (c) { await reply(heard + c.reply); return { status: 'ok', intent: 'inbox_cmd' }; }
  }
  if (deps.paper) { const p = await deps.paper.handleText(text).catch((e) => { console.error('[layla-owner] paper intake:', e.message); return null; }); if (p) { await reply(p.reply); return { status: 'ok', intent: 'paper_reply' }; } }
  const r = await handleOwnerMessage({ id: m.id, text }, { store, adapters, now });
  if (deps.fallbackOriginal && m.type === 'text' && r.intent.type === 'UNKNOWN') return { status: 'fallback' };    // ONE LAYLA: anything this assistant does not understand goes to the original Layla
  await reply(heard + r.reply);
  return { status: 'ok', intent: r.intent.type };
}
module.exports = { processInbound, _resetHeldPhoto: () => { heldPhoto = null; } };
