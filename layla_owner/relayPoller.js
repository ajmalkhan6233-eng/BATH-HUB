'use strict';
const { parseWebhook } = require('./waCloud');
/**
 * The laptop sits behind the router, so Meta cannot reach it. A free Cloudflare Worker (cloudflare/worker.js) catches Meta's webhook and queues it;
 * this poller pulls the queue (outbound request only, works with any internet), handles each message, then acknowledges. If the laptop was off,
 * queued messages are handled when it starts. Run poll every 20 seconds.
 */
async function pollOnce({ url, secret, fetchFn = fetch, handle }) {
  const r = await fetchFn(`${url}/pull`, { headers: { Authorization: `Bearer ${secret}` } });
  if (!r.ok) throw new Error(`pull failed: HTTP ${r.status}`);
  const { items = [] } = await r.json(); const ack = [];
  for (const it of items) {
    let ok = true;
    try { for (const m of parseWebhook(JSON.parse(it.body))) await handle(m); } catch (e) { ok = false; console.error('[layla-owner] relay item failed:', e.message); }
    if (ok) ack.push(it.key);
  }
  if (ack.length) await fetchFn(`${url}/ack`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: ack }) });
  return { pulled: items.length, acked: ack.length };
}
module.exports = { pollOnce };
