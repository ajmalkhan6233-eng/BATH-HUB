'use strict';
// Everything LAYLA says to a CUSTOMER, in the five language styles: en, si (Sinhala script), ta (Tamil script),
// singlish (Sinhala in English letters), tanglish (Tamil in English letters).
// Short, warm, plain words, polite Sri Lankan business tone. No lists, no "As an AI", no invented facts:
// facts (names, prices, sizes, address, numbers) are passed in as parameters from the database.
//
// NEEDS REVIEW BY NATIVE SPEAKERS: the Sinhala, Tamil, Singlish and Tanglish lines were written by an AI and
// have not been read by a native speaker. Edit this file freely; every key has the same five styles.
//
// Each phrase is a list of variants; a variant is a function of the parameters p. render() picks one at random
// (rng is injectable) and avoids a variant that was used recently, so replies do not repeat word for word.

const c = n => (n ? ', ' + n : '');          // ", Nimal"
const s = n => (n ? ' ' + n : '');           // " Nimal"

const P = {
    greet: {
        en: [p => `Hello${c(p.n)}! Welcome to Royal Bath Hub. What can I help you with today?`, p => `Hi${c(p.n)}, thanks for messaging Royal Bath Hub. What are you looking for?`, p => `Good day${c(p.n)}! How can I help you?`],
        si: [p => `ආයුබෝවන්${s(p.n)}! Royal Bath Hub වෙත සාදරයෙන් පිළිගන්නවා. මම ඔබට උදව් කරන්නේ කොහොමද?`, p => `ආයුබෝවන්${s(p.n)}! ඔබට අවශ්‍ය මොනවාද කියලා කියන්න, මම බලලා කියන්නම්.`],
        ta: [p => `வணக்கம்${s(p.n)}! Royal Bath Hub-க்கு வரவேற்கிறோம். உங்களுக்கு என்ன உதவி வேண்டும்?`, p => `வணக்கம்${s(p.n)}! என்ன டைல் தேடுகிறீர்கள் என்று சொல்லுங்கள், நான் பார்த்துச் சொல்கிறேன்.`],
        singlish: [p => `Hello${c(p.n)}! Royal Bath Hub ekata welcome. Mata oyata kohomada udaw karanna puluwan?`, p => `Ayubowan${c(p.n)}! Mokakda balanna one?`],
        tanglish: [p => `Vanakkam${c(p.n)}! Royal Bath Hub-ku welcome. Ungalukku enna help venum?`, p => `Vanakkam${c(p.n)}! Enna tile paakkureenga, sollunga.`],
    },
    ask_product: {
        en: [() => 'Which tile or item are you looking at? A name or a size, like 24 x 24, helps me find it.', () => 'Sure. Can you tell me the tile name or the size you have in mind?'],
        si: [() => 'ඔබ බලන්නේ මොන ටයිල් එකද? නමක් හෝ 24 x 24 වගේ ප්‍රමාණයක් කිව්වොත් මට හොයන්න පුළුවන්.', () => 'කමක් නෑ. ටයිල් එකේ නම හරි ප්‍රමාණය හරි කියන්න පුළුවන්ද?'],
        ta: [() => 'எந்த டைல் அல்லது பொருளைப் பார்க்கிறீர்கள்? பெயர் அல்லது 24 x 24 போன்ற அளவைச் சொன்னால் நான் தேடிப் பார்ப்பேன்.', () => 'சரி. டைலின் பெயர் அல்லது அளவைச் சொல்ல முடியுமா?'],
        singlish: [() => 'Mona tile ekakda balanne? Nama hari 24 x 24 wage size ekak hari kiwwoth mata hoyanna puluwan.', () => 'Hari. Tile eke nama hari size eka hari kiyanna puluwanda?'],
        tanglish: [() => 'Entha tile paakkureenga? Peyar illa 24 x 24 maadhiri size sonnaa naan thedi paarkkuren.', () => 'Sari. Tile peyar illa size sollunga.'],
    },
    item_price: {
        en: [p => `${p.name} is listed at ${p.price}.`, p => `The price for ${p.name} on our list is ${p.price}.`],
        si: [p => `${p.name} සඳහා අපේ ලැයිස්තුවේ මිල ${p.price}.`, p => `${p.name} එකේ මිල ${p.price} කියලා ලැයිස්තුවේ තියෙනවා.`],
        ta: [p => `${p.name}-க்கு எங்கள் பட்டியலில் உள்ள விலை ${p.price}.`, p => `${p.name} விலை ${p.price} என்று பட்டியலில் உள்ளது.`],
        singlish: [p => `${p.name} eke mila list eke thiyenne ${p.price}.`, p => `${p.name} ekata apey list eke mila ${p.price}.`],
        tanglish: [p => `${p.name} vilai list-la ${p.price}.`, p => `${p.name}-ku engaloda list-la vilai ${p.price}.`],
    },
    item_noprice: {
        en: [p => `I don't have a price for ${p.name} on my list yet. Let me check and come back to you.`],
        si: [p => `${p.name} එකේ මිල මගේ ලැයිස්තුවේ තවම නෑ. මම බලලා ඔබට දැනුම් දෙන්නම්.`],
        ta: [p => `${p.name}-க்கு விலை என் பட்டியலில் இன்னும் இல்லை. நான் பார்த்துவிட்டு உங்களுக்குச் சொல்கிறேன்.`],
        singlish: [p => `${p.name} eke mila mage list eke thama naha. Mama balala oyata kiyannam.`],
        tanglish: [p => `${p.name} vilai en list-la innum illa. Naan paathutu ungalukku solren.`],
    },
    item_found: {
        en: [p => `We have ${p.name}.`, p => `Yes, I found ${p.name}.`],
        si: [p => `අපිට ${p.name} තියෙනවා.`, p => `ඔව්, ${p.name} මට හම්බවුණා.`],
        ta: [p => `எங்களிடம் ${p.name} உள்ளது.`, p => `ஆம், ${p.name} கிடைத்தது.`],
        singlish: [p => `Apita ${p.name} thiyenawa.`, p => `Ow, ${p.name} mata hambawuna.`],
        tanglish: [p => `Engakitta ${p.name} irukku.`, p => `Aama, ${p.name} kedachathu.`],
    },
    stock_in: {
        en: [() => 'Yes, we have it in stock.', () => 'Yes, that one is available.'],
        si: [() => 'ඔව්, ඒක තොගයේ තියෙනවා.', () => 'ඔව්, ඒක දැන් තියෙනවා.'],
        ta: [() => 'ஆம், அது கையிருப்பில் உள்ளது.', () => 'ஆம், அது இப்போது கிடைக்கும்.'],
        singlish: [() => 'Ow, eka stock eke thiyenawa.', () => 'Ow, eka dan thiyenawa.'],
        tanglish: [() => 'Aama, adhu stock-la irukku.', () => 'Aama, adhu ippo irukku.'],
    },
    stock_out: {
        en: [() => 'That one is out of stock at the moment. Let me check when it will be back and let you know.'],
        si: [() => 'ඒක දැන් තොගයේ නෑ. ආයෙත් එන්නේ කවදාද කියලා බලලා මම දැනුම් දෙන්නම්.'],
        ta: [() => 'அது இப்போது கையிருப்பில் இல்லை. எப்போது வரும் என்று பார்த்துச் சொல்கிறேன்.'],
        singlish: [() => 'Eka dan stock eke naha. Aye enne kawadada kiyala balala mama kiyannam.'],
        tanglish: [() => 'Adhu ippo stock-la illa. Eppo varum nu paathutu solren.'],
    },
    stock_unknown: {
        en: [() => 'Let me check the stock and come back to you.'],
        si: [() => 'තොගය බලලා මම ආපහු කියන්නම්.'],
        ta: [() => 'கையிருப்பைப் பார்த்துவிட்டு திரும்பச் சொல்கிறேன்.'],
        singlish: [() => 'Stock eka balala mama aye kiyannam.'],
        tanglish: [() => 'Stock paathutu naan thirumba solren.'],
    },
    size_line: {
        en: [p => `${p.name} comes in ${p.size}.`],
        si: [p => `${p.name} ${p.size} ප්‍රමාණයෙන් තියෙනවා.`],
        ta: [p => `${p.name} ${p.size} அளவில் உள்ளது.`],
        singlish: [p => `${p.name} ${p.size} size ekata thiyenne.`],
        tanglish: [p => `${p.name} ${p.size} size-la irukku.`],
    },
    multi: {
        en: [p => `I found a few: ${p.names}. Which one would you like to know about?`],
        si: [p => `මට මේවා හම්බවුණා: ${p.names}. මොකක් ගැනද දැනගන්න ඕන?`],
        ta: [p => `இவை கிடைத்தன: ${p.names}. எதைப் பற்றி தெரிந்துகொள்ள வேண்டும்?`],
        singlish: [p => `Mata me tika hambawuna: ${p.names}. Mona ekada danaganna one?`],
        tanglish: [p => `Ithu kedachirukku: ${p.names}. Edhu pathi theriyanum?`],
    },
    not_found: {
        en: [() => "I couldn't find that on our list. Could you send the tile name or size? I'll also ask our team and come back to you."],
        si: [() => 'ඒක අපේ ලැයිස්තුවේ මට හොයාගන්න බැරි වුණා. ටයිල් එකේ නම හරි ප්‍රමාණය හරි එවන්න පුළුවන්ද? මම අපේ කණ්ඩායමෙනුත් අහලා ඔබට කියන්නම්.'],
        ta: [() => 'அதை எங்கள் பட்டியலில் கண்டுபிடிக்க முடியவில்லை. டைலின் பெயர் அல்லது அளவை அனுப்ப முடியுமா? எங்கள் குழுவிடமும் கேட்டுவிட்டு சொல்கிறேன்.'],
        singlish: [() => 'Eka apey list eke mata hoyaganna baha. Tile eke nama hari size eka hari evanna puluwanda? Mama api team ekenuth ahala oyata kiyannam.'],
        tanglish: [() => 'Adha engaloda list-la kandupidikka mudiyala. Tile peyar illa size anuppunga. Naan team-kitta kettu ungalukku solren.'],
    },
    letcheck: {
        en: [() => 'Let me check that and come back to you.', () => 'Good question. Let me check with the team and get back to you.', () => "I'll check on that and let you know."],
        si: [() => 'ඒක මම බලලා ඔබට ආපහු කියන්නම්.', () => 'හොඳ ප්‍රශ්නයක්. කණ්ඩායමෙන් අහලා මම දැනුම් දෙන්නම්.', () => 'මම ඒක පරීක්ෂා කරලා දැනුම් දෙන්නම්.'],
        ta: [() => 'அதை நான் பார்த்துவிட்டு உங்களுக்குச் சொல்கிறேன்.', () => 'நல்ல கேள்வி. குழுவிடம் கேட்டுவிட்டுச் சொல்கிறேன்.', () => 'நான் சரிபார்த்து தெரிவிக்கிறேன்.'],
        singlish: [() => 'Eka mama balala oyata aye kiyannam.', () => 'Hondai prashnayak. Team eken ahala mama kiyannam.', () => 'Mama eka check karala oyata danum dennam.'],
        tanglish: [() => 'Adha naan paathutu ungalukku solren.', () => 'Nalla kelvi. Team-kitta kettu solren.', () => 'Naan check panni solren.'],
    },
    complaint: {
        en: [p => `I'm really sorry about that${c(p.n)}. I've passed this to our team and someone will contact you personally.`, p => `Sorry to hear that${c(p.n)}. I've let our team know and they will get in touch with you.`],
        si: [p => `ඒ ගැන ඇත්තටම කණගාටුයි${s(p.n)}. මම මේක අපේ කණ්ඩායමට දැනුම් දුන්නා, එයාලා ඔබව අමතයි.`],
        ta: [p => `அதற்காக மிகவும் வருந்துகிறோம்${s(p.n)}. இதை எங்கள் குழுவிடம் தெரிவித்துவிட்டேன், அவர்கள் உங்களைத் தொடர்பு கொள்வார்கள்.`],
        singlish: [p => `Eka gana hari duk${s(p.n)}. Mama meka api team ekata kiwwa, ewa oyawa contact karanawa.`],
        tanglish: [p => `Adhukku romba varuthama irukku${s(p.n)}. Idha engaloda team-kitta solliten, avanga ungala contact pannuvanga.`],
    },
    refund: {
        en: [() => "I understand. Refunds and returns are handled by our team, so I've passed your message to them and they'll get back to you."],
        si: [() => 'තේරුණා. මුදල් ආපසු ගෙවීම් සහ ආපසු භාර ගැනීම් අපේ කණ්ඩායම බලන්නේ, ඒ නිසා ඔබේ පණිවිඩය මම එයාලාට දැනුම් දුන්නා. එයාලා ඔබව අමතයි.'],
        ta: [() => 'புரிகிறது. பணத்தைத் திருப்பித் தருதல் மற்றும் பொருள் திருப்புதல் எங்கள் குழு கையாளுகிறது, உங்கள் செய்தியை அவர்களிடம் தெரிவித்துவிட்டேன். அவர்கள் உங்களைத் தொடர்பு கொள்வார்கள்.'],
        singlish: [() => 'Hari, therum. Refund saha return karana eka api team eka balanne, e nisa oyage message eka mama ewata kiwwa. Ewa oyawa contact karanawa.'],
        tanglish: [() => 'Puriyuthu. Refund, return ellam engaloda team paakkuvaanga, athanala ungal message-a avanga kitta solliten. Avanga ungala contact pannuvanga.'],
    },
    money_matter: {
        en: [() => "I've passed this to our team and they'll get back to you about it."],
        si: [() => 'මේක මම අපේ කණ්ඩායමට දැනුම් දුන්නා, එයාලා ඒ ගැන ඔබට කියයි.'],
        ta: [() => 'இதை எங்கள் குழுவிடம் தெரிவித்துவிட்டேன், அவர்கள் இதைப் பற்றி உங்களுக்குச் சொல்வார்கள்.'],
        singlish: [() => 'Meka mama api team ekata kiwwa, ewa eka gana oyata kiyanawa.'],
        tanglish: [() => "Idha engaloda team-kitta solliten, avanga ithu pathi ungalukku solluvanga."],
    },
    discount: {
        en: [() => "I can't promise a discount myself, but I've asked our team about it and they'll get back to you.", () => "Discounts are decided by our team, so I've passed your request to them and they'll get back to you."],
        si: [() => 'වට්ටමක් ගැන මට විතරක් පොරොන්දු වෙන්න බෑ, ඒත් මම අපේ කණ්ඩායමෙන් ඒ ගැන ඇහුවා, එයාලා ඔබට කියයි.'],
        ta: [() => 'தள்ளுபடி பற்றி என்னால் உறுதி சொல்ல முடியாது, ஆனால் எங்கள் குழுவிடம் கேட்டிருக்கிறேன், அவர்கள் உங்களுக்குச் சொல்வார்கள்.'],
        singlish: [() => 'Wattamak gana mata ekalama promise karanna baha, haebai mama team ekenna ahuwa, ewa oyata kiyanawa.'],
        tanglish: [() => 'Discount pathi ennala uruthi sollamudiyaadhu, aana team-kitta kettirukken, avanga ungalukku solluvanga.'],
    },
    human: {
        en: [p => `Of course${c(p.n)}. I've asked one of our team to contact you.`],
        si: [() => 'ඔව් අනිවාර්යයෙන්ම. අපේ කණ්ඩායමේ කෙනෙක් ඔබව අමතන්න කියලා මම කිව්වා.'],
        ta: [() => 'நிச்சயமாக. எங்கள் குழுவில் ஒருவர் உங்களைத் தொடர்பு கொள்ளுமாறு கேட்டிருக்கிறேன்.'],
        singlish: [() => 'Ow nam. Api team eke kenek oyawa contact karanna kiwwa.'],
        tanglish: [() => 'Kandippa. Engaloda team-la oruthar ungala contact panna sollirukken.'],
    },
    ai_honest: {
        en: [() => "I'm Royal Bath Hub's virtual assistant, not a person. I can help with tiles, sizes and prices, and I can connect you with one of our team whenever you like. Would you like that?"],
        si: [() => 'මම Royal Bath Hub එකේ virtual assistant, මනුස්සයෙක් නෙවෙයි. ටයිල්, ප්‍රමාණ, මිල ගැන මට උදව් කරන්න පුළුවන්, ඔබට ඕන නම් අපේ කණ්ඩායමේ කෙනෙක්ව සම්බන්ධ කරලා දෙන්නත් පුළුවන්. එහෙම කරන්නද?'],
        ta: [() => 'நான் Royal Bath Hub-இன் virtual assistant, மனிதர் இல்லை. டைல், அளவு, விலை பற்றி உதவ முடியும், நீங்கள் விரும்பினால் எங்கள் குழுவில் ஒருவரை இணைத்து தருகிறேன். வேண்டுமா?'],
        singlish: [() => 'Mama Royal Bath Hub eke virtual assistant kenek, manussayek newei. Tile, size, mila gana mata udaw karanna puluwan, oyata one nam api team eke kenekwa connect karala denna puluwan. Ona da?'],
        tanglish: [() => 'Naan Royal Bath Hub-oda virtual assistant, manushan illa. Tile, size, vilai pathi help panna mudiyum, venumna engaloda team-la oruthara connect panni tharuven. Venuma?'],
    },
    refuse_private: {
        en: [() => "Sorry, I can't share that. I'm happy to help with tiles, sizes and availability though."],
        si: [() => 'සමාවෙන්න, ඒක මට කියන්න බෑ. ටයිල්, ප්‍රමාණ, තොග ගැන නම් සතුටින් උදව් කරන්නම්.'],
        ta: [() => 'மன்னிக்கவும், அதைப் பகிர முடியாது. டைல், அளவு, கையிருப்பு பற்றி உதவ மகிழ்ச்சி.'],
        singlish: [() => 'Samawenna, eka mata kiyanna baha. Tile, size, stock gana nam santhoshayen udaw karannam.'],
        tanglish: [() => 'Mannikkanum, adha ennala sollamudiyaadhu. Tile, size, stock pathi help panna santhosham.'],
    },
    refuse_override: {
        en: [() => 'I can only help with questions about our tiles and showroom. What are you looking for?'],
        si: [() => 'අපේ ටයිල් සහ ෂෝරූම් ගැන ප්‍රශ්නවලට විතරයි මට උදව් කරන්න පුළුවන්. ඔබ බලන්නේ මොනවාද?'],
        ta: [() => 'எங்கள் டைல் மற்றும் ஷோரூம் பற்றிய கேள்விகளுக்கு மட்டுமே என்னால் உதவ முடியும். என்ன தேடுகிறீர்கள்?'],
        singlish: [() => 'Apey tile saha showroom gana prashnawalata withari mata udaw karanna puluwan. Oya balanne monawada?'],
        tanglish: [() => 'Engaloda tile, showroom pathi kelvikku mattum thaan ennala help panna mudiyum. Enna thedureenga?'],
    },
    location: {
        en: [p => `Our showroom is at ${p.addr}.`],
        si: [p => `අපේ ෂෝරූම් එක තියෙන්නේ ${p.addr}.`],
        ta: [p => `எங்கள் ஷோரூம் முகவரி: ${p.addr}.`],
        singlish: [p => `Apey showroom eka thiyenne ${p.addr}.`],
        tanglish: [p => `Engaloda showroom ${p.addr}-la irukku.`],
    },
    thanks: {
        en: [p => `You're welcome${c(p.n)}! Message me any time.`, p => `Happy to help${c(p.n)}.`, () => 'Anytime!'],
        si: [() => 'ස්තූතියි! ඕන වෙලාවක මැසේජ් කරන්න.', () => 'උදව් කරන්න පුළුවන් වුණාට සතුටුයි.'],
        ta: [() => 'நன்றி! எப்போது வேண்டுமானாலும் செய்தி அனுப்புங்கள்.', () => 'உதவ முடிந்ததில் மகிழ்ச்சி.'],
        singlish: [() => 'Kamak naha! Ona welawaka message karanna.', () => 'Udaw karanna puluwan wunata santhoshayi.'],
        tanglish: [() => 'Paravaillai! Epo venumnaalum message pannunga.', () => 'Help panna mudinjathu santhosham.'],
    },
    bye: {
        en: [p => `Thank you for contacting Royal Bath Hub${c(p.n)}. Have a good day!`, p => `Take care${c(p.n)}, talk soon.`],
        si: [() => 'Royal Bath Hub එකට මැසේජ් කළාට ස්තූතියි. ඔබට සුබ දවසක්!'],
        ta: [() => 'Royal Bath Hub-ஐத் தொடர்பு கொண்டதற்கு நன்றி. இனிய நாளாக அமையட்டும்!'],
        singlish: [() => 'Royal Bath Hub ekata message kala ekata sthuthiyi. Hodama dawasak!'],
        tanglish: [() => 'Royal Bath Hub-a contact panninathukku nandri. Nalla naala amaiyattum!'],
    },
    name_ack: {
        en: [p => `Nice to meet you, ${p.n}! What are you looking for?`],
        si: [p => `හමුවෙන්න ලැබුණාට සතුටුයි ${p.n}! ඔබ බලන්නේ මොනවාද?`],
        ta: [p => `உங்களைச் சந்தித்ததில் மகிழ்ச்சி ${p.n}! என்ன தேடுகிறீர்கள்?`],
        singlish: [p => `${p.n}, hamuwenna labuna eka santhoshayi! Oya balanne monawada?`],
        tanglish: [p => `${p.n}, ungala sandhichathula santhosham! Enna thedureenga?`],
    },
    tile_count: {
        en: [p => `For a ${p.room} room that's about ${p.sqft} sq ft. With ${p.waste}% extra for cuts and breakage you'd need about ${p.tiles} tiles${p.of}. This is an estimate, and our team will confirm the exact number.`],
        si: [p => `${p.room} කාමරයක් වර්ග අඩි ${p.sqft}ක් විතර. කැපීම් සහ කැඩීම් සඳහා ${p.waste}%ක් අමතරව එකතු කළාම ටයිල් ${p.tiles}ක් විතර ඕන වෙයි${p.of}. මේක ඇස්තමේන්තුවක්, හරියටම ගණන අපේ කණ්ඩායම තහවුරු කරයි.`],
        ta: [p => `${p.room} அறை சுமார் ${p.sqft} சதுர அடி. வெட்டுதல், உடைவுக்காக ${p.waste}% கூடுதல் சேர்த்தால் சுமார் ${p.tiles} டைல்கள் தேவைப்படும்${p.of}. இது ஒரு மதிப்பீடு, சரியான எண்ணிக்கையை எங்கள் குழு உறுதிப்படுத்தும்.`],
        singlish: [p => `${p.room} room ekak sq ft ${p.sqft} wage. Kapeema walata ${p.waste}% ekathu karama tile ${p.tiles}k wage one wenawa${p.of}. Meka estimate ekak, hariyatama ganan api team eka confirm karanawa.`],
        tanglish: [p => `${p.room} room sumaar ${p.sqft} sq ft. Vettura, udaiyaradhukku ${p.waste}% extra serthaa sumaar ${p.tiles} tile venum${p.of}. Idhu oru estimate, sariyaana ennikkaiya engaloda team confirm pannuvanga.`],
    },
    quote_offer: {
        en: [() => 'Would you like me to ask the team to prepare a quotation?'],
        si: [() => 'කොටේෂන් එකක් හදන්න කණ්ඩායමට කියන්නද?'],
        ta: [() => 'விலைப்புள்ளி தயாரிக்க குழுவிடம் கேட்கட்டுமா?'],
        singlish: [() => 'Quotation ekak hadanna team ekata kiyannada?'],
        tanglish: [() => 'Quotation ready panna team-kitta sollattuma?'],
    },
    ask_room: {
        en: [() => 'To work out the quantity I need the room size, for example 10 x 12 feet.'],
        si: [() => 'ප්‍රමාණය ගණනය කරන්න කාමරයේ ප්‍රමාණය ඕන, උදාහරණයක් විදිහට අඩි 10 x 12.'],
        ta: [() => 'எண்ணிக்கையைக் கணக்கிட அறையின் அளவு வேண்டும், உதாரணமாக 10 x 12 அடி.'],
        singlish: [() => 'Ganan karanna room eke size eka one, udaharanayak widihata feet 10 x 12.'],
        tanglish: [() => 'Ennikkai kanakku panna room size venum, udhaaranam 10 x 12 feet.'],
    },
    ask_tile_size: {
        en: [() => 'Which tile would you like to use? The tile name or size (like 24 x 24 in) will do.'],
        si: [() => 'ඔබ පාවිච්චි කරන්න ඕන මොන ටයිල් එකද? නම හරි 24 x 24 අඟල් වගේ ප්‍රමාණය හරි ඇති.'],
        ta: [() => 'எந்த டைலைப் பயன்படுத்த விரும்புகிறீர்கள்? பெயர் அல்லது 24 x 24 அங்குலம் போன்ற அளவு போதும்.'],
        singlish: [() => 'Mona tile ekakda use karanna one? Nama hari 24 x 24 inch wage size ekak hari ithin.'],
        tanglish: [() => 'Entha tile use panna venum? Peyar illa 24 x 24 inch maadhiri size pothum.'],
    },
    quote_ack: {
        en: [p => `Thank you${c(p.n)}. I've noted the details and our team will prepare your quotation and get back to you.`],
        si: [p => `ස්තූතියි${s(p.n)}. විස්තර ලියාගත්තා, අපේ කණ්ඩායම කොටේෂන් එක හදලා ඔබට දැනුම් දෙයි.`],
        ta: [p => `நன்றி${s(p.n)}. விவரங்களைக் குறித்துக்கொண்டேன், எங்கள் குழு விலைப்புள்ளி தயாரித்து உங்களுக்குத் தெரிவிக்கும்.`],
        singlish: [p => `Sthuthiyi${s(p.n)}. Wistara liyaganna, apey team eka quotation eka hadala oyata danum denawa.`],
        tanglish: [p => `Nandri${s(p.n)}. Vivarangala note panniten, engaloda team quotation ready panni ungalukku solluvanga.`],
    },
    media: {
        en: [() => "Thank you for sending that. I can't open photos yet, so I've passed it to our team."],
        si: [() => 'එවපු එකට ස්තූතියි. මට තාම ෆොටෝ බලන්න බෑ, ඒ නිසා අපේ කණ්ඩායමට දැනුම් දුන්නා.'],
        ta: [() => 'அனுப்பியதற்கு நன்றி. என்னால் இன்னும் படங்களைப் பார்க்க முடியாது, அதனால் எங்கள் குழுவிடம் தெரிவித்துவிட்டேன்.'],
        singlish: [() => 'Evapu ekata sthuthiyi. Mata thama photo balanna baha, e nisa team ekata kiwwa.'],
        tanglish: [() => 'Anuppinadhukku nandri. Ennala innum photo paakka mudiyathu, athanala team-kitta solliten.'],
    },
};

