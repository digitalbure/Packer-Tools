import { authenticatedFetch } from './api';

/**
 * Client for the kiosk API (server/routes/kiosk.ts, docs/kiosk-api.md).
 * A paired device keeps a scoped terminal token in localStorage; every call carries it. A 401 clears the token so the
 * caller can fall back to the legacy client-side path (devices paired before the server-verified pairing existed).
 */
const TOKEN_KEY = 'kiosk_api_token';
const CODE_KEY = 'kiosk_pairing_code';

let baseUrl = '';
/** Test hook / non-browser hosts. */
export function setKioskApiBase(url: string) { baseUrl = url.replace(/\/$/, ''); }

interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
let store: Store | null = (() => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } })();
export function setKioskApiStorage(s: Store) { store = s; }

export class KioskApiError extends Error {
  constructor(public status: number, message: string, public conflicts?: { id: string; name?: string; reason: string; holder?: string }[]) {
    super(message);
  }
  /** Human-readable summary of item conflicts, e.g. "Camera is already checked out to Ola". */
  describe(): string {
    if (!this.conflicts?.length) return this.message;
    return this.conflicts.map(c => {
      const who = c.name || c.id;
      if (c.reason === 'already_out') return `${who} is already checked out${c.holder ? ` to ${c.holder}` : ''}`;
      if (c.reason === 'restricted') return `${who} is not available for check-out`;
      return `${who} was not found`;
    }).join('; ');
  }
}

export const remember = {
  pairingCode: (code: string) => { try { store?.setItem(CODE_KEY, code); } catch { /* storage unavailable */ } },
  pairingCodeValue: () => { try { return store?.getItem(CODE_KEY) ?? null; } catch { return null; } },
};
export const getToken = () => { try { return store?.getItem(TOKEN_KEY) ?? null; } catch { return null; } };
const setToken = (t: string) => { try { store?.setItem(TOKEN_KEY, t); } catch { /* ignore */ } };
export const clearToken = () => { try { store?.removeItem(TOKEN_KEY); } catch { /* ignore */ } };
export const hasToken = () => !!getToken();

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new KioskApiError(res.status, data.error || `Request failed (${res.status})`, data.conflicts);
  return data;
}

async function deviceFetch(method: string, path: string, body?: unknown) {
  const token = getToken();
  if (!token) throw new KioskApiError(401, 'Kiosk is not authorized.');
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) clearToken(); // revoked / expired / plan lapsed: caller falls back or re-pairs
  return parse(res);
}

type Source = { source?: 'library' | 'inventory'; inventoryId?: string };
const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const kioskApi = {
  /** Device: exchange terminal id + pairing code for a token. Returns false when not (yet) activated server-side. */
  async startSession(terminalId: string, pairingCode: string): Promise<boolean> {
    try {
      const data = await parse(await fetch(baseUrl + '/api/kiosk/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ terminalId, pairingCode }),
      }));
      setToken(data.token);
      return true;
    } catch (e) {
      if (e instanceof KioskApiError && [401, 403, 429].includes(e.status)) return false;
      throw e;
    }
  },
  refresh: async () => { const d = await deviceFetch('POST', '/api/kiosk/session/refresh'); setToken(d.token); return d; },
  context: () => deviceFetch('GET', '/api/kiosk/context'),
  lookup: async (code: string, src: Source = {}) => {
    try {
      return (await deviceFetch('GET', '/api/kiosk/items/lookup' + qs({ code, ...src }))).item ?? null;
    } catch (e) { if (e instanceof KioskApiError && e.status === 404) return null; throw e; }
  },
  search: (params: Source & { q?: string; category?: string; status?: string; limit?: number; cursor?: string }) =>
    deviceFetch('GET', '/api/kiosk/items' + qs(params)),
  checkout: (b: Source & { items: { id: string; qty?: number }[]; holder?: { name?: string; email?: string }; signature?: string | null; expectedReturnDate?: string; notes?: string; orderNumber?: string }) =>
    deviceFetch('POST', '/api/kiosk/checkout', b),
  checkin: (b: Source & { items: { id: string }[]; holder?: { name?: string; email?: string }; notes?: string }) =>
    deviceFetch('POST', '/api/kiosk/checkin', b),
  createOrder: (b: { items: { id: string; qty?: number }[]; guest?: { name?: string; email?: string } }) => deviceFetch('POST', '/api/kiosk/orders', b),
  pendingOrders: async () => (await deviceFetch('GET', '/api/kiosk/orders')).orders as any[],
  fulfillOrder: (id: string) => deviceFetch('POST', `/api/kiosk/orders/${encodeURIComponent(id)}/fulfill`),
  receipt: (b: Record<string, unknown>) => deviceFetch('POST', '/api/kiosk/receipt', b),

  // Owner (Firebase ID token) actions from the dashboard.
  async activateTerminal(pairingCode: string) {
    return parse(await authenticatedFetch('/api/kiosk/terminals/activate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairingCode }),
    }));
  },
  async revokeTerminal(terminalId: string) {
    return parse(await authenticatedFetch(`/api/kiosk/terminals/${encodeURIComponent(terminalId)}/revoke`, { method: 'POST' }));
  },
  /** Device: forget local credentials (used by the 5-tap escape). */
  forget() { clearToken(); try { store?.removeItem(CODE_KEY); } catch { /* ignore */ } },
};
