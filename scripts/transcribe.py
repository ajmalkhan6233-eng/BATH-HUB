# Free local speech-to-text for voice notes. One-time: pip install faster-whisper   (first run downloads the model)
# Usage: python scripts/transcribe.py <audio file>   -> prints JSON {"text": "...", "language": "en"}
import sys, json, os
from faster_whisper import WhisperModel
model = WhisperModel(os.environ.get("WHISPER_MODEL", "base"), device="cpu", compute_type="int8")
segments, info = model.transcribe(sys.argv[1], beam_size=1, vad_filter=True)
print(json.dumps({"text": " ".join(s.text.strip() for s in segments).strip(), "language": info.language}))
