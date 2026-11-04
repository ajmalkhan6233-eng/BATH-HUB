'use strict';
// Bad input that reaches Postgres (a date like 2026-02-30, text where a number goes, a huge id, a missing required column) used to come
// back as a 500 carrying Postgres's own wording. This middleware turns exactly those cases into a 400 with a plain message.
// It only rewrites a 500 whose error text is a Postgres INPUT error; real server faults (missing table or column, connection
// failures, bugs) stay 500. No route file is edited: it wraps res.json for every route mounted after it.
const PG_INPUT = /invalid input syntax for type|out of range for type|date\/time field value out of range|numeric field overflow|value too long for type|violates not-null constraint|invalid input value for enum|invalid byte sequence|invalid text representation/i;

function friendly(msg) {
    const col = /column "([^"]+)"/.exec(msg);
    if (/violates not-null constraint/i.test(msg)) return `${col ? col[1].replace(/_/g, ' ') : 'A required field'} is required.`;
    if (/date\/time|type date|type timestamp|type time\b/i.test(msg)) return 'A date in the request is not valid (use YYYY-MM-DD).';
    if (/type (integer|bigint|smallint)|out of range/i.test(msg) && !/numeric field overflow/i.test(msg)) return 'A number or id in the request is not valid or is too large.';
    if (/numeric/i.test(msg)) return 'An amount in the request is not a valid number, or it is too large.';
    if (/value too long/i.test(msg)) return 'A text value in the request is too long.';
    return 'Some of the input is not valid. Please check it and try again.';
}

function pgInputErrors(req, res, next) {
    const json = res.json.bind(res);
    res.json = function (body) {
        if (res.statusCode === 500 && body && typeof body === 'object' && typeof body.error === 'string' && PG_INPUT.test(body.error)) {
            res.status(400);
            body = { ...body, error: friendly(body.error) };
        }
        return json(body);
    };
    next();
}

module.exports = pgInputErrors;
module.exports.PG_INPUT = PG_INPUT;
module.exports.friendly = friendly;
