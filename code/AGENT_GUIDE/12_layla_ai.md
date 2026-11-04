# LAYLA — the AI assistant

- Core: layla.js. Flow per message (processMessage):
  voice note -> escalate | TEACH: (owner only) -> store fact | hard keyword guard (price,
  discount, invoice...) -> escalate, NO model call | answer engine (deterministic DB
  numbers, scripts/layla_answer_engine.js) | else AI chain: Ollama (local) -> OpenRouter.
- Business knowledge the model sees: shop_config.json + LAYLA_TAUGHT_FACTS.md (owner-taught).
  Edit shop_config.json per client (showroom info, packages, rules). Restart after editing.
- Safety layers (do not weaken): stripReasoning / extractJsonObject / looksLikeReasoning
  keep model chain-of-thought out of customer replies; getSystemPrompt() injects today's
  date; SAFE_FALLBACK_MESSAGE is sent when output is unusable.
- Models/keys come from .env (OLLAMA_URL/OLLAMA_MODEL, OPENROUTER_API_KEY, DEFAULT_MODEL).
- Test without WhatsApp: POST /simulate {"phone":"9470...","message":"..."} on the server port.
