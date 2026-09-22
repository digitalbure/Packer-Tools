import assert from 'node:assert/strict';
import { resolvePickupPoints, canManageOwnPoints, normalizeConfig } from '../src/booking/pickupPoints.ts';

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log('  ok', name); };
const plat = [{ id: 'p1', name: 'Platform depot', address: '1 Main St' }];
const own = [{ id: 'o1', name: 'My yard', address: '2 Side St' }, { id: 'o2', name: 'My shop', address: '3 Back St' }];

ok('defaults to platform mode with no invented points', () => {
  const r = resolvePickupPoints(undefined, own, true);
  assert.equal(r.points.length, 0);
  assert.equal(r.allowCustom, true);
});
ok('off hides the planner completely', () => assert.deepEqual(resolvePickupPoints({ mode: 'off', platformPoints: plat }, own, true), { enabled: false, points: [], allowCustom: false }));
ok('platform mode ignores owner points', () => {
  const r = resolvePickupPoints({ mode: 'platform', platformPoints: plat }, own, true);
  assert.deepEqual(r.points.map((p) => p.id), ['p1']);
});
ok('owners mode lists owner points first, then platform', () => {
  const r = resolvePickupPoints({ mode: 'owners', includePlatformPoints: true, platformPoints: plat }, own, true);
  assert.deepEqual(r.points.map((p) => p.id), ['o1', 'o2', 'p1']);
});
ok('owners mode without platform points', () => {
  const r = resolvePickupPoints({ mode: 'owners', includePlatformPoints: false, platformPoints: plat }, own, true);
  assert.deepEqual(r.points.map((p) => p.source), ['owner', 'owner']);
});
ok('owner whose plan lacks the feature falls back to platform points', () => {
  const r = resolvePickupPoints({ mode: 'owners', includePlatformPoints: true, platformPoints: plat }, own, false);
  assert.deepEqual(r.points.map((p) => p.id), ['p1']);
});
ok('owner cap is enforced', () => {
  const r = resolvePickupPoints({ mode: 'owners', includePlatformPoints: false, maxOwnerPoints: 1, platformPoints: [] }, own, true);
  assert.equal(r.points.length, 1);
});
ok('custom address off and no points disables the planner', () => assert.equal(resolvePickupPoints({ mode: 'platform', allowCustomAddress: false, platformPoints: [] }, [], true).enabled, false));
ok('bad mode is normalised', () => assert.equal(normalizeConfig({ mode: 'weird' as any }).mode, 'platform'));
ok('only owners mode with plan access can manage points', () => {
  assert.equal(canManageOwnPoints({ mode: 'owners' }, true), true);
  assert.equal(canManageOwnPoints({ mode: 'owners' }, false), false);
  assert.equal(canManageOwnPoints({ mode: 'platform' }, true), false);
  assert.equal(canManageOwnPoints({ mode: 'off' }, true), false);
});
console.log(`${n} checks passed`);
