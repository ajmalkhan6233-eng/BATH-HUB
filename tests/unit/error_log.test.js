'use strict';
const { clean } = require('../../routes/client_errors');
test('query strings and phone numbers never reach the log', () => {
  const out = clean('No answer: /api/x?phone=0771234567&n=a call +94 77 123 4567 now', 300);
  expect(out).not.toMatch(/phone=|\d{4}/);
  expect(out).toContain('/api/x');
});
