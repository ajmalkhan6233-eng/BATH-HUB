# Pending for Aj (decisions needed, nothing built for these yet)

1. **GRN from a photo and stock.** Today a confirmed paper GRN goes into `grn_records` as PENDING_REVIEW and does NOT change stock (a rule built earlier). The manual GRN screen does change stock and cost. Should confirming a photo GRN also add the stock and update the average cost? (Needs sign-off: it touches stock numbers.)
2. **Bills and the daily sales ledger.** A confirmed paper bill goes to `pos_bills` (the POS ledger) dated as written on the paper. It is not yet added into the `daily_summary` day totals. Do you want that, and how should a day with both a day sheet and photo bills avoid counting twice?
3. **Investor profit.** Layla now tells a registered investor: amount invested, agreed profit share (rate x amount), paid so far, still to pay, next due date, all from the Investor Loans screen. A live "profit earned so far" by time or by share of the shop's real profit needs your rule (flat per loan period, monthly, or % of net profit).
4. **"Ajmal gets 100% information".** Not built. Who is Ajmal in Layla, and which number or login? Right now only the owner number (`WHATSAPP_TEST_WHITELIST`) is the owner.
5. **Register investor numbers.** API is ready (`POST /api/investor-contacts` with phone, name, lender_name = the name used in Investor Loans). There is no screen for it yet.
