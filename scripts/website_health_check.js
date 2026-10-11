'use strict';
/**
 * Daily health check of the Royal Bath Hub website (free: plain HTTP, no browser).
 *   node scripts/website_health_check.js            checks the main site and the newest draft, writes AI_BRIDGE/HEALTH.md in the bridge clone,
 *                                                   and sends ONE WhatsApp to the owner only if something is broken.
 * Checks per site: page loads and has the shop title, the site code loads, logo + favicon + share picture load, the WhatsApp button
 * (wa.me link) and the Sinhala / Tamil switch are in the code, the admin login page and its login function answer.
 * A login-protected draft (HTTP 401) is reported as "protected", not as broken.
 */
const MAIN = process.env.RBH_MAIN_URL || 'https://dapper-dieffenbachia-69d038.netlify.app';
const DRAFT = process.env.RBH_DRAFT_URL || '';

async function checkSite(base, fetchFn = fetch) {
  const results = []; const add = (name, ok, note = '') => results.push({ name, ok, note });
  const get = async (path, asText = true) => {
    try { const r = await fetchFn(base + path, { redirect: 'follow' }); return { status: r.status, text: asText ? await r.text() : '' }; }
    catch (e) { return { status: 0, text: '', error: e.message }; }
  };
  const home = await get('/');
  if (home.status === 401 || home.status === 403) return { base, protected: true, ok: true, results: [{ name: 'draft', ok: true, note: 'login-protected, not checked' }] };
  add('page loads', home.status === 200, `HTTP ${home.status}${home.error ? ' ' + home.error : ''}`);
  if (home.status !== 200) return { base, protected: false, ok: false, results };
  add('shop title', /Royal Bath Hub/.test(home.text));
  const script = (home.text.match(/<script[^>]+src="([^"]+\.js)"/) || [])[1];
  const js = script ? await get(script) : { status: 0, text: '' };
  add('site code loads', js.status === 200 && js.text.length > 1000, script || 'no script tag');
  const assets = [...new Set([...home.text.matchAll(/(?:href|content)="((?:https?:\/\/[^"/]+)?\/(?:brand|favicon)[^"]*\.(?:png|webp|jpg|ico|svg))"/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, '')))];
  const bad = [];
  for (const a of assets) { const r = await get(a, false); if (r.status !== 200) bad.push(`${a} (HTTP ${r.status})`); }
  add('logo, favicon and share pictures load', bad.length === 0 && assets.length > 0, bad.length ? bad.join(', ') : `${assets.length} files`);
  add('WhatsApp button in the site', /wa\.me\//.test(js.text));
  add('Sinhala and Tamil switch in the site', /[\u0D80-\u0DFF]/.test(js.text) && /[\u0B80-\u0BFF]/.test(js.text));
  const admin = await get('/admin');
  add('admin login page answers', admin.status === 200, `HTTP ${admin.status}`);
  const fn = await get('/.netlify/functions/login');
  add('admin login function answers', fn.status > 0 && fn.status < 500, `HTTP ${fn.status}`);
  return { base, protected: false, ok: results.every((r) => r.ok), results };
}

function report(sites, when) {
  const lines = [`# Website health check, ${when}`];
  for (const s of sites) {
    lines.push(`## ${s.base}: ${s.protected ? 'PROTECTED (not checked)' : s.ok ? 'ALL OK' : 'PROBLEM'}`);
    if (!s.protected) for (const r of s.results) lines.push(`- ${r.ok ? 'OK ' : 'FAIL'} ${r.name}${r.note ? ' (' + r.note + ')' : ''}`);
  }
  return lines.join('\n');
}
const brokenText = (sites) => 'WEBSITE PROBLEM\n' + sites.filter((s) => !s.ok).map((s) => `${s.base}\n` + s.results.filter((r) => !r.ok).map((r) => `- ${r.name} ${r.note || ''}`).join('\n')).join('\n');

async function main() {
  const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) { /* optional */ }
  const when = new Date(Date.now() + 5.5 * 3600e3).toISOString().replace('T', ' ').slice(0, 16) + ' SL';
  const sites = [await checkSite(MAIN)]; if (DRAFT) sites.push(await checkSite(DRAFT));
  const md = report(sites, when); console.log(md);
  const bridge = process.env.AI_BRIDGE_DIR || 'C:\\Users\\Sony\\workplace\\Universal-project-';
  if (fs.existsSync(path.join(bridge, '.git'))) {
    const git = (...a) => execFileSync('git', ['-C', bridge, ...a], { stdio: 'pipe' }).toString();
    try { git('pull', '--rebase', '-q'); fs.writeFileSync(path.join(bridge, 'AI_BRIDGE', 'HEALTH.md'), md + '\n'); git('add', 'AI_BRIDGE/HEALTH.md'); git('commit', '-q', '-m', 'Website health check ' + when); git('push', '-q'); }
    catch (e) { console.error('[health] could not write to the bridge:', String(e.message).split('\n')[0]); }
  }
  if (sites.some((s) => !s.ok)) {
    const W = require('../layla_owner/waCloud'); const to = String(process.env.OWNER_WA_NUMBER || '').replace(/\D/g, '');
    if (to) await W.sendText(to, brokenText(sites), W.cfgFromEnv(process.env)).catch((e) => console.error('[health] WhatsApp:', e.message));
    else console.error('[health] OWNER_WA_NUMBER not set: no WhatsApp sent');
    process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = { checkSite, report, brokenText };
