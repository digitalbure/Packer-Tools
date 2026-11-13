/**
 * Frilensa connection (server/integrations/frilensa.ts) against the Firestore emulator, with a small
 * stand-in Frilensa server that behaves like the real one: dynamic client registration, PKCE codes,
 * single-use rotating refresh tokens, /api/v1/gear, /clients and /documents.
 */
import crypto from "crypto";
import express from "express";
import type { AddressInfo } from "net";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const fr = { clients: new Map<string, any>(), codes: new Map<string, any>(), access: new Set<string>(), refresh: new Map<string, { used: boolean }>(),
  refreshCalls: 0, gear: new Map<string, any>(), people: [] as any[], docs: [] as any[], revoked: [] as string[] };
const tok = (p: string) => `${p}_${crypto.randomBytes(12).toString("hex")}`;
const issue = () => { const a = tok("fra"), r = tok("frr"); fr.access.add(a); fr.refresh.set(r, { used: false }); return { access_token: a, refresh_token: r, expires_in: 3600, scope: "read draft", token_type: "Bearer" }; };
app.post("/oauth/register", (req, res) => { const id = tok("frc"); fr.clients.set(id, req.body); res.status(201).json({ client_id: id }); });
app.post("/oauth/token", (req, res) => {
  const b = req.body;
  if (b.grant_type === "authorization_code") {
    const c = fr.codes.get(b.code); fr.codes.delete(b.code);
    if (!c || c.redirect_uri !== b.redirect_uri || crypto.createHash("sha256").update(b.code_verifier).digest("base64url") !== c.challenge) return res.status(400).json({ error: "invalid_grant" });
    return res.json(issue());
  }
  if (b.grant_type === "refresh_token") {
    fr.refreshCalls++;
    const r = fr.refresh.get(b.refresh_token);
    if (!r || r.used) return res.status(400).json({ error: "invalid_grant" });
    r.used = true;
    return res.json(issue());
  }
  res.status(400).json({ error: "unsupported_grant_type" });
});
app.post("/oauth/revoke", (req, res) => { fr.revoked.push(req.body.token); res.json({}); });
const authed = (req: any, res: any, next: any) => fr.access.has(String(req.headers.authorization || "").replace("Bearer ", "")) ? next() : res.status(401).json({ error: "expired" });
app.get("/api/v1/me", authed, (_q, res) => res.json({ name: "Ana", email: "ana@reef.fj", activeBusinessId: "b1", businesses: [{ id: "b1", name: "Reef Hire" }] }));
app.post("/api/v1/gear/batch", authed, (req, res) => {
  let added = 0, updated = 0; const errors: any[] = [];
  for (const it of req.body.items) { if (!it.name) { errors.push({ externalId: it.externalId, error: "name" }); continue; } fr.gear.has(it.externalId) ? updated++ : added++; fr.gear.set(it.externalId, { ...it, removed: false }); }
  res.json({ added, updated, errors });
});
app.get("/api/v1/gear", authed, (_q, res) => res.json({ gear: [...fr.gear.values()].filter(g => !g.removed) }));
app.delete("/api/v1/gear/:id", authed, (req, res) => { const g = fr.gear.get(req.params.id); if (!g) return res.status(404).json({ error: "no" }); g.removed = true; res.json({ ok: true }); });
app.get("/api/v1/clients", authed, (req, res) => res.json({ clients: fr.people.filter(c => String(c.email).includes(String(req.query.search || ""))) }));
app.post("/api/v1/clients", authed, (req, res) => { const c = { id: tok("cl"), ...req.body }; fr.people.push(c); res.json({ client: c }); });
app.post("/api/v1/documents", authed, (req, res) => { const d = { id: tok("doc"), number: `QT-${1000 + fr.docs.length}`, total: req.body.items.reduce((s: number, i: any) => s + i.quantity * i.rate, 0), ...req.body }; fr.docs.push(d); res.json({ document: d, note: "draft" }); });
const server = app.listen(0);
const FR = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
process.env.FRILENSA_URL = FR;
process.env.INTEGRATIONS_KEY = "test-integrations-key";

const { dbAdmin } = await import("../server/firebaseAdmin");
const f = await import("../server/integrations/frilensa");
const fetchFn = ((url: string, init?: any) => fetch(url, init)) as any;

let pass = 0, failed = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };
const rejects = async (p: Promise<unknown>, status: number) => { try { await p; return false; } catch (e: any) { return e instanceof f.FrilensaError && e.status === status; } };

const U = "frilensaUser", OTHER = "otherUser";
const REDIRECT = "https://packer.tools/api/integrations/frilensa/callback";

