import assert from 'node:assert/strict';
import { countDays, checkDates, quote } from '../src/booking/pricing.ts';

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log('  ok', name); };

ok('same day is one day', () => assert.equal(countDays('2026-10-01', '2026-10-01'), 1));
ok('inclusive range', () => assert.equal(countDays('2026-10-01', '2026-10-04'), 4));
ok('crosses month end', () => assert.equal(countDays('2026-10-30', '2026-11-02'), 4));
ok('reversed range is zero', () => assert.equal(countDays('2026-10-04', '2026-10-01'), 0));
ok('bad input is zero', () => assert.equal(countDays('', '2026-10-01'), 0));
ok('missing dates', () => assert.equal(checkDates('', '', '2026-10-01'), 'missing'));
ok('end before start', () => assert.equal(checkDates('2026-10-05', '2026-10-01', '2026-10-01'), 'order'));
ok('start in the past', () => assert.equal(checkDates('2026-09-30', '2026-10-02', '2026-10-01'), 'past'));
ok('today is allowed', () => assert.equal(checkDates('2026-10-01', '2026-10-02', '2026-10-01'), null));
ok('quote totals rental plus deposit', () => {
  const q = quote({ dailyRate: 45, deposit: 100 }, '2026-10-01', '2026-10-03');
  assert.deepEqual(q, { days: 3, rental: 135, deposit: 100, total: 235 });
});
ok('no rate set gives no price, never a default', () => {
  const q = quote({ deposit: 50 }, '2026-10-01', '2026-10-03');
  assert.equal(q.rental, null);
  assert.equal(q.total, null);
  assert.equal(q.deposit, 50);
});
ok('zero rate treated as not set', () => assert.equal(quote({ dailyRate: 0 }, '2026-10-01', '2026-10-02').rental, null));
ok('cents rounding', () => assert.equal(quote({ dailyRate: 33.33 }, '2026-10-01', '2026-10-03').rental, 99.99));
console.log(`${n} checks passed`);
