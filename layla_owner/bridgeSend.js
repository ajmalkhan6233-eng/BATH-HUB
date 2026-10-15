'use strict';
/** Free transport: sends through the linked-device WhatsApp bridge (whatsapp-bridge.js, POST /send). Same signature as waCloud.sendText. */
const { last3 } = require('./settings');
async function bridgeSendText(to, text, cfg, fetchFn = fetch) {
  const body = String(text).slice(0, 4000);
  if (!cfg.live) { console.log(`[layla-owner DRY RUN] to ${last3(to)}: ${body.slice(0, 80).replace(/\n/g, ' ')}`); return { dryRun: true }; }
  const r = await fetchFn(cfg.bridgeUrl || 'http://localhost:3001/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: String(to).replace(/\D/g, ''), message: body }) });
  if (!r.ok) throw new Error(`WhatsApp bridge send failed: HTTP ${r.status}`);
  return r.json();
}
module.exports = { bridgeSendText };
