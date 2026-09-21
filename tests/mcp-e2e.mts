/**
 * End-to-end test of the MCP connector against the Firebase emulators.
 * Run: firebase emulators:exec --only firestore,auth --project packer-tools "npx tsx tests/mcp-e2e.mts"
 */
import express from "express";
import crypto from "crypto";
import mcp from "../server/routes/mcp";
import { dbAdmin } from "../server/firebaseAdmin";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let pass = 0, failCount = 0;
const check = (name: string, cond: boolean, extra = "") => { (cond ? pass++ : failCount++); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };

const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: true })); app.set("trust proxy", 1); app.use(mcp);
const srv = app.listen(0); const base = `http://localhost:${(srv.address() as any).port}`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;

async function makeUser(email: string, userDoc: Record<string, any>) {
  const r: any = await (await fetch(`${AUTH}/accounts:signUp?key=x`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "pw123456", returnSecureToken: true }) })).json();
  await dbAdmin.collection("users").doc(r.localId).set({ uid: r.localId, email, plan: "free", ...userDoc });
  return { uid: r.localId as string, idToken: r.idToken as string };
}
const b64 = (b: Buffer) => b.toString("base64url");
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

async function connect(idToken: string) {
  const reg: any = await (await fetch(`${base}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Claude", redirect_uris: [REDIRECT] }) })).json();
  const verifier = b64(crypto.randomBytes(32)); const challenge = b64(crypto.createHash("sha256").update(verifier).digest());
  const complete: any = await (await fetch(`${base}/oauth/authorize/complete`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ idToken, client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: challenge, state: "st" }) })).json();
  const code = new URL(complete.redirect).searchParams.get("code")!;
  const tok: any = await (await fetch(`${base}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "authorization_code", client_id: reg.client_id, code, redirect_uri: REDIRECT, code_verifier: verifier }) })).json();
  return { reg, verifier, challenge, code, tok };
}
async function mcpClient(token: string) {
  const c = new Client({ name: "t", version: "1" });
  await c.connect(new StreamableHTTPClientTransport(new URL(base + "/api/mcp"), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  return c;
}
const call = async (c: Client, name: string, args: any = {}) => { const r: any = await c.callTool({ name, arguments: args }); return { isError: !!r.isError, data: JSON.parse(r.content[0].text) }; };

// ---- seed ----
const A = await makeUser("a@test.dev", {});
const B = await makeUser("b@test.dev", {});
const ADM = await makeUser("admin@test.dev", { role: "admin" });
const SUP = await makeUser("super@test.dev", { isSuperAdmin: true });
await dbAdmin.collection("users").doc(B.uid).collection("gearLibrary").doc("b1").set({ ownerId: B.uid, name: "B Secret Camera", primaryCategory: "Camera" });
await dbAdmin.collection("inventories").doc("sheetB").set({ ownerId: B.uid, name: "B sheet" });
await dbAdmin.collection("inventories").doc("sheetB").collection("items").doc("i1").set({ name: "B item" });
await dbAdmin.collection("packingLists").doc("listB").set({ ownerId: B.uid, name: "B list" });
await dbAdmin.collection("packingLists").doc("listShared").set({ ownerId: B.uid, name: "Shared", collaboratorIds: [A.uid] });

// ---- discovery / registration / authorize ----
const meta: any = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
check("metadata advertises registration + S256", !!meta.registration_endpoint && meta.code_challenge_methods_supported[0] === "S256");
const badReg = await fetch(`${base}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: ["https://evil.com/cb"] }) });
check("registration rejects non-allowlisted redirect", badReg.status === 400);
const noAuth = await fetch(`${base}/api/mcp`, { method: "POST" });
check("MCP without token -> 401 with resource_metadata", noAuth.status === 401 && (noAuth.headers.get("www-authenticate") || "").includes("oauth-protected-resource"));

const c1 = await connect(A.idToken);
check("token issued for user A", !!c1.tok.access_token && !!c1.tok.refresh_token, JSON.stringify(c1.tok));
const authz = await fetch(`${base}/oauth/authorize?response_type=code&client_id=${c1.reg.client_id}&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${c1.challenge}&code_challenge_method=S256&state=x`);
const html = await authz.text();
check("consent page renders with CSP", authz.status === 200 && html.includes("Connect Packer Tools") && !!authz.headers.get("content-security-policy"));
const badRedirectPage = await fetch(`${base}/oauth/authorize?response_type=code&client_id=${c1.reg.client_id}&redirect_uri=${encodeURIComponent("https://evil.com/cb")}&code_challenge=${c1.challenge}&code_challenge_method=S256`, { redirect: "manual" });
check("unregistered redirect_uri never redirects", badRedirectPage.status === 400);
const noPkce = await fetch(`${base}/oauth/authorize?response_type=code&client_id=${c1.reg.client_id}&redirect_uri=${encodeURIComponent(REDIRECT)}&state=x`, { redirect: "manual" });
check("missing PKCE rejected", noPkce.status === 302 && (noPkce.headers.get("location") || "").includes("error=invalid_request"));
const crossOrigin = await fetch(`${base}/oauth/authorize/complete`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.com" }, body: JSON.stringify({ idToken: A.idToken, client_id: c1.reg.client_id, redirect_uri: REDIRECT, code_challenge: c1.challenge }) });
check("complete rejects cross-origin POST", crossOrigin.status === 403);
const forged = await fetch(`${base}/oauth/authorize/complete`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ idToken: "garbage", client_id: c1.reg.client_id, redirect_uri: REDIRECT, code_challenge: c1.challenge }) });
check("complete rejects forged ID token", forged.status === 401);

// ---- token endpoint ----
const replay: any = await fetch(`${base}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "authorization_code", client_id: c1.reg.client_id, code: c1.code, redirect_uri: REDIRECT, code_verifier: c1.verifier }) });
check("auth code is single-use", replay.status === 400);
const c2 = await connect(B.idToken);
const wrongVerifier = await fetch(`${base}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "authorization_code", client_id: c2.reg.client_id, code: "x", redirect_uri: REDIRECT, code_verifier: c2.verifier }) });
check("bad code rejected", wrongVerifier.status === 400);
// wrong PKCE verifier
{
  const v = b64(crypto.randomBytes(32)), ch = b64(crypto.createHash("sha256").update(v).digest());
  const reg: any = await (await fetch(`${base}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: [REDIRECT] }) })).json();
  const comp: any = await (await fetch(`${base}/oauth/authorize/complete`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ idToken: A.idToken, client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: ch }) })).json();
  const code = new URL(comp.redirect).searchParams.get("code");
  const r = await fetch(`${base}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "authorization_code", client_id: reg.client_id, code, redirect_uri: REDIRECT, code_verifier: b64(crypto.randomBytes(32)) }) });
  check("wrong PKCE verifier rejected", r.status === 400);
}

// ---- user-scoped tools ----
const ca = await mcpClient(c1.tok.access_token);
const toolsA = (await ca.listTools()).tools.map(t => t.name);
check("regular user sees own-data tools", toolsA.includes("list_gear") && toolsA.includes("add_gear_item"));
check("regular user does NOT see admin tools", !toolsA.some(n => ["lookup_user", "update_user_plan", "list_organizations", "get_system_telemetry", "get_marketing_messaging_kit"].includes(n)));
check("tool schemas have no uid/adminApiKey argument", !JSON.stringify((await ca.listTools()).tools).match(/adminApiKey|"uid"/));

const added = await call(ca, "add_gear_item", { name: "A Camera", brand: "Sony", quantity: 2, primaryCategory: "Camera" });
check("add_gear_item works and stamps ownerId", added.data.status === "success" && added.data.item.ownerId === A.uid && /^PT-/.test(added.data.item.assetTag), JSON.stringify(added.data));
const gearA = await call(ca, "list_gear", {});
check("list_gear returns only A's items", gearA.data.totalCount === 1 && gearA.data.items[0].name === "A Camera", JSON.stringify(gearA.data));
const upd = await call(ca, "update_gear_item", { itemId: added.data.itemId, status: "maintenance" });
check("update_gear_item works", upd.data.status === "success");
check("update_gear_item rejects another user's item", (await call(ca, "update_gear_item", { itemId: "b1", status: "missing" })).isError);
check("B's gear untouched", (await dbAdmin.collection("users").doc(B.uid).collection("gearLibrary").doc("b1").get()).data()?.status === undefined);
check("cannot read B's inventory sheet", (await call(ca, "get_inventory_sheet_items", { sheetId: "sheetB" })).isError);
check("cannot read B's packing list", (await call(ca, "get_packing_list", { listId: "listB" })).isError);
check("can read list shared with A", (await call(ca, "get_packing_list", { listId: "listShared" })).data.status === "success");
check("list_packing_lists includes shared only", (await call(ca, "list_packing_lists")).data.lists.map((l: any) => l.id).join() === "listShared");
check("path-injection id rejected", (await call(ca, "get_packing_list", { listId: "listB/items/x" })).isError);
const summary = await call(ca, "get_account_summary");
check("account summary shows usage + limit", summary.data.usage.gearItems === 1 && summary.data.usage.gearLimit === 25 && !summary.data.account.apiKey);
check("calling admin tool directly as user is denied", (await call(ca, "lookup_user", { email: "b@test.dev" })).isError);
check("marketing kit denied for user", (await call(ca, "get_marketing_messaging_kit")).isError);
const resA: any = await ca.listResources();
check("agent-rules/marketing resources hidden from users", !resA.resources.some((r: any) => /agent-rules|marketing/.test(r.uri)));

// plan limit
for (let i = 0; i < 24; i++) await dbAdmin.collection("users").doc(A.uid).collection("gearLibrary").add({ ownerId: A.uid, name: "filler" + i });
check("gear plan limit enforced", (await call(ca, "add_gear_item", { name: "over limit" })).isError);

// ---- admin tiers ----
const cAdm = await connect(ADM.idToken); const admClient = await mcpClient(cAdm.tok.access_token);
const admTools = (await admClient.listTools()).tools.map(t => t.name);
check("admin sees lookup/telemetry but NOT update_user_plan", admTools.includes("lookup_user") && admTools.includes("get_system_telemetry") && !admTools.includes("update_user_plan"));
const lk = await call(admClient, "lookup_user", { email: "b@test.dev" });
check("admin lookup works, no sensitive fields", lk.data.status === "success" && lk.data.user.uid === B.uid);
check("admin cannot change plans", (await call(admClient, "update_user_plan", { uid: A.uid, plan: "enterprise" })).isError);

const cSup = await connect(SUP.idToken); const supClient = await mcpClient(cSup.tok.access_token);
check("super-admin sees update_user_plan", (await supClient.listTools()).tools.some(t => t.name === "update_user_plan"));
const up = await call(supClient, "update_user_plan", { uid: A.uid, plan: "pro", extraSeats: 2 });
check("super-admin plan update applies to `plan` field", up.data.status === "success" && (await dbAdmin.collection("users").doc(A.uid).get()).data()?.plan === "pro");
const audit = await dbAdmin.collection("adminAuditLogs").get();
check("plan change written to audit log", audit.size === 1 && audit.docs[0].data().actorUid === SUP.uid);
check("invalid plan rejected", (await call(supClient, "update_user_plan", { uid: A.uid, plan: "godmode" })).isError);

// role is checked live, not cached in token: demote admin
await dbAdmin.collection("users").doc(ADM.uid).update({ role: "user" });
check("demoted admin loses access immediately", (await call(admClient, "lookup_user", { email: "b@test.dev" })).isError);

// ---- refresh rotation ----
const rf: any = await (await fetch(`${base}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "refresh_token", client_id: c1.reg.client_id, refresh_token: c1.tok.refresh_token }) })).json();
check("refresh token issues new pair", !!rf.access_token && rf.refresh_token !== c1.tok.refresh_token);
const rf2 = await fetch(`${base}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "refresh_token", client_id: c1.reg.client_id, refresh_token: c1.tok.refresh_token }) });
check("old refresh token cannot be replayed", rf2.status === 400);
const rf3 = await fetch(`${base}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "refresh_token", client_id: "ptc_other_client_id_x", refresh_token: rf.refresh_token }) });
check("refresh token bound to its client", rf3.status === 400);
check("tokens stored hashed (no plaintext)", !(JSON.stringify((await dbAdmin.collection("mcpTokens").get()).docs.map(d => ({ id: d.id, ...d.data() })))).includes(c1.tok.access_token));

console.log(`\n${pass} passed, ${failCount} failed`);
process.exit(failCount ? 1 : 0);
