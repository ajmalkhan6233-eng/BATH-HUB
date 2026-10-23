# Voice note -> plain text for customer chats (utils/stt.js). Thin wrapper: same reader as the owner chat (scripts/transcribe.py).
import sys, os, json, subprocess
if len(sys.argv) < 2:
    sys.exit(2)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcribe.py"), sys.argv[1]],
                   capture_output=True, text=True, encoding="utf-8")
try:
    print(json.loads(r.stdout).get("text", "").strip())
except Exception:
    sys.exit(1)
