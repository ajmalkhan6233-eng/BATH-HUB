---
name: ecc-regression-tests
description: After fixing a bug, add a small test that would have caught it; AI self-review is not a test.
---
# Regression tests
The same AI that writes code shares its blind spots when reviewing it. So prove fixes with tests.
- Write the test for the bug first (or right after), named after the bug. Test response shape/behaviour, not internals.
- Aim at where bugs actually appeared, not 100% coverage.
- Usual AI slips to test: sandbox/mock path differs from real path; a new column missing from SELECT/response; error state left behind; optimistic update not rolled back on failure; type cast hiding null.
- Keep tests fast and run them first in every bug-check.
- If both a sandbox mode and a real mode exist, assert both return the same shape.
