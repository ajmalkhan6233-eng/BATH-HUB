# ROYAL BATH HUB COMMAND Mobile — Redesign Briefing V2 (14 Jun 2026)

Status: `C:\BATHCO_PHASE1\bathco-mobile` does not exist yet — this is a
from-scratch build (Expo / React Native + TypeScript), read-only against the
existing Express API at `http://localhost:3000`.

-----

## 1. Stack

- **Expo SDK** (managed workflow) + TypeScript
- **react-native-reanimated v3** — entrance animations, animated counters,
  worklet-driven gestures (pull-to-refresh, swipeable carousel)
- **expo-linear-gradient** — background gradients (deep navy → teal → gold)
- **react-navigation** (bottom tabs) — Home / Reports / Staff
- **victory-native** or hand-rolled SVG (via `react-native-svg`) for the
  donut/bar charts — kept lightweight for mid-range Android

## 2. Visual identity (distinct from generic blue fintech)

- Palette: `--navy:#0a1628`, `--teal:#1b3a4b`, `--gold:#d4af37`,
  `--gold2:#f0cf5e`, `--mint:#3ddc97` (positive), `--coral:#ff6b6b`
  (negative/alerts) — echoes the dashboard's emerald/gold theme but adapted
  for a dark mobile surface
- Typography: rounded sans for numbers (animated counters), serif accent
  for headers (matches dashboard's Cormorant Garamond branding)
- Cards: glassmorphism — `rgba(255,255,255,0.04)` fill, 1px gold-tinted
  border, soft shadow, 16px radius

## 3. Screens

### Home — "Today's Pulse"
- Hero card with `LinearGradient` background (navy→teal→gold sliver at
  edge), entrance: fade + slide-up (`FadeInDown` from reanimated)
- Animated counters (custom `useAnimatedCounter` hook driving
  `useDerivedValue` + `Animated.Text`) for: Total Sale, Gross Profit, Net
  Profit (or "PENDING" badge if `data_tier !== 'FULL'`, matching dashboard
  honesty rules)
- Below: swipeable date carousel (`react-native-reanimated` pan gesture) for
  the last 7 days — each card shows date, tier badge color, total sale;
  tapping a card navigates to Reports → that day's detail
- Pull-to-refresh: custom `RefreshControl` replacement using a rotating gold
  ring animation, refetches `/api/daily-summary?date=today`

### Reports — Calendar
- Month grid, each day cell colored via `DATA_INDEX.json` status from PART 1
  (complete=mint, partial=gold, missing/mismatch=coral) AND/OR live
  `data_tier` from `/api/calendar` (FULL/CASHFLOW/FOUNDATION) — both signals
  shown as a small dot + cell tint so the two data-quality views don't get
  confused
- Tap a day → bottom-sheet detail (animated slide-up) showing the same
  fields as the dashboard's day-detail panel (Tier badge, Total Sale, Cash
  In/Out, Net Profit or "— (no GP data)")

### Staff — Leaderboard
- Animated list using `LayoutAnimation`/reanimated `layout` transitions —
  rows re-order with a slide animation when sorted
- Rank-change indicators: small ▲/▼ chips (mint/coral) comparing current
  pay-period commission vs previous period (`/api/pay-period-summary`,
  added 14 Jun 2026)
- Same honesty rules as dashboard: Sales Amount / Net Profit Attributed show
  "PENDING" badges (no per-staff data source yet — PENDING_FROM_AJMAL)

## 4. API integration (read-only)

Reuses existing endpoints — no new backend work needed beyond what already
exists:
- `/api/home-stats`, `/api/daily-summary?date=`, `/api/calendar`
- `/api/weekly-detail`, `/api/monthly-detail`
- `/api/staff`, `/api/pay-period-summary` (new, added 14 Jun 2026)
- `/api/credit-customers`, `/api/suppliers`
- Session-cookie auth — mobile app needs a login screen (`/api/login`)
  before any of the above will respond (matches dashboard's existing auth)

## 5. Performance

- All entrance/counter/gesture animations driven by
  `useSharedValue`/`useAnimatedStyle`/worklets — no JS-thread animation loops
- Lists (`Staff` leaderboard, `Reports` day-detail line items) use
  `FlatList` with `removeClippedSubviews` for mid-range device support

## 6. Build order for this pass

1. Scaffold: `package.json`, `app.json`, `tsconfig.json`, `App.tsx`,
   navigation shell, theme constants, API client with session-cookie
   handling
2. Home screen: Pulse card + animated counters + date carousel
3. Reports screen: calendar grid + day detail sheet
4. Staff screen: leaderboard
5. `npm install` (background — large dependency tree)

Everything from PART 1 (DATA_INDEX.json) feeds the Reports calendar's
color-coding — no DB/dashboard changes required for this pass.
