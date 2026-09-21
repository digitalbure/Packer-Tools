/** Kiosk API: two-tenant isolation, atomicity and trust model (Firebase Auth + Firestore emulators). */
import express from "express";
import kioskRouter from "../server/routes/kiosk";
import { dbAdmin } from "../server/firebaseAdmin";
import { clearKioskTokenCache } from "../server/kiosk/store";
import { clearEntitlementCache } from "../server/kiosk/entitlements";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };

const app = express(); app.use(express.json({ limit: "2mb" })); app.set("trust proxy", 1); app.use(kioskRouter);
const srv = app.listen(0); const base = `http://localhost:${(srv.address() as any).port}`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const realFetch = globalThis.fetch;

async function mkUser(email: string, plan: string) {
  const r: any = await (await realFetch(`${AUTH}/accounts:signUp?key=x`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "pw123456", returnSecureToken: true }) })).json();
  await dbAdmin.collection("users").doc(r.localId).set({ uid: r.localId, email, plan, displayName: email.split("@")[0], orgId: `org_${email[0]}` });
  return { uid: r.localId as string, idToken: r.idToken as string };
}
const call = async (method: string, path: string, token?: string, body?: any) => {
  const res = await realFetch(base + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) as any };
};
const get = async (col: string, id: string) => (await dbAdmin.collection(col).doc(id).get()).data();

// ---------- seed ----------
await dbAdmin.collection("adminSettings").doc("global").set({ plans: [{ id: "pro", features: ["kioskMode", "kioskOrderMode"] }, { id: "free", features: [] }], kioskConfig: { mode: "direct", restrictedStatuses: ["maintenance"] } });
const A = await mkUser("a@own.dev", "pro"), B = await mkUser("b@own.dev", "pro"), C = await mkUser("c@own.dev", "free");
const items = (uid: string) => dbAdmin.collection("users").doc(uid).collection("gearLibrary");
for (const [id, extra] of [["a1", { name: "Alpha Cam", assetTag: "TAG-A1", primaryCategory: "Camera" }], ["a2", { name: "Alpha Lens", assetTag: "TAG-A2", primaryCategory: "Lens" }], ["a3", { name: "Alpha Mic", assetTag: "TAG-A3", primaryCategory: "Audio" }],
  ["a4", { name: "Broken Light", assetTag: "TAG-A4", status: "maintenance", primaryCategory: "Lighting" }], ["a5", { name: "Alpha Tripod", assetTag: "TAG-A5", primaryCategory: "Support" }],
  ["kit1", { name: "Alpha Kit", assetTag: "TAG-K1", isKit: true, childItemIds: ["kc1", "kc2"] }], ["kc1", { name: "Kit Body" }], ["kc2", { name: "Kit Lens" }]] as any[])
  await items(A.uid).doc(id).set({ ownerId: A.uid, status: "available", ...extra });
await items(B.uid).doc("b1").set({ ownerId: B.uid, name: "Bravo Cam", assetTag: "TAG-B1", status: "available" });
await dbAdmin.collection("inventories").doc("invA").set({ ownerId: A.uid, name: "A Sheet" });
await dbAdmin.collection("inventories").doc("invA").collection("items").doc("r1").set({ name: "A Cable", assetTag: "CBL-A", status: "available" });
await dbAdmin.collection("inventories").doc("invB").set({ ownerId: B.uid, name: "B Sheet" });
await dbAdmin.collection("inventories").doc("invB").collection("items").doc("rb").set({ name: "B Cable", assetTag: "CBL-B", status: "available" });
await dbAdmin.collection("organizations").doc("orgA").set({ ownerId: A.uid, name: "A Org" });
await dbAdmin.collection("organizations").doc("orgB").set({ ownerId: B.uid, name: "B Org" });
const pending = async (id: string, code: string) => dbAdmin.collection("terminals").doc(id).set({ pairingCode: code, status: "pending", deviceName: `Tablet ${id}`, settings: { mode: "both" } });
await pending("tabletAAAAAAAA", "111111"); await pending("tabletBBBBBBBB", "222222"); await pending("tabletCCCCCCCC", "333333");
await pending("dupOne1234567", "444444"); await pending("dupTwo1234567", "444444");

