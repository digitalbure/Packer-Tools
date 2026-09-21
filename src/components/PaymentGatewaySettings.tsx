import React from 'react';
import { CreditCard } from 'lucide-react';
import type { AdminSettings, UserProfile } from '../types';

interface Props {
  settings: AdminSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettings | null>>;
  users?: UserProfile[];
}

/**
 * Payments run through PayPal. Only PUBLIC values live here (client ID, sandbox switch, on/off):
 * this settings document is readable by anyone, so it must never hold a secret.
 * The PayPal secret is the server environment variable PAYPAL_SECRET_KEY.
 */
export default function PaymentGatewaySettings({ settings, setSettings }: Props) {
  const cfg = settings?.integrationConfig;
  const update = (patch: Record<string, unknown>) =>
    setSettings(s => (s ? { ...s, integrationConfig: { ...(s.integrationConfig || {}), ...patch } as any } : s));
  const enabled = cfg?.paypalEnabled !== false;
  const sandbox = cfg?.paypalSandboxMode ?? true;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3"><CreditCard size={22} /> Payments (PayPal)</h3>
        <p className="text-sm text-neutral-500">Plan purchases are paid through PayPal and always charged in US dollars. Prices and limits come from the plans in Billing.</p>
      </div>

      <div className="bg-neutral-50 border border-neutral-100 rounded-3xl p-6 space-y-6 max-w-2xl">
        <label className="flex items-center justify-between gap-4">
          <span className="font-bold text-sm">Accept PayPal payments</span>
          <input type="checkbox" checked={enabled} onChange={e => update({ paypalEnabled: e.target.checked })} className="w-5 h-5" />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span className="font-bold text-sm">Sandbox mode (test payments only)</span>
          <input type="checkbox" checked={sandbox} onChange={e => update({ paypalSandboxMode: e.target.checked })} className="w-5 h-5" />
        </label>
        <label className="grid gap-1.5">
          <span className="font-bold text-sm">PayPal client ID</span>
          <input
            type="text"
            value={cfg?.paypalClientId || ''}
            onChange={e => update({ paypalClientId: e.target.value.trim() })}
            placeholder="Client ID from the PayPal developer dashboard"
            className="px-4 py-3 bg-white border border-neutral-200 rounded-2xl font-mono text-xs"
          />
          <span className="text-xs text-neutral-500">The client ID is public by design. Save with the master Save button.</span>
        </label>
        <div className="text-xs text-neutral-600 bg-white border border-neutral-200 rounded-2xl p-4 leading-relaxed">
          The PayPal <strong>secret</strong> is not stored here. Set it as the server secret <code>PAYPAL_SECRET_KEY</code> (and the client ID as <code>VITE_PAYPAL_CLIENT_ID</code>) and republish.
        </div>
      </div>
    </div>
  );
}
