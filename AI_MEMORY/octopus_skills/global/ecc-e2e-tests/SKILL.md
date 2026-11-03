---
name: ecc-e2e-tests
description: End-to-end browser test habits with Playwright: stable selectors, no fixed sleeps, flaky-test handling, evidence on failure.
---
# E2E tests
- Cover critical user flows only (sign-in, main save, payment/ledger totals, key reports).
- Page objects for repeated screens; selectors by role/label/test-id, not CSS chains.
- Wait on conditions (element, response), never fixed sleeps. Disable animations in tests.
- Each test independent, own data, cleans up.
- Flaky test: reproduce by repeating, find race/timing cause, fix; quarantine temporarily with a ticket, never delete silently.
- Keep screenshot + trace on failure only (saves space). Run against local/test data, never live.
- Money flows: assert exact figures.
