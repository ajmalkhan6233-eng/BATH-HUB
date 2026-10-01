# Bath Hub website: how it gets its tiles

`public/bathhub.html` (served at `/bathhub.html`) loads `/bathhub-feed.js` and asks `GET /api/public/catalogue`
for the tiles the shop has published.

- **Nothing published yet:** the page shows its built-in sample tiles and `SAMPLE_MODE` stays `true` (the "sample data" note shows).
- **At least one item published:** the sample tiles are replaced by the real ones and `SAMPLE_MODE` turns itself off.
  If the catalogue can't be reached, the page falls back to the samples.
- If the site is hosted somewhere other than the shop app, set `API_BASE` at the top of the page's script to the app's address.

## How items get on the website
1. Add the item in the item catalog (with a photo).
2. Open **Website Catalogue** (in `/bathco_complete.html`), enter the size (e.g. `60x60`), finish and use.
3. Tick **Show on website**. An item needs a size and a photo before it can be shown.

The feed carries only: name, size (cm and inches), finish, use, photo. Never price, cost, margin, stock or item codes.
The feed has no colour data, so a tile without a usable photo is drawn with a plain colour made from its name.
Finish words are matched to the page's three finishes (nano / glossy / matt, default matt) and use words to
floor / wall / bathroom / kitchen (default floor). Names are escaped before they are drawn.

Sinhala and Tamil text must be checked by a native speaker before launch.
