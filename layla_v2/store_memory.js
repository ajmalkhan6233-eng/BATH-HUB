'use strict';
// In-memory store with the same interface as store_pg.js. Used by tests and the offline quality set;
// nothing is written anywhere. See store_pg.js for what each method means.
const { normalizePhone: digits } = require('./roles');   // 0771234567, +94 77 123 4567 and 94771234567 are the same person

function createMemoryStore({ now = () => new Date() } = {}) {
    const contacts = new Map();   // phone -> {phone, role, name, active}
    const tasks = [];
    const state = new Map();
    const customers = new Map();
    const messages = [];
    let taskId = 0;
    return {
        name: 'memory',
        async ensureSchema() {},
        async getContact(phone) { const c = contacts.get(digits(phone)); return c && c.active ? { ...c } : null; },
        async addContact({ phone, role = 'staff', name = null }) { contacts.set(digits(phone), { phone: digits(phone), role, name, active: true }); },
        async removeContact(phone) { contacts.delete(digits(phone)); },
        async listContacts(role) { return [...contacts.values()].filter(c => c.active && (!role || c.role === role)).map(c => ({ ...c })); },
        async createTask({ kind, phone = null, name = null, summary, payload = null }) {
            const t = { id: ++taskId, kind, status: 'open', phone: phone ? digits(phone) : null, cust_name: name, summary: String(summary).slice(0, 1000), payload: payload ? JSON.stringify(payload) : null, created_at: now() };
            tasks.push(t); return t.id;
        },
        async getTask(id) { const t = tasks.find(x => x.id === Number(id)); return t ? { ...t } : null; },
        async listOpenTasks(limit = 20) { return tasks.filter(t => t.status === 'open').slice(-limit).reverse().map(t => ({ ...t })); },
        async closeTask(id, by = 'staff') { const t = tasks.find(x => x.id === Number(id) && x.status === 'open'); if (!t) return false; t.status = 'done'; t.closed_by = by; return true; },
        async getState(key) { return state.has(key) ? state.get(key) : null; },
        async setState(key, value) { state.set(key, String(value)); },
        async getCustomer(phone) { const c = customers.get(digits(phone)); return c ? { ...c } : null; },
        async saveCustomer(phone, { name, lang } = {}) {
            const p = digits(phone); const old = customers.get(p) || { phone: p, name: null, lang: null };
            customers.set(p, { phone: p, name: name || old.name, lang: lang || old.lang });
        },
        async addMessage(phone, direction, body, lang = null) { messages.push({ phone: digits(phone), direction, body: String(body).slice(0, 2000), lang }); },
        async recentMessages(phone, n = 20) { return messages.filter(m => m.phone === digits(phone)).slice(-n).map(m => ({ ...m })); },
        _tasks: tasks, _messages: messages,
    };
}

module.exports = { createMemoryStore };