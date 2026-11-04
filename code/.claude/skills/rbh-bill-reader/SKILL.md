---
name: rbh-bill-reader
description: Use when AJ sends a vendor bill, GRN or cheque photo to read into the app. Cheapest way, one bill at a time, free tools only.
---
# Read a bill photo (cheap, one bill per job)
1. Ask for ONE vendor's bills at a time. Never batch 20 photos in one chat (limit risk). Say "next" when one is done.
2. Prefer the app's own reader first: GRN screen > photo > Generate (route /api/grn-workbench/read). It costs nothing in chat usage. Use chat vision only if Generate fails twice.
3. If you read by eye: shrink first (max 1600 px wide, JPEG 80) so the image costs fewer tokens; look at the header (vendor, bill no, date) and the totals line first, then the lines.
4. Write ONE file per bill into drafts_inbox/: `<vendor>_<billno>.json` + the photo as `.jpg`. Same shape as drafts_inbox/leo_0000010887.json.
5. CHECK: sum of lines = paper total. If not equal, mark the draft UNVERIFIED and list the lines that look wrong. Never force the total.
6. Item codes: never invent. Vendor order, Metro first. AJ gives the code numbers for the next vendors.
7. Commit + push to branch work. Report in 3 lines: vendor, bill no, total matches yes/no.
