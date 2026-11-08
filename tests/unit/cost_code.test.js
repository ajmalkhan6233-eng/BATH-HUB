'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../../public/costcode.js');
test('MONEYTALKS: 1=M 2=O 3=N 4=E 5=Y 6=T 7=A 8=L 9=K 0=S', () => {
  expect(C.costCode(1600)).toBe('MTSS');
  expect(C.costCode(2450)).toBe('OEYS');
  expect(C.costCode(1234567890)).toBe('MONEYTALKS');
  expect(C.costCode(1234.6)).toBe('MONEYT'.slice(0, 0) + C.costCode(1235));
});
test('no cost, zero or junk gives no code (nothing is printed)', () => {
  for (const v of [0, null, undefined, '', 'abc', -5]) expect(C.costCode(v)).toBe('');
});
test('decode reverses it, and refuses letters outside the key', () => {
  expect(C.decode('MTSS')).toBe('1600');
  expect(C.decode('OEYS')).toBe('2450');
  expect(C.decode('XYZ')).toBe('');
});
test('PRIVATE: only the owner label page may load the cost code', () => {
  const pub = path.join(__dirname, '..', '..', 'public');
  const users = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.name === '_archive' || f.name === 'lib') continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (/\.(html|js)$/.test(f.name) && f.name !== 'costcode.js' && /costcode|CostCode/.test(fs.readFileSync(p, 'utf8'))) users.push(path.relative(pub, p));
  } })(pub);
  expect(users).toEqual(['labels.html']);
});
