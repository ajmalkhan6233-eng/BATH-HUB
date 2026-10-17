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
