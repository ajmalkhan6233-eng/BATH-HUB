# UI SPEC — Settings Screen
Self-contained spec for an external AI (Google AI Studio). You have ZERO other context; everything
you need is in this file.

## Hard rules
- Tech stack: **React 18 + Vite + Tailwind CSS**. Function components + hooks only.
- **NO backend calls.** All actions mutate local mock state only and show a small inline
  success/error message. No fetch/axios.
- **NO real data.** Use only the placeholder data below ("Demo Hardware Store", fake users).
- Output must be **exportable components**: plain `.jsx` files, no external UI libraries,
  self-contained. Default-export `<SettingsPage />`; each card may be its own component.

## Purpose
The Settings page of a small-business ERP dashboard. Five stacked glass cards, in this order:
Change Password, User Management, Appearance, Feature Flags, Report a Problem.

## Design language
Dark emerald & gold glassmorphism (must match the dashboard family):
- Page bg #062e21; cards `rgba(10,20,14,0.72)`, 1px `rgba(255,255,255,0.08)` border, radius 14px,
  16px vertical gap
- Card section titles: 14px bold gold #e8cf7a
- Inputs dark translucent; primary buttons gold #d4af37 with dark text; ghost buttons translucent
- Muted helper text ("page-sub" style): 12-13px, low-contrast

## Card 1 — Change Password
- Inputs: Current password, New password (min 12 chars — validate, show inline error) + button
  "Update Password". On valid submit: clear fields, inline green "Password updated (demo)".

## Card 2 — User Management
- Add-user row: Username · Full name · Password (min 12 chars) · role select
  (staff / owner / admin / customer) · primary "+ Add User".
- Users table: Username | Name | Role | Created. Seed with mock users:
  `owner / Alex Demo / admin / 2026-06-01`, `sam / Sam Placeholder / staff / 2026-06-02`,
  `jordan / Jordan Test / staff / 2026-06-03`. Adding appends to local state.

## Card 3 — Appearance
- Helper text: "Background theme for the Dashboard and Login screen only — no data, pages, or
  reports change."
- A select with theme options from a `THEME_REGISTRY` array:
  `[{ id:'nature', label:'Nature (Default)' }, { id:'kim_forest', label:'Kim Forest' }]`
- On change: persist to `localStorage['app_theme']` and call an `onThemeChange(id)` prop
  (the real 3D engine hooks in later — do NOT implement any 3D here).

## Card 4 — Feature Flags
- Helper text: "New modules ship OFF by default. Registry is DB-backed — visible and effective
  for every user, not just this browser."
- List of toggle rows (custom Tailwind toggle switch, 38×20px pill), each: label + description +
  ON/OFF badge (green tint ON, amber tint OFF). Mock flags, all OFF initially:
  - `pos_billing` — "POS Billing — barcode-scan counter billing"
  - `inv_barcode_labels` — "Barcode Labels — printable shelf/product labels"
  - `staff_commission_display` — "Commission — staff commission figures page"
  - `ai_assistant_chat` — "AI Assistant — ask questions about the business"
- Toggling updates local state only.

## Card 5 — Report a Problem 🛟
- Helper: "Something broken or behaving strangely? Here's who to contact and how fast to expect
  a response."
- Severity table (4 rows):
  | Severity | Examples | Response & fix target |
  | Critical / Security | System down, login broken, data at risk | **2–3 hours** (remote-first) |
  | Major bug | Sales, expenses or reports giving wrong results | **2–3 hours** (remote-first) |
  | Minor issue / small request | Cosmetic problems, wording, small tweaks | 4–5 business days |
  | New feature | Anything the system doesn't do today | Separate quotation — not under support |
- Contact line fed from a `supportContact` mock prop:
  `{ name:"Demo Vendor Support", phone:"+00 000 0000", email:"support@example.com" }` — render
  "____________" for any empty field.
- Closing helper line: "When reporting: say what you were doing, what you expected, and what
  happened instead — a photo of the screen helps. For critical issues, call or WhatsApp directly."

## Acceptance
- Responsive to 360px (add-user row wraps), no network requests, no console errors,
  all interactive elements keyboard-accessible.
