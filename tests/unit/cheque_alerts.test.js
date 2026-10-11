// Cheque alerts to the owner: fake cheque clearing tomorrow produces 4 messages over 4 days, never repeated.
const { alertsDue, buildMessage, runChequeAlerts, FOOTER } = require('../../utils/chequeAlerts');

// deposited Fri 2026-10-09 -> clears Mon 2026-10-12 -> alerts on 09, 10, 11 (Sun) and 12
const cheque = { id: 7, payee: 'Test Supplier', amount: 125000, deposit_date: '2026-10-09', reg_status: 'pending' };

describe('alertsDue', () => {
  test('exactly one alert on each of the 4 days, none on other days', () => {
    const days = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];
    const got = days.map(d => alertsDue([cheque], d).map(a => a.text));
    expect(got).toEqual([[], ['3 days to clearing'], ['2 days to clearing'], ['Tomorrow clears'], ['Clears TODAY (morning)'], []]);
  });
  test('cleared, bounced or not-deposited cheques give nothing', () => {
    expect(alertsDue([{ ...cheque, reg_status: 'cleared' }], '2026-10-12')).toEqual([]);
    expect(alertsDue([{ ...cheque, reg_status: 'bounced' }], '2026-10-12')).toEqual([]);
    expect(alertsDue([{ ...cheque, deposit_date: null }], '2026-10-12')).toEqual([]);
  });
  test('already sent is skipped; holiday moves the clearing date', () => {
    expect(alertsDue([cheque], '2026-10-12', [], new Set(['7|2026-10-12']))).toEqual([]);
    expect(alertsDue([cheque], '2026-10-13', ['2026-10-12'])[0].text).toBe('Clears TODAY (morning)');
  });
  test('message has the amount, payee and the one-line rule footer', () => {
    const m = buildMessage(alertsDue([cheque], '2026-10-12'));
    expect(m).toContain('Test Supplier'); expect(m).toContain('125,000'); expect(m).toContain(FOOTER);
  });
});

describe('runChequeAlerts (fake database, test mode)', () => {
  const sentRows = new Set();
  const pool = { query: async (sql, p) => {
    if (/CREATE TABLE/.test(sql)) return { rows: [] };
    if (/FROM bank_holidays/.test(sql)) return { rows: [] };
    if (/FROM cheque_register/.test(sql)) return { rows: [cheque] };
    if (/SELECT cheque_id/.test(sql)) return { rows: [...sentRows].filter(k => k.endsWith(p[0])).map(k => ({ cheque_id: +k.split('|')[0], d: p[0] })) };
    if (/INSERT INTO cheque_alerts_sent/.test(sql)) { sentRows.add(`${p[0]}|${p[1]}`); return { rows: [] }; }
    throw new Error('unexpected sql ' + sql);
  } };
  test('4 messages on 4 mornings, a repeat run the same day sends nothing, nothing before 07:00', async () => {
    const msgs = [];
    const send = async t => { msgs.push(t); };
    // Sri Lanka 08:00 = 02:30 UTC
    for (const d of ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']) {
      const now = new Date(d + 'T02:30:00Z');
      expect((await runChequeAlerts({ pool, send, now })).sent).toBe(1);
      expect((await runChequeAlerts({ pool, send, now })).sent).toBe(0);
    }
    expect(msgs).toHaveLength(4);
    expect(await runChequeAlerts({ pool, send, now: new Date('2026-10-13T02:30:00Z') })).toEqual({ sent: 0 });
    const early = await runChequeAlerts({ pool, send, now: new Date('2026-10-12T00:30:00Z') }); // 06:00 SL
    expect(early.sent).toBe(0);
  });
});
