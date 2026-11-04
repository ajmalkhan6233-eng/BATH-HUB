# LAYLA v2 (WhatsApp) - integration plan (Job 4, 2026-10-03)

1. Today: Meta/bridge -> POST /webhook/whatsapp (server.js ~782) -> layla.js processMessage -> reply. Draft-only mode (utils/agentWhatsapp.js) parks customer messages in M9 (routes/agent_brain.js) for Aj.
2. layla_v2/ is a separate folder. Nothing in server.js, layla.js or scripts/layla_answer_engine.js is edited. The old engine is only CALLED (read-only) for owner finance questions.
3. Entry point: layla_v2/index.js -> handleIncoming({from, text, name}, deps) returns {replies, actions}; it also sends through the transport.
4. Transport (layla_v2/transport.js): ONE interface sendText/sendImage/sendDocument. DRY RUN default (logs "would send", last 3 digits only), SIMULATOR for tests, Cloud API adapter only when WHATSAPP_LIVE=true and token + phone id exist (same env names as utils/whatsappReceiptSender.js; the receipt_queue sender is untouched).
5. Roles: table layla_contacts (empty by default) = owner/staff allow-list; any other number is a CUSTOMER with no access to money data.
6. Facts only from DB: products (item catalogue, routes/item_catalog.js columns) and visible site_tiles; address from site_text. Unknown -> "let me check" + row in layla_tasks + owner alert.
7. Escalations (discount, complaint, refund, money owed, cheque) -> layla_tasks + short owner alert via transport. Quotation drafts live in layla_tasks (kind quotation_draft); never auto-sent.
8. Documents: layla_v2/documents_adapter.js (stub now). After feature/documents merges, wire createDocumentsAdapter() to routes/documents.js generators.
9. Mounting (all OFF by default): optional route layla_v2/route.js behind LAYLA_V2_ENABLED=true; kill switch LAYLA_V2_DISABLED=true; owner "pause LAYLA"/"resume LAYLA" stored in layla_state.
10. To go live later (owner decision): add ONE mount line in server.js, run layla_v2/migrations/001_layla_v2.sql, add owner/staff numbers to layla_contacts, set WHATSAPP_LIVE + keys. Rollback: 001_layla_v2_down.sql.
