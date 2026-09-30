# Bath Hub website: connecting it to the catalogue

`bathhub.html` was not on the machine this was built on, so it is **not** in the repo yet. The feed is
ready for it. To connect it:

1. Put `bathhub.html` in `public/` (served at `/bathhub.html`).
2. In it, add before your own script: `<script src="/bathhub-feed.js"></script>`
3. Where the page builds its sample `tiles` array and sets `SAMPLE_MODE = true`, keep both as they are, then add:

```js
BathHubFeed.load({ sampleTiles: tiles }).then(function (r) {
  tiles = r.tiles;            // real items when published, otherwise the sample tiles
  SAMPLE_MODE = r.sample;     // stays true until at least one real item is published
  render();                   // whatever redraws the page
});
```

If the site is hosted somewhere other than the shop app, pass `apiBase: 'https://your-app-address'`.

## How items get on the website

1. Add the item in the item catalog (with a photo).
2. Open **Website Catalogue** (in `/bathco_complete.html`), enter the size (e.g. `60x60`), finish and use.
3. Tick **Show on website**. An item needs a size and a photo before it can be shown.

The public feed (`/api/public/catalogue`) carries only: name, size (cm and inches), finish, use, photo.
It never carries price, cost, margin, stock or item codes. `SAMPLE_MODE` flips to false on its own once the
first real item is shown; until then visitors see the sample tiles.

Sinhala and Tamil text must be checked by a native speaker before launch.
