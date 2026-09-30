// middleware/webhookAuth.js
// Guards the WhatsApp bridge webhooks (/webhook/*), which bypass the login gate.
//
// Before this, anyone who could reach the server could POST a fake customer message
// (and answer YES to a pending draft, writing into daily_summary) or hand the photo
// webhook any local file path to be read and sent to the OCR model.
//
// Rule: if WEBHOOK_SECRET is set, the caller must send it in the `x-webhook-secret` header.
// If it is not set, only a direct local caller is accepted (the bridge on the same machine).
// Tunnelled / proxied traffic always carries X-Forwarded-For, so req.ip is then the remote
// address and is refused. Nothing changes for the bridge on the same machine.

const crypto = require('crypto');
const path = require('path');

const isLoopback = ip => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

function webhookAuth(req, res, next) {
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
        if (safeEqual(req.get('x-webhook-secret') || '', secret)) return next();
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (isLoopback(req.ip)) return next();
    return res.status(403).json({ error: 'Forbidden' });
}

// A photo path is only accepted if it is an image inside the bridge's inbox folder.
// Returns the resolved path, or null.
function safeInboxPath(filePath, inboxRoot) {
    if (typeof filePath !== 'string' || !filePath || filePath.includes('\0')) return null;
    const root = path.resolve(inboxRoot);
    const full = path.resolve(filePath);
    if (full !== root && !full.startsWith(root + path.sep)) return null;
    if (!/\.(jpe?g|png)$/i.test(full)) return null;
    return full;
}

module.exports = { webhookAuth, safeInboxPath, isLoopback };
