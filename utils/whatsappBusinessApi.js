// WhatsApp Business (Cloud) API client — sends the owner a proactive alert
// (cheque/loan due soon) via Meta's official Business API.
//
// HARD RULE: this is NOT the local whatsapp-bridge (CLAUDE.md forbids ever
// starting that — it would kill the live WhatsApp session's Chrome tab).
// This talks only to graph.facebook.com over HTTPS, using credentials the
// owner generates himself in Meta's WhatsApp Business Platform / Meta for
// Developers console — nothing here can create that account or token.
//
// Disabled unless all three env vars are set, so it is a no-op ($0, zero
// network calls) until the owner has actually gone and set up the real
// WhatsApp Business API and pasted his own credentials in .env:
//   WHATSAPP_API_TOKEN        - permanent/system-user access token
//   WHATSAPP_PHONE_NUMBER_ID  - the "Phone number ID" from the app dashboard
//   WHATSAPP_TO_NUMBER        - owner's own WhatsApp number, international
//                               format with no leading + or 0 (e.g. 94771234567)
//
// NOTE ON MESSAGE TYPE: a business can only send free-form text to a number
// outside an active 24h customer-initiated session if using a pre-approved
// message TEMPLATE. This sends plain text by default (works once the owner
// has messaged the business number himself within the last 24h to open a
// session); set WHATSAPP_TEMPLATE_NAME to use an approved template instead
// for reliable delivery any time. Written against the Cloud API's public
// v20.0 schema — verify against developers.facebook.com/docs/whatsapp
// before first real use in case Meta has since changed field names.

const axios = require('axios');

function isEnabled() {
    return !!(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TO_NUMBER);
}

async function sendWhatsAppAlert(text) {
    if (!isEnabled()) {
        console.log('[whatsapp] not configured (WHATSAPP_API_TOKEN/PHONE_NUMBER_ID/TO_NUMBER unset) — skipping:', text);
        return { sent: false, reason: 'not_configured' };
    }
    try {
        const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
        const body = templateName
            ? {
                messaging_product: 'whatsapp',
                to: process.env.WHATSAPP_TO_NUMBER,
                type: 'template',
                template: { name: templateName, language: { code: 'en' }, components: [
                    { type: 'body', parameters: [{ type: 'text', text }] }
                ] }
            }
            : {
                messaging_product: 'whatsapp',
                to: process.env.WHATSAPP_TO_NUMBER,
                type: 'text',
                text: { body: text }
            };
        const res = await axios.post(url, body, {
            headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`, 'Content-Type': 'application/json' }
        });
        return { sent: true, id: res.data?.messages?.[0]?.id };
    } catch (e) {
        console.error('[whatsapp] send failed:', e.response?.data || e.message);
        return { sent: false, reason: e.response?.data?.error?.message || e.message };
    }
}

module.exports = { sendWhatsAppAlert, isEnabled };
