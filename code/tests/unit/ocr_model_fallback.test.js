const fs = require('fs'), os = require('os'), path = require('path');
const calls = [];
jest.mock('../../openrouter.config', () => ({ client: { chat: { completions: { create: jest.fn() } } } }), { virtual: false });
const { client } = require('../../openrouter.config');
const ocr = require('../../scripts/ocr_photo');

const img = path.join(os.tmpdir(), 'ocrfb.jpg'); fs.writeFileSync(img, 'x');
const models = { data: [
  { id: 'a/paid:free', pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] }, context_length: 9 },
  { id: 'b/vis:free', pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }, context_length: 100 },
  { id: 'c/paid', pricing: { prompt: '0.1', completion: '0.1' }, architecture: { input_modalities: ['image'], output_modalities: ['text'] }, context_length: 500 },
] };
test('discovers only free image models', async () => {
  const ids = await ocr.discoverFreeVisionModels(async () => ({ json: async () => models }));
  expect(ids).toEqual(['b/vis:free']);
});
test('a 403 (agent-only model) also falls through to the next free model', async () => {
  client.chat.completions.create.mockReset();
  client.chat.completions.create
    .mockRejectedValueOnce(Object.assign(new Error('403 only available on agentic harnesses'), { status: 403 }))
    .mockResolvedValueOnce({ choices: [{ message: { content: '{"document_type":"grn","items":[]}' } }] });
  const r = await ocr.ocrPhoto(img);
  expect(r._model).toBe('b/vis:free');
});
test('falls back when the first model has no endpoints', async () => {
  client.chat.completions.create.mockReset();
  client.chat.completions.create
    .mockRejectedValueOnce(Object.assign(new Error('404 No endpoints found'), { status: 404 }))
    .mockResolvedValueOnce({ choices: [{ message: { content: '{"document_type":"grn","items":[]}' } }] });
  const r = await ocr.ocrPhoto(img);
  expect(r._model).toBe('b/vis:free');
  expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
});
test('an EMPTY answer from a model tries the next free model instead of failing', async () => {
  client.chat.completions.create.mockReset();
  client.chat.completions.create
    .mockResolvedValueOnce({ choices: [{ message: { content: '' } }] })
    .mockResolvedValueOnce({ choices: [{ message: { content: '{"document_type":"grn","items":[]}' } }] });
  const r = await ocr.ocrPhoto(img);
  expect(r._model).toBe('b/vis:free');
});
test('when every reader gives nothing the error is in plain words (no "retake the photo")', async () => {
  client.chat.completions.create.mockReset();
  client.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: '' } }] });
  const savedKey = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY; ocr._resetGeminiCache();   // no real Gemini call, whatever .env holds
  try { await expect(ocr.ocrPhoto(img)).rejects.toMatchObject({ readerDown: true, message: expect.stringMatching(/photo reader gave no answer/) }); }
  finally { if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey; ocr._resetGeminiCache(); }
});
test('Gemini 429 then empty backup: the message says the free quota is used up', async () => {
  client.chat.completions.create.mockReset();
  client.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: '' } }] });
  process.env.GEMINI_API_KEY = 'x'; const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => (String(u).includes('/models?') ? { json: async () => ({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }) } : { ok: false, status: 429, json: async () => ({ error: { message: 'You exceeded your current quota' } }) });
  try { await expect(ocr.ocrPhoto(img)).rejects.toMatchObject({ readerDown: true, message: expect.stringMatching(/used up its free quota/) }); }
  finally { globalThis.fetch = realFetch; delete process.env.GEMINI_API_KEY; ocr._resetGeminiCache(); }
});
