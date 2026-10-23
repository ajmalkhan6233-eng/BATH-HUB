# Voice note -> text, free, runs on this PC only (faster-whisper). Usage: python scripts/stt_whisper.py <audio file>
# Prints the spoken words and nothing else. First run downloads the "small" model once (about 460 MB), after that it is offline.
import sys
if len(sys.argv) < 2:
    sys.exit(2)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
from faster_whisper import WhisperModel
model = WhisperModel("small", device="cpu", compute_type="int8")
segments, _info = model.transcribe(sys.argv[1], beam_size=5, vad_filter=True)
print(" ".join(s.text.strip() for s in segments).strip())
