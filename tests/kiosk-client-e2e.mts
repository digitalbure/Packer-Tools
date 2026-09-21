/** The browser kiosk client (src/lib/kioskApi.ts) against the real kiosk API server. */
import express from "express";
import kioskRouter from "../server/routes/kiosk";
import { dbAdmin } from "../server/firebaseAdmin";
import { kioskApi, KioskApiError, setKioskApiBase, setKioskApiStorage, hasToken, remember } from "../src/lib/kioskApi";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };

const app = express(); app.use(express.json()); app.set("trust proxy", 1); app.use(kioskRouter);
const srv = app.listen(0); setKioskApiBase(`http://localhost:${(srv.address() as any).port}`);
const mem = new Map<string, string>();
setKioskApiStorage({ getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: k => void mem.delete(k) });

const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const su: any = await (await fetch(`${AUTH}/accounts:signUp?key=x`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "client@own.dev", password: "pw123456", returnSecureToken: true }) })).json();
await dbAdmin.collection("users").doc(su.localId).set({ uid: su.localId, email: "client@own.dev", plan: "pro" });
await dbAdmin.collection("adminSettings").doc("global").set({ plans: [{ id: "pro", features: ["kioskMode"] }], kioskConfig: {} });
const gear = dbAdmin.collection("users").doc(su.localId).collection("gearLibrary");
await gear.doc("ca1").set({ ownerId: su.localId, name: "Client Cam", assetTag: "CL-1", status: "available" });
await gear.doc("ca2").set({ ownerId: su.localId, name: "Client Lens", assetTag: "CL-2", status: "available" });
await dbAdmin.collection("terminals").doc("clientTablet001").set({ pairingCode: "555555", status: "pending", deviceName: "Front Desk", settings: {} });

check("no token before pairing", !hasToken());
check("session is refused until the owner activates", (await kioskApi.startSession("clientTablet001", "555555")) === false && !hasToken());
const act = await fetch(`http://localhost:${(srv.address() as any).port}/api/kiosk/terminals/activate`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${su.idToken}` }, body: JSON.stringify({ pairingCode: "555555" }) });
check("owner activation succeeds", act.status === 200);
remember.pairingCode("555555");
check("device opens a session and stores the token", (await kioskApi.startSession("clientTablet001", remember.pairingCodeValue()!)) === true && hasToken());

check("lookup finds an item by tag and returns null when unknown", (await kioskApi.lookup("cl-1"))?.id === "ca1" && (await kioskApi.lookup("NOPE")) === null);
check("catalogue search works", (await kioskApi.search({ q: "Client" })).items.length === 2);
const ctx = await kioskApi.context();
check("context returns the terminal", ctx.terminal.deviceName === "Front Desk");

const out = await kioskApi.checkout({ items: [{ id: "ca1", qty: 1 }], holder: { name: "Ola", email: "ola@x.dev" }, signature: null });
check("checkout returns the released items", out.items[0].id === "ca1" && out.items[0].name === "Client Cam");
let conflict: any; try { await kioskApi.checkout({ items: [{ id: "ca2" }, { id: "ca1" }], holder: { name: "Bob" } }); } catch (e) { conflict = e; }
check("conflict surfaces as KioskApiError with a readable message", conflict instanceof KioskApiError && conflict.status === 409 && /Client Cam is already checked out to Ola/.test(conflict.describe()), conflict?.describe?.());
check("nothing else was released by the failed bulk", (await gear.doc("ca2").get()).data()?.status === "available");
const back = await kioskApi.checkin({ items: [{ id: "ca1" }] });
check("checkin reports the item was out", back.items[0].wasOut === true);

const order = await kioskApi.createOrder({ items: [{ id: "ca1" }], guest: { name: "Ola", email: "ola@x.dev" } });
check("order created; pending list shows it", order.orderNumber.startsWith("ORD-") && (await kioskApi.pendingOrders()).length === 1);
check("fulfilment releases the item", (await kioskApi.fulfillOrder(order.id)).released === 1 && (await gear.doc("ca1").get()).data()?.status === "in_use");

const rf = await kioskApi.refresh();
check("refresh swaps the token and it still works", !!rf.token && (await kioskApi.context()).terminal.id === "clientTablet001");

await kioskApi.forget();
check("forget clears credentials", !hasToken() && remember.pairingCodeValue() === null);
let noTok: any; try { await kioskApi.context(); } catch (e) { noTok = e; }
check("calls without a token fail with 401", noTok instanceof KioskApiError && noTok.status === 401);

// revoked server-side: next call fails with 401 and the client drops its token
remember.pairingCode("555555"); await kioskApi.startSession("clientTablet001", "555555");
await fetch(`http://localhost:${(srv.address() as any).port}/api/kiosk/terminals/clientTablet001/revoke`, { method: "POST", headers: { authorization: `Bearer ${su.idToken}` } });
let revoked: any; try { await kioskApi.context(); } catch (e) { revoked = e; }
check("after revoke the client gets 401 and clears its token (caller falls back)", revoked instanceof KioskApiError && revoked.status === 401 && !hasToken());

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
