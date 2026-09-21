import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebase';
import type { AdminSettings, GearItem, UserProfile } from '../types';
import {
  FIELD_OPTIONS, LABEL_STOCKS, PAGES, PRINTERS, STARTER_TEMPLATES, getPrinter, getStock, recommendTemplateId, renderLabel, renderSheets, tapeItYourselfOptions,
  type AssetData, type CodeElement, type LabelElement, type LabelSpec, type LabelStock, type Symbology, type TextElement,
} from '../labels';
import { canvasMeasure, downloadBlob, printPages, svgToMonoPng } from '../labels/browser';
import { deleteEntry, deleteGlobal, deletePersonal, loadEntries, loadTemplates, publishGlobal, saveEntry, saveOwner, savePersonal, type Owner, type SavedEntry, type StoredTemplate } from '../labels/store';
import { takeHandoff } from '../labels/handoff';
import { isFeatureEnabled } from '../lib/featureUtils';
import { useLandingFonts } from '../components/landing/useLandingFonts';
import './labelStudio.css';

const SAMPLE: AssetData = { name: 'Cinema camera body', brand: 'Sony', model: 'A7', assetTag: 'PT-ABC123', serial: 'SN-48211', url: 'https://packer.tools/gear/AbCdEfGhIjKlMnOpQrSt' };
const DEMO_ITEMS = [
  { id: 'd1', name: 'Cinema camera body', brand: 'Sony', assetTag: 'PT-ABC123' }, { id: 'd2', name: '24-70mm zoom lens', brand: 'Sony', assetTag: 'PT-ABC124' },
  { id: 'd3', name: 'Wireless receiver', brand: 'Sennheiser', assetTag: 'PT-ABC125' }, { id: 'd4', name: 'Battery pack', brand: 'Anton Bauer', assetTag: 'PT-1042' },
] as unknown as GearItem[];
const GROUPS: Record<LabelStock['group'], string> = { cable: 'Cable wrap labels', tag: 'Tags and cases', roll: 'Rolls', sheet: 'Sheets' };
const CUSTOM: LabelStock = { id: 'custom', name: 'Custom size', group: 'tag', material: 'Any', colour: 'White', widthMm: 50, heightMm: 30 };
const SYMBOLS: [Symbology, string][] = [['qr', 'QR code'], ['code128', 'Code 128 barcode'], ['code39', 'Code 39 barcode'], ['ean13', 'EAN-13 barcode'], ['datamatrix', 'Data Matrix']];

