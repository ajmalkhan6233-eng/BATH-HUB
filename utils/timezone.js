// utils/timezone.js
// Loaded first by every entry point (server, WhatsApp bridge, GRN watcher). Makes the process and its
// database sessions run on Sri Lanka time, so JS local dates and SQL CURRENT_DATE / CURRENT_TIMESTAMP agree
// with the shop's clock even on a server set to UTC.
//   APP_TIMEZONE      override the zone (default Asia/Colombo)
//   PG_SET_TIMEZONE   set to "false" to not send the timezone to Postgres (e.g. behind a pooler that
//                     rejects startup options)
const TZ = process.env.APP_TIMEZONE || 'Asia/Colombo';

process.env.TZ = TZ;

if (String(process.env.PG_SET_TIMEZONE).toLowerCase() !== 'false' && !/timezone=/i.test(process.env.PGOPTIONS || '')) {
    process.env.PGOPTIONS = `${process.env.PGOPTIONS ? process.env.PGOPTIONS + ' ' : ''}-c timezone=${TZ}`;
}

module.exports = { TZ };
