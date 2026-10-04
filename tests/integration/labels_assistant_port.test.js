'use strict';
// Ported pages labels.html and assistant.html: file exists, redirect into the shell, no external URLs, scripts parse,
// and the Code-128 encoder gives a correct checksum.
const fs = require('fs');
const path = require('path');

const PAGES = { labels: 'labels.html', assistant: 'assistant.html' };

describe.each(Object.entries(PAGES))('%s page', (key, file) => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', file), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

  test('has the redirect-into-shell script first', () => {
    expect(scripts[0]).toContain("location.replace('/owner#/" + key + "')");
  });
  test('has no external URLs', () => {
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/<script[^>]+src="(?!\/bathhub-(theme|icons|a11y|logo)\.js)/i);   // only the shared design scripts may be linked
  });
  test('inline scripts parse', () => {
    expect(scripts.length).toBeGreaterThan(1);
    scripts.forEach(s => expect(() => new Function(s)).not.toThrow());
  });
});

test('labels: Code-128 encoder produces start, data, checksum and stop', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'labels.html'), 'utf8');
  const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])[1];
  const fn = new Function(src.split('function api(')[0] + '; return encode128;');
  const enc = fn();
  // "A": value 33, checksum (104 + 33*1) % 103 = 34
  const out = enc('A');
  expect(out).toBe('211214' + '111323' + '131123' + '2331112');
});

