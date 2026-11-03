# CLOUD PLAYBOOK (read before any build; saves about 10 tool calls per session)
TEST ONE FILE:   bash scripts/dev/cloud_test.sh tests/unit/<file>.test.js
TEST COPY APP:   bash scripts/dev/cloud_test.sh --rig-only   -> http://localhost:3199 (database bhtest, fake data, login off). Restart after route changes: kill the old "node server.js" by PID (never `pkill -f`, it kills your own shell), then run again.
REAL DB TEST:    psql -h localhost -U bh -d bhtest (PGPASSWORD=bh). Vendor tables: node scripts/migrate_vendor_ledger.js with DB_HOST=localhost DB_NAME=bhtest DB_USER=bh DB_PASSWORD=bh.
PHONE LOOK:      playwright is installed: chromium.launch(), viewport 390x780, screenshot, then Read the png. Only at gates.
BASELINE:        full suite has 14 failing tests in 11 old suites (app_settings, labels_assistant_port, pos_bill_corrections, pos_ledger, pos_payments, pos_summary, bugcheck_static, cheque_status_consistency, cost_code, dynamic_sql_allowlist, offline_queue). Nothing may add to it.
CANNOT DO HERE: reach the PC, real shop data, YouTube/Instagram, WhatsApp. Those are one paste line for Ajmal.
PUSH:            git push origin work (retry up to 4 times if the network fails). Stage named files only; node_modules is a symlink, never add it.
