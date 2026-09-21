import { FieldPath, FieldValue, type CollectionReference, type DocumentReference } from "firebase-admin/firestore";
import { dbAdmin } from "../firebaseAdmin";
import { KioskError, type KioskContext } from "./store";
import { ownerHasFeature } from "./entitlements";

/**
 * Server-side kiosk operations. Every function takes a KioskContext (ownerUid + terminalId) that comes from a
 * verified terminal token; there is NO way for a caller to name another owner. Multi-item changes run in ONE
 * transaction: all items are read first, any conflict aborts everything, then all writes commit together.
 */
export type SourceSpec = { source?: "library" | "inventory"; inventoryId?: string };

const MAX_ITEMS = 100;
const str = (v: any, max: number, fb = "") => (typeof v === "string" ? v.trim().slice(0, max) : fb);
const validId = (v: any): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);

export class ConflictError extends KioskError {
  constructor(public conflicts: { id: string; name?: string; reason: string; holder?: string }[]) {
    super(409, "One or more items cannot be processed.");
  }
}

async function ownerOrgId(ownerUid: string): Promise<string> {
  const d = (await dbAdmin.collection("users").doc(ownerUid).get()).data();
  return d && typeof d.orgId === "string" ? d.orgId : "";
}

/** Resolves the item collection. A custom inventory must belong to the owner or the owner's organization. */
export async function resolveSource(ctx: KioskContext, spec: SourceSpec): Promise<CollectionReference> {
  if (spec.source === "inventory") {
    if (!validId(spec.inventoryId)) throw new KioskError(400, "inventoryId is required.");
    const inv = (await dbAdmin.collection("inventories").doc(spec.inventoryId).get()).data();
    const org = await ownerOrgId(ctx.ownerUid);
    if (!inv || !(inv.ownerId === ctx.ownerUid || (org && inv.orgId === org))) throw new KioskError(404, "Inventory not found.");
    return dbAdmin.collection("inventories").doc(spec.inventoryId).collection("items");
  }
  return dbAdmin.collection("users").doc(ctx.ownerUid).collection("gearLibrary");
}

function shape(id: string, d: any, inventory: boolean) {
  if (!inventory) return { id, ...d };
  return {
    id, name: d.name, brand: d.brand || "", model: d.model || "", category: d.category || "Gear",
    assetTag: d.assetTag || d.id || id, status: d.status || "available", condition: d.condition || "good",
    isSale: d.isSale || false, price: d.price || 0, quantity: d.quantity || 1,
  };
}

export function parseScannedValue(raw: string): string {
  const value = String(raw || "").trim();
  if (!value.includes("/gear/")) return value;
  try {
    const parts = new URL(value).pathname.split("/");
    const i = parts.indexOf("gear");
    if (i !== -1 && parts[i + 1]) return parts[i + 1];
  } catch {
    const tail = value.split("/gear/")[1];
    if (tail) return tail.split("?")[0];
  }
  return value;
}

export async function lookupItem(ctx: KioskContext, spec: SourceSpec, code: string) {
  const col = await resolveSource(ctx, spec);
  const decoded = parseScannedValue(code);
  if (!decoded || decoded.length > 200 || decoded.includes("/")) return null;
  const candidates = Array.from(new Set([decoded, String(code).trim(), decoded.toUpperCase()])).filter(Boolean);
  const [direct, byTag] = await Promise.all([
    col.doc(decoded).get(),
    col.where("assetTag", "in", candidates).limit(1).get(),
  ]);
  const inv = spec.source === "inventory";
  if (direct.exists) return shape(direct.id, direct.data(), inv);
  if (!byTag.empty) return shape(byTag.docs[0].id, byTag.docs[0].data(), inv);
  return null;
}

/**
 * Catalogue search that needs NO composite indexes:
 *  - with `q`: name-prefix range (single-field index) over a bounded window, filters applied in memory;
 *  - without `q`: equality filters + document-id order, paged with a cursor.
 */
export async function searchItems(ctx: KioskContext, spec: SourceSpec & { q?: string; category?: string; status?: string; limit?: number; cursor?: string }) {
  const col = await resolveSource(ctx, spec);
  const inv = spec.source === "inventory";
  const limit = Math.min(Math.max(Math.floor(Number(spec.limit) || 50), 1), 100);
  const q = str(spec.q, 60);
  const category = str(spec.category, 60);
  const status = str(spec.status, 20);
  const catField = inv ? "category" : "primaryCategory";

  if (q) {
    const variants = Array.from(new Set([q, q.charAt(0).toUpperCase() + q.slice(1), q.toLowerCase()]));
    const snaps = await Promise.all(variants.map(v => col.orderBy("name").startAt(v).endAt(v + "").limit(200).get()));
    const byId = new Map<string, any>();
    for (const s of snaps) for (const d of s.docs) byId.set(d.id, shape(d.id, d.data(), inv));
    const tagHit = await lookupItem(ctx, spec, q).catch(() => null);
    if (tagHit) byId.set((tagHit as any).id, tagHit);
    let items = [...byId.values()];
    if (category) items = items.filter(i => (i.primaryCategory || i.category) === category);
    if (status) items = items.filter(i => (i.status || "available") === status);
    items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return { items: items.slice(0, limit), nextCursor: null };
  }

  let query: FirebaseFirestore.Query = col;
  if (category) query = query.where(catField, "==", category);
  if (status) query = query.where("status", "==", status);
  query = query.orderBy(FieldPath.documentId());
  if (spec.cursor && validId(spec.cursor)) query = query.startAfter(spec.cursor);
  const snap = await query.limit(limit + 1).get();
  const docs = snap.docs.slice(0, limit);
  return {
    items: docs.map(d => shape(d.id, d.data(), inv)),
    nextCursor: snap.size > limit ? docs[docs.length - 1].id : null,
  };
}

export async function kioskContextData(ctx: KioskContext) {
  const [userSnap, termSnap, settingsSnap] = await Promise.all([
    dbAdmin.collection("users").doc(ctx.ownerUid).get(),
    dbAdmin.collection("terminals").doc(ctx.terminalId).get(),
    dbAdmin.collection("adminSettings").doc("global").get(),
  ]);
  const user = userSnap.data() || {};
  const orgId = typeof user.orgId === "string" ? user.orgId : "";
  const orgs = await dbAdmin.collection("organizations").where("ownerId", "==", ctx.ownerUid).get();
  const orgIds = orgs.docs.map(d => d.id);
  const [depts, teams, ownInv, orgInv] = await Promise.all([
    Promise.all(orgIds.slice(0, 10).map(id => dbAdmin.collection("departments").where("orgId", "==", id).get())),
    Promise.all(orgIds.slice(0, 10).map(id => dbAdmin.collection("teams").where("orgId", "==", id).get())),
    dbAdmin.collection("inventories").where("ownerId", "==", ctx.ownerUid).get(),
    orgId ? dbAdmin.collection("inventories").where("orgId", "==", orgId).get() : Promise.resolve(null),
  ]);
  const invMap = new Map<string, any>();
  for (const s of [ownInv, orgInv]) if (s) for (const d of s.docs) invMap.set(d.id, { id: d.id, name: d.data().name, description: d.data().description || "", ownerId: d.data().ownerId });
  const t = termSnap.data() || {};
  const kioskConfig = (settingsSnap.data() || {}).kioskConfig || {};
  const flags: Record<string, boolean> = {};
  for (const f of ["kioskOrderMode", "kioskDirectCheckout", "digitalSignatures"]) flags[f] = await ownerHasFeature(ctx.ownerUid, f);
  return {
    terminal: { id: ctx.terminalId, deviceName: t.deviceName || "Kiosk", settings: t.settings || {}, customPreferences: t.customPreferences || {} },
    owner: { displayName: user.displayName || "", orgId, plan: user.plan || "free" },
    config: { mode: kioskConfig.mode || "direct", restrictedStatuses: kioskConfig.restrictedStatuses || [] },
    features: flags,
    organizations: orgs.docs.map(d => ({ id: d.id, ...d.data() })),
    departments: depts.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    teams: teams.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    inventories: [...invMap.values()],
  };
}

async function restrictedStatuses(): Promise<string[]> {
  const cfg = ((await dbAdmin.collection("adminSettings").doc("global").get()).data() || {}).kioskConfig || {};
  return Array.isArray(cfg.restrictedStatuses) ? cfg.restrictedStatuses : [];
}

export interface Holder { name?: string; email?: string }
function cleanHolder(h: Holder | undefined, fallback: string) {
  const email = str(h?.email, 254);
  return { name: str(h?.name, 100) || fallback, email: /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(email) ? email : "" };
}
function cleanItems(items: any): { id: string; qty: number }[] {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) throw new KioskError(400, `Provide 1-${MAX_ITEMS} items.`);
  const seen = new Set<string>();
  return items.map((i: any) => {
    if (!validId(i?.id)) throw new KioskError(400, "Invalid item id.");
    if (seen.has(i.id)) throw new KioskError(400, "Duplicate item in request.");
    seen.add(i.id);
    return { id: i.id, qty: Math.min(Math.max(Math.floor(Number(i.qty) || 1), 1), 100000) };
  });
}

type WritePlan = { ref: DocumentReference; data: Record<string, any> };

