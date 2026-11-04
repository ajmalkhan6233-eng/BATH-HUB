'use strict';
/**
 * Send a file over WhatsApp Web, image first, document second.
 * Why: whatsapp-web.js ^1.34.7 can throw "Data passed to getter must include an id property" when it sends an
 * image with a caption. The same file sent as a document goes through, so on that kind of failure we retry once
 * as a document. Plain text is not touched. Own file, no network, tested alone (tests/unit/wa_media_send.test.js).
 */
function isMediaGetterError(err) {
  const m = String((err && err.message) || err || '');
  return /getter must include an id|must include an id property|evaluation failed/i.test(m);
}

/**
 * @param send         async (file, options) => ...  the caller's own send (the bridge's reviewed sender); this file never sends by itself
 * @param MessageMedia the MessageMedia class
 * @param media        { mimetype, data (base64), filename? }
 * @param caption      optional text ('' for none)
 * @returns {{sentAs: 'image'|'document'|'file'}}
 */
async function sendMediaWithFallback(send, MessageMedia, media, caption) {
  const file = new MessageMedia(media.mimetype, media.data, media.filename || undefined);
  const isImage = String(media.mimetype || '').startsWith('image/');
  const opts = caption ? { caption } : {};
  try {
    await send(file, opts);
    return { sentAs: isImage ? 'image' : 'file' };
  } catch (first) {
    if (!isMediaGetterError(first)) throw first;
    try {
      await send(file, Object.assign({}, opts, { sendMediaAsDocument: true }));
      return { sentAs: 'document' };
    } catch (second) {
      const e = new Error(`media send failed as image (${first.message}) and as document (${second.message})`);
      e.first = first; e.second = second;
      throw e;
    }
  }
}

module.exports = { sendMediaWithFallback, isMediaGetterError };
