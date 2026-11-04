'use strict';
// Where generated documents live: <DOCUMENTS_DIR>/YYYY/MM/<32 random hex>.pdf|csv   (default DOCUMENTS_DIR = uploads/documents)
// The database stores only the part after the root ("2026/10/ab12....pdf"). A file is only ever opened through resolveStored(), which accepts
// nothing but that exact shape, so a stored value can never point outside the folder (no "..", no slashes beyond YYYY/MM, no absolute paths).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { todayLK } = require('../lkTime');

const defaultRoot = () => path.resolve(process.env.DOCUMENTS_DIR || path.join(__dirname, '..', '..', 'uploads', 'documents'));
const REL_RE = /^\d{4}\/(0[1-9]|1[0-2])\/[a-f0-9]{32}\.(pdf|csv)$/;
const EXT = { pdf: 'application/pdf', csv: 'text/csv; charset=utf-8' };

function save(root, buffer, ext, now = new Date()) {
    if (!EXT[ext]) throw new Error('unsupported document format');
    const day = todayLK(now);                                       // YYYY-MM-DD (Colombo)
    const rel = `${day.slice(0, 4)}/${day.slice(5, 7)}/${crypto.randomBytes(16).toString('hex')}.${ext}`;
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buffer, { flag: 'wx' });
    return { rel, abs, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length };
}

// -> absolute path, or null when the stored value is not a valid document path
function resolveStored(root, rel) {
    if (typeof rel !== 'string' || !REL_RE.test(rel)) return null;
    const abs = path.resolve(root, ...rel.split('/'));
    return abs.startsWith(path.resolve(root) + path.sep) ? abs : null;
}

function remove(root, rel) {
    const abs = resolveStored(root, rel);
    if (!abs) return false;
    try { fs.unlinkSync(abs); return true; } catch (e) { return e.code === 'ENOENT'; }
}

module.exports = { defaultRoot, save, resolveStored, remove, REL_RE, EXT };
