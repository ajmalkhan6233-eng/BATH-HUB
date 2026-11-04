// validateSubdomain("Demo Hardware Stores") -> { valid: true, cleaned: "demo-hardware-stores", error: null }
// Rules (must stay in sync with tenants.subdomain VARCHAR(63) in scripts/migrate_apex.js):
// lowercase a-z0-9- only, 3-30 chars, no leading/trailing/consecutive hyphens.
function validateSubdomain(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, cleaned: '', error: 'A name is required' };
    }
    let cleaned = name.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
    if (cleaned.length > 30) cleaned = cleaned.slice(0, 30).replace(/-+$/g, '');
    if (cleaned.length < 3) {
        return { valid: false, cleaned, error: 'Too short — needs at least 3 usable characters (a-z, 0-9)' };
    }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(cleaned)) {
        return { valid: false, cleaned, error: 'Only lowercase letters, digits and single hyphens allowed' };
    }
    return { valid: true, cleaned, error: null };
}

module.exports = { validateSubdomain };
