# Free local speech-to-text for voice notes (faster-whisper, runs on this PC only).
# One-time: pip install faster-whisper   (first run downloads the model)
# Usage: python scripts/transcribe.py <audio file>   -> prints JSON {"text": "...", "language": "en"}
# 23 Oct 2026: model "small" (was "base"), and only English or Sinhala are accepted. A guess of any other language (it called an
# English note "Tamil") is thrown away and the note is read again as English. Empty result is retried without the silence filter.
import sys, json, os
from faster_whisper import WhisperModel

ALLOWED = ("en", "si")
HINT = "Royal Bath Hub, Kandy Road, Thihariya. Tiles, basin, commode, tap, shower, cheque, GRN, vendor, bill, stock, price."
model = WhisperModel(os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
path = sys.argv[1]


def run(lang=None, vad=True):
    segs, info = model.transcribe(path, beam_size=5, vad_filter=vad, language=lang,
                                  initial_prompt=HINT if lang in (None, "en") else None)
    return " ".join(s.text.strip() for s in segs).strip(), info


text, info = run()
lang = info.language
if lang not in ALLOWED or (info.language_probability or 0) < 0.5:
    text, _ = run("en")
    lang = "en"
if not text:
    text, _ = run(lang, vad=False)
print(json.dumps({"text": text, "language": lang}, ensure_ascii=False))
