// Free Cloudflare Worker: a mailbox for ONE locked (encrypted) shop snapshot. It never sees the passcode or the shop numbers.
// Setup (once): Cloudflare dashboard > Workers & Pages > Create Worker > paste this file > Settings > Variables:
//   PUSH_SECRET (long random text, the shop PC uses it to post), READ_TOKEN (long random text, the phone uses it to read);
//   KV namespace binding named SNAP.
//   POST_LIMIT: none needed. The snapshot is replaced each time, max 256 KB.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, X-Read-Token, Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS' };
const same = (a, b) => { a = String(a || ''); b = String(b || ''); if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const out = (body, status = 200, extra = {}) => new Response(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store', ...extra } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return out(null, 204);
    // ---- v3: locked inbox (phone to shop PC) and outbox (shop PC to phone). Everything in them is locked with the passcode; the cloud sees nothing. ----
    const isPc = () => env.PUSH_SECRET && same(request.headers.get('Authorization'), `Bearer ${env.PUSH_SECRET}`);
    const isPhone = () => env.READ_TOKEN && same(request.headers.get('X-Read-Token'), env.READ_TOKEN);
    const okSealed = (raw) => { try { const j = JSON.parse(raw); return !!(j && j.v === 1 && j.ct && j.iv && j.salt); } catch (_) { return false; } };
    if (url.pathname === '/inbox') {
      if (request.method === 'POST') {                       // phone drops one locked command (max 20 waiting, 64 KB each)
        if (!isPhone()) return out('forbidden', 403);
        const raw = await request.text(); if (raw.length > 65536 || !okSealed(raw)) return out('bad command', 400);
        let box = []; try { box = JSON.parse((await env.SNAP.get('inbox')) || '[]'); } catch (_) {}
        if (box.length >= 20) return out('inbox full', 429);
        box.push(JSON.parse(raw)); await env.SNAP.put('inbox', JSON.stringify(box)); return out('ok');
      }
      if (request.method === 'GET') {                        // shop PC reads what is waiting
        if (!isPc()) return out('forbidden', 403);
        return out((await env.SNAP.get('inbox')) || '[]', 200, { 'Content-Type': 'application/json' });
      }
    }
    if (url.pathname === '/inbox/ack' && request.method === 'POST') {   // shop PC removes the ones it has taken: {"n": how many from the front}
      if (!isPc()) return out('forbidden', 403);
      let n = 0; try { n = Math.max(0, Math.min(20, Number((await request.json()).n) || 0)); } catch (_) {}
      let box = []; try { box = JSON.parse((await env.SNAP.get('inbox')) || '[]'); } catch (_) {}
      await env.SNAP.put('inbox', JSON.stringify(box.slice(n))); return out('ok');
    }
    const m = url.pathname.match(/^\/out\/([A-Za-z0-9_-]{8,64})$/);
    if (m) {
      if (request.method === 'PUT') {                        // shop PC leaves the locked answer (receipt picture etc.), kept 1 day
        if (!isPc()) return out('forbidden', 403);
        const raw = await request.text(); if (raw.length > 1000000 || !okSealed(raw)) return out('bad answer', 400);
        await env.SNAP.put('out:' + m[1], raw, { expirationTtl: 86400 }); return out('ok');
      }
      if (request.method === 'GET') {
        if (!isPhone()) return out('forbidden', 403);
        const raw = await env.SNAP.get('out:' + m[1]); if (!raw) return out('waiting', 404);
        return out(raw, 200, { 'Content-Type': 'application/json' });
      }
    }
    if (url.pathname !== '/snap') return out('not found', 404);
    if (request.method === 'PUT') {
      if (!env.PUSH_SECRET || !same(request.headers.get('Authorization'), `Bearer ${env.PUSH_SECRET}`)) return out('forbidden', 403);
      const raw = await request.text();
      if (raw.length > 262144) return out('too big', 413);
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
