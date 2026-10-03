'use strict';
// LAYLA v2 for WhatsApp. NOTHING here is mounted into the live webhook by default.
//   handleIncoming({from, text, name, type}, deps)   the one function other code calls
//   createDeps({pool, env})                          real wiring: Postgres store + catalogue, transport chosen by env
//                                                    (DRY RUN unless WHATSAPP_LIVE=true and the keys exist), the old answer engine for owner finance questions
//   createRouter(deps)                               optional Express route, see route.js (off unless LAYLA_V2_ENABLED=true)
const { handleIncoming } = require('./engine');
const { createPgStore } = require('./store_pg');
const { createPgCatalog } = require('./catalog');
const { selectTransport } = require('./transport');
const { createStubDocuments, createSimulatedDocuments } = require('./documents_adapter');
const { createMemoryStore } = require('./store_memory');
const { createMemoryCatalog } = require('./catalog');
const { createSimulatorTransport, createDryRunTransport } = require('./transport');

function createDeps({ pool, env = process.env, documents, answerEngine, model, log } = {}) {
    if (!pool) throw new Error('createDeps needs a database pool');
    return {
        env,
        store: createPgStore(pool),
        catalog: createPgCatalog(pool),
        transport: selectTransport(env, { log }),
        documents: documents || createStubDocuments(),           // after feature/documents is merged: pass the real adapter here
        answerEngine: answerEngine || (async text => {            // owner finance questions: the existing engine, read only, never edited
            const { classifyAndAnswer } = require('../scripts/layla_answer_engine');
            return classifyAndAnswer(pool, text);
        }),
        model,
        log,
    };
}

module.exports = {
    handleIncoming, createDeps,
    createRouter: (...a) => require('./route').createRouter(...a),
    // for tests and demos
    createMemoryStore, createMemoryCatalog, createSimulatorTransport, createDryRunTransport, createSimulatedDocuments, createStubDocuments,
};