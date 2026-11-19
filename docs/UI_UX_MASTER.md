# Master UI/UX Design & Engineering System (`CLAUDE.md`)

> **Last checked: 14 Nov 2026.** Install commands and versions below were re-checked against current repos, docs and npm pages. Items marked (check) could not be fully confirmed.

> **System Directive for Claude Code:** Whenever building, refactoring, or styling frontend interfaces in this repository, consult this blueprint. Reject generic "AI-generated" layouts (default Tailwind cards, plain un-animated transitions, basic spinners). Prioritize tactile physics, intentional typography, optical polish, and context-aware UX patterns.

---

## Part 1: The 5 Claude Code Skills & Repositories

### 1. UI/UX Pro Max (Design Intelligence)
* **What it is:** A searchable design-intelligence skill: 67+ UI styles, 97 palettes, font pairings, 9+ tech stacks, 161 reasoning rules, with automated design-system generation. The repo has passed 100k GitHub stars and counts keep growing.
* **Repo:** `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` | Site: `https://uupm.cc`
* **Install (pick one):**
  ```bash
  # Plugin way (inside Claude Code)
  /plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
  /plugin install ui-ux-pro-max@ui-ux-pro-max-skill

  # Skills CLI way
  npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max

  # Own CLI way (needs Python installed)
  npm install -g uipro-cli
  uipro init --ai claude
  ```
* **Rules for Claude Code:** Query design tokens before building a page; never guess hex codes. Body text contrast 4.5:1 minimum. Pair a geometric display font with a clean humanist body font.

### 2. Frontend Design (Anthropic official)
* **What it is:** Anthropic's official plugin that pushes Claude toward bold, production-grade interfaces instead of generic AI looks. Claude loads it automatically for frontend work.
* **Marketplace:** `anthropics/claude-plugins-official` (older guides still show `anthropics/claude-code`)
* **Install:**
  ```bash
  /plugin install frontend-design@claude-plugins-official
  /reload-plugins
  ```
* **Rules for Claude Code:** Commit to one clear aesthetic direction before coding (editorial, brutalist, tactile glass, etc.). No purple-blue gradient on white. Use asymmetric grids, dramatic type scale, micro-interactions. Note: it improves taste, not correctness. Still test the code.

### 3. Emil Kowalski's Design-Engineering Skills
* **What it is:** The creator of Sonner and Vaul open-sourced his animation, easing and UI-polish guidelines as a skill bundle (design-engineering philosophy, animation review, prototyping and more). Around 33k–37k stars.
* **Repo:** `https://github.com/emilkowalski/skills` | Site: `https://emilkowal.ski`
* **Install:**
  ```bash
  npx skills add emilkowalski/skills
  # or just the lead skill:
  npx skills add https://github.com/emilkowalski/skills --skill emil-design-eng
  ```
* **Rules for Claude Code:**
  * Never use default `ease` or `linear` for UI. Use custom curves: `cubic-bezier(0.32, 0.72, 0, 1)` for drawers/sheets, `cubic-bezier(0.22, 1, 0.36, 1)` for entrances.
  * Micro-interactions 150–300ms.
  * Animate only `transform`, `opacity`, `clip-path`.
  * Never animate from `scale(0)`. Start from about 0.95 with opacity.
  * Respect `prefers-reduced-motion`. Guard hover styles with `@media (hover: hover)`.
  * Use springs that keep velocity on interrupt. **Library is now called Motion:** `npm install motion`, then `import { motion } from "motion/react"` (old `framer-motion` package still works but is the old name).

### 4. App Store & Google Play Screenshots Generator
* **What it is:** A skill that builds a local editor for store-ready marketing screenshots with device frames, headlines, locales, and exports for both stores.
* **Repo:** `https://github.com/ParthJadhav/app-store-screenshots` (free, open source)
* **Install:**
  ```bash
  npx skills add ParthJadhav/app-store-screenshots -a claude-code
  ```
  Then ask: "Build App Store and Google Play screenshots for my app."
