# SHIP CHECK (Ajmal's list, 2026-10-21). Every website and app screen must pass before anyone says "done".
How: AUDIT FIRST, read-only, one pass/fail list (use the installed playwright plugin or the web-app testing skill, on a phone-sized screen). Fix only after Aj says "go". Each line = what + how it is checked.

## Customers see these (do first)
1. No sideways scroll, no overflow: open every page at 390 px wide; page width never exceeds the screen.
2. Mobile menu: one tap opens it, one tap closes it, every page reachable.
3. Broken links and buttons: click every link and button; none 404, none dead. Footer links included.
4. No placeholder text: search every page for "Lorem", "Your Business", "Your City", "TODO", "xxx", fake phone numbers or handles. Only real shop facts (shop number 074 035 5536; never invent numbers or handles).
5. Page titles: every page has its own clear title (not "Document" or "Vite App").
6. Favicon: the RBH icon shows in the browser tab.
7. Compress images: no image over about 300 KB on a page; right size for a phone.
8. Copyright year: current year (2026), shop name Royal Bath Hub.

## Looks professional (next)
9. Custom 404 page in the shop colours with a link home.
10. Remove unused navigation (menu items that go nowhere).
11. Tab order: Tab key moves through the page in a sensible order; focus is visible.

## App only (GRN, bills, voice, inbox)
12. Loading states: "reading bill..." shown while working, button disabled so nobody taps twice.
13. Error messages in plain words: what went wrong and what to do next (no codes).
14. Success messages: "Saved, stock updated" style, one line.
15. Empty states: "No cheques due today" instead of a blank screen.
16. No console logs left in the screens the shop uses.

## Always
17. Works on Aj's phone first. One screen at a time. Says the monthly cost if it adds one. Keeps data private.
