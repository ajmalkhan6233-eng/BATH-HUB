'use strict';
// ONE place for the official Royal Bath Hub details used on every receipt (picture, PDF, WhatsApp text).
// Change a detail here and every receipt follows.
const SHOP = {
    name: 'ROYAL BATH HUB',
    address: 'No. 173/1, Kandy Road, Thihariya, Kalagedihena, Sri Lanka',
    phone: '+94 74 035 5536',
    email: 'royalbathhub1@gmail.com',
    mapsUrl: 'https://maps.app.goo.gl/2t5f6dTp35tpPnQL8',
};

// Text lines for the WhatsApp message (WhatsApp makes the link tappable by itself).
function contactFooter() {
    return `${SHOP.address}\nPhone / WhatsApp: ${SHOP.phone}\nEmail: ${SHOP.email}\nFind us on Google Maps: ${SHOP.mapsUrl}`;
}

// The ONLY text sent under the receipt picture (AJ 20 Nov): the receipt picture already shows the address, phone, email, QR and thank-you,
// so the message carries just the Google Maps link (WhatsApp makes it tappable, one tap opens the way to the shop).
function mapLine() {
    return `Find us on Google Maps: ${SHOP.mapsUrl}`;
}

// QR code of the map link: data URL (for the picture) or PNG buffer (for the PDF). Returns null if the library is missing.
async function mapQrDataUrl(opts = {}) {
    try { return await require('qrcode').toDataURL(SHOP.mapsUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M', ...opts }); } catch (e) { return null; }
}
async function mapQrBuffer(opts = {}) {
    try { return await require('qrcode').toBuffer(SHOP.mapsUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M', ...opts }); } catch (e) { return null; }
}

module.exports = { SHOP, contactFooter, mapLine, mapQrDataUrl, mapQrBuffer };
