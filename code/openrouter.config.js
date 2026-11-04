const OpenAI = require("openai");

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || 'not-set',
});

const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";

module.exports = { client, DEFAULT_MODEL };
