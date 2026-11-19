# 07 APPROVAL LEDGER (any message to a customer/supplier)
Agent only drafts (existing decision). Add a record per draft: who, channel, exact text, short fingerprint, priority P0-P3, status drafted > approved/rejected > sent.
Aj approves THIS exact text; if the text changes, old approval is void.
Send once only; log time sent. Do not re-ask a counterparty for facts already in the ledger.
Plain-file version: one table in AI_MEMORY/OUTBOX.md. No auto-send ever.
Cost: none.
