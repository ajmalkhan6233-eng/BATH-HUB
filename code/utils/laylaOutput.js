// laylaOutput.js (apex integration)
// Final output guard for anything sent to a WhatsApp customer, plus the
// date anchor for LAYLA's system prompt.
//
// Wiring (done — keep it this way, do not duplicate):
// - sanitizeAssistantOutput(): called in whatsapp-bridge.js at every outbound
//   send point (msg.reply and client.sendMessage). It is the belt-and-braces
//   layer ON TOP of layla.js's own stripReasoning/looksLikeReasoning pipeline,
//   not a replacement for it.
// - buildDateAnchor(): used by layla.js getSystemPrompt() as the single date
//   mechanism (replaced the old inline CURRENT DATE sentence).

/**
 * Strips internal reasoning / chain-of-thought leakage from LLM output
 * before it is sent to a customer over WhatsApp.
 */
function sanitizeAssistantOutput(rawText) {
  if (!rawText) return '';

  let clean = String(rawText);

  // Remove <think>...</think> or similar reasoning blocks
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '');
  clean = clean.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

  // Remove lines that start with "reasoning:" or "thought:" (case-insensitive)
  clean = clean.replace(/^\s*(reasoning|thought|internal)\s*:.*$/gim, '');

  // Collapse leftover multiple blank lines
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();

  return clean;
}

/**
 * Returns a system-prompt string anchoring the model to the real
 * current date/time in Sri Lanka, so relative date references
 * ("tomorrow", "next Monday") are computed correctly.
 */
function buildDateAnchor() {
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Colombo',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `CONTEXT ANCHOR: The current real date and time in Sri Lanka is ${now}. ` +
    `All relative time references ("today", "tomorrow", "next week", "this weekend") ` +
    `must be computed mathematically against this exact timestamp — never assumed from ` +
    `training data or prior conversation turns. Dates in ${new Date().getFullYear()} are NOT in the future.`;
}

module.exports = { sanitizeAssistantOutput, buildDateAnchor };
