const C = require('../public/rbh-charts.js');
test('bars: tallest fills height, count matches', () => { const r = C.barRects([5, 10, 0], 300, 100, 4); expect(r).toHaveLength(3); expect(r[1].h).toBe(100); expect(r[2].h).toBe(0); });
test('diverge: above avg goes up, below goes down', () => { const d = C.diverge([10, 20, 30], 300, 100); expect(d.avg).toBe(20); expect(d.bars[0].up).toBe(false); expect(d.bars[2].up).toBe(true); expect(d.bars[1].h).toBe(0); });
test('ring: clamps 0..1', () => { expect(C.ringDash(2, 46).on).toBe(C.ringDash(1, 46).on); expect(C.ringDash(-1, 46).on).toBe(0); });
test('donut: shares add to full circle', () => { const d = C.donutArcs([1, 1, 2], 40); expect(d.arcs.reduce((a, x) => a + x.len, 0)).toBeCloseTo(2 * Math.PI * 40, 0); });
test('svg builders survive empty and junk input', () => { expect(C.bars([], [])).toContain('<svg'); expect(C.mirrored([5], ['a'])).toContain('<svg'); expect(C.spark([1])).toBe(''); expect(C.donut([{ name: 'x<', value: 'abc' }])).toContain('x&lt;'); expect(C.tubes([{ name: 'a', level: 1, max: 0 }])).toContain('svg'); });
test('rs formats', () => { expect(C.rsFull(1250)).toBe('Rs 1,250'); expect(C.rs(2500)).toBe('Rs 2.5k'); });
