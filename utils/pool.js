'use strict';
// ONE shared Postgres pool for the route modules (they used to open 35 pools of 10 connections each, against Postgres's default
// limit of 100). Same DB_* settings the modules used before. Cap: PG_POOL_MAX (default 15); idle connections close after 30 s.
require('dotenv').config();
const { Pool } = require('pg');

const max = Math.max(1, parseInt(process.env.PG_POOL_MAX, 10) || 15);

const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    max, idleTimeoutMillis: 30000,
});

// START-UP ORDER FIX (audit 2026-10-04): every route module fires its CREATE TABLE / ALTER TABLE at the same moment it is loaded.
// On a brand-new database an ALTER could run before its CREATE finished ("relation does not exist"), leaving columns missing
// until the next restart. For the first BOOT_MS after load, plain pool.query() calls run one at a time, in the order they were
// made (a module's CREATE always comes before its ALTER). Afterwards, and for pool.connect() / callback-style calls, nothing changes.
const bootEnv = parseInt(process.env.PG_BOOT_SERIAL_MS, 10);
const BOOT_MS = Number.isFinite(bootEnv) && bootEnv >= 0 ? bootEnv : 20000;   // 0 = off
if (typeof pool.query === 'function' && BOOT_MS > 0) {
    const rawQuery = pool.query.bind(pool);
    let chain = Promise.resolve(), booting = true;
    setTimeout(() => { booting = false; }, BOOT_MS).unref();
    pool.query = function (...args) {
        if (!booting || typeof args[args.length - 1] === 'function') return rawQuery(...args);
        const run = chain.then(() => rawQuery(...args));
        chain = run.catch(() => {});   // one failed statement must not block the ones after it
        return run;
    };
}

module.exports = pool;
