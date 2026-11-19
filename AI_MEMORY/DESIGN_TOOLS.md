# DESIGN + CINEMATIC TOOLS for Claude Code (research 2026-11-04). Nothing installed yet except our own text skill.
Rules applied: free only, runs locally, nothing sent out, text/skills first, Ajmal's YES before any install. Low-end Android: cinematic effects are for the public website, never the shop app.
| # | Tool | What it adds | Cost / privacy | Status |
|---|---|---|---|---|
| 1 | ecc-cinematic-web (our own skill) | direction-first method, 5-scene story, motion + media budget, low-end rule, honesty rules | free, text only | INSTALLED (repo + global) |
| 2 | Anthropic "frontend-design" skill | picks a real visual direction and typeface before UI code (avoids generic AI look) | free; third-party listings differ on source and licence; plugin install = Ajmal YES | OPTIONAL: our skill already covers the idea |
| 3 | GSAP + ScrollTrigger | pinned scenes, reveals, scroll storytelling | believed free for all since Webflow bought it (2025): check gsap.com terms first | NEEDS YES, per website project |
| 4 | Lenis | smooth scroll, few KB, no dependencies, works with GSAP | free open source | NEEDS YES, per website project |
| 5 | Three.js | one 3D hero (e.g. a rotating tap or basin) | MIT as far as known; heavy: desktop/strong phones only | NEEDS YES, per website project |
Reference only (read, do not install): Open Design "cinematic scroll storytelling" recipes (preloader, split-text, pinned scenes, card stacks, parallax).
SKIPPED: GetLayers AI (templates + prompts through its MCP go to a third party; prices not public; generic template look).
YES to paste when you want 3, 4 and 5 added to the website project: `YES add GSAP, Lenis, Three.js to bathhub-website`
Sources: claudelog.com/faqs/what-is-frontend-design-skill-in-claude-code, github.com/darkroomengineering/lenis, open-design.ai/plugins/cinematic-scroll-storytelling, moge.ai/product/getlayers

## UPDATE 2026-11-04 (Ajmal: complete authority)
Ajmal pre-approved: Claude selects the good free/local/open-source design libraries and installs them automatically when needed, and rejects the bad ones. Bounds that stay: free only, runs locally, nothing sent out, no hook/network-running scripts, website repo only (never the shop app), each install logged in docs/INSTALLED.md.
New skill: ecc-web-motion-pro (SKILL.md + effects-catalog + redesign-playbook + tested recipes.css/js + demo.html). ecc-cinematic-web stays as the short version.
