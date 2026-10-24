'use strict';
// CASHIER ROLE (AJ 24 Oct 2026): a staff login that can only sell. No cost, no profit, no stock-in, no reports, no void/edit of bills.
// Allow-list: anything not listed is refused (403). The POS item picker (/api/items) already returns selling price and stock only, never the cost.
const ALLOW = [
  ['GET', /^\/api\/me$/], ['POST', /^\/api\/logout$/],
  ['GET', /^\/api\/items(\?|$)/], ['GET', /^\/api\/branding$/],
  ['POST', /^\/api\/pos-bills$/], ['GET', /^\/api\/pos-bills(\/today|\/discount-cap)?$/], ['GET', /^\/api\/pos-bills\/\d+(\/pdf)?$/],
  ['GET', /^\/api\/discount-rules$/], ['GET', /^\/api\/customers$/],
  ['POST', /^\/api\/invoice-receipts\/send$/], ['GET', /^\/api\/invoice-receipts\/check-number$/],
  ['GET', /^\/api\/quotations(\/\d+)?$/], ['POST', /^\/api\/quotations$/], ['GET', /^\/api\/pos-ledger\/quotation-billed$/],
];
function allowed(method, path) { const m = String(method).toUpperCase(); return ALLOW.some(([mm, re]) => (mm === m || (mm === 'GET' && m === 'HEAD')) && re.test(path)); }
// Belt and braces: if any response still carries a cost-like field, remove it for a cashier.
const COSTY = /^(avg_cost|cost|cost_price|unit_cost|buying_price|profit|gross_profit|margin|margin_pct|cogs)$/i;
function strip(v) { if (Array.isArray(v)) return v.map(strip); if (v && typeof v === 'object' && !(v instanceof Date)) { const o = {}; for (const k of Object.keys(v)) if (!COSTY.test(k)) o[k] = strip(v[k]); return o; } return v; }
const weakPin = p => !/^\d{4,8}$/.test(p) || /^(\d)\1+$/.test(p) || ['1234', '12345', '123456', '4321', '0123', '1111', '000000'].includes(p);
module.exports = { allowed, strip, weakPin, ALLOW };
