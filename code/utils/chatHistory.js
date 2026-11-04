// utils/chatHistory.js
// Cleans the chat history a browser sends to the dashboard assistant before it goes to the model.
// Only plain user/assistant turns are kept: a client-supplied 'system' message could otherwise
// override the assistant's rules, and a null/odd entry used to crash the request.
function sanitizeChatHistory(history, { max = 8, maxLen = 2000 } = {}) {
    if (!Array.isArray(history)) return [];
    return history
        .filter(m => m && typeof m === 'object' && (m.role === 'user' || m.role === 'assistant'))
        .slice(-max)
        .map(m => ({ role: m.role, content: String(m.content == null ? '' : m.content).slice(0, maxLen) }));
}

module.exports = { sanitizeChatHistory };
