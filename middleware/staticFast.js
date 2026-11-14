/* ROYAL BATH HUB speed block (middleware/staticFast.js)
   Job: send the screens (html, js, css, json, svg) compressed with gzip and with an ETag, so a screen is
   about 5 times smaller on the wire and a repeat visit answers "304 not changed" almost instantly.
   Uses only Node's built-in zlib (no new library). Anything it does not handle goes on to express.static.
   Input: the public folder path. Output: an Express middleware. Remove the one line in server.js to remove it. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const MIN_BYTES = 1024;            // tiny files are not worth compressing
const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_ENTRIES = 400;

function staticFast(dir) {
  const root = path.resolve(dir);
  const cache = new Map();         // file -> { sig, gz }

  return function staticFastMw(req, res, next) {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return next();
      const rawPath = String(req.path || (req.url || '').split('?')[0]);
      let p;
      try { p = decodeURIComponent(rawPath); } catch (e) { return next(); }
      if (p.indexOf('\0') !== -1 || p.endsWith('/')) return next();
      if (p.split('/').some(function (s) { return s.charAt(0) === '.'; })) return next();   // never dot files
      const type = TYPES[path.extname(p).toLowerCase()];
      if (!type) return next();
      const file = path.resolve(root, '.' + p);
      if (file.indexOf(root + path.sep) !== 0) return next();                                  // stay inside public
      const st = fs.statSync(file);
      if (!st.isFile() || st.size < MIN_BYTES || st.size > MAX_BYTES) return next();

      const sig = st.size + '-' + Math.floor(st.mtimeMs);
      const etag = 'W/"' + sig + '-gz"';
      res.setHeader('Content-Type', type);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('ETag', etag);
      // big vendor libraries never change in place: keep them 1 day on the phone (no round trip at all)
      res.setHeader('Cache-Control', (/^\/(vendor|lib)\/.*\.min\.js$/.test(p) || /\.min\.js$/.test(p)) ? 'public, max-age=86400' : 'public, max-age=0, must-revalidate');
      if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end(); }

      let ent = cache.get(file);
      if (!ent || ent.sig !== sig) {
        ent = { sig: sig, gz: zlib.gzipSync(fs.readFileSync(file), { level: 6 }) };
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
        cache.set(file, ent);
      }
      res.setHeader('Content-Length', ent.gz.length);
      res.statusCode = 200;
      if (req.method === 'HEAD') return res.end();
      return res.end(ent.gz);
    } catch (e) {
      // any surprise (missing file, read error): fall back to the normal static handler
      if (!res.headersSent) { res.removeHeader('Content-Encoding'); res.removeHeader('Content-Length'); return next(); }
      try { res.end(); } catch (e2) {}
    }
  };
}

module.exports = staticFast;
