'use strict';
// Run on the PC after .env is filled:  node scripts/layla_owner_test.js
// Prints only masked info (last 3 digits, "set"/"not set"). Sends "Layla test OK" to the OWNER number only. Dry run unless LAYLA_OWNER_LIVE=true and all keys are set.
try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }
const { loadSettings, describe } = require('../layla_owner/settings');
const { createSafeSend } = require('../layla_owner/safeSend');
const { sendText: cloudSend } = require('../layla_owner/waCloud');
const { bridgeSendText } = require('../layla_owner/bridgeSend');
const { sendOwnerTest } = require('../layla_owner/selfTest');
(async () => {
  const settings = loadSettings(process.env);
  console.log(JSON.stringify(describe(settings), null, 2));
  if (settings.errors.length) console.log('Fix the errors above first. Nothing will be sent live.');
  try {
    const r = await sendOwnerTest({ settings, send: createSafeSend({ settings, sendText: settings.transport === 'bridge' ? bridgeSendText : cloudSend }) });
    console.log(r.sent ? 'SENT "Layla test OK" to the owner. Check the owner phone.' : 'DRY RUN: nothing was sent. To go live set LAYLA_OWNER_LIVE=true in .env, restart apex-server only, run this again.');
  } catch (e) { console.error('Send failed:', e.message); process.exitCode = 1; }
})();
