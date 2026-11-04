# Effects catalog (what top sites run, how to build it free, when NOT to)
Format: effect | how | cost | skip when
## Scroll and story
- Reveal on scroll (fade/slide/blur-in) | CSS view() timeline or IO | ~0 | never skip, keep subtle
- Scroll progress bar / section index | CSS scroll() timeline or --p | ~0 | -
- Pinned scene with changing text/images | sticky + --p; GSAP pin+scrub for complex timelines | low | tiny screens: stack
- Horizontal scroll gallery | sticky + translateX(--p) | low | cards must also swipe natively on phones
- Scroll-scrubbed video (play by scroll) | image sequence canvas (never video.currentTime scrubbing: janky) | medium | slow network
- Parallax layers | translate by scroll speed on 2-3 layers max | low | reduced motion
- Sticky card stack | sticky + scale on exit | low | -
- Scroll snap sections | CSS scroll-snap (proximity) | ~0 | long text sections
- Scroll-hijack (wheel locks) | AVOID: users lose control | - | always
## Type and text
- Split text (chars/words/lines) mask reveal | recipes split | ~0 | very long paragraphs
- Variable-font weight/width on scroll or hover | font-variation-settings (self-hosted variable font) | low | file too big
- Marquee / ticker | CSS | ~0 | reduced motion
- Scramble/decode text, typewriter | JS timer | low | headings people must read fast
- Oversized outline/filled type, text mask over video | CSS background-clip:text, mix-blend | low | contrast fails
## Graphics and WebGL
- Shader gradient / noise / fluid background | tiny WebGL (recipes) or CSS conic/radial | low at half res | low tier
- Image distortion / ripple on hover | WebGL plane shader (OGL/Three) | medium | touch phones
- 3D product viewer (orbit/turntable) | Three.js + glb, or image sequence (cheaper) | high / medium | low tier: poster
- Particles / dust / sparkle | canvas 2D, under 150 particles | low | low tier
- Grain / noise overlay | SVG feTurbulence or tiny PNG | ~0 | subtle only
- Glass / frosted UI | backdrop-filter | medium on weak GPUs | app screens: avoid
- Gradients mesh, glow, borders that follow cursor | CSS conic-gradient + pointer vars | low | touch
## Interaction
- Magnetic button, tilt/spotlight card, hover image reveal | recipes | ~0 | touch, reduced motion
- Custom cursor with states | recipes cursor (fine pointers only) | ~0 | touch
- Drag/inertia carousel | pointer events + transform | low | accessible buttons required too
- Page loader / preloader | only if assets > 1 MB, under 1.2 s, real progress | low | otherwise none
- Page transitions | View Transitions API (guarded) | ~0 | unsupported browsers swap instantly
- Sound | AVOID by default; opt-in toggle only | - | -
## Layout and finish
- Bento grids, asymmetric editorial layout, giant section numbers | CSS grid | ~0 | -
- Dark mode first with one accent (gold) | CSS variables | ~0 | -
- Smooth scroll (Lenis) | website only | low | app, long forms
- Skeleton shimmer, optimistic UI, toasts, haptic-like press scale | CSS | ~0 | -
## Support facts (verify on MDN/Can I Use before relying)
CSS scroll-driven animations: Chrome/Edge since 115; Safari and Firefox support reported differently by sources, so always guard with @supports and keep a fallback. View Transitions: same-document widely available, cross-document less so. WebGL1 nearly everywhere; keep a static fallback.
