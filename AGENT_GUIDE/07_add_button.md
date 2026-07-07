# Adding a button that matches the app

All UI lives in public/BATHCO_NATURE.html.

1. Find the page: grep for `id="page-` + the screen name (e.g. id="page-settings").
2. Copy an existing button next to where yours goes. House styles:
   - Primary action:  <button class="primary" onclick="myFn()">Label</button>
   - Secondary/ghost: <button class="ghost" onclick="myFn()">Label</button>
3. Put myFn() in the same <script> block as the other functions for that page.
4. Call APIs with the existing pattern: `await fetch('/api/...').then(r=>r.json())` —
   auth cookie is sent automatically; a 401 means not logged in.
5. Verify per 02_run_and_verify.md.

Do NOT invent new CSS classes for one button; reuse .primary/.ghost/.card/.section-title.
