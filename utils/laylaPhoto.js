'use strict';
// "Send me a photo of X": Layla finds PUBLISHED catalogue items by name or code and sends their photos (max 3).
// Only items the owner has published to the web catalogue are ever sent. No price, no cost, no stock in the caption.
const fs = require('fs');
const path = require('path');
const PHOTO_DIR = path.join(__dirname, '..', 'uploads', 'item_photos');

const WORDS = /\b(photos?|pictures?|pics?|images?|photo\s?eka|pinthurayak|padam)\b/i;
const NON_LATIN = /ෆොටෝ|පින්තූර|ඡායාරූප|படம்|புகைப்படம்/;
const STOP = new Set('send me a an the of for any pls please can you could show see view photo photos picture pictures pic pics image images eka ekak one this that tile tiles item items to and with have has kindly want need like'.split(' '));

const isPhotoRequest = (t) => WORDS.test(String(t || '')) || NON_LATIN.test(String(t || ''));
const tokensOf = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w)).slice(0, 4);

async function findItems(pool, text) {
  const tk = tokensOf(text);
  if (!tk.length) return [];
  const conds = tk.map((_, i) => `(LOWER(p.name) LIKE $${i + 1} OR LOWER(p.item_code) = $${tk.length + i + 1})`).join(' AND ');
  const args = [...tk.map((w) => `%${w}%`), ...tk];
  try {
    const r = await pool.query(`SELECT p.item_code, p.name, p.photo_url FROM products p JOIN catalogue_web w ON w.item_code = p.item_code AND w.published = TRUE
      WHERE p.active = TRUE AND p.photo_url IS NOT NULL AND ${conds} ORDER BY p.name LIMIT 3`, args);
    return r.rows;
  } catch (_) { return []; }   // catalogue table missing or any error: just carry on with the normal answer
}

function loadMedia(photoUrl, dir = PHOTO_DIR) {
  const base = path.basename(String(photoUrl || ''));
  if (!/^[\w.-]+\.(jpg|png|webp)$/i.test(base)) return null;
  const file = path.join(dir, base);
  if (!fs.existsSync(file)) return null;
  const ext = base.split('.').pop().toLowerCase();
  return { data: fs.readFileSync(file).toString('base64'), mimetype: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg', filename: base };
}

// send(media, caption) -> Promise. Returns { message } to say after the photos, or null when it is not a photo request or nothing matched.
async function handlePhotoRequest({ pool, text, send, dir }) {
  if (!isPhotoRequest(text)) return null;
  const items = await findItems(pool, text);
  const sent = [];
  for (const it of items) {
    const media = loadMedia(it.photo_url, dir);
    if (!media) continue;
    try { await send(media, `${it.name} (${it.item_code})`); sent.push(it.name); } catch (e) { console.error('[LAYLA-PHOTO] send failed:', e.message); }
  }
  if (!sent.length) return null;
  return { message: `Here ${sent.length === 1 ? 'is the photo' : 'are the photos'}. For the price and stock our team will confirm, In sha Allah.`, sent };
}

module.exports = { isPhotoRequest, tokensOf, findItems, loadMedia, handlePhotoRequest };
