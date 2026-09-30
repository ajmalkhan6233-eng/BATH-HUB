'use strict';
const express = require('express');
const request = require('supertest');
const { estimateTiles, pricePerSqm, parseSizeCm } = require('../../utils/tileMath');
const router = require('../../routes/tile_tools');

describe('tile estimate', () => {
  test('3 x 2.4 m room, 60x60 tiles, 10% wastage, 4 per box (rounds UP, never short)', () => {
    const r = estimateTiles({ room_length_m: 3, room_width_m: 2.4, tile_size_cm: '60x60', pieces_per_box: 4 });
    expect(r).toMatchObject({ room_area_m2: 7.2, pieces_without_wastage: 20, wastage_pct: 10, pieces_needed: 22, boxes_needed: 6, pieces_bought: 24, spare_pieces: 2, area_bought_m2: 8.64 });
  });

  test('awkward sizes round up: 10 m2 of 30x60', () => {
    const r = estimateTiles({ room_length_m: 5, room_width_m: 2, tile_size_cm: '30 x 60 cm' });
    expect(r.pieces_without_wastage).toBe(56);
    expect(r.pieces_needed).toBe(62);
    expect(r).not.toHaveProperty('boxes_needed');
  });

  test('wastage 0 is allowed and exact fits do not gain a spare piece', () => {
    expect(estimateTiles({ room_length_m: 3.6, room_width_m: 3.6, tile_size_cm: '60x60', wastage_pct: 0 }).pieces_needed).toBe(36);
  });

  test('bad input is refused with a clear message', () => {
    const bad = (o, re) => expect(() => estimateTiles({ room_length_m: 3, room_width_m: 2, tile_size_cm: '60x60', ...o })).toThrow(re);
    bad({ room_length_m: 0 }, /room_length_m/);
    bad({ room_width_m: -1 }, /room_width_m/);
    bad({ room_length_m: 'big' }, /room_length_m/);
    bad({ tile_size_cm: 'large' }, /tile_size_cm/);
    bad({ tile_size_cm: '0x60' }, /more than 0/);
    bad({ wastage_pct: 80 }, /wastage_pct/);
    bad({ pieces_per_box: 0 }, /pieces_per_box/);
    bad({ pieces_per_box: 2.5 }, /whole number/);
  });

  test('size parsing', () => {
    expect(parseSizeCm('60X120')).toEqual({ w: 60, h: 120 });
    expect(parseSizeCm(' 30 x 30 cm ')).toEqual({ w: 30, h: 30 });
  });
});

describe('price per square metre', () => {
  test('from a box price', () => {
    expect(pricePerSqm({ box_price: 12960, pieces_per_box: 6, tile_size_cm: '60x60' })).toEqual({ price_per_tile: 2160, price_per_m2: 6000, tile_area_m2: 0.36 });
  });
  test('from a single tile price', () => {
    expect(pricePerSqm({ tile_price: 900, tile_size_cm: '30x60' }).price_per_m2).toBe(5000);
  });
  test('bad input refused', () => {
    expect(() => pricePerSqm({ box_price: 1000, tile_size_cm: '60x60' })).toThrow(/pieces_per_box/);
    expect(() => pricePerSqm({ tile_size_cm: '60x60' })).toThrow(/tile_price or box_price/);
    expect(() => pricePerSqm({ box_price: -5, pieces_per_box: 4, tile_size_cm: '60x60' })).toThrow(/box_price/);
  });
});

describe('HTTP', () => {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  test('estimate and price endpoints answer; bad input is a 400, not a 500', async () => {
    const ok = await request(app).post('/api/tools/tile-estimate').send({ room_length_m: 3, room_width_m: 2.4, tile_size_cm: '60x60', pieces_per_box: 4 });
    expect(ok.status).toBe(200);
    expect(ok.body.boxes_needed).toBe(6);
    const bad = await request(app).post('/api/tools/tile-estimate').send({ room_length_m: 'x' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/room_length_m/);
    expect((await request(app).post('/api/tools/price-per-sqm').send({ box_price: 12960, pieces_per_box: 6, tile_size_cm: '60x60' })).body.price_per_m2).toBe(6000);
    expect((await request(app).post('/api/tools/price-per-sqm').send({})).status).toBe(400);
    expect((await request(app).post('/api/tools/tile-estimate')).status).toBe(400);   // no body at all
  });
});