/** Reads items (+ kit children) and returns snapshots keyed by id. Must run before any tx write. */
async function readItems(tx: FirebaseFirestore.Transaction, col: CollectionReference, ids: string[]) {
  const snaps = ids.length ? await tx.getAll(...ids.map(id => col.doc(id))) : [];
  const map = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  snaps.forEach(s => map.set(s.id, s));
  const childIds = new Set<string>();
  for (const s of snaps) {
    const d = s.data();
    if (d?.isKit && Array.isArray(d.childItemIds)) d.childItemIds.filter(validId).forEach((c: string) => !map.has(c) && childIds.add(c));
  }
  if (childIds.size > 300) throw new KioskError(400, "Kit is too large to process at once.");
  if (childIds.size) (await tx.getAll(...[...childIds].map(id => col.doc(id)))).forEach(s => map.set(s.id, s));
  return map;
}

export async function checkoutItems(ctx: KioskContext, req: SourceSpec & { items: any; holder?: Holder; signature?: string; expectedReturnDate?: string; notes?: string; orderNumber?: string }) {
  const col = await resolveSource(ctx, req);
  const items = cleanItems(req.items);
  const holder = cleanHolder(req.holder, "Terminal Guest");
  const signature = typeof req.signature === "string" && req.signature.startsWith("data:image/") && req.signature.length <= 400_000 ? req.signature : null;
  const restricted = await restrictedStatuses();

  return dbAdmin.runTransaction(async (tx) => {
    const snaps = await readItems(tx, col, items.map(i => i.id));
    const conflicts: any[] = [];
    for (const { id } of items) {
      const s = snaps.get(id); const d = s?.data();
      if (!s?.exists || !d) conflicts.push({ id, reason: "missing" });
      else if (d.status === "in_use") conflicts.push({ id, name: d.name, reason: "already_out", holder: d.currentHolder || "" });
      else if (restricted.includes(d.status || "available")) conflicts.push({ id, name: d.name, reason: "restricted", status: d.status });
    }
    if (conflicts.length) throw new ConflictError(conflicts); // nothing has been written

    const out: any[] = [];
    for (const { id, qty } of items) {
      const d = snaps.get(id)!.data()!;
      tx.update(col.doc(id), { status: "in_use", currentHolder: holder.name, lastCheckedOut: FieldValue.serverTimestamp() });
      if (d.isKit && Array.isArray(d.childItemIds)) {
        for (const c of d.childItemIds.filter(validId)) {
          if (snaps.get(c)?.exists) tx.update(col.doc(c), { status: "in_use", currentHolder: holder.name, lastCheckedOut: FieldValue.serverTimestamp(), kitId: id });
        }
      }
      const rec = dbAdmin.collection("checkouts").doc();
      tx.set(rec, {
        assetId: id, assetName: d.name, assetType: "item", quantity: qty,
        ownerId: ctx.ownerUid, userId: ctx.ownerUid, terminalId: ctx.terminalId,
        userName: holder.name, userEmail: holder.email,
        checkOutTime: FieldValue.serverTimestamp(), status: "active", signature,
        expectedReturnDate: str(req.expectedReturnDate, 40) || null,
        orderNumber: str(req.orderNumber, 40) || null,
        notes: str(req.notes, 500),
      });
      out.push({ id, name: d.name, assetTag: d.assetTag || "NO-TAG", category: d.category || d.primaryCategory || "Gear", qty, isKit: !!d.isKit, checkoutId: rec.id });
    }
    return { items: out };
  });
}

export async function checkinItems(ctx: KioskContext, req: SourceSpec & { items: any; notes?: string; holder?: Holder }) {
  const col = await resolveSource(ctx, req);
  const items = cleanItems(req.items);
  const holder = cleanHolder(req.holder, "Terminal Guest");

  return dbAdmin.runTransaction(async (tx) => {
    const snaps = await readItems(tx, col, items.map(i => i.id));
    const missing = items.filter(i => !snaps.get(i.id)?.exists).map(i => ({ id: i.id, reason: "missing" }));
    if (missing.length) throw new ConflictError(missing);
    // Open records (status 'active', or 'checked_out' from older kiosk paths). Reads must precede writes.
    const open = await Promise.all(items.map(i =>
      tx.get(dbAdmin.collection("checkouts").where("assetId", "==", i.id).where("status", "in", ["active", "checked_out"]))));

    const out: any[] = [];
    items.forEach((it, idx) => {
      const d = snaps.get(it.id)!.data()!;
      const mine = open[idx].docs.filter(r => r.data().ownerId === ctx.ownerUid || r.data().userId === ctx.ownerUid);
      tx.update(col.doc(it.id), { status: "available", currentHolder: null, lastCheckedIn: FieldValue.serverTimestamp() });
      if (d.isKit && Array.isArray(d.childItemIds)) {
        for (const c of d.childItemIds.filter(validId)) {
          if (snaps.get(c)?.exists) tx.update(col.doc(c), { status: "available", currentHolder: null, lastCheckedIn: FieldValue.serverTimestamp(), kitId: null });
        }
      }
      if (mine.length) mine.forEach(r => tx.update(r.ref, { status: "returned", checkInTime: FieldValue.serverTimestamp() }));
      else {
        tx.set(dbAdmin.collection("checkouts").doc(), {
          assetId: it.id, assetName: d.name, assetType: "item", ownerId: ctx.ownerUid, userId: ctx.ownerUid, terminalId: ctx.terminalId,
          userName: d.currentHolder || holder.name, userEmail: holder.email,
          checkInTime: FieldValue.serverTimestamp(), status: "returned", notes: str(req.notes, 500),
        });
      }
      out.push({ id: it.id, name: d.name, assetTag: d.assetTag || "NO-TAG", wasOut: d.status === "in_use" });
    });
    return { items: out };
  });
}

