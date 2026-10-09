# LATEST_REPORT 2026-10-09: new RBH logo (gold on black) in the website and the app
PROBLEMS
- Website live link NOT updated: the logo is built and pushed on branch work of bathhub-website (d2c8fdc), but nothing is published (no Netlify login; publish waits for "publish site").
- 4 identical zips in Downloads (RBH-logo-pack.zip, _1, _2, _3: same hash); I used RBH-logo-pack.zip. preview-sheet.png not used anywhere.
- Same-name file: favicon-32.png (old one saved to public/brand/old-logo/ first, then replaced). Other old logo files untouched.
- The new logo is gold with no black box, so on the white Design 2 top bar and login card it is gold on white (readable, softer). On the WhatsApp receipt picture it sits on a black plate.
- Website: header/footer now show only the RBH picture (the old "BATH HUB" word and mark were part of the old logo). og:image uses the Netlify address; change it if a custom domain is added.
- Left alone (not logos): navy colours inside the WhatsApp receipt picture, manifest theme_color in the website.
DONE (VERIFIED: pages opened at 390px, every logo loads, none stretched; dev server only)
- Logo pack unzipped to C:\Bathco\Logo (13 files + preview-sheet).
- Website (bathhub-website, branch work, d2c8fdc): header, footer, tab icons, home-screen icons (manifest), share image. Build OK. Shots: audit/logo/site_*.png
- App (this repo, branch work): sidebar, login, top bar, POS strip, POS receipt (screen + print), PDF bill, report PDFs, tile catalogue PDF, WhatsApp receipt picture, favicon, app/home icons, /site page + share image, /bathhub.html. SW cache v24. Shots: audit/logo/app_*.png
- Jest: only the old brain.test.js fails; site_v4 test updated to the new share image.
NOT DONE: publishing the website. Real phone/WhatsApp preview check (UNVERIFIED).
Status: NEEDS YOU
Next: Netlify login, then preview-site.cmd, look, then say "publish site".
