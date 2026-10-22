---
name: rbh-blocks
description: Use for EVERY code fix, edit, new button or feature in the app, ERP, website or Layla: work block by block, never load the whole app.
---
# Block-by-block (AJ's hard rule, 22 Oct 2026)
Idea (known as surgical or targeted edits): find the one block, change only it, test only it. Never read or hold the whole app.
## Write new code in blocks
- One feature = one small file (module), with one clear job, a header comment saying what it does and its inputs and outputs.
- Inside a file: small named functions, one job each. Screens: one section or component per block with its own id or marker comment (// BLOCK: name).
- Wire-in is one line (a require or a route) so a block can be removed or swapped alone.
## Fix or edit an existing thing
1. Locate: grep for the button text, route, function or id. Get file and line numbers. Do not open the file top to bottom.
2. Read only that block plus about 20 lines around it (Read with offset and limit).
3. Edit only that block (Edit with a unique old_string). No reformatting, no refactor, no neighbours touched.
4. Check: node --check on the file, then only the test for that block. Add a test if none exists.
5. Report in one line: file, block name, what changed, check result.
## Never
- Never cat or read a whole big file. Never re-read a block already known.
- Golden-core files stay untouched (AGENT_GUIDE/09_golden_core.md).
- If the block is tangled (needs more than about 60 lines read), split it into a new module first as its own small task, then edit.
## Handover to the PC
Chat writes the block (a patch or the new file) and pushes it on a branch; Claude Code only runs it (Rule 13). Each task names the file and block.