const STYLES = ['en', 'si', 'ta', 'singlish', 'tanglish'];
const LIGHT_KEYS = new Set(['greet', 'thanks', 'stock_in', 'bye', 'name_ack', 'item_found']);
const EMOJIS = ['🙂', '👍', '😊'];

/**
 * @param {string} key    phrase key
 * @param {string} style  en | si | ta | singlish | tanglish
 * @param {object} p      parameters (n = customer name, name, price, size, addr ...)
 * @param {{rng?:Function, avoid?:string[], emoji?:boolean}} o  rng: () => [0,1); avoid: texts used recently; emoji: customer uses emoji
 */
function render(key, style, p = {}, { rng = Math.random, avoid = [], emoji = false } = {}) {
    const entry = P[key];
    if (!entry) throw new Error('unknown phrase key: ' + key);
    const variants = entry[style] || entry.en;
    const texts = variants.map(v => v(p));
    let pool = texts.filter(t => !avoid.includes(t));
    if (!pool.length) {   // every variant was used lately: at least do not repeat the most recent one
        const lastUsed = Math.max(...texts.map(t => avoid.lastIndexOf(t)));
        pool = texts.length > 1 ? texts.filter(t => avoid.lastIndexOf(t) !== lastUsed) : texts;
    }
    let out = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
    if (emoji && LIGHT_KEYS.has(key)) out += ' ' + EMOJIS[Math.min(EMOJIS.length - 1, Math.floor(rng() * EMOJIS.length))];
    return out;
}

module.exports = { render, PHRASES: P, STYLES };