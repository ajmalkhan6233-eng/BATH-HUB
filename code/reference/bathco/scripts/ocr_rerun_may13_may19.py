"""
Targeted OCR re-run: May 13 and May 19 photos only.
Reads photos still on disk for those dates, runs fresh OCR, prints results.
Does NOT update the DB or the main results JSON.
Financial data changes require Ajmal confirmation before import.
"""
import sys, base64, json, re
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from pathlib import Path
from openai import OpenAI

MODEL  = "google/gemma-4-26b-a4b-it:free"
SOURCE = Path(r"C:\Users\DELL\Desktop\complet till 17-06-2026")

PROMPT = """This is a photo from a bathroom products retail store in Sri Lanka.
It may show a handwritten daily expense/sales summary sheet OR a single receipt/invoice.
Extract all financial data. Return ONLY valid JSON, no explanation:
{
  "total_sale": 0,
  "total_expenses": 0,
  "expense_items": "item1:amount, item2:amount",
  "confidence": "high/medium/low",
  "sheet_type": "daily_summary/single_receipt/unclear"
}
Rules:
- All amounts in LKR (Sri Lankan Rupees)
- sheet_type = "daily_summary" if you see a full day summary (total sales + multiple expenses)
- total_expenses: sum of ALL expense items on this sheet if visible, else 0
- expense_items: comma-separated "description:amount" pairs
- Use 0 for anything not visible
Return ONLY the JSON."""

def load_key():
    for line in Path(r"C:\BATHCO_PHASE1\.env").read_text(encoding='utf-8', errors='replace').splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            if k.strip() == 'OPENROUTER_API_KEY':
                return v.strip()
    return ''

def ocr_photo(client, path: Path) -> dict:
    raw = path.read_bytes()
    b64 = base64.standard_b64encode(raw).decode()
    try:
        resp = client.chat.completions.create(
            model=MODEL, max_tokens=500, timeout=60,
            messages=[{'role': 'user', 'content': [
                {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64}'}},
                {'type': 'text', 'text': PROMPT}
            ]}]
        )
        text = resp.choices[0].message.content.strip()
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'): text = text[4:]
            text = text.strip()
        try:
            return json.loads(text)
        except Exception:
            s, e = text.find('{'), text.rfind('}')
            try:    return json.loads(text[s:e+1]) if s >= 0 else {'raw': text[:200], 'confidence': 'low'}
            except: return {'raw': text[:200], 'confidence': 'error'}
    except Exception as ex:
        return {'confidence': 'error', 'error': str(ex)[:200]}

def collect_target_photos():
    target_dates = {'2026-05-13', '2026-05-19'}
    photos = {}
    for path in sorted(SOURCE.rglob('*.jpeg')) + sorted(SOURCE.rglob('*.jpg')):
        if not re.search(r'whatsapp', path.name, re.I): continue
        m = re.search(r'(\d{4})-(\d{2})-(\d{2})', path.name)
        if not m: continue
        date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
        if date_str not in target_dates: continue
        photos.setdefault(date_str, []).append(path)
    return photos

def main():
    key = load_key()
    if not key:
        print('ERROR: OPENROUTER_API_KEY not found'); return

    client = OpenAI(
        base_url='https://openrouter.ai/api/v1', api_key=key,
        timeout=60, max_retries=0,
        default_headers={'HTTP-Referer': 'https://bathco.lk', 'X-Title': 'Bathco OCR'}
    )

    photos = collect_target_photos()
    if not photos:
        print('No photos found for May 13 or May 19 on disk.')
        return

    print(f'Model: {MODEL}')
    print(f'Dates found on disk: {sorted(photos.keys())}')
    for d in sorted(photos):
        print(f'  {d}: {len(photos[d])} photo(s)')
    print()

    all_results = {}
    for date_str in sorted(photos):
        print(f'=== {date_str} ===')
        results = []
        for path in sorted(photos[date_str], key=lambda p: p.name):
            print(f'  Processing: {path.name} ... ', end='', flush=True)
            result = ocr_photo(client, path)
            result['_file'] = path.name
            results.append(result)
            conf  = result.get('confidence', '?')
            texp  = result.get('total_expenses', 0)
            tsale = result.get('total_sale', 0)
            items = result.get('expense_items', '')[:80]
            print(f'conf={conf}  total_exp={texp}  total_sale={tsale}')
            if items:
                print(f'    items: {items}')

        all_results[date_str] = results

        # Aggregate
        summary_sheets = [r for r in results if float(r.get('total_sale') or 0) > 0]
        if summary_sheets:
            best = max(summary_sheets, key=lambda r: float(r.get('total_expenses') or 0))
            total = float(best.get('total_expenses') or 0)
            method = 'summary_sheet'
        else:
            # sum unique items
            seen = {}
            for r in results:
                for item in (r.get('expense_items') or '').split(','):
                    item = item.strip()
                    if ':' not in item: continue
                    desc, amt_s = item.rsplit(':', 1)
                    try:
                        amt = float(amt_s.strip().replace(',',''))
                        key2 = f"{desc.strip().lower()}:{amt:.0f}"
                        seen[key2] = amt
                    except: pass
            total = sum(seen.values())
            method = 'sum_of_items' if seen else 'sum_of_totals'
            if not seen:
                total = sum(float(r.get('total_expenses') or 0) for r in results if r.get('confidence') != 'error')

        print(f'\n  AGGREGATE for {date_str}: {total:,.0f} LKR  (method: {method})')
        print()

    print('=== SUMMARY ===')
    print('Current DB values:')
    print('  2026-05-13  total_expenses = 53,820  net_profit = 185,334.85')
    print('  2026-05-19  total_expenses = 50,400  net_profit = -13,957.88')
    print()
    print('OCR re-run results (new):')
    for date_str in sorted(all_results):
        results = all_results[date_str]
        summary_sheets = [r for r in results if float(r.get('total_sale') or 0) > 0]
        if summary_sheets:
            best = max(summary_sheets, key=lambda r: float(r.get('total_expenses') or 0))
            total = float(best.get('total_expenses') or 0)
            method = 'summary_sheet'
        else:
            seen = {}
            for r in results:
                for item in (r.get('expense_items') or '').split(','):
                    item = item.strip()
                    if ':' not in item: continue
                    desc, amt_s = item.rsplit(':', 1)
                    try:
                        amt = float(amt_s.strip().replace(',',''))
                        seen[f"{desc.strip().lower()}:{amt:.0f}"] = amt
                    except: pass
            total = sum(seen.values())
            method = 'sum_of_items' if seen else 'sum_of_totals'
        print(f'  {date_str}  total_expenses = {total:,.0f}  (method: {method})')

    print()
    print('DB update requires Ajmal confirmation before import.')

if __name__ == '__main__':
    main()
