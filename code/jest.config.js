'use strict';
module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/\\.claude/', '/reference/'],   // worktree copies under .claude are not part of this project's tests
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/setup.js'],
  testTimeout: 30000,
  maxWorkers: '50%',                 // the in-memory database tests are timing-sensitive; fewer parallel workers = no random timeouts
};
