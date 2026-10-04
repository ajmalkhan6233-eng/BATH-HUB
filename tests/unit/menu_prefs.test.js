'use strict';
const fs = require('fs');
const path = require('path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

test('menu preferences module parses, is loaded by the owner app and cached; Dashboard stays first', () => {
  const code = read('public', 'lib', 'menuPrefs.js');
  expect(() => new Function(code)).not.toThrow();
  expect(code).toContain("['dashboard', 'pos', 'dailyledger'");
  expect(code).toContain("k !== 'dashboard'");              // Dashboard can never be hidden
  expect(read('public', 'bathco_complete.html')).toContain('/lib/menuPrefs.js');
  expect(read('public', 'service-worker.js')).toContain('/lib/menuPrefs.js');
});
