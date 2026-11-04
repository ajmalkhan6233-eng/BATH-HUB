const { checkSite, report, brokenText } = require('../../scripts/website_health_check');
const HTML = '<title>Royal Bath Hub</title><link rel="icon" href="/brand/favicon-32.png"><meta content="https://x.app/brand/share-1200x630.jpg"><script type="module" src="/assets/index-abc.js"></script>';
const JS = 'x'.repeat(2000) + 'https://wa.me/94777999219 සිංහල தமிழ்';
const fake = (over = {}) => async (url) => {
  const p = url.replace('https://x.app', '');
  const table = { '/': [200, HTML], '/assets/index-abc.js': [200, JS], '/brand/favicon-32.png': [200, ''], '/brand/share-1200x630.jpg': [200, ''], '/admin': [200, HTML], '/.netlify/functions/login': [405, ''], ...over };
  const [status, body] = table[p] || [404, ''];
  if (status === 'throw') throw new Error('network down');
  return { status, text: async () => body };
};
describe('website health check', () => {
  test('healthy site: every check OK', async () => {
    const r = await checkSite('https://x.app', fake());
    expect(r.ok).toBe(true); expect(r.results.every((x) => x.ok)).toBe(true); expect(report([r], 't')).toContain('ALL OK');
  });
  test('a missing picture, a missing WhatsApp link and a dead login function are each reported', async () => {
    const r = await checkSite('https://x.app', fake({ '/brand/favicon-32.png': [404, ''], '/assets/index-abc.js': [200, 'x'.repeat(2000)], '/.netlify/functions/login': [502, ''] }));
    expect(r.ok).toBe(false);
    expect(r.results.filter((x) => !x.ok).map((x) => x.name)).toEqual(['logo, favicon and share pictures load', 'WhatsApp button in the site', 'Sinhala and Tamil switch in the site', 'admin login function answers']);
    expect(brokenText([r])).toContain('WEBSITE PROBLEM');
  });
  test('site down is one clear failure; a login-protected draft is not an alarm', async () => {
    const down = await checkSite('https://x.app', fake({ '/': ['throw', ''] }));
    expect(down.ok).toBe(false); expect(down.results[0]).toMatchObject({ name: 'page loads', ok: false });
    const prot = await checkSite('https://x.app', fake({ '/': [401, ''] }));
    expect(prot).toMatchObject({ protected: true, ok: true });
  });
});
