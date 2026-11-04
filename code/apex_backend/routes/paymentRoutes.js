const express = require('express');
const router = express.Router();
const pool = require('../utils/db'); // CLAUDE_CODE_WIRES_THIS
const { logAdminAction } = require('../middleware/auditLogMiddleware');

router.post('/admin/payments', async (req, res) => {
  const { tenant_id, amount_lkr, bank_reference, deposit_date, verified_by_admin_id, notes } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO client_payments (tenant_id, amount_lkr, bank_reference, deposit_date, verified_by_admin_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenant_id, amount_lkr, bank_reference, deposit_date, verified_by_admin_id, notes || null]
    );

    await logAdminAction(verified_by_admin_id, 'PAYMENT_LOGGED', tenant_id, { amount_lkr, bank_reference });

    res.json(rows[0]);
  } catch (err) {
    // Most likely a duplicate bank_reference — surface it clearly
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/payments/:tenantId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM client_payments WHERE tenant_id = $1 ORDER BY deposit_date DESC`,
    [req.params.tenantId]
  );
  res.json(rows);
});

module.exports = router;
