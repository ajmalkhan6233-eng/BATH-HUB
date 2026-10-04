// Free Cloudflare Worker: catches Meta's WhatsApp webhook and keeps it in a queue (KV) until the shop computer collects it.
// Setup (owner, once): Cloudflare dashboard > Workers & Pages > Create Worker > paste this file > Settings > Variables:
//   VERIFY_TOKEN (any text you choose), APP_SECRET (Meta app secret), PULL_SECRET (long random text) ; KV namespace binding named Q.
// Then in Meta > WhatsApp > Configuration: Callback URL = https://<your-worker>.workers.dev/webhook , Verify token = VERIFY_TOKEN, subscribe to "messages".
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function validSignature(raw, header, secret) {
  if (!header || !header.startsWith('sha256=') || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const got = header.slice(7); if (got.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ got.charCodeAt(i); return diff === 0;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/webhook' && request.method === 'GET') {
      return url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env.VERIFY_TOKEN ? new Response(url.searchParams.get('hub.challenge')) : new Response('forbidden', { status: 403 });
    }
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const raw = await request.text();
      if (raw.length > 200000 || !(await validSignature(raw, request.headers.get('X-Hub-Signature-256'), env.APP_SECRET))) return new Response('forbidden', { status: 403 });
      await env.Q.put(`m:${Date.now()}:${crypto.randomUUID()}`, raw, { expirationTtl: 60 * 60 * 24 * 3 });   // kept 3 days
      return new Response('ok');
    }
    if (request.headers.get('Authorization') !== `Bearer ${env.PULL_SECRET}` || !env.PULL_SECRET) return new Response('forbidden', { status: 403 });
    if (url.pathname === '/pull') {
      const list = await env.Q.list({ prefix: 'm:', limit: 20 }); const items = [];
      for (const k of list.keys) items.push({ key: k.name, body: await env.Q.get(k.name) });
      return Response.json({ items });
    }
    if (url.pathname === '/ack' && request.method === 'POST') { const { keys = [] } = await request.json(); for (const k of keys.slice(0, 50)) if (String(k).startsWith('m:')) await env.Q.delete(k); return new Response('ok'); }
    return new Response('not found', { status: 404 });
  },
};
