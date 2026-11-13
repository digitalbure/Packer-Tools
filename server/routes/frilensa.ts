import express from "express";
import { dbAdmin } from "../firebaseAdmin";
import { authenticateUser } from "../middleware/auth";
import { rateLimit } from "../middleware/security";
import {
  FRILENSA_URL, FrilensaError, api, createQuoteForBooking, disconnect, finishConnect, getConnection, startConnect, syncGear, type Fetch
} from "../integrations/frilensa";

/**
 * Frilensa connection (invoicing and bookkeeping). See server/integrations/frilensa.ts.
 *   POST /api/integrations/frilensa/connect     start connecting (returns the Frilensa page to open)
 *   GET  /api/integrations/frilensa/callback    Frilensa sends the user back here (checked by the one-time state)
 *   GET  /api/integrations/frilensa             connection status
 *   PATCH /api/integrations/frilensa            settings (which gear to send)
 *   POST /api/integrations/frilensa/sync        send gear now
 *   POST /api/integrations/frilensa/quote       draft quote in Frilensa from a gear booking
 *   DELETE /api/integrations/frilensa           disconnect
 */
const router = express.Router();
const fetchFn: Fetch = (url, init) => fetch(url, init) as any;

/** This app's public address as the user reached it (for the redirect back from Frilensa and links to gear), as in routes/mcp.ts. */
function origin(req: express.Request) {
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "packer.tools";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return `${local ? req.protocol : "https"}://${host}`;
}
const callbackUrl = (req: express.Request) => `${origin(req)}/api/integrations/frilensa/callback`;

const wrap = (fn: (req: any, res: express.Response) => Promise<any>) => async (req: any, res: express.Response) => {
  try {
    await fn(req, res);
  } catch (e: any) {
    if (e instanceof FrilensaError) return res.status(e.status).json({ error: e.message });
    console.error("[Frilensa]", req.method, req.path, e.message);
    return res.status(502).json({ error: "Frilensa couldn't be reached. Try again in a minute." });
  }
};
const limit = rateLimit("frilensa", 60, 60 * 1000);

router.post("/api/integrations/frilensa/connect", authenticateUser, limit, wrap(async (req, res) => {
  const url = await startConnect(dbAdmin, fetchFn, req.user.uid, callbackUrl(req));
  res.json({ url });
}));

// No Firebase sign-in on a browser redirect: the one-time state (saved when the user started) says who it is.
router.get("/api/integrations/frilensa/callback", rateLimit("frilensa-callback", 30, 15 * 60 * 1000, r => r.ip || "unknown"), async (req, res) => {
  const back = (path: string, params: Record<string, string>) => {
    const u = new URL(path, origin(req));
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    res.redirect(302, u.pathname + u.search);
  };
  const { code, state, error } = req.query as Record<string, string>;
  if (error || !code || !state) return back("/profile", { tab: "frilensa", frilensa: error === "access_denied" ? "denied" : "failed" });
  try {
    const done = await finishConnect(dbAdmin, fetchFn, state, code);
    const target = done.returnTo.startsWith("/") && !done.returnTo.startsWith("//") ? done.returnTo : "/profile?tab=frilensa";
    const u = new URL(target, origin(req));
    u.searchParams.set("frilensa", "connected");
    res.redirect(302, u.pathname + u.search);
  } catch (e: any) {
    console.error("[Frilensa] callback", e.message);
    back("/profile", { tab: "frilensa", frilensa: "failed" });
  }
});

router.get("/api/integrations/frilensa", authenticateUser, limit, wrap(async (req, res) => {
  const conn = await getConnection(dbAdmin, req.user.uid);
  if (!conn) return res.json({ connected: false, frilensaUrl: FRILENSA_URL });
  // Who it's connected to (refreshes the cached name now and then).
  let account = conn.account;
  if (!account) {
    try {
      const me = await api(dbAdmin, fetchFn, req.user.uid, "GET", "/me");
      account = { name: me.businesses?.find((b: any) => b.id === me.activeBusinessId)?.name || me.businesses?.[0]?.name || me.name || "", email: me.email || "" };
      await dbAdmin.collection("frilensaConnections").doc(req.user.uid).update({ account });
    } catch (e) {
      if (e instanceof FrilensaError && e.status === 409) return res.json({ connected: false, frilensaUrl: FRILENSA_URL, message: e.message });
    }
  }
  res.json({
    connected: true, frilensaUrl: FRILENSA_URL, connectedAt: conn.connectedAt, canCreateDrafts: conn.scope.includes("draft"),
    gearScope: conn.gearScope, lastSync: conn.lastSync || null, account: account || null
  });
}));

router.patch("/api/integrations/frilensa", authenticateUser, limit, wrap(async (req, res) => {
  const conn = await getConnection(dbAdmin, req.user.uid);
  if (!conn) throw new FrilensaError(409, "Connect Frilensa first.");
  const gearScope = req.body?.gearScope === "all" ? "all" : "rentable";
  await dbAdmin.collection("frilensaConnections").doc(req.user.uid).update({ gearScope });
  res.json({ ok: true, gearScope });
}));

router.post("/api/integrations/frilensa/sync", authenticateUser, rateLimit("frilensa-sync", 10, 10 * 60 * 1000), wrap(async (req, res) => {
  const lastSync = await syncGear(dbAdmin, fetchFn, req.user.uid, origin(req));
  res.json({ ok: true, lastSync });
}));

router.post("/api/integrations/frilensa/quote", authenticateUser, rateLimit("frilensa-quote", 30, 10 * 60 * 1000), wrap(async (req, res) => {
  const bookingId = String(req.body?.bookingId || "");
  if (!bookingId) throw new FrilensaError(400, "Choose a booking.");
  const quote = await createQuoteForBooking(dbAdmin, fetchFn, req.user.uid, bookingId);
  res.json({ ok: true, quote });
}));

router.delete("/api/integrations/frilensa", authenticateUser, limit, wrap(async (req, res) => {
  await disconnect(dbAdmin, fetchFn, req.user.uid);
  res.json({ ok: true });
}));

export default router;
