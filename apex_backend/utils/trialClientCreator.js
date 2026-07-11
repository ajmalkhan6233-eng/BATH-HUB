// trialClientCreator.js
const pool = require('./db'); // CLAUDE_CODE_WIRES_THIS
const { validateSubdomain } = require('./subdomainValidator'); // confirmed working from AI Studio — Task 5

async function createTrialClient(formData) {
  const { shopName, ownerName, industryType, whatsappNumber, whatsappConsent, packageTier, trialDays } = formData;

  const { valid, cleaned, error } = validateSubdomain(shopName);
  if (!valid) throw new Error(`Invalid shop name for subdomain: ${error}`);

  const trialExpiresAt = trialDays
    ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
    : null;

  const status = trialDays ? 'TRIAL' : 'ACTIVE';

  const { rows } = await pool.query(
    `INSERT INTO tenants (shop_name, owner_name, industry_type, whatsapp_number, whatsapp_consent, package_tier, subdomain, status, trial_expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, subdomain`,
    [shopName, ownerName, industryType, whatsappNumber, whatsappConsent, packageTier, cleaned, status, trialExpiresAt]
  );

  const link = `https://${rows[0].subdomain}.noordigital.lk`;
  const waMessage = encodeURIComponent(`Hi ${ownerName}, here's your NOOR DIGITAL trial link: ${link}`);
  const waLink = `https://wa.me/${whatsappNumber}?text=${waMessage}`;

  return { tenantId: rows[0].id, link, waLink };
}

module.exports = { createTrialClient };

// CLAUDE_CODE_WIRES_THIS: hook this into the "New Client Entry" form submit handler.
