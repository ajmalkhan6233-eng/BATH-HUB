'use strict';
/** TEST MODE (one switch in .env: TEST_MODE=true). While it is on: a red banner shows on the money screens, and customer
 *  receipts go ONLY to numbers listed in TEST_WA_ALLOW (comma list, e.g. the owner's own number), with "[TEST]" in front. */
const digits = (v) => String(v || '').replace(/\D/g, '');
const isTest = (env = process.env) => String(env.TEST_MODE || '').toLowerCase() === 'true';
const allowList = (env = process.env) => String(env.TEST_WA_ALLOW || '').split(',').map(digits).filter((d) => d.length >= 9);
/** Returns the text to send, or throws a plain-words Error when this number must not get a message in test mode. */
function guardReceipt(env, to, text) {
  if (!isTest(env)) return text;
  const list = allowList(env);
  if (!list.length) throw new Error('test mode: no TEST_WA_ALLOW number set, nothing sent');
  const d = digits(to);
  if (!list.some((a) => d.endsWith(a.slice(-9)))) throw new Error('test mode: that number is not in TEST_WA_ALLOW, nothing sent');
  return '[TEST] ' + text;
}
module.exports = { isTest, allowList, guardReceipt };
