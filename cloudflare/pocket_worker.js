// Free Cloudflare Worker: a mailbox for ONE locked (encrypted) shop snapshot. It never sees the passcode or the shop numbers.
// Setup (once): Cloudflare dashboard > Workers & Pages > Create Worker > paste this file > Settings > Variables:
//   PUSH_SECRET (long random text, the shop PC uses it to post), READ_TOKEN (long random text, the phone uses it to read);
//   KV namespace binding named SNAP.
//   POST_LIMIT: none needed. The snapshot is replaced each time, max 64 KB.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, X-Read-Token, Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS' };
const same = (a, b) => { a = String(a || ''); b = String(b || ''); if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const out = (body, status = 200, extra = {}) => new Response(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store', ...extra } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return out(null, 204);
    if (url.pathname !== '/snap') return out('not found', 404);
    if (request.method === 'PUT') {
      if (!env.PUSH_SECRET || !same(request.headers.get('Authorization'), `Bearer ${env.PUSH_SECRET}`)) return out('forbidden', 403);
      const raw = await request.text();
      if (raw.length > 65536) return out('too big', 413);
      try { const j = JSON.parse(raw); if (!j || j.v !== 1 || !j.ct || !j.iv || !j.salt) throw new Error('bad'); } catch (_) { return out('bad snapshot', 400); }
      await env.SNAP.put('snap', raw);
      await env.SNAP.put('snap_at', String(Date.now()));
      return out('ok');
    }
    if (request.method === 'GET') {
      if (!env.READ_TOKEN || !same(request.headers.get('X-Read-Token'), env.READ_TOKEN)) return out('forbidden', 403);
      const raw = await env.SNAP.get('snap');
      if (!raw) return out('empty', 404);
      return out(raw, 200, { 'Content-Type': 'application/json', 'X-Snap-At': (await env.SNAP.get('snap_at')) || '' });
    }
    return out('method not allowed', 405);
  },
};
