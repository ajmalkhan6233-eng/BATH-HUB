// Global env vars required by server.js before any module is loaded
process.env.SESSION_SECRET = 'bathco-test-secret-not-real';
process.env.ADMIN_PIN      = '9999';
process.env.NODE_ENV       = 'test';
process.env.PORT           = '0'; // OS-assigned port; prevents conflicts
