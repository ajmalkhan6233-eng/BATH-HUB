// GET /api/modules  -> which modules are on/off and which menu keys to hide.  PUT /api/modules/:key {active} -> admin only.
const express = require('express');
const M = require('../utils/modulesConfig');
const router = express.Router();
const isAdmin = (req) => !!(req.session && req.session.user && req.session.user.role === 'admin');
const view = (cfg) => ({ modules: cfg.modules.map((m) => ({ key: m.key, label: m.label, active: m.active, pages: m.pages })), always: cfg.always, hidden_keys: M.hiddenKeys(cfg) });

router.get('/modules', (req, res) => { try { res.json(view(M.load())); } catch (e) { res.status(500).json({ error: e.message }); } });
router.put('/modules/:key', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Only the admin can switch modules' });
  try { res.json(view(M.setActive(req.params.key, req.body && req.body.active))); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
module.exports = router;
