'use strict';
// Loads glossary.json (shop words in every language style).
//   canonicalize(text) : returns the text with every glossary alias/translation replaced by the English key
//                        ("ටයිල්" -> "tile", "விலை" -> "price"), so one set of rules understands all five styles.
//   word(key, style)   : the word to use in a reply for a given language style ('en','si','ta','singlish','tanglish').
const glossary = require('./glossary.json');

const terms = glossary.terms;
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isLatin = s => /^[\x00-\x7f]+$/.test(s);

// longest phrases first so "in stock" wins over "stock"
const entries = [];
for (const [key, t] of Object.entries(terms)) {
    const forms = new Set([t.en, t.si, t.ta, t.singlish, t.tanglish, ...(t.aliases || [])].filter(Boolean).map(x => x.toLowerCase()));
    forms.delete(key);
    for (const f of forms) entries.push({ key, form: f });
}
entries.sort((a, b) => b.form.length - a.form.length);

const latinRe = entries.filter(e => isLatin(e.form)).map(e => e);
const lookup = new Map(entries.map(e => [e.form, e.key]));
// Latin forms need word boundaries; Sinhala/Tamil forms are matched as plain substrings (no \b in those scripts).
const latinPattern = new RegExp('(?<![a-z0-9])(?:' + latinRe.map(e => escapeRe(e.form)).join('|') + ')(?![a-z0-9])', 'gi');
const nativePattern = new RegExp(entries.filter(e => !isLatin(e.form)).map(e => escapeRe(e.form)).join('|'), 'g');

function canonicalize(text) {
    let t = String(text || '');
    t = t.replace(nativePattern, m => ' ' + (lookup.get(m.toLowerCase()) || m) + ' ');
    t = t.replace(latinPattern, m => lookup.get(m.toLowerCase()) || m);
    return t.replace(/\s+/g, ' ').trim();
}

function word(key, style = 'en') {
    const t = terms[key];
    if (!t) return key;
    return t[style] || t.en || key;
}

module.exports = { canonicalize, word, terms };