'use strict';
// Sends every queued receipt picture over WhatsApp (dry run unless .env has WHATSAPP_LIVE=true).
//   node scripts/send_queued_receipts.js
require('dotenv').config();
const { Pool } = require('pg');
const sender = require('../utils/whatsappReceiptSender');
const pool = new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
console.log(sender.isLive() ? 'LIVE mode' : 'DRY RUN (set WHATSAPP_LIVE=true in .env to really send)');
sender.sendAllQueued(pool).then(r => { console.log(r.map(x => `queue ${x.id}: ${x.status}`).join('\n') || 'nothing queued'); return pool.end(); })
    .catch(e => { console.error(e.message); process.exit(1); });