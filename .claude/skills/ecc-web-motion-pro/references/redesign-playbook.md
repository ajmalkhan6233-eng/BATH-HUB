# Redesign playbook (website rebuild or app redesign), start to finish
## A. Audit (read-only, 10 minutes)
1 Screenshot every key page at 390 and 1280 (playwright, one pass). 2 List: what visitors/staff must do on each page (buy, call, find, bill). 3 Measure: load time, JS size, console errors, sideways scroll. 4 Write 5 lines: what looks old, what is slow, what is confusing. Show Ajmal one screen; wait for go.
## B. Direction (one screen)
Mood word, palette (black, ash, gold), type pair (self-hosted), one signature motion idea, the 5 scenes (website) or the 6 modules (app). Reuse the app's real photos and logo (public/brand).
## C. Tokens first
CSS variables: colors, spacing scale (4/8/12/16/24/32/48), radius, shadow, type scale, durations, easing. Dark default, light supported. All screens read the tokens, so a redesign is mostly changing tokens.
## D. Components, smallest to biggest
Button, input, card, table row, badge, toast, modal, nav. Each: default, hover, focus, active, disabled, loading, error. Test each alone (modular rule).
## E. Website build order
1 Static HTML/CSS story with real content and no effects (must already look finished). 2 Add reveals + progress. 3 Add one signature effect (pinned story or sequence or shader hero). 4 Add micro-interactions. 5 Add smooth scroll/3D only if budgets still pass. 6 Reduced-motion and low-tier check. 7 SEO basics, social image, favicon, sitemap. 8 Phone gate screenshot, then Ajmal's YES, then publish only on his word (separate repo bathhub-website).
## F. App redesign build order (shop screens)
1 Tokens + shell only (menu stays as Ajmal likes: top Home/File/Sales/Customers & Online, left menu with Dashboard). 2 One module at a time (GRN, Sales, Vendors+Cheques, Money, Loans, Stock), each tested alone on the copy DB. 3 Feedback motion only. 4 Offline states visible (saved locally, will sync). 5 Check at 360 px width with large text. 6 No extra logins, no repeated menus, no glass blur.
## G. Gates and proof
Budgets in SKILL.md section 4. Tests for any logic. Screenshots only at gates. Money/stock numbers never change in a visual task. Log in EFFICIENCY_LOG.md.
## H. When Ajmal says "the app looks bad"
Ask nothing. Screenshot, list 5 fixes ordered by impact (spacing/type/contrast first, motion last), do the first 3 in the cloud, push, show one phone screenshot.
