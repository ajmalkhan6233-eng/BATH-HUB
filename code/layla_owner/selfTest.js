'use strict';
/** The first live line: "Layla test OK", to the owner only. In dry run it only logs. */
const TEST_LINE = 'Layla test OK';
async function sendOwnerTest({ settings, send }) {
  const r = await send(settings.ownerNumber, TEST_LINE);
  return { sent: !!settings.liveAllowed && !(r && r.dryRun), dryRun: !settings.liveAllowed, line: TEST_LINE };
}
module.exports = { sendOwnerTest, TEST_LINE };
