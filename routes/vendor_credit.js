'use strict';
/**
 * Vendor credit view (read only). Mount: app.use('/api/vendor-credit', require('./routes/vendor_credit')({ pool, branchOf: () => 1 }));
 *   GET /summary?months=1,2,3      every vendor: owed, cheque not written, written not cleared, owed after N months, long-dated cheques
 *   GET /vendor?name=Metro         the same for one vendor, with its bills
 * Writes nothing. Login is enforced by the app's global /api gate (same as the vendor ledger).
 */
const express = require('express');
const { creditView, oneLine } = require('../utils/vendorCredit');
const { loadVendorRows } = require('../utils/vendorCreditDb');

const todaySL = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
function parseMonths(q) {
  const m = String(q === undefined ? '1,2,3' : q).split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= 24);
  return [...new Set(m)].slice(0, 6).sort((a, b) => a - b);
}

module.exports = function createVendorCreditRouter({ pool, requireAuth, branchOf = () => 1 }) {
  const r = express.Router();
  if (requireAuth) r.use(requireAuth);
  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error('[vendor-credit]', e.message); res.status(500).json({ error: 'Something went wrong' }); });

  r.get('/summary', wrap(async (req, res) => {
    const months = parseMonths(req.query.months);
    if (!months.length) return res.status(400).json({ error: 'months must be whole numbers from 1 to 24, like 1,2,3' });
    const rows = await loadVendorRows(pool, { branch: branchOf(req) });
    const view = creditView(rows, todaySL(), { months });
    res.json({ ...view, lines: view.vendors.map(oneLine) });
  }));

  r.get('/vendor', wrap(async (req, res) => {
    const name = String(req.query.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    const months = parseMonths(req.query.months);
    const rows = await loadVendorRows(pool, { branch: branchOf(req), vendor: name });
    const view = creditView(rows, todaySL(), { months: months.length ? months : [1, 2, 3], onlyVendor: name });
    const v = view.vendors[0] || null;
    res.json({ ...view, vendor: v, line: v ? oneLine(v) : `${name}: nothing owed.` });
  }));
  return r;
};
