'use strict';
// Shared helpers for the audit machine. TEST COPY ONLY: refuses to run against anything that is not the cloud test copy.
//   AUDIT_BASE  default http://localhost:3199   (the cloud test rig, scripts/dev/cloud_rig.sh)
//   DB_NAME     must contain "test" or "scratch"
const BASE = process.env.AUDIT_BASE || 'http://localhost:3199';

function guard() {
  if (!/^http:\/\/(localhost|127\.0\.0\.1):3[12]\d\d$/.test(BASE)) throw new Error(`REFUSED: ${BASE} is not a cloud test port (3100 is the live shop)`);
  if (!/(test|scratch)/i.test(process.env.DB_NAME || '')) throw new Error('REFUSED: DB_NAME must contain "test" or "scratch"');
}

async function api(method, path, body, opts = {}) {
  const init = { method, headers: {} };
  if (opts.form) init.body = opts.form;
  else if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  if (opts.key) init.headers['X-Idempotency-Key'] = opts.key;        // the header the POS screens send (UUID)
  if (opts.vkey) init.headers['Idempotency-Key'] = opts.vkey;       // the header the vendor and Layla screens send
  const r = await fetch(BASE + path, init);
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (_) { /* not json */ }
  return { status: r.status, json, text };
}

// Collects pass/fail lines and confirmed bugs. A check is "proved" only when it ran and passed.
class Run {
  constructor(title) { this.title = title; this.checks = []; this.bugs = []; this.notes = []; }
  check(name, pass, detail = '') { this.checks.push({ name, pass: !!pass, detail: pass ? '' : String(detail) }); return !!pass; }
  bug(id, title, evidence) { if (!this.bugs.find((b) => b.id === id)) this.bugs.push({ id, title, evidence: String(evidence) }); }
  note(s) { this.notes.push(s); }
  get failed() { return this.checks.filter((c) => !c.pass); }
  summary() { return `${this.title}: ${this.checks.length - this.failed.length}/${this.checks.length} checks passed, ${this.bugs.length} bug(s) found`; }
}

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const near = (a, b, tol = 0.011) => Math.abs(Number(a) - Number(b)) <= tol;
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // Sri Lanka date

async function grn(pool, supplier, lines, extra = {}) {
  const payload = { supplier_name: supplier, grn_date: today(), credit_days: 60, lines, ...extra };
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  return api('POST', '/api/grn-manual', undefined, { form });
}

async function stockOf(pool, code) {
  const r = await pool.query('SELECT stock_level FROM products WHERE item_code = $1', [code]);
  return r.rows.length ? Number(r.rows[0].stock_level) : null;
}

const uuid = () => require('crypto').randomUUID();
module.exports = { uuid, BASE, guard, api, Run, r2, near, today, grn, stockOf };
