# 04 MODULE REGRESSION LEDGER
Keep a short table (AI_MEMORY/REGRESSION.md when needed): module | who depends on it | one command that proves it still works.
Rule: after changing a module's visible behaviour, run its command AND the commands of everything that depends on it. Internal-only change with green module check: dependants may be skipped, say so.
Exit codes decide, not opinions. Only create the table once 3+ modules depend on each other.
Cost: low.
