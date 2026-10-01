'use strict';
// Static checks on public/bathco_complete.html (no browser): the inline script still parses, every nav tab has a
// page section, and every element id the new tabs' code looks up exists in the HTML. A missing id only fails
// once someone clicks, so this catches it early.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'bathco_complete.html'), 'utf8');
const inboxJs = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'document-inbox.js'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const body = html.replace(/<script[\s\S]*?<\/script>/g, '');
const ids = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

describe('bathco_complete.html', () => {
  test('every inline script parses', () => {
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) expect(() => new vm.Script(code)).not.toThrow();
  });

  test('every nav item has a page section and a title entry', () => {
    const pages = [...html.matchAll(/class="nav-item[^"]*"\s+data-page="([^"]+)"/g)].map(m => m[1]);
    expect(pages.length).toBeGreaterThan(10);
    for (const p of pages) {
      expect(ids.has('page-' + p)).toBe(true);
    }
    for (const p of ['agent-rules', 'enquiries', 'content', 'competitors', 'webcat', 'replies', 'policy', 'branches', 'shoptools', 'agentreview', 'docinbox']) {
      expect(pages).toContain(p);
      expect(html).toMatch(new RegExp(`navigate\\(page\\)[\\s\\S]*?if \\(page === '${p}'\\)`));
    }
  });

  test('ids looked up by the new tabs exist in the page', () => {
    const code = scripts.join('\n');
    const prefixes = /^(ar|enq|cp|cw|wc|rd|pn|br|st|sp|av|di)-/;
    const used = new Set();
    for (const m of code.matchAll(/getElementById\('([^']+)'\)/g)) used.add(m[1]);
    for (const m of code.matchAll(/stNum\('([^']+)'\)/g)) used.add(m[1]);
    for (const m of code.matchAll(/\[('ar-id'[^\]]*)\]/g)) for (const x of m[1].matchAll(/'([^']+)'/g)) used.add(x[1]);
    for (const m of code.matchAll(/\[('enq-product'[^\]]*)\]/g)) for (const x of m[1].matchAll(/'([^']+)'/g)) used.add(x[1]);
    for (const m of code.matchAll(/\[('rd-ref'[^\]]*)\]/g)) for (const x of m[1].matchAll(/'([^']+)'/g)) used.add(x[1]);
    const mine = [...used].filter(id => prefixes.test(id));
    expect(mine.length).toBeGreaterThan(30);
    const missing = mine.filter(id => !ids.has(id));
    expect(missing).toEqual([]);
  });

  test('the new tabs only call API routes that exist', () => {
    const code = html + inboxJs;   // includes onclick window.open('/api/...') attributes, not only the script blocks
    const urls = new Set([...code.matchAll(/['"`](\/api\/[a-z0-9.\-\/]+)/gi)].map(m => m[1].replace(/\/$/, '')));
    const routeSrc = fs.readdirSync(path.join(__dirname, '..', '..', 'routes')).map(f => fs.readFileSync(path.join(__dirname, '..', '..', 'routes', f), 'utf8')).join('\n');
    const mounted = ['/api/agent/rules', '/api/agent/rulebook', '/api/enquiries', '/api/content-posts', '/api/competitors', '/api/catalogue-web',
      '/api/reply-drafts', '/api/policy-notes', '/api/branches', '/api/tools/tile-estimate', '/api/tools/price-per-sqm', '/api/items', '/api/items/reorder',
      '/api/items/export.csv', '/api/pos-bills/summary', '/api/pos-bills/top-items', '/api/agent-brain/draft', '/api/agent-brain/reviews', '/api/document-inbox', '/api/document-inbox/upload'];
    for (const u of mounted) {
      expect(urls.has(u) || [...urls].some(x => x.startsWith(u))).toBe(true);          // the UI uses it
      const route = u.replace('/api', '');
      expect(routeSrc.includes(`'${route}`) || routeSrc.includes(`'${route}'`)).toBe(true);   // and a route file defines it
    }
  });

  test('the Document Inbox is also in the main BATHCO_NATURE screen, with every id its script needs', () => {
    const nature = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'BATHCO_NATURE.html'), 'utf8');
    expect(nature).toContain('<script src="/document-inbox.js"></script>');
    expect(nature).toMatch(/id="page-docinbox"/);
    expect(nature).toMatch(/docinbox:\(\)=>loadDocInbox\(\)/);
    const natIds = new Set([...nature.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
    for (const m of inboxJs.matchAll(/getElementById\('([^']+)'\)/g)) if (!m[1].includes('${')) expect(natIds.has(m[1])).toBe(true);
    expect(() => new vm.Script(inboxJs)).not.toThrow();
  });
});
