'use strict';
// Rule-based understanding of a CUSTOMER message (English, Sinhala, Tamil, Singlish, Tanglish). Offline: no AI service.
// classify() returns {intent, ...slots}. The ORDER of the checks matters (safety first):
//   override / private data  -> refused, never answered
//   ai question              -> honest answer
//   human / complaint / refund / money / discount -> handed to a person
//   hours / delivery / warranty -> facts LAYLA does not have -> "let me check" + staff task
//   quotation / tile count, location, product (price, stock, size), greeting, thanks, bye, name
const { canonicalize } = require('./glossary');
const { parseRoomSize } = require('./quote');

const R = (...parts) => new RegExp(parts.join('|'), 'iu');

const OVERRIDE = R(
    String.raw`\b(?:ignore|disregard|forget|override|bypass)\b[^.\n]{0,50}\b(?:rules?|instructions?|prompts?|guidelines?|restrictions?|polic(?:y|ies)|programming|limits?)\b`,
    String.raw`\bsystem\s*prompt\b`, String.raw`\bdeveloper\s*mode\b`, String.raw`\bjailbreak\b`, String.raw`\bdan\s*mode\b`,
    String.raw`\byou\s+are\s+now\b`, String.raw`\bact\s+as\b`, String.raw`\bpretend\s+(?:you|to)\b`,
    String.raw`\b(?:reveal|print|show|repeat|display|dump|tell\s+me)\b[^.\n]{0,30}\b(?:rules|instructions|system\s*prompt|prompt|configuration|database|api\s*key|password)\b`,
    String.raw`\bi\s*(?:am|'m)\s+(?:the\s+)?(?:owner|admin|manager|boss|aj|ajmal|developer|staff)\b`,
    String.raw`\bthis\s+is\s+(?:the\s+)?(?:owner|admin|aj|ajmal)\b`, String.raw`\bsudo\b`, String.raw`\badmin\s+(?:override|access|command|mode)\b`, String.raw`\bnew\s+instructions?\b`,
    'නීති[^.\\n]{0,25}(?:නොසලකා|අමතක|ඉවත)', 'උපදෙස්[^.\\n]{0,25}(?:නොසලකා|අමතක)', 'මම\\s+(?:හිමිකරු|අයිතිකරු|ඕනර්|owner)',
    '(?:விதிகள?|வழிமுறை)[^.\\n]{0,25}(?:புறக்கணி|மறந்து)', 'நான்\\s+(?:உரிமையாளர்|ஓனர்|owner)',
    String.raw`\brules?\s+(?:ignore|wahanna|amathaka|marandhu)\b`, String.raw`\bignore\s+karala\b`, String.raw`\b(?:mama|naan|nan)\s+(?:the\s+)?owner\b`,
);

