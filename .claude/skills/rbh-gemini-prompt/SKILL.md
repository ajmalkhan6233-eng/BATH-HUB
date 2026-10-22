---
name: rbh-gemini-prompt
description: Use when AJ needs a prompt for Gemini or any other AI: exact, with all shop facts, blocking the wrong paths.
---
# Prompt for another AI (AJ's hard rule: never vague, never generic)
Always include: Royal Bath Hub, No. 173/1 Kandy Road, Thihariya, about 12 x 70 ft, mainly bathroom accessories, tiles second, halal only, prices in Sri Lankan rupees, owner on an iPhone with voice-to-text, stack Node + Express + PostgreSQL + plain HTML/JS, shop number 074 035 5536 only.
- One goal in one sentence. The exact output: one file, name, format.
- Block wrong paths: no Tailwind or CDN files, no new libraries, no invented phone numbers or social handles, no Sinhala or Tamil text unless given, no placeholders left in.
- Say "answer I DON'T KNOW instead of guessing".
- Deliver the prompt in its own code block. When Gemini answers, check it and tell AJ what to change in one plain line. Do not say Gemini is wrong.
