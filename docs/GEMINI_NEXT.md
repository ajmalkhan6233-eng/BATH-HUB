Paste everything below the line into Gemini (AI Studio), then paste Gemini's reply back to Claude chat.
---
You are a senior front-end engineer. Build two files for a plain HTML shop app (no React, no build step, no CDN, no fonts, no external images): ux-extra.css and ux-extra.js. Return each in its own code block, nothing else. Phone first (390px), iPhone feel, brand = black, ash grey, champagne gold (#C9A227), system fonts. Respect prefers-reduced-motion. Every piece must work by just adding a class or calling a function; do not touch existing classes.

Build these pieces:
1. .stepper : steps joined by one solid line with a gold progress fill (data-step="3" data-of="4" sets progress); completed steps show a check.
2. .inline-alert (.warn .bad .ok) : a calm card that sits inside content (icon, one line, one action button), NOT a top banner.
3. .peek-row : horizontal scroll row with scroll-snap that always shows about 48px of the next card.
4. .curved-input : text input whose bottom border is a gentle curve that straightens and glows gold on focus (CSS/SVG only).
5. .depth-card : card with subtle 3D tilt toward the finger/mouse (JS, 60 lines max, off on reduced motion).
6. RBH.particleText(el): text that assembles from small dots on a canvas once, then becomes normal text (under 80 lines, stops animating after 2 seconds to save battery).
7. .spring-accordion : details/summary style accordion that opens with an elastic overshoot (cubic-bezier(0.34,1.56,0.64,1)).
8. .side-push : when body gets class "side-open", the page scales to 86% and slides 150px right while a side menu slides in from the left (do not overlay).
Add a short usage comment at the top of each file. Keep total size under 12 KB.
