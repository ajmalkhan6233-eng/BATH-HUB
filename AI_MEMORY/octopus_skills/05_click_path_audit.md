# 05 CLICK PATH AUDIT (screens/buttons)
For each button on a screen: list its handler's steps in order; for each step note what it reads, writes, resets.
Check: does a later step undo an earlier one? Does the final screen match the button label? Any async step finishing out of order?
Typical catch: two steps each fine alone, but one clears what the other set (button does nothing).
Run per module, one screen at a time (matches modular-build rule). Prefer real click test if available.
Cost: medium; only when a screen "does nothing".
