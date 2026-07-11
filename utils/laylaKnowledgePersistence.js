// laylaKnowledgePersistence.js (apex integration)
// Per-tenant durable store for owner corrections, in layla_configs.corrections.
//
// Wiring (done): layla.js's TEACH flow mirrors each taught fact here
// (best-effort) for the tenant in APEX_TENANT_ID. LAYLA_TAUGHT_FACTS.md stays
// the single source injected into the prompt on this instance — this store is
// for platform-side visibility/durability, so the prompt never gets the same
// fact twice.
const pool = require('./db');

/**
 * Saves an owner's correction permanently against a tenant's LAYLA config,
 * so it survives beyond the current chat session.
 */
async function saveLaylaCorrection(tenantId, correctionText) {
  await pool.query(
    `UPDATE layla_configs
     SET corrections = corrections || $2::jsonb
     WHERE tenant_id = $1`,
    [tenantId, JSON.stringify([{ text: correctionText, savedAt: new Date().toISOString() }])]
  );
}

/**
 * Builds the correction block to prepend to LAYLA's system prompt for this tenant.
 * (Used by multi-tenant deployments where the file-based taught-facts store
 * isn't available; on this instance the file remains the prompt source.)
 */
async function buildCorrectionsPrompt(tenantId) {
  const { rows } = await pool.query(
    `SELECT corrections FROM layla_configs WHERE tenant_id = $1`,
    [tenantId]
  );
  if (!rows.length || !rows[0].corrections.length) return '';

  const lines = rows[0].corrections.map(c => `- ${c.text}`).join('\n');
  return `IMPORTANT — owner corrections you must always follow:\n${lines}`;
}

module.exports = { saveLaylaCorrection, buildCorrectionsPrompt };
