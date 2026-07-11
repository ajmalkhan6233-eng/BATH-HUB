// Shared Postgres pool for the apex platform modules (utils/, middleware/,
// routes/apex_admin.js). Same connection rules as layla.js: DATABASE_URL wins
// (hosted deploys), otherwise the discrete DB_* vars from .env.
require('dotenv').config();
const { Pool } = require('pg');
const { assertTemplateSafeDb } = require('./dbGuard');
assertTemplateSafeDb('utils/db');

const _ssl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('.railway.internal')
    ? { rejectUnauthorized: false } : false;

const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: _ssl })
    : new Pool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     process.env.DB_PORT     || 5432,
        database: process.env.DB_NAME     || 'bathco_template',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD,
    });

module.exports = pool;
