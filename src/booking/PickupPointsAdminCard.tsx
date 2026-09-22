import { Plus, Trash2 } from 'lucide-react';
import { AdminSettings } from '../types';
import { normalizeConfig, PickupMode, PickupPoint } from './pickupPoints';

interface Props {
  settings: AdminSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettings | null>>;
}

const MODES: { id: PickupMode; label: string; help: string }[] = [
  { id: 'platform', label: 'Platform points only', help: 'Renters choose from the points listed below. Owners cannot add their own.' },
  { id: 'owners', label: 'Owners manage their own', help: 'Owners on a plan with Own Pickup Points save their own. Others see platform points.' },
  { id: 'off', label: 'Off', help: 'No pickup planner. The owner arranges pickup and return with the renter.' },
];

const input = 'w-full p-2 bg-white border border-neutral-200 rounded-lg text-xs font-semibold outline-none';

export function PickupPointsAdminCard({ settings, setSettings }: Props) {
  const cfg = normalizeConfig(settings?.moduleWidgetConfigs?.pickupPoints);
  const plansWith = (settings?.plans || []).filter((p) => p.features?.includes('pickupPoints')).map((p) => p.name || p.id);

  const update = (patch: Partial<typeof cfg>) =>
    setSettings((s) => {
      if (!s) return null;
      const confs = s.moduleWidgetConfigs || {};
      return { ...s, moduleWidgetConfigs: { ...confs, pickupPoints: { ...normalizeConfig(confs.pickupPoints), ...patch } } };
    });

  const setPoint = (id: string, patch: Partial<PickupPoint>) => update({ platformPoints: cfg.platformPoints.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const addPoint = () => update({ platformPoints: [...cfg.platformPoints, { id: `pt_${Date.now().toString(36)}`, name: 'New point', address: '' }] });
  const removePoint = (id: string) => update({ platformPoints: cfg.platformPoints.filter((p) => p.id !== id) });

  return (
    <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-4 sm:col-span-2">
      <div className="border-b border-neutral-200/50 pb-2">
        <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider block font-mono">Pickup and return points</span>
        <p className="text-[11px] text-neutral-500 mt-1">Controls the pickup planner in booking requests. Plan access is set per plan under Plans, with the feature Own Pickup Points.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Who manages points</legend>
        {MODES.map((m) => (
          <label key={m.id} className="flex items-start gap-2 p-2 bg-white border border-neutral-200 rounded-xl cursor-pointer">
            <input type="radio" name="pickup-mode" className="mt-1" checked={cfg.mode === m.id} onChange={() => update({ mode: m.id })} />
            <span>
              <span className="text-xs font-bold text-neutral-800 block">{m.label}</span>
              <span className="text-[11px] text-neutral-500 block">{m.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {cfg.mode === 'owners' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white border border-neutral-200 rounded-xl p-3 space-y-1">
            <span className="text-xs font-bold text-neutral-800 block">Plans with own points</span>
            <span className="text-[11px] text-neutral-500 block">{plansWith.length ? plansWith.join(', ') : 'No plan includes it yet. Turn on Own Pickup Points in a plan.'}</span>
          </div>
          <label className="bg-white border border-neutral-200 rounded-xl p-3 space-y-1 block">
            <span className="text-xs font-bold text-neutral-800 block">Points per owner</span>
            <input type="number" min={1} max={50} className={input} value={cfg.maxOwnerPoints} onChange={(e) => update({ maxOwnerPoints: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl p-3 cursor-pointer sm:col-span-2">
            <input type="checkbox" checked={cfg.includePlatformPoints} onChange={(e) => update({ includePlatformPoints: e.target.checked })} />
            <span className="text-xs font-bold text-neutral-800">Also offer the platform points below</span>
          </label>
        </div>
      )}

      {cfg.mode !== 'off' && (
        <label className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl p-3 cursor-pointer">
          <input type="checkbox" checked={cfg.allowCustomAddress} onChange={(e) => update({ allowCustomAddress: e.target.checked })} />
          <span className="text-xs font-bold text-neutral-800">Let renters enter their own address</span>
        </label>
      )}

      {cfg.mode !== 'off' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Platform points ({cfg.platformPoints.length})</span>
            <button type="button" onClick={addPoint} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-neutral-900 text-white rounded-lg"><Plus size={14} /> Add point</button>
          </div>
          {cfg.platformPoints.length === 0 && <p className="text-[11px] text-neutral-500">No platform points yet. Renters see only the fields your settings allow.</p>}
          {cfg.platformPoints.map((p) => (
            <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2 items-center bg-white border border-neutral-200 rounded-xl p-2">
              <input aria-label="Point name" className={input} value={p.name} onChange={(e) => setPoint(p.id, { name: e.target.value })} placeholder="Name" />
              <input aria-label="Point address" className={input} value={p.address} onChange={(e) => setPoint(p.id, { address: e.target.value })} placeholder="Street address, city" />
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => removePoint(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
