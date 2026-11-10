Paste this whole message into Gemini (AI Studio). It needs nothing else.

---
You are a senior iOS-style UI designer. Write ONE complete file: style.css for a phone web app called "RBH Pocket" (a read-only shop dashboard for a bathroom and tile shop owner in Sri Lanka). It is opened on an iPhone, mostly one hand, bright shop light. Return ONLY the CSS in one code block. No explanation, no other files.

LOOK I WANT
- Feels like a native Apple app (Apple Wallet, Stocks, Health): big bold title, frosted translucent top bar, rounded cards, smooth spring animations, press-scale on buttons, cards that glide in one after another.
- NOT completely black and NOT plain white. Pick a rich, easy-on-the-eyes premium palette built around the shop brand: deep ash grey, warm gold, soft cream. You choose it, make it look expensive and readable in daylight. Numbers must be large and high contrast.
- Add a tasteful subtle depth: soft shadows, gentle gradients, thin highlight borders. Respect prefers-reduced-motion.
- Phone first at 390px wide, no horizontal scroll, tap targets at least 44px, safe-area padding for the iPhone notch and home bar. System fonts only. No @import, no url(), no CDN, no external images.

HARD RULES (my JavaScript depends on these, do not rename or remove anything)
- Style exactly this markup and these classes. Do not assume any other element exists.
- Classes created by my JS inside #cards: .card (with an h2 title inside), .big (the large Today amount), .grid (two cards side by side, each has a .v number), .row with .l (left text) and .r (right text; may also have .down or .dim), .pill with .ok or .bad, and plain divs with classes .up .down .dim. The header text uses .sub and .sub.stale. The lock screen uses .gate, .msg and button.gold.
- Keep [hidden]{display:none!important}.
- body must scroll normally (no position:fixed, no overflow:hidden on body).
- The page's JS toggles class "scrolled" on body after 24px of scroll: use it to shrink the big title (h1) and show a hairline under the header.
- Cards appear in #cards in order; animate with :nth-child delays.

MARKUP
<body>
<section id="gate" class="gate" hidden>
  <h1><span>RBH</span> Pocket</h1>
  <p id="gateText">Enter your passcode</p>
  <input id="pass" type="password" inputmode="text" autocomplete="current-password" aria-label="Passcode" placeholder="Passcode">
  <button id="unlock" class="gold">Open</button>
  <div id="gateMsg" class="msg" role="status"></div>
</section>

<main id="app" hidden>
  <header>
    <div><h1><span>RBH</span> Pocket</h1><div id="when" class="sub" role="status"></div></div>
    <div class="btns"><button id="refresh" aria-label="Refresh">&#8635;</button><button id="lock" aria-label="Lock">Lock</button></div>
  </header>
  <div id="cards"></div>
</main>

Cards inside #cards, in order: Today (.big amount, then a line with bills and up/down vs yesterday), This week and This month (inside .grid), Money in today (rows), To pay (.pill then rows), Stock (rows), Best sellers this month (rows).
---
