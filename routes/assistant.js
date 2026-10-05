const express = require('express');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const router = express.Router();
const FILES = ['shop_rules.md', 'accounting.md', 'islamic_ethics.md', 'troubleshooting.md', 'checklists.md'];
const FALLBACK = 'The assistant is taking longer than expected to reply or internet is down. Please try again in a moment.';

// Same rule every other owner-only route here uses (routes/salary.js, enquiries.js, documents.js):
// the logged-in session user must have role 'owner' or 'admin'. No session, or staff = false.
function isOwner(req) {
  const u = req && req.session && req.session.user;
  return !!u && (u.role === 'owner' || u.role === 'admin');
}

function requireOwner(req, res, next) {
  try {
    if (isOwner(req) === true) return next();
  } catch (e) { /* fall through */ }
  return res.status(403).json({ error: 'Owner only.' });
}

function loadKnowledge() {
  return FILES.map(f => {
    const p = path.join(__dirname, '..', 'knowledge', f);
    return fs.existsSync(p) ? `\n--- ${f} ---\n` + fs.readFileSync(p, 'utf8') : '';
  }).join('');
}

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// The page asks this to decide whether to show the button. The server decides, not the browser.
router.get('/whoami', (req, res) => {
  let owner = false;
  try { owner = isOwner(req) === true; } catch (e) { owner = false; }
  res.json({ owner });
});

router.post('/chat', requireOwner, async (req, res) => {
  const message = String((req.body && req.body.message) || '').slice(0, 1000).trim();
  if (!message) return res.status(400).json({ reply: 'Please type a question.' });
  if (!ai) return res.status(500).json({ reply: FALLBACK });

  const system = [
    'You are the Bath Hub assistant for the shop owner.',
    'Reply briefly in plain everyday language. Numbers first, explanation after.',
    'Follow the shop rules below exactly.',
    'If something is missing or marked UNKNOWN, say "I am not sure" and say why. Never guess or invent figures.',
    'The owner dictates by voice, so read garbled words charitably.',
    'KNOWLEDGE:', loadKnowledge()
  ].join('\n');

  try {
    const call = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: { systemInstruction: system }
    });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
    const result = await Promise.race([call, timeout]);
    return res.json({ reply: result.text || 'No reply.' });
  } catch (e) {
    return res.status(504).json({ reply: FALLBACK });
  }
});

module.exports = router;
