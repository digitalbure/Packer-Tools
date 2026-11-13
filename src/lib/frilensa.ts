import { authenticatedFetch } from './api';

// Frilensa connection (invoicing and bookkeeping). The server holds the connection; see
// server/integrations/frilensa.ts and server/routes/frilensa.ts.

export interface FrilensaStatus {
  connected: boolean;
  frilensaUrl: string;
  connectedAt?: string;
  canCreateDrafts?: boolean;
  gearScope?: 'rentable' | 'all';
  lastSync?: { at: string; sent: number; removed: number; errors: number } | null;
  account?: { name: string; email: string } | null;
  message?: string;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status}).`);
  return body as T;
}
const send = (method: string, body?: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

export const frilensaStatus = () => authenticatedFetch('/api/integrations/frilensa').then(r => json<FrilensaStatus>(r));
export const connectFrilensa = () => authenticatedFetch('/api/integrations/frilensa/connect', send('POST', {})).then(r => json<{ url: string }>(r)).then(r => { window.location.href = r.url; });
export const setFrilensaGearScope = (gearScope: 'rentable' | 'all') => authenticatedFetch('/api/integrations/frilensa', send('PATCH', { gearScope })).then(r => json(r));
export const syncFrilensaGear = () => authenticatedFetch('/api/integrations/frilensa/sync', send('POST', {})).then(r => json<{ lastSync: NonNullable<FrilensaStatus['lastSync']> }>(r)).then(r => r.lastSync);
export const disconnectFrilensa = () => authenticatedFetch('/api/integrations/frilensa', send('DELETE')).then(r => json(r));
export const quoteInFrilensa = (bookingId: string) =>
  authenticatedFetch('/api/integrations/frilensa/quote', send('POST', { bookingId })).then(r => json<{ quote: { id: string; number: string; total: number | null } }>(r)).then(r => r.quote);
