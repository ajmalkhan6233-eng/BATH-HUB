'use strict';
const { detectLanguage, usesEmoji } = require('../../layla_v2/lang');
const g = require('../../layla_v2/glossary');

describe('LAYLA v2 language detection', () => {
    test.each([
        ['Do you have 24 x 24 tiles in stock?', 'en'],
        ['What is the price of the white floor tile', 'en'],
        ['ටයිල් එකේ මිල කීයද?', 'si'],
        ['මට නාන කාමරේ ටයිල් ඕනේ', 'si'],
        ['இந்த டைல் விலை என்ன?', 'ta'],
        ['எனக்கு குளியலறை டைல்ஸ் வேண்டும்', 'ta'],
        ['tile eka mila kiyada?', 'singlish'],
        ['mata bathroom ekata tile ekak ona, thiyenawada', 'singlish'],
        ['aiyo godak mila wage', 'singlish'],
        ['tile vilai evlo anna', 'tanglish'],
        ['enakku bathroom tile venum, irukka?', 'tanglish'],
        ['ungal showroom enga irukku', 'tanglish'],
    ])('%s -> %s', (text, style) => {
        expect(detectLanguage(text).style).toBe(style);
    });

    test('mixed text with English words and Sinhala script is Sinhala', () => {
        expect(detectLanguage('24x24 tile එකේ price එක කීයද').style).toBe('si');
    });

    test('very short messages follow the previous style, otherwise English', () => {
        expect(detectLanguage('ok').style).toBe('en');
        expect(detectLanguage('ok', 'singlish').style).toBe('singlish');
        expect(detectLanguage('', null).style).toBe('en');
        expect(detectLanguage(null).style).toBe('en');
    });

    test('a long clear English message is not pulled to the previous style', () => {
        expect(detectLanguage('I would like to know the delivery options to Colombo please', 'tanglish').style).toBe('en');
    });

    test('emoji detection', () => {
        expect(usesEmoji('thanks 👍')).toBe(true);
        expect(usesEmoji('thanks')).toBe(false);
    });
});

describe('LAYLA v2 glossary', () => {
    test('maps Sinhala, Tamil and romanised words to the English key', () => {
        expect(g.canonicalize('ටයිල් එකේ මිල')).toContain('tile');
        expect(g.canonicalize('ටයිල් එකේ මිල')).toContain('price');
        expect(g.canonicalize('விலை என்ன')).toContain('price');
        expect(g.canonicalize('tile eke mila')).toBe('tile eke price');
        expect(g.canonicalize('two boxes')).toBe('two box');
    });
    test('word() gives the reply word per style and falls back to English', () => {
        expect(g.word('tile', 'si')).toBe('ටයිල්');
        expect(g.word('price', 'ta')).toBe('விலை');
        expect(g.word('box', 'singlish')).toBe('box');
        expect(g.word('nothing-like-this', 'si')).toBe('nothing-like-this');
    });
    test('glossary covers the shop words the brief asked for', () => {
        for (const k of ['inch', 'sqft', 'box', 'tile', 'floor', 'wall', 'price', 'stock', 'size']) expect(g.terms[k]).toBeTruthy();
    });
});