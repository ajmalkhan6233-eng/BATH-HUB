'use strict';
// Ported pages (Reports & Analytics, Staff): file exists, jumps into the shell, no external URLs, inline scripts parse.
const fs = require('fs');
const path = require('path');

const PAGES = [
  ['reports_analytics.html', '/owner#/reports2'],
  ['staff.html', '/owner#/staff'],
];

describe.each(PAGES)('%s', (file, hash) => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', file), 'utf8');
  test('has the redirect-to-shell script first in head', () => {
    expect(html).toContain("window.top === window.self");
    expect(html).toContain(hash);
  });
  test('has no external URLs', () => {
    expect(html).not.toMatch(/https?:\/\//i);
  });
  test('inline scripts parse', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    scripts.forEach(s => expect(() => new Function(s)).not.toThrow());
  });
});

test('staff page offers the salary attachment widget', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'staff.html'), 'utf8');
  expect(html).toContain('data-attach="salary"');
  expect(html).toContain('/attach-widget.js');
});
