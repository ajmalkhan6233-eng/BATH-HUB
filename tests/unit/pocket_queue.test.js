const Q = require('../../pocket/queue');
const mem = () => { const m = {}; return { get: (k) => (k in m ? m[k] : null), set: (k, v) => { m[k] = v; } }; };
test('PC off: bill is saved, posted once, answer arrives later, never duplicated', async () => {
  const sent = []; let answer = null, netUp = true;
  const q = Q.make({ LS: mem(), limit: 50, toShop: async (c) => { if (!netUp) throw new Error('no signal'); sent.push(c.id); return c.id; }, fromShop: async () => answer });
  q.add({ type: 'bill', items: [] }, 'Rs 100', 'id-AAAAAAAA');
  netUp = false; let l = await q.tick(); expect(l[0].posted).toBe(false); expect(sent).toEqual([]);          // phone offline: stays saved
  netUp = true; l = await q.tick(); expect(l[0].posted).toBe(true); expect(l[0].answer).toBeNull(); expect(sent).toEqual(['id-AAAAAAAA']); // posted, shop PC still off
  l = await q.tick(); expect(sent).toEqual(['id-AAAAAAAA']);                                               // not posted again
  answer = { ok: true, bill_number: 'B1' }; l = await q.tick(); expect(l[0].answer.bill_number).toBe('B1');
  q.remove('id-AAAAAAAA'); expect(q.load()).toEqual([]);
});
test('a hanging network never hangs the app, oldest bill stays first', async () => {
  const q = Q.make({ LS: mem(), limit: 30, toShop: () => new Promise(() => {}), fromShop: async () => null });
  q.add({ n: 1 }, 'a', 'id-11111111'); q.add({ n: 2 }, 'b', 'id-22222222');
  const t = Date.now(); const l = await q.tick(); expect(Date.now() - t).toBeLessThan(500);
  expect(l.map((x) => x.id)).toEqual(['id-11111111', 'id-22222222']); expect(l.every((x) => !x.posted)).toBe(true);
});
