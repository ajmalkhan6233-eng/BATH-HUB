'use strict';
const { pickStyle, langNote, needsStrongModel, fallbackLine } = require('../utils/laylaLang');

describe('layla language helper', () => {
  test('Sinhala and Tamil script are detected and go to the strong model', () => {
    expect(pickStyle('ඔයාට සිංහලෙන් කතා කරන්න පුළුවන්ද?')).toBe('si');
    expect(pickStyle('தமிழில் பேச முடியுமா?')).toBe('ta');
    expect(needsStrongModel('si')).toBe(true); expect(needsStrongModel('ta')).toBe(true);
    expect(needsStrongModel('en')).toBe(false); expect(needsStrongModel('singlish')).toBe(false);
  });
  test('Singlish and Tanglish in English letters', () => {
    expect(pickStyle('mata tile eka balanna puluwanda')).toBe('singlish');
    expect(pickStyle('unga kitta tile irukka')).toBe('tanglish');
  });
  test('plain English stays English with no language note', () => {
    expect(pickStyle('Can u talk to me in sinhala')).toBe('en');
    expect(langNote('en')).toBe('');
  });
  test('a short "ok" keeps the language of the customer\'s last message', () => {
    expect(pickStyle('ok', [{ role: 'user', content: 'mata tile eka balanna puluwanda' }, { role: 'assistant', content: 'x' }])).toBe('singlish');
  });
  test('notes tell the AI which language; fallback line is in the customer language', () => {
    expect(langNote('si')).toMatch(/Sinhala script/); expect(langNote('ta')).toMatch(/Tamil script/);
    expect(fallbackLine('si')).toMatch(/[඀-෿]/); expect(fallbackLine('ta')).toMatch(/[஀-௿]/);
    expect(fallbackLine('en')).toMatch(/check/i);
  });
});
