'use strict';
// READ-ONLY checks from the 19 Nov audit. They change nothing. GET /api/audit-checks
//   dup_codes     = item codes used by more than one active item (these count a sale twice, audit #2)
//   no_cost       = sold items with no cost at all (their profit shows too high, audit #10)
//   negative_stock= items below zero
//   cheque_tables = how many cheques sit in each of the two cheque lists (audit #3)
//   dup_vendors   = vendor names that look like the same vendor
const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const q = async (sql) => { try { return (await pool.query(sql)).rows; } catch (e) { return { error: e.message }; } };
router.get('/audit-checks', async (req, res) => {
  res.json({
    dup_codes: await q(`SELECT item_code, COUNT(*) AS n, string_agg(name, ' | ') AS names FROM products WHERE active = true AND COALESCE(item_code,'') <> '' GROUP BY item_code HAVING COUNT(*) > 1 ORDER BY n DESC LIMIT 100`),
    no_cost: await q(`SELECT i.item_name, i.item_code, COUNT(*) AS lines FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code WHERE COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0) = 0 GROUP BY 1,2 ORDER BY 3 DESC LIMIT 50`),
    negative_stock: await q(`SELECT item_code, name, stock_level FROM products WHERE active = true AND stock_level < 0 ORDER BY stock_level LIMIT 100`),
    cheque_tables: {
      vendor_bill_cheques: await q(`SELECT status, COUNT(*) AS n, COALESCE(SUM(amount),0) AS amount FROM vendor_bill_cheques GROUP BY status`),
      cheque_register: await q(`SELECT status, COUNT(*) AS n, COALESCE(SUM(amount),0) AS amount FROM cheque_register GROUP BY status`),
    },
    dup_vendors: await q(`SELECT lower(regexp_replace(vendor_name,'[^a-zA-Z0-9]','','g')) AS k, string_agg(DISTINCT vendor_name, ' | ') AS names FROM vendor_bills GROUP BY 1 HAVING COUNT(DISTINCT vendor_name) > 1`),
  });
});
module.exports = router;
