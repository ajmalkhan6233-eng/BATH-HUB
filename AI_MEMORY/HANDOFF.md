# HANDOFF (2026-10-01)

- Tag v1.0 = checkpoint (docs/CHECKPOINT_V1.md). master has everything up to 874f7fe; SALARY module (26cc560) is committed on branch overnight, NOT pushed (waiting for Aj).
- SALARY module: routes/salary.js, utils/salaryMath.js, public/salary.js, tab "Salary & Costs" in /owner and /nature. 431 tests pass. Owner's 3 reference splits + late-return adjustment tested.
- Assumptions to confirm: net = gross profit - returns - recorded expenses (rent/bills/daily pay NOT added unless setting add_fixed_to_net=1); returns = refund rows in daily_reports; "late return" = refund row created after the month was closed.
- C:\Bathco\AI-Data not on this PC: sales/returns come from DB tables (daily_summary, daily_reports), not the Lasersoft files.
- UNVERIFIED: real WhatsApp send + number check, handwriting reading on real photos, website not online.
- Next: Aj decides push; pricing rules (1.95x, 10-25%) exist as /api/salary/price-check but are NOT wired into POS.
