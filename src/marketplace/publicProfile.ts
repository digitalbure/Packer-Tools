import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

/**
 * The storefront fields a seller has chosen to make public, kept in their own
 * `publicProfiles/{uid}` document. `users/{uid}` holds the full account (email, plan,
 * role, API keys) and is owner/admin-only — public storefront pages (the shopfront and
 * a listing's seller card) must never read it directly. This is the only public surface.
 */
export interface PublicProfile {
  displayName?: string;
  photoURL?: string;
  storeName?: string;
  storeBio?: string;
  storeLogo?: string;
  storeCoverImage?: string;
  storeWebsite?: string;
  storeEmail?: string;
  storePhone?: string;
  storeTwitter?: string;
  storeInstagram?: string;
  storeLinkedin?: string;
  storeFacebook?: string;
  location?: string;
  createdAt?: string;
}

const PUBLIC_FIELDS: (keyof PublicProfile)[] = [
  'displayName', 'photoURL', 'storeName', 'storeBio', 'storeLogo', 'storeCoverImage',
  'storeWebsite', 'storeEmail', 'storePhone', 'storeTwitter', 'storeInstagram',
  'storeLinkedin', 'storeFacebook', 'location', 'createdAt',
];

export function pickPublicFields(user: Partial<UserProfile>): PublicProfile {
  const out: PublicProfile = {};
  for (const key of PUBLIC_FIELDS) {
    const value = (user as any)[key];
    if (value !== undefined && value !== null && value !== '') {
      (out as any)[key] = value;
    }
  }
  return out;
}

/** Call after saving any storefront field (store*, displayName, photoURL) so the public copy stays current. */
export async function syncPublicProfile(uid: string, user: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, 'publicProfiles', uid), pickPublicFields(user), { merge: false });
}

/** One-time backfill for accounts that had a storefront before this collection existed. */
export async function backfillPublicProfileIfMissing(uid: string, user: Partial<UserProfile>): Promise<void> {
  try {
    const existing = await getDoc(doc(db, 'publicProfiles', uid));
    if (!existing.exists()) {
      await syncPublicProfile(uid, user);
    }
  } catch (err) {
    console.warn('Could not backfill public profile:', err);
  }
}