// ---------- activation ----------
check("activation without login -> 401", (await call("POST", "/api/kiosk/terminals/activate", undefined, { pairingCode: "111111" })).status === 401);
check("bad code format -> 400", (await call("POST", "/api/kiosk/terminals/activate", A.idToken, { pairingCode: "12" })).status === 400);
check("unknown code -> 404", (await call("POST", "/api/kiosk/terminals/activate", A.idToken, { pairingCode: "999999" })).status === 404);
check("plan without kiosk feature -> 403", (await call("POST", "/api/kiosk/terminals/activate", C.idToken, { pairingCode: "333333" })).status === 403);
check("ambiguous (duplicate) code refuses to pair", (await call("POST", "/api/kiosk/terminals/activate", A.idToken, { pairingCode: "444444" })).status === 409);
const actA = await call("POST", "/api/kiosk/terminals/activate", A.idToken, { pairingCode: "111111" });
check("owner A activates their tablet", actA.status === 200 && actA.data.terminalId === "tabletAAAAAAAA");
const actB = await call("POST", "/api/kiosk/terminals/activate", B.idToken, { pairingCode: "222222" });
check("owner B activates their tablet", actB.status === 200);
check("terminal doc bound to the activating owner", (await get("terminals", "tabletAAAAAAAA"))?.ownerUid === A.uid);

// ---------- session / trust ----------
check("session with wrong code -> 401", (await call("POST", "/api/kiosk/session", undefined, { terminalId: "tabletAAAAAAAA", pairingCode: "000000" })).status === 401);
// Attack: any signed-in user can rewrite a pending terminal doc to point at a victim. No grant => no token.
await dbAdmin.collection("terminals").doc("tabletCCCCCCCC").update({ status: "active", ownerUid: A.uid });
check("forged 'active' terminal without a server grant gets no token", (await call("POST", "/api/kiosk/session", undefined, { terminalId: "tabletCCCCCCCC", pairingCode: "333333" })).status === 401);
const sA = await call("POST", "/api/kiosk/session", undefined, { terminalId: "tabletAAAAAAAA", pairingCode: "111111" });
const sB = await call("POST", "/api/kiosk/session", undefined, { terminalId: "tabletBBBBBBBB", pairingCode: "222222" });
check("activated tablets receive tokens", !!sA.data.token && !!sB.data.token);
const TA = sA.data.token, TB = sB.data.token;
check("no token -> 401", (await call("GET", "/api/kiosk/context")).status === 401);
check("owner ID token is not a kiosk token", (await call("GET", "/api/kiosk/context", A.idToken)).status === 401);
check("tokens stored hashed", !JSON.stringify((await dbAdmin.collection("kioskTokens").get()).docs.map(d => ({ id: d.id, ...d.data() }))).includes(TA));

// ---------- context isolation ----------
const ctxA = await call("GET", "/api/kiosk/context", TA);
check("context shows only A's inventories/orgs", ctxA.data.inventories.map((i: any) => i.id).join() === "invA" && ctxA.data.organizations.map((o: any) => o.id).join() === "orgA", JSON.stringify(ctxA.data.inventories));
check("context exposes plan feature flags", ctxA.data.features.kioskOrderMode === true && ctxA.data.features.digitalSignatures === false);

// ---------- lookup / search ----------
const L = (t: string, q: string) => call("GET", `/api/kiosk/items/lookup?code=${encodeURIComponent(q)}`, t);
check("lookup by id / tag / lower-case tag / QR URL", (await L(TA, "a1")).data.item?.id === "a1" && (await L(TA, "TAG-A1")).data.item?.id === "a1" && (await L(TA, "tag-a1")).data.item?.id === "a1" && (await L(TA, "https://packer.tools/gear/a1?x=1")).data.item?.id === "a1");
check("A cannot look up B's item by id or tag", (await L(TA, "b1")).status === 404 && (await L(TA, "TAG-B1")).status === 404);
check("A cannot read B's inventory", (await call("GET", "/api/kiosk/items?source=inventory&inventoryId=invB", TA)).status === 404);
check("A can read own inventory items", (await call("GET", "/api/kiosk/items?source=inventory&inventoryId=invA", TA)).data.items?.[0]?.id === "r1");
const page1 = await call("GET", "/api/kiosk/items?limit=3", TA);
const page2 = await call("GET", `/api/kiosk/items?limit=3&cursor=${page1.data.nextCursor}`, TA);
const allIds = [...page1.data.items, ...page2.data.items].map((i: any) => i.id);
check("catalogue pages with a cursor and no duplicates", page1.data.items.length === 3 && !!page1.data.nextCursor && new Set(allIds).size === allIds.length && page2.data.items.length > 0, JSON.stringify(allIds));
check("catalogue never contains B's items", ![...page1.data.items, ...page2.data.items].some((i: any) => i.id === "b1"));
check("name-prefix search", (await call("GET", "/api/kiosk/items?q=Alpha%20L", TA)).data.items.map((i: any) => i.id).join() === "a2");
check("category filter", (await call("GET", "/api/kiosk/items?category=Camera", TA)).data.items.map((i: any) => i.id).join() === "a1");

