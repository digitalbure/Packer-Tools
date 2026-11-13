import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Link2, Loader2, RefreshCw, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { connectFrilensa, disconnectFrilensa, frilensaStatus, setFrilensaGearScope, syncFrilensaGear, type FrilensaStatus } from '../lib/frilensa';

/**
 * Profile → Frilensa: connect Packer Tools to Frilensa (invoicing and bookkeeping). Packer Tools keeps the gear;
 * Frilensa gets a copy to price, quote and invoice from, and draft quotes for gear bookings.
 */
export default function FrilensaConnect() {
  const [status, setStatus] = useState<FrilensaStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  const load = () => frilensaStatus().then(setStatus).catch(err => toast.error(err.message));
  useEffect(() => {
    const result = params.get('frilensa');
    if (result === 'connected') toast.success('Frilensa connected. Send your gear when you are ready.');
    if (result === 'denied') toast.error('The connection was cancelled in Frilensa.');
    if (result === 'failed') toast.error('Frilensa did not finish connecting. Try again.');
    if (result) { params.delete('frilensa'); setParams(params, { replace: true }); }
    load();
  }, []);

  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    try { await fn(); } catch (err: any) { toast.error(err.message); } finally { setBusy(null); }
  };
  const sync = () => run('sync', async () => {
    const r = await syncFrilensaGear();
    toast.success(`Sent ${r.sent} item${r.sent === 1 ? '' : 's'} to Frilensa${r.removed ? `, ${r.removed} removed` : ''}${r.errors ? `, ${r.errors} not accepted` : ''}.`);
    await load();
  });
  const disconnect = () => {
    if (!confirm('Disconnect Frilensa? Gear already in Frilensa stays there, and nothing more is sent.')) return;
    run('disconnect', async () => { await disconnectFrilensa(); await load(); });
  };

  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString() : '';

  return (
    <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6" data-testid="frilensa-connect">
      <div className="space-y-2">
        <h3 className="text-xl font-black tracking-tight flex items-center gap-3"><Link2 className="text-primary shrink-0" /><span>Frilensa</span></h3>
        <p className="text-sm text-neutral-500 max-w-2xl">
          Frilensa does quotes, invoices, payments and tax for your hire business. Connect it to send your gear there as services and listings you can price and invoice, and to turn gear bookings into draft quotes. Packer Tools stays in charge of your gear; Frilensa never changes it, and nothing is sent to a client until you send it from Frilensa.
        </p>
      </div>

      {!status ? (
        <p className="text-sm text-neutral-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading</p>
      ) : !status.connected ? (
        <div className="space-y-3">
          {status.message && <p className="text-sm text-amber-700">{status.message}</p>}
          <button onClick={() => run('connect', connectFrilensa)} disabled={busy === 'connect'} className="px-5 py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50">
            {busy === 'connect' ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Connect Frilensa
          </button>
          <p className="text-xs text-neutral-400">You sign in to Frilensa (or create an account there) and approve access. You can disconnect at any time here or in Frilensa's settings.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="p-4 bg-neutral-50 rounded-2xl text-sm space-y-1">
            <p><span className="font-bold">Connected</span>{status.account?.name ? ` to ${status.account.name}` : ''}{status.account?.email ? ` (${status.account.email})` : ''}</p>
            <p className="text-xs text-neutral-500">Since {fmt(status.connectedAt)}{status.canCreateDrafts ? '' : ' · read-only access: reconnect and allow drafts to send gear and quotes'}</p>
          </div>

          <div className="space-y-2">
            <p className="micro-label">Gear to send</p>
            <div className="flex flex-col sm:flex-row gap-2">
              {(['rentable', 'all'] as const).map(scope => (
                <label key={scope} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm cursor-pointer ${status.gearScope === scope ? 'border-neutral-900 bg-neutral-50 font-bold' : 'border-neutral-200'}`}>
                  <input type="radio" name="frilensa-scope" checked={status.gearScope === scope}
                    onChange={() => run('scope', async () => { await setFrilensaGearScope(scope); setStatus({ ...status, gearScope: scope }); })} />
                  {scope === 'rentable' ? 'Gear available for hire' : 'All gear in my library'}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <button onClick={sync} disabled={busy === 'sync' || !status.canCreateDrafts} className="px-5 py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50">
              {busy === 'sync' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Send gear to Frilensa
            </button>
            <p className="text-xs text-neutral-500">
              {status.lastSync ? `Last sent ${fmt(status.lastSync.at)}: ${status.lastSync.sent} item${status.lastSync.sent === 1 ? '' : 's'}${status.lastSync.removed ? `, ${status.lastSync.removed} removed` : ''}.` : 'Not sent yet.'}
              {' '}Names, brands, serial numbers, hire rates, kit contents, status and booked dates are sent. Send again after changes; items you delete here are marked removed in Frilensa.
            </p>
          </div>

          <p className="text-xs text-neutral-500">To quote a booking, open Listings and use "Quote in Frilensa" on the booking.</p>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
            <a href={`${status.frilensaUrl}/`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl border border-neutral-200 text-sm font-bold flex items-center gap-2"><ExternalLink size={14} /> Open Frilensa</a>
            <button onClick={disconnect} disabled={busy === 'disconnect'} className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 text-sm font-bold flex items-center gap-2"><Unlink size={14} /> Disconnect</button>
          </div>
        </div>
      )}
    </section>
  );
}
