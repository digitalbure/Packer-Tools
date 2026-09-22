import assert from 'node:assert/strict';
import { computeDeposit, normalizeDepositPolicy, ownerSetsDeposit } from '../src/booking/depositPolicy.ts';

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log('  ok', name); };

ok('off is always zero, regardless of price or owner amount', () => {
  assert.equal(computeDeposit({ mode: 'off' }, 1000, 500), 0);
});
ok('flat ignores item price and owner amount', () => {
  assert.equal(computeDeposit({ mode: 'flat', flatAmount: 75 }, 5000, 999), 75);
});
ok('percent computes from item price', () => {
  assert.equal(computeDeposit({ mode: 'percent', percent: 20 }, 500), 100);
});
ok('percent rounds to cents', () => {
  assert.equal(computeDeposit({ mode: 'percent', percent: 33 }, 10), 3.3);
});
ok('percent with no price is zero', () => assert.equal(computeDeposit({ mode: 'percent', percent: 20 }, 0), 0));
ok('owner_choice uses the owner figure', () => {
  assert.equal(computeDeposit({ mode: 'owner_choice', flatAmount: 50 }, 1000, 200), 200);
});
ok('owner_choice falls back to the policy default when owner has not set one', () => {
  assert.equal(computeDeposit({ mode: 'owner_choice', flatAmount: 50 }, 1000, undefined), 50);
});
ok('min bound raises a low computed deposit', () => {
  assert.equal(computeDeposit({ mode: 'percent', percent: 5, minAmount: 50 }, 100), 50);
});
ok('max bound caps a high computed deposit', () => {
  assert.equal(computeDeposit({ mode: 'percent', percent: 50, maxAmount: 100 }, 1000), 100);
});
ok('max bound caps an owner-chosen amount even though the mode lets them choose', () => {
  assert.equal(computeDeposit({ mode: 'owner_choice', maxAmount: 200 }, 1000, 5000), 200);
});
ok('negative owner amount cannot go below zero', () => {
  assert.equal(computeDeposit({ mode: 'owner_choice' }, 1000, -50), 0);
});
ok('unknown mode normalises to percent', () => assert.equal(normalizeDepositPolicy({ mode: 'bogus' as any }).mode, 'percent'));
ok('ownerSetsDeposit true only for owner_choice', () => {
  assert.equal(ownerSetsDeposit({ mode: 'owner_choice' }), true);
  assert.equal(ownerSetsDeposit({ mode: 'flat' }), false);
  assert.equal(ownerSetsDeposit({ mode: 'off' }), false);
  assert.equal(ownerSetsDeposit(null), false);
});
console.log(`${n} checks passed`);