const sameSize = (t: LabelSpec, s: LabelStock) => Math.abs(t.widthMm - s.widthMm) < 0.05 && Math.abs(t.heightMm - s.heightMm) < 0.05 && (t.tailMm ?? 0) === (s.tailMm ?? 0);
const toAsset = (i: GearItem, owner: Owner): AssetData => {
  const x = i as any;
  return {
    name: i.name, brand: x.brand, model: x.model, assetTag: x.assetTag || i.id, serial: x.serialNumber ?? x.serial, category: x.category ?? x.primaryCategory,
    url: `${window.location.origin}/gear/${i.id}`,
    ownerName: x.ownerName || owner.name, ownerPhone: x.ownerPhone || owner.phone, ownerEmail: x.ownerEmail || owner.email,
  };
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Dropdown of what can go in a box, with "Customize" for typed text and a way to save typed text for next time. */
function ValuePicker({ label, value, onChange, entries, onSave, onDeleteEntry, canSave }: {
  label: string; value: string; onChange: (v: string) => void; entries: SavedEntry[];
  onSave: (v: string) => void; onDeleteEntry: (id: string) => void; canSave: boolean;
}) {
  const known = FIELD_OPTIONS.some(o => o.value === value) || entries.some(e => e.value === value);
  const [custom, setCustom] = useState(!known && value !== '');
  const showInput = custom || !known;
  const saved = entries.find(e => e.value === value);
  const groups = ['Item', 'Owner', 'Fixed text'] as const;
  return (
    <div className="ls-row">
      <label>{label}
        <select value={showInput ? '__custom' : value} onChange={e => { if (e.target.value === '__custom') setCustom(true); else { setCustom(false); onChange(e.target.value); } }}>
          {groups.map(g => <optgroup key={g} label={g}>{FIELD_OPTIONS.filter(o => o.group === g).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}
          {entries.length > 0 && <optgroup label="My saved entries">{entries.map(e => <option key={e.id} value={e.value}>{e.value}</option>)}</optgroup>}
          <option value="__custom">Customize…</option>
        </select>
      </label>
      {showInput && (
        <div className="ls-actions">
          <input type="text" aria-label={`${label}, your own text`} value={value} maxLength={300} placeholder="Type your own text" onChange={e => onChange(e.target.value)} style={{ flex: 1, minWidth: '10rem' }} />
          {canSave && value.trim() !== '' && !saved && <button type="button" className="ls-btn ls-btn--small" onClick={() => onSave(value.trim())}>Save this entry</button>}
        </div>
      )}
      {saved && canSave && !showInput && <button type="button" className="ls-btn ls-btn--small ls-btn--danger" style={{ justifySelf: 'start' }} onClick={() => onDeleteEntry(saved.id)}>Delete this saved entry</button>}
    </div>
  );
}

interface Props { user: UserProfile | null; adminSettings?: AdminSettings | null; demo?: boolean }

export default function LabelStudio({ user, adminSettings, demo }: Props) {
  useLandingFonts();
  const uid = user?.uid;
  const isAdmin = !!user && (user.isSuperAdmin === true || (user as any).role === 'admin');

  const [items, setItems] = useState<GearItem[]>(demo ? DEMO_ITEMS : []);
  const [loading, setLoading] = useState(!demo);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [copies, setCopies] = useState(1);
  const [owner, setOwner] = useState<Owner>({ name: '', phone: '', email: '' });
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [autoMode, setAutoMode] = useState(true);
  const [groupKey, setGroupKey] = useState('');
  const [footerOn, setFooterOn] = useState(true);
  const canRemoveFooter = !!demo || (!!user && isFeatureEnabled('branding', user, adminSettings ?? null));

  const [stockId, setStockId] = useState('pp-50x30');
  const [custom, setCustom] = useState({ w: 50, h: 30 });
  const [printerId, setPrinterId] = useState('detonger-dt60plus');
  const [dpi, setDpi] = useState(300);
  const [pageKey, setPageKey] = useState<'a4' | 'letter'>('a4');
  const [sheetMode, setSheetMode] = useState<'sheet' | 'tape'>('tape');

  const [stored, setStored] = useState<{ global: StoredTemplate[]; personal: StoredTemplate[] }>({ global: [], personal: [] });
  const [templateKey, setTemplateKey] = useState('starter:starter-asset-50x30');
  const [draft, setDraft] = useState<LabelSpec>(() => clone(STARTER_TEMPLATES[0]));
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');

  const stock = useMemo<LabelStock>(() => (stockId === 'custom' ? { ...CUSTOM, widthMm: custom.w, heightMm: custom.h } : getStock(stockId) || CUSTOM), [stockId, custom]);
  const printer = getPrinter(printerId)!;
  const isSheet = printer.kind === 'sheet';

  // ---- load items and templates ----
  useEffect(() => {
    if (demo || !uid) return;
    let alive = true;
    getDocs(query(collection(db, 'users', uid, 'gearLibrary'), limit(500)))
      .then(s => { if (alive) setItems(s.docs.map(d => ({ id: d.id, ...d.data() }) as GearItem)); })
      .catch(() => setMessage('Your items could not be loaded. Reload the page to try again.'))
      .finally(() => alive && setLoading(false));
    loadTemplates(uid).then(t => alive && setStored(t));
    loadEntries(uid).then(e => { if (alive) { setOwner(e.owner); setEntries(e.entries); } });
    return () => { alive = false; };
  }, [uid, demo]);

  // Items sent from the Gear Library, a packing list, an inventory sheet or an item page arrive already selected.
  useEffect(() => {
    const h = takeHandoff();
    if (!h) return;
    const sent = h.items.map(i => ({ id: i.id, name: i.name, brand: i.brand, model: i.model, assetTag: i.assetTag, serial: i.serial, category: i.category, ownerName: i.ownerName, ownerPhone: i.ownerPhone, ownerEmail: i.ownerEmail }) as unknown as GearItem);
    setItems(prev => { const ids = new Set(sent.map(x => x.id)); return [...sent, ...prev.filter(p => !ids.has(p.id))]; });
    setPicked(new Set(h.selected));
    setLoading(false);
  }, []);

  const allTemplates = useMemo(() => [
    ...STARTER_TEMPLATES.map(spec => ({ key: `starter:${spec.id}`, scope: 'starter' as const, spec })),
    ...stored.global.map(t => ({ key: `global:${t.id}`, scope: 'global' as const, spec: t.spec })),
    ...stored.personal.map(t => ({ key: `personal:${t.id}`, scope: 'personal' as const, spec: t.spec })),
  ], [stored]);
  const current = allTemplates.find(t => t.key === templateKey);
  const matching = allTemplates.filter(t => sameSize(t.spec, stock));

  const chooseTemplate = (key: string) => {
    const t = allTemplates.find(x => x.key === key);
    if (!t) return;
    setAutoMode(false); setTemplateKey(key); setDraft(clone(t.spec)); setMessage('');
  };
  const chooseStock = (id: string, c = custom) => {
    setAutoMode(false); setStockId(id);
    const s = id === 'custom' ? { ...CUSTOM, widthMm: c.w, heightMm: c.h } : getStock(id)!;
    const first = allTemplates.find(t => sameSize(t.spec, s));
    if (first) { setTemplateKey(first.key); setDraft(clone(first.spec)); }
    else { setTemplateKey(''); setDraft({ id: 'new', name: 'New template', widthMm: s.widthMm, heightMm: s.heightMm, tailMm: s.tailMm, stockId: s.id, elements: [] }); }
    setMessage('');
  };
  const choosePrinter = (id: string) => {
    const p = getPrinter(id)!;
    setPrinterId(id); setDpi(p.dpiOptions.includes(dpi) ? dpi : p.dpiOptions[0]);
  };

  // ---- what will print ----
  const measure = useMemo(() => canvasMeasure(), []);
  const chosen = useMemo(() => items.filter(i => picked.has(i.id)), [items, picked]);
  const groups = useMemo(() => {
    const m = new Map<string, GearItem[]>();
    for (const i of chosen) { const id = recommendTemplateId(toAsset(i, owner)); m.set(id, [...(m.get(id) || []), i]); }
    return m;
  }, [chosen, owner]);
  // Automatic: the label follows what is selected. Any manual choice below turns this off.
  useEffect(() => {
    if (!autoMode || groups.size === 0) return;
    const key = groups.has(groupKey) ? groupKey : [...groups.keys()][0];
    if (key !== groupKey) setGroupKey(key);
    const t = STARTER_TEMPLATES.find(x => x.id === key);
    if (t) { setTemplateKey(`starter:${t.id}`); setDraft(clone(t)); if (t.stockId) setStockId(t.stockId); }
  }, [autoMode, groups, groupKey]);
  const active = autoMode && groups.size > 0 ? groups.get(groupKey) || [] : chosen;
  const sample = useMemo<AssetData>(() => ({ ...SAMPLE, ownerName: owner.name || 'Packer Tools Production', ownerPhone: owner.phone || '+000 000 0000', ownerEmail: owner.email || 'assets@example.com' }), [owner]);
  const jobs = useMemo(() => {
    const out: AssetData[] = [];
    for (const i of active) { const a = toAsset(i, owner); for (let c = 0; c < copies && out.length < 500; c++) out.push(a); }
    return out;
  }, [active, copies, owner]);
  const preview = useMemo(() => renderLabel(draft, jobs[0] ?? sample, { dpi, measure, preview: true, footer: footerOn }), [draft, jobs, sample, dpi, measure, footerOn]);
  const issues = useMemo(() => {
    const seen = new Map<string, { level: 'error' | 'warn'; message: string }>();
    const subjects = active.length ? active.slice(0, 200).map(i => toAsset(i, owner)) : [sample];
    for (const a of subjects) for (const i of renderLabel(draft, a, { dpi, measure, footer: footerOn }).issues) seen.set(`${i.level}|${i.message}`, i);
    return [...seen.values()];
  }, [draft, active, owner, sample, dpi, measure, footerOn]);
  const blocked = issues.some(i => i.level === 'error') || draft.elements.length === 0;
  const canPrint = jobs.length > 0 && !blocked;

  const rendered = () => jobs.map(a => renderLabel(draft, a, { dpi, measure, footer: footerOn }));
  const printRoll = () => printPages(rendered().map(r => ({ svg: r.svg, widthMm: r.widthMm, heightMm: r.feedHeightMm })), 'Labels');
  const printSheet = () => {
    const page = PAGES[pageKey];
    const pages = renderSheets(rendered().map(r => ({ inner: r.inner, widthMm: r.widthMm, heightMm: r.heightMm })), page, sheetMode === 'tape' ? tapeItYourselfOptions() : { marginMm: 8, gapMm: 2 });
    printPages(pages.map(svg => ({ svg, widthMm: page.widthMm, heightMm: page.heightMm })), 'Label sheet');
  };
  const downloadPng = async () => {
    try {
      const list = rendered().slice(0, 30);
      for (let n = 0; n < list.length; n++) {
        const r = list[n];
        downloadBlob(await svgToMonoPng(r.svg, r.widthMm, r.feedHeightMm, dpi), `label-${String(n + 1).padStart(2, '0')}-${dpi}dpi.png`);
        await new Promise(res => setTimeout(res, 250));
      }
      setMessage(jobs.length > 30 ? 'Saved the first 30 images. Print the rest in smaller groups.' : `Saved ${list.length} image${list.length === 1 ? '' : 's'} at ${dpi} dpi.`);
    } catch (e: any) { setMessage(e?.message || 'The images could not be saved.'); }
  };

  // ---- template actions ----
  const dirty = !!current && JSON.stringify(current.spec) !== JSON.stringify(draft);
  const doSave = async (asNew: boolean) => {
    if (!uid) return;
    try {
      const name = (asNew ? newName.trim() : draft.name.trim()) || 'My template';
      const spec = { ...draft, name };
      if (!asNew && current?.scope === 'personal') {
        await savePersonal(uid, spec, current.spec.id);
        setMessage('Template saved.');
      } else {
        const id = await savePersonal(uid, { ...spec, stockId: stock.id });
        setTemplateKey(`personal:${id}`); setNewName('');
        setMessage('Saved to your templates.');
      }
      setStored(await loadTemplates(uid));
    } catch { setMessage('The template could not be saved. Try again.'); }
  };
  const doDelete = async () => {
    if (!uid || !current) return;
    if (!window.confirm(`Delete "${current.spec.name}"? This cannot be undone.`)) return;
    try {
      if (current.scope === 'personal') await deletePersonal(uid, current.spec.id);
      else if (current.scope === 'global' && isAdmin) await deleteGlobal(current.spec.id);
      setStored(await loadTemplates(uid)); chooseStock(stock.id); setMessage('Template deleted.');
    } catch { setMessage('The template could not be deleted.'); }
  };
  const doPublish = async () => {
    if (!uid || !isAdmin) return;
    try {
      const name = (newName.trim() || draft.name.trim()) || 'Company template';
      const id = await publishGlobal({ ...draft, name, stockId: stock.id }, uid, current?.scope === 'global' && !newName.trim() ? current.spec.id : undefined);
      setStored(await loadTemplates(uid)); setTemplateKey(`global:${id}`); setNewName('');
      setMessage('Published. Everyone can now use this template.');
    } catch { setMessage('The template could not be published.'); }
  };

  const doSaveEntry = async (value: string) => {
    if (demo) { setEntries(e => [...e, { id: `demo-${Date.now()}`, value }]); setMessage('Entry saved. It now appears in the list.'); return; }
    if (!uid) return;
    try { await saveEntry(uid, value); setEntries((await loadEntries(uid)).entries); setMessage('Entry saved. It now appears in the list.'); }
    catch { setMessage('The entry could not be saved.'); }
  };
  const doDeleteEntry = async (id: string) => {
    if (demo) { setEntries(e => e.filter(x => x.id !== id)); return; }
    if (!uid) return;
    try { await deleteEntry(uid, id); setEntries(e => e.filter(x => x.id !== id)); } catch { setMessage('The entry could not be deleted.'); }
  };
  const doSaveOwner = async () => {
    if (!uid) return;
    try { await saveOwner(uid, owner); setMessage('Owner details saved.'); } catch { setMessage('The owner details could not be saved.'); }
  };

  // ---- element editing ----
  const upd = (i: number, patch: Partial<LabelElement>) => (setAutoMode(false), setDraft(d => ({ ...d, elements: d.elements.map((e, n) => (n === i ? ({ ...e, ...patch } as LabelElement) : e)) })));
  const remove = (i: number) => (setAutoMode(false), setDraft(d => ({ ...d, elements: d.elements.filter((_, n) => n !== i) })));
  const addEl = (kind: 'text' | 'code' | 'rule') => (setAutoMode(false), setDraft(d => {
    const id = `e${Date.now().toString(36)}`;
    const w = Math.min(20, d.widthMm - 2), h = Math.min(kind === 'code' ? 20 : 6, d.heightMm - 2);
    const el: LabelElement = kind === 'text' ? { id, kind, x: 2, y: 2, w, h, text: '{{asset.name}}', fontMm: 3 }
      : kind === 'code' ? { id, kind, x: 2, y: 2, w, h: Math.min(w, d.heightMm - 2), symbology: 'qr', value: '{{asset.url}}' } : { id, kind, x: 2, y: 2, w, h: 0.4 };
    return { ...d, elements: [...d.elements, el] };
  }));

  const shown = items.filter(i => `${i.name} ${(i as any).brand ?? ''} ${(i as any).assetTag ?? ''}`.toLowerCase().includes(search.toLowerCase())).slice(0, 300);
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const previewW = Math.min(420, preview.widthMm * 6);

  return (
    <div className="ls">
      <header className="ls-head">
        <h1 className="ls-title">Label Studio</h1>
        <p className="ls-soft">Choose items, pick a label and a printer, check the preview, and print.{demo ? ' This is a demo with sample items.' : ''}</p>
      </header>

      <div className="ls-grid">
        <div>
          <section className="ls-panel" aria-labelledby="ls-items">
            <h2 id="ls-items"><span className="ls-step">1</span>Items</h2>
            <label>Search<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, brand or tag" /></label>
            <div className="ls-list" role="group" aria-label="Items to label">
              {loading && <p className="ls-soft" style={{ padding: '0.75rem' }}>Loading your items.</p>}
              {!loading && items.length === 0 && <p className="ls-soft" style={{ padding: '0.75rem' }}>No items yet. Add gear in the Gear Library, then come back.</p>}
              {shown.map(i => (
                <label key={i.id} className="ls-item">
                  <input type="checkbox" checked={picked.has(i.id)} onChange={e => setPicked(p => { const n = new Set(p); e.target.checked ? n.add(i.id) : n.delete(i.id); return n; })} />
                  <span>{i.name}</span>
                  <span className="ls-soft">{(i as any).assetTag || ''}</span>
                </label>
              ))}
            </div>
            <div className="ls-actions">
              <button type="button" className="ls-btn ls-btn--small" onClick={() => setPicked(p => new Set([...p, ...shown.map(i => i.id)]))}>Select all shown</button>
              <button type="button" className="ls-btn ls-btn--small" onClick={() => setPicked(new Set())}>Clear</button>
              <span className="ls-soft">{picked.size} selected</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>Copies of each
                <input type="number" min={1} max={50} value={copies} onChange={e => setCopies(Math.max(1, Math.min(50, num(e.target.value) || 1)))} style={{ width: '4.5rem' }} />
              </label>
            </div>
          </section>

          <section className="ls-panel" aria-labelledby="ls-owner">
            <h2 id="ls-owner">Owner details</h2>
            <p className="ls-soft">Printed on labels that show who owns the gear. An owner saved on an item is used for that item.</p>
            <div className="ls-row ls-row--2">
              <label>Owner name<input type="text" maxLength={120} value={owner.name} onChange={e => setOwner(o => ({ ...o, name: e.target.value }))} placeholder="Your company or team" /></label>
              <label>Phone<input type="text" maxLength={40} value={owner.phone} onChange={e => setOwner(o => ({ ...o, phone: e.target.value }))} /></label>
            </div>
            <label>Email<input type="text" maxLength={120} value={owner.email} onChange={e => setOwner(o => ({ ...o, email: e.target.value }))} /></label>
            {!demo && <div className="ls-actions"><button type="button" className="ls-btn ls-btn--small" onClick={doSaveOwner}>Save owner details</button></div>}
          </section>

          <section className="ls-panel" aria-labelledby="ls-label">
            <h2 id="ls-label"><span className="ls-step">2</span>Label and printer</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="checkbox" checked={autoMode} onChange={e => setAutoMode(e.target.checked)} style={{ width: '1.1rem', height: '1.1rem' }} />
              Choose the label for me, based on each item
            </label>
            {autoMode && groups.size > 0 && (
              <div className="ls-row">
                <p className="ls-soft">{groups.size === 1 ? 'Best label for your selection:' : 'Your selection needs different labels. Print one group at a time:'}</p>
                <div className="ls-actions">
                  {[...groups.entries()].map(([id, list]) => {
                    const t = STARTER_TEMPLATES.find(x => x.id === id)!;
                    return <button key={id} type="button" className="ls-btn ls-btn--small" aria-pressed={id === groupKey} style={id === groupKey ? { background: 'var(--ink)', color: 'var(--tape)' } : undefined} onClick={() => setGroupKey(id)}>{t.name} ({list.length})</button>;
                  })}
                </div>
              </div>
            )}
            {autoMode && groups.size === 0 && <p className="ls-soft">Select items and the best label is chosen for you. You can change it at any time.</p>}
            <div className="ls-row ls-row--2">
              <label>Printer
                <select value={printerId} onChange={e => choosePrinter(e.target.value)}>{PRINTERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </label>
              <label>Resolution
                <select value={dpi} onChange={e => setDpi(Number(e.target.value))}>{printer.dpiOptions.map(d => <option key={d} value={d}>{d} dpi</option>)}</select>
              </label>
            </div>
            <p className="ls-soft">
              <span className={`ls-badge${printer.status === 'in-testing' ? ' ls-badge--test' : ''}`}>{printer.status === 'in-testing' ? 'In testing' : printer.status === 'generic' ? 'Any printer' : 'Planned'}</span>{' '}
              {printer.notes}
            </p>
            <div className="ls-row ls-row--2">
              <label>Label stock
                <select value={stockId} onChange={e => chooseStock(e.target.value)}>
                  {(Object.keys(GROUPS) as LabelStock['group'][]).map(g => (
                    <optgroup key={g} label={GROUPS[g]}>{LABEL_STOCKS.filter(s => s.group === g).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
                  ))}
                  <option value="custom">Custom size</option>
                </select>
              </label>
              <label>Template
                <select value={templateKey} onChange={e => chooseTemplate(e.target.value)}>
                  {!current && <option value="">New template</option>}
                  {(['starter', 'global', 'personal'] as const).map(scope => {
                    const list = matching.filter(t => t.scope === scope);
                    return list.length ? <optgroup key={scope} label={scope === 'starter' ? 'Packer Tools starters' : scope === 'global' ? 'Company templates' : 'My templates'}>{list.map(t => <option key={t.key} value={t.key}>{t.spec.name}</option>)}</optgroup> : null;
                  })}
                </select>
              </label>
            </div>
            {stockId === 'custom' && (
              <div className="ls-row ls-row--2">
                <label>Width (mm)<input type="number" min={5} max={300} step={0.1} value={custom.w} onChange={e => { const c = { ...custom, w: num(e.target.value) }; setCustom(c); chooseStock('custom', c); }} /></label>
                <label>Height (mm)<input type="number" min={5} max={500} step={0.1} value={custom.h} onChange={e => { const c = { ...custom, h: num(e.target.value) }; setCustom(c); chooseStock('custom', c); }} /></label>
              </div>
            )}
            {stock.note && <p className="ls-soft">{stock.note}</p>}
            {stock.tailMm ? <p className="ls-soft">The {stock.tailMm} mm tail wraps around the cable and is not printed. The printer feeds {stock.heightMm + stock.tailMm} mm per label.</p> : null}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="checkbox" checked={footerOn || !canRemoveFooter} disabled={!canRemoveFooter} onChange={e => setFooterOn(e.target.checked)} style={{ width: '1.1rem', height: '1.1rem' }} />
              Show &ldquo;by Packer.Tools&rdquo; on the label{!canRemoveFooter ? ' (removing it is part of the Pro plan)' : ''}
            </label>
            {isSheet && (
              <div className="ls-row ls-row--2">
                <label>Paper<select value={pageKey} onChange={e => setPageKey(e.target.value as any)}><option value="a4">A4</option><option value="letter">Letter</option></select></label>
                <label>Layout<select value={sheetMode} onChange={e => setSheetMode(e.target.value as any)}><option value="tape">Cut and tape (plain paper, with cut lines)</option><option value="sheet">Label sheet (no cut lines)</option></select></label>
              </div>
            )}
          </section>

          <section className="ls-panel">
            <details className="ls-fold">
              <summary>Edit this template</summary>
              <div className="ls-row" style={{ marginTop: '1rem' }}>
                <label>Template name<input type="text" value={draft.name} maxLength={80} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></label>
                {draft.elements.length === 0 && <p className="ls-soft">This label is empty. Add text or a code.</p>}
                {draft.elements.map((el, i) => (
                  <div key={el.id} className="ls-el">
                    <header>
                      <span>{el.kind === 'text' ? 'Text' : el.kind === 'code' ? 'Code' : 'Line'} {i + 1}</span>
                      <button type="button" className="ls-btn ls-btn--small ls-btn--danger" onClick={() => remove(i)}>Remove</button>
                    </header>
                    {el.kind === 'text' && (
                      <div className="ls-row ls-row--2">
                        <ValuePicker label="Text" value={(el as TextElement).text} onChange={v => upd(i, { text: v } as any)} entries={entries} onSave={doSaveEntry} onDeleteEntry={doDeleteEntry} canSave />
                        <label>Text height (mm)<input type="number" min={1} step={0.1} value={(el as TextElement).fontMm} onChange={e => upd(i, { fontMm: num(e.target.value) } as any)} /></label>
                      </div>
                    )}
                    {el.kind === 'code' && (
                      <div className="ls-row ls-row--2">
                        <label>Type<select value={(el as CodeElement).symbology} onChange={e => upd(i, { symbology: e.target.value as Symbology } as any)}>{SYMBOLS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
                        <ValuePicker label="Value" value={(el as CodeElement).value} onChange={v => upd(i, { value: v } as any)} entries={entries} onSave={doSaveEntry} onDeleteEntry={doDeleteEntry} canSave />
                      </div>
                    )}
                    <div className="ls-row ls-row--4">
                      <label>Left (mm)<input type="number" step={0.1} value={el.x} onChange={e => upd(i, { x: num(e.target.value) })} /></label>
                      <label>Top (mm)<input type="number" step={0.1} value={el.y} onChange={e => upd(i, { y: num(e.target.value) })} /></label>
                      <label>Width (mm)<input type="number" step={0.1} min={0.5} value={el.w} onChange={e => upd(i, { w: num(e.target.value) })} /></label>
                      <label>Height (mm)<input type="number" step={0.1} min={0.1} value={el.h} onChange={e => upd(i, { h: num(e.target.value) })} /></label>
                    </div>
                    {el.kind !== 'rule' && (
                      <label style={{ maxWidth: '12rem' }}>Turn
                        <select value={el.rotate ?? 0} onChange={e => upd(i, { rotate: Number(e.target.value) as 0 | 90 | 180 | 270 })}><option value={0}>Not turned</option><option value={90}>90 degrees</option><option value={180}>180 degrees</option><option value={270}>270 degrees</option></select>
                      </label>
                    )}
                  </div>
                ))}
                <div className="ls-actions">
                  <button type="button" className="ls-btn ls-btn--small" onClick={() => addEl('text')}>Add text</button>
                  <button type="button" className="ls-btn ls-btn--small" onClick={() => addEl('code')}>Add code</button>
                  <button type="button" className="ls-btn ls-btn--small" onClick={() => addEl('rule')}>Add line</button>
                </div>

                {!demo && (
                  <div className="ls-row" style={{ borderTop: '2px solid var(--line)', paddingTop: '1rem' }}>
                    <label>Name for a new template<input type="text" value={newName} maxLength={80} onChange={e => setNewName(e.target.value)} placeholder="For example: Cable tag with QR" /></label>
                    <div className="ls-actions">
                      {current?.scope === 'personal' && <button type="button" className="ls-btn ls-btn--small" disabled={!dirty} onClick={() => doSave(false)}>Save changes</button>}
                      <button type="button" className="ls-btn ls-btn--small ls-btn--primary" disabled={draft.elements.length === 0} onClick={() => doSave(true)}>Save as my template</button>
                      {current?.scope === 'personal' && <button type="button" className="ls-btn ls-btn--small ls-btn--danger" onClick={doDelete}>Delete template</button>}
                    </div>
                    {isAdmin && (
                      <div className="ls-actions">
                        <button type="button" className="ls-btn ls-btn--small" disabled={draft.elements.length === 0} onClick={doPublish}>{current?.scope === 'global' && !newName.trim() ? 'Update for everyone' : 'Publish to everyone'}</button>
                        {current?.scope === 'global' && <button type="button" className="ls-btn ls-btn--small ls-btn--danger" onClick={doDelete}>Remove from everyone</button>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </details>
          </section>
        </div>

        <aside className="ls-side" aria-label="Preview and print">
          <section className="ls-preview" aria-labelledby="ls-prev">
            <h2 id="ls-prev"><span className="ls-step">3</span>Check and print</h2>
            <div className="ls-stage">
              <div style={{ width: previewW }} dangerouslySetInnerHTML={{ __html: preview.svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, `width="${previewW}" height="${(previewW * preview.feedHeightMm) / preview.widthMm}"`) }} />
            </div>
            <p className="ls-soft">{jobs.length === 0 ? 'The preview uses sample data. Select items to print.' : `Preview of ${jobs[0].name}. ${jobs.length} label${jobs.length === 1 ? '' : 's'} will print.`}</p>
            <div className="ls-issues" aria-live="polite">
              {issues.map((i, n) => <div key={n} className="ls-issue" data-level={i.level}><i /><span>{i.message}</span></div>)}
              {draft.elements.length === 0 && <div className="ls-issue" data-level="error"><i /><span>The label is empty. Add text or a code, or choose a template.</span></div>}
              {issues.length === 0 && draft.elements.length > 0 && <div className="ls-ok">No problems found. Print one label first and scan it before printing a batch.</div>}
            </div>
            <div className="ls-actions">
              {isSheet
                ? <button type="button" className="ls-btn ls-btn--primary" disabled={!canPrint} onClick={printSheet}>Print {jobs.length ? `${jobs.length} label${jobs.length === 1 ? '' : 's'}` : 'labels'}</button>
                : <button type="button" className="ls-btn ls-btn--primary" disabled={!canPrint} onClick={printRoll}>Print {jobs.length ? `${jobs.length} label${jobs.length === 1 ? '' : 's'}` : 'labels'}</button>}
              {!isSheet && <button type="button" className="ls-btn" disabled={!canPrint} onClick={downloadPng}>Save as images</button>}
            </div>
            <p className="ls-soft">In the print dialog, choose the label size, set scale to 100% and margins to none.{isSheet ? '' : ' "Save as images" makes black-and-white PNG files at the printer\'s resolution, for the printer maker\'s own app.'}</p>
            {message && <div className="ls-msg" role="status">{message}</div>}
          </section>
        </aside>
      </div>
    </div>
  );
}
