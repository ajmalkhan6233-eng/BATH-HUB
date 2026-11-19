const scan = require('../../public/pos-camera-scan.js');

describe('PosCameraScan.accept (same code twice in 2 s = one scan)', () => {
  test('first read counts', () => expect(scan._accept('001', null, 1000)).toBe(true));
  test('same code inside 2 s is ignored', () => expect(scan._accept('001', { text: '001', at: 1000 }, 2500)).toBe(false));
  test('same code after 2 s counts again', () => expect(scan._accept('001', { text: '001', at: 1000 }, 3200)).toBe(true));
  test('different code counts at once', () => expect(scan._accept('002', { text: '001', at: 1000 }, 1200)).toBe(true));
  test('blank or null is ignored', () => { expect(scan._accept('  ', null, 1)).toBe(false); expect(scan._accept(null, null, 1)).toBe(false); });
  test('trims spaces', () => expect(scan._accept(' 001 ', { text: '001', at: 1000 }, 1100)).toBe(false));
});
