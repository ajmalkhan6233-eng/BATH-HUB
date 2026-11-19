'use strict';
const { decide } = require('../scripts/pc/rbh_bridge_guard');
test('leaves a working bridge alone', () => expect(decide({ reachable: true, found: true, status: 'online' })).toBe('none'));
test('starts it when pm2 has lost it', () => expect(decide({ reachable: false, found: false })).toBe('start'));
test('waits when pm2 says online but not answering', () => expect(decide({ reachable: false, found: true, status: 'online' })).toBe('restart_wait'));
test('restarts a stopped one', () => expect(decide({ reachable: false, found: true, status: 'stopped' })).toBe('restart'));
