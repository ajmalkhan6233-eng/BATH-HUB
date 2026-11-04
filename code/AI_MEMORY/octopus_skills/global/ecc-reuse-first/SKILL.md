---
name: ecc-reuse-first
description: Before writing new code, look for an existing solution in the repo first, then ask before any outside search.
---
# Reuse first
1. Search the repo for the same helper/feature (names, tests).
2. Check the project's own dependencies and docs already on disk.
3. Outside search (web, registries, GitHub) only if Aj agrees; send no private data in queries.
4. Decide: adopt as-is / thin wrapper / combine small pieces / build. Check licence and last-update date of anything adopted.
5. Say which search steps you skipped. Never say "nothing exists" if a step was skipped.
Avoid: huge package for one tiny need; wrapping a library until it loses its point.
