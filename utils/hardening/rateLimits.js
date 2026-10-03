'use strict';
// Rate-limit factories (express-rate-limit). Same style as the limiters already in server.js.
//   loginLimiter(opts)      login-like endpoints: only FAILED attempts count (default 10 per 15 min per IP)
//   publicApiLimiter(opts)  public read/write API: every request counts (default 60 per minute per IP)
//   publicFileLimiter(opts) public files such as photos: generous (default 300 per minute per IP)
//   strictLimiter(opts)     expensive or abuse-prone public endpoints (default 20 per 10 min per IP)
// skipPrivate:true (what server.js uses) does not count devices on the shop's own network, so a phone on the shop Wi-Fi is never locked out.
const rateLimit = require('express-rate-limit');

const PRIVATE_IP = /^(::ffff:)?(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
function isPrivateIp(ip) {
    ip = ip || '';
    return PRIVATE_IP.test(ip) || ip === '::1' || /^fe80:/i.test(ip);
}

function make(defaults, message) {
    return (opts = {}) => {
        const { skipPrivate, ...rest } = opts;
        const o = { standardHeaders: true, legacyHeaders: false, message: { error: message }, ...defaults, ...rest };
        if (skipPrivate) {
            const userSkip = o.skip;
            o.skip = (req, res) => isPrivateIp(req.ip) || (typeof userSkip === 'function' && userSkip(req, res));
        }
        return rateLimit(o);
    };
}

const loginLimiter = make({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true },
    'Too many failed attempts. Please wait 15 minutes and try again.');
const publicApiLimiter = make({ windowMs: 60 * 1000, limit: 60 },
    'Too many requests. Please try again in a minute.');
const publicFileLimiter = make({ windowMs: 60 * 1000, limit: 300 },
    'Too many requests. Please try again in a minute.');
const strictLimiter = make({ windowMs: 10 * 60 * 1000, limit: 20 },
    'Too many requests from this device. Please try again in a few minutes.');

module.exports = { loginLimiter, publicApiLimiter, publicFileLimiter, strictLimiter, isPrivateIp };