const PRIVATE = R(
    String.raw`\b(?:profits?|loss(?:es)?|margins?|mark-?ups?|cost\s*price|buying\s*price|purchase\s*price|suppliers?|wholesale\s+price|salary|salaries|wages|payroll|staff\s+pay|loans?|investors?|turnover|revenue|daily\s+sales|total\s+sales|bank\s+balance)\b`,
    String.raw`\bowner'?s?\s+(?:phone|number|address|home)\b`, String.raw`\bother\s+customers?\b`, String.raw`\banother\s+customer\b`, String.raw`\bsomeone\s+else'?s?\b`,
    String.raw`\bwhat\s+did\s+\w+(?:\s+\w+)?\s+(?:buy|purchase|order|pay)\b`,
    String.raw`\b(?:balance|bill|order|purchase|credit|cheques?)\s+of\s+(?:mr|mrs|ms|miss|dr)?\.?\s*\w+`, String.raw`\b\w+'s\s+(?:balance|bill|order|credit|purchase|cheques?)\b`,
    String.raw`\bcheques?\s+(?:due|pending|list|details|schedule)\b`, String.raw`\b(?:show|list|give|send)\s+(?:me\s+)?(?:the\s+)?(?:cheques?|sales|accounts?|expenses|daily\s+report|staff)\b`,
    String.raw`\bhow\s+much\s+(?:do|does|did)\s+you\s+(?:earn|make|pay)\b`, String.raw`\bhow\s+much\s+(?:profit|money)\b`,
    'ලාභ', 'පාඩු', 'වැටුප්', 'පඩි', 'සැපයුම්කරු', 'ගැනුම් මිල', 'ආයෝජක', 'ආදායම', 'අනිත්\\s+ගනුදෙනුකරු', 'වෙන\\s+අයගේ', 'අනෙක්\\s+ගනුදෙනුකරු',
    'லாபம்', 'நஷ்டம்', 'சம்பளம்', 'சப்ளையர்', 'கொள்முதல்\\s+விலை', 'முதலீட்டாளர்', 'வருமானம்', 'மற்ற\\s+வாடிக்கையாளர்',
    String.raw`\blaabaya\b`, String.raw`\blaba(?:ya|yak)?\b`, String.raw`\bpadu\b`, String.raw`\b(?:wetupa|vetupa|wetup)\b`, String.raw`\baadaya(?:ma)?\b`, String.raw`\bayojaka\b`,
    String.raw`\banith\s+customer\w*`, String.raw`\bwena\s+(?:kenage|aya|customer)\b`,
    String.raw`\blaabam\b`, String.raw`\bnashtam\b`, String.raw`\bsambalam\b`, String.raw`\bmuthaleedu\b`, String.raw`\bvarumanam\b`, String.raw`\bvera\s+customer\b`, String.raw`\bmatra\s+customer\b`,
);

const AI_Q = R(
    String.raw`\b(?:are|r)\s+(?:you|u)\s+(?:a\s+|an\s+)?(?:real\s+|actual\s+)?(?:person|human|bot|robot|ai|machine|chat\s*bot|automated|computer|program)\b`,
    String.raw`\bis\s+this\s+(?:a\s+|an\s+)?(?:bot|robot|ai|real\s+person|real\s+human|human|automated|machine|chat\s*bot)\b`,
    String.raw`\b(?:am\s+i|i'?m)\s+(?:talking|speaking|chatting|messaging)\s+(?:to|with)\s+(?:a\s+|an\s+)?(?:real\s+|human|bot|robot|person|machine|computer|ai)`,
    String.raw`\breal\s+(?:person|human)\b`, String.raw`\bchat\s*bot\b`, String.raw`\bwho\s+(?:am\s+i\s+(?:talking|speaking|chatting)|are\s+you|is\s+this)\b`, String.raw`\byour\s+name\b`,
    'රොබෝ', 'බොට්', 'මනුස්සයෙක්ද', 'මනුෂ්‍යයෙක්ද', 'ඇත්තටම\\s+කෙනෙක්ද', 'කවුද\\s+(?:ඔයා|මේ)', 'ඔයාගේ\\s+නම',
    'ரோபோ', 'பாட்', 'மனிதரா', 'மனிதனா', 'உண்மையான\\s+ஆளா', 'நீங்கள்\\s+யார்', 'நீங்க\\s+யார்', 'உங்கள்\\s+பெயர்',
    String.raw`\b(?:robot|bot)\s+(?:da|ah|aa|dha|neda|ekakda)\b`, String.raw`\bmanu[sš]{1,2}ayek\s*(?:da|nemei|newei)?\b`, String.raw`\bkenek\s+(?:da|nemei|newei)\b`, String.raw`\baththatama\s+kenek\b`,
    String.raw`\boya\s+kawuda\b`, String.raw`\bmanusha(?:n|na)?\s+(?:ah|aa|a)\b`, String.raw`\bunmaiyana\s+aal\b`, String.raw`\bneenga\s+yaaru\b`, String.raw`\bunga\s+peyar\b`,
);

const HUMAN_REQ = R(
    String.raw`\b(?:speak|talk|chat)\s+(?:to|with)\s+(?:a\s+|the\s+|some)?(?:person|human|someone|somebody|manager|owner|staff|agent|representative|salesperson|team)\b`,
    String.raw`\bcall\s+me\b`, String.raw`\bcall\s+back\b`, String.raw`\bphone\s+me\b`, String.raw`\bcontact\s+me\b`, String.raw`\bwant\s+(?:a\s+)?(?:call|human|person)\b`, String.raw`\bmanager\b`,
    'කතා\\s*කරන්න', 'අමතන්න', 'ඇමතුමක්',
    'அழைக்க', 'கால்\\s*பண்ண', 'பேச\\s*(?:வேண்டும்|முடியுமா)', 'தொடர்பு\\s*கொள்ளுங்கள்',
    String.raw`\b(?:kenek|manager|owner|aiya)\b[^.\n]{0,15}\b(?:katha\s*karanna|kathakaranna|katha\s*karanawa)\b`, String.raw`\bcall\s*(?:ekak|karanna)\b`, String.raw`\bring\s*ekak\b`,
    String.raw`\b(?:manager|owner|oruthar|aal)\b[^.\n]{0,15}\b(?:pesanum|pesa|pesalam)\b`, String.raw`\bcall\s*(?:pannunga|pannu|pannanum)\b`,
);

const COMPLAINT = R(
    String.raw`\b(?:complain\w*|damaged|broken|cracked|chipped|defective|faulty|wrong\s+(?:item|tile|colou?r|size|delivery|order)|bad\s+quality|poor\s+quality|not\s+(?:happy|satisfied|good)|disappointed|terrible|worst|angry|upset|unacceptable|never\s+arrived|didn'?t\s+(?:arrive|receive|come)|not\s+received|late\s+delivery|rude|cheated|fraud|scam|peeling|hollow|leaking)\b`,
    'කැඩිලා', 'කැඩුණ', 'කැඩී', 'පැමිණිල්ල', 'නරක', 'වැරදි', 'ලැබුණේ\\s+නෑ', 'තෘප්තිමත්\\s+නෑ', 'රවටලා',
    'உடைந்த', 'உடைந்து', 'பழுது', 'புகார்', 'தவறான', 'மோசம்', 'திருப்தி\\s+இல்லை', 'வரவில்லை', 'கிடைக்கவில்லை', 'ஏமாற்ற',
    String.raw`\b(?:kadila|kadunu|kadenawa|kadey)\b`, String.raw`\b(?:waradi|waradda|naraka|narakai)\b`, String.raw`\b(?:labune|labuna)\s+naha\b`, String.raw`\bthrupthi\s+naha\b`,
    String.raw`\b(?:udanjiduchu|udanjathu|udanju|thappa|thappaana|mosam|romba\s+mosam|varala|kedaikala)\b`,
);

const REFUND = R(
    String.raw`\b(?:refund\w*|money\s+back|returns?|returning|exchange|replace(?:ment)?|take\s+(?:it\s+)?back|cancel\w*\s+(?:my\s+)?order|get\s+my\s+money)\b`,
    'මුදල්\\s+ආපසු', 'ආපසු\\s+(?:දෙන්න|ගන්න)', 'මාරු\\s+කරන්න', 'රිෆන්ඩ්',
    'பணம்\\s+திருப்பி', 'திரும்பக்\\s+கொடு', 'ரிஃபண்ட்', 'மாற்றி\\s+(?:தாருங்கள்|கொடுங்கள்)',
    String.raw`\b(?:salli\s+(?:aye|apasu)|apasu\s+(?:ganna|denna)|maru\s+karanna|return\s+karanna)\b`, String.raw`\b(?:panam\s+thirumb\w*|thirumba\s+edungal|return\s+panna)\b`,
);

const MONEY = R(
    String.raw`\b(?:cheques?|checks?|balance|owe\w*|outstanding|instal?lments?|pay(?:ment)?s?\s+(?:due|pending|status|slip|proof|done)|credit|advance|deposit|bank\s+(?:transfer|details|account)|invoice|receipt|bill\s+(?:copy|amount|payment)|paid|unpaid|pending\s+payment|due\s+(?:date|amount))\b`,
    'චෙක්', 'ගෙවීම', 'ගෙවන්න', 'ගෙව්වා', 'ශේෂය', 'ඉතිරි\\s+මුදල', 'ණය', 'අත්තිකාරම', 'බිල්පත', 'රිසිට්', 'වාරික',
    'காசோலை', 'செக்', 'பாக்கி', 'நிலுவை', 'செலுத்த', 'கடன்', 'முன்பணம்', 'ரசீது', 'தவணை',
    String.raw`\b(?:salli\s+gew\w*|gewanna|gewwa|ithuru|aththikaram|bill\s+eka|receipt\s+eka|wargika|rin)\b`, String.raw`\b(?:panam\s+katt\w*|baaki|kadan|thavanai|receipt|bill)\b`,
);

