'use strict';
// Content sniffing: decide what a file REALLY is from its first bytes (the file-type package), never from its name or the
// Content-Type the client sent. Wraps file-type with an allow-list so callers only see "allowed type or null".
let ft;
try { ft = require('file-type'); } catch (e) { ft = {}; }

const IMAGES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENTS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

async function detect(buf) {
    if (!Buffer.isBuffer(buf) || !buf.length) return null;
    const fn = ft.fromBuffer || ft.fileTypeFromBuffer;          // v16 name / v17+ name
    if (typeof fn !== 'function') return null;
    try { return (await fn(buf)) || null; } catch (e) { return null; }
}

// -> { mime, ext } when the real type is in the allow-list, otherwise null (unknown, wrong type, or unreadable)
async function sniffAllowed(buf, allowed = IMAGES) {
    const t = await detect(buf);
    if (!t || !t.mime) return null;
    return allowed.includes(t.mime) ? { mime: t.mime, ext: t.ext } : null;
}

// Express/multer helper: 415 when the uploaded file (req.file.buffer) is not an allowed real type.
function requireRealType(allowed = IMAGES, message) {
    return async function requireRealTypeMw(req, res, next) {
        const f = req.file;
        if (!f || !f.buffer) return next();
        const t = await sniffAllowed(f.buffer, allowed);
        if (!t) return res.status(415).json({ error: message || 'That file type is not allowed.' });
        req.file.sniffed = t;
        next();
    };
}

module.exports = { sniffAllowed, requireRealType, IMAGES, DOCUMENTS };
