const { setFlag } = require('../scripts/pc/set_env_flag');
test('changes an existing flag only', () => { expect(setFlag('A=1\nPOS_DEDUCT_STOCK=false\nB=2\n', 'POS_DEDUCT_STOCK', 'true')).toBe('A=1\nPOS_DEDUCT_STOCK=true\nB=2\n'); });
test('adds a missing flag', () => { expect(setFlag('A=1\n', 'POS_DEDUCT_STOCK', 'true')).toBe('A=1\nPOS_DEDUCT_STOCK=true\n'); });
