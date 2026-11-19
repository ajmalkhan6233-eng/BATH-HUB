'use strict';
// Sale profit window (read only, owner or admin only). Mounted at /api/sale-profit in server.js.
//   POST /api/sale-profit  { items:[{item_code, qty, unit_price}], discount, price }
//   -> cost, selling total, discount, profit Rs and %, and how many lines have no known cost.
// It only READS products.avg_cost. It changes nothing. Cost never goes to a bill, quotation or WhatsApp text.
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
router.use((req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' })));
const r2 = n => Math.round((+n || 0) * 100) / 100;

function sum(lines, discount, price) {
  const sub = r2(lines.reduce((a, l) => a + l.qty * l.unit_price, 0));
  const cost = r2(lines.reduce((a, l) => a + l.qty * l.cost, 0));
  const disc = Math.max(0, +discount || 0);
  // a typed package price wins; otherwise it is the selling total less the discount
  const total = price > 0 ? r2(price) : Math.max(0, r2(sub - disc));
  const profit = r2(total - cost);
  return { subtotal: sub, discount: price > 0 ? r2(Math.max(0, sub - total)) : disc, total, cost, profit, pct: total > 0 ? r2(profit / total * 100) : 0 };
}

router.post('/', express.json({ limit: '200kb' }), async (req, res) => {
  try {
    const raw = Array.isArray(req.body && req.body.items) ? req.body.items.slice(0, 200) : [];
    const codes = [...new Set(raw.map(i => String(i.item_code || '').trim()).filter(Boolean))];
    const cost = {};
    if (codes.length) {
      const q = await pool.query('SELECT item_code, avg_cost FROM products WHERE item_code = ANY($1)', [codes]);
      q.rows.forEach(r => { cost[r.item_code] = +r.avg_cost || 0; });
    }
    let unknown = 0;
    const lines = raw.map(i => {
      const code = String(i.item_code || '').trim();
      const c = code && cost[code] > 0 ? cost[code] : 0;
      if (!c && (+i.qty > 0)) unknown++;
      return { item_code: code, qty: +i.qty || 0, unit_price: +i.unit_price || 0, cost: c };
    });
    res.json({ ...sum(lines, req.body && req.body.discount, +(req.body && req.body.price) || 0), unknown, lines: lines.length });
  } catch (e) { res.status(500).json({ error: 'Could not work out the profit' }); }
});

module.exports = router;
module.exports.sum = sum;
