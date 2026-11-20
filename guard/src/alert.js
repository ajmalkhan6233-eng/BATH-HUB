'use strict';
// ALERTS: written to a local queue FIRST (so nothing is lost if WhatsApp is down), then sent with the app's own WhatsApp sender
// (utils/whatsappBusinessApi.js; it stays silent until the owner has put the WhatsApp keys in .env). Unsent lines are retried at the next run.
const fs = require('fs'); const path = require('path');
const OUT = process.env.GUARD_OUT || path.join(__dirname, '..', 'out');
const Q = () => path.join(OUT, 'alerts.queue.jsonl');
function appSender() { try { return require(path.join(process.env.GUARD_APP_DIR || path.join(__dirname, '..', '..'), 'utils', 'whatsappBusinessApi.js')); } catch (e) { return null; } }
function pending() { try { return fs.readFileSync(Q(), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (e) { return []; } }
async function send(text) {
  fs.mkdirSync(OUT, { recursive: true });
  const all = pending(); all.push({ at: new Date().toISOString(), text, sent: false });
  const s = appSender(); let sentAny = false;
  if (s && s.isEnabled && s.isEnabled()) {
    for (const a of all) { if (a.sent) continue; const r = await s.sendWhatsAppAlert(a.text); if (r && r.sent) { a.sent = true; sentAny = true; } else break; }
  }
  fs.writeFileSync(Q(), all.slice(-200).map((a) => JSON.stringify(a)).join('\n') + '\n');
  return { queued: true, sent: sentAny, waiting: all.filter((a) => !a.sent).length };
}
module.exports = { send, pending };
