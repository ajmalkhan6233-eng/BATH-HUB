// Global env vars required by server.js before any module is loaded
process.env.SESSION_SECRET = 'bathco-test-secret-not-real';
process.env.ADMIN_PIN      = '9999';
process.env.NODE_ENV       = 'test';
process.env.PORT           = '0'; // OS-assigned port; prevents conflicts

// Tests must never reach a real database (the .env one holds the shop's data, and each route opens its own pool).
// Anything that is not mocked fails fast here instead.
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.DB_NAME = 'bathco_jest_never_used';
delete process.env.DATABASE_URL;
process.env.OWNER_READ_ONLY = 'false';   // the shop's .env turns this on; tests choose per test
