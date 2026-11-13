import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Frilensa (invoicing and bookkeeping, frilensa.com) connection for a Packer Tools user.
 *
 * Packer Tools stays in charge of the gear; Frilensa handles the money. The user connects with Frilensa's
 * OAuth (authorization code + PKCE, dynamic client registration), and the server then:
 *  - sends their gear to Frilensa (PUT/POST /api/v1/gear): a copy they can turn into services and listings;
 *  - creates draft quotes in Frilensa from Packer Tools rental bookings (POST /api/v1/documents).
 * Frilensa's API only reads and creates drafts: nothing is sent to a client or marked paid from here.
 *
 * Server-only collections (Firestore rules deny clients): frilensaConnections/{uid} (tokens, encrypted
 * when INTEGRATIONS_KEY is set), frilensaOAuthStates/{state}, frilensaClients/{origin hash}.
 */

export const FRILENSA_URL = (process.env.FRILENSA_URL || "https://frilensa.com").replace(/\/+$/, "");
const CONNECTIONS = "frilensaConnections";
const STATES = "frilensaOAuthStates";
const CLIENTS = "frilensaClients";
const STATE_TTL_MS = 10 * 60_000;
const BATCH = 100;

export class FrilensaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Fetch = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

export interface Connection {
  uid: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
  frilensaUrl: string;
  connectedAt: string;
  scope: string;
  /** Which gear to send: everything, or only gear marked available for hire. */
  gearScope: "rentable" | "all";
  lastSync?: { at: string; sent: number; removed: number; errors: number; message?: string };
  account?: { name: string; email: string };
  refreshLeaseUntil?: number;
}

// ---------- Token storage (encrypted at rest when INTEGRATIONS_KEY is set) ----------

const key = () => process.env.INTEGRATIONS_KEY ? crypto.createHash("sha256").update(process.env.INTEGRATIONS_KEY).digest() : null;
export function seal(text: string): string {
  const k = key();
  if (!k) return text;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `enc:${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}
export function unseal(stored: string): string {
  if (!stored.startsWith("enc:")) return stored;
  const k = key();
  if (!k) throw new FrilensaError(500, "The Frilensa connection can't be read: INTEGRATIONS_KEY is not set on the server.");
  const [iv, tag, data] = stored.slice(4).split(".").map(s => Buffer.from(s, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

const form = (body: Record<string, string>) => ({
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString()
});

// ---------- Connecting ----------

/** This server's OAuth client at Frilensa for a redirect URI, registered once and reused. */
async function clientFor(db: Firestore, fetchFn: Fetch, redirectUri: string): Promise<string> {
  const id = crypto.createHash("sha256").update(`${FRILENSA_URL}|${redirectUri}`).digest("hex").slice(0, 40);
  const ref = db.collection(CLIENTS).doc(id);
  const existing = (await ref.get()).data();
  if (existing?.clientId) return existing.clientId;
  const res = await fetchFn(`${FRILENSA_URL}/oauth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Packer Tools", redirect_uris: [redirectUri] })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.client_id) throw new FrilensaError(502, "Frilensa didn't accept the connection request. Try again in a minute.");
  await ref.set({ clientId: body.client_id, redirectUri, frilensaUrl: FRILENSA_URL, createdAt: new Date().toISOString() });
  return body.client_id;
}

