'use strict';
/**
 * FIX 2 (7 Nov 2026 audit): stop a bad website from making a logged-in browser act on RBH.
 * Rule: a state-changing request (POST/PUT/PATCH/DELETE) that carries the login cookie AND an Origin header
 * from a different site is refused (403). No Origin header (own pages, scripts, webhooks) = allowed. Public forms have no login cookie = allowed.
 * Extra trusted sites: env ALLOWED_ORIGINS="https://a.com,https://b.com". Cookie name default connect.sid.
 */
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
function hostOf(u) { try { return new URL(u).host.toLowerCase(); } catch (e) { return null; } }

function csrfGuard({ cookieName = 'connect.sid', allowed = process.env.ALLOWED_ORIGINS || '' } = {}) {
  const extra = new Set(String(allowed).split(',').map((s) => hostOf(s.trim())).filter(Boolean));
  return function (req, res, next) {
    if (!UNSAFE.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    if (!String(req.headers.cookie || '').includes(cookieName + '=')) return next();
    const oh = hostOf(origin);
    const mine = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim().toLowerCase();
    if (oh && (oh === mine || extra.has(oh))) return next();
    console.warn('[csrf] refused', req.method, String(req.originalUrl || '').split('?')[0], 'from', oh || origin);
    return res.status(403).json({ error: 'Request blocked: it came from another website.' });
  };
}
module.exports = { csrfGuard };