const DISCOUNT = R(
    String.raw`\b(?:discount\w*|reduc\w+|cheaper|lower\s+(?:the\s+)?price|last\s+price|final\s+price|best\s+price|bargain\w*|negotiat\w*|promotion|promo|special\s+price|wholesale|bulk|too\s+(?:expensive|much|high)|expensive)\b`,
    String.raw`\b\d+\s*(?:%|percent)\s*(?:off|discount)?`,
    'වට්ටම', 'අඩු\\s+කරන්න', 'අඩුවෙන්', 'අවසාන\\s+මිල', 'මිල\\s+ඉහළයි', 'ගොඩක්\\s+මිල', 'ඔෆර්',
    'தள்ளுபடி', 'குறைக்க', 'குறைவாக', 'கடைசி\\s+விலை', 'விலை\\s+அதிகம்', 'ஆஃபர்',
    String.raw`\b(?:wattama|wattam|adu\s+karanna|adu\s+karala|aduwata|wadi\s+mila|mila\s+wadi|godak\s+mila)\b`,
    String.raw`\b(?:kuraikka|kuraichu|kuraivaa|jaasthi|romba\s+vilai)\b`,
);

const DELIVERY = R(
    String.raw`\b(?:deliver\w*|shipping|transport|courier|dispatch|how\s+long\s+(?:will|does|to)|arrive|home\s+delivery)\b`,
    'ඩිලිවරි', 'බෙදාහැරීම', 'ගෙදරටම', 'ගෙනත්\\s+දෙන',
    'டெலிவரி', 'வினியோகம்', 'கொண்டு\\s+வர', 'அனுப்ப\\s+முடியுமா',
    String.raw`\b(?:gedarata\s+ewanna|genath\s+(?:denawada|denna)|ewanna\s+puluwan\w*)\b`, String.raw`\b(?:veetukku\s+anuppa|kondu\s+vara|anuppa\s+mudiyuma)\b`,
);

const HOURS = R(
    String.raw`\b(?:open(?:ing)?|clos(?:e|ing)|hours?|timings?|working\s+hours|business\s+hours|sundays?|saturdays?|poya|holidays?|weekends?)\b`,
    'ඇරලා', 'ඇරෙන', 'වහන', 'වැහෙන', 'කීයටද', 'වේලාව', 'වෙලාව', 'විවෘත', 'සති\\s+අන්ත', 'පොහොය',
    'திறக்க', 'திறந்', 'மூட', 'நேரம்', 'ஞாயிறு', 'விடுமுறை',
    String.raw`\b(?:arinne|arala|wahanne|wahanawa|kiyatada|welawa|welawe|poya|sathiyen)\b`, String.raw`\b(?:eppo\s+thirakkum|thirakkum|moodum|neram|timing)\b`,
);

const WARRANTY = R(
    String.raw`\b(?:warrant\w*|guarantee\w*|after\s+sales?|installation|install\w*|fitting|tilers?|labou?r)\b`,
    'වගකීම', 'වරෙන්ටි', 'ඉන්ස්ටෝල්', 'ඇතිරීම', 'ටයිල්\\s+ගහන්න', 'කම්කරු',
    'உத்தரவாதம்', 'வாரண்டி', 'பொருத்த', 'நிறுவ', 'பதிக்க',
    String.raw`\b(?:gahanna|gahala\s+denawada|install\s+karanna)\b`, String.raw`\b(?:poduvingala|install\s+panna)\b`,
);

