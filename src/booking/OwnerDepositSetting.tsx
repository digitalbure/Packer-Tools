import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import { AdminSettings, UserProfile } from '../types';
import { computeDeposit, normalizeDepositPolicy } from './depositPolicy';

interface Props {
  user: UserProfile;
  onUpdate: (u: UserProfile) => void;
  adminSettings: AdminSettings | null;
}

/** The owner's own deposit setting for their marketplace listings, shown on their profile. */
export default function OwnerDepositSetting({ user, onUpdate, adminSettings }: Props) {
  const policy = normalizeDepositPolicy(adminSettings?.moduleWidgetConfigs?.depositPolicy);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(String(user.marketplaceDepositAmount ?? policy.flatAmount ?? ''));

  if (policy.mode === 'off') {
    return (
      <div className="pt-8 border-t border-neutral-100">
        <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Rental deposits</h4>
        <p className="text-xs text-neutral-500 font-semibold mt-1">Deposits are turned off for this platform. Renters see no deposit for your listings.</p>
      </div>
    );
  }

  if (policy.mode !== 'owner_choice') {
    const sample = computeDeposit(policy, 100);
    return (
      <div className="pt-8 border-t border-neutral-100">
        <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Rental deposits</h4>
        <p className="text-xs text-neutral-500 font-semibold mt-1">
          {policy.mode === 'flat'
            ? `Set by Packer Tools: every rental carries a ${policy.flatAmount} deposit.`
            : `Set by Packer Tools: every rental carries a deposit equal to ${policy.percent}% of the daily rate (for example, ${sample} on a 100 rental).`}
        </p>
      </div>
    );
  }

  const save = async () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) { toast.error('Enter a deposit amount of 0 or more.'); return; }
    const clamped = computeDeposit(policy, 0, parsed);
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { marketplaceDepositAmount: clamped });
      onUpdate({ ...user, marketplaceDepositAmount: clamped });
      setDraft(String(clamped));
      toast.success('Deposit default saved.');
    } catch (err) {
      console.error(err);
      toast.error('The deposit default did not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-8 border-t border-neutral-100 space-y-3">
      <div>
        <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Rental deposits</h4>
        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">
          Shown to renters as a refundable deposit. You and the renter arrange it directly — Packer Tools does not collect or hold it.
          {(policy.minAmount > 0 || policy.maxAmount > 0) && (
            <> Allowed range: {policy.minAmount > 0 ? policy.minAmount : 0}{policy.maxAmount > 0 ? ` – ${policy.maxAmount}` : '+'}.</>
          )}
        </p>
      </div>
      <div className="flex gap-2 max-w-xs">
        <input
          type="number"
          min={0}
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary transition"
          placeholder="e.g. 100"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-neutral-900 hover:bg-black disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-xl transition"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <p className="text-[10px] text-neutral-400">You can still set a different deposit on any individual listing.</p>
    </div>
  );
}
