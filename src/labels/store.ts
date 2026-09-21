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
