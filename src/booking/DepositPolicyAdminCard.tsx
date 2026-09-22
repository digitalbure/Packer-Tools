import { AdminSettings } from '../types';
import { DepositMode, normalizeDepositPolicy } from './depositPolicy';

interface Props {
  settings: AdminSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettings | null>>;
}

const MODES: { id: DepositMode; label: string; help: string }[] = [
  { id: 'off', label: 'Off', help: 'No deposit is quoted on any rental.' },
  { id: 'flat', label: 'Fixed amount', help: 'The same deposit on every rental, set below.' },
  { id: 'percent', label: 'Percent of item price', help: 'A share of the daily rate, set below, applied to every rental.' },
  { id: 'owner_choice', label: 'Owner sets their own', help: 'Each owner sets a deposit for their own listings, inside the bounds below.' },
];

const input = 'w-full p-2 bg-white border border-neutral-200 rounded-lg text-xs font-semibold outline-none';

export function DepositPolicyAdminCard({ settings, setSettings }: Props) {
  const cfg = normalizeDepositPolicy(settings?.moduleWidgetConfigs?.depositPolicy);

  const update = (patch: Partial<typeof cfg>) =>
    setSettings((s) => {
      if (!s) return null;
      const confs = s.moduleWidgetConfigs || {};
      return { ...s, moduleWidgetConfigs: { ...confs, depositPolicy: { ...normalizeDepositPolicy(confs.depositPolicy), ...patch } } };
    });

  return (
    <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-4 sm:col-span-2">
      <div className="border-b border-neutral-200/50 pb-2">
        <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider block font-mono">Rental deposits</span>
        <p className="text-[11px] text-neutral-500 mt-1">
          Packer Tools does not process marketplace payments, so a deposit here is a figure shown to the renter and agreed with the owner directly — not a charge or a hold.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">How deposits are set</legend>
        {MODES.map((m) => (
          <label key={m.id} className="flex items-start gap-2 p-2 bg-white border border-neutral-200 rounded-xl cursor-pointer">
            <input type="radio" name="deposit-mode" className="mt-1" checked={cfg.mode === m.id} onChange={() => update({ mode: m.id })} />
            <span>
              <span className="text-xs font-bold text-neutral-800 block">{m.label}</span>
              <span className="text-[11px] text-neutral-500 block">{m.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {(cfg.mode === 'flat' || cfg.mode === 'owner_choice') && (
        <label className="block bg-white border border-neutral-200 rounded-xl p-3">
          <span className="text-xs font-bold text-neutral-800 block">{cfg.mode === 'flat' ? 'Deposit amount' : "Owner's starting figure"}</span>
          <input type="number" min={0} step="0.01" className={`${input} mt-1`} value={cfg.flatAmount} onChange={(e) => update({ flatAmount: Number(e.target.value) })} />
        </label>
      )}

      {cfg.mode === 'percent' && (
        <label className="block bg-white border border-neutral-200 rounded-xl p-3">
          <span className="text-xs font-bold text-neutral-800 block">Percent of the daily rate</span>
          <input type="number" min={0} max={100} step="1" className={`${input} mt-1`} value={cfg.percent} onChange={(e) => update({ percent: Number(e.target.value) })} />
        </label>
      )}

      {cfg.mode !== 'off' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block bg-white border border-neutral-200 rounded-xl p-3">
            <span className="text-xs font-bold text-neutral-800 block">Minimum deposit</span>
            <span className="text-[11px] text-neutral-500 block">0 = no floor</span>
            <input type="number" min={0} step="0.01" className={`${input} mt-1`} value={cfg.minAmount} onChange={(e) => update({ minAmount: Number(e.target.value) })} />
          </label>
          <label className="block bg-white border border-neutral-200 rounded-xl p-3">
            <span className="text-xs font-bold text-neutral-800 block">Maximum deposit</span>
            <span className="text-[11px] text-neutral-500 block">0 = no ceiling</span>
            <input type="number" min={0} step="0.01" className={`${input} mt-1`} value={cfg.maxAmount} onChange={(e) => update({ maxAmount: Number(e.target.value) })} />
          </label>
        </div>
      )}

      {cfg.mode !== 'off' && (
        <label className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl p-3 cursor-pointer">
          <input type="checkbox" checked={cfg.required} onChange={(e) => update({ required: e.target.checked })} />
          <span className="text-xs font-bold text-neutral-800">Require a deposit above zero before a listing can go live for rent</span>
        </label>
      )}
    </div>
  );
}
