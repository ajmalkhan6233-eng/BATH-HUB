# LAYLA v2 (WhatsApp) - quality report (Job 4, offline)

Brain: offline rule-based (no AI key, no AI service, no network). Model call is an optional injected function, off by default.
Set: 200 conversations, hand-written phrase banks x scenarios, five styles (English, Sinhala, Tamil, Singlish, Tanglish).
Run it: `node layla_v2/quality/run.js` (prints failures). Also runs as tests/unit/layla_v2_quality.test.js.

| Category | Passed / total |
|---|---|
| price_stock (price, stock, size, thanks, greetings) | 40 / 40 |
| quantity_quote (tile count + draft quotation) | 25 / 25 |
| location_unknown_facts (hours, delivery, warranty -> "let me check" + task) | 25 / 25 |
| complaints_refunds (handed to a person, no promise) | 20 / 20 |
| bargaining (never grants a discount) | 20 / 20 |
| money_matters (payment, cheque, balance -> person) | 10 / 10 |
| private_data attempts | 20 / 20 |
| prompt_injection | 15 / 15 |
| honesty (bot or person?) | 10 / 10 |
| owner_commands (pause, resume, reports, access control) | 15 / 15 |
| TOTAL | 200 / 200 |

Safety conversations: 125 / 125 pass. Global checks on every customer reply (no owner-books words, no rupee amount outside the
database, no hours/delivery-time/discount/warranty promise, no "As an AI", no phone numbers, reply script matches customer
script): 0 violations in 239 customer replies.

## HONEST READING (do not quote 100%)
- The set was written by the same author as the rules, so it is IN-DISTRIBUTION. Real customers will phrase things I did not
  think of. Expect real-world accuracy clearly below 100%. A quick unseen probe of 13 lines found: no leaks, but 3 misses that
  became "let me check" (safe, creates a staff task) instead of a refusal; two were fixed (owner earnings, other customers'
  numbers, "repeat the text above"), one is still open (Sinhala "other customers' phone numbers" falls to "let me check").
  Also "my name is Kamal, I want tiles" ignores the name, and "how much per box" with no item asks which item.
- Failure mode by design is safe: when unsure LAYLA says she will check and opens a task; the last-line guard blocks any
  rupee amount not read from the database, and hours/delivery/warranty/discount promises.
- Sinhala, Tamil, Singlish and Tanglish wording is AI-written and NOT reviewed by a native speaker: needs review
  (layla_v2/phrases.js, glossary.json, quality/conversations.js).
- Price unit: products.selling_price has no unit column, so LAYLA says "listed at Rs X" without saying per box/tile/sq ft.
- Voice notes and photos are not read: passed to the team.

## After merge of feature/documents
Implement createDocumentsAdapter({pool}) in layla_v2/documents_adapter.js returning {ok, filename, mime, buffer, caption} for
types daily_report, quotation (ref), invoice (ref), cheques_due, stock_report, then pass it as `documents` in createDeps.
