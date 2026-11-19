'use strict';
// POS phone rules (17 Nov): Sri Lanka as before; any other country only with + or 00 in front. Run: node scripts/test_phone_rules.js
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const w = require('../utils/whatsappReceiptSender');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'pos-customer.js'), 'utf8');
const fn = /function slPhone[\s\S]*?\r?\n  \}\r?\n/.exec(src)[0];
const slPhone = new Function(fn + '; return slPhone;')();
const screen = [['0771234567', '0771234567'], ['+94 77 123 4567', '0771234567'], ['011 2345678', '0112345678'], ['0094771234567', '0771234567'], ['+61400000000', '+61400000000'], ['0061400000000', '+61400000000'], ['+61 400 000 000', '+61400000000'], ['009 61400000000', '+61400000000'], ['', ''], ['abc', null], ['12345', null], ['61400000000', null], ['+1234', null], ['+9447712', null]];
for (const [i, o] of screen) assert.strictEqual(slPhone(i), o, 'screen ' + JSON.stringify(i) + ' -> ' + slPhone(i));
const wa = [['0777999219', '+94777999219'], ['+94 77 799 9219', '+94777999219'], ['+61400000000', '+61400000000'], ['0061400000000', '+61400000000'], ['+1 415 555 2671', '+14155552671'], ['61400000000', null], ['abc', null], ['12345', null], ['', null], ['0112345678', null]];
for (const [i, o] of wa) assert.strictEqual(w.normalizeWhatsappPhone(i), o, 'whatsapp ' + JSON.stringify(i) + ' -> ' + w.normalizeWhatsappPhone(i));
assert.strictEqual(w.normalizeSriLankaPhone('+1 415 555 2671'), null);   // old function unchanged (its own test still expects this)
console.log('PHONE RULES OK: screen ' + screen.length + ' cases, WhatsApp ' + wa.length + ' cases');
