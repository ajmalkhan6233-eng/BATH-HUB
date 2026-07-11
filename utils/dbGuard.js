// Startup safety net: a template/client instance must NEVER connect to the
// real shop's live database. If a live .env is ever copied into this folder
// by mistake (the classic accident), the process dies loudly at boot instead
// of silently reading or writing real business data.
//
// Scope: blocks the live LOCAL database by name. A hosted live DB can't be
// caught by name (generic names like "railway") — but reaching one requires
// explicitly pasting its connection URL, which is not a silent failure mode.
const LIVE_DB_NAMES = new Set(['bathco', 'bathco_production']);

function resolvedDbName() {
    if (process.env.DATABASE_URL) {
        try { return decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '')); }
        catch { return ''; }
    }
    return process.env.DB_NAME || 'bathco_template';
}

function assertTemplateSafeDb(context) {
    const name = resolvedDbName();
    if (LIVE_DB_NAMES.has(String(name).toLowerCase())) {
        console.error(
            `[FATAL] ${context}: refusing to start — database "${name}" is the LIVE shop database. ` +
            `This is a template/client instance; point DB_NAME (or DATABASE_URL) at a template or ` +
            `client copy (e.g. bathco_template). No override exists by design.`
        );
        process.exit(1);
    }
    return name;
}

module.exports = { assertTemplateSafeDb };
