# Command for Gemini / AI Studio: research and build the Royal Bath Hub website

Paste everything below the line into Google AI Studio (or Gemini). Send back what it makes and Claude will wire it to the shop app and test it. Do not paste passwords, cost prices or customer data into it.

---

You are a senior web designer and front-end developer. First do research, then build.

## The business
Royal Bath Hub, Kandy Road, Thihariya, Sri Lanka. Sells floor and wall tiles, bathtubs, taps, showers and bathroom fittings. The owner is Aj. Customers are home builders, renovators and contractors in the Gampaha / Colombo / Kandy area. Most come from WhatsApp, TikTok and Facebook on a phone. Languages: English, Sinhala (සිංහල), Tamil (தமிழ்). Prices are NOT shown publicly (they change with import costs); customers ask on WhatsApp.

## Step 1: research (write a short report first, max 1 page)
1. Look at 8 to 10 good tile and bathroom showroom websites (Sri Lanka, India, UK, Australia). Note what makes them feel professional: layout, photo style, tile filters, "visualise in my room" tools, WhatsApp buttons, trust signs.
2. What do Sri Lankan customers want to see before they visit a tile shop? (sizes in feet and cm, finish: glossy / matt / nano, use: floor / wall / bathroom, brands or origin, shop location, opening hours, WhatsApp.)
3. Local SEO basics for a shop in Thihariya (Google Business profile, page title, structured data, fast loading on mobile data).
4. Give me a one-line decision for the style: colours, fonts, mood (clean, trustworthy, warm).

## Step 2: build (one folder, plain HTML + CSS + JavaScript, no framework, no build step)
Files: `index.html`, `styles.css`, `app.js`. Must work when opened from any web server and load fast on a phone.

Pages or sections:
- Hero: shop name, one line, big WhatsApp button, "Visit us" map link.
- Tile gallery with filters: size, finish, use (floor / wall / bathroom), search by name. Each tile card: photo, name, size in inches and cm, finish. NO price; button "Ask price on WhatsApp" that opens WhatsApp with the tile name filled in.
- Tile detail view (modal or page): big photo, size, finish, where it suits, tile calculator (room length x width in feet or metres + 10% wastage = boxes, using the box coverage field).
- "Plan your bathroom" section: pick layout, bathtub, tap, shower, tile (a simple illustration is fine).
- Bathtubs, taps, showers and accessories sections.
- About and trust: years in business, delivery area, how it works (ask, quote, order, deliver).
- Contact: address, map link, call and WhatsApp buttons, enquiry form (name, phone, product, message).
- Footer with address and hours.
- Language switch EN / සිංහල / தமிழ் that changes every visible word and remembers the choice.

## Rules you must follow (important)
- Mobile first. Large tap targets. Works on slow connections. Lighthouse performance 90+.
- Accessible: good contrast, alt text, keyboard usable, labels on form fields.
- No prices, costs, margins, supplier names, loans or staff information anywhere. No fake reviews, no fake numbers, no stock photos of other shops' tiles. Use clearly marked placeholder photos.
- Halal and family-friendly wording and images only.
- No tracking scripts, no external fonts that block loading (system fonts or one small Google font is fine).
- All text comes from one `TEXT` object in `app.js` with `en`, `si`, `ta` keys, so it is easy to edit. Write natural Sinhala and Tamil, not machine-sounding.

## The shop app connection (so Claude can wire it)
Keep these three things as clearly marked config at the top of `app.js`:
1. `const API_BASE = ""`, tiles come from `GET {API_BASE}/api/public/catalogue`. It returns `{ sample: boolean, tiles: [ { id, name, w, h, nom, finish, use: [..], photo, ... } ] }` (no prices). If `sample` is true or the call fails, show 8 sample tiles with a small "sample tiles" note.
2. The enquiry form sends `POST {API_BASE}/api/public/enquiry` with JSON `{ name, phone, product, message, company_site }`. `company_site` is a hidden trap field: keep it in the form, hidden from people, always empty. Show the server's `error` text if the reply is not OK. Success is HTTP 201.
3. `const WHATSAPP = "94777999219"` for all WhatsApp links (`https://wa.me/<number>?text=...`).

## Deliver
1. The research report.
2. The three files.
3. A checklist of what I must provide: real tile photos, opening hours, Google Maps link, logo.
