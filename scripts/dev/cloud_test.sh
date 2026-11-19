#!/usr/bin/env bash
# ONE command for the cloud sandbox: test copy app up + dev tools installed + jest on the files you name.
# Usage: bash scripts/dev/cloud_test.sh [jest args]      e.g.  bash scripts/dev/cloud_test.sh tests/unit/vendorAdjust.test.js
#        bash scripts/dev/cloud_test.sh --rig-only       (just start the test copy on port 3199)
# TEST COPY ONLY (database bhtest). Never the real shop data. Nothing leaves the sandbox.
set -u
cd "$(dirname "$0")/../.."
if ! curl -s -m 3 localhost:3199/health >/dev/null 2>&1; then bash scripts/dev/cloud_rig.sh >/tmp/rig.log 2>&1; tail -2 /tmp/rig.log; fi
if [ ! -x /tmp/deps/node_modules/.bin/jest ]; then
  ( cd /tmp/deps && npm install --no-save --ignore-scripts --no-audit --no-fund --silent supertest pg-mem jest ) >/dev/null 2>&1
fi
[ "${1:-}" = "--rig-only" ] && exit 0
./node_modules/.bin/jest "$@" 2>&1 | grep -E "^(Tests|Test Suites):|✕|●.*›|FAIL" | head -30
