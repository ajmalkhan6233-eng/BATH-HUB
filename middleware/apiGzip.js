/* ROYAL BATH HUB speed block (middleware/apiGzip.js)
   Job: send /api answers (JSON, text) compressed with gzip, so big lists (items, bills, stock) are about 5 times smaller
   on the phone and over the tunnel. Only res.send/res.json are touched; streams, downloads, PDFs and live feeds are left alone.
   Uses only Node's built-in zlib (no new library). Remove the one line in server.js to turn it off. */
'use strict';
const zlib = require('zlib');
const MIN_BYTES = 1024;
const OK_TYPE = /^(application\/json|text\/)/i;

function apiGzip() {
  return function apiGzipMw(req, res, next) {
    if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) || req.method === 'HEAD') return next();
    const send = res.send;
    res.send = function (body) {
      try {
        if (res.headersSent || res.getHeader('Content-Encoding') || res.getHeader('Content-Range')) return send.call(this, body);
        const type = String(res.getHeader('Content-Type') || (typeof body === 'string' ? 'text/html' : ''));
        if (!OK_TYPE.test(type) || /event-stream/i.test(type)) return send.call(this, body);
        const buf = Buffer.isBuffer(body) ? body : (typeof body === 'string' ? Buffer.from(body) : null);
        if (!buf || buf.length < MIN_BYTES || res.statusCode === 204 || res.statusCode === 304) return send.call(this, body);
        const gz = zlib.gzipSync(buf, { level: 3 });
        if (gz.length >= buf.length) return send.call(this, body);
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.removeHeader('ETag');                       // the ETag was made for the plain body
        return send.call(this, gz);
      } catch (e) { return send.call(this, body); }     // never break an answer
    };
    next();
  };
}
module.exports = apiGzip;
