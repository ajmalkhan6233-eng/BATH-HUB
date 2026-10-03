'use strict';
const { calcTiles, parseTileSize, parseRoomSize } = require('../../layla_v2/quote');

describe('LAYLA v2 quote maths (same as the website calculator)', () => {
    test('parseTileSize: inches by default, other units converted', () => {
        expect(parseTileSize('24 x 24 in')).toEqual([24, 24]);
        expect(parseTileSize('24x12')).toEqual([24, 12]);
        expect(parseTileSize('2 x 2 ft')).toEqual([24, 24]);
        expect(parseTileSize('60 x 60 cm')[0]).toBeCloseTo(23.62, 1);
        expect(parseTileSize('nonsense')).toBeNull();
        expect(parseTileSize('0 x 0 in')).toBeNull();
    });

    test('10 x 12 ft room, 24x24 in tile, 10% waste: 120 sq ft -> 132/4 = 33 tiles', () => {
        const r = calcTiles({ length: 10, width: 12, unit: 'ft', tileSize: '24 x 24 in' });
        expect(r).toMatchObject({ ok: true, sqft: 120, wastePct: 10, tiles: 33, tileSqft: 4 });
    });

    test('floating point guard: exactly 220 tiles must not become 221', () => {
        const r = calcTiles({ length: 20, width: 40, unit: 'ft', tileSize: '24 x 24 in', wastePct: 10 });
        expect(r.tiles).toBe(220);
    });

    test('metres are converted to sq ft', () => {
        const r = calcTiles({ length: 3, width: 4, unit: 'm', tileSize: '12 x 12 in', wastePct: 0 });
        expect(r.sqft).toBeCloseTo(129.2, 1);
        expect(r.tiles).toBe(Math.ceil(12 * 10.7639 / 1));
    });

    test('rounds up and respects waste', () => {
        expect(calcTiles({ length: 5, width: 5, tileSize: '12 x 12 in', wastePct: 5 }).tiles).toBe(Math.ceil(25 * 1.05));
    });

    test('bad input never gives a number', () => {
        expect(calcTiles({ length: 0, width: 5, tileSize: '12 x 12 in' }).ok).toBe(false);
        expect(calcTiles({ length: 'abc', width: 5 }).ok).toBe(false);
        expect(calcTiles({ length: 1000, width: 5 }).ok).toBe(false);
        expect(calcTiles({ length: 5, width: 5, wastePct: 90, tileSize: '12 x 12 in' }).ok).toBe(false);
        const noSize = calcTiles({ length: 5, width: 5 });
        expect(noSize.ok).toBe(true);
        expect(noSize.tiles).toBeNull();
    });

    test('parseRoomSize finds the room, ignores the tile size', () => {
        expect(parseRoomSize('my room is 10 x 12 ft')).toEqual({ length: 10, width: 12, unit: 'ft' });
        expect(parseRoomSize('10 by 12')).toEqual({ length: 10, width: 12, unit: 'ft' });
        expect(parseRoomSize('3m x 4m room')).toEqual({ length: 3, width: 4, unit: 'm' });
        expect(parseRoomSize('tile 24 x 24 in for 8x10 bathroom')).toEqual({ length: 8, width: 10, unit: 'ft' });
        expect(parseRoomSize('24 x 24 in tile')).toBeNull();
        expect(parseRoomSize('hello')).toBeNull();
    });
});