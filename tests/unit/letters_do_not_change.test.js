// 28 Nov 2026 (AJ, shop PC photos): the screen opens with nice thin small letters; a second later they turned big and fat.
const fs = require('fs'); const path = require('path');
const pub = path.join(__dirname, '..', '..', 'public');
const read = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
describe('letters keep the size and weight they open with', () => {
  test('no late script forces small letters bigger', () => {
    const s = read('ui_comfort.js');
    expect(s).not.toMatch(/MINPX/);
    expect(s).not.toMatch(/setProperty\(\s*'font-size'/);
  });
  test.each(['rbh-font.css', 'compact-all.css', 'frame-comfort.css', 'grn-all.css', 'ui_comfort.js'])('%s: normal letters are not drawn thick', (f) => {
    const faces = read(f).match(/@font-face\s*\{[^}]*RBH Sans[^}]*\}/g) || [];
    expect(faces.length).toBeGreaterThan(0);
    faces.filter((x) => /font-weight:\s*(100|400)/.test(x)).forEach((x) => expect(x).not.toMatch(/Semi|Bold/));
  });
});
