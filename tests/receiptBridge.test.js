'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const s = require('../utils/whatsappReceiptSender');

describe('receipt send through the free WhatsApp bridge', () => {
  const png = path.join(os.tmpdir(), 'rb_test.png');
  beforeAll(() => fs.writeFileSync(png, Buffer.from([137, 80, 78, 71])));
  test('viaBridge only when WHATSAPP_VIA=bridge', () => {
    expect(s.viaBridge({ WHATSAPP_VIA: 'bridge' })).toBe(true);
    expect(s.viaBridge({ WHATSAPP_VIA: 'Bridge' })).toBe(true);
    expect(s.viaBridge({})).toBe(false);
  });
  test('posts the picture and caption to the bridge', async () => {
    const calls = [];
    const http = { post: async (url, body) => { calls.push({ url, body }); return { data: { success: true } }; } };
    await s.sendViaBridge({ to: '+94 77 799 9219', filePath: png, env: {}, http });
    expect(calls[0].url).toBe('http://localhost:3001/send');
    expect(calls[0].body.to).toBe('94777999219');
    expect(calls[0].body.message).toBe(s.CAPTION);
    expect(calls[0].body.media.mimetype).toBe('image/png');
    expect(calls[0].body.media.data).toBe(Buffer.from([137, 80, 78, 71]).toString('base64'));
  });
  test('throws when the bridge says no', async () => {
    const http = { post: async () => ({ data: { success: false } }) };
    await expect(s.sendViaBridge({ to: '94777999219', filePath: png, env: {}, http })).rejects.toThrow();
  });
});
