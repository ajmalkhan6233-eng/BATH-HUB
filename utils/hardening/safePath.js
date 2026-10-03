'use strict';
// safeJoin(baseDir, name): join ONE untrusted file name onto a trusted folder. Path traversal is impossible: anything that is not a
// plain single file name throws. Rejected: '..' and '.', slashes and backslashes, absolute paths, drive letters (C:), UNC (\\host),
// NUL bytes, encoded dots/slashes (%2e %2f %5c, also double-encoded), control characters, Windows reserved device names and
// trailing dots/spaces. Returns the full path, which is always directly inside baseDir.
const path = require('path');

class UnsafePathError extends Error {
    constructor(reason) { super('Unsafe file name: ' + reason); this.name = 'UnsafePathError'; this.code = 'EUNSAFEPATH'; }
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

function decodeLayers(s) {
    // decode up to 3 times so %252e%252e is caught too; undecodable text (lone %) is judged as it is
    let cur = s;
    for (let i = 0; i < 3; i++) {
        let next;
        try { next = decodeURIComponent(cur); } catch (e) { return cur; }
        if (next === cur) break;
        cur = next;
    }
    return cur;
}

function checkName(name) {
    if (typeof name !== 'string') throw new UnsafePathError('not text');
    if (!name.length) throw new UnsafePathError('empty');
    if (name.length > 255) throw new UnsafePathError('too long');
    if (/%2e|%2f|%5c|%00|%25/i.test(name)) throw new UnsafePathError('encoded dot, slash, NUL or percent');
    for (const form of [name, decodeLayers(name)]) {
        if (form.indexOf('\0') !== -1) throw new UnsafePathError('NUL byte');
        // eslint-disable-next-line no-control-regex
        if (/[\u0000-\u001f\u007f]/.test(form)) throw new UnsafePathError('control character');
        if (/[\\/]/.test(form)) throw new UnsafePathError('slash or backslash');
        if (form.includes(':')) throw new UnsafePathError('colon (drive letter or Windows stream)');
        if (form.includes('..')) throw new UnsafePathError('double dot');
        if (form === '.') throw new UnsafePathError('dot name');
        if (/[<>"|?*]/.test(form)) throw new UnsafePathError('reserved character');
        if (/[. ]$/.test(form)) throw new UnsafePathError('trailing dot or space');
        if (RESERVED.test(form)) throw new UnsafePathError('reserved device name');
    }
}

function safeJoin(baseDir, name) {
    if (typeof baseDir !== 'string' || !baseDir) throw new UnsafePathError('no base folder');
    checkName(name);
    const base = path.resolve(baseDir);
    const full = path.join(base, name);
    // last line of defence: whatever happened above, the result must sit directly inside base
    if (path.dirname(full) !== base) throw new UnsafePathError('escapes the folder');
    return full;
}

// true/false version for places that prefer a branch to a throw
function isSafeName(name) { try { checkName(name); return true; } catch (e) { return false; } }

module.exports = { safeJoin, isSafeName, UnsafePathError };
