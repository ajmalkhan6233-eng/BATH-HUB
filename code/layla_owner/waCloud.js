'use strict';
/** WhatsApp Cloud API helpers (official, free test number works for up to 5 verified recipients). No token is ever logged. */
const API = 'https://graph.facebook.com';
function parseWebhook(body) {
  const out = [];
  for (const e of (body && body.entry) || []) for (const c of e.changes || []) for (const m of (c.value && c.value.messages) || []) {
    const base = { id: m.id, from: m.from, type: m.type, ts: Number(m.timestamp) || 0 };
    if (m.type === 'text') out.push({ ...base, text: m.text && m.text.body });
    else if (m.type === 'audio') out.push({ ...base, mediaId: m.audio && m.audio.id, mime: m.audio && m.audio.mime_type });
    else if (m.type === 'image') out.push({ ...base, mediaId: m.image && m.image.id, mime: m.image && m.image.mime_type, caption: m.image && m.image.caption });
    else if (m.type === 'document') out.push({ ...base, mediaId: m.document && m.document.id, mime: m.document && m.document.mime_type, caption: m.document && (m.document.caption || m.document.filename) });
    else out.push({ ...base, text: '' });
  }
  return out;
}
const cfgFromEnv = (env = process.env) => ({ token: env.WA_TOKEN, phoneId: env.WA_PHONE_NUMBER_ID, version: env.WA_API_VERSION || 'v21.0', live: env.LAYLA_OWNER_LIVE === 'true' });
async function sendText(to, text, cfg, fetchFn = fetch) {
  const body = String(text).slice(0, 4000);
  if (!cfg.live) { console.log(`[layla-owner DRY RUN] to ...${String(to).slice(-3)}: ${body.slice(0, 80).replace(/\n/g, ' ')}`); return { dryRun: true }; }
  if (!cfg.token || !cfg.phoneId) throw new Error('WA_TOKEN or WA_PHONE_NUMBER_ID missing');
  const r = await fetchFn(`${API}/${cfg.version}/${cfg.phoneId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }) });
  if (!r.ok) throw new Error(`WhatsApp send failed: HTTP ${r.status}`);
  return r.json();
}
/** Two steps: media id -> temporary URL -> bytes (the URL needs the token too and expires in minutes). */
async function downloadMedia(mediaId, cfg, maxBytes, fetchFn = fetch) {
  const meta = await fetchFn(`${API}/${cfg.version}/${mediaId}`, { headers: { Authorization: `Bearer ${cfg.token}` } });
  if (!meta.ok) throw new Error(`media lookup failed: HTTP ${meta.status}`);
  const info = await meta.json();
  if (info.file_size && info.file_size > maxBytes) throw new Error('media too large');
  const f = await fetchFn(info.url, { headers: { Authorization: `Bearer ${cfg.token}` } });
  if (!f.ok) throw new Error(`media download failed: HTTP ${f.status}`);
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('media too large');
  return { buffer: buf, mime: info.mime_type };
}
module.exports = { parseWebhook, cfgFromEnv, sendText, downloadMedia };
