'use strict';
// Content-Security-Policy for the public website (/site and /api/site/*), computed to fit the real page.
// The page has one inline <script> and one inline <style> (no build step), so instead of 'unsafe-inline' the policy carries the
// sha256 hash of each inline block, computed from the file that is actually served (re-computed when the file changes).
// Inline style="" attributes on elements are allowed through style-src-attr only (they cannot run code); script attributes
// (onclick="") are NOT allowed, the page sets handlers from its script.
//   fonts: fonts.googleapis.com (css) and fonts.gstatic.com (files).  images: self + data:.  connect: self.
//   frame-ancestors none, base-uri self, form-action self, object-src none.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// The browser's HTML parser turns CRLF and lone CR into LF BEFORE it hashes an inline block, so the hash must be taken on the same text.
const sha = txt => "'sha256-" + crypto.createHash('sha256').update(String(txt).replace(/\r\n?/g, '\n'), 'utf8').digest('base64') + "'";

// Hashes of every inline block. JSON data blocks (type="application/ld+json" etc.) are not executed, so they need none.
function inlineHashes(html) {
    const scripts = [], styles = [];
    const re = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
    let m;
    while ((m = re.exec(html))) {
        const tag = m[1].toLowerCase(), attrs = m[2] || '', body = m[3];
        if (tag === 'script') {
            if (/\bsrc\s*=/i.test(attrs)) continue;                                   // external file: allowed by 'self'
            const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1];
            if (type && !/^(text\/javascript|application\/javascript|module)$/i.test(type)) continue;   // data block, never executed
            if (body.trim() === '') continue;
            scripts.push(sha(body));
        } else if (body.trim() !== '') styles.push(sha(body));
    }
    return { scripts: [...new Set(scripts)], styles: [...new Set(styles)] };
}

function buildPolicy(html) {
    const h = inlineHashes(html);
    return [
        "default-src 'self'",
        ['script-src', "'self'", ...h.scripts].join(' '),
        ['style-src', "'self'", ...h.styles, 'https://fonts.googleapis.com'].join(' '),
        "style-src-attr 'unsafe-inline'",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ].join('; ');
}

const BASE_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
};

// siteSecurityHeaders({ file }): middleware. Mount on '/site' and '/api/site'. The page file is read once and again only when its
// modified time changes. If the file cannot be read, the page itself is not served by us either, so only the base headers are set.
function siteSecurityHeaders(opts = {}) {
    const file = opts.file || path.join(__dirname, '..', '..', 'public', 'website', 'index.html');
    let cache = { mtime: -1, policy: null };
    function policy() {
        try {
            const mt = fs.statSync(file).mtimeMs;
            if (mt !== cache.mtime) cache = { mtime: mt, policy: buildPolicy(fs.readFileSync(file, 'utf8')) };
        } catch (e) { return cache.policy; }
        return cache.policy;
    }
    return function siteSecurityHeadersMw(req, res, next) {
        for (const [k, v] of Object.entries(BASE_HEADERS)) res.setHeader(k, v);
        const p = policy();
        if (p) res.setHeader('Content-Security-Policy', p);
        next();
    };
}

module.exports = { siteSecurityHeaders, buildPolicy, inlineHashes, BASE_HEADERS };
