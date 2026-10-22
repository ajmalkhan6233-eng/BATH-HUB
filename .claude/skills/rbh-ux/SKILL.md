---
name: rbh-ux
description: Use before building or changing any screen, form, POS, receipt, sticker, report or website page for Royal Bath Hub. Short UX rules for a phone-first, busy-shop owner who uses voice-to-text. Free tools only.
---

# Royal Bath Hub UX rules (read before any UI work, about 1 minute)
Full filtered checklist and 50 free ideas: docs/UX_CHECKLIST.md (read only when auditing or planning, not every time). Original upload kept in Project docs as claude/UX_SKILL_ORIGINAL.md.

## Who uses it
AJ on an iPhone in a busy shop, voice-to-text, not a developer. Staff use the POS. Money is Sri Lankan rupees: show "Rs 1,250" with thousands separators.

## Before coding (30 seconds)
1. One sentence: what must the user get done in 3 seconds? ONE main button per screen.
2. Design the 6 states: normal, loading, empty (say what to do next), error (say what to do), partial, offline (saved on the phone, sends later). Build all 6 or write why not.
3. Smallest change, own module/file. No new library or paid service without AJ's OK. Plain CSS/JS in public/ is the default.

## Phone-first rules
- Tap targets at least 44 px. Inputs at least 16 px text (stops the iPhone zoom). No sideways scroll. Use 100dvh, not 100vh. Safe-area padding. Tables become cards under 640 px. Forms one column on phones.
- Number fields: inputmode numeric or decimal. Item codes and SKUs: autocapitalize off, autocorrect off, spellcheck off. Autofocus the first field on scan and POS screens.
- Search is forgiving: ignore case, spaces and accents, fuzzy match. Voice-to-text words come out garbled.
- Every upload has Download and Remove (AJ rule). Every list has search. A destructive action asks once, with the bill or item named ("Void bill 123?").
- Money: whole rupees or cents as integers (or DB decimals), never float sums, round once at the end. Show totals and change in big text.

## Look (not the generic AI look)
- Brand: black, ash, logo champagne gold, long logo. No purple gradients. Colours only through CSS variables.
- Spacing steps 4, 8, 12, 16, 24, 32, 48. 1 px subtle borders instead of heavy shadows. Inner radius = outer radius minus padding.
- text-wrap: balance on headings, pretty on body. Font sizes with clamp(). Gap, not stacked margins.

## Speed and safety
- Never leave the user staring: show "One moment" or a skeleton instantly (the Layla waiting-message pattern). Disable the button after one tap so a bill is never saved twice. Saves are idempotent.
- Offline: save on the phone first, send after. Show a clear Online/Offline badge.
- Lists load 20 to 50 rows. Debounce search 250 ms. Lazy-load images (WebP). Nothing over 100 KB of new script.

## Never
- Never show the cost code, costs or margins on a customer page or to staff screens.
- Never post Sinhala or Tamil text AJ cannot check. Never show AJ's personal number (shop number only: 074 035 5536).
- Never use hover as the only way to discover a button.

## Before saying "done"
Open at 390 px wide, tap every button, check all 6 states, no console errors, Jest baseline not grown, run docs/SHIP_CHECK.md. Anything not run is UNVERIFIED.