// ---- connecting ----
const url = new URL(await f.startConnect(dbAdmin, fetchFn, U, REDIRECT));
check("sends the user to Frilensa's sign-in page", url.origin === FR && url.pathname === "/oauth/authorize");
check("asks for read and draft access to the REST API with PKCE", url.searchParams.get("scope") === "read draft" && url.searchParams.get("code_challenge_method") === "S256" && url.searchParams.get("resource") === `${FR}/api/v1`);
check("registers one OAuth client", fr.clients.size === 1 && fr.clients.values().next().value.redirect_uris[0] === REDIRECT);
await f.startConnect(dbAdmin, fetchFn, U, REDIRECT);
check("reuses the registered client", fr.clients.size === 1);

const state = url.searchParams.get("state")!;
const code = tok("frx");
fr.codes.set(code, { redirect_uri: REDIRECT, challenge: url.searchParams.get("code_challenge") });
const done = await f.finishConnect(dbAdmin, fetchFn, state, code);
check("finishing connects the user who started", done.uid === U && done.returnTo === "/profile?tab=frilensa");
const stored = (await dbAdmin.collection("frilensaConnections").doc(U).get()).data()!;
check("tokens are stored encrypted", String(stored.accessToken).startsWith("enc:") && !String(stored.accessToken).includes("fra_"));
check("new connections send gear available for hire", stored.gearScope === "rentable");
check("a state can't be used twice", await rejects(f.finishConnect(dbAdmin, fetchFn, state, code), 400));
check("an unknown state is refused", await rejects(f.finishConnect(dbAdmin, fetchFn, "nope", code), 400));

// ---- refreshing: single-use refresh tokens, so concurrent requests refresh once ----
await dbAdmin.collection("frilensaConnections").doc(U).update({ expiresAt: Date.now() - 1000 });
const [t1, t2, t3] = await Promise.all([1, 2, 3].map(() => f.accessToken(dbAdmin, fetchFn, U, ms => new Promise(r => setTimeout(r, Math.min(ms, 100))))));
check("concurrent requests refresh only once", fr.refreshCalls === 1, `refreshed ${fr.refreshCalls} times`);
check("and all get the new token", t1 === t2 && t2 === t3 && fr.access.has(t1));
check("not connected: asks to connect", await rejects(f.accessToken(dbAdmin, fetchFn, OTHER), 409));

// ---- gear ----
const gear = dbAdmin.collection("users").doc(U).collection("gearLibrary");
await gear.doc("cam").set({ name: "FX6", brand: "Sony", modelNumber: "ILME-FX6", primaryCategory: "Cameras", serialNumber: "S1", ownerId: U, isAvailableForRent: true,
  rentalPrice: 450, rentalPeriod: "day", price: 9000, currency: "FJD", condition: "poor", status: "in_use", quantity: 1,
  addOns: [{ name: "Battery", price: 0 }, { name: "Battery", price: 0 }, { name: "24-70 lens", price: 0 }], childItemIds: ["case"], updatedAt: "2026-11-10T00:00:00.000Z", photoUrls: [] });
await gear.doc("case").set({ name: "Peli case", ownerId: U, photoUrls: [] });
await gear.doc("light").set({ name: "Aputure 600d", ownerId: U, marketplaceType: "rental", rentalPrice: 900, rentalPeriod: "week", photoUrls: [] });
const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
const later = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
await dbAdmin.collection("gearBookings").doc("bk1").set({ gearId: "cam", gearName: "FX6", brand: "Sony", ownerId: U, clientName: "Big Pictures", clientEmail: "Prod@BigPictures.fj", clientPhone: "999",
  startDate: future, endDate: later, totalPrice: 1462.5, taxAmount: 162.5, depositAmount: 500, paymentStatus: "Pending Deposit", pickupDropoff: { transitCost: 0 } });
await dbAdmin.collection("gearBookings").doc("bk2").set({ gearId: "cam", ownerId: U, clientName: "Old", startDate: "2020-01-01", endDate: "2020-01-02", paymentStatus: "Deposit Paid" });
await dbAdmin.collection("gearBookings").doc("bk3").set({ gearId: "cam", ownerId: U, clientName: "Gone", startDate: future, endDate: future, paymentStatus: "Cancelled" });
await dbAdmin.collection("gearBookings").doc("bkOther").set({ gearId: "x", ownerId: OTHER, clientName: "X", startDate: future, endDate: future });

