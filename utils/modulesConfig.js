'use strict';
// Module on/off switch. Pure file logic, no database. Off = hidden from the menu, nothing deleted.
// Default file: config/modules.json (in git). Changes made on the Inactive modules page go to data/modules.json (not in git).
const fs = require('fs');
const path = require('path');
const DEFAULT = path.join(__dirname, '..', 'config', 'modules.json');
const OVERRIDE = path.join(__dirname, '..', 'data', 'modules.json');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }

function load(defaultPath = DEFAULT, overridePath = OVERRIDE) {
  const base = readJson(defaultPath);
  if (!base || !Array.isArray(base.modules)) throw new Error('modules.json missing or broken');
  const ov = readJson(overridePath);
  if (ov && ov.active && typeof ov.active === 'object') {
    base.modules.forEach((m) => { if (typeof ov.active[m.key] === 'boolean') m.active = ov.active[m.key]; });
  }
  return base;
}

function hiddenKeys(cfg) {
  const always = new Set(cfg.always || []);
  const out = new Set();
  cfg.modules.filter((m) => !m.active).forEach((m) => m.pages.forEach((k) => { if (!always.has(k)) out.add(k); }));
  return [...out].sort();
}

function setActive(key, active, defaultPath = DEFAULT, overridePath = OVERRIDE) {
  const cfg = load(defaultPath, overridePath);
  if (!cfg.modules.some((m) => m.key === key)) { const e = new Error('Unknown module'); e.status = 404; throw e; }
  if (typeof active !== 'boolean') { const e = new Error('active must be true or false'); e.status = 400; throw e; }
  const ov = readJson(overridePath) || { active: {} };
  ov.active = ov.active || {};
  ov.active[key] = active;
  fs.mkdirSync(path.dirname(overridePath), { recursive: true });
  const tmp = overridePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(ov, null, 1));
  fs.renameSync(tmp, overridePath);   // atomic swap, never a half-written file
  return load(defaultPath, overridePath);
}

module.exports = { load, hiddenKeys, setActive, DEFAULT, OVERRIDE };
