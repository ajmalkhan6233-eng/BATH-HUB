"""
ocr_retry_loop.py — autonomous retry wrapper for ocr_expense_photos.py
Runs up to MAX_RETRIES times, waiting WAIT_MIN between each attempt.
Stops early when no "STOPPED" in output (= limit cleared and run finished).
"""
import subprocess, time, datetime, sys, json
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

SCRIPT    = Path(__file__).parent / 'ocr_expense_photos.py'
RESULTS   = Path(__file__).parent / 'ocr_expense_results.json'
MAX_RETRIES = 10
WAIT_MIN    = 31   # minutes between retries

def photos_remaining():
    if not RESULTS.exists(): return 999
    data = json.loads(RESULTS.read_text(encoding='utf-8'))
    done_names = {r['_file'] for r in data if r.get('confidence') not in ('error','skipped','error')}
    # Count May 13 + May 19 photos that still need processing
    target = [r for r in data if ('2026-05-13' in r.get('_file','') or '2026-05-19' in r.get('_file',''))
              and r.get('confidence') not in ('error','skipped')]
    return 36 - len(done_names)  # total target was 36 photos for the 3 conflicted dates

for attempt in range(1, MAX_RETRIES + 1):
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f'\n{"="*60}', flush=True)
    print(f'ATTEMPT {attempt}/{MAX_RETRIES}  [{ts}]', flush=True)
    print(f'{"="*60}', flush=True)

    proc = subprocess.run(
        ['python', str(SCRIPT)],
        capture_output=True, text=True, encoding='utf-8', errors='replace'
    )
    print(proc.stdout, flush=True)
    if proc.stderr.strip():
        print('STDERR:', proc.stderr[:400], flush=True)

    hit_limit = 'STOPPED' in proc.stdout and 'Free-tier' in proc.stdout
    nothing_todo = 'To process: 0 photos' in proc.stdout

    if nothing_todo:
        print(f'\nAll photos already processed. Nothing left to do.', flush=True)
        break

    if not hit_limit:
        print(f'\nRun completed without hitting rate limit.', flush=True)
        break

    if attempt < MAX_RETRIES:
        resume_at = datetime.datetime.now() + datetime.timedelta(minutes=WAIT_MIN)
        print(f'\nRate limit still active. Waiting {WAIT_MIN} min (resume at {resume_at.strftime("%H:%M:%S")})...', flush=True)
        time.sleep(WAIT_MIN * 60)
    else:
        print(f'\nExhausted {MAX_RETRIES} retries. Still rate-limited.', flush=True)

print('\nWrapper finished.', flush=True)
