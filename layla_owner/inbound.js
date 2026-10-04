'use strict';
const { isOwner, LIMITS } = require('./ownerGate');
const { handleOwnerMessage } = require('./brain');
const { parseOwnerMessage } = require('./intentParser');
const { fmtLocal } = require('./timeParse');

/**
 * One inbound WhatsApp message from anyone. Strangers are ignored silently (nothing is revealed).
 * deps: { store, adapters, send(to,text), ownerNumber, download(mediaId)->{buffer,mime}, transcribe(buffer,mime)->{ok,text}, saveMedia(buffer,mime,kind)->string, rateLimit()->bool, now() }
 */
async function processInbound(m, deps) {
  const { store, adapters, send, ownerNumber, now = () => new Date() } = deps;
  if (!isOwner(m.from, ownerNumber)) { await store.remember(m.id, 'in', 'blocked', ''); return { status: 'ignored' }; }
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
      text = t.text.slice(0, LIMITS.maxTextChars); heard = `I heard: "${text}"\n`;
    } else if (m.type === 'image' || m.type === 'document') {
      const media = await deps.download(m.mediaId); const file = await deps.saveMedia(media.buffer, media.mime || m.mime, m.type);
      const cap = String(m.caption || '').slice(0, 500); const it = cap ? parseOwnerMessage(cap, now()) : { type: 'UNKNOWN' };
      if (['PENDING_BILL', 'CHEQUE_NOTE', 'REMIND'].includes(it.type)) { const r = await handleOwnerMessage({ id: m.id, text: cap }, { store, adapters, now }); await reply(`Saved the ${m.type}. ${r.reply}`); return { status: 'ok', file }; }
      const t = await store.create({ kind: 'PHOTO_REVIEW', title: `Review the ${m.type} you sent${cap ? `: ${cap}` : ''} (${file})`, dueAt: now(), nagEveryMin: 120, maxNags: 1, sourceMsgId: m.id });
      await reply(`Saved the ${m.type}. Reading bills from photos is not switched on yet, so I made task #${t.id} to review it. Add a caption like "Eskema bill 213200 pending" and I will remind you.`);
      return { status: 'ok', file };
    } else { await reply('I can read text, voice notes and photos.'); return { status: 'unsupported' }; }
  } catch (e) { console.error('[layla-owner] inbound error:', e.message); await reply('Something went wrong on my side. Please try again.'); return { status: 'error' }; }
  const r = await handleOwnerMessage({ id: m.id, text }, { store, adapters, now });
  await reply(heard + r.reply);
  return { status: 'ok', intent: r.intent.type };
}
module.exports = { processInbound };
