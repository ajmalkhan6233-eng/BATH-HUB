# UI SPEC — Theme Pack (background themes + picker preview)
Self-contained spec for an external AI (Google AI Studio). You have ZERO other context; everything
you need is in this file.

## Hard rules
- Tech stack: **React 18 + Vite + Tailwind CSS** (+ plain Canvas 2D / SVG / CSS animation —
  **no three.js, no WebGL, no external libraries, no CDN imports**).
- **NO backend calls. NO real data.** Demo business name if needed: "Demo Hardware Store".
- Output must be **exportable**: one `themes/` folder of self-registering theme modules + a
  `<ThemePreview />` React component. Each theme is a plain JS module with the exact contract
  below so it can be dropped into an existing engine.

## Purpose
An ERP dashboard has a swappable animated **background layer** behind glass UI panels. Two themes
already exist (built on WebGL elsewhere — do NOT rebuild them): `nature` (floating gold/emerald
wireframe) and `kim_forest` (forest terrain). Your job: design **4 NEW themes** that run WITHOUT
WebGL (CSS/Canvas2D only, so they also serve as low-end-hardware fallbacks), plus a preview/picker
component.

## Theme module contract (must match exactly)
Each theme file default-exports:
```js
export default {
  id: 'ember_dusk',            // snake_case, unique
  label: 'Ember Dusk',         // human label for the Settings picker
  mount(container) {           // container = a fixed, full-viewport div behind the app
    // build DOM/canvas, start animation (requestAnimationFrame or CSS)
    return {
      resize() {},             // called on window resize
      dispose() {}             // MUST fully stop rAF loops and remove all created nodes
    };
  }
};
```
Rules for every theme:
- Must look good BEHIND glass panels (`rgba(10,20,14,0.72)` cards with white text): keep overall
  luminance low, avoid pure white areas, avoid rapid flashing; subtle slow motion only.
- Must idle cheaply: target < 3% CPU on a modest laptop; pause animation when
  `document.hidden === true`.
- No pointer-event capture (background is decorative; `pointer-events: none`).

## The 4 new themes (names + art direction)
1. `emerald_drift` — "Emerald Drift (Calm)": near-black emerald gradient, 3-4 huge blurred
   emerald/gold radial blobs drifting extremely slowly (CSS keyframes).
2. `gold_grid` — "Gold Grid": dark ground plane made of a faint perspective gold line grid
   (Canvas2D), slow parallax scroll toward the horizon, few floating dust particles.
3. `ember_dusk` — "Ember Dusk": deep brown-to-emerald vertical gradient, sparse warm ember
   particles rising slowly with slight sway (Canvas2D), occasional soft glow pulse.
4. `paper_light` — "Paper (Light)": THE ONE LIGHT THEME — warm off-white paper texture feel via
   CSS gradients + very subtle animated grain; include a note in code that glass panels flip to a
   light variant when this theme is active (emit `container.dataset.mode = 'light'`; the host app
   handles the rest).

## Registry + picker preview
- `themes/index.js` exports `THEME_REGISTRY`: array of the 4 modules' `{ id, label }` plus the two
  existing WebGL entries hardcoded as `{ id:'nature', label:'Nature (Default)', external:true }`
  and `{ id:'kim_forest', label:'Kim Forest', external:true }` (external = provided by host, no
  module here).
- `<ThemePreview />`: a demo page — full-viewport theme layer + one sample glass card ("Demo
  Hardware Store — Net Profit $ 2,140") + a theme `<select>`; switching selects mounts/disposes
  themes through the contract (proves dispose works — switching 20× must not leak nodes or rAF).

## Acceptance
- Zero WebGL usage; zero network requests; dispose() verified leak-free; each theme ≤ ~150 lines;
  works in Chrome + Firefox; respects `prefers-reduced-motion` (statically render, no animation).
