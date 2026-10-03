'use strict';
// Adapter between LAYLA v2 and the documents module (routes/documents.js, built on branch feature/documents).
// LAYLA only ever calls getDocument(); WHAT is generated lives behind this interface.
//
//   getDocument({ type, ref?, date?, range? }) -> Promise<
//       { ok: true,  filename, mime, buffer: Buffer, caption }          a file to send
//     | { ok: false, reason: 'not_wired' | 'not_found' | 'unsupported' | 'error' } >
//   type is one of DOC_TYPES. ref is a document number ("12"). date is YYYY-MM-DD. range is {from, to}.
//
// Today: createStubDocuments() answers 'not_wired' (LAYLA tells the owner the documents module is not connected yet).
//        createSimulatedDocuments() returns small fake files, for tests and the offline quality set.
// AFTER feature/documents is merged: write createDocumentsAdapter({ pool }) that calls the module's generators
// (daily report, quotation by number, cheque list, stock report) and returns the same shape. See audit/LAYLA_REPORT.md.

const DOC_TYPES = ['daily_report', 'quotation', 'invoice', 'cheques_due', 'stock_report'];

function createStubDocuments() {
    return { name: 'stub', types: [], async getDocument() { return { ok: false, reason: 'not_wired' }; } };
}

function createSimulatedDocuments({ known = { quotation: ['12', '7'], invoice: ['101'] } } = {}) {
    return {
        name: 'simulated',
        types: DOC_TYPES.slice(),
        async getDocument({ type, ref } = {}) {
            if (!DOC_TYPES.includes(type)) return { ok: false, reason: 'unsupported' };
            if ((type === 'quotation' || type === 'invoice') && !(known[type] || []).includes(String(ref))) return { ok: false, reason: 'not_found' };
            const label = ref ? `${type}-${ref}` : type;
            return { ok: true, filename: `${label}.pdf`, mime: 'application/pdf', buffer: Buffer.from('%PDF-1.4 simulated ' + label), caption: label.replace('_', ' ') };
        },
    };
}

module.exports = { DOC_TYPES, createStubDocuments, createSimulatedDocuments };