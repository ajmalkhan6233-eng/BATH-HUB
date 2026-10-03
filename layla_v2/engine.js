'use strict';
// LAYLA v2 entry: handleIncoming({from, text, name, type}, deps).
//   1. kill switch (LAYLA_V2_DISABLED=true) -> does nothing at all
//   2. who is it? owner / staff (layla_contacts allow-list) or customer
//   3. paused by the owner -> customers get no reply (their messages are still saved); owner commands still work
//   4. owner / staff -> commands (staff.js); customer -> customerTurn (customer.js)
// It never throws: if anything fails the customer simply gets no automatic reply (the safe side).
const { getContext } = require('./core');
const { resolveRole, normalizePhone } = require('./roles');
const { customerTurn } = require('./customer');
const { staffTurn } = require('./staff');

const isTrue = v => String(v || '').toLowerCase() === 'true';

async function handleIncoming(msg, deps = {}) {
    const ctx = getContext(deps);
    try {
        if (isTrue(ctx.env.LAYLA_V2_DISABLED)) return { handled: false, reason: 'disabled' };
        const from = normalizePhone(msg && msg.from);
        if (from.length < 7) return { handled: false, reason: 'no_sender' };
        const m = { ...msg, from };

        const { role } = await resolveRole(ctx.store, from);
        const paused = (await ctx.store.getState('paused')) === 'true';

        if (role === 'owner' || role === 'staff') {
            if (!String(m.text || '').trim()) return { handled: true, role, intent: 'empty', replies: [], tasks: [] };
            return await staffTurn(ctx, m, role);
        }
        if (paused) {
            if (String(m.text || '').trim()) await ctx.store.addMessage(from, 'in', String(m.text).slice(0, 2000), null);
            return { handled: true, role: 'customer', paused: true, replies: [], tasks: [] };
        }
        return await customerTurn(ctx, m);
    } catch (e) {
        ctx.log(`[layla-v2] error: ${String(e && e.message || e).slice(0, 200)}`);
        return { handled: false, reason: 'error', error: String(e && e.message || e).slice(0, 200) };
    }
}

module.exports = { handleIncoming };