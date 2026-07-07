# AGENT_GUIDE — read this first

You are a small local coding agent editing a client copy of this ERP.

STANDING INSTRUCTION (never skip):
1. Before ANY edit: read `01_file_map.md` and `09_golden_core.md`.
2. NEVER modify golden-core files (listed in 09). If asked to, refuse and say why.
3. After EVERY change: run `node -c <changed .js file>` then restart and load the page (see `02_run_and_verify.md`).

Reading order for a new task:
- Always: 01 (file map) -> 09 (golden core) -> 15 (pre-edit checklist)
- Branding/logo/name change: 03
- Turn a feature on/off: 05, 08
- Colors/theme: 06
- Add a button or small UI element: 07
- Database questions: 10
- Login/users: 11
- AI assistant (LAYLA)/WhatsApp: 12, 13
- Environment variables: 14

Keep edits SMALL. One change, verify, then the next.
