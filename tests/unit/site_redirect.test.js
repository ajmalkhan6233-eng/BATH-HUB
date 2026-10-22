'use strict';
const { siteRedirect, DEFAULT_URL } = require('../../utils/siteRedirect');
const run = (env) => { const out = { next: 0, to: null }; siteRedirect(env)({}, { redirect: (c, u) => { out.to = [c, u]; } }, () => { out.next++; }); return out; };

test('flag off or missing: /site is served as before (next)', () => {
  expect(run({}).next).toBe(1);
  expect(run({ SITE_REDIRECT: 'no' }).to).toBe(null);
});
test('flag netlify: 302 to the Netlify website by default', () => {
  expect(run({ SITE_REDIRECT: 'netlify' }).to).toEqual([302, DEFAULT_URL]);
});
test('PUBLIC_SITE_URL is used when it is a plain https address', () => {
  expect(run({ SITE_REDIRECT: 'netlify', PUBLIC_SITE_URL: 'https://royalbathhub.netlify.app' }).to).toEqual([302, 'https://royalbathhub.netlify.app']);
});
test('a bad address is never used (falls through to the local copy)', () => {
  expect(run({ SITE_REDIRECT: 'netlify', PUBLIC_SITE_URL: 'javascript:alert(1)' }).next).toBe(1);
  expect(run({ SITE_REDIRECT: 'netlify', PUBLIC_SITE_URL: 'http://x.test' }).next).toBe(1);
});
