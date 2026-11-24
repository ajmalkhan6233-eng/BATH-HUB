const { parseCheque } = require('../../routes/cheque_photo');
describe('cheque photo reader (local text -> fields)', () => {
  test('reads number, boxed date, amount and payee', () => {
    const f = parseCheque('HATTON NATIONAL BANK\nDate 1 5 0 1 2 0 2 7\nPay Cash or bearer\nRupees One Hundred Fifty Thousand only\n150,000/-\n123456');
    expect(f).toEqual({ cheque_no: '123456', date: '2027-01-15', amount: 150000, payee: 'Cash', bank: 'HNB' });
  });
  test('slash date is day first, 196000 with dash', () => {
    const f = parseCheque('Pay Metro Enterprises or bearer\n30/03/2027\n196,000/-\n654321');
    expect(f.date).toBe('2027-03-30'); expect(f.amount).toBe(196000); expect(f.cheque_no).toBe('654321'); expect(f.payee).toBe('Metro Enterprises');
  });
  test('rubbish text gives empty fields, never invented ones', () => {
    expect(parseCheque('???')).toEqual({ cheque_no: null, date: null, amount: null, payee: null, bank: null });
  });
});
