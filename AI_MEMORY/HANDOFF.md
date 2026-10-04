# HANDOFF (2026-10-04)
- Merged + pushed master 7e0852f: vendor ledger (tables live in owner DB), route /api/vendor-ledger, menu entry, logo lockup everywhere. apex-server restarted; /health ok on port 3100.
- Rollback: git revert -m 1 7e0852f (tables: psql -f scripts/vendor_ledger_down.sql).
- Next per BUILD.md: W3 GRN->vendor bill button, W4 photos, W5 cheque import (dry run), W6 OUR_BANK setting, then Build 0/2.
- Not browser-checked: vendor-ledger page at 390px, logo look on each page, logged-in vendor-ledger API calls.
- Master push also carried the earlier local memory commits.
