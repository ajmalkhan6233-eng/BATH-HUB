#!/usr/bin/env bash
# CLOUD TEST COPY of the shop app in ONE command. TEST ONLY: never the live shop, never real WhatsApp.
# Usage (cloud sandbox): bash scripts/dev/cloud_rig.sh   -> app on http://localhost:3199 with a test admin.
# Saves the 10 setup steps that were repeated in every new sandbox (22 Oct 2026).
set -u
cd "$(dirname "$0")/../.."
pg_ctlcluster 16 main start 2>/dev/null; sleep 3
su postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='bh'\"" | grep -q 1 || su postgres -c "psql -c \"CREATE ROLE bh LOGIN SUPERUSER PASSWORD 'bh'\"" >/dev/null
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='bhtest'\"" | grep -q 1 || su postgres -c "createdb -O bh bhtest"
export PGPASSWORD=bh
psql -h localhost -U bh -d bhtest -q -f scripts/dev/test_schema.sql >/dev/null 2>&1
psql -h localhost -U bh -d bhtest -q -c "INSERT INTO users (username,name,password_hash,role,active,totp_enabled) VALUES ('qa_admin','QA Admin','x','admin',true,false) ON CONFLICT DO NOTHING" >/dev/null 2>&1
# dependencies: whatsapp-web.js is blocked in the cloud, so leave it out
if [ ! -d /tmp/deps/node_modules ]; then
  mkdir -p /tmp/deps && cp package.json /tmp/deps/ && ( cd /tmp/deps \
    && node -e "const p=require('./package.json');delete p.dependencies['whatsapp-web.js'];require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))" \
    && PUPPETEER_SKIP_DOWNLOAD=1 npm install --omit=dev --ignore-scripts --no-audit --no-fund --silent )
fi
ln -sfn /tmp/deps/node_modules node_modules
if ss -ltn 2>/dev/null | grep -q ':3199 '; then echo "app already on 3199"; else
  DB_HOST=localhost DB_PORT=5432 DB_NAME=bhtest DB_USER=bh DB_PASSWORD=bh SESSION_SECRET=test LOGIN_DISABLED=true POS_DEDUCT_STOCK=true PORT=3199 nohup node server.js > /tmp/rbh_server.log 2>&1 &
  sleep 12
fi
curl -s -o /dev/null -w "health %{http_code}\n" http://localhost:3199/health
echo "note: vendor_bills tables appear after the first GRN save; the vendor screens show 500 until then on a fresh test copy"
