'use strict';
/**
 * Inbound from the free linked-device bridge (whatsapp-bridge.js). The bridge has already checked its own whitelist; here the owner gate
 * runs again (processInbound), so a stranger is never answered. Replies are RETURNED to the bridge, which sends them with msg.reply.
 * Media: the bridge saves the file in its inbox folder and sends the path; only paths inside that folder are read.
 */
const fs = require('fs'); const crypto = require('crypto');
const { processInbound } = require('./inbound');
const { LIMITS } = require('./ownerGate');
const TYPES = ['text', 'audio', 'image', 'document'];
function createBridgeIn({ deps, inboxRoot, safeInboxPath, readFile = fs.promises.readFile, stat = fs.promises.stat }) {
  return async function bridgeIn(body) {
    const b = body || {};
    if (!b.from || !TYPES.includes(b.type)) return { status: 'bad_request', replies: [] };
    const replies = [];
    const m = {
      id: String(b.id || 'br-' + crypto.randomBytes(6).toString('hex')), from: String(b.from), type: b.type, ts: Number(b.ts) || Math.floor(Date.now() / 1000),
      text: b.type === 'text' ? String(b.text || '').slice(0, LIMITS.maxTextChars) : undefined, caption: b.caption ? String(b.caption).slice(0, 500) : undefined, mime: b.mime, mediaId: b.filePath,
    };
    const download = async (filePath) => {
      const safe = safeInboxPath(filePath, inboxRoot); if (!safe) throw new Error('media path not allowed');
      const st = await stat(safe); if (st.size > LIMITS.maxMediaBytes) throw new Error('media too large');
      return { buffer: await readFile(safe), mime: b.mime };
    };
    const r = await processInbound(m, { ...deps(), send: async (_to, text) => { replies.push(String(text)); }, download });
    return { status: r.status, replies };
  };
}
module.exports = { createBridgeIn };
