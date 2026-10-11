// Cheque clearing rule (pure functions) + CSV import dry run (no database touched).
const { clearingDate, alertDates, status } = require('../../utils/cheque_clearing');

describe('clearingDate', () => {
  test('Fri -> Mon, Sat/Sun -> Tue, Mon-Thu -> next working day', () => {
    expect(clearingDate('2026-10-09')).toBe('2026-10-12'); // Fri
    expect(clearingDate('2026-10-10')).toBe('2026-10-13'); // Sat
    expect(clearingDate('2026-10-11')).toBe('2026-10-13'); // Sun
    expect(clearingDate('2026-10-12')).toBe('2026-10-13'); // Mon
  });
  test('holidays are skipped', () => {
    expect(clearingDate('2026-10-12', ['2026-10-13'])).toBe('2026-10-14');
  });
});

describe('alertDates + status', () => {
  test('three alerts: -3 days, -1 day, morning of', () => {
    expect(alertDates('2026-10-13').map(a => a.when)).toEqual(['2026-10-10', '2026-10-12', '2026-10-13']);
  });
  test('owed / in_transit / cleared', () => {
    expect(status({}, '2026-10-12')).toBe('owed');
    expect(status({ depositDate: '2026-10-09' }, '2026-10-10')).toBe('in_transit');
    expect(status({ depositDate: '2026-10-09' }, '2026-10-12')).toBe('cleared');
  });
});

describe('items import dry run', () => {
  test('previews names, saves nothing, rejects missing name header', async () => {
    jest.resetModules();
    const createItem = jest.fn();
    jest.doMock('../../routes/item_catalog', () => ({ createItem }));
    const router = require('../../routes/items_import');
    const handler = router.stack.find(l => l.route && l.route.path === '/items/import-csv').route.stack[0].handle;
    const run = body => new Promise(resolve => {
      const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(o) { resolve({ code: this.statusCode, body: o }); } };
      handler({ body }, res);
    });
    const ok = await run({ csv: 'name,category,selling_price\nTile A,Tiles,100\n"Tap, chrome",Taps,50\n' });
    expect(ok.body.preview).toEqual(['Tile A', 'Tap, chrome']);
    expect(createItem).not.toHaveBeenCalled();
    const bad = await run({ csv: 'title\nx\n' });
    expect(bad.code).toBe(400);
  });
});
