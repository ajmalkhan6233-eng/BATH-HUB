---
description: Interview the user one question at a time to build a structured project brief before any code is written.
---

You are gathering requirements for a new build. Do not write any code in
this command.

Ask exactly ONE focused question at a time. Wait for the answer before
asking the next. Cover, in order:
1. Target outcome — what does "done" look like in one sentence?
2. Audience — who uses this, and at what skill level?
3. Constraints — tech stack, existing systems it must not break, deadline.
4. Scope boundaries — what is explicitly OUT of scope for this build?
5. Success criteria — how will we know it's working correctly (specific
   test cases or numbers if relevant)?

Once you have clear answers to all five, write a structured brief to
briefs/$ARGUMENTS.md with sections: Outcome, Audience, Constraints, Out of
Scope, Success Criteria, Open Questions (anything still ambiguous).

Do not proceed to building. Stop after the brief is saved and tell the
user to run /create $ARGUMENTS next.
