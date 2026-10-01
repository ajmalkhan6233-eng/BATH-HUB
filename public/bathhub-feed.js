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

    // Feed item -> the exact tile shape bathhub.html draws: {id, name, w, h, nom, finish, use[], base, vein, type, photo}.
    // The feed has no colour data, so a calm colour pair is derived from the name (same name = same colour) and
    // the real photo, when there is one, is drawn instead.
    var FINISHES = [['nano', /nano|polish/i], ['glossy', /gloss|shin/i], ['matt', /matt|satin|rough/i]];
    var USES = ['floor', 'wall', 'bathroom', 'kitchen'];
    function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
    function hsl(h, s, l) { return 'hsl(' + (h % 360) + ',' + s + '%,' + l + '%)'; }

    // `t` is a tile as returned by load() / toTile().
    function toPageTile(t, index) {
        var m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(t.sizeCm);
        var w = m ? Number(m[1]) : 60, h = m ? Number(m[2]) : 60;       // unknown size draws as 60 x 60
        var finish = 'matt';
        for (var i = 0; i < FINISHES.length; i++) if (FINISHES[i][1].test(t.finish)) { finish = FINISHES[i][0]; break; }
        var use = USES.filter(function (u) { return t.use.toLowerCase().indexOf(u) !== -1; });
        if (!use.length) use = ['floor'];
        var hv = hash(t.name);
        return {
            id: 'feed' + index, name: t.name, w: w, h: h,
            nom: t.sizeInches ? t.sizeInches.replace('x', ' x ') + ' in' : '',
            finish: finish, use: use,
            base: hsl(hv, 14, 84), vein: hsl(hv, 18, 58), type: 'plain',
            photo: t.photo,
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

    return { load: load, toTile: toTile, toPageTile: toPageTile, ENDPOINT: ENDPOINT };
}));
