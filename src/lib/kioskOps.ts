import {
  collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, where,
  type CollectionReference, type DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { GearItem } from '../types';

/**
 * Shared kiosk item operations (Phase 0).
 *  - one scan lookup instead of three hand-copied ones,
 *  - check-out / check-in as Firestore transactions (item status + checkout record change together,
 *    and an item that is already out cannot be checked out twice).
 * Offline queueing stays in the caller; these are the online paths.
 */

export type ItemSource =
  | { kind: 'library'; ownerUid: string }
  | { kind: 'inventory'; ownerUid: string; inventoryId: string };

export const itemsCollection = (src: ItemSource): CollectionReference =>
  src.kind === 'inventory'
    ? collection(db, 'inventories', src.inventoryId, 'items')
    : collection(db, 'users', src.ownerUid, 'gearLibrary');

export const itemRef = (src: ItemSource, itemId: string): DocumentReference =>
  doc(itemsCollection(src), itemId);

/** Extracts the id / tag when a QR code holds a full /gear/<id> URL. */
export function parseScannedValue(raw: string): string {
  const value = raw.trim();
  if (!value.includes('/gear/')) return value;
  try {
    const parts = new URL(value).pathname.split('/');
    const idx = parts.indexOf('gear');
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    const tail = value.split('/gear/')[1];
    if (tail) return tail.split('?')[0];
  }
  return value;
}

function shapeItem(id: string, data: any, src: ItemSource): GearItem {
  if (src.kind === 'inventory') {
    // Custom-inventory rows are looser than gear-library rows: normalise the fields the kiosk needs.
    return {
      id,
      name: data.name,
      brand: data.brand || '',
      model: data.model || '',
      category: data.category || 'Gear',
      assetTag: data.assetTag || data.id || id,
      status: data.status || 'available',
      condition: data.condition || 'good',
      isSale: data.isSale || false,
      price: data.price || 0,
      quantity: data.quantity || 1,
    } as unknown as GearItem;
  }
  return { id, ...data } as GearItem;
}

/**
 * Resolves a scanned/typed value to an item: direct document id first, otherwise a single
 * `assetTag in [...]` query covering the decoded, raw and upper-cased forms (was up to 4 sequential queries).
 */
export async function findItem(src: ItemSource, scannedValue: string): Promise<GearItem | null> {
  const decoded = parseScannedValue(scannedValue);
  if (!decoded || decoded.includes('/')) return null;
  const col = itemsCollection(src);

  const candidates = Array.from(new Set([decoded, scannedValue.trim(), decoded.toUpperCase()])).filter(Boolean);
  const [direct, byTag] = await Promise.all([
    getDoc(doc(col, decoded)),
    getDocs(query(col, where('assetTag', 'in', candidates), limit(1))),
  ]);
  if (direct.exists()) return shapeItem(direct.id, direct.data(), src);
  if (!byTag.empty) return shapeItem(byTag.docs[0].id, byTag.docs[0].data(), src);
  return null;
}

export class ItemConflictError extends Error {
  constructor(public reason: 'missing' | 'already_out', public holder?: string) {
    super(reason === 'missing' ? 'Item no longer exists.' : `Already checked out${holder ? ` to ${holder}` : ''}.`);
  }
}

interface Actor { ownerUid: string; name: string; email?: string; terminalId?: string | null }

/** Atomically marks the item (and kit children) in use and records the checkout. Returns the checkout id. */
export async function checkOutItem(
  src: ItemSource,
  item: Pick<GearItem, 'id' | 'name' | 'isKit' | 'childItemIds'>,
  actor: Actor,
  extra: { signature?: string | null; notes?: string } = {},
): Promise<string> {
  const ref = itemRef(src, item.id);
  const checkoutRef = doc(collection(db, 'checkouts'));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new ItemConflictError('missing');
    const cur = snap.data();
    if (cur.status === 'in_use') throw new ItemConflictError('already_out', cur.currentHolder);

    tx.update(ref, { status: 'in_use', currentHolder: actor.name, lastCheckedOut: serverTimestamp() });
    if (item.isKit && item.childItemIds?.length) {
      for (const childId of item.childItemIds) {
        tx.update(itemRef(src, childId), { status: 'in_use', currentHolder: actor.name, lastCheckedOut: serverTimestamp(), kitId: item.id });
      }
    }
    tx.set(checkoutRef, {
      assetId: item.id,
      assetName: item.name,
      assetType: 'item',
      ownerId: actor.ownerUid,
      userId: actor.ownerUid,
      userName: actor.name,
      userEmail: actor.email || '',
      terminalId: actor.terminalId || null,
      checkOutTime: serverTimestamp(),
      status: 'active',
      signature: extra.signature || null,
      notes: extra.notes || '',
    });
  });
  return checkoutRef.id;
}

/**
 * Atomically returns the item (and kit children) and closes its open checkout record(s).
 * Records written by older kiosk paths used status 'checked_out'; both are closed.
 */
export async function checkInItem(
  src: ItemSource,
  item: Pick<GearItem, 'id' | 'name' | 'isKit' | 'childItemIds' | 'currentHolder'>,
  actor: Actor,
  extra: { notes?: string } = {},
): Promise<{ wasOut: boolean }> {
  const ref = itemRef(src, item.id);
  // Queries are not allowed inside client transactions, so find open records first, then close them in the tx.
  const open = await getDocs(query(
    collection(db, 'checkouts'),
    where('assetId', '==', item.id),
    where('status', 'in', ['active', 'checked_out']),
  ));
  const newRecordRef = doc(collection(db, 'checkouts'));

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new ItemConflictError('missing');
    const wasOut = snap.data().status === 'in_use';

    tx.update(ref, { status: 'available', currentHolder: null, lastCheckedIn: serverTimestamp() });
    if (item.isKit && item.childItemIds?.length) {
      for (const childId of item.childItemIds) {
        tx.update(itemRef(src, childId), { status: 'available', currentHolder: null, lastCheckedIn: serverTimestamp(), kitId: null });
      }
    }
    if (open.empty) {
      tx.set(newRecordRef, {
        assetId: item.id, assetName: item.name, assetType: 'item',
        ownerId: actor.ownerUid, userId: actor.ownerUid,
        userName: item.currentHolder || actor.name || 'Assigned Holder', userEmail: actor.email || '',
        terminalId: actor.terminalId || null,
        checkInTime: serverTimestamp(), status: 'returned', notes: extra.notes || '',
      });
    } else {
      open.docs.forEach(d => tx.update(d.ref, { status: 'returned', checkInTime: serverTimestamp() }));
    }
    return { wasOut };
  });
}
