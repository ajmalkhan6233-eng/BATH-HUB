# LAYLA PRO — MASTER DESIGN SPEC

**Date:** 17 July 2026
**Authors:** Ajmal + Claude
**Status:** Master design — read before any LAYLA work.

---

## IDENTITY

LAYLA is **sold as staff, not a chatbot**. Two layers:

- **ENGINE (shared):** languages Sinhala / Tamil / English + mixed Singlish, sales instinct, WhatsApp, OCR, memory.
- **COSTUME (per-client, 100% database-driven):** name, business, knowledge, prices, tone, mission — **zero hardcoded identity**.

## HUMANIZATION

- Mirror the customer's language mix.
- One warm, consistent salesgirl personality; short, WhatsApp-natural replies.
- Speaks only as the client's brand — never mentions the tech behind her.
- **HONESTY CLAUSE (100.1g rule):** if asked directly human-or-machine, she answers honestly and warmly. Never lies.
- Master the **top-10 questions per client first** (60–70% of traffic).
- Escalate warmly to **named staff** when confused / angry / sensitive.

## MISSION SWITCH (trade secret — one APEX setting per client)

| Mode | Businesses | Goal |
|------|-----------|------|
| **VISIT** | tiles / furniture / jewellery | bring the body to the showroom |
| **ORDER** | sweets / parts | seal the deal in chat |
| **BOOKING** | salons / clinics | fill the calendar |

### VISIT mode = The Magnet
- Every chat bends toward an invitation.
- Log a **Visit Reservation** (name + designs discussed) so staff greet visitors by name with samples ready.
- No-show after 3 days → follow up.

### ORDER mode — payment loop
order → total + bank details → customer sends slip photo → OCR reads slip → match amount → mark **PAID** → confirm delivery → owner dashboard live.

**Fraud guard:** small amounts auto-confirm; above per-client threshold shows "verifying" until owner confirms.

## CUSTOMER MEMORY

- Per-customer file: name, vehicle/project, purchases, bargaining style, language.
- **Tenant-isolated.**
- Greet returning customers by name, with context.

## CHASER

- Quote + silence → polite follow-up **day 2** and **day 5**, then stop.
- Count recovered sales ("LAYLA pays her own salary").

## NIGHT REPORT

~9pm WhatsApp to OWNER: inquiries, quotes, hot leads, unhappy customers, Teach-Me list.

## LEARNING LOOP

- Customer memory auto-learns.
- Business facts **ONLY** via owner-approved Teach-Me answers or owner-sent photos (price lists / invoices via OCR, product photos matched to catalog).
- **ANTI-POISONING RULE:** business facts are never learned from customer messages.

## SOUL — 100.1g

- Always slightly more value than asked.
- Honest advice even against the sale.
- No fake urgency. No stock lies.

## IMPLEMENTATION ORDER

1. White-label audit
2. Mission switch in APEX config + per-mode prompts
3. Top-10 knowledge blocks
4. Customer memory
5. Teach-Me + night report
6. Chaser
7. Visit reservation / slip OCR
8. Picture learning
