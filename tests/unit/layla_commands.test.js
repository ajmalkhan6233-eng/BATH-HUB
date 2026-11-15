const C = require('../../public/layla-commands.js');
test('opens tabs only with an open verb', () => {
  expect(C.match('open morning brief').key).toBe('morningbrief');
  expect(C.match('Please open the audit log').key).toBe('adminaudit');
  expect(C.match('go to agent rules').key).toBe('agent-rules');
  expect(C.match('take me to due board').key).toBe('dueboard');
  expect(C.match('how many cheques do I owe')).toBeNull();
  expect(C.match('show me stock')).toBeNull();
});
test('handle says what it did', () => {
  const said = []; global.window = undefined;
  expect(C.handle('what is the weather', (m) => said.push(m))).toBe(false);
  expect(C.handle('open brain', (m) => said.push(m))).toBe(true);
  expect(said.length).toBe(1);
});
