# RBH Pocket: design brief for Gemini / Cindy (design ONLY)
Chat built the structure and the core. YOU make it beautiful. Preview with FAKE numbers: open `pocket/index.html#demo` in a browser at 390 px wide.

## What you may change
- `pocket/style.css`: replace it completely.
- `pocket/index.html`: the markup and meta tags inside `<body>`, only if you keep every id below.
- Icons: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (same names and sizes).

## What you must NOT touch
- `app.js` logic, the unlock (crypto), fetch, pairing, or `sw.js`. If a design needs a new class or a changed card layout, list it as "ASK CHAT" at the end. Chat will do it.
- No CDN, no web fonts from the internet, no analytics, no libraries, no network calls of any kind. Privacy first: the app must work with only the files in this folder. System fonts or a font file placed in this folder is fine.

## Ids and classes the code uses (keep them)
ids: `gate`, `gateText`, `pass`, `unlock`, `gateMsg`, `app`, `when`, `refresh`, `lock`, `cards`
classes written by app.js: `card`, `big`, `row`, `l`, `r`, `grid`, `v`, `pill` + `ok` or `bad`, colour helpers `up`, `down`, `dim`, `sub` (+ `stale` when the numbers are old), `msg`, `gate`, `gold` (primary button).
Each card is `.card` with an `<h2>` title, then `.row` lines (`.l` left text, `.r` right number). Today's sales is the one `.big` number.

## The look AJ wants
- Pro, modern, calm, luxury. Black, ash and gold (gold #d4af37 on near-black). Royal Bath Hub, Kandy Road, Thihariya. Honest and clean, no hype, no stock photos.
- iPhone Safari, portrait, one handed. Tap targets 44 px or more. Respect the safe areas (notch, home bar). Looks good added to the Home Screen.
- A friend must say "wow" when AJ shows it. Big readable numbers. Smooth, light motion only (no heavy effects, fast on a cheap phone). Respect `prefers-reduced-motion`.
- Dark only is fine. Numbers use tabular figures. Money shows as `Rs 184,500`.
- English now. Leave room for Sinhala and Tamil text later (do not fix widths to English).

## Screens to design
1. Lock screen (`#gate`): logo word "RBH Pocket", passcode box, Open button, error line.
2. Home (`#app`): header with updated-time line and two buttons; cards in this order: Today, This week / This month, Money in today, To pay, Stock, Best sellers.
3. States: stale numbers (`.sub.stale`), "No data yet", overdue pill (`bad`) vs nothing overdue (`ok`).

## Hand back
Whole files, ready to drop in (`style.css`, and `index.html` if changed). Then chat runs the tests and a 390 px screenshot check.