* **Tip from the repo:** capture your starting screenshots in the 6.1" simulator so little resizing is needed.
* **Current Apple sizes:** iPhone 6.9" = **1320 x 2868** (the required one now), 6.5" = 1284 x 2778, 6.3" = 1206 x 2622, 6.1" = 1125 x 2436. (The old 1290 x 2796 is the 6.7" size.)
* **Alternative:** `keremerkan/asc-screenshots` (adds iPad, localization, App Store Connect upload).

### 5. gstack (Garry Tan's virtual engineering team)
* **What it is:** Garry Tan's open-source Claude Code setup: role-based slash commands (CEO review, eng review, designer, QA with a real browser, release engineer). It has grown from 6 to roughly 28–35 skills. MIT license. Works on other agents too.
* **Repo:** `https://github.com/garrytan/gstack`
* **Install:**
  ```bash
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
  ```
* **Commands people use most:** `/plan-ceo-review`, `/plan-eng-review`, `/review`, `/qa`, `/ship`, `/browse`, `/investigate`, `/retro`. Exact names can change (check): type `/` after install to see the live list.
* **Rules for Claude Code:** Run the CEO/Designer pass before UI code to challenge the flow, then `/qa` for responsiveness and edge cases. A reviewer notes most people only use about 6 commands; ignore the rest.

---

## Part 2: Visual Effects & Shader Libraries

Use these when building hero sections, interactive landing pages, or Apple-style interfaces. **Check React version first:** React 19 pairs with `@react-three/fiber` 9.x; React 18 pairs with 8.x. Never mix.

### 6. Shader Gradient
* **What it is:** Moving 3D mesh gradients powered by WebGL.
* **Links:** `https://shadergradient.co` | `https://github.com/ruucm/shadergradient`
* **Install (v2+, note the extra peer packages):**
  ```bash
  npm i @shadergradient/react @react-three/fiber three three-stdlib camera-controls
  npm i -D @types/three
  ```
* **Spec:** 2–3 harmonious color stops. Pause when off-screen (`IntersectionObserver`). Lazy-load it (`React.lazy` / `next/dynamic`) because it adds about 290KB gzipped (three.js comes with it). A Vue build exists: `@shadergradient/vue`.

### 7. Liquid Glass (iOS 26 style refraction)
* **What it is:** Apple's Liquid Glass look on the web: edge refraction, chromatic aberration, elastic feel.
* **Links:** `https://github.com/rdev/liquid-glass-react`
  ```bash
  npm install liquid-glass-react
  ```
* **Heads-up:** Safari and Firefox only partly support the displacement effect. Always ship a plain frosted-glass fallback (`backdrop-filter: blur(24px) saturate(180%)` plus a soft inner highlight `inset 0 1px 1px rgba(255,255,255,0.4)`).
* **Other options:** `@specy/liquid-glass-react` (Three.js based), `@khoivudev/liquid-glass-react` (CSS/SVG only, no three.js), and `liquid-dom` (WebGPU, newer).

### 8. React Three Fiber (R3F)
* **What it is:** A React renderer for Three.js.
* **Links:** `https://r3f.docs.pmnd.rs` | `https://github.com/pmndrs/react-three-fiber`
* **Install:**
  ```bash
  npm install three @types/three @react-three/fiber @react-three/drei
  ```
* **Versions now:** R3F 9.x (React 19), drei 10.x. v10 is in development with WebGPU by default. Next.js: add `three` to `transpilePackages`.
* **Spec:** Use drei helpers (`Environment`, `Float`, `MeshTransmissionMaterial`, `ContactShadows`). Always add a `Suspense` fallback and dispose geometries/materials on unmount. The Canvas fills its parent, so give the parent a height.

### 9. Liquid Logo (liquid-metal logo shader)
* **What it is:** Turns a logo into flowing liquid metal with chromatic dispersion.
* **Links:** `https://github.com/paper-design/liquid-logo` | `https://shaders.paper.design/liquid-metal`
* **Now lives in Paper Shaders as `LiquidMetal`:**
  ```bash
  npm i @paper-design/shaders-react
  ```
  ```jsx
  import { LiquidMetal } from '@paper-design/shaders-react'
  ```
* **Heads-up:** Pin the exact version (breaking changes ship under 0.0.x). The license bars use inside a competing design tool or shader library; fine for normal websites and apps.
* **Spec:** Use a high-contrast SVG logo. Library handles the distance-field work for you.

---

## Part 3: Loading States & Navigation Architecture

### The 8 Loading State Patterns ("Not every loading state needs a spinner!")
1. **Spinner:** Only for short, indeterminate actions (1s–3s) where no layout exists yet (e.g., modal submit).
2. **Skeleton Screen:** For initial page/feed loads. Match the exact layout of incoming content, with a subtle shimmer. Prevents layout shift.
3. **Progress Bar:** For deterministic work with known progress (uploads, onboarding, exports).
4. **Pulsing Dots:** For real-time conversational feedback, AI streaming, or lightweight inline status.
5. **Button Loading State:** Lock button width, swap label for inline spinner + verb ("Saving..."), set `disabled` + `aria-busy="true"`.
6. **Full-Screen Overlay:** Only for blocking transitions (payment processing, workspace setup).
7. **Pull-to-Refresh:** Native touch pattern for feeds; spring resistance before triggering refresh.
8. **Infinite Scroll:** Append at the bottom threshold (`IntersectionObserver`, 200px rootMargin) with a small bottom loader.

### The 7 Core Navigation Patterns
1. **Tab Bar (Bottom Nav):** 3–5 top-level destinations. Short labels, filled icon for active, thumb-reach zone.
2. **Hamburger Menu (Drawer):** Secondary navigation or 6+ items. Never hide primary conversion actions inside it.
3. **Top Tabs:** Peer-level category switching. Support swipe and an animated underline (`layoutId` in Motion).
4. **Bottom Sheet:** Contextual tasks, filters, pickers. Drag handle, snap points (collapsed, half, full), dimmed backdrop.
5. **Hub & Spoke:** Central grid of independent tools; dive in, return home. Clear icons, 3–4 column grid.
6. **Gesture Navigation:** Full-bleed swipe interfaces. Show subtle hints on first load.
7. **Stack Navigation:** Drill-down flows with a persistent back button / swipe-back.

---

## Part 4: 100+ Production UI/UX Patterns, Micro-Interactions & Components

Claude Code: Use this catalog as a reference library when designing components, layouts, and interactions across the website.

### Category A: Layout & Spatial Architecture (1–15)
1. **Bento Grid Layout:** Asymmetric modular grid cards with unified border radii (16px-24px) and 1px subtle borders (`rgba(255,255,255,0.08)`), ideal for feature showcases.
2. **Sticky Split-Screen Storytelling:** Left column remains fixed (`position: sticky; top: 15vh`) with dynamic visual previews while the right column scrolls through narrative steps.
3. **Asymmetric Editorial Grid:** 12-column grid leaving intentional whitespace (e.g., columns 1–4 empty or reserved for section index numbers, content in columns 5–12).
4. **Holy Grail App Shell:** Fixed collapsible left sidebar, sticky top utility header, scrollable main canvas, and optional right inspector panel.
5. **Masonry / Waterfall Grid:** Variable-height cards packed tightly without awkward vertical gaps (ideal for media galleries and testimonials).
6. **Full-Bleed Viewport Hero (`100dvh`):** Uses dynamic viewport height (`100dvh`) so mobile browser address bars never clip bottom CTAs.
7. **Z-Pattern Landing Flow:** Alternates left-to-right visual/copy blocks for natural eye-tracking on marketing pages.
8. **F-Pattern Data Dashboard:** Places primary KPIs along the top row and high-priority lists along the left vertical axis.
9. **Floating Dock Navigation (macOS Style):** Centered bottom pill container with backdrop blur and proximity hover magnification.
10. **Command Palette (`Cmd + K` / `Ctrl + K`):** Keyboard-first modal search overlay for power users to jump to any page, action, or setting instantly.
11. **Multi-Column Master-Detail View:** Left list pane + right live preview pane (Linear/Apple Notes style) with keyboard arrow navigation.
12. **Horizontal Scroll-Snapping Carousel:** CSS `scroll-snap-type: x mandatory` with subtle edge fade masks and pagination dots.
13. **Sub-Grid Card Alignment:** Uses CSS `display: grid; grid-template-rows: subgrid` so card headers, bodies, and footers align perfectly across rows regardless of text length.
14. **Responsive Container Queries (`@container`):** Components adapt based on their parent container's width rather than the global viewport width.
15. **Safe-Area Aware Insets:** Applies `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)` for notched iOS/Android PWAs.

### Category B: Micro-Interactions & Tactile Physics (16–35)
16. **Magnetic Buttons:** Cursor subtly pulls the button toward the pointer within a 40px radius using spring interpolation.
17. **Tactile Press Scale:** Active buttons compress slightly (`transform: scale(0.97)`) on `:active` to simulate physical key travel.
18. **Spotlight Border Hover:** Radial gradient mask tracks mouse coordinates across a card grid, illuminating 1px borders near the cursor.
19. **Shared Element Layout Transition (`layoutId`):** Smoothly morphs an active tab pill, modal card, or image thumbnail from its list position into its expanded view.
20. **Sonner-Style Stacked Toasts:** Notifications stack with depth scaling (`scale(0.95)`, `translateY(-8px)`) and expand smoothly on hover.
21. **Rubber-Band Overscroll:** Elastic resistance when dragging past scroll boundaries or slider limits.
22. **Haptic-Visual Toggle Switch:** Spring-animated thumb that stretches slightly during state transition (`scaleX(1.15)`) before settling.
23. **Interactive Tilt Card (3D Perspective):** Subtle `rotateX` and `rotateY` (3° - 6° max) driven by normalized cursor coordinates with a specular glare layer.
24. **Animated Number Counter (Odometer):** Digits roll vertically when metrics or prices update (e.g., Monthly/Annual billing toggle).
25. **Morphing Hamburger-to-Close Icon:** Two or three SVG lines rotate and translate seamlessly into an `X` on menu open.
26. **Ripple / Ink Spread Effect:** Originates from exact click coordinates `(clientX, clientY)` for immediate touch confirmation.
27. **Copy-to-Clipboard Morph:** Copy icon cross-fades into a green checkmark with a `"Copied!"` tooltip badge for 2000ms.
28. **Swipe-to-Action List Row:** Horizontal drag reveals contextual Delete (red) or Archive (amber) actions with threshold snap.
29. **Drag-and-Drop Reorderable List:** Smooth vertical displacement of sibling items with elevated shadow (`box-shadow`) on the grabbed item.
30. **Animated Checkmark Stroke:** SVG `stroke-dashoffset` animates from `100` to `0` upon task or payment completion.
31. **Hover-Reveal Secondary Action:** Clean table rows or cards reveal edit/delete icons only on `:hover` or `:focus-within` to reduce visual noise.
32. **Contextual Floating Toolbar:** Appears directly above highlighted text (Medium/Notion style) with spring entrance.
33. **Accordion Smooth Height Expansion:** Animates `grid-template-rows: 0fr` to `1fr` for buttery, layout-safe FAQ collapses.
34. **Interactive Confetti / Particle Burst:** Triggered sparingly for high-value milestones (first project deployed, checkout complete).
35. **Cursor-Following Custom Tooltip:** Lightweight pill displaying context-specific hints (e.g., `"View Case Study"`) with slight spring lag.

### Category C: Visual Surfaces, Lighting & Depth (36–50)
36. **Hairline Gradient Borders:** Uses `background: linear-gradient(...) border-box` with `mask-composite: exclude` for razor-sharp, luminous 1px borders.
37. **Ambient Top-Light Elevation:** Lighter top border (`rgba(255,255,255,0.15)`) and darker bottom border (`rgba(0,0,0,0.4)`) to simulate overhead studio lighting.
38. **Noise / Film Grain Overlay:** Subtle SVG `feTurbulence` noise layer at `2%–4%` opacity over gradients to prevent color banding and add organic texture.
39. **Frosted Glassmorphism (`backdrop-filter`):** `blur(16px) saturate(180%)` paired with semi-transparent surface fills (`rgba(18, 18, 22, 0.72)`).
40. **Mesh Aurora Gradients:** Layered blurred radial orbs drifting slowly behind dark-mode hero typography.
41. **Dot-Matrix / Blueprint Grid Background:** Subtle repeating radial-gradient dots (`1px` at `24px` intervals) that fade out radially at viewport edges (`mask-image: radial-gradient(...)`).
42. **Neumorphic Tactile Controls:** Soft dual shadows (light top-left, dark bottom-right) used selectively for audio/hardware-inspired sliders and knobs.
43. **Dual-Layer Realistic Shadows:** Combines a tight ambient shadow (`0 1px 2px rgba(0,0,0,0.2)`) with a wide diffuse shadow (`0 12px 32px -4px rgba(0,0,0,0.35)`).
44. **Chromatic Aberration Text/Edge Glow:** Micro-offset red/cyan text-shadows (`-1px 0 #ff0055, 1px 0 #00f0ff`) on hover for cyber/tech aesthetics.
45. **Animated Beam / Border Trace:** A glowing light pulse travels along the perimeter path of a featured pricing card or input box.
46. **Progressive Blur Header:** Top navigation bar blends into scrolling content using layered CSS `backdrop-filter` masks rather than a hard bottom line.
47. **Dark Mode True-Surface Hierarchy:** Uses stepped charcoal elevations (`#09090B` base → `#121215` card → `#1C1C21` elevated modal) instead of pure `#000000` everywhere.
48. **Duotone Image Treatment:** Maps photography highlights and shadows to brand colors using CSS `mix-blend-mode` or SVG `feColorMatrix`.
49. **Interactive Parallax Depth Layers:** Foreground, midground, and background elements translate at different scroll speeds (0.8x, 1.0x, 1.2x).
50. **Specular Hover Sheen:** A diagonal translucent white gradient sweeps across buttons or badges on hover.

### Category D: Typography & Content Hierarchy (51–65)
51. **Fluid Typography (`clamp()`):** Scales smoothly across viewports without breakpoint jumps (e.g., `font-size: clamp(2.25rem, 5vw, 4.5rem)`).
52. **Tight Display Tracking:** Negative letter-spacing (`letter-spacing: -0.03em` to `-0.04em`) on large headings (>36px) for authoritative editorial polish.
53. **Tabular Numerals (`font-variant-numeric: tabular-nums`):** Prevents horizontal jitter in countdown timers, pricing tables, and live data tickers.
54. **Optical Line Length Constraint:** Restricts body paragraphs to `55ch–70ch` (`max-w-prose`) for effortless reading comprehension.
55. **Kinetic Split-Text Reveal:** Headlines reveal word-by-word or character-by-character from behind an `overflow: hidden` baseline mask.
56. **Scramble / Cipher Text Hover:** Characters briefly cycle through random glyphs before resolving to the target string on hover.
57. **Highlight Marker / Underline Draw:** Hand-drawn or crisp accent bar animates beneath key value-proposition phrases on scroll into view.
58. **Kicker / Eyebrow Badge:** Compact uppercase monospace label (`11px`, `letter-spacing: 0.08em`) above main H1 headlines to establish category context.
59. **Gradient Text Clipping:** `background-clip: text; color: transparent` with high-contrast metallic or sunset stops for focal keywords.
60. **Inline Code & Keyboard Shortcut Pills (`<kbd>`):** Styled keycaps (`border-b-2`, monospace font) inside documentation and tooltips.
61. **Reading Progress Indicator:** Ultra-thin 2px top bar bound to scroll progress (`scaleX`) on long-form articles.
62. **Smart Truncation with Fade:** Multi-line clamp (`-webkit-line-clamp: 3`) paired with an interactive `"Read more"` expansion trigger.
63. **Hanging Punctuation:** Aligns quotation marks and bullets outside the main text block edge for clean vertical alignment.
64. **Variable Font Weight Hover:** Smoothly interpolates `font-variation-settings: 'wght' 400` to `'wght' 650` on interactive links.
65. **Structured Scannable Bullets:** Bold lead-in phrases followed by concise explanations—never walls of unformatted text.

### Category E: Forms, Inputs & Conversion UX (66–80)
66. **Floating Label Inputs:** Placeholder smoothly shrinks and translates into the top border or upper-left corner on focus.
67. **Inline Real-Time Validation:** Validates format (email, username availability) on `onBlur` with clear, empathetic error messages—never premature red errors while typing.
68. **OTP / Pin Code Auto-Advance Boxes:** Individual character boxes that auto-advance focus, support full paste (`Ctrl+V`), and auto-submit on the final digit.
69. **Password Strength Meter & Visibility Toggle:** Visual segmented bar + clear criteria checklist + accessible eye icon toggle.
70. **Multi-Step Progressive Form Wizard:** Breaks complex onboarding into 3–4 bite-sized steps with a persistent progress bar and preserved state.
71. **Optimistic UI Updates:** Immediately reflects likes, comments, or settings toggles in the UI before the server responds, rolling back gracefully only on error.
72. **Smart Auto-Formatting Inputs:** Automatically spaces credit card numbers (`4242 ••••`), phone numbers, and currency values as the user types.
73. **Drag-and-Drop File Dropzone:** Dashed border container that highlights on `dragover`, shows file previews, upload progress bars, and file-size validation.
74. **Tag / Chip Multi-Select Input:** Allows typing + `Enter` or comma to convert strings into removable pill tokens with `Backspace` deletion.
75. **Interactive Pricing Tier Comparison:** Monthly/Annual toggle with `"Save 20%"` badge, highlighted `"Most Popular"` center card, and expandable feature matrix.
76. **Frictionless Magic-Link / Social Auth:** Prominent OAuth buttons above email inputs with `"Last used"` badge memory.
77. **Sticky Mobile Bottom CTA Bar:** Keeps the primary conversion button anchored at the bottom of mobile viewports once the hero CTA scrolls out of view.
78. **Smart Empty States:** Never show a blank white box; include a custom illustration, clear explanation, and a single primary CTA button (e.g., `"Create your first project"`).
79. **Destructive Action Confirmation:** Requires typing the resource name or holding a `"Hold to Delete"` progress button for irreversible actions.
80. **Autosave Indicator:** Subtle `"Saving..."` → `"Saved to cloud"` status badge in editors so users never hunt for a Save button.

### Category F: Data Visualization, Feedback & Accessibility (81–100)
81. **Interactive Sparklines:** Compact inline trend charts inside KPI cards with hover crosshairs and delta badges (`+14.2%`).
82. **Custom Glassmorphic Chart Tooltips:** Floating dark/frosted breakdown cards that follow chart data points smoothly.
83. **Activity Heatmap Grid (GitHub Style):** Contribution or habit calendar grid with stepped color intensity and hover date tooltips.
84. **Radial Progress Rings:** SVG stroke-dasharray gauges for storage quotas, health scores, or completion metrics.
85. **Segmented Status Bars:** Horizontal proportional bars showing distribution (e.g., Storage breakdown: Code, Media, Docs).
86. **Interactive Filter Pill Bar:** Horizontal selectable chips with active counts (`All (42)`, `Active (18)`, `Archived (24)`) and instant client-side filtering.
87. **Sortable & Resizable Data Tables:** Sticky table headers (`position: sticky; top: 0`), zebra/hover row highlights, and bulk-action floating bars when checkboxes are selected.
88. **Contextual Onboarding Coachmarks / Spotlight Tour:** Dims the screen and cuts out a spotlight hole around key UI features for first-time users.
89. **Interactive Live Sandbox / Playground:** Embedded live preview beside code snippets allowing visitors to tweak props/sliders in real time.
90. **Before / After Comparison Slider:** Draggable vertical divider handle allowing users to compare raw vs. enhanced designs interactively.
91. **Social Proof Marquee:** Infinite seamless horizontal ticker (`@keyframes marquee`) displaying client logos or reviews that pauses smoothly on hover.
92. **Interactive FAQ / Knowledge Search:** Instant keyword filtering across accordion items with highlighted search term matches.
93. **Offline / Reconnecting Banner:** Non-intrusive top status strip that alerts users if WebSocket/network drops and auto-dismisses upon reconnection.
94. **Undo Toast Action:** Gives users a 5-second `"Undo"` button after deleting an item instead of interrupting them with an `"Are you sure?"` modal.
95. **Keyboard Focus Rings (`:focus-visible`):** Custom high-contrast focus outlines that appear exclusively for keyboard navigation, never cluttering mouse clicks.
96. **Reduced Motion Respect (`prefers-reduced-motion`):** Automatically disables parallax, 3D tilts, and continuous loops when the OS accessibility toggle is enabled.
97. **Semantic ARIA Landmarks & Live Regions:** Uses `<main>`, `<nav>`, `<dialog>`, and `aria-live="polite"` so screen readers announce dynamic toast/loading updates.
98. **Skip-to-Content Link:** Hidden link at the very top of the DOM that becomes visible on first `Tab` press for keyboard users.
99. **High-Contrast Color Token System:** Separates primitive tokens (`--blue-500`) from semantic tokens (`--bg-surface`, `--text-primary`, `--border-subtle`) for effortless theme switching.
100. **404 / Error Boundary Delight:** Custom interactive 404 page with helpful navigation links and a quick search bar instead of a dead-end browser error.