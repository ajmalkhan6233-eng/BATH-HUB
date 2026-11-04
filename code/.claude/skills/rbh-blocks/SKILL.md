---
name: rbh-blocks
description: Use for EVERY code fix, edit, new button or feature in the app, ERP, website or Layla: block by block, smallest change, reuse first, never load the whole app.
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
## Lazy senior developer (Ponytail ideas, absorbed as plain rules; the plugin itself is NOT installed)
Before writing any code ask, in this order, and stop at the first yes:
1. Does the app already do this? Grep for an existing function, route or helper and reuse it.
2. Does Node, the browser or a library already in package.json do it natively?
3. Can a setting or a one-line change do it?
Only then write new code, as little as possible.
- No new library or package without AJ's OK. No extra abstraction, wrapper, config layer or "for later" code. No unasked files, docs or tests beyond the block.
- Keep what matters: input validation, parameterised queries, security, accessibility, 16 px inputs and 44 px taps. Small never means unsafe.
- A shortcut left on purpose gets a one-line comment: // DEBT: what and why. Keep them greppable.
- Before pushing, look at the diff once: anything not needed for this task comes out.
- Intensity is full by default. AJ can say "ponytail lite" (a little more structure allowed) or "ponytail ultra" (absolute minimum, one edit only) or "ponytail off".
## Never
- Never cat or read a whole big file. Never re-read a block already known.
- Golden-core files stay untouched (AGENT_GUIDE/09_golden_core.md).
- If the block is tangled (needs more than about 60 lines read), split it into a new module first as its own small task, then edit.
## Handover to the PC
Chat writes the block (a patch or the new file) and pushes it on a branch; Claude Code only runs it (Rule 13). Each task names the file and block.
