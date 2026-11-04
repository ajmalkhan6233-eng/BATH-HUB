'use strict';
// Every local <script src="/..."> on every public page must point at a file that really exists in public/.
// (A missing /js/hyperspace-theme.js once crashed the daily-entry page and everything after it in that script.)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', 'public');
const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));

test.each(pages)('%s local script files exist', (f) => {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]+src=["'](\/[^"'?#]+)/g)].map((m) => m[1]);
  const missing = srcs.filter((s) => !fs.existsSync(path.join(dir, s)));
  expect(missing).toEqual([]);
});

test('hyperspace theme exposes mount, toggle and isEnabled', () => {
  const code = fs.readFileSync(path.join(dir, 'js', 'hyperspace-theme.js'), 'utf8');
  expect(() => new Function(code)).not.toThrow();
  ['mount', 'toggle', 'isEnabled'].forEach((k) => expect(code).toMatch(new RegExp(k)));
});
