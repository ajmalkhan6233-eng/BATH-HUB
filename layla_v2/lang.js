'use strict';
// Language style detection for WhatsApp messages: 'en', 'si' (Sinhala script), 'ta' (Tamil script),
// 'singlish' (Sinhala in English letters), 'tanglish' (Tamil in English letters).
// Offline and rule based: Unicode ranges for the two scripts, word lists for the romanised styles.

const SINHALA_RE = /[\u0D80-\u0DFF]/g;
const TAMIL_RE = /[\u0B80-\u0BFF]/g;

// Words that are clearly Sinhala / Tamil when typed in English letters. 'strong' words count 2, 'weak' words 1 (they can be English too).
const SINGLISH_STRONG = new Set(('mokakda mokada mokakda kiyada kiyanawada kiyala thiyenawada thiyenawa tiyenawada tiyenawa tibenawada thibenawada thibenawa ' +
    'ganna gannada gannawa ekak ekata ekai eke eken mage mata oyage oyata oyala mama api eyala denna dennako dennada karanna karannada puluwan puluwanda ' +
    'balanna kohomada kohomada koheda kohe naha nehe nathuwa nathi nane ow hari harida mehema gedara gedarata eka ' +
    'aiyo ayyo ayye aiya ayya akke nangi malli bohoma godak poddak ikmanata ikmanin passe heta ada iye mila salli ' +
    'ewanna yawanna ahanna danna dannawada hodai hondai lassana wenawa wenne kiyanna kiyannako ganan ganak pitiya passa ' +
    'oni onada onamada ona dewal kamaraya kamarayata uyanna watinawa wattama').split(/\s+/).filter(Boolean));
const SINGLISH_WEAK = new Set('wage nam neda ne gana thawa thawath nisa wath dan eh ehema mehe meka eka'.split(' '));

const TANGLISH_STRONG = new Set(('enna ennada ennanga evlo evvalavu evalo evlo vilai vela irukka irukkaa iruka irukku iruku irukkuma irukkum venum vendum venumnu ' +
    'unga ungal ungalukku ungaluku enakku enaku eppadi epdi enga engey ennoda sollunga solluga solren sollu panna pannunga pannanum kudunga tharuveenga tarunga ' +
    'illai illa illaiya vanakkam nandri nanri paaka pakkanum paarkka paakkalaam podunga mudiyuma mudiyum romba rombha seri aana aanaa ippo ippa apdi ' +
    'ithu idhu athu adhu naan nan neenga nenga theriyuma theriyala kedaikuma kedaikkuma kidaikuma anuppunga anuppu aprm apram inga anga ponga vaanga vanga').split(/\s+/).filter(Boolean));
const TANGLISH_WEAK = new Set('sari ok da pa na anna akka thambi machan'.split(' '));

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;

const tokens = text => String(text || '').toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);

function detectLanguage(text, previous = null) {
    const s = String(text || '');
    const si = (s.match(SINHALA_RE) || []).length;
    const ta = (s.match(TAMIL_RE) || []).length;
    if (si || ta) {
        const style = si >= ta ? 'si' : 'ta';
        return { style, confidence: 1, script: style };
    }
    const toks = tokens(s);
    let sg = 0, tg = 0;
    for (const w of toks) {
        if (SINGLISH_STRONG.has(w)) sg += 2; else if (SINGLISH_WEAK.has(w)) sg += 1;
        if (TANGLISH_STRONG.has(w)) tg += 2; else if (TANGLISH_WEAK.has(w)) tg += 1;
    }
    if (sg >= 2 && sg > tg) return { style: 'singlish', confidence: Math.min(1, sg / 4), script: 'latin' };
    if (tg >= 2 && tg > sg) return { style: 'tanglish', confidence: Math.min(1, tg / 4), script: 'latin' };
    // Too little to tell (e.g. "ok", "hi", "tile price"): English, but a caller may prefer the previous style.
    const follow = previous && toks.length <= 2;
    return { style: follow ? previous : 'en', confidence: follow ? 0.4 : 0.6, script: 'latin' };
}

const usesEmoji = text => EMOJI_RE.test(String(text || ''));

module.exports = { detectLanguage, usesEmoji };