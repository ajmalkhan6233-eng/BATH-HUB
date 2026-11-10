# Self-running app: what exists, what is built, what is next (10 Nov 2026)
Rules kept: no new library or paid service without AJ's OK; money moves only with AJ's approval; AI is never the source of truth (numbers come from the database); nothing destructive in production.

## Already running
- Bridge (chat builds, PC runs), backups, health endpoints, audit invariants (utils/auditInvariants.js), one 06:00 message (utils/notify.js), Layla owner assistant, due-soon notifier.

## Built 10 Nov (task 175)
- Self-run (utils/selfRun.js): from 05:00 Sri Lanka, once a day it runs the audit checks plus a due-bills/cheques line and queues ONE line for the 06:00 message. If the PC was off, it runs when the app next starts. Failed run is logged and retried (max 3). Status: /api/selfrun (owner). Read-only on shop data.
- Audit fixes A (stock truth per bill), B (vendor payment guard), C (till summary from payment parts), GRN smart match with vendor memory.

## Next, in order (each a small cloud build, needs "go")
1. Audit D (store cost on the bill line), E (price guard gaps, void closes cheque), F (cheque register owner-only + duplicate guard).
2. Reconciliation line: cash counted vs till summary at day close.
3. Reorder list (items under minimum, grouped by vendor) in the 06:00 line.
4. Owner Q&A in Layla using database queries only (read-only), AI only words the answer.
5. Notification delivery status (sent or not) shown in /api/selfrun.
Needs AJ's OK first: any queue library, any paid AI/API, any automatic payment or ordering.
