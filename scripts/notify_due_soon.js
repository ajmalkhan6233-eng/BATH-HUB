// scripts/notify_due_soon.js
// Periodic check: anything due soon (cheques out, loan repayments) that
// hasn't been WhatsApp-notified yet gets sent once via the WhatsApp
// Business API (routes/notifications.js already has the in-app side —
// this is the "notify me even when I'm not looking at the app" side).
//
// Safe by default: if WhatsApp isn't configured (see utils/whatsappBusinessApi.js),
// this still runs on schedule but every send is a logged no-op — $0, no
// network calls. Call start() once from server.js; it self-schedules with
// setInterval, so it works the same whether run locally or on Railway.

require('dotenv').config();
const { Pool } = require('pg');
const { sendWhatsAppAlert, isEnabled } = require('../utils/whatsappBusinessApi');
const { getDueSoonNotifications } = require('../routes/notifications');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_notified (
        id           SERIAL PRIMARY KEY,
        category     VARCHAR(20) NOT NULL,
        ref_id       INT NOT NULL,
        due_date     DATE NOT NULL,
        notified_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, ref_id, due_date)
    )
`).catch(e => console.error('[notify_due_soon] whatsapp_notified migration failed:', e.message));

async function checkAndNotify() {
    try {
        const items = await getDueSoonNotifications();
        if (!items.length) return;

        const alreadyNotified = await pool.query(`SELECT category, ref_id, TO_CHAR(due_date,'YYYY-MM-DD') AS due_date FROM whatsapp_notified`);
        const notifiedSet = new Set(alreadyNotified.rows.map(r => `${r.category}:${r.ref_id}:${r.due_date}`));

        const fresh = items.filter(it => !notifiedSet.has(`${it.category}:${it.ref_id}:${it.due_date}`));
        if (!fresh.length) return;

        const lines = fresh.map(it => `• ${it.title} — ${it.detail}`);
        const message = `Rule #1 reminder — pay early, never let these bounce:\n\n${lines.join('\n')}`;

        const result = await sendWhatsAppAlert(message);
        if (!isEnabled()) return; // don't mark as "notified" if it was never actually sent anywhere

        for (const it of fresh) {
            await pool.query(
                `INSERT INTO whatsapp_notified (category, ref_id, due_date) VALUES ($1,$2,$3) ON CONFLICT (category, ref_id, due_date) DO NOTHING`,
                [it.category, it.ref_id, it.due_date]
            ).catch(() => {});
        }
        if (!result.sent) console.error('[notify_due_soon] WhatsApp send attempted but failed:', result.reason);
    } catch (e) {
        console.error('[notify_due_soon] check failed:', e.message);
    }
}

function start(intervalMs = 60 * 60 * 1000) { // hourly is enough for a 5-day warning window
    checkAndNotify();
    setInterval(checkAndNotify, intervalMs);
}

module.exports = { start, checkAndNotify };
