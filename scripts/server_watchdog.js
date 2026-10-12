'use strict';
// Run every 5 minutes by the scheduled task Apex_Server_Watchdog. Restarts only pm2 apex-server.
const { execFile } = require('child_process');
const pool = require('../utils/pool');
const notify = require('../utils/notify');
const { check } = require('../utils/serverWatchdog');
const restart = (name) => new Promise((ok, bad) => execFile('pm2', ['restart', name], { shell: true }, (e) => (e ? bad(e) : ok())));
check({ url: `http://127.0.0.1:${process.env.PORT || 3100}/health`, restart, enqueue: (t, s) => notify.enqueue(pool, t, s) })
  .then((r) => { console.log(JSON.stringify(r)); return pool.end(); }).catch((e) => { console.error(e.message); process.exit(1); });
