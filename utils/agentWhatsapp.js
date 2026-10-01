// utils/agentWhatsapp.js
// DRAFT-ONLY MODE for live WhatsApp (env AGENT_DRAFT_ONLY=true). Off by default: nothing changes until it is switched on.
//
// When on, a message from a CUSTOMER (anyone except the owner's own number) is NOT answered by LAYLA. The webhook
// hands it to the Agent Brain (M9), which saves a checked draft for Aj in the Agent Review tab, and the webhook returns
// an empty reply, so the WhatsApp bridge sends NOTHING to the customer. Aj approves, then sends it himself.
// The owner's own number keeps working as before (business questions, TEACH:).
// If drafting fails for any reason the customer still gets no automatic reply: failing silent is the safe side.

const MAX_DRAFTS_PER_HOUR = 30;   // flood guard per customer number

const digitsOf = v => String(v == null ? '' : v).replace(/\D/g, '');
const isDraftOnly = () => String(process.env.AGENT_DRAFT_ONLY).toLowerCase() === 'true';
const ownerDigits = () => digitsOf(process.env.WHATSAPP_TEST_WHITELIST);
const isOwner = phone => { const o = ownerDigits(); return !!o && digitsOf(phone) === o; };

// Who may send papers (bills, GRNs, cheques, sheets) for reading: the owner plus the numbers in WHATSAPP_PAPER_NUMBERS
// (comma separated). In draft-only mode photos from every other number are just kept, never read or answered.
const paperNumbers = () => [ownerDigits(), ...String(process.env.WHATSAPP_PAPER_NUMBERS || '').split(',').map(digitsOf)].filter(Boolean);
const canSendPapers = phone => paperNumbers().includes(digitsOf(phone));

/**
 * @param {object} a { phone, text, isVoiceNote, brain: {createDraft, recentCount}, notify?: async (message) => void }
 * @returns {Promise<{drafted: boolean, draft_id?: number, reason?: string}>}  never throws
 */
async function draftOnly({ phone, text, isVoiceNote = false, brain, notify }) {
    const ref = digitsOf(phone);
    const body = (isVoiceNote ? '[Voice note: the customer sent audio, which cannot be read yet]' : String(text || '')).trim().slice(0, 2000);
    if (!ref) return { drafted: false, reason: 'no_phone' };
    if (!body) return { drafted: false, reason: 'empty' };
    try {
        if (await brain.recentCount(ref, 60) >= MAX_DRAFTS_PER_HOUR) return { drafted: false, reason: 'rate_limited' };
        const out = await brain.createDraft({ channel: 'whatsapp', customer_ref: ref, incoming_text: body });
        if (notify) await Promise.resolve(notify(`New customer message to review in the Agent Review tab (from ${ref}).`)).catch(() => {});
        return { drafted: true, draft_id: out.draft.id };
    } catch (e) {
        console.error('[agent-draft-only] could not draft:', e.message);
        return { drafted: false, reason: 'error' };
    }
}

module.exports = { draftOnly, isDraftOnly, isOwner, canSendPapers, MAX_DRAFTS_PER_HOUR };
