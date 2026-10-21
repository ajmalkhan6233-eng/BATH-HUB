# DESIGN AUDIT — Bath Hub (design/antigravity-redesign)
_Generated: 2026-10-02 by Antigravity design agent_

## Priority 1 — Critical (affects every screen)

| # | File | Issue |
|---|------|-------|
| 1 | bathco_complete.html | Icons are emoji throughout nav, buttons, KPI cards. Emoji render inconsistently across Android/iOS/desktop; replace with inline SVG. |
| 2 | bathco_complete.html | Bottom-nav tap targets are ~36px tall (less than 48px). Labels 10px — below 11px readability floor on small phones. |
| 3 | bathco_complete.html | tabular-nums applied to .kpi-value but missing from .pay-val, .report-row.total, money td cells — amounts shift width on update. |
| 4 | money-control.html | Completely separate design system (light stone/emerald, Work Sans, 6px radius) — jarring break from main dark-gold theme. |
| 5 | investor-view.html | No bundled font. Numbers in .big have no tabular-nums. Hard to read on older Android. |
| 6 | setup.html | backdrop-filter not guarded with @supports — older devices get transparent card with near-invisible white-on-white text. |

## Priority 2 — Spacing / Alignment

| # | File | Issue |
|---|------|-------|
| 7 | bathco_complete.html | login box padding:40px breaks 4px grid. KPI gap:14px not on 4px grid. |
| 8 | bathco_complete.html | Collapsed sidebar 60px wide — icon touch target only 40px, below 48px minimum. |
| 9 | bathco_complete.html | Welcome-banner emoji is a mosque — off-brand for bathroom/tiles shop. |
| 10 | money-control.html | header padding:20px excessive on mobile; no sticky context. |

## Priority 3 — Typography

| # | File | Issue |
|---|------|-------|
| 11 | bathco_complete.html | kpi-label at 11px uppercase borderline too small — use 12px. |
| 12 | money-control.html | References Work Sans font but no local bundle; falls back to system. |
| 13 | investor-view.html | System font only — inconsistent cross-device. |
| 14 | bathco_complete.html | Collapsed sidebar nav-label: opacity:0 hides text but layout still occupies space. |

## Priority 4 — Color / Contrast

| # | File | Issue |
|---|------|-------|
| 15 | bathco_complete.html | --text2:#999 on --bg:#0D0D0D = contrast ~3.5:1 (fails WCAG AA 4.5:1 for small text). |
| 16 | bathco_complete.html | --text3:#666 on dark bg = ~2.4:1 — ensure no data shown in text3. |
| 17 | money-control.html | Gold #c9a227 on stone-50 #f7f4ec = ~2.1:1 — fails for labels. |

## Priority 5 — Empty States / Branding

| # | File | Issue |
|---|------|-------|
| 18 | bathco_complete.html | .no-data is plain text only — no illustration or helpful message. |
| 19 | All screens | No bath/tile product graphic anywhere. Brand illustration absent. |
| 20 | bathco_complete.html | Login uses bathtub emoji as logo — no SVG brand mark or logo slot. |

## What's Already Good (keep)
- CSS variables and dual light/dark theme — solid foundation
- tabular-nums on .kpi-value — correct
- backdrop-filter blur on cards — premium; keep for desktop
- Skeleton loading states
- Offline-first service-worker / offline-queue — do not touch
- 4px spacing grid mostly followed

## Redesign Execution Order
1. bathco_complete.html — CSS system, SVG icons, spacing, bottom-nav, login. One commit.
2. money-control.html — align tokens, fix font, fix contrast. One commit.
3. investor-view.html — align tokens, tabular-nums, Inter snippet. One commit.
4. setup.html — @supports fallback, align tokens. One commit.
