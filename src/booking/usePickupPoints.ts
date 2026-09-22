import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../providers/AuthProvider';
import { PickupPoint, ResolvedPickup, resolvePickupPoints } from './pickupPoints';

/** Points a renter can choose for one owner's listing, following the admin's pickup point rules. */
export function usePickupPoints(ownerId?: string): ResolvedPickup {
  const { adminSettings } = useAuth();
  const config = adminSettings?.moduleWidgetConfigs?.pickupPoints;
  const [ownerPoints, setOwnerPoints] = useState<PickupPoint[]>([]);
  const wantsOwnerPoints = config?.mode === 'owners';

  useEffect(() => {
    if (!wantsOwnerPoints || !ownerId) { setOwnerPoints([]); return; }
    let live = true;
    getDocs(collection(db, 'users', ownerId, 'pickupPoints'))
      .then((snap) => { if (live) setOwnerPoints(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PickupPoint, 'id'>) }))); })
      .catch(() => { if (live) setOwnerPoints([]); });
    return () => { live = false; };
  }, [wantsOwnerPoints, ownerId]);

  return useMemo(() => resolvePickupPoints(config, ownerPoints, true), [config, ownerPoints]);
}
