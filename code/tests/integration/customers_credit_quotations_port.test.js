'use strict';
// Ported screens (customers, credit & aging, quotations): page exists, opens in the shell, works offline, scripts parse.
const fs = require('fs');
const path = require('path');

const PAGES = { 'customers.html': 'customers', 'credit_aging.html': 'credit', 'quotations.html': 'quotations' };

describe.each(Object.entries(PAGES))('%s', (file, key) => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', file), 'utf8');

  test('redirects to the shell when opened alone', () => {
    expect(html).toContain("if (window.top === window.self) location.replace('/owner#/" + key + "');");
  });
  test('has no external URLs', () => {
    expect(html).not.toMatch(/https?:\/\//);
  });
  test('inline scripts parse', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(() => new Function(s)).not.toThrow();
  });
});