const QUOTE = R(
    String.raw`\b(?:quotation|quote|quotes|estimate|how\s+many|quantity|number\s+of\s+(?:tiles|boxes)|tiles?\s+(?:needed|required|do\s+i\s+need)|calculate|calculation)\b`,
    'කොටේෂන්', 'ඇස්තමේන්තු', 'කීයක්\\s+(?:ඕන|අවශ්‍ය)', 'ගණන',
    'விலைப்புள்ளி', 'எத்தனை', 'எண்ணிக்கை', 'கணக்கு',
    String.raw`\b(?:kiyak\s+(?:ona|one|wenne)|kiyak\b|ganan|ganana)\b`, String.raw`\b(?:evlo\s+venum|ethana|ethanai|kanakku|ennikkai)\b`,
);

const LOCATION = R(
    String.raw`\b(?:where|location|address|showroom|directions?|map|how\s+to\s+(?:come|reach|get)|find\s+you|branch)\b`,
    'කොහෙද', 'කොහේද', 'ලිපිනය', 'ෂෝරූම්', 'ස්ථානය', 'එන්නේ\\s+කොහොමද',
    'எங்கே', 'முகவரி', 'ஷோரூம்', 'எங்க\\b',
    String.raw`\b(?:koheda|kohe|lipinaya|enna\s+kohomada|enne\s+kohomada)\b`, String.raw`\b(?:enga|engey|eppadi\s+varanum)\b`,
);

const GREETING = R(
    String.raw`^\s*(?:hi+|hello+|hey+|hai|hallo|helo|good\s+(?:morning|afternoon|evening|day)|ayubowan|vanakkam|kohomada|suba\s+(?:udasanak|sandyawak|dawasak))\b`,
    '^\\s*(?:ආයුබෝවන්|හලෝ|හෙලෝ|සුභ\\s+(?:උදෑසනක්|සන්ධ්‍යාවක්|දවසක්))',
    '^\\s*(?:வணக்கம்|ஹலோ|ஹாய்)',
);
const THANKS = R(String.raw`\b(?:thanks?|thank\s*you|thx|tnx|appreciate)\b`, 'ස්තූතිය', 'ස්තුති', 'நன்றி', String.raw`\b(?:sthuthi\w*|istuti|stuti|bohoma\s+sthuthi|nandri|nanri)\b`);
const BYE = R(String.raw`\b(?:bye|goodbye|good\s*night|see\s+you|that'?s\s+all|nothing\s+else)\b`, 'බායි', 'ගිහින්\\s+එන්නම්', 'போய்\\s+வருகிறேன்', 'பை\\b', String.raw`\b(?:giyoth\s+enawa|poitu\s+varen)\b`);
const AFFIRM = R('^\\s*(?:yes|yeah|yep|yup|ok(?:ay)?|sure|please|go\\s+ahead|do\\s+it|fine|alright|ow|oww|hari|harii|ho|ඔව්|හරි|ඕනේ|ஆம்|ஆமா|சரி|aam|aama|seri|sari|venum|ona|one)\\b');
const NEGATIVE = R('^\\s*(?:no|nope|nah|not\\s+now|no\\s+thanks|later|naha|nehe|epa|එපා|නෑ|නැහැ|இல்லை|வேண்டாம்|vendam|venam)\\b');

