#!/usr/bin/env bash
# FRESH CLOUD TEST COPY: drops the test database "bhtest", rebuilds it, seeds fake data, restarts the test app on 3199.
# TEST ONLY. Cloud sandbox only. It only ever touches the database called bhtest and the node server on this machine.
set -u
cd "$(dirname "$0")/../.."
for p in $(ps -eo pid,args | awk '$2=="node" && $3=="server.js" {print $1}'); do kill "$p" 2>/dev/null; done
sleep 2
su postgres -c "psql -qc 'DROP DATABASE IF EXISTS bhtest'" 2>/dev/null
bash scripts/dev/cloud_rig.sh
export DB_HOST=localhost DB_PORT=5432 DB_NAME=bhtest DB_USER=bh DB_PASSWORD=bh
node scripts/dev/seed_test_data.js 2>&1 | tail -1
node scripts/migrate_vendor_ledger.js 2>&1 | tail -1
curl -s -o /dev/null -w "fresh test copy health %{http_code}\n" http://localhost:3199/health
