require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const { processMessage, alertOwner, getOrCreateCustomer } = require('./layla');

const app = express();
const PORT = process.env.PORT || 3000;

const _dbSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('.railway.internal')
    ? { rejectUnauthorized: false } : false;
const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: _dbSsl })
    : new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ status: 'BATHCO COMMAND ACTIVE', agent: 'LAYLA', time: new Date() });
});

// ─── WHATSAPP WEBHOOK (incoming messages) ────────────────────────────────────
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        const body = req.body;

        // Support both direct post and nested WhatsApp Cloud API format
        const entry = body.entry?.[0]?.changes?.[0]?.value;
        const messageObj = entry?.messages?.[0] || body;

        const phone = messageObj.from || body.from;
        const msgType = messageObj.type || 'text';
        const isVoiceNote = msgType === 'audio';
        const text = messageObj.text?.body || body.message || '';

        if (!phone) {
            return res.status(400).json({ error: 'Missing phone number' });
        }

        console.log(`[WEBHOOK] ${phone} → ${isVoiceNote ? '[Voice Note]' : text}`);

        const result = await processMessage(phone, text, isVoiceNote);

        console.log(`[LAYLA] → ${phone}: ${result.message}`);

        res.json({ success: true, reply: result.message, escalated: result.escalate });
    } catch (err) {
        console.error('[WEBHOOK] Error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── SEND MESSAGE (outbound) ─────────────────────────────────────────────────
app.post('/send', async (req, res) => {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });

    // Placeholder — wire up your WhatsApp API (Twilio / Meta Cloud API / WAHA)
    console.log(`[SEND] To: ${to} | Message: ${message}`);
    res.json({ success: true, to, message });
});

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
app.get('/api/customers', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM customers ORDER BY last_contact DESC LIMIT 100'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/customers/:phone', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM customers WHERE phone = $1',
            [req.params.phone]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── LEADS ───────────────────────────────────────────────────────────────────
app.get('/api/leads', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, c.name, c.phone, c.location
            FROM leads l
            LEFT JOIN customers c ON l.customer_id = c.id
            ORDER BY l.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/leads/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *`,
            [status, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DAILY REPORTS ───────────────────────────────────────────────────────────
app.get('/api/reports', async (req, res) => {
    const { date } = req.query;
    try {
        const query = date
            ? 'SELECT * FROM daily_reports WHERE report_date = $1 ORDER BY created_at DESC'
            : 'SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT 50';
        const result = await pool.query(query, date ? [date] : []);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reports', async (req, res) => {
    const { report_date, invoice_no, total_sale, cash_amount, card_amount,
            online_amount, cheque_amount, credit_amount, is_refund, notes } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO daily_reports
              (report_date, invoice_no, total_sale, cash_amount, card_amount,
               online_amount, cheque_amount, credit_amount, is_refund, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *`,
            [report_date, invoice_no, total_sale, cash_amount || 0, card_amount || 0,
             online_amount || 0, cheque_amount || 0, credit_amount || 0,
             is_refund || false, notes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CHEQUES ─────────────────────────────────────────────────────────────────
app.get('/api/cheques', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ch.*, c.name, c.phone FROM cheques ch
            LEFT JOIN customers c ON ch.customer_id = c.id
            ORDER BY ch.due_date ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ALERTS ──────────────────────────────────────────────────────────────────
app.get('/api/alerts', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM alerts WHERE read = false ORDER BY created_at DESC"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/alerts/:id/read', async (req, res) => {
    try {
        await pool.query('UPDATE alerts SET read = true WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM products WHERE active = true ORDER BY category, name"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PACKAGES ────────────────────────────────────────────────────────────────
app.get('/api/packages', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM packages WHERE active = true ORDER BY id"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   BATHCO COMMAND — PHASE 1 ACTIVE     ║
║   Your Business Name (Pvt) Ltd         ║
║   Your City                ║
║                                        ║
║   LAYLA is ready to receive messages  ║
║   Server: http://localhost:${PORT}       ║
║                                        ║
║   Bismillah — InshAllah               ║
╚════════════════════════════════════════╝
    `);
});

module.exports = app;
