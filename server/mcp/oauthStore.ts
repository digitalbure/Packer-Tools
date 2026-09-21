import crypto from "crypto";
import { admin, dbAdmin } from "../firebaseAdmin";

/**
 * Firestore-backed OAuth 2.1 state for the MCP connector. Collections are server-only
 * (no client rules => default deny). Secrets are stored as SHA-256 hashes, never in plaintext.
 * Recommended: enable a Firestore TTL policy on the `expiresAt` field of each collection.
 */
export const ACCESS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const CODE_TTL_MS = 5 * 60 * 1000;

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const rand = (prefix: string, bytes = 32) => `${prefix}_${crypto.randomBytes(bytes).toString("base64url")}`;

export interface McpClient { clientId: string; name: string; redirectUris: string[] }

export async function registerClient(name: string, redirectUris: string[]): Promise<McpClient> {
  const clientId = rand("ptc", 18);
  await dbAdmin.collection("mcpClients").doc(clientId).set({
    name, redirectUris, createdAt: new Date().toISOString(),
  });
  return { clientId, name, redirectUris };
}

export async function getClient(clientId: string): Promise<McpClient | null> {
  if (typeof clientId !== "string" || !/^ptc_[A-Za-z0-9_-]{10,64}$/.test(clientId)) return null;
  const snap = await dbAdmin.collection("mcpClients").doc(clientId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { clientId, name: String(d.name || "MCP client"), redirectUris: Array.isArray(d.redirectUris) ? d.redirectUris : [] };
}

export async function createAuthCode(p: { uid: string; clientId: string; redirectUri: string; codeChallenge: string; scope: string }): Promise<string> {
  const code = rand("ptcode");
  await dbAdmin.collection("mcpAuthCodes").doc(sha256(code)).set({
    ...p, expiresAt: new Date(Date.now() + CODE_TTL_MS), createdAt: new Date().toISOString(),
  });
  return code;
}

/** Single-use: the code document is deleted inside the same transaction that reads it. */
export async function consumeAuthCode(code: string) {
  if (typeof code !== "string" || code.length > 200) return null;
  const ref = dbAdmin.collection("mcpAuthCodes").doc(sha256(code));
  return dbAdmin.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    const d = snap.data()!;
    if (d.expiresAt.toMillis() < Date.now()) return null;
    return d as { uid: string; clientId: string; redirectUri: string; codeChallenge: string; scope: string };
  });
}

export async function issueTokens(uid: string, clientId: string, scope: string) {
  const access = rand("ptat");
  const refresh = rand("ptrt");
  const batch = dbAdmin.batch();
  batch.set(dbAdmin.collection("mcpTokens").doc(sha256(access)), {
    uid, clientId, scope, expiresAt: new Date(Date.now() + ACCESS_TTL_MS), createdAt: new Date().toISOString(),
  });
  batch.set(dbAdmin.collection("mcpRefresh").doc(sha256(refresh)), {
    uid, clientId, scope, expiresAt: new Date(Date.now() + REFRESH_TTL_MS), createdAt: new Date().toISOString(),
  });
  await batch.commit();
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: ACCESS_TTL_MS / 1000, scope };
}

/** Rotating refresh tokens: the presented token is consumed; a replayed token yields nothing. */
export async function consumeRefreshToken(token: string, clientId: string) {
  if (typeof token !== "string" || token.length > 200) return null;
  const ref = dbAdmin.collection("mcpRefresh").doc(sha256(token));
  return dbAdmin.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    const d = snap.data()!;
    if (d.clientId !== clientId || d.expiresAt.toMillis() < Date.now()) return null;
    return d as { uid: string; clientId: string; scope: string };
  });
}

const cache = new Map<string, { uid: string; scope: string; until: number }>();

/** Resolves a bearer access token to a user. Positive results are cached for 30s. */
export async function verifyAccessToken(token: string): Promise<{ uid: string; scope: string } | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const h = sha256(token);
  const hit = cache.get(h);
  if (hit && hit.until > Date.now()) return { uid: hit.uid, scope: hit.scope };
  const snap = await dbAdmin.collection("mcpTokens").doc(h).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (d.expiresAt.toMillis() < Date.now()) return null;
  cache.set(h, { uid: d.uid, scope: d.scope, until: Math.min(Date.now() + 30_000, d.expiresAt.toMillis()) });
  if (cache.size > 5000) cache.clear();
  return { uid: d.uid, scope: d.scope };
}

/** Revoke every MCP grant for a user (e.g. "disconnect" or account compromise). */
export async function revokeAllForUser(uid: string) {
  for (const col of ["mcpTokens", "mcpRefresh"]) {
    const snap = await dbAdmin.collection(col).where("uid", "==", uid).get();
    const batch = dbAdmin.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  cache.clear();
}

export async function verifyFirebaseUser(idToken: string) {
  const decoded = await admin.auth().verifyIdToken(idToken, true);
  const user = await admin.auth().getUser(decoded.uid);
  if (user.disabled) throw new Error("Account disabled");
  return { uid: decoded.uid, email: user.email || decoded.email || "", name: user.displayName || "" };
}

export function pkceMatches(verifier: string, challenge: string): boolean {
  if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) return false;
  const computed = crypto.createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed), b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
