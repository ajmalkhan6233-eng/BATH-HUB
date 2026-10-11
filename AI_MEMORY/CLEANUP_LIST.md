# CLEANUP_LIST (2026-10-10, queue 3 part 2). Checked with git grep over code, tests, service worker, manifest.
KEEP: bathco_complete.html (= /owner, the ONE app login), bathhub.html (/ front door), website/ (/site), every screen the owner app or service worker lists, daily-entry-v2.html, lib/, fonts/, tiles/, vendor/, icons/.
KEEP: public/_archive/xlsx.full.min.js (daily-entry-v2.html and a reference page use xlsx).
REMOVE (git rm, history keeps them). All unlinked: no route, no test, no service-worker entry:
- public/_archive/BATHCO_NATURE.html : old owner app. server.js already redirects /BATHCO_NATURE.html, /dashboard.html, /nature -> /owner. Only a code comment names it.
- public/_archive/nature-manifest.json : manifest of that old app. Only the old app uses it.
- public/_archive/themes/* (7 files) : animated backgrounds of the old app. Only the old app uses them.
- public/brand/old-logo/favicon-32.png : the replaced favicon. Nothing links it.
- public/brand/logo-bh-on-navy.png, logo-profile-picture-navy.png : old navy logos. Nothing links them (navy is not in Design 2).
- public/brand/receipt-sample.png : sample picture. Nothing links it.
NOT TOUCHED: public/brand/favicon-16/64/512.png, logo-bh-transparent.png, logo-tile-1024.png (nothing links them, but they may belong to the new RBH logo pack: Aj decides).
LOGINS: only ONE login exists (the sign-in screen inside /owner). No other page has its own login form. The only old login page was BATHCO_NATURE.html, which already redirects to /owner. Nothing more to redirect.
WEBSITE copies: the Netlify site dapper-dieffenbachia-69d038 is the only website. public/website/ is the /site page inside the shop app (kept).
NETLIFY deploys (LIST ONLY, never deleted): 6ac36cf6 production (LIVE, published 2026-10-05); drafts 6ac984b8, 6ac9516d, 6ac90e28 (ready), 6ac90e1a (error, empty). Drafts need your Netlify login to open.
Service worker: none of the removed files are in its list, so no cache version bump is needed.
PC ITEMS (queue 4): RECYCLED (Recycle Bin, restorable): Downloads\RBH-logo-pack_1.zip, _2.zip, _3.zip (byte-identical to RBH-logo-pack.zip, kept).
ASK AJMAL (not touched): E:\AI Sttuf\bathhub-website-export (old site export), bathhub-build-pack, harvest-bundle, design-from-aistudio, tile-photos, New folder, instructions, the .rar files, Downloads\bath-hub---*.zip, Desktop\bathhub-site.zip.
PORTS: 3100 = live shop (not touched). 3299 + 5434 + 4180 = my dev app, test database and website preview (stopped at the end of this queue). 3200/8888 were not listening.
