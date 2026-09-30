/* public/bathhub-feed.js
 * Loads the public tile catalogue for bathhub.html from GET /api/public/catalogue (M5).
 *
 * The feed carries ONLY: name, size_cm, size_inches, finish, use, photo. No prices, cost or stock.
 * SAMPLE MODE: until the shop has published at least one real item, the page keeps its built-in
 * sample tiles and `sample` stays true. As soon as the feed returns real items, `sample` becomes
 * false by itself, so nobody has to edit SAMPLE_MODE by hand (and sample tiles never show beside real ones).
 *
 * Use in bathhub.html:
 *   <script src="/bathhub-feed.js"></script>
 *   const r = await BathHubFeed.load({ sampleTiles: tiles });   // `tiles` = the existing sample array
 *   tiles = r.tiles;  SAMPLE_MODE = r.sample;  render();
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.BathHubFeed = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var ENDPOINT = '/api/public/catalogue';

    // Feed item -> the tile the page draws. Extra alias keys let the page's existing templates keep working.
    function toTile(item, apiBase) {
        var photo = item.photo ? String(apiBase || '') + item.photo : '';
        var size = item.size_cm
            ? item.size_cm.replace('x', ' x ') + ' cm' + (item.size_inches ? ' (' + item.size_inches.replace('x', ' x ') + ' in)' : '')
            : '';
        return {
            name: item.name || '',
            size: size,
            sizeCm: item.size_cm || '',
            sizeInches: item.size_inches || '',
            finish: item.finish || '',
            use: item.use || '',
            photo: photo,
            image: photo,
            sample: false,
        };
    }

    function isItem(x) {
        return x && typeof x === 'object' && typeof x.name === 'string' && x.name.trim() !== '';
    }

    /**
     * @param {object} opts
     *   sampleTiles : tiles to show while there is no real data (required)
     *   apiBase     : prefix for the API and photo URLs when the site is hosted away from the app (default '')
     *   fetchImpl   : fetch function (default window.fetch), for tests
     * @returns {Promise<{tiles: object[], sample: boolean, error?: string}>}  never rejects
     */
    function load(opts) {
        opts = opts || {};
        var sampleTiles = Array.isArray(opts.sampleTiles) ? opts.sampleTiles : [];
        var apiBase = opts.apiBase || '';
        var f = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
        var fallback = function (error) { return { tiles: sampleTiles, sample: true, error: error }; };
        if (!f) return Promise.resolve(fallback('fetch is not available'));
        return Promise.resolve()
            .then(function () { return f(apiBase + ENDPOINT, { headers: { Accept: 'application/json' } }); })
            .then(function (res) {
                if (!res || !res.ok) throw new Error('catalogue answered ' + (res && res.status));
                return res.json();
            })
            .then(function (body) {
                var items = body && Array.isArray(body.items) ? body.items.filter(isItem) : [];
                if (!items.length) return { tiles: sampleTiles, sample: true };      // nothing published yet
                return { tiles: items.map(function (i) { return toTile(i, apiBase); }), sample: false };
            })
            .catch(function (e) { return fallback(e && e.message ? e.message : String(e)); });
    }

    return { load: load, toTile: toTile, ENDPOINT: ENDPOINT };
}));
