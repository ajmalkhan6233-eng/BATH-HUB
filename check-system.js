#!/usr/bin/env node
// System health check — run with: node check-system.js (uses PORT/DB_NAME from .env)
'use strict';

const http = require('http');
const { exec } = require('child_process');
const { Pool } = require('pg');
require('dotenv').config();

const CHECKS = [];
const pass = (name, detail) => CHECKS.push({ status: 'PASS', name, detail });
const fail = (name, detail) => CHECKS.push({ status: 'FAIL', name, detail });

function checkPort(host, port, label) {
    return new Promise((resolve) => {
        let done = false;
        const finish = (ok, detail) => {
            if (done) return;
            done = true;
            ok ? pass(label, detail) : fail(label, detail);
            resolve();
        };
        const req = http.request({ host, port, path: '/', method: 'GET', timeout: 3000 }, (res) => {
            res.resume(); // consume body so socket is freed
            req.destroy();
            finish(true, `HTTP ${res.statusCode} on ${host}:${port}`);
        });
        req.on('error', (e) => finish(false, `${host}:${port} — ${e.code || e.message}`));
        req.on('timeout', () => { req.destroy(); finish(false, `Timeout on ${host}:${port}`); });
        req.end();
    });
}

function checkPg(label, database) {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database,
        user: process.env.DB_USER || process.env.PGUSER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
        connectionTimeoutMillis: 5000,
    });
    return pool.query('SELECT 1')
        .then(() => { pass(label, `Connected to ${database}`); return pool.end(); })
        .catch((e) => { fail(label, `${database}: ${e.message}`); return pool.end().catch(() => {}); });
}

function checkCmd(label, cmd) {
    return new Promise((resolve) => {
        exec(cmd, { timeout: 5000 }, (err, stdout) => {
            if (err) { fail(label, err.message.trim()); } else { pass(label, stdout.trim().slice(0, 80)); }
            resolve();
        });
    });
}

async function main() {
    console.log('\n=== SYSTEM CHECK ===');
    console.log(`Time: ${new Date().toLocaleString('en-GB')}\n`);

    const appPort = parseInt(process.env.PORT || '3010', 10);
    const dbName  = process.env.DB_NAME || 'bathco_template';
    await Promise.all([
        checkPort('localhost', appPort, `Backend (${appPort})`),
        checkPg(`PostgreSQL: ${dbName}`, dbName),
        checkCmd('PM2 processes', 'npx pm2 jlist 2>nul'),
        checkCmd('Node.js version', 'node --version'),
    ]);

    // PM2 process detail
    await new Promise((resolve) => {
        exec('npx pm2 jlist 2>nul', { timeout: 8000 }, (err, stdout) => {
            if (!err && stdout.trim()) {
                try {
                    const procs = JSON.parse(stdout);
                    procs.forEach((p) => {
                        const status = p.pm2_env.status === 'online' ? 'PASS' : 'FAIL';
                        CHECKS.push({
                            status,
                            name: `PM2: ${p.name}`,
                            detail: `${p.pm2_env.status} | uptime ${Math.round((Date.now() - p.pm2_env.pm_uptime) / 60000)}min | restarts: ${p.pm2_env.restart_time}`,
                        });
                    });
                } catch (_) { /* jlist already recorded above */ }
            }
            resolve();
        });
    });

    // Print results
    const passes = CHECKS.filter((c) => c.status === 'PASS');
    const fails  = CHECKS.filter((c) => c.status === 'FAIL');

    passes.forEach((c) => console.log(`  ✓  ${c.name.padEnd(30)} ${c.detail}`));
    fails.forEach((c)  => console.log(`  ✗  ${c.name.padEnd(30)} ${c.detail}`));

    console.log(`\n  PASSED: ${passes.length}  |  FAILED: ${fails.length}`);
    if (fails.length) {
        console.log('\n  Failures:');
        fails.forEach((c) => console.log(`    - ${c.name}: ${c.detail}`));
        process.exit(1);
    } else {
        console.log('  All systems operational.\n');
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
