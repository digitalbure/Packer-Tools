/** Carries the items a person selected in another module to the Label Studio. Lives for one visit (sessionStorage). */
export interface HandoffItem {
  id: string; name: string; assetTag?: string; brand?: string; model?: string; serial?: string; category?: string;
  ownerName?: string; ownerPhone?: string; ownerEmail?: string;
}
export interface Handoff { items: HandoffItem[]; selected: string[] }
const KEY = 'pt-label-handoff';
const s = (v: unknown, n = 200) => (typeof v === 'string' ? v.slice(0, n) : undefined);

export function saveHandoff(items: unknown[], selected: Iterable<string> = []): void {
  const clean: HandoffItem[] = [];
  for (const raw of items.slice(0, 500)) {
    const i = raw as Record<string, unknown>;
    if (!i || typeof i.id !== 'string' || typeof i.name !== 'string') continue;
    clean.push({ id: i.id.slice(0, 128), name: i.name.slice(0, 200), assetTag: s(i.assetTag, 80), brand: s(i.brand), model: s(i.model), serial: s(i.serial ?? i.serialNumber, 120), category: s(i.category ?? i.primaryCategory, 80), ownerName: s(i.ownerName, 120), ownerPhone: s(i.ownerPhone, 40), ownerEmail: s(i.ownerEmail, 120) });
  }
  try { sessionStorage.setItem(KEY, JSON.stringify({ items: clean, selected: [...selected].slice(0, 500) } satisfies Handoff)); } catch { /* storage blocked: the studio opens without a selection */ }
}

export function takeHandoff(): Handoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const h = JSON.parse(raw) as Handoff;
    return Array.isArray(h.items) ? { items: h.items, selected: Array.isArray(h.selected) ? h.selected : [] } : null;
  } catch { return null; }
}
