'use strict';
// Owner diary route. Mounted at /api/layla-diary in server.js. Owner or admin only. Writes only data/owner-diary (never the shop database).
const express = require('express');
const diary = require('../layla_owner/diary');
module.exports = function createDiaryRouter() {
  const r = express.Router();
  const roleOf = (req) => (req.session && req.session.user && req.session.user.role) || 'staff';
  r.use((req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' })));
  r.use(express.json({ limit: '64kb' }));
  r.post('/send', (req, res) => { try { res.json(diary.handle(req.body && req.body.text)); } catch (e) { console.error('[layla-diary]', e.message); res.status(500).json({ error: 'Something went wrong' }); } });
  return r;
};
