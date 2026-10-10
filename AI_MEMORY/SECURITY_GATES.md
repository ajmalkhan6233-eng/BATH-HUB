# SECURITY_GATES (2026-10-10, queue 4 part 5). (a) outside text IN, (b) private data READ, (c) can SEND/CHANGE. LAYLA brain = rules only, AI model switch OFF.
1 WhatsApp customer -> agent_brain draft (routes/agent_brain.js): a yes, b yes (prices, rules), c NO (approve sends nothing, owner copies it). SAFE.
2 WhatsApp customer -> LAYLA v2 (layla_v2/customer.js): a yes, b yes (catalogue, notes), c YES (sendTexts). ALL THREE, only when WHATSAPP_LIVE=true. GATED now.
3 Staff/owner WhatsApp -> LAYLA v2 staff.js: trusted numbers only (allow-list), sends via the same transport. GATED now.
4 Owner WhatsApp -> layla_owner (waCloud.js): owner number only, replies only to the owner. a trusted. SAFE.
5 Photos of papers -> OCR -> document_inbox / server.js: a yes (photo text), b little, c writes a DRAFT row + a read-back to the sender. Fields are stored, never obeyed. PARTIAL: wrapper not yet on OCR text (NEXT).
6 Sale receipt (utils/whatsappReceiptSender.js): own bill data -> that customer. No outside text. SAFE (not a trifecta). Not gated (NEXT: queue as draft if Aj wants).
7 Due-soon alerts (whatsappBusinessApi.js, notify_due_soon.js): system data -> owner number. No outside text. SAFE.
8 whatsapp-bridge.js: old bridge, NEVER started on this laptop (live system only). Not touched. NEXT on the live side.
9 Web fetch / email / relay: no agent fetches web pages or sends email (grep: no sendMail, no web-fetch tool). relayPoller.js reads owner relay only.
GATES BUILT: utils/egressGate.js (every agent send = draft; owner approves once via routes/agent_outbox.js), utils/customerAllowlist.js (public product fields only),
 utils/untrustedText.js (customer text = data, instruction phrases removed + logged; outgoing picture/query links stripped), utils/agentAudit.js (no phones/secrets).
 Wired: layla_v2/index.js createDeps (gated transport), layla_v2/engine.js (customer text wrapped), server.js (outbox route).
TESTS: tests/unit/agent_security_gates.test.js (gate, no-send-without-gate scan, trifecta, allowlist, audit, 10 new red-team) + existing agent_brain_redteam.test.js.
NEXT (not done): owner screen button for the outbox; wrapper on OCR/PDF text (item 5); gate for receipts (6); live bridge (8) needs Aj and the live repo.
MODEL SWITCH stays OFF until all red-team tests pass.
