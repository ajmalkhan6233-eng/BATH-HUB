---
name: rbh-i18n
description: Use for any English, Sinhala or Tamil text, language switch, currency, date or number formatting on the Royal Bath Hub website or app.
---

# Royal Bath Hub language rules (Gemini list, trimmed)

## The AJ rule comes first
Never write, correct or "improve" Sinhala or Tamil wording. A native reader checks it first (my Sinhala was wrong before). Claude only checks layout and missing text. English is the default and the fallback.

## Layout
- Fonts: Noto Sans Sinhala and Noto Sans Tamil, then system-ui. Sinhala and Tamil need line-height about 1.6 to 1.7 and no negative letter-spacing.
- Buttons grow with the text: min-width, never a fixed width. No cutting text by character count. Allow wrapping.
- Both scripts are left-to-right. Use dir="auto" on typed customer input so mixed text behaves.
- Test every screen with the longest string. Phone first (390 px).

## Missing text guard
- A missing translation shows the English text, never a raw key, "undefined" or "null". The QA run (rbh-qa) scans for these words.

## Numbers, money, dates
- Money: Intl.NumberFormat with the en-LK locale, "Rs 1,250". Dates and times in the Asia/Colombo time zone. Plurals through Intl.PluralRules, never "(s)".
- Hijri dates (Noor): Intl with the islamic-umalqura calendar plus a manual plus or minus one day for moon sighting.

## Never
- No machine-translated Sinhala or Tamil on customer pages. No Sinhala or Tamil in WhatsApp messages unless a native reader approved the exact text.
