// Port check: the three standalone pages that replace the old Purchasing / Accounting / Audit screens.
const fs = require('fs');
const path = require('path');

const PAGES = [
  ['purchasing.html', '/owner#/purchasing'],
  ['accounting.html', '/owner#/accounting'],
  ['audit_accounting.html', '/owner#/auditacc'],
];

describe.each(PAGES)('%s port', (file, hash) => {
  const html = fs.existsSync(path.join(__dirname, '../../public', file))
    ? fs.readFileSync(path.join(__dirname, '../../public', file), 'utf8') : '';

  test('file exists', () => { expect(html.length).toBeGreaterThan(500); });
  test('has the open-inside-shell redirect', () => {
    expect(html).toContain(`if (window.top === window.self) location.replace('${hash}')`);
  });
  test('has no external URLs', () => { expect(/https?:\/\//.test(html)).toBe(false); });
  test('inline scripts parse', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    expect(scripts.length).toBeGreaterThan(1);
    scripts.forEach(s => { expect(() => new Function(s)).not.toThrow(); });
  });
});
