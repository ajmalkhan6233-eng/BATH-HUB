import openpyxl
from datetime import datetime
from collections import Counter

def load_cheques(filepath):
    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb['Table 1']
    cheques = []
    for row in ws.iter_rows(values_only=True):
        date_val = row[1] if len(row) > 1 else None
        cheq_num = row[2] if len(row) > 2 else None
        amount = row[3] if len(row) > 3 else None
        payee = row[4] if len(row) > 4 else None
        bank = row[5] if len(row) > 5 else None

        if not isinstance(amount, (int, float)):
            continue
        if cheq_num in ('eque Num', None):
            continue
        if not isinstance(cheq_num, (int, str)):
            continue
        if amount <= 0:
            continue

        dt = None
        if isinstance(date_val, datetime):
            dt = date_val
        elif isinstance(date_val, str) and date_val.strip():
            try:
                dt = datetime.strptime(date_val.strip(), '%d-%b')
                dt = dt.replace(year=2026)
            except:
                pass

        cheques.append({
            'date': dt,
            'cheq': cheq_num,
            'amount': amount,
            'payee': str(payee) if payee else '',
            'bank': str(bank) if bank else ''
        })
    return cheques

main_file = r'C:\Users\1st Choice\bathco-data\OUTBOUND_CHEQ_CLEAN.xlsx'
urgent_file = r'C:\Users\1st Choice\bathco-data\URGENT\URGENT\OUTBOUND_CHEQ_CLEAN.xlsx'

main_cheques = load_cheques(main_file)
urgent_cheques = load_cheques(urgent_file)

print("MAIN FILE: %d cheque records in Table 1" % len(main_cheques))
print("URGENT FILE: %d cheque records in Table 1" % len(urgent_cheques))
print()

total_main = sum(c['amount'] for c in main_cheques)
total_urgent = sum(c['amount'] for c in urgent_cheques)
print("MAIN total written: LKR {:,.0f}".format(total_main))
print("URGENT total written: LKR {:,.0f}".format(total_urgent))
print()

today = datetime(2026, 5, 30)
cleared_main = [c for c in main_cheques if c['date'] and c['date'] <= today]
pending_main = [c for c in main_cheques if not c['date'] or c['date'] > today]

print("MAIN: Cleared/issued up to 30 May 2026: %d cheques, LKR {:,.0f}".format(sum(c['amount'] for c in cleared_main)) % len(cleared_main))
print("MAIN: Pending/future-dated (after 30 May): %d cheques, LKR {:,.0f}".format(sum(c['amount'] for c in pending_main)) % len(pending_main))
print()

june = [c for c in main_cheques if c['date'] and c['date'].year==2026 and c['date'].month==6]
print("=== JUNE 2026 (%d cheques) ===" % len(june))
for c in sorted(june, key=lambda x: x['date']):
    print("  %s | Cheq #%s | LKR %s | %s" % (
        c['date'].strftime('%d %b'),
        c['cheq'],
        "{:,.0f}".format(c['amount']),
        c['payee']
    ))
print("  JUNE TOTAL: LKR {:,.0f}".format(sum(c['amount'] for c in june)))
print()

july = [c for c in main_cheques if c['date'] and c['date'].year==2026 and c['date'].month==7]
print("=== JULY 2026 (%d cheques) ===" % len(july))
for c in sorted(july, key=lambda x: x['date']):
    print("  %s | Cheq #%s | LKR %s | %s" % (
        c['date'].strftime('%d %b'),
        c['cheq'],
        "{:,.0f}".format(c['amount']),
        c['payee']
    ))
print("  JULY TOTAL: LKR {:,.0f}".format(sum(c['amount'] for c in july)))
print()

aug = [c for c in main_cheques if c['date'] and c['date'].year==2026 and c['date'].month==8]
print("=== AUGUST 2026 (%d cheques) ===" % len(aug))
for c in sorted(aug, key=lambda x: x['date']):
    print("  %s | Cheq #%s | LKR %s | %s" % (
        c['date'].strftime('%d %b'),
        c['cheq'],
        "{:,.0f}".format(c['amount']),
        c['payee']
    ))
print("  AUGUST TOTAL: LKR {:,.0f}".format(sum(c['amount'] for c in aug)))
print()

print("=== CHEQUE #760329 ISURU PRINTING ===")
hits = [c for c in main_cheques if c['cheq'] == 760329]
for c in hits:
    print("  Date: %s | Amount: LKR %s | Payee: %s" % (c['date'], "{:,.0f}".format(c['amount']), c['payee']))
print("  APPEARS %d TIME(S) in MAIN FILE" % len(hits))
print()

print("=== ISURU PRINTING ALL CHEQUES ===")
isuru = [c for c in main_cheques if 'ISURU' in c['payee'].upper()]
for c in sorted(isuru, key=lambda x: x['date'] if x['date'] else datetime.min):
    print("  Date: %s | Cheq #%s | LKR %s | %s" % (c['date'], c['cheq'], "{:,.0f}".format(c['amount']), c['payee']))
print()

print("=== DUPLICATE CHEQUE NUMBERS IN MAIN FILE ===")
cheq_nums = [c['cheq'] for c in main_cheques]
counts = Counter(cheq_nums)
dups = {k:v for k,v in counts.items() if v > 1}
if dups:
    for cheq_num in sorted(dups.keys(), key=lambda x: int(x) if isinstance(x, int) else 0):
        count = dups[cheq_num]
        entries = [c for c in main_cheques if c['cheq'] == cheq_num]
        print("  Cheq #%s appears %dx:" % (cheq_num, count))
        for e in entries:
            print("    Date: %s | LKR %s | %s" % (e['date'], "{:,.0f}".format(e['amount']), e['payee']))
else:
    print("  No duplicates found")
print()

print("=== FILE COMPARISON ===")
print("Main file records: %d" % len(main_cheques))
print("Urgent file records: %d" % len(urgent_cheques))
main_set = set()
for c in main_cheques:
    main_set.add((c['cheq'], c['amount'], c['date']))

urgent_set = set()
for c in urgent_cheques:
    urgent_set.add((c['cheq'], c['amount'], c['date']))

only_in_main = main_set - urgent_set
only_in_urgent = urgent_set - main_set
print("Entries ONLY in main (not in urgent): %d" % len(only_in_main))
print("Entries ONLY in urgent (not in main): %d" % len(only_in_urgent))

if only_in_main:
    print("MAIN-ONLY entries:")
    for k in sorted(only_in_main, key=lambda x: x[2] if x[2] else datetime.min):
        matching = [c for c in main_cheques if c['cheq']==k[0] and c['amount']==k[1]]
        if matching:
            m = matching[0]
            print("  Cheq #%s | LKR %s | %s | %s" % (m['cheq'], "{:,.0f}".format(m['amount']), m['payee'], m['date']))

if only_in_urgent:
    print("URGENT-ONLY entries:")
    for k in sorted(only_in_urgent, key=lambda x: x[2] if x[2] else datetime.min):
        matching = [c for c in urgent_cheques if c['cheq']==k[0] and c['amount']==k[1]]
        if matching:
            m = matching[0]
            print("  Cheq #%s | LKR %s | %s | %s" % (m['cheq'], "{:,.0f}".format(m['amount']), m['payee'], m['date']))
