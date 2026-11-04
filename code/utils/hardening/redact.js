'use strict';
// Log redaction. redact(x) returns a copy of a string / object / array / Error with
//   phone numbers cut to their last 3 digits (***123), and
//   tokens, keys, passphrases, passwords, PINs, Authorization and cookie values removed ([REDACTED]).
// Works deep (objects, arrays, Errors, cycles). The original value is never changed.
// createLogger(prefix, sink) and installConsoleRedaction() apply it to everything that is logged.
const MASK = '[REDACTED]';
const MAX_DEPTH = 8;

// object keys whose VALUE is removed
const SECRET_SUBSTR = ['password', 'passwd', 'passphrase', 'secret', 'token', 'apikey', 'privatekey', 'authorization', 'cookie',
    'bearer', 'credential', 'totp', 'csrf', 'sessionid', 'signature'];
const SECRET_EXACT = new Set(['pin', 'otp', 'key', 'pass', 'pwd', 'auth', 'sid', 'session', 'adminpin']);
// object keys whose value is a phone number
const PHONE_KEY = /phone|mobile|whatsapp|msisdn|waid|^(to|from|tel|contact)$/;

function normKey(k) { return String(k).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function isSecretKey(k) {
    const n = normKey(k);
    return SECRET_EXACT.has(n) || SECRET_SUBSTR.some(s => n.includes(s));
}
const isPhoneKey = k => PHONE_KEY.test(normKey(k));

function maskPhone(v) {
    const digits = String(v).replace(/\D/g, '');
    return digits.length > 3 ? '***' + digits.slice(-3) : '***';
}

// order matters: secrets first (so a number inside a token is not half-masked), then phones
const STRING_RULES = [
    [/(authorization|proxy-authorization)\s*[:=]\s*[^\r\n]*/gi, '$1: ' + MASK],
    [/\b(set-cookie|cookie)\s*:\s*[^\r\n]*/gi, '$1: ' + MASK],
    [/\bBearer\s+[A-Za-z0-9._~+/=-]{6,}/g, 'Bearer ' + MASK],
    [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, MASK],                      // JWT
    // "password": "x"   password=x   BACKUP_PASSPHRASE=x   ?token=x&..   (key words listed in SECRET_SUBSTR / pin / otp)
    [/(["']?\b[A-Za-z0-9_.-]*(?:password|passwd|passphrase|secret|token|api[_-]?key|private[_-]?key|credential|totp|csrf|session[_-]?id|signature|pin|otp|pwd)[A-Za-z0-9_.-]*["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&"'}\]]+)/gi,
        (m, k, v) => k + (v[0] === '"' ? '"' + MASK + '"' : v[0] === "'" ? "'" + MASK + "'" : MASK)],
    [/\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, MASK],                                                 // API-key shapes
    [/\bEA[A-Za-z0-9]{40,}\b/g, MASK],                                                          // Meta/WhatsApp access tokens
    [/\b[a-f0-9]{40,}\b/gi, MASK],                                                              // long hex secrets / hashes
    // phone numbers
    [/\b(\d{9,15})@(c\.us|s\.whatsapp\.net|g\.us)\b/g, (m, d, s) => maskPhone(d) + '@' + s],     // WhatsApp ids
    [/(?<![\d.])\+\d[\d\s-]{7,16}\d(?![\d])/g, m => maskPhone(m)],                              // +94 77 799 9219
    [/(?<![\d.\-:])0?\d{2}[\s-]\d{3}[\s-]\d{4}(?![\d])/g, m => maskPhone(m)],                       // 077 799 9219, 77-799-9219
    [/(?<![\d.\-:])\d{9,15}(?![\d])/g, m => maskPhone(m)],                                      // 94777999219, 0777999219
];

function redactString(s) {
    let out = String(s);
    for (const [re, rep] of STRING_RULES) out = out.replace(re, rep);
    return out;
}

function redact(value, depth = 0, seen = new WeakSet()) {
    if (value === null || value === undefined) return value;
    const t = typeof value;
    if (t === 'string') return redactString(value);
    if (t === 'number' || t === 'boolean' || t === 'bigint' || t === 'symbol' || t === 'function') return value;
    if (Buffer.isBuffer(value)) return '[Buffer ' + value.length + ' bytes]';
    if (value instanceof Date) return value;
    if (depth >= MAX_DEPTH) return '[too deep]';
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (value instanceof Error) {
        const e = { name: value.name, message: redactString(value.message) };
        if (value.code !== undefined) e.code = value.code;
        if (value.stack) e.stack = redactString(value.stack);
        return e;
    }
    if (Array.isArray(value)) return value.map(v => redact(v, depth + 1, seen));
    const out = {};
    for (const k of Object.keys(value)) {
        const v = value[k];
        if (isSecretKey(k)) out[k] = (v === null || v === undefined || v === '') ? v : MASK;
        else if (isPhoneKey(k) && (typeof v === 'string' || typeof v === 'number')) out[k] = maskPhone(v);
        else out[k] = redact(v, depth + 1, seen);
    }
    return out;
}

// logger with the same methods as console; every argument is redacted first. Errors print as their redacted stack text.
function createLogger(prefix, sink = console) {
    const wrap = level => (...args) => {
        const safe = args.map(a => {
            const r = redact(a);
            return (a instanceof Error) ? (r.stack || r.message) : r;
        });
        (sink[level] || sink.log).apply(sink, prefix ? [prefix, ...safe] : safe);
    };
    return { log: wrap('log'), info: wrap('info'), warn: wrap('warn'), error: wrap('error'), debug: wrap('debug') };
}

// Patch console.log/info/warn/error/debug so everything the app logs is redacted. Safe to call twice. Returns an undo function.
// HARDENING_LOG_REDACT=off in the environment turns it off.
function installConsoleRedaction(target = console, env = process.env) {
    if (String(env.HARDENING_LOG_REDACT || '').toLowerCase() === 'off') return () => {};
    if (target.__redactionInstalled) return () => {};
    const original = {};
    const levels = ['log', 'info', 'warn', 'error', 'debug'];
    for (const l of levels) {
        if (typeof target[l] !== 'function') continue;
        original[l] = target[l];
        const orig = original[l];
        target[l] = function (...args) {
            let safe;
            try { safe = args.map(a => { const r = redact(a); return (a instanceof Error) ? (r.stack || r.message) : r; }); }
            catch (e) { safe = ['[log line could not be redacted and was dropped]']; }
            return orig.apply(target, safe);
        };
    }
    Object.defineProperty(target, '__redactionInstalled', { value: true, configurable: true });
    return function undo() {
        for (const l of Object.keys(original)) target[l] = original[l];
        delete target.__redactionInstalled;
    };
}

module.exports = { redact, redactString, maskPhone, createLogger, installConsoleRedaction, isSecretKey, MASK };
