'use strict';
// Every inline <script> on every public page must parse. (A stray "</body>" inside a JS string once broke the daily ledger when a tag was added by find-and-replace.)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', 'public');

test.each(fs.readdirSync(dir).filter((f) => f.endsWith('.html')))('%s inline scripts parse', (f) => {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((code) => expect(() => new Function(code)).not.toThrow());
});
