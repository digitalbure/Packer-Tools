import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface VisibleInventoryScope {
  uid?: string | null;
  email?: string | null;
  orgId?: string | null;
  /** Platform admin/owner (user.role, not an org-level role) — sees every inventory, matching the rule's isAdmin() clause. */
  isPlatformAdmin?: boolean;
}

/**
 * Real-time list of `inventories` docs a user can actually see: their own, ones they're a named
 * collaborator on (`collaboratorEmails`), and ones visible to their org (`visibility.orgIds`).
 * Platform admins get every inventory.
 *
 * This mirrors firestore.rules' scoped read rule for `inventories` exactly. Never listen to
 * `collection(db, 'inventories')` unscoped for a non-admin — the rule rejects it (Firestore can't
 * prove an unscoped query only returns documents the rule allows), and before the rule was scoped,
 * an unscoped listen meant downloading every customer's inventories to filter client-side.
 */
export function useVisibleInventories({ uid, email, orgId, isPlatformAdmin }: VisibleInventoryScope): any[] {
  const [inventories, setInventories] = useState<any[]>([]);

  useEffect(() => {
    if (!uid) {
      setInventories([]);
      return;
    }

    const unsubs: Array<() => void> = [];

    if (isPlatformAdmin) {
      unsubs.push(onSnapshot(collection(db, 'inventories'), (snap) => {
        setInventories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.error('useVisibleInventories: admin listen failed:', err)));
    } else {
      let owned: any[] = [];
      let shared: any[] = [];
      let orgVisible: any[] = [];
      const publish = () => {
        const merged = new Map<string, any>();
        [...owned, ...shared, ...orgVisible].forEach(inv => merged.set(inv.id, inv));
        setInventories(Array.from(merged.values()));
      };

      unsubs.push(onSnapshot(query(collection(db, 'inventories'), where('ownerId', '==', uid)), (snap) => {
        owned = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        publish();
      }, (err) => console.error('useVisibleInventories: owned listen failed:', err)));

      if (email) {
        unsubs.push(onSnapshot(query(collection(db, 'inventories'), where('collaboratorEmails', 'array-contains', email.toLowerCase())), (snap) => {
          shared = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          publish();
        }, (err) => console.error('useVisibleInventories: shared listen failed:', err)));
      }

      if (orgId) {
        unsubs.push(onSnapshot(query(collection(db, 'inventories'), where('visibility.orgIds', 'array-contains', orgId)), (snap) => {
          orgVisible = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          publish();
        }, (err) => console.error('useVisibleInventories: org listen failed:', err)));
      }
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [uid, email, orgId, isPlatformAdmin]);

  return inventories;
}