// ---------- checkout: atomic, isolated ----------
const race = await Promise.all(Array.from({ length: 6 }, (_, i) => call("POST", "/api/kiosk/checkout", TA, { items: [{ id: "a2" }], holder: { name: `Guest ${i}`, email: "g@x.dev" } })));
check("6 simultaneous check-outs of one item: exactly one wins", race.filter(r => r.status === 200).length === 1 && race.filter(r => r.status === 409).length === 5, race.map(r => r.status).join());
const recsA2 = (await dbAdmin.collection("checkouts").where("assetId", "==", "a2").where("ownerId", "==", A.uid).get()).docs.map(d => d.data());
check("exactly one open record, stamped with owner and terminal", recsA2.length === 1 && recsA2[0].ownerId === A.uid && recsA2[0].terminalId === "tabletAAAAAAAA" && recsA2[0].status === "active");
const multi = await call("POST", "/api/kiosk/checkout", TA, { items: [{ id: "a3" }, { id: "a2" }], holder: { name: "Zed" } });
check("bulk is all-or-nothing (one conflict blocks everything)", multi.status === 409 && multi.data.conflicts[0].reason === "already_out" && (await get("users/" + A.uid + "/gearLibrary", "a3"))?.status === "available");
check("restricted status blocks check-out", (await call("POST", "/api/kiosk/checkout", TA, { items: [{ id: "a4" }] })).data.conflicts?.[0]?.reason === "restricted");
const cross = await call("POST", "/api/kiosk/checkout", TA, { items: [{ id: "b1" }], holder: { name: "Thief" } });
check("A cannot check out B's item (treated as missing)", cross.status === 409 && cross.data.conflicts[0].reason === "missing" && (await get("users/" + B.uid + "/gearLibrary", "b1"))?.status === "available");
const kitOut = await call("POST", "/api/kiosk/checkout", TA, { items: [{ id: "kit1" }], holder: { name: "Kit Holder" }, signature: "data:image/png;base64,AAAA", expectedReturnDate: "2026-12-01" });
check("kit check-out marks children in use", kitOut.status === 200 && (await get("users/" + A.uid + "/gearLibrary", "kc1"))?.kitId === "kit1");
check("signature and return date recorded", (await dbAdmin.collection("checkouts").where("assetId", "==", "kit1").where("ownerId", "==", A.uid).get()).docs[0].data().signature === "data:image/png;base64,AAAA");
check("junk signature is dropped", (await call("POST", "/api/kiosk/checkout", TA, { items: [{ id: "a5" }], signature: "javascript:alert(1)" })).status === 200 && (await dbAdmin.collection("checkouts").where("assetId", "==", "a5").where("ownerId", "==", A.uid).get()).docs.some(d => d.data().signature === null));

// ---------- input validation ----------
check("empty items -> 400", (await call("POST", "/api/kiosk/checkout", TA, { items: [] })).status === 400);
check("duplicate ids -> 400", (await call("POST", "/api/kiosk/checkout", TA, { items: [{ id: "a1" }, { id: "a1" }] })).status === 400);
check("path-injection id -> 400", (await call("POST", "/api/kiosk/checkout", TA, { items: [{ id: "a/b" }] })).status === 400);
check("101 items -> 400", (await call("POST", "/api/kiosk/checkout", TA, { items: Array.from({ length: 101 }, (_, i) => ({ id: `x${i}` })) })).status === 400);

// ---------- check-in ----------
await dbAdmin.collection("checkouts").doc("legacyA").set({ assetId: "a5", status: "checked_out", ownerId: A.uid });
await dbAdmin.collection("checkouts").doc("otherTenant").set({ assetId: "a2", status: "active", ownerId: B.uid, userId: B.uid });
const inRes = await call("POST", "/api/kiosk/checkin", TA, { items: [{ id: "a2" }, { id: "a5" }, { id: "kit1" }] });
check("check-in succeeds and reports items", inRes.status === 200 && inRes.data.items.length === 3);
check("open records closed, legacy 'checked_out' too", (await get("checkouts", "legacyA"))?.status === "returned" && (await dbAdmin.collection("checkouts").where("assetId", "==", "a2").where("ownerId", "==", A.uid).get()).docs.every(d => d.data().status === "returned"));
check("another tenant's record with the same asset id is untouched", (await get("checkouts", "otherTenant"))?.status === "active");
check("items and kit children available again", (await get("users/" + A.uid + "/gearLibrary", "a2"))?.status === "available" && (await get("users/" + A.uid + "/gearLibrary", "kc2"))?.status === "available");
check("check-in of a missing/foreign item -> 409", (await call("POST", "/api/kiosk/checkin", TA, { items: [{ id: "b1" }] })).status === 409);