export async function createOrder(ctx: KioskContext, req: { items: any; guest?: Holder }) {
  const col = dbAdmin.collection("users").doc(ctx.ownerUid).collection("gearLibrary");
  const items = cleanItems(req.items);
  const guest = cleanHolder(req.guest, "Terminal Guest");
  const snaps = await dbAdmin.getAll(...items.map(i => col.doc(i.id)));
  const missing = items.filter((_, i) => !snaps[i].exists).map(i => ({ id: i.id, reason: "missing" }));
  if (missing.length) throw new ConflictError(missing);
  const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const orderItems = items.map((it, i) => {
    const d = snaps[i].data()!;
    return { id: it.id, name: d.name, assetTag: d.assetTag || "NO-TAG", category: d.category || d.primaryCategory || "Gear", qty: it.qty, isKit: !!d.isKit };
  });
  const ref = await dbAdmin.collection("orders").add({
    orderNumber, userName: guest.name, userEmail: guest.email || "guest@terminal.local", items: orderItems, status: "pending",
    createdAt: FieldValue.serverTimestamp(), userId: ctx.ownerUid, ownerId: ctx.ownerUid, terminalId: ctx.terminalId,
  });
  return { id: ref.id, orderNumber, items: orderItems };
}

export async function listPendingOrders(ctx: KioskContext) {
  const snap = await dbAdmin.collection("orders").where("userId", "==", ctx.ownerUid).where("status", "==", "pending").limit(100).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** One transaction: every item is released and the order becomes fulfilled, or nothing changes. */
export async function fulfillOrder(ctx: KioskContext, orderId: string) {
  if (!validId(orderId)) throw new KioskError(400, "Invalid order.");
  const col = dbAdmin.collection("users").doc(ctx.ownerUid).collection("gearLibrary");
  const orderRef = dbAdmin.collection("orders").doc(orderId);
  const restricted = await restrictedStatuses();

  return dbAdmin.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    const order = orderSnap.data();
    if (!order || order.userId !== ctx.ownerUid) throw new KioskError(404, "Order not found.");
    if (order.status !== "pending") throw new KioskError(409, "Order is already processed.");
    const ids: string[] = (order.items || []).map((i: any) => i.id).filter(validId);
    const snaps = await readItems(tx, col, ids);
    const conflicts: any[] = [];
    for (const id of ids) {
      const d = snaps.get(id)?.data();
      if (!d) conflicts.push({ id, reason: "missing" });
      else if (d.status === "in_use") conflicts.push({ id, name: d.name, reason: "already_out", holder: d.currentHolder || "" });
      else if (restricted.includes(d.status || "available")) conflicts.push({ id, name: d.name, reason: "restricted" });
    }
    if (conflicts.length) throw new ConflictError(conflicts);

    for (const id of ids) {
      const d = snaps.get(id)!.data()!;
      tx.update(col.doc(id), { status: "in_use", currentHolder: order.userName, lastCheckedOut: FieldValue.serverTimestamp() });
      if (d.isKit && Array.isArray(d.childItemIds)) {
        for (const c of d.childItemIds.filter(validId)) {
          if (snaps.get(c)?.exists) tx.update(col.doc(c), { status: "in_use", currentHolder: order.userName, lastCheckedOut: FieldValue.serverTimestamp(), kitId: id });
        }
      }
      tx.set(dbAdmin.collection("checkouts").doc(), {
        assetId: id, assetName: d.name, assetType: "item", ownerId: ctx.ownerUid, userId: ctx.ownerUid, terminalId: ctx.terminalId,
        userName: order.userName, userEmail: order.userEmail, checkOutTime: FieldValue.serverTimestamp(), status: "active",
        orderNumber: order.orderNumber, notes: `Checked out via Self-Service Kiosk Order ${order.orderNumber}`,
      });
    }
    tx.update(orderRef, { status: "fulfilled", fulfilledAt: FieldValue.serverTimestamp(), fulfilledByTerminal: ctx.terminalId });
    return { orderNumber: order.orderNumber, released: ids.length };
  });
}
