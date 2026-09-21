import express from "express";
import { admin, dbAdmin } from "../firebaseAdmin";
import { authenticateUser } from "../middleware/auth";
import { rateLimit, escapeDeep, isValidEmail } from "../middleware/security";
import { KioskError, activateTerminal, createSession, refreshSession, revokeTerminal, verifyKioskToken, type KioskContext } from "../kiosk/store";
import * as ops from "../kiosk/ops";
import { renderKioskReceipt, dispatchEmailPayload, safeFrom } from "./email";

/**
 * Kiosk API. Two kinds of caller:
 *   - the OWNER (Firebase ID token): activate / revoke their own terminals;
 *   - the DEVICE (terminal token): everything a kiosk does, scoped to that terminal's one owner.
 */
const router = express.Router();

const wrap = (fn: (req: any, res: express.Response) => Promise<any>) => async (req: any, res: express.Response) => {
  try {
    await fn(req, res);
  } catch (e: any) {
    if (e instanceof ops.ConflictError) return res.status(409).json({ error: e.message, conflicts: e.conflicts });
    if (e instanceof KioskError) return res.status(e.status).json({ error: e.message });
    console.error("[Kiosk API]", req.method, req.path, e.message);
    return res.status(500).json({ error: "The kiosk service failed. Please try again." });
  }
};

async function requireKiosk(req: any, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  let ctx: KioskContext | null = null;
  try { ctx = token ? await verifyKioskToken(token) : null; } catch (e: any) { console.error("[Kiosk auth]", e.message); }
  if (!ctx) return res.status(401).json({ error: "Kiosk is not authorized. Re-pair this device.", code: "kiosk_unauthorized" });
  req.kiosk = ctx;
  req.kioskToken = token;
  next();
}
const perTerminal = (name: string, max: number, windowMs: number) => rateLimit(name, max, windowMs, (req: any) => req.kiosk?.terminalId || req.ip);
const perIp = (name: string, max: number, windowMs: number) => rateLimit(name, max, windowMs, (req: any) => req.ip || "unknown");

// ---------------- owner endpoints ----------------
router.post("/api/kiosk/terminals/activate", authenticateUser, rateLimit("kiosk-activate", 15, 60 * 60 * 1000), wrap(async (req, res) => {
  const result = await activateTerminal(req.user.uid, String(req.body?.pairingCode || ""));
  res.json({ success: true, ...result });
}));

router.post("/api/kiosk/terminals/:id/revoke", authenticateUser, rateLimit("kiosk-revoke", 60, 60 * 60 * 1000), wrap(async (req, res) => {
  await revokeTerminal(req.user.uid, String(req.params.id));
  res.json({ success: true });
}));

// ---------------- device session ----------------
router.post("/api/kiosk/session", perIp("kiosk-session", 30, 60 * 1000), wrap(async (req, res) => {
  res.json(await createSession(String(req.body?.terminalId || ""), String(req.body?.pairingCode || "")));
}));

router.post("/api/kiosk/session/refresh", requireKiosk, perTerminal("kiosk-refresh", 10, 60 * 60 * 1000), wrap(async (req, res) => {
  res.json(await refreshSession(req.kioskToken, req.kiosk));
}));

// ---------------- device endpoints ----------------
const readLimit = perTerminal("kiosk-read", 300, 60 * 1000);
const writeLimit = perTerminal("kiosk-write", 120, 60 * 1000);

router.get("/api/kiosk/context", requireKiosk, readLimit, wrap(async (req, res) => {
  res.json(await ops.kioskContextData(req.kiosk));
}));

const sourceOf = (q: any): ops.SourceSpec => ({ source: q.source === "inventory" ? "inventory" : "library", inventoryId: typeof q.inventoryId === "string" ? q.inventoryId : undefined });

router.get("/api/kiosk/items", requireKiosk, readLimit, wrap(async (req, res) => {
  const q = req.query;
  res.json(await ops.searchItems(req.kiosk, { ...sourceOf(q), q: String(q.q || ""), category: String(q.category || ""), status: String(q.status || ""), limit: Number(q.limit), cursor: String(q.cursor || "") }));
}));

router.get("/api/kiosk/items/lookup", requireKiosk, readLimit, wrap(async (req, res) => {
  const item = await ops.lookupItem(req.kiosk, sourceOf(req.query), String(req.query.code || ""));
  if (!item) return res.status(404).json({ error: "No equipment matches that code." });
  res.json({ item });
}));

router.post("/api/kiosk/checkout", requireKiosk, writeLimit, wrap(async (req, res) => {
  res.json(await ops.checkoutItems(req.kiosk, { ...(req.body || {}), ...sourceOf(req.body || {}) }));
}));

router.post("/api/kiosk/checkin", requireKiosk, writeLimit, wrap(async (req, res) => {
  res.json(await ops.checkinItems(req.kiosk, { ...(req.body || {}), ...sourceOf(req.body || {}) }));
}));

router.post("/api/kiosk/orders", requireKiosk, writeLimit, wrap(async (req, res) => {
  res.status(201).json(await ops.createOrder(req.kiosk, req.body || {}));
}));

router.get("/api/kiosk/orders", requireKiosk, readLimit, wrap(async (req, res) => {
  res.json({ orders: await ops.listPendingOrders(req.kiosk) });
}));

router.post("/api/kiosk/orders/:id/fulfill", requireKiosk, writeLimit, wrap(async (req, res) => {
  res.json(await ops.fulfillOrder(req.kiosk, String(req.params.id)));
}));

// Hand-over receipt: From = platform domain, Reply-To = the owner, so the borrower's reply reaches the customer.
router.post("/api/kiosk/receipt", requireKiosk, perTerminal("kiosk-receipt", 300, 60 * 60 * 1000), wrap(async (req, res) => {
  const b = req.body || {};
  if (!isValidEmail(b.to)) throw new KioskError(400, "A valid recipient email is required.");
  const safe = escapeDeep({
    orderNumber: b.orderNumber, actionType: b.actionType, userName: b.userName,
    items: Array.isArray(b.items) ? b.items.slice(0, 200).map((i: any) => ({ name: i?.name, assetTag: i?.assetTag, category: i?.category, qty: i?.qty })) : [],
    timestamp: b.timestamp, expectedReturnDate: b.expectedReturnDate, locale: b.locale,
  });
  let replyTo: string | undefined;
  try { replyTo = (await admin.auth().getUser(req.kiosk.ownerUid)).email || undefined; } catch { /* no reply-to */ }
  const { subject, html } = renderKioskReceipt({ ...safe, to: b.to });
  res.json(await dispatchEmailPayload(b.to, subject, html, safeFrom("Packer Tools Kiosk", "kiosk-no-reply@packer.tools"), "Packer Tools", undefined, { replyTo }));
}));

export default router;
