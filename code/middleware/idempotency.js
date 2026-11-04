'use strict';
/**
 * Makes saves safe to repeat. The browser (public/lib/offlineSave.js) sends a unique Idempotency-Key with every save. If the same key arrives
 * again (a retry after a dropped connection, or an offline queue flushing twice) the stored answer is returned and nothing is written twice.
 * Mount in front of any router:  app.use('/api/vendor-ledger', idempotency({ pool }), vendorRouter)
 */
module.exports = function idempotency({ pool, ttlDays = 14 }) {
  return async function (req, res, next) {
    const key = req.get('Idempotency-Key');
    if (!key || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) return res.status(400).json({ error: 'bad Idempotency-Key' });
    try {
      const ex = (await pool.query('SELECT status, body FROM idempotency_keys WHERE idem_key=$1', [key])).rows[0];
      if (ex) {
        if (Number(ex.status) === 0) return res.status(409).json({ error: 'this save is still being processed, try again in a moment' });
        res.set('Idempotent-Replay', 'true'); return res.status(Number(ex.status)).type('application/json').send(ex.body);
      }
      try { await pool.query('INSERT INTO idempotency_keys (idem_key, route, status) VALUES ($1,$2,0)', [key, `${req.method} ${req.baseUrl}${req.path}`.slice(0, 200)]); }
      catch (e) { return res.status(409).json({ error: 'this save is already in progress, try again in a moment' }); }   // unique key: another request got there first
      const send = res.send.bind(res);
      res.send = (body) => {
        const done = typeof body === 'string' ? body : JSON.stringify(body);
        if (res.statusCode >= 500) pool.query('DELETE FROM idempotency_keys WHERE idem_key=$1', [key]).catch(() => {});   // failures can be retried
        else pool.query('UPDATE idempotency_keys SET status=$2, body=$3 WHERE idem_key=$1', [key, res.statusCode, done]).catch(() => {});
        return send(body);
      };
      return next();
    } catch (e) { console.error('[idempotency]', e.message); return next(); }   // never block a save because of the helper
  };
};