// ---------- orders ----------
const order = await call("POST", "/api/kiosk/orders", TA, { items: [{ id: "a1", qty: 1 }, { id: "a2" }], guest: { name: "Ola", email: "ola@x.dev" } });
check("order created with names/tags from the database", order.status === 201 && order.data.items[0].name === "Alpha Cam" && order.data.items[0].assetTag === "TAG-A1");
check("order for another tenant's item -> 409", (await call("POST", "/api/kiosk/orders", TA, { items: [{ id: "b1" }] })).status === 409);
check("A sees its pending order, B sees none", (await call("GET", "/api/kiosk/orders", TA)).data.orders.length === 1 && (await call("GET", "/api/kiosk/orders", TB)).data.orders.length === 0);
check("B cannot fulfil A's order", (await call("POST", `/api/kiosk/orders/${order.data.id}/fulfill`, TB)).status === 404);
await call("POST", "/api/kiosk/checkout", TA, { items: [{ id: "a2" }], holder: { name: "Someone else" } });
const blocked = await call("POST", `/api/kiosk/orders/${order.data.id}/fulfill`, TA);
check("fulfilment with a conflicting item releases nothing and keeps order pending", blocked.status === 409 && (await get("orders", order.data.id))?.status === "pending" && (await get("users/" + A.uid + "/gearLibrary", "a1"))?.status === "available");
await call("POST", "/api/kiosk/checkin", TA, { items: [{ id: "a2" }] });
const ful = await call("POST", `/api/kiosk/orders/${order.data.id}/fulfill`, TA);
check("fulfilment releases all items and marks the order fulfilled", ful.status === 200 && (await get("orders", order.data.id))?.status === "fulfilled" && (await get("users/" + A.uid + "/gearLibrary", "a1"))?.status === "in_use");
check("order cannot be fulfilled twice", (await call("POST", `/api/kiosk/orders/${order.data.id}/fulfill`, TA)).status === 409);

// ---------- receipt email (Resend stubbed) ----------
let sent: any = null;
process.env.RESEND_API_KEY = "re_test";
globalThis.fetch = (async (url: any, init?: any) => String(url).includes("api.resend.com") ? (sent = JSON.parse(init.body), new Response(JSON.stringify({ id: "re_9" }), { status: 200, headers: { "content-type": "application/json" } })) : realFetch(url, init)) as any;
const rc = await call("POST", "/api/kiosk/receipt", TA, { to: "ola@x.dev", orderNumber: "REC-1", actionType: "checkout", userName: "Ola", items: [{ name: "<b>Cam</b>", assetTag: "T1", qty: 1 }] });
check("receipt sends via Resend", rc.status === 200 && rc.data.success === true && rc.data.resendId === "re_9", JSON.stringify(rc.data));
check("receipt Reply-To is the owner, From is the platform domain", (sent.reply_to === "a@own.dev" || sent.replyTo === "a@own.dev") && /kiosk-no-reply@packer\.tools/.test(sent.from), JSON.stringify(sent));
check("receipt HTML is escaped", !sent.html.includes("<b>Cam</b>") && sent.html.includes("&lt;b&gt;"));
check("receipt rejects a bad recipient", (await call("POST", "/api/kiosk/receipt", TA, { to: "not-an-email" })).status === 400);
globalThis.fetch = realFetch;

// ---------- session refresh / revoke / entitlement ----------
const ref = await call("POST", "/api/kiosk/session/refresh", TA);
check("refresh issues a new token and retires the old one", ref.status === 200 && (await call("GET", "/api/kiosk/context", ref.data.token)).status === 200 && (await call("GET", "/api/kiosk/context", TA)).status === 401);
const TA2 = ref.data.token;
check("B cannot revoke A's terminal", (await call("POST", "/api/kiosk/terminals/tabletAAAAAAAA/revoke", B.idToken)).status === 404 && (await call("GET", "/api/kiosk/context", TA2)).status === 200);
await dbAdmin.collection("users").doc(A.uid).update({ plan: "free" }); clearEntitlementCache(); clearKioskTokenCache();
check("downgrading the plan disables the kiosk", (await call("GET", "/api/kiosk/context", TA2)).status === 401);
await dbAdmin.collection("users").doc(A.uid).update({ plan: "pro" }); clearEntitlementCache(); clearKioskTokenCache();
check("restoring the plan re-enables it", (await call("GET", "/api/kiosk/context", TA2)).status === 200);
check("owner revokes the terminal", (await call("POST", "/api/kiosk/terminals/tabletAAAAAAAA/revoke", A.idToken)).status === 200);
check("revoked token stops working immediately", (await call("GET", "/api/kiosk/context", TA2)).status === 401);
check("revoked terminal returns to pending and cannot open a session", (await get("terminals", "tabletAAAAAAAA"))?.status === "pending" && (await call("POST", "/api/kiosk/session", undefined, { terminalId: "tabletAAAAAAAA", pairingCode: "111111" })).status === 401);
check("B's tablet unaffected by A's revocation", (await call("GET", "/api/kiosk/context", TB)).status === 200);

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
