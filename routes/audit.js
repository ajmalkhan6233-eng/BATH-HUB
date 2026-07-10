// AUDIT & ACCOUNTING module (CORE ON). Own pool, own router - mounted from server.js.
// Generates an accountant-grade workbook from real Postgres data (not the
// accountant's own numbers - his FORMAT, our verified data), plus an audit
// flags section combining the existing CHECKER (daily_reconciliation_check.js)
// with new item-level checks from audit_invoice_items.
const { Pool } = require('pg');
require('dotenv').config();
const express = require('express');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const router = express.Router();
const { runCheck } = require('../scripts/daily_reconciliation_check');

const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

const OPENING_FLOAT = parseFloat(process.env.PETTY_CASH_FLOAT || 0); // fixed petty-cash opening float — set PETTY_CASH_FLOAT in .env

function granularityBounds(from, to, granularity) {
    // Returns a SQL date_trunc-compatible unit.
    return { daily: 'day', weekly: 'week', monthly: 'month', quarterly: 'quarter' }[granularity] || 'day';
}

// ── DAILY DETAIL (item-level, real data, cost estimated where flagged) ────────
router.get('/api/audit/daily-detail', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
    try {
        const r = await pool.query(`
            SELECT TO_CHAR(sale_date,'YYYY-MM-DD') AS date, invoice_no, item_code, description,
                   qty, unit_price, line_total, unit_cost, line_cogs, line_gp, cost_source
            FROM audit_invoice_items
            WHERE sale_date BETWEEN $1 AND $2
            ORDER BY sale_date, invoice_no, item_code`, [from, to]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SUMMARY rollups (daily/weekly/monthly/quarterly, from daily_summary) ──────
router.get('/api/audit/summary', async (req, res) => {
    const { from, to, granularity = 'daily' } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
    const unit = granularityBounds(from, to, granularity);
    try {
        const r = await pool.query(`
            SELECT TO_CHAR(date_trunc('${unit}', report_date), 'YYYY-MM-DD') AS period,
                   SUM(total_sale) AS sales, SUM(gross_profit) AS gross_profit,
                   SUM(total_expenses) AS expenses,
                   CASE WHEN COUNT(*) FILTER (WHERE gp_status='NOT_AVAILABLE') = 0
                        THEN SUM(gross_profit) - SUM(total_expenses) ELSE NULL END AS net_profit,
                   SUM(cash_sale) AS cash, SUM(card_sale) AS card, SUM(online_sale) AS online,
                   SUM(cheq_payment) AS cheque, SUM(credit_sale) AS credit,
                   COUNT(*) FILTER (WHERE gp_status IN ('ACTUAL','BLENDED') AND expenses_source != 'DEFAULT_50000') AS complete_days,
                   COUNT(*) FILTER (WHERE gp_status = 'ESTIMATE' OR expenses_source = 'DEFAULT_50000') AS partial_days,
                   COUNT(*) FILTER (WHERE gp_status = 'NOT_AVAILABLE') AS estimated_days,
                   COUNT(*) AS total_days
            FROM daily_summary
            WHERE report_date BETWEEN $1 AND $2
            GROUP BY 1 ORDER BY 1`, [from, to]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AUDIT FLAGS (existing CHECKER + new item-level checks) ────────────────────
router.get('/api/audit/flags', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
    try {
        const checkerResult = await runCheck({ since: from, until: to, quiet: true });
        const flags = checkerResult.flags.map(f => ({
            date: f.date, invoice: null,
            issues: f.issues.map(i => ({ code: i.code, detail: i.detail, verify: i.detail })),
        }));

        // New item-level checks: zero/missing cost lines, negative-GP lines.
        const missingCost = await pool.query(`
            SELECT TO_CHAR(sale_date,'YYYY-MM-DD') AS date, invoice_no, item_code, description, line_total
            FROM audit_invoice_items WHERE sale_date BETWEEN $1 AND $2 AND cost_source='MISSING'
            ORDER BY sale_date, invoice_no LIMIT 500`, [from, to]);
        const negGp = await pool.query(`
            SELECT TO_CHAR(sale_date,'YYYY-MM-DD') AS date, invoice_no, item_code, description, line_gp
            FROM audit_invoice_items WHERE sale_date BETWEEN $1 AND $2 AND line_gp < 0
            ORDER BY sale_date, invoice_no LIMIT 500`, [from, to]);

        missingCost.rows.forEach(r => flags.push({
            date: r.date, invoice: r.invoice_no,
            issues: [{ code: 'MISSING_COST', detail: `${r.item_code} "${r.description}" (line total ${Number(r.line_total).toLocaleString()}) has no cost data anywhere - not in the imported price list`,
                       verify: `Confirm real cost for item ${r.item_code} on invoice ${r.invoice_no}` }],
        }));
        negGp.rows.forEach(r => flags.push({
            date: r.date, invoice: r.invoice_no,
            issues: [{ code: 'NEGATIVE_GP', detail: `${r.item_code} "${r.description}" sold at a loss (line GP ${Number(r.line_gp).toLocaleString()})`,
                       verify: `Verify selling price and cost for item ${r.item_code} on invoice ${r.invoice_no} - possible pricing error or clearance sale` }],
        }));

        res.json({ total_flags: flags.length, flags });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── WORKBOOK (xlsx download) ───────────────────────────────────────────────────
router.get('/api/audit/workbook', async (req, res) => {
    const { from, to, granularity = 'monthly' } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
    try {
        const [detailRes, summaryRes, flagsRes] = await Promise.all([
            pool.query(`SELECT TO_CHAR(sale_date,'YYYY-MM-DD') AS date, invoice_no, item_code, description,
                        qty, unit_price, line_total, unit_cost, line_cogs, line_gp, cost_source
                        FROM audit_invoice_items WHERE sale_date BETWEEN $1 AND $2
                        ORDER BY sale_date, invoice_no, item_code`, [from, to]),
            pool.query(`SELECT TO_CHAR(date_trunc('${granularityBounds(from,to,granularity)}', report_date), 'YYYY-MM-DD') AS period,
                        SUM(total_sale) AS sales, SUM(gross_profit) AS gross_profit, SUM(total_expenses) AS expenses,
                        SUM(cash_sale) AS cash, SUM(card_sale) AS card, SUM(online_sale) AS online,
                        SUM(cheq_payment) AS cheque, SUM(credit_sale) AS credit, COUNT(*) AS days
                        FROM daily_summary WHERE report_date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`, [from, to]),
            runCheck({ since: from, until: to, quiet: true }),
        ]);

        const wb = XLSX.utils.book_new();

        const detailHeader = ['Date','Invoice No','Item Code','Qty','Selling Price','Line Total','Unit Cost','Line COGS','Line GP','Cost Source'];
        const detailRows = detailRes.rows.map(r => [r.date, r.invoice_no, r.item_code, Number(r.qty), Number(r.unit_price),
            Number(r.line_total), r.unit_cost!=null?Number(r.unit_cost):'', r.line_cogs!=null?Number(r.line_cogs):'',
            r.line_gp!=null?Number(r.line_gp):'', r.cost_source]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]), 'DAILY DETAIL');

        const summaryHeader = ['Period','Sales','Gross Profit','Expenses','Net Profit','Cash','Card','Online','Cheque','Credit','Days'];
        const summaryRows = summaryRes.rows.map(r => [r.period, Number(r.sales), Number(r.gross_profit), Number(r.expenses),
            Number(r.gross_profit)-Number(r.expenses), Number(r.cash), Number(r.card), Number(r.online), Number(r.cheque), Number(r.credit), Number(r.days)]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows]), 'SUMMARY');

        const flagsHeader = ['Date','Code','Detail'];
        const flagsRows = [];
        flagsRes.flags.forEach(f => f.issues.forEach(i => flagsRows.push([f.date, i.code, i.detail])));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([flagsHeader, ...flagsRows]), 'AUDIT FLAGS');

        // ── Task 2 additions: cash proof, reconciliation, exceptions, staff ──
        const report = await buildFullReport(from, to);

        const cashProofHeader = ['Date','Opening Float','Cash Sale','Expenses','Payments','Expected Closing','Actual Closing','Variance'];
        const cashProofRows = report.cashProof.rows.map(r => [r.date, r.opening_float, r.cash_sale, r.expenses, r.payments, r.expected_closing, r.actual_closing, r.variance]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cashProofHeader, ...cashProofRows]), 'CASH PROOF');

        const reconHeader = ['Date','Excel Total','Source','Expense Source','Conflict','Conflict Variance'];
        const reconRows = report.reconciliation.map(r => [r.date, r.excel_total, r.source, r.expense_source, r.conflict ? 'YES' : '', r.conflict_variance]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([reconHeader, ...reconRows]), 'RECONCILIATION');

        const excRows = [['Defaulted expense days', report.exceptions.defaulted_expense_days.join(', ') || 'None'], ['']];
        excRows.push(['Pending reconciliation', '']);
        report.exceptions.pending_reconciliation.forEach(p => excRows.push([p.date, `Receipt #${p.number} — ${p.amount}`]));
        excRows.push(['']); excRows.push(['Cheque alerts (next 7 days)', '']);
        report.exceptions.cheque_alerts_7day.forEach(c => excRows.push([c.due_date, `${c.bank} #${c.cheque_number} — ${c.amount}`]));
        excRows.push(['']); excRows.push(['GRN / stock caveats', '']);
        report.exceptions.grn_stock_caveats.forEach(g => excRows.push([g.grn_date, `${g.supplier_name}: ${g.caveat_note}`]));
        excRows.push(['']); excRows.push(['Note', report.exceptions.settlement_lag_note]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(excRows), 'EXCEPTIONS');

        const staffHeader = ['Name','Role','Total Paid','Commission (stored)'];
        const staffRows = report.staff.payments.map(s => [s.name, s.role, Number(s.total_amount), Number(s.total_commission_stored)]);
        staffRows.push([]); staffRows.push(['GP-by-staff commission auto-calc', 'BLOCKED — ' + report.staff.gp_by_staff_commission_autocalc.reason]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([staffHeader, ...staffRows]), 'STAFF');

        const coverRows = [
            [report.cover.company], [report.cover.location], [''],
            [`Period: ${report.cover.period.from} to ${report.cover.period.to}`],
            [`Generated: ${new Date(report.cover.generated_at).toLocaleString()}`],
            [`Data sources: ${report.cover.data_sources.join(', ')}`], [''],
            [`Prepared by: ${report.signOff.prepared_by}`], ['Reviewed by: Owner  (signature)  Date: ___________'],
        ];
        const wsCover = XLSX.utils.aoa_to_sheet(coverRows);
        // Insert Cover as the first sheet for a proper report reading order.
        XLSX.utils.book_append_sheet(wb, wsCover, 'COVER');
        wb.SheetNames.unshift(wb.SheetNames.pop());

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="audit_${from}_to_${to}.xlsx"`);
        res.send(buf);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL AUDIT REPORT — audit-firm-standard: cover,
// summary, three-way reconciliation, cash proof, exceptions, staff, sign-off.
// Every figure below comes straight from SQL - nothing is estimated or
// inferred here. The one optional exception (narrateReport) only ever writes
// prose ABOUT these numbers, never new ones - see its own comment.
// ═══════════════════════════════════════════════════════════════════════════
async function buildFullReport(from, to) {
    const days = await pool.query(`
        SELECT TO_CHAR(report_date,'YYYY-MM-DD') AS date, total_sale, cash_sale, card_sale,
               online_sale, credit_sale, cheq_payment, gross_profit, total_expenses, payments,
               cash_in_hand, gp_status, day_status, sales_source, expenses_source,
               sales_conflict, sales_conflict_excel, details
        FROM daily_summary WHERE report_date BETWEEN $1 AND $2 ORDER BY report_date`, [from, to]);

    // ── SUMMARY — Net Profit is always GP - Expenses, computed here, never
    // read from a stored column, so the identity in item 8b always holds. ──
    let sales = 0, gp = 0, expenses = 0, cash = 0, card = 0, online = 0, cheque = 0, credit = 0;
    let gpAvailableDays = 0;
    for (const d of days.rows) {
        sales += +d.total_sale || 0;
        expenses += +d.total_expenses || 0;
        cash += +d.cash_sale || 0; card += +d.card_sale || 0; online += +d.online_sale || 0;
        cheque += +d.cheq_payment || 0; credit += +d.credit_sale || 0;
        if (d.gp_status !== 'NOT_AVAILABLE') { gp += +d.gross_profit || 0; gpAvailableDays++; }
    }
    const netProfit = gpAvailableDays === days.rows.length ? gp - expenses : null; // partial GP coverage -> don't imply a false total
    const summary = { sales, gross_profit: gp, expenses, net_profit: netProfit,
        gp_coverage: `${gpAvailableDays}/${days.rows.length} days have GP data`,
        cash, card, online, cheque, credit };

    // ── COVER ──
    const sourcesUsed = [...new Set(days.rows.flatMap(d => [d.sales_source, d.expenses_source].filter(Boolean)))];
    const cover = {
        company: 'Your Business Name (Pvt) Ltd', location: 'Your City',
        period: { from, to }, generated_at: new Date().toISOString(),
        data_sources: sourcesUsed.length ? sourcesUsed : ['no data in range'],
    };

    // ── RECONCILIATION — three-way tie-out per day (locked rule: Excel is
    // truth for revenue; sales_conflict/_excel already tracks a
    // manual-entry-vs-Excel mismatch when one was recorded). ──
    const reconciliation = days.rows.map(d => ({
        date: d.date,
        excel_total: +d.total_sale || 0,
        source: d.sales_source || 'unknown',
        expense_source: d.expenses_source || 'unknown',
        conflict: !!d.sales_conflict,
        conflict_variance: d.sales_conflict ? (+d.total_sale || 0) - (+d.sales_conflict_excel || 0) : 0,
    })).filter(r => r.conflict || r.expense_source === 'DEFAULT_50000'); // only rows worth an accountant's eye

    // ── CASH PROOF — opening float + cash sales - expenses - payments should
    // equal the recorded closing cash_in_hand. Variance target is zero. ──
    const cashProof = days.rows.map(d => {
        const cashSale = +d.cash_sale || 0, exp = +d.total_expenses || 0, pay = +d.payments || 0;
        const expectedClosing = OPENING_FLOAT + cashSale - exp - pay;
        const actualClosing = +d.cash_in_hand || 0;
        return { date: d.date, opening_float: OPENING_FLOAT, cash_sale: cashSale, expenses: exp,
            payments: pay, expected_closing: expectedClosing, actual_closing: actualClosing,
            variance: Math.round((actualClosing - expectedClosing) * 100) / 100 };
    });
    const cashProofFlagged = cashProof.filter(r => Math.abs(r.variance) > 1);

    // ── EXCEPTIONS ──
    const checkerResult = await runCheck({ since: from, until: to, quiet: true });
    const defaultedDays = days.rows.filter(d => d.expenses_source === 'DEFAULT_50000').map(d => d.date);
    const pendingReconciliation = [];
    days.rows.forEach(d => {
        const afterHours = (d.details || {}).after_hours_receipts || [];
        afterHours.filter(i => i.status === 'PENDING_RECONCILIATION')
            .forEach(i => pendingReconciliation.push({ date: d.date, number: i.number, amount: i.amount }));
    });
    const chequeAlerts = await pool.query(`
        SELECT cheque_number, bank, amount, TO_CHAR(due_date,'YYYY-MM-DD') AS due_date, status
        FROM cheques WHERE status = 'pending' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        ORDER BY due_date`);
    const grnCaveats = await pool.query(`
        SELECT grn_number, supplier_name, TO_CHAR(grn_date,'YYYY-MM-DD') AS grn_date, caveat_note
        FROM grn_records WHERE caveat_flag = true AND grn_date BETWEEN $1 AND $2 ORDER BY grn_date`, [from, to]);
    const exceptions = {
        defaulted_expense_days: defaultedDays,
        pending_reconciliation: pendingReconciliation,
        settlement_lag_note: 'Card/online settlements can post 1-2 days after the sale date - this is a normal processor delay, not a reconciliation error.',
        cheque_alerts_7day: chequeAlerts.rows,
        grn_stock_caveats: grnCaveats.rows,
        checker_flags: checkerResult.flags,
    };

    // ── STAFF — real stored commission/salary payments only. Per-staff GP
    // attribution (needed for a real commission calc) does not exist
    // anywhere in this DB - see routes/staff_reports.js's own /commission-autocalc
    // for the full reason. Surfacing that honestly here rather than estimating
    // a number that would fail Task 2's own "deterministic, never generate
    // figures" rule. ──
    const staffPayments = await pool.query(`
        SELECT s.name, s.role, SUM(ss.amount) AS total_amount, SUM(ss.commission) AS total_commission_stored
        FROM staff_salary ss JOIN staff s ON s.id = ss.staff_id
        WHERE ss.pay_date BETWEEN $1 AND $2 GROUP BY s.id, s.name, s.role ORDER BY s.name`, [from, to]);
    const staff = {
        payments: staffPayments.rows,
        gp_by_staff_commission_autocalc: {
            blocked: true,
            reason: "Real commission = a fixed percentage of each staff member's individually-attributed Gross Profit from the POS (locked business rule). lasersoft_invoices has no salesperson column, so per-staff GP does not exist in this database. Cannot compute without importing a staff-filtered POS profit report first - see routes/staff_reports.js.",
        },
    };

    // ── SIGN-OFF ──
    const signOff = { prepared_by: 'System (automated)', prepared_at: new Date().toISOString(),
        reviewed_by: 'Owner', reviewed_signature_line: true };

    return { cover, summary, reconciliation, cashProof: { rows: cashProof, flagged: cashProofFlagged }, exceptions, staff, signOff };
}

// Best-effort narrative via local Ollama - writes 2-3 sentences of prose
// ABOUT the already-computed numbers above. Never asked to produce a figure;
// the prompt hands it every number and tells it not to introduce new ones.
// Any failure (Ollama down, timeout, bad output) just means no narrative -
// the report is already complete and correct without it.
async function narrateReport(report) {
    try {
        const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
        const OLLAMA_MODEL = process.env.NL_OLLAMA_MODEL || 'llama3.2:1b';
        const facts = {
            period: report.cover.period, sales: report.summary.sales, gross_profit: report.summary.gross_profit,
            expenses: report.summary.expenses, net_profit: report.summary.net_profit,
            cash_proof_variances_flagged: report.cashProof.flagged.length,
            reconciliation_issues: report.reconciliation.length,
            defaulted_expense_days: report.exceptions.defaulted_expense_days.length,
            cheque_alerts: report.exceptions.cheque_alerts_7day.length,
        };
        const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL, stream: false, keep_alive: '30m',
                messages: [
                    { role: 'system', content: 'You write brief, factual audit-report commentary. You are given verified numbers as JSON - use ONLY those numbers, never invent, estimate, or restate a different figure. 2-3 sentences, plain prose, no markdown.' },
                    { role: 'user', content: `Write commentary for this period using only these verified figures:\n${JSON.stringify(facts)}` },
                ],
            }),
            signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return (data.message?.content || '').trim() || null;
    } catch (e) { return null; }
}

router.get('/api/audit/full-report', async (req, res) => {
    const { from, to, narrative } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
    try {
        const report = await buildFullReport(from, to);
        if (narrative) report.narrative = await narrateReport(report);
        res.json(report);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FULL AUDIT REPORT — PDF (server-generated via pdfkit, streamed) ──────────
router.get('/api/audit/full-report/pdf', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
    try {
        const report = await buildFullReport(from, to);
        report.narrative = await narrateReport(report);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="audit_report_${from}_to_${to}.pdf"`);
        const doc = new PDFDocument({ margin: 45, size: 'A4' });
        doc.pipe(res);

        const fmt = n => 'LKR ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
        const h1 = t => doc.moveDown(0.5).fontSize(16).font('Helvetica-Bold').text(t).moveDown(0.3);
        const h2 = t => doc.fontSize(12).font('Helvetica-Bold').fillColor('#000').text(t).moveDown(0.2);
        const body = t => doc.fontSize(10).font('Helvetica').fillColor('#222').text(t);

        // Cover
        doc.fontSize(20).font('Helvetica-Bold').text(report.cover.company, { align: 'center' });
        doc.fontSize(11).font('Helvetica').text(report.cover.location, { align: 'center' }).moveDown(0.5);
        doc.fontSize(14).text(`Audit Report — ${report.cover.period.from} to ${report.cover.period.to}`, { align: 'center' }).moveDown(0.3);
        doc.fontSize(9).fillColor('#555').text(`Generated ${new Date(report.cover.generated_at).toLocaleString()} — data sources: ${report.cover.data_sources.join(', ')}`, { align: 'center' }).fillColor('#000');

        // Summary
        h1('Summary');
        body(`Total Sale: ${fmt(report.summary.sales)}`);
        body(`Gross Profit: ${fmt(report.summary.gross_profit)}  (${report.summary.gp_coverage})`);
        body(`Expenses: ${fmt(report.summary.expenses)}`);
        body(`Net Profit (Gross Profit − Expenses): ${report.summary.net_profit == null ? 'PENDING — GP not available for every day in range' : fmt(report.summary.net_profit)}`);
        doc.moveDown(0.3);
        body(`Cash ${fmt(report.summary.cash)}   Card ${fmt(report.summary.card)}   Online ${fmt(report.summary.online)}   Cheque ${fmt(report.summary.cheque)}   Credit ${fmt(report.summary.credit)}`);

        // Reconciliation
        h1('Reconciliation — flagged days only');
        if (!report.reconciliation.length) body('No reconciliation conflicts or defaulted-expense days in this period.');
        report.reconciliation.forEach(r => body(`${r.date} — source: ${r.source}, expenses: ${r.expense_source}${r.conflict ? `, CONFLICT variance ${fmt(r.conflict_variance)}` : ''}`));

        // Cash proof
        h1('Cash Proof');
        body(`Opening float: ${fmt(OPENING_FLOAT)} per day. Expected closing = opening + cash sales − expenses − payments.`);
        if (!report.cashProof.flagged.length) body('Every day in range balances to zero variance.');
        else report.cashProof.flagged.forEach(r => body(`${r.date} — expected ${fmt(r.expected_closing)}, actual ${fmt(r.actual_closing)}, VARIANCE ${fmt(r.variance)}`));

        // Exceptions
        h1('Exceptions');
        h2(`Defaulted expense days (${report.exceptions.defaulted_expense_days.length})`);
        body(report.exceptions.defaulted_expense_days.join(', ') || 'None');
        h2(`Pending reconciliation (${report.exceptions.pending_reconciliation.length})`);
        report.exceptions.pending_reconciliation.forEach(p => body(`${p.date} — receipt #${p.number} ${fmt(p.amount)}`));
        h2(`Cheque alerts, next 7 days (${report.exceptions.cheque_alerts_7day.length})`);
        report.exceptions.cheque_alerts_7day.forEach(c => body(`${c.due_date} — ${c.bank} #${c.cheque_number} ${fmt(c.amount)}`));
        h2(`GRN / stock caveats (${report.exceptions.grn_stock_caveats.length})`);
        report.exceptions.grn_stock_caveats.forEach(g => body(`${g.grn_date} — ${g.supplier_name}: ${g.caveat_note}`));
        body(report.exceptions.settlement_lag_note);

        // Staff
        h1('Staff');
        report.staff.payments.forEach(s => body(`${s.name} (${s.role}) — paid ${fmt(s.total_amount)}, commission (stored) ${fmt(s.total_commission_stored)}`));
        doc.fontSize(9).fillColor('#900').text('GP-by-staff commission auto-calc: BLOCKED — ' + report.staff.gp_by_staff_commission_autocalc.reason, { width: 500 }).fillColor('#000');

        // Narrative
        if (report.narrative) { h1('Commentary'); body(report.narrative); }

        // Sign-off
        h1('Sign-off');
        body(`Prepared by: ${report.signOff.prepared_by} — ${new Date(report.signOff.prepared_at).toLocaleString()}`);
        doc.moveDown(1.2);
        body('Reviewed by: _______________________________  (owner)      Date: _______________');

        doc.end();
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
