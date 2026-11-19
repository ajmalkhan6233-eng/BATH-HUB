'use strict';
// Layla language helper: which language style is the customer writing in, and what to tell the AI about it.
// Uses layla_v2/lang.js (detection) and layla_v2/phrases.js (fixed lines). Pure functions, no network.
// NEEDS REVIEW BY A NATIVE SPEAKER: the fixed Sinhala/Tamil lines in phrases.js were written by an AI.
const { detectLanguage } = require('../layla_v2/lang');
const { render } = require('../layla_v2/phrases');

const NOTE = {
    si: 'LANGUAGE: The customer wrote in Sinhala. Reply in simple, polite Sinhala script. Keep names, sizes, prices and numbers exactly as they are. Never invent facts.',
    ta: 'LANGUAGE: The customer wrote in Tamil. Reply in simple, polite Tamil script. Keep names, sizes, prices and numbers exactly as they are. Never invent facts.',
    singlish: 'LANGUAGE: The customer wrote Sinhala in English letters. Reply the same way, in simple friendly Sinhala written in English letters (Singlish). Never invent facts.',
    tanglish: 'LANGUAGE: The customer wrote Tamil in English letters. Reply the same way, in simple friendly Tamil written in English letters (Tanglish). Never invent facts.',
};

// history: [{role, content}] oldest first. A short message like "ok" keeps the language of the last customer message.
function pickStyle(text, history = []) {
    const lastUser = [...history].reverse().find(m => m && m.role === 'user');
    const prev = lastUser ? detectLanguage(lastUser.content).style : null;
    return detectLanguage(text, prev).style;
}
const langNote = style => NOTE[style] || '';
// The small local model cannot write Sinhala or Tamil script: send those straight to the stronger model.
const needsStrongModel = style => style === 'si' || style === 'ta';
// "Let me check and come back" in the customer's own language, for when every AI fails.
const fallbackLine = style => { try { return render('letcheck', style); } catch (_) { return null; } };

module.exports = { pickStyle, langNote, needsStrongModel, fallbackLine };
