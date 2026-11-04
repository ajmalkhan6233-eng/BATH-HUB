# UI SPEC — First-Run Setup Wizard
Self-contained spec for an external AI (Google AI Studio). You have ZERO other context; everything
you need is in this file.

## Hard rules
- Tech stack: **React 18 + Vite + Tailwind CSS**. Function components + hooks only.
- **NO backend calls.** No fetch/axios/WebSocket. Where the real app would POST, call a prop
  callback (e.g. `onComplete(payload)`) and show the success state with mock behavior.
- **NO real data.** Use only the placeholder data given below.
- Output must be **exportable components**: plain `.jsx` files, no external UI libraries, no CDN
  imports, self-contained. Default-export one `<SetupWizard />` root component; sub-steps may be
  separate components in the same folder.

## Purpose
A one-time onboarding wizard shown the very first time a newly installed business-management
system (ERP for small retail shops) is opened. It collects the business identity, branding,
currency, one admin account, and optional staff accounts. In the real product it then locks
itself forever; here just simulate completion.

## Design language
Dark "emerald & gold" glassmorphism:
- Background: deep emerald gradient (#062e21 → #0a4531)
- Card: centered, max-width 520px, `rgba(255,255,255,0.05)` background, 1px border
  `rgba(212,175,55,0.25)`, border-radius 16px, padding 32px, backdrop-blur
- Accent/gold: #d4af37 (primary buttons, active step bar); text: near-white
- Step progress: 4 thin bars (4px tall, rounded) across the card top; completed/current bars gold,
  future bars `rgba(255,255,255,0.12)`
- Inputs: full-width, dark translucent (`rgba(0,0,0,0.25)`), 1px `rgba(255,255,255,0.15)` border,
  radius 8px; labels above inputs, small and muted
- Buttons: `primary` (gold background, dark text) and `ghost` (translucent white)
- Inline error line in red/amber below the buttons; never use browser alert()

## Steps (state machine: 1 → 2 → 3 → 4 → done; Back allowed everywhere except done)
### Step 1 — Business identity
- Heading: "Welcome — let's set up your system"; sub: "This one-time wizard prepares this ERP for
  your business."
- Fields: Business name* (placeholder "e.g. Demo Hardware Store"), Legal name (placeholder
  "e.g. Demo Hardware Store (Pvt) Ltd"), Tagline (placeholder "e.g. Everything for your build —
  Main Street").
- Next disabled/errors if Business name empty.
### Step 2 — Logo & currency
- Logo file input (PNG/JPEG/WebP/SVG, max 2MB — validate size client-side, show preview via
  FileReader data URL; optional).
- Two-column row: Currency code (text, default "USD"), Symbol (text, default "$").
### Step 3 — Admin account
- Fields: Admin name (placeholder "Owner name"), Admin username* (placeholder "e.g. owner"),
  Admin password* (min 8 chars, type=password).
- Hint text: "This is the account that controls everything. Store the password safely."
### Step 4 — Staff accounts (optional)
- Repeatable rows (add up to 8): Full name, Username, Password. "+ Add staff member" ghost button;
  each row removable. Skipping entirely is allowed.
- "Finish setup" primary button → validate, assemble payload, call `onComplete(payload)`, go to done.
### Done screen
- Big ✅, "Setup complete. You are logged in as **{admin username}**."
- Primary button "Open your dashboard" (calls `onDone()` prop; no navigation logic needed).

## Payload shape for onComplete (mock only — fill from form state)
```json
{
  "company_name": "Demo Hardware Store",
  "legal_name": "Demo Hardware Store (Pvt) Ltd",
  "tagline": "Everything for your build",
  "logo_data_url": null,
  "currency": "USD",
  "currency_symbol": "$",
  "admin": { "name": "Alex Demo", "username": "owner", "password": "********" },
  "staff": [ { "name": "Sam Placeholder", "username": "sam", "password": "********" } ]
}
```

## Acceptance
- Keyboard-friendly (Enter advances when valid), responsive down to 360px width,
  no console errors, no network requests at all, all copy exactly as specified or visibly better.
