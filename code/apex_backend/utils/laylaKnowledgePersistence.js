// laylaKnowledgePersistence.js
const pool = require('./db'); // CLAUDE_CODE_WIRES_THIS

/**
 * Saves an owner's correction permanently against a tenant's LAYLA config,
 * so it survives beyond the current chat session and loads into every
 * future conversation's system prompt — fixes "I taught her but it didn't stick."
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

// CLAUDE_CODE_WIRES_THIS: call buildCorrectionsPrompt(tenantId) and prepend its
// output to the system prompt on every LAYLA request for that tenant. Call
// saveLaylaCorrection() whenever the owner corrects LAYLA in conversation.
