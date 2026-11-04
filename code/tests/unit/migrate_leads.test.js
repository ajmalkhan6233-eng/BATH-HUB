'use strict';
const { SQL } = require('../../scripts/migrate_leads');

describe('leads migration', () => {
  test('creates only the leads table, safe to run twice', () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS leads/);
    expect(SQL).not.toMatch(/\bALTER\b|\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i);
  });
  test('has every column the app reads or writes', () => {
    for (const c of ['customer_id', 'source', 'status', 'notes', 'created_at', 'updated_at']) {
      expect(SQL).toMatch(new RegExp('\\b' + c + '\\b'));
    }
  });
  test('only references the existing customers table', () => {
    expect(SQL.match(/REFERENCES (\w+)/g)).toEqual(['REFERENCES customers']);
  });
});
