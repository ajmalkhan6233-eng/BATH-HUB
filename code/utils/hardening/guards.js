'use strict';
// Request guards. Both answer with a plain JSON error and never a stack trace.
//   requestSizeGuard(maxBytes)  rejects early (413) when the Content-Length header is over the limit, before any body is read.
//   jsonDepthGuard(opts)        run AFTER the body parser: rejects (400) a JSON body nested too deep or with too many keys/items,
//                               which can exhaust CPU/memory in later code that walks the body (default depth 12, 2000 nodes).

function requestSizeGuard(maxBytes = 1024 * 1024) {
    return function requestSizeGuardMw(req, res, next) {
        const len = req.headers['content-length'];
        if (len !== undefined) {
            const n = Number(len);
            if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Bad request size.' });
            if (n > maxBytes) return res.status(413).json({ error: 'That request is too big.' });
        }
        next();
    };
}

// Iterative walk (no recursion, so a hostile depth cannot overflow the stack). -> { depth, nodes }, stops counting at the limits.
function measure(value, maxDepth, maxNodes) {
    let depth = 0, nodes = 0;
    const stack = [[value, 1]];
    while (stack.length) {
        const [v, d] = stack.pop();
        if (v === null || typeof v !== 'object') continue;
        if (d > depth) depth = d;
        if (depth > maxDepth) return { depth, nodes, over: 'depth' };
        const kids = Array.isArray(v) ? v : Object.values(v);
        nodes += kids.length;
        if (nodes > maxNodes) return { depth, nodes, over: 'nodes' };
        for (const k of kids) if (k !== null && typeof k === 'object') stack.push([k, d + 1]);
    }
    return { depth, nodes, over: null };
}

function jsonDepthGuard(opts = {}) {
    const maxDepth = opts.maxDepth || 12, maxNodes = opts.maxNodes || 2000;
    return function jsonDepthGuardMw(req, res, next) {
        if (req.body && typeof req.body === 'object') {
            const m = measure(req.body, maxDepth, maxNodes);
            if (m.over) return res.status(400).json({ error: 'That request is too complicated.' });
        }
        next();
    };
}

module.exports = { requestSizeGuard, jsonDepthGuard, measure };
