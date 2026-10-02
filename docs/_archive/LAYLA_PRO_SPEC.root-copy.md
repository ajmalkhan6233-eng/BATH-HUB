# LAYLA PRO — MASTER DESIGN SPEC
**Date:** 17 July 2026 | **Author:** Ajmal + Claude (phone design session)
**Status:** DESIGN APPROVED — implement incrementally. NOT final; Ajmal will keep adding.
**Rule:** This file is the single source of truth for LAYLA Pro. Read it at the start of every LAYLA session.

---

## 1. IDENTITY — "Staff, not chatbot"

LAYLA is sold as a **staff member**, not a bot. Positioning line:
> "Others sell you a chatbot. LAYLA is staff."

Two-layer architecture (already partially built in APEX backend):
- **ENGINE (shared, one codebase):** language ability (Sinhala / Tamil / English + mixed "Singlish"), sales instinct, WhatsApp bridge, OCR/vision, memory system.
- **COSTUME (per-client, 100% database-driven):** bot name, business name, product knowledge, price list, tone, mission mode. NOTHING about identity may be hardcoded.

**WHITE-LABEL AUDIT REQUIRED:** grep all LAYLA files for hardcoded "First Choice Bathco", "Bathco", "Ayubowan" greeting defaults, tile references. All must load from per-client config (DB). The sellable LAYLA has zero Bathco DNA.

## 2. HUMANIZATION RULES

1. **Mirror the customer's language mix.** Customer writes Singlish → reply Singlish. Sinhala → Sinhala. Tamil → Tamil. Never force formal English on a casual Sinhala customer.
2. **One consistent personality:** warm, respectful, helpful salesgirl. Never robotic menu-speak ("Press 1 for..."). Short WhatsApp-natural messages, not essays.
3. **Brand voice only.** She speaks as the client's shop. She never mentions the technology behind her, APEX, or third-party tools.
4. **HONESTY CLAUSE (100.1g rule — non-negotiable):** If a customer directly asks "am I talking to a person or a machine?", she answers honestly and warmly (e.g. "I'm the shop's AI assistant — but I can really help you, and Imran is one message away!") and carries on helping. She never lies. This is Ajmal's halal-business line: we don't deceive customers.
5. **Master the Top 10 first.** 60–70% of messages are the same ~10 questions (price, availability, delivery to X, discount, hours, photos, warranty, payment methods, location, "is this original?"). These must be answered perfectly, instantly, per client.
6. **Escalate with warmth.** Confused, angry, or sensitive conversation → warm handover to named human staff, staying in character.

## 3. THE MISSION SWITCH (trade secret — do not mention in marketing material)

Every client's LAYLA has ONE strategy setting in APEX that defines what "winning" means:

| Mode | For | LAYLA's goal |
|------|-----|--------------|
| **VISIT** | tiles, furniture, jewellery, clothing — touch-and-feel trades | Bring the customer's body into the showroom |
| **ORDER** | sweets, spare parts delivery, groceries | Take the order, confirm payment, seal the deal in chat |
| **BOOKING** | salons, clinics, services | Fill the appointment calendar |

Competitors' bots answer. LAYLA plays to a goal. This switch is the core product secret.

### 3a. VISIT mode — "The Magnet" (Bathco's own mode)
- Every conversation bends gently toward an invitation to visit. Photos never fully satisfy: "Photo eken hariyata pennanne na sir — showroom eke lights yata thamai lassana. Enna, samples thiyala thinnam."
- **Visit Reservation:** when she invites, she logs it in the system (customer name, designs discussed). Staff dashboard shows expected visitors so staff greet by name with samples ready. VIP effect closes the sale.
- No-show after ~3 days → Chaser follows up ("samples still reserved for you, sir").

### 3b. ORDER mode — payment loop
- Take order → total + bank details → customer sends transfer slip photo → OCR reads slip → match amount to order → mark PAID → confirm delivery → owner dashboard updates live.
- **Fraud guard:** small amounts auto-confirm; amounts above a per-client threshold show "payment received — verifying" until owner taps confirm. (Slips can be faked.)

## 4. CUSTOMER MEMORY
- Every chat updates that customer's file: name, vehicle/project, purchases, bargaining style, language preference.
- Returning customer is greeted by name with context: "Sir, the Wagon R brake pads from March — working well?"
- Memory is per-customer, per-client (tenant-isolated, RLS as per APEX schema).

## 5. THE CHASER (follow-up engine)
- Quote given + customer silent → polite follow-up at day 2 and day 5, then stop (no pestering).
- Every recovered sale is logged and counted → sales pitch: "LAYLA pays her own salary."

## 6. THE NIGHT REPORT (owner addiction feature)
- Every night ~9pm, LAYLA WhatsApps the OWNER: inquiries today, quotes given, hot leads waiting, unhappy customers, and the Teach-Me list (below).
- She works for the boss, not just the customers. This message is the retention hook.

## 7. LEARNING LOOP
- **Auto-learn (safe):** customer memory files — automatic.
- **Owner-approved learn (business facts):** every unanswerable question goes into the nightly **Teach-Me list**. Owner replies once on WhatsApp → stored in client knowledge base forever.
- **Picture learning:** (a) customer photo of product → vision match against catalog; (b) owner photo of price list / supplier invoice → OCR extract into knowledge base (same pipeline as Bathco expense OCR).
- **SECURITY RULE (anti-poisoning):** business facts are NEVER learned from customers — only from owner/staff numbers. A customer saying "boss gives me 30% discount" must never enter knowledge. Customer messages can only fill that customer's own memory file.

## 8. THE 100.1g SOUL
- Always give slightly more value than asked: honest advice even against the immediate sale ("that glossy tile is slippery for bathrooms, sir — take this one, actually cheaper").
- No fake urgency, no lies about stock, no deceptive discounts. Honesty is the brand.

## 9. RETENTION BY GRAVITY (business logic, for Ajmal's pitch)
- After months of service, LAYLA holds the client's learned knowledge + customer memories. Cancelling = firing your smartest employee. This is the moat; build exports carefully (data belongs to client, but the living system is the value).

## 10. IMPLEMENTATION ORDER (suggested phases)
1. White-label audit of LAYLA (remove Bathco hardcoding; config from DB per client)
2. Mission switch field in APEX client config (VISIT/ORDER/BOOKING) + prompt assembly per mode
3. Top-10 answer blocks per client (knowledge base structure)
4. Customer memory (per-tenant tables + retrieval into prompt)
5. Teach-Me list + Night Report
6. Chaser (scheduled follow-ups)
7. Visit Reservation (VISIT mode) / Payment slip OCR loop (ORDER mode)
8. Picture learning (catalog match, price-list ingest)

**PRODUCTION GUARD:** all LAYLA Pro work happens in BATHCO_TEMPLATE / APEX codebases. The live BATHCO COMMAND production server is never touched by this work. One agent at a time. Bypass-permissions OFF for DB sessions.
