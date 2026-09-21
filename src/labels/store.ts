import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { sanitizeSpec } from './sanitize';
import type { LabelSpec } from './model';

/**
 * Two tiers of templates.
 *  - global:   published by a Packer Tools admin (collection labelTemplatesGlobal). Everyone can use, only admins can change.
 *  - personal: made by a user (users/{uid}/labelTemplatesV2). Only that user can read or change them.
 * The spec is stored as a JSON string and always passed through sanitizeSpec on the way back in.
 */
export interface StoredTemplate { id: string; scope: 'global' | 'personal'; spec: LabelSpec }

const GLOBAL = 'labelTemplatesGlobal';
const personalCol = (uid: string) => collection(db, 'users', uid, 'labelTemplatesV2');

async function read(col: ReturnType<typeof collection>, scope: StoredTemplate['scope']): Promise<StoredTemplate[]> {
  try {
    const snap = await getDocs(col);
    const out: StoredTemplate[] = [];
    snap.forEach(d => {
      const spec = sanitizeSpec(d.data().spec);
      if (spec) out.push({ id: d.id, scope, spec: { ...spec, id: d.id } });
    });
    return out.sort((a, b) => a.spec.name.localeCompare(b.spec.name));
  } catch {
    return []; // not published yet, or not allowed: the built-in starters still work
  }
}

export async function loadTemplates(uid: string) {
  const [global, personal] = await Promise.all([read(collection(db, GLOBAL), 'global'), read(personalCol(uid), 'personal')]);
  return { global, personal };
}

const payload = (spec: LabelSpec) => ({ name: spec.name, widthMm: spec.widthMm, heightMm: spec.heightMm, stockId: spec.stockId ?? null, spec: JSON.stringify(spec), updatedAt: serverTimestamp() });

export async function savePersonal(uid: string, spec: LabelSpec, existingId?: string): Promise<string> {
  if (existingId) { await setDoc(doc(personalCol(uid), existingId), payload(spec), { merge: true }); return existingId; }
  return (await addDoc(personalCol(uid), { ...payload(spec), ownerId: uid })).id;
}
export const deletePersonal = (uid: string, id: string) => deleteDoc(doc(personalCol(uid), id));

export async function publishGlobal(spec: LabelSpec, byUid: string, existingId?: string): Promise<string> {
  if (existingId) { await setDoc(doc(db, GLOBAL, existingId), payload(spec), { merge: true }); return existingId; }
  return (await addDoc(collection(db, GLOBAL), { ...payload(spec), publishedBy: byUid })).id;
}
export const deleteGlobal = (id: string) => deleteDoc(doc(db, GLOBAL, id));

/**
 * Owner details and saved custom entries, per user (users/{uid}/labelEntries).
 * The document with id "owner" holds who owns the gear; every other document is one saved custom text or code value.
 */
export interface Owner { name: string; phone: string; email: string }
export interface SavedEntry { id: string; value: string }
const entriesCol = (uid: string) => collection(db, 'users', uid, 'labelEntries');
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

export async function loadEntries(uid: string): Promise<{ owner: Owner; entries: SavedEntry[] }> {
  const owner: Owner = { name: '', phone: '', email: '' };
  const entries: SavedEntry[] = [];
  try {
    (await getDocs(entriesCol(uid))).forEach(d => {
      const x = d.data();
      if (d.id === 'owner') { owner.name = clip(x.name, 120); owner.phone = clip(x.phone, 40); owner.email = clip(x.email, 120); }
      else if (typeof x.value === 'string' && x.value.trim()) entries.push({ id: d.id, value: clip(x.value, 300) });
    });
  } catch { /* first use, or offline */ }
  return { owner, entries: entries.sort((a, b) => a.value.localeCompare(b.value)) };
}

export const saveOwner = (uid: string, o: Owner) =>
  setDoc(doc(entriesCol(uid), 'owner'), { name: clip(o.name, 120), phone: clip(o.phone, 40), email: clip(o.email, 120), updatedAt: serverTimestamp() });

export async function saveEntry(uid: string, value: string): Promise<string> {
  return (await addDoc(entriesCol(uid), { value: clip(value.trim(), 300), createdAt: serverTimestamp() })).id;
}
export const deleteEntry = (uid: string, id: string) => deleteDoc(doc(entriesCol(uid), id));
