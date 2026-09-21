import crypto from "crypto";
import { dbAdmin } from "../firebaseAdmin";
import { ownerHasFeature } from "./entitlements";

/**
 * Trust model: a kiosk device is trusted ONLY through server-written records.
 *   kioskGrants/{terminalId}  created by the owner's authenticated activation call
 *   kioskTokens/{sha256}      issued to the device for that grant
 * The client-writable `terminals` document is never trusted on its own (any signed-in user can edit a pending one).
 * Both collections are server-only (no client rules => denied).
 */
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class KioskError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface KioskContext { ownerUid: string; terminalId: string }

/** Owner enters the 6-digit code shown on the tablet. Fails closed on ambiguity (see comment). */
export async function activateTerminal(ownerUid: string, pairingCode: string): Promise<{ terminalId: string; deviceName: string }> {
  if (!/^\d{6}$/.test(pairingCode || "")) throw new KioskError(400, "Enter the 6-digit code shown on the kiosk.");
  if (!(await ownerHasFeature(ownerUid, "kioskMode"))) throw new KioskError(403, "Your current plan does not include Kiosk Mode.");

  const snap = await dbAdmin.collection("terminals").where("pairingCode", "==", pairingCode).where("status", "==", "pending").limit(3).get();
  if (snap.empty) throw new KioskError(404, "Invalid or expired pairing code.");
  // Anyone signed in can create a pending terminal with any code. If two match we cannot know which tablet the
  // owner is looking at, so refuse rather than risk pairing someone else's device to this account.
  if (snap.size > 1) throw new KioskError(409, "That code is not unique. Refresh the PIN on the kiosk and try again.");

  const doc = snap.docs[0];
  const now = new Date().toISOString();
  await dbAdmin.collection("kioskGrants").doc(doc.id).set({
    ownerUid, codeHash: sha256(pairingCode), activatedAt: now,
  });
  await doc.ref.update({ status: "active", ownerUid, lastActive: now });
  return { terminalId: doc.id, deviceName: String(doc.data().deviceName || "Kiosk") };
}

async function issueToken(terminalId: string, ownerUid: string) {
  const token = `ptk_${crypto.randomBytes(32).toString("base64url")}`;
  await dbAdmin.collection("kioskTokens").doc(sha256(token)).set({
    terminalId, ownerUid, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return { token, expiresIn: TOKEN_TTL_MS / 1000 };
}

/** The device proves it is the tablet that showed the code (terminal id + the code the owner entered). */
export async function createSession(terminalId: string, pairingCode: string) {
  if (typeof terminalId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(terminalId)) throw new KioskError(400, "Invalid terminal.");
  const [grantSnap, termSnap] = await Promise.all([
    dbAdmin.collection("kioskGrants").doc(terminalId).get(),
    dbAdmin.collection("terminals").doc(terminalId).get(),
  ]);
  const grant = grantSnap.data();
  const term = termSnap.data();
  const codeOk = !!grant && typeof pairingCode === "string" && crypto.timingSafeEqual(
    Buffer.from(sha256(pairingCode)), Buffer.from(grant.codeHash));
  if (!grant || !codeOk || !term || term.status !== "active" || term.ownerUid !== grant.ownerUid) {
    throw new KioskError(401, "This kiosk is not activated. Pair it from the owner's dashboard.");
  }
  if (!(await ownerHasFeature(grant.ownerUid, "kioskMode"))) throw new KioskError(403, "Kiosk Mode is not included in the owner's plan.");
  return { ...(await issueToken(terminalId, grant.ownerUid)), terminalId };
}

/** Rotation: the presented token is consumed and replaced. */
export async function refreshSession(token: string, ctx: KioskContext) {
  await dbAdmin.collection("kioskTokens").doc(sha256(token)).delete();
  tokenCache.clear();
  return { ...(await issueToken(ctx.terminalId, ctx.ownerUid)), terminalId: ctx.terminalId };
}

const tokenCache = new Map<string, { ctx: KioskContext; until: number }>();

/** Validates bearer token AND that the grant, terminal document and plan entitlement are all still good. Cached 30s. */
export async function verifyKioskToken(token: string): Promise<KioskContext | null> {
  if (typeof token !== "string" || !token.startsWith("ptk_") || token.length > 200) return null;
  const h = sha256(token);
  const hit = tokenCache.get(h);
  if (hit && hit.until > Date.now()) return hit.ctx;

  const snap = await dbAdmin.collection("kioskTokens").doc(h).get();
  const t = snap.data();
  if (!t || t.expiresAt.toMillis() < Date.now()) return null;
  const [grant, term] = await Promise.all([
    dbAdmin.collection("kioskGrants").doc(t.terminalId).get(),
    dbAdmin.collection("terminals").doc(t.terminalId).get(),
  ]);
  const g = grant.data(), d = term.data();
  if (!g || g.ownerUid !== t.ownerUid || !d || d.status !== "active" || d.ownerUid !== t.ownerUid) return null;
  if (!(await ownerHasFeature(t.ownerUid, "kioskMode"))) return null;

  const ctx = { ownerUid: t.ownerUid, terminalId: t.terminalId };
  tokenCache.set(h, { ctx, until: Date.now() + 30_000 });
  if (tokenCache.size > 5000) tokenCache.clear();
  return ctx;
}

/** Test helper: drop the in-process token cache. */
export function clearKioskTokenCache() { tokenCache.clear(); }

/** Owner unpairs a device: grant and tokens go immediately; the terminal returns to pending. */
export async function revokeTerminal(ownerUid: string, terminalId: string) {
  const ref = dbAdmin.collection("terminals").doc(terminalId);
  const term = (await ref.get()).data();
  const grant = (await dbAdmin.collection("kioskGrants").doc(terminalId).get()).data();
  if ((!term || term.ownerUid !== ownerUid) && (!grant || grant.ownerUid !== ownerUid)) throw new KioskError(404, "Terminal not found.");
  await dbAdmin.collection("kioskGrants").doc(terminalId).delete();
  const tokens = await dbAdmin.collection("kioskTokens").where("terminalId", "==", terminalId).get();
  const batch = dbAdmin.batch();
  tokens.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  if (term) await ref.update({ status: "pending", ownerUid: null });
  tokenCache.clear();
}