const NOT_NAMES = new Set('looking interested planning building renovating from a the an trying going wondering asking not just in at using having also calling writing here new very so sorry fine good ok okay want need ready sure still really'.split(' '));
function parseName(text) {
    const t = String(text || '').trim();
    let m = t.match(/\b(?:my\s+name\s+is|my\s+name'?s|name\s+is|i\s*am|i'm|this\s+is|it'?s)\s+([A-Za-z]{2,20})\b/i)
        || t.match(/\b(?:mage\s+nama|nama|ennoda\s+peyar|en\s+peyar|my\s+name)\s+([A-Za-z]{2,20})\b/i)
        || t.match(/(?:මගේ\s+නම|මගේ\s+නම\s+වෙන්නේ)\s+([\u0D80-\u0DFF]{2,20})/)
        || t.match(/(?:என்\s+பெயர்|என் பெயர்)\s+([\u0B80-\u0BFF]{2,20})/);
    if (!m) return null;
    const n = m[1];
    if (NOT_NAMES.has(n.toLowerCase())) return null;
    return n.charAt(0).toUpperCase() + n.slice(1);
}

// "Silly" names from a WhatsApp profile (emoji, digits, long text, shop names) are not used to greet people.
function cleanProfileName(name) {
    const n = String(name || '').trim();
    if (!n || n.length > 25 || /[\d@#_/\\]/.test(n) || /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(n)) return null;
    const first = n.split(/\s+/)[0];
    return /^[A-Za-z\u0D80-\u0DFF\u0B80-\u0BFF.'-]{2,20}$/.test(first) ? first : null;
}

function parsePct(text) {
    const m = String(text || '').match(/(\d{1,3}(?:\.\d+)?)\s*(?:%|percent|ප්‍රතිශත|சதவீத|persent)/i);
    return m ? Math.min(100, Number(m[1])) : null;
}

const PRODUCT_WORDS = /\b(tile|price|stock|size|box|piece|floor|wall|basin|tap|commode|shower|bathroom|kitchen|matt|glossy|inch|sqft|feet)\b/;
const isAffirm = t => AFFIRM.test(t) && t.trim().split(/\s+/).length <= 4;
const isNegative = t => NEGATIVE.test(t) && t.trim().split(/\s+/).length <= 4;

/**
 * @param {string} text  the customer's message
 * @param {{pending?: string}} ctx  what LAYLA last asked (e.g. 'quote_offer', 'human_offer')
 */
function classify(text, ctx = {}) {
    const raw = String(text || '').trim();
    const low = raw.toLowerCase();
    const canon = canonicalize(raw).toLowerCase();
    const both = re => re.test(low) || re.test(canon);

    if (!raw) return { intent: 'empty' };
    if (both(OVERRIDE)) return { intent: 'override' };
    if (both(PRIVATE)) return { intent: 'private' };
    if (both(AI_Q)) return { intent: 'ai_question' };

    // Answers to what LAYLA just offered
    if (ctx.pending && isAffirm(low)) return { intent: 'affirm', pending: ctx.pending };
    if (ctx.pending && isNegative(low)) return { intent: 'negative', pending: ctx.pending };

    if (both(COMPLAINT)) return { intent: 'complaint' };
    if (both(REFUND)) return { intent: 'refund' };
    if (both(HUMAN_REQ)) return { intent: 'human' };
    if (both(MONEY)) return { intent: 'money' };
    if (both(DISCOUNT)) return { intent: 'discount', pct: parsePct(raw) };

    if (both(DELIVERY)) return { intent: 'unknown_fact', topic: 'delivery' };
    if (both(WARRANTY)) return { intent: 'unknown_fact', topic: 'warranty' };
    if (both(HOURS)) return { intent: 'unknown_fact', topic: 'opening hours' };

    const room = parseRoomSize(raw);
    if (both(QUOTE) || (room && PRODUCT_WORDS.test(canon))) {
        const wantsQuote = /\b(quotation|quote|quotes|estimate)\b/.test(canon) || /කොටේෂන්|ඇස්තමේන්තු|விலைப்புள்ளி/.test(raw);
        return { intent: 'quote', room, wantsQuote };
    }
    if (both(LOCATION)) return { intent: 'location' };

    const asksPrice = /\bprice\b/.test(canon), asksStock = /\bstock\b/.test(canon), asksSize = /\bsize\b/.test(canon) && !/\d\s*[x×*]\s*\d/.test(canon);
    if (PRODUCT_WORDS.test(canon) || /\d\s*[x×*]\s*\d/.test(low)) return { intent: 'product', asksPrice, asksStock, asksSize };

    const name = parseName(raw);
    if (name) return { intent: 'name', name };
    if (both(THANKS)) return { intent: 'thanks' };
    if (both(BYE)) return { intent: 'bye' };
    if (both(GREETING) && raw.split(/\s+/).length <= 6) return { intent: 'greeting' };
    return { intent: 'other' };   // the engine tries the catalogue, then "let me check"
}

module.exports = { classify, parseName, cleanProfileName, parsePct, isAffirm, isNegative };