import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateRange, money, parseGuests, toCents } from '../src/pages/EventManagementPage/eventManagementUtils.js';

test('currency uses 100 cents per VND', () => {
  assert.equal(toCents('50000'), 5000000);
  assert.equal(toCents('0'), 0);
  assert.match(money(5000000), /50\.000/);
  for (const input of ['', '-1', 'invalid', 'Infinity', '999999999999999999']) assert.throws(() => toCents(input));
});
test('guest batches enforce syntax and 200-person limit', () => {
  assert.deepEqual(parseGuests(' An, an@example.com\n\n Bình, binh@example.com '), [{ name: 'An', email: 'an@example.com' }, { name: 'Bình', email: 'binh@example.com' }]);
  assert.equal(parseGuests(Array(200).fill('An, an@example.com').join('\n')).length, 200);
  for (const input of ['', 'An', 'An, bad', Array(201).fill('An, an@example.com').join('\n')]) assert.throws(() => parseGuests(input));
});
test('date ranges reject invalid, equal and reversed dates', () => {
  assert.deepEqual(dateRange('2027-01-01T00:00:00Z', '2027-01-02T00:00:00Z'), ['2027-01-01T00:00:00.000Z', '2027-01-02T00:00:00.000Z']);
  assert.throws(() => dateRange('', ''));
  assert.throws(() => dateRange('2027-01-01', '2027-01-01'));
  assert.throws(() => dateRange('2027-01-02', '2027-01-01'));
});
