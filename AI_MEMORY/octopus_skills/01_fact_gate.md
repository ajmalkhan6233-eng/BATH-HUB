# 01 FACT GATE (before any edit)
Use: before changing a file, or running a write/shell step.
Rule: do not guess. Say these facts first, from real reads, not memory:
1. Which files use/import this one (search, list them).
2. What data shape it touches (table/columns/format), from the real file or schema.
3. Aj's request in his own words (quote it).
4. The exact command/edit planned and how to undo it.
Unknown = write "unverified" and go check. No facts, no edit. Golden core files: stop, ask Aj.
Cost: low (a few searches).
