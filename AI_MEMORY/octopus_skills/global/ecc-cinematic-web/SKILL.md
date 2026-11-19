---
name: ecc-cinematic-web
description: Build cinematic, story-style websites that stay fast on low-end Android, with free tools only (CSS, GSAP, Lenis, Three.js), honest content and a phone-first check.
---
# Cinematic web (own method, free tools, phone first)
1. DIRECTION FIRST, before code: one line each for mood, palette, type pair, and the one feeling a visitor should leave with. RBH site: black, ash, gold; never orange; real accessories showroom, not stock-template look.
2. STORY IN 5 SCENES: hook (one big line + one image/loop), the product up close, proof (real photos, real shop), how to buy (ask us / visit / WhatsApp), contact. One idea per scene. Prices hidden ("ask us") by default.
3. MOTION RULES: animate transform and opacity only; 0.4 to 0.9 s with easing; scroll-linked effects for 2 or 3 hero moments only, never everywhere; always honour prefers-reduced-motion (show the still version).
4. FREE STACK, text-first: plain CSS and the Web Animations API first; add GSAP + ScrollTrigger for pinned scenes and reveals, Lenis for smooth scroll, Three.js only for one 3D hero. Each is a local npm package: nothing is sent out. Check each licence page before use; leave out paid libraries and template/AI services that send prompts or data out (e.g. GetLayers MCP) unless Ajmal says yes.
5. MEDIA BUDGET: images WebP/AVIF with width/height set; background video muted, looped, under 2 MB, with a poster image; compress locally; free-licence footage only (record the source). No autoplay sound.
6. LOW-END RULE: if the phone has little memory, Save-Data on, or reduced motion, skip 3D and heavy scroll effects and show the still layout. Target: first content visible under 2.5 s on a mid phone.
7. HONESTY: real photos, real words, no fake reviews or counts, nothing Sinhala/Tamil that Ajmal cannot check, no invented numbers or handles, no riba or guaranteed-return wording.
8. PROVE IT: screenshot at 390 px and 1280 px (playwright, only at the gate), no console errors, no sideways scroll, contrast readable, animation off still looks complete. Say UNVERIFIED for anything not seen.
Output a one-screen plan first; build only after Ajmal's go. Website lives in the separate bathhub-website repo; never publish except on his word.
