'use strict';
jest.mock('pg', () => require('../helpers/pgmock')());
const { Pool } = require('pg');
const { matchItems, createPgCatalog, createMemoryCatalog, fmtRs } = require('../../layla_v2/catalog');
const { createStubDocuments, createSimulatedDocuments } = require('../../layla_v2/documents_adapter');

const products = [
    { id: 1, item_code: '001', name: 'Marble White 24 x 24 in', category: 'tiles', stock_level: 40, selling_price: 1850, active: true, avg_cost: 1200 },
    { id: 2, item_code: '002', name: 'Wood Oak 6 x 24 in', category: 'tiles', stock_level: 0, selling_price: 950, active: true },
    { id: 3, item_code: '003', name: 'Old Retired Tile 12 x 12 in', category: 'tiles', stock_level: 5, selling_price: 500, active: false },
    { id: 4, item_code: '004', name: 'Basin Round White', category: 'sanitaryware', stock_level: 3, selling_price: 12500, active: true },
];
const tiles = [
    { id: 1, name: 'Marble White 24 x 24 in', size: '24 x 24 in', finish: 'glossy', visible: true },
    { id: 2, name: 'Slate Grey', size: '12 x 24 in', finish: 'matt', visible: true },
    { id: 3, name: 'Hidden Pattern', size: '12 x 12 in', finish: 'matt', visible: false },
];

describe('LAYLA v2 catalog matching', () => {
    test('finds a product by name words, with DB price and stock only', () => {
        const r = matchItems({ products, tiles }, 'price of marble white tile');
        expect(r.items[0]).toMatchObject({ name: 'Marble White 24 x 24 in', price: 1850, inStock: true, size: '24x24', finish: 'glossy' });
        expect(r.items[0]).not.toHaveProperty('avg_cost');
        expect(JSON.stringify(r)).not.toContain('1200');          // cost price never leaves the catalogue
        expect(JSON.stringify(r)).not.toContain('"stock_level"'); // exact stock number is never exposed
    });
    test('inactive products and hidden site tiles are not offered', () => {
        expect(matchItems({ products, tiles }, 'old retired tile').items).toHaveLength(0);
        expect(matchItems({ products, tiles }, 'hidden pattern').items).toHaveLength(0);
    });
    test('website-only tile has no price and unknown stock (so LAYLA must say "let me check")', () => {
        const it = matchItems({ products, tiles }, 'slate grey').items[0];
        expect(it).toMatchObject({ name: 'Slate Grey', price: null, inStock: null, size: '12x24', source: 'site_tiles' });
    });
    test('out of stock is reported as false', () => {
        expect(matchItems({ products, tiles }, 'oak wood tile').items[0].inStock).toBe(false);
    });
    test('size alone matches by size; generic words alone match nothing', () => {
        const r = matchItems({ products, tiles }, 'do you have 24x24 tiles');
        expect(r.sizeAsked).toBe('24x24');
        expect(r.items[0].name).toContain('Marble White');
        expect(matchItems({ products, tiles }, 'tile price please').items).toHaveLength(0);
        expect(matchItems({ products, tiles }, 'hello').items).toHaveLength(0);
    });
    test('size written as "24 x 24" or "24*24" also works', () => {
        expect(matchItems({ products, tiles }, '24 x 24 size').sizeAsked).toBe('24x24');
        expect(matchItems({ products, tiles }, '24*24').sizeAsked).toBe('24x24');
    });
    test('fmtRs gives Rs with thousands separators', () => {
        expect(fmtRs(1850)).toBe('Rs 1,850');
        expect(fmtRs(12500.5)).toBe('Rs 12,500.5');
    });
});

describe('LAYLA v2 catalog on the database (pg-mem)', () => {
    test('reads products, site_tiles, address and the discount cap; a missing table gives no facts, not an error', async () => {
        const db = require('pg').__db;
        const pool = new Pool();
        const empty = createPgCatalog(pool);
        expect((await empty.search('marble')).items).toEqual([]);   // tables do not exist yet
        expect(await empty.address()).toBeNull();
        expect(await empty.discountCap()).toBeNull();
        db.public.none(`CREATE TABLE products (id serial primary key, item_code text, name text, category text, stock_level numeric, selling_price numeric, avg_cost numeric, active boolean)`);
        db.public.none(`CREATE TABLE site_tiles (id serial primary key, name text, size text, finish text, visible boolean)`);
        db.public.none(`CREATE TABLE site_text (key text primary key, value text)`);
        db.public.none(`CREATE TABLE discount_rules (id serial primary key, role text, max_discount_pct numeric, active boolean)`);
        db.public.none(`INSERT INTO products (item_code, name, category, stock_level, selling_price, avg_cost, active) VALUES ('001','Marble White 24 x 24 in','tiles',40,1850,1200,true),('002','Gone','tiles',1,10,5,false)`);
        db.public.none(`INSERT INTO site_tiles (name, size, finish, visible) VALUES ('Slate Grey','12 x 24 in','matt',true),('Secret','1 x 1 in','matt',false)`);
        db.public.none(`INSERT INTO site_text VALUES ('address','12 Galle Road, Colombo')`);
        db.public.none(`INSERT INTO discount_rules (role, max_discount_pct, active) VALUES ('all', 5, true),('cashier', 2, true)`);
        const cat = createPgCatalog(pool);
        expect((await cat.search('marble white')).items[0].price).toBe(1850);
        expect((await cat.search('slate')).items[0].name).toBe('Slate Grey');
        expect((await cat.search('gone')).items).toHaveLength(0);
        expect((await cat.search('secret')).items).toHaveLength(0);
        expect(await cat.address()).toBe('12 Galle Road, Colombo');
        expect(await cat.discountCap()).toBe(5);
    });
    test('memory catalog has the same interface', async () => {
        const c = createMemoryCatalog({ products, tiles, address: 'A', discountCap: 3 });
        expect((await c.search('marble')).items.length).toBe(1);
        expect(await c.address()).toBe('A');
        expect(await c.discountCap()).toBe(3);
    });
});

describe('LAYLA v2 documents adapter', () => {
    test('stub answers not_wired', async () => {
        expect(await createStubDocuments().getDocument({ type: 'quotation', ref: '12' })).toEqual({ ok: false, reason: 'not_wired' });
    });
    test('simulated adapter returns files, not_found, unsupported', async () => {
        const d = createSimulatedDocuments();
        const ok = await d.getDocument({ type: 'quotation', ref: '12' });
        expect(ok).toMatchObject({ ok: true, filename: 'quotation-12.pdf', mime: 'application/pdf' });
        expect(Buffer.isBuffer(ok.buffer)).toBe(true);
        expect(await d.getDocument({ type: 'quotation', ref: '999' })).toEqual({ ok: false, reason: 'not_found' });
        expect(await d.getDocument({ type: 'payroll' })).toEqual({ ok: false, reason: 'unsupported' });
        expect((await d.getDocument({ type: 'daily_report' })).ok).toBe(true);
    });
});