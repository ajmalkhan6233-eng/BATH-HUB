// Resend a bill's WhatsApp receipt that failed or was waiting: node scripts/pc/resend_receipt.js RBH-S037
require('dotenv').config({ quiet: true });
const pool = require('../../utils/pool'), sender = require('../../utils/whatsappReceiptSender');
(async () => {
  const no = process.argv[2]; if (!no) { console.log('Give the bill number, e.g. RBH-S037'); process.exit(1); }
  const q = (await pool.query(`SELECT id, status FROM receipt_queue WHERE sale_reference = $1 ORDER BY id DESC LIMIT 1`, [no])).rows[0];
  if (!q) { console.log('No receipt row for ' + no); process.exit(1); }
  if (q.status === 'sent') { console.log(no + ' was already sent. Not sending twice.'); process.exit(0); }
  if (q.status !== 'queued') await pool.query(`UPDATE receipt_queue SET status = 'queued', attempts = 0, last_error = NULL WHERE id = $1`, [q.id]);   // failed / no-phone rows are reset so the sender takes them
  const r = await sender.sendReceiptForQueueItem(pool, q.id); console.log(no + ': ' + JSON.stringify(r)); process.exit(0);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
