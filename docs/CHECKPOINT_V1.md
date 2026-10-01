# Checkpoint: V1 complete (git tag `v1.0`)

Return to this exact working state any time: `git checkout v1.0` (look), or `git reset --hard v1.0` on a branch (go back).

## What V1 contains
- **One site:** `/` is the public Bath Hub website; the Owner button opens `/owner` (all business screens, login required). `/nature` and `/app` redirect to `/owner`.
- **Website:** English / Sinhala / Tamil, tile picker and calculator, contact form (saved to Enquiries as "website", rate-limited), WhatsApp button, map and call links. Sample tiles until real items are published.
- **POS billing:** item picker, discount cap (owner can approve over the cap), optional stock deduction (`POS_DEDUCT_STOCK`), today's bills with a "paper bill" tag.
- **WhatsApp receipt:** type the customer's number (it is checked on WhatsApp as you type), press **Print**, and the receipt image goes to the customer's WhatsApp automatically (tick box, on by default). A number that is not on WhatsApp is told to you and nothing is sent. A receipt is never sent twice unless you confirm. The receipt design is a first version; it is designed later.
- **Document Inbox:** photos of manual bills, GRNs, cheques and day/expense sheets (upload or WhatsApp), read by the heading, checked by you, filed only when you press Confirm.
- **Growth tabs:** Agent Rules, Enquiries, Content Calendar, Competitor Watch, Website Catalogue, Reply Drafts, Policy Notes, Branches, Shop Tools, Agent Review.
- **LAYLA draft-only mode:** built, OFF by default (`AGENT_DRAFT_ONLY=true` turns it on). Never sends to customers by itself.
- **Tests:** all pass (see the last commit).

## Needs a restart or setting on the shop computer
1. Pull the latest code, restart the server.
2. **WhatsApp bridge must be restarted** to get the new number check (`/check`). Without it the receipt still sends; it just cannot warn about numbers that are not on WhatsApp.
3. `.env`: `WHATSAPP_API_URL` (bridge send address), `SHOP_NAME`, optional `WHATSAPP_PAPER_NUMBERS`, `AGENT_DRAFT_ONLY`, `POS_DEDUCT_STOCK`.

## Not verified (honest list)
- UNVERIFIED: handwriting reading on real photos (free reader model; you can always correct fields by hand).
- UNVERIFIED: a real WhatsApp send and the number check against your live WhatsApp (tested with a stand-in bridge only; the bridge was never started here).
- Website is not online yet (needs hosting, a web address and real tiles).
- Receipt design is a first version.
