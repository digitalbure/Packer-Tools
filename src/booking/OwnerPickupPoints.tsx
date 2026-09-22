import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { isFeatureEnabled } from '../lib/featureUtils';
import { AdminSettings, UserProfile } from '../types';
import { canManageOwnPoints, normalizeConfig, PickupPoint } from './pickupPoints';

interface Props { user: UserProfile; adminSettings: AdminSettings | null }

const input = 'w-full p-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-semibold outline-none';

/** Lets an owner save their own pickup and return points, when the admin rules and their plan allow it. */
export default function OwnerPickupPoints({ user, adminSettings }: Props) {
  const cfg = normalizeConfig(adminSettings?.moduleWidgetConfigs?.pickupPoints);
  const planOk = isFeatureEnabled('pickupPoints', user, adminSettings);
  const canManage = canManageOwnPoints(cfg, planOk);
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!canManage) return;
    return onSnapshot(collection(db, 'users', user.uid, 'pickupPoints'),
      (snap) => setPoints(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PickupPoint, 'id'>) }))),
      () => toast.error('Could not load your pickup points.'));
  }, [canManage, user.uid]);

  if (cfg.mode === 'off') return null;
  if (cfg.mode === 'platform') {
    return <p className="text-[11px] text-neutral-500">Pickup and return points are set by the platform. Renters choose from those.</p>;
  }
  if (!planOk) {
    return <p className="text-[11px] text-neutral-500">Saving your own pickup points is not included in your current plan. Renters see the platform's points{cfg.includePlatformPoints ? '' : ' only when the platform lists any'}.</p>;
  }

  const full = points.length >= cfg.maxOwnerPoints;
  const add = async () => {
    if (!name.trim() || !address.trim()) { toast.error('Enter a name and an address.'); return; }
    try {
      await addDoc(collection(db, 'users', user.uid, 'pickupPoints'), { name: name.trim(), address: address.trim() });
      setName(''); setAddress('');
    } catch { toast.error('The point did not save. Try again.'); }
  };
  const rename = (id: string, patch: Partial<PickupPoint>) => updateDoc(doc(db, 'users', user.uid, 'pickupPoints', id), patch).catch(() => toast.error('The change did not save.'));
  const remove = (id: string) => deleteDoc(doc(db, 'users', user.uid, 'pickupPoints', id)).catch(() => toast.error('The point was not removed.'));

  return (
    <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-4 text-left">
      <div>
        <h4 className="font-extrabold text-neutral-900">Your pickup and return points</h4>
        <p className="text-[11px] text-neutral-400 mt-0.5">Renters choose from these when they request a booking. {points.length} of {cfg.maxOwnerPoints} saved.</p>
      </div>
      {points.map((p) => (
        <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
          <input aria-label="Point name" className={input} defaultValue={p.name} onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && rename(p.id, { name: e.target.value.trim() })} />
          <input aria-label="Point address" className={input} defaultValue={p.address} onBlur={(e) => e.target.value.trim() && e.target.value !== p.address && rename(p.id, { address: e.target.value.trim() })} />
          <button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
        </div>
      ))}
      {!full && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
          <input aria-label="New point name" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, for example Main yard" />
          <input aria-label="New point address" className={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address, city" />
          <button type="button" onClick={add} className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-bold">Add point</button>
        </div>
      )}
      {full && <p className="text-[11px] text-neutral-500">You have reached the limit. Remove a point to add another.</p>}
    </div>
  );
}