let r = await f.syncGear(dbAdmin, fetchFn, U, "https://packer.tools");
check("sends only gear available for hire by default", r.sent === 2 && fr.gear.has("cam") && fr.gear.has("light") && !fr.gear.has("case"), JSON.stringify(r));
const cam = fr.gear.get("cam");
check("maps rates, model, category and value", cam.dayRate === 450 && cam.weekRate === undefined && cam.model === "ILME-FX6" && cam.category === "Cameras" && cam.replacementValue === 9000);
check("maps condition and status", cam.condition === "worn" && cam.status === "checked_out");
check("kit: in-the-box items counted, and items inside the kit", JSON.stringify(cam.kit) === JSON.stringify([{ name: "Battery", quantity: 2 }, { name: "24-70 lens", quantity: 1 }, { name: "Peli case", quantity: 1 }]), JSON.stringify(cam.kit));
check("booked dates: upcoming and not cancelled", cam.unavailable.length === 1 && cam.unavailable[0].from === future && cam.unavailable[0].to === later);
check("links back to the item", cam.externalUrl === "https://packer.tools/gear/cam");
check("weekly rates go as week rates", fr.gear.get("light").weekRate === 900 && fr.gear.get("light").dayRate === undefined);

await dbAdmin.collection("frilensaConnections").doc(U).update({ gearScope: "all" });
r = await f.syncGear(dbAdmin, fetchFn, U, "https://packer.tools");
check("all gear when chosen", r.sent === 3 && fr.gear.has("case"));
await gear.doc("light").delete();
r = await f.syncGear(dbAdmin, fetchFn, U, "https://packer.tools");
check("gear deleted here is marked removed in Frilensa", r.removed === 1 && fr.gear.get("light").removed === true);
const conn = (await dbAdmin.collection("frilensaConnections").doc(U).get()).data()!;
check("the last send is recorded", conn.lastSync?.sent === 2 && conn.lastSync?.removed === 1);
check("not connected: can't send", await rejects(f.syncGear(dbAdmin, fetchFn, OTHER, "https://packer.tools"), 409));

// ---- quotes from bookings ----
const q = f.quoteForBooking({ id: "x", gearName: "FX6", startDate: "2026-12-01", endDate: "2026-12-03", totalPrice: 1462.5, taxAmount: 162.5, depositAmount: 500, pickupDropoff: { transitCost: 100, distanceKm: 12 } }, "c1");
check("quote: hire per day without Packer's tax, transport as its own line", q.items[0].quantity === 3 && q.items[0].rate === 400 && q.items[1].rate === 100 && q.items.length === 2, JSON.stringify(q.items));
check("quote: deposit in the notes", /deposit: 500\.00/.test(q.notes));

const quote = await f.createQuoteForBooking(dbAdmin, fetchFn, U, "bk1");
check("creates a draft quote", quote.number === "QT-1000" && fr.docs[0].type === "quote");
check("adds the client once, by email", fr.people.length === 1 && fr.people[0].email === "prod@bigpictures.fj" && fr.docs[0].clientId === fr.people[0].id);
check("remembers the quote on the booking", (await dbAdmin.collection("gearBookings").doc("bk1").get()).data()?.frilensaQuote?.number === "QT-1000");
check("one quote per booking", await rejects(f.createQuoteForBooking(dbAdmin, fetchFn, U, "bk1"), 409));
await f.createQuoteForBooking(dbAdmin, fetchFn, U, "bk3");
check("a booking without an email adds the client by name", fr.people.length === 2 && fr.people[1].name === "Gone" && !fr.people[1].email);
await dbAdmin.collection("gearBookings").doc("bk4").set({ gearId: "cam", gearName: "FX6", ownerId: U, clientName: "Big Pictures", clientEmail: "prod@bigpictures.fj", startDate: future, endDate: future, totalPrice: 450 });
await f.createQuoteForBooking(dbAdmin, fetchFn, U, "bk4");
check("an existing client is found by email and reused", fr.people.length === 2 && fr.docs[2].clientId === fr.people[0].id);
check("someone else's booking is refused", await rejects(f.createQuoteForBooking(dbAdmin, fetchFn, U, "bkOther"), 404));

// ---- connection removed in Frilensa ----
fr.access.clear();
check("a removed connection asks to reconnect", await rejects(f.api(dbAdmin, fetchFn, U, "GET", "/me"), 409));

// ---- disconnecting ----
await f.disconnect(dbAdmin, fetchFn, U);
check("disconnect revokes in Frilensa and forgets the tokens", fr.revoked.length === 1 && fr.revoked[0].startsWith("frr_") && !(await dbAdmin.collection("frilensaConnections").doc(U).get()).exists);

server.close();
console.log(`\n${pass} passed, ${failed} failed`);
if (failed) process.exit(1);
process.exit(0);
