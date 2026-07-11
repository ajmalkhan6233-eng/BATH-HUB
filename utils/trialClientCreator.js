// trialClientCreator.js (apex integration)
// Creates a tenant row for a new trial/paying client and returns the links to
// send them. Exposed via POST /api/apex/trial-clients (routes/apex_admin.js) —
// the future "New Client Entry" UI calls that endpoint.
const pool = require('./db');
const { validateSubdomain } = require('./subdomainValidator');

async function createTrialClient(formData) {
  const { shopName, ownerName, industryType, whatsappNumber, whatsappConsent, packageTier, trialDays } = formData;

  if (!shopName || !ownerName || !industryType) {
    throw new Error('shopName, ownerName and industryType are required');
  }

  const { valid, cleaned, error } = validateSubdomain(shopName);
  if (!valid) throw new Error(`Invalid shop name for subdomain: ${error}`);

  const trialExpiresAt = trialDays
    ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
    : null;

  const status = trialDays ? 'TRIAL' : 'ACTIVE';

  const { rows } = await pool.query(
    `INSERT INTO tenants (shop_name, owner_name, industry_type, whatsapp_number, whatsapp_consent, package_tier, subdomain, status, trial_expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, subdomain`,
    [shopName, ownerName, industryType, whatsappNumber || null, !!whatsappConsent, packageTier || 'Starter', cleaned, status, trialExpiresAt]
  );

  const link = `https://${rows[0].subdomain}.noordigital.lk`;
  const waMessage = encodeURIComponent(`Hi ${ownerName}, here's your NOOR DIGITAL trial link: ${link}`);
  const waLink = whatsappNumber ? `https://wa.me/${String(whatsappNumber).replace(/\D/g, '')}?text=${waMessage}` : null;

  return { tenantId: rows[0].id, link, waLink };
}

module.exports = { createTrialClient };
