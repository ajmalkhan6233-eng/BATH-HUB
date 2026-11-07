'use strict';
/**
 * FIX 1 (7 Nov 2026 audit): safety net for the server. One module, nothing else changed.
 *  - errorHandler: any error that nothing caught becomes a calm JSON answer, never a stack trace to the screen.
 *  - installProcessGuards: a stray rejected promise is logged and the app keeps running;
 *    a real crash (uncaughtException) exits so pm2 restarts it; pm2 stop/restart (SIGTERM) closes the server and the database first.
 */
function errorHandler(err, req, res, next) {   // 4 arguments = Express error handler
  if (res.headersSent) return next(err);
  const status = Number(err && (err.status || err.statusCode)) || 500;
  const code = status >= 400 && status < 600 ? status : 500;
  if (code >= 500) console.error('[safety] error on', req.method, (req.originalUrl || '').split('?')[0], '-', err && err.message);
  const msg = code === 413 ? 'That is too large.' : code === 400 ? 'That request could not be read.' : code >= 500 ? 'Something went wrong. Please try again.' : 'Request not accepted.';
  if (String(req.originalUrl || '').startsWith('/api')) return res.status(code).json({ error: msg });
  return res.status(code).type('text').send(msg);
}

let installed = false;
function installProcessGuards({ server, pool, exit = process.exit, proc = process } = {}) {
  if (installed) return false;
  installed = true;
  let closing = false;
  const shutdown = (why) => {
    if (closing) return; closing = true;
    console.log('[safety] closing (' + why + ')');
    const force = setTimeout(() => exit(0), 8000); if (force.unref) force.unref();
    const done = () => Promise.resolve(pool && pool.end ? pool.end().catch(() => {}) : null).then(() => exit(0));
    if (server && server.close) server.close(() => done()); else done();
  };
  proc.on('SIGTERM', () => shutdown('SIGTERM'));
  proc.on('SIGINT', () => shutdown('SIGINT'));
  proc.on('unhandledRejection', (r) => console.error('[safety] unhandled rejection:', r && r.message ? r.message : r));
  proc.on('uncaughtException', (e) => { console.error('[safety] crash:', e && e.stack ? e.stack : e); setTimeout(() => exit(1), 200); });
  return true;
}
const _resetForTests = () => { installed = false; };
module.exports = { errorHandler, installProcessGuards, _resetForTests };
