'use strict';
const T = require('../../layla_v2/transport');

const okFetch = () => jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.1' }] }) }));

describe('LAYLA v2 transport', () => {
    test('dry run sends nothing, logs only last 3 digits and no body', async () => {
        const log = jest.fn();
        const t = T.createDryRunTransport({ log });
        const r = await t.sendText('94771234567', 'secret body text');
        expect(r).toMatchObject({ ok: true, dryRun: true });
        const line = log.mock.calls[0][0];
        expect(line).toContain('***567');
        expect(line).not.toContain('94771234567');
        expect(line).not.toContain('secret body');
        expect(t.sent).toHaveLength(1);
        expect(t.sent[0].to_last3).toBe('567');
    });

    test('dry run rejects empty text and missing number', async () => {
        const t = T.createDryRunTransport({ log() {} });
        expect((await t.sendText('94771234567', '  ')).ok).toBe(false);
        expect((await t.sendText('', 'hi')).ok).toBe(false);
        expect((await t.sendImage('94771234567', {})).ok).toBe(false);
        expect((await t.sendDocument('94771234567', {})).ok).toBe(false);
    });

    test('simulator stores outgoing and incoming', async () => {
        const t = T.createSimulatorTransport();
        await t.sendText('+94 77 123 4567', 'hello');
        await t.sendDocument('94771234567', { url: 'http://x/y.pdf', filename: 'y.pdf' });
        t.receive('94771234567', 'hi');
        expect(t.textsTo('94771234567')).toEqual(['hello']);
        expect(t.outbox).toHaveLength(2);
        expect(t.inbox[0].text).toBe('hi');
        t.reset();
        expect(t.outbox).toHaveLength(0);
    });

    test('cloud adapter refuses when WHATSAPP_LIVE is not true (fetch never called)', async () => {
        const f = okFetch();
        const t = T.createCloudApiTransport({ env: { WHATSAPP_API_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: '123' }, fetch: f });
        const r = await t.sendText('94771234567', 'hi');
        expect(r.ok).toBe(false);
        expect(f).not.toHaveBeenCalled();
    });

    test('cloud adapter refuses without credentials even when live', async () => {
        const f = okFetch();
        const t = T.createCloudApiTransport({ env: { WHATSAPP_LIVE: 'true' }, fetch: f });
        expect((await t.sendText('94771234567', 'hi')).ok).toBe(false);
        expect(f).not.toHaveBeenCalled();
    });

    test('cloud adapter posts the right request with injected fetch', async () => {
        const f = okFetch();
        const env = { WHATSAPP_LIVE: 'true', WHATSAPP_API_TOKEN: 'tok-abc', WHATSAPP_PHONE_NUMBER_ID: '555' };
        const t = T.createCloudApiTransport({ env, fetch: f });
        const r = await t.sendText('+94 77 123 4567', 'Hello there');
        expect(r).toEqual({ ok: true, id: 'wamid.1' });
        const [url, opts] = f.mock.calls[0];
        expect(url).toBe('https://graph.facebook.com/v20.0/555/messages');
        expect(opts.headers.Authorization).toBe('Bearer tok-abc');
        const body = JSON.parse(opts.body);
        expect(body).toMatchObject({ messaging_product: 'whatsapp', to: '94771234567', type: 'text', text: { body: 'Hello there' } });
        await t.sendDocument('94771234567', { url: 'https://x/y.pdf', filename: 'y.pdf', caption: 'c' });
        expect(JSON.parse(f.mock.calls[1][1].body).document).toMatchObject({ link: 'https://x/y.pdf', filename: 'y.pdf' });
        await t.sendImage('94771234567', { url: 'https://x/y.png' });
        expect(JSON.parse(f.mock.calls[2][1].body).type).toBe('image');
    });

    test('cloud adapter retries on 500, stops on 400, error never has the token', async () => {
        const env = { WHATSAPP_LIVE: 'true', WHATSAPP_API_TOKEN: 'tok-secret', WHATSAPP_PHONE_NUMBER_ID: '555' };
        const f500 = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
        const r1 = await T.createCloudApiTransport({ env, fetch: f500, retries: 2 }).sendText('94771234567', 'x');
        expect(r1.ok).toBe(false);
        expect(f500).toHaveBeenCalledTimes(3);
        const f400 = jest.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'bad number' } }) }));
        const r2 = await T.createCloudApiTransport({ env, fetch: f400, retries: 2 }).sendText('94771234567', 'x');
        expect(f400).toHaveBeenCalledTimes(1);
        expect(r2.error).toContain('bad number');
        const fThrow = jest.fn(async () => { throw new Error('network down tok-secret'); });
        const r3 = await T.createCloudApiTransport({ env, fetch: fThrow, retries: 0 }).sendText('94771234567', 'x');
        expect(r3.ok).toBe(false);
        expect(JSON.stringify(r3)).not.toContain('tok-secret');
    });

    test('selectTransport: dry run unless live flag and keys both present', () => {
        expect(T.selectTransport({}).name).toBe('dry-run');
        expect(T.selectTransport({ WHATSAPP_LIVE: 'true' }).name).toBe('dry-run');
        expect(T.selectTransport({ WHATSAPP_API_TOKEN: 'a', WHATSAPP_PHONE_NUMBER_ID: 'b' }).name).toBe('dry-run');
        expect(T.selectTransport({ WHATSAPP_LIVE: 'true', WHATSAPP_API_TOKEN: 'a', WHATSAPP_PHONE_NUMBER_ID: 'b' }, { fetch: okFetch() }).name).toBe('cloud-api');
    });

    test('parseCloudWebhook extracts text messages and profile names', () => {
        const body = { entry: [{ changes: [{ value: { contacts: [{ wa_id: '94771234567', profile: { name: 'Nimal' } }], messages: [{ from: '94771234567', id: 'm1', type: 'text', text: { body: 'hi' } }, { from: '94771234567', id: 'm2', type: 'image' }] } }] }] };
        const m = T.parseCloudWebhook(body);
        expect(m).toHaveLength(2);
        expect(m[0]).toMatchObject({ from: '94771234567', text: 'hi', name: 'Nimal' });
        expect(m[1].text).toBe('');
        expect(T.parseCloudWebhook(null)).toEqual([]);
    });
});