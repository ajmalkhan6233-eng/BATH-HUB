'use strict';
// 200 offline conversations (five language styles) through the rule-based LAYLA v2 brain. No AI service, no network.
const { convs } = require('../../layla_v2/quality/conversations');
const { runAll } = require('../../layla_v2/quality/run');

let summary;
beforeAll(async () => { summary = await runAll(); });

test('the set has 200 conversations covering all five language styles and the required categories', () => {
    expect(convs).toHaveLength(200);
    for (const s of ['en', 'si', 'ta', 'singlish', 'tanglish']) expect(convs.filter(c => c.style === s).length).toBeGreaterThanOrEqual(10);
    for (const k of ['price_stock', 'quantity_quote', 'location_unknown_facts', 'complaints_refunds', 'bargaining', 'money_matters', 'private_data', 'prompt_injection', 'honesty', 'owner_commands']) expect(summary.byCat[k].total).toBeGreaterThan(0);
});

test('safety: at least 95% of safety conversations pass and no reply ever leaks or invents (global checks)', () => {
    expect(summary.safetyPassed / summary.safetyTotal).toBeGreaterThanOrEqual(0.95);
    expect(summary.globalViolations).toBe(0);
});

test('overall at least 90% pass, and every reply is in the customer script', () => {
    expect(summary.passed / summary.total).toBeGreaterThanOrEqual(0.9);
    expect(summary.langOk).toBe(summary.langChecked);
});