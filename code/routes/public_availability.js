// routes/public_availability.js
// WEBSITE AVAILABILITY FEED: tells the public website which published items are in stock, so the site
// changes by itself when stock changes in the shop app.
//
// PRIVACY: returns only { code, available, photo } (true/false and the public photo path). Never a stock number, price, cost or supplier.
// Only items the owner has published on the website (catalogue_web.published) are listed.
//   GET /public/availability   no login (added to the auth bypass list in server.js)

const express = require('express');

function createRouter(pool) {
    const router = express.Router();
    router.get('/public/availability', async (_req, res) => {
        res.set('Access-Control-Allow-Origin', '*');   // read-only, booleans only
        res.set('Cache-Control', 'public, max-age=60');
        try {
            const r = await pool.query(
                `SELECT p.item_code, p.photo_url, (COALESCE(p.stock_level, 0) > 0) AS available
                 FROM catalogue_web w JOIN products p ON p.item_code = w.item_code
                 WHERE w.published = TRUE AND p.active = TRUE AND p.item_code IS NOT NULL
                 ORDER BY p.item_code`);
            res.json({ updated: new Date().toISOString(), items: r.rows.map(x => ({ code: String(x.item_code), available: x.available === true, photo: x.photo_url || null })) });
        } catch (e) {
            res.json({ updated: new Date().toISOString(), items: [] });   // table not ready yet: the website keeps its own list
        }
    });
    return router;
}

let _router;
module.exports = function (req, res, next) {
    if (!_router) _router = createRouter(require('../utils/pool'));
    _router(req, res, next);
};
module.exports.createRouter = createRouter;
