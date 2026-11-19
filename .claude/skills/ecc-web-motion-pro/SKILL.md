---
name: ecc-web-motion-pro
description: Pro-level playbook to rebuild or redesign the Royal Bath Hub website or app screens with award-level motion, graphics and cinematic scroll, free and local, fast on low-end phones, with tested recipes.
---
# Web motion pro (rebuild the website / redesign the app without asking another AI)
Read order: this file, then references/effects-catalog.md (what exists), references/redesign-playbook.md (the steps). Code that is already tested: references/recipes.css + recipes.js + demo.html (copy, do not rewrite).
Use when Ajmal says: rebuild the website, redesign the app, it looks old/ugly, add animation/cinematic/3D. Plan first, build only after his go (CORE_RULES 3). Build in the cloud (Rule 0).

## 1. Two modes (never mix them)
- WEBSITE (public, customers, mostly phones): cinematic allowed. Story scroll, big type, video/3D hero, shader backgrounds. Must degrade to a finished still page.
- APP (shop screens, staff on low-end Android, offline): calm and fast. Clear hierarchy, 48 px targets, high contrast, motion only for feedback (press, saved, error), 150 to 250 ms. No 3D, no scroll-jacking, no video, no web fonts that block.

## 2. What top sites share (research 2026: Awwwards-style winners, CSS Design Awards write-ups, scrollytelling reviews; community-reported, not a count of 100 sites)
1 One strong concept per site, not ten effects. 2 Scroll storytelling in scenes with pinned/sticky moments. 3 Oversized, expressive type with tight rhythm. 4 Full-bleed imagery or looping video, dark or high-contrast palettes. 5 WebGL/shader moments (gradients, distortion, 3D product) used sparingly. 6 Micro-interactions: magnetic buttons, cursor states, hover reveals. 7 Smooth scroll + scroll-linked progress. 8 Page/state transitions (View Transitions). 9 Device-tier fallbacks and reduced-motion respected. 10 Fast first paint; content readable before animation starts.

## 3. Decision table
| Goal | Use | Cost | Fallback |
|---|---|---|---|
| Fade/slide in on scroll | CSS `animation-timeline: view()` guarded by `@supports`, else IntersectionObserver (recipes) | ~0 | show content |
| Pinned story steps | CSS sticky + `--p` progress (recipes `.pin`) or GSAP ScrollTrigger | low | stacked sections |
| Horizontal gallery | sticky + translate by `--p` (recipes `.hscroll`) | low | normal swipe row |
| Product turntable / cinematic frames | canvas image sequence (recipes `Motion.sequence`), WebP frames, lazy after first 30 | medium | single poster image |
| Hero atmosphere | shader gradient (recipes `Motion.shader`) | low GPU at half-res | CSS radial gradient |
| 3D product | Three.js, one object, draco/glb under 1.5 MB, desktop/strong phones | high | still image |
| Big type reveal | split words + mask (recipes `Motion.split`) | ~0 | plain text |
| Smooth scroll | Lenis (website only) | few KB | native scroll |
| Page change feel | `document.startViewTransition` (recipes `Motion.transition`) | ~0 | instant swap |
| Counters, marquee, clip reveals, tilt, magnetic, cursor | recipes | ~0 | static |

## 4. Hard budgets (check before saying done)
First content visible under 2.5 s on a mid phone; total JS for the website under 200 KB gzip excluding Three.js; hero video under 2 MB with poster; images WebP/AVIF with width/height; fonts self-hosted WOFF2 (no Google Fonts call: it tells Google who visited), max 2 families, include Sinhala/Tamil fallback stacks (Noto) but never write Sinhala/Tamil copy Ajmal cannot check; animate transform/opacity only; one rAF loop; pause everything when tab hidden or element off-screen; Lighthouse-style checks by script.

## 5. Always
`prefers-reduced-motion` and the low tier (`Motion.tier()`) show the finished layout. Keyboard focus visible, contrast 4.5:1, real `<button>/<a>`, alt text, no autoplay sound, no scroll-hijack that traps the user. Content honesty: real shop photos, no fake reviews/counts, no riba/guaranteed wording; prices "ask us" by default. Brand: black, ash, gold; never orange (the app's current gold #F5A623 may read orange: confirm shade with Ajmal before changing).

## 6. Libraries (free, local npm, only for the website repo, never the shop app)
GSAP + ScrollTrigger, Lenis, Three.js (+ OGL for tiny WebGL). Check licence text on install, record in docs/INSTALLED.md. Reject: anything paid, anything sending prompts/telemetry out, template/AI services (e.g. GetLayers MCP), unmaintained or heavy libs.

## 7. Prove it (gate)
Run the demo-style test: phone 390 and desktop 1280 plus reduced-motion; no console errors; no sideways scroll; counters and clips complete in still mode; screenshot once at the gate; say UNVERIFIED for anything not seen. Log the task in AI_MEMORY/EFFICIENCY_LOG.md.
