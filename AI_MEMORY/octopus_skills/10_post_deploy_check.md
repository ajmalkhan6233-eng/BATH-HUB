# 10 POST-DEPLOY CHECK (one pass, by hand)
After any deploy/restart, one pass only (no watch loop): health URL returns OK; key page loads; one key API answers; no new errors in log; a core number still matches before/after.
Record result + time in LIVE.md. Fail = say BLOCKED, do not retry blindly; rollback step comes from skill 03.
Never against the LIVE system unless Aj says so.
Cost: low.
