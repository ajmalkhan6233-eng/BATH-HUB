'use strict';
// /site on the shop app is an old inside copy of the website. When SITE_REDIRECT=netlify is in .env, /site sends the visitor to the real
// website (PUBLIC_SITE_URL, default the Netlify site) so there is only one website. Off by default: nothing changes until the flag is set.
const DEFAULT_URL = 'https://dapper-dieffenbachia-69d038.netlify.app';

function siteRedirect(env = process.env) {
  return (req, res, next) => {
    if (String(env.SITE_REDIRECT || '').toLowerCase() !== 'netlify') return next();
    const target = String(env.PUBLIC_SITE_URL || DEFAULT_URL);
    if (!/^https:\/\/[\w.-]+(\/.*)?$/.test(target)) return next();      // only a plain https address, never anything else
    return res.redirect(302, target);
  };
}
module.exports = { siteRedirect, DEFAULT_URL };
