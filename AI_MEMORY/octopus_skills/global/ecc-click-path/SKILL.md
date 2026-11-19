---
name: ecc-click-path
description: Debug 'button does nothing' bugs by tracing each handler's steps in order and spotting steps that undo each other.
---
# Click path audit
For each button/touch point: find the handler; list every call in order; for each note what state it reads, writes, and resets as a side effect.
Check: does a later step undo an earlier one? Does the final screen match the button label? Any async calls finishing out of order? Does shared state get cleared by a helper?
Then reproduce once, fix the smallest cause, add a regression test. One screen at a time.
General debugging order: reproduce, read the real error, find the last working point, form one hypothesis, test it, fix, verify.
