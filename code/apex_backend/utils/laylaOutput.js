// laylaOutput.js
// Cleans LLM output before it reaches a WhatsApp customer, and anchors
// the model to the real current date/time so it stops hallucinating
// relative dates.

/**
 * Strips internal reasoning / chain-of-thought leakage from LLM output
 * before it is sent to a customer over WhatsApp.
 */
function sanitizeAssistantOutput(rawText) {
  if (!rawText) return '';

  let clean = rawText;

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
    `training data or prior conversation turns.`;
}

module.exports = { sanitizeAssistantOutput, buildDateAnchor };

// CLAUDE_CODE_WIRES_THIS: import sanitizeAssistantOutput() and call it on every
// LLM response inside the whatsapp-web.js message dispatch handler, right before
// client.sendMessage(). Import buildDateAnchor() and prepend its output to the
// system prompt on every LAYLA request.
