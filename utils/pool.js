'use strict';
// ONE shared Postgres pool for the route modules (they used to open 35 pools of 10 connections each, against Postgres's default
// limit of 100). Same DB_* settings the modules used before. Cap: PG_POOL_MAX (default 15); idle connections close after 30 s.
require('dotenv').config();
const { Pool } = require('pg');

const max = Math.max(1, parseInt(process.env.PG_POOL_MAX, 10) || 15);

module.exports = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    max, idleTimeoutMillis: 30000,
});