/** Starts connecting: returns the Frilensa page to send the user to. */
export async function startConnect(db: Firestore, fetchFn: Fetch, uid: string, redirectUri: string, returnTo = "/profile?tab=frilensa") {
  const clientId = await clientFor(db, fetchFn, redirectUri);
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(24).toString("base64url");
  await db.collection(STATES).doc(state).set({ uid, verifier: seal(verifier), clientId, redirectUri, returnTo, expiresAt: Date.now() + STATE_TTL_MS });
  const url = new URL(`${FRILENSA_URL}/oauth/authorize`);
  Object.entries({
    response_type: "code", client_id: clientId, redirect_uri: redirectUri, state, code_challenge: challenge, code_challenge_method: "S256",
    scope: "read draft", resource: `${FRILENSA_URL}/api/v1`
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

/** Finishes connecting after Frilensa sends the user back. Returns where to send them in Packer Tools. */
export async function finishConnect(db: Firestore, fetchFn: Fetch, state: string, code: string) {
  const ref = db.collection(STATES).doc(String(state).slice(0, 100));
  const saved = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    return snap.data() as any;
  });
  if (!saved || saved.expiresAt < Date.now()) throw new FrilensaError(400, "This connection request has expired. Start again from Packer Tools.");
  const res = await fetchFn(`${FRILENSA_URL}/oauth/token`, form({
    grant_type: "authorization_code", code, code_verifier: unseal(saved.verifier), client_id: saved.clientId, redirect_uri: saved.redirectUri
  }));
  const t = await res.json().catch(() => ({}));
  if (!res.ok || !t.access_token) throw new FrilensaError(502, "Frilensa didn't complete the connection. Start again from Packer Tools.");
  const prev = (await db.collection(CONNECTIONS).doc(saved.uid).get()).data() as Connection | undefined;
  const conn: Connection = {
    uid: saved.uid, accessToken: seal(t.access_token), refreshToken: seal(t.refresh_token || ""), expiresAt: Date.now() + (Number(t.expires_in) || 3600) * 1000,
    clientId: saved.clientId, frilensaUrl: FRILENSA_URL, connectedAt: new Date().toISOString(), scope: String(t.scope || ""),
    gearScope: prev?.gearScope || "rentable"
  };
  await db.collection(CONNECTIONS).doc(saved.uid).set(conn);
  return { uid: saved.uid, returnTo: saved.returnTo || "/profile?tab=frilensa" };
}

export async function getConnection(db: Firestore, uid: string) {
  return (await db.collection(CONNECTIONS).doc(uid).get()).data() as Connection | undefined;
}

/**
 * A working access token. Frilensa's refresh tokens are single use, so only one refresh may run at a time:
 * a short lease on the connection document makes other requests wait for it rather than refresh again.
 */
export async function accessToken(db: Firestore, fetchFn: Fetch, uid: string, wait = (ms: number) => new Promise(r => setTimeout(r, ms))): Promise<string> {
  const ref = db.collection(CONNECTIONS).doc(uid);
  for (let attempt = 0; attempt < 10; attempt++) {
    const conn = (await ref.get()).data() as Connection | undefined;
    if (!conn) throw new FrilensaError(409, "Connect Frilensa first.");
    if (conn.expiresAt > Date.now() + 60_000) return unseal(conn.accessToken);
    const leased = await db.runTransaction(async tx => {
      const c = (await tx.get(ref)).data() as Connection | undefined;
      if (!c || (c.refreshLeaseUntil && c.refreshLeaseUntil > Date.now()) || c.expiresAt > Date.now() + 60_000) return null;
      tx.update(ref, { refreshLeaseUntil: Date.now() + 30_000 });
      return c;
    });
    if (!leased) { await wait(500); continue; }
    const res = await fetchFn(`${FRILENSA_URL}/oauth/token`, form({ grant_type: "refresh_token", refresh_token: unseal(leased.refreshToken), client_id: leased.clientId }));
    const t = await res.json().catch(() => ({}));
    if (!res.ok || !t.access_token) {
      await ref.delete();
      throw new FrilensaError(409, "The Frilensa connection was removed or has expired. Connect Frilensa again.");
    }
    await ref.update({ accessToken: seal(t.access_token), refreshToken: seal(t.refresh_token || ""), expiresAt: Date.now() + (Number(t.expires_in) || 3600) * 1000, refreshLeaseUntil: 0 });
    return t.access_token;
  }
  throw new FrilensaError(503, "Frilensa is busy. Try again in a moment.");
}

/** Calls Frilensa's API as the user. */
export async function api(db: Firestore, fetchFn: Fetch, uid: string, method: string, path: string, body?: unknown) {
  const token = await accessToken(db, fetchFn, uid);
  const res = await fetchFn(`${FRILENSA_URL}/api/v1${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const out = await res.json().catch(() => ({}));
  if (res.status === 401) throw new FrilensaError(409, "The Frilensa connection was removed. Connect Frilensa again.");
  if (!res.ok) throw new FrilensaError(res.status >= 500 ? 502 : 400, out?.error || `Frilensa returned an error (${res.status}).`);
  return out;
}

export async function disconnect(db: Firestore, fetchFn: Fetch, uid: string) {
  const conn = await getConnection(db, uid);
  if (!conn) return;
  // Revoking either token ends the connection in Frilensa too.
  await fetchFn(`${FRILENSA_URL}/oauth/revoke`, form({ token: unseal(conn.refreshToken || conn.accessToken) })).catch(() => {});
  await db.collection(CONNECTIONS).doc(uid).delete();
}

// ---------- Gear ----------

const CONDITION: Record<string, string> = { new: "new", good: "good", fair: "fair", poor: "worn" };
const STATUS: Record<string, string> = { available: "available", in_use: "checked_out", maintenance: "maintenance", retired: "retired", missing: "missing" };
const today = () => new Date().toISOString().slice(0, 10);
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);

/** True for gear bookings that still hold the dates (not cancelled or declined). */
export const bookingHolds = (b: any) => !/cancel|declin|reject/i.test(`${b?.paymentStatus || ""} ${b?.status || ""}`);

/** One Packer Tools gear item in the shape Frilensa's gear sync takes. */
export function gearForFrilensa(item: any, allById: Map<string, any>, bookings: any[], origin: string) {
  const period = item.rentalPeriod || "day";
  const rate = Number(item.rentalPrice) || 0;
  const kit = [
    ...(Array.isArray(item.addOns) ? item.addOns.map((a: any) => String(a?.name || "").trim()).filter(Boolean) : []),
    ...(Array.isArray(item.childItemIds) ? item.childItemIds.map((id: string) => allById.get(id)?.name).filter(Boolean) : [])
  ];
  const counted = new Map<string, number>();
  kit.forEach(n => counted.set(n, (counted.get(n) || 0) + 1));
  const unavailable = bookings
    .filter(b => b.gearId === item.id && bookingHolds(b) && isDay(b.startDate) && isDay(b.endDate) && String(b.endDate).slice(0, 10) >= today())
    .slice(0, 200)
    .map(b => ({ from: String(b.startDate).slice(0, 10), to: String(b.endDate).slice(0, 10), reason: "Booked" }))
    .filter(u => u.from <= u.to);
  return {
    externalId: item.id,
    name: String(item.name || "Unnamed item").slice(0, 140),
    brand: item.brand || "",
    model: item.model || item.modelNumber || "",
    category: item.primaryCategory || item.category || "",
    description: item.description || "",
    serialNumber: item.serialNumber || "",
    quantity: Math.max(1, Number(item.quantity) || 1),
    ...(rate && period === "day" ? { dayRate: rate } : {}),
    ...(rate && period === "week" ? { weekRate: rate } : {}),
    ...(/^[A-Z]{3}$/.test(String(item.currency || "")) ? { currency: item.currency } : {}),
    ...(Number(item.price) > 0 ? { replacementValue: Number(item.price) } : {}),
    ...(CONDITION[item.condition] ? { condition: CONDITION[item.condition] } : {}),
    status: STATUS[item.status] || "available",
    kit: [...counted.entries()].map(([name, quantity]) => ({ name, quantity })),
    unavailable,
    externalUrl: `${origin}/gear/${encodeURIComponent(item.id)}`,
    updatedAt: item.updatedAt || item.createdAt || undefined
  };
}

/** Sends the user's gear to Frilensa, and removes items that are no longer here. */
export async function syncGear(db: Firestore, fetchFn: Fetch, uid: string, origin: string) {
  const conn = await getConnection(db, uid);
  if (!conn) throw new FrilensaError(409, "Connect Frilensa first.");
  const [gearSnap, bookingSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("gearLibrary").get(),
    db.collection("gearBookings").where("ownerId", "==", uid).get()
  ]);
  const all = gearSnap.docs.map(d => ({ ...d.data(), id: d.id })) as any[];
  const byId = new Map(all.map(g => [g.id, g]));
  const chosen = all.filter(g => g.status !== "retired" || conn.gearScope === "all")
    .filter(g => conn.gearScope === "all" || g.isAvailableForRent || g.marketplaceType === "rental" || g.marketplaceType === "both" || Number(g.rentalPrice) > 0);
  const bookings = bookingSnap.docs.map(d => d.data());
  const items = chosen.map(g => gearForFrilensa(g, byId, bookings, origin));

  let sent = 0, errors = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const r = await api(db, fetchFn, uid, "POST", "/gear/batch", { source: "packer_tools", sourceName: "Packer Tools", items: items.slice(i, i + BATCH) });
    sent += (r.added || 0) + (r.updated || 0);
    errors += (r.errors || []).length;
  }
  // Anything Frilensa still has from Packer Tools that isn't sent any more is marked removed there.
  const there = await api(db, fetchFn, uid, "GET", "/gear?source=packer_tools");
  const keep = new Set(items.map(i => i.externalId));
  let removed = 0;
  for (const g of (there.gear || []) as { externalId: string }[]) {
    if (keep.has(g.externalId)) continue;
    await api(db, fetchFn, uid, "DELETE", `/gear/${encodeURIComponent(g.externalId)}?source=packer_tools`);
    removed++;
  }
  const lastSync = { at: new Date().toISOString(), sent, removed, errors };
  await db.collection(CONNECTIONS).doc(uid).update({ lastSync });
  return lastSync;
}

// ---------- Quotes from bookings ----------

const days = (from: string, to: string) => Math.max(1, Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000) + 1);

/** The draft quote for a Packer Tools gear booking: the hire, any transport, and the deposit noted. */
export function quoteForBooking(b: any, clientId: string) {
  const n = isDay(b.startDate) && isDay(b.endDate) ? days(b.startDate, b.endDate) : 1;
  const tax = Number(b.taxAmount) || 0;
  const transit = Number(b.pickupDropoff?.transitCost) || 0;
  const total = Number(b.totalPrice) || 0;
  // Packer Tools' total includes its tax either way; Frilensa adds the business's own VAT, so it's left out here.
  const hire = Math.max(0, total - tax - transit);
  const items: { name: string; description?: string; quantity: number; rate: number }[] = [{
    name: `${b.gearName || "Gear"} hire`,
    description: `${String(b.startDate).slice(0, 10)} to ${String(b.endDate).slice(0, 10)} (${n} day${n === 1 ? "" : "s"})${b.brand ? `, ${b.brand}` : ""}`,
    quantity: n, rate: Math.round((hire / n) * 100) / 100
  }];
  if (transit > 0) items.push({ name: "Delivery and collection", ...(b.pickupDropoff?.distanceKm ? { description: `${b.pickupDropoff.distanceKm} km` } : {}), quantity: 1, rate: transit });
  const deposit = Number(b.depositAmount ?? b.deposit) || 0;
  return {
    type: "quote", clientId, items,
    notes: [deposit > 0 ? `Refundable deposit: ${deposit.toFixed(2)}.` : "", `From Packer Tools booking ${b.id || ""}.`].filter(Boolean).join(" ")
  };
}

/** Creates a draft quote in Frilensa for one of the user's gear bookings, with the client found or added. */
export async function createQuoteForBooking(db: Firestore, fetchFn: Fetch, uid: string, bookingId: string) {
  const ref = db.collection("gearBookings").doc(String(bookingId).slice(0, 200));
  const snap = await ref.get();
  const b = snap.data();
  if (!b || b.ownerId !== uid) throw new FrilensaError(404, "Booking not found.");
  if (b.frilensaQuote?.number) throw new FrilensaError(409, `This booking already has quote ${b.frilensaQuote.number} in Frilensa.`);
  const email = String(b.clientEmail || "").trim().toLowerCase();
  const name = String(b.clientName || "").trim() || email || "Packer Tools client";
  let clientId = "";
  if (email) {
    const found = await api(db, fetchFn, uid, "GET", `/clients?search=${encodeURIComponent(email)}&limit=5`);
    clientId = (found.clients || []).find((c: any) => String(c.email || "").toLowerCase() === email)?.id || "";
  }
  if (!clientId) {
    const created = await api(db, fetchFn, uid, "POST", "/clients", { name, ...(email ? { email } : {}), ...(b.clientPhone ? { phone: String(b.clientPhone) } : {}) });
    clientId = created.client?.id;
    if (!clientId) throw new FrilensaError(502, "Frilensa didn't add the client. Try again.");
  }
  const out = await api(db, fetchFn, uid, "POST", "/documents", quoteForBooking({ ...b, id: snap.id }, clientId));
  const doc = out.document || {};
  const frilensaQuote = { id: doc.id || "", number: doc.number || "", total: doc.total ?? null, createdAt: new Date().toISOString() };
  await ref.update({ frilensaQuote });
  return frilensaQuote;
}
