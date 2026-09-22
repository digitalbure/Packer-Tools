import assert from 'node:assert/strict';
import { pickPublicFields } from '../src/marketplace/publicProfile.ts';

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log('  ok', name); };

ok('keeps only whitelisted storefront fields', () => {
  const out = pickPublicFields({
    storeName: 'Suva Camera Hire', email: 'owner@example.com', plan: 'pro', apiKey: 'secret123',
  } as any);
  assert.deepEqual(out, { storeName: 'Suva Camera Hire' });
});
ok('drops empty strings, null and undefined', () => {
  const out = pickPublicFields({ storeName: '', storeBio: undefined, location: null as any, displayName: 'Sina' });
  assert.deepEqual(out, { displayName: 'Sina' });
});
ok('never carries email, plan, role or api keys even if present', () => {
  const out = pickPublicFields({ email: 'x@y.com', plan: 'enterprise', role: 'admin', apiKey: 'k', isSuperAdmin: true } as any);
  assert.deepEqual(out, {});
});
ok('keeps every documented public field when present', () => {
  const input = {
    displayName: 'Sina', photoURL: 'https://x/p.jpg', storeName: 'S', storeBio: 'B', storeLogo: 'L',
    storeCoverImage: 'C', storeWebsite: 'W', storeEmail: 'e@x.com', storePhone: '+679', storeTwitter: 't',
    storeInstagram: 'i', storeLinkedin: 'l', storeFacebook: 'f', location: 'Suva', createdAt: '2026-01-01T00:00:00.000Z',
  };
  assert.deepEqual(pickPublicFields(input), input);
});
console.log(`${n} checks passed`);
