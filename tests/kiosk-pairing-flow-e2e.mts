/**
 * The full pairing handshake as the UI actually drives it (KioskMode.tsx v6.20.0):
 *  1. Device (any signed-in user, per firestore.rules) creates its own pending `terminals` doc
 *     with a self-generated code — exactly the addDoc in KioskMode.tsx's initializeTerminal effect.
 *  2. Owner types that code into the new "Pair a New Kiosk Tablet" form, which calls
 *     kioskApi.activateTerminal() — the real client function, through a real signed-in
 *     firebase/auth client (authenticatedFetch reads auth.currentUser), not a hand-built header.
 *  3. Device exchanges terminalId + code for a session token via kioskApi.startSession(),
 *     exactly as KioskMode.tsx does right after pairing (the "Server-verified session" effect).
 * Firestore + Auth emulators required (run via `firebase emulators:exec`, see package.json test:rules).
 */
import express from "express";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, collection, addDoc } from "firebase/firestore";
import kioskRouter from "../server/routes/kiosk";
import { dbAdmin } from "../server/firebaseAdmin";
import { kioskApi, setKioskApiBase, setKioskApiStorage, hasToken } from "../src/lib/kioskApi";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };

// ---- server under test, wired the same way production is ----
const app = express(); app.use(express.json()); app.set("trust proxy", 1); app.use(kioskRouter);
const srv = app.listen(0);
const apiBase = `http://localhost:${(srv.address() as any).port}`;
setKioskApiBase(apiBase);
const mem = new Map<string, string>();
setKioskApiStorage({ getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: k => void mem.delete(k) });

// authenticatedFetch (used by kioskApi.activateTerminal/revokeTerminal) calls fetch() with a bare relative
// path, which a browser resolves against its own origin. There's no "page origin" in Node, so resolve it here.
const rawFetch = globalThis.fetch;
globalThis.fetch = ((input: any, init?: any) =>
  rawFetch(typeof input === "string" && input.startsWith("/") ? apiBase + input : input, init)) as typeof fetch;

// ---- client SDK against the emulators, same as the browser app ----
const clientApp = initializeApp({ apiKey: "x", projectId: "packer-tools" });
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`.replace("localhost", "127.0.0.1"), { disableWarnings: true });
const cfg = JSON.parse((await import("node:fs")).readFileSync("firebase-applet-config.json", "utf8"));
const [fh, fp] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
const clientDb = getFirestore(clientApp, cfg.firestoreDatabaseId);
connectFirestoreEmulator(clientDb, fh, Number(fp));

// ---- seed: an owner on a plan with kioskMode, and a second account that plays "whoever is signed in on the tablet" ----
await dbAdmin.collection("adminSettings").doc("global").set({ plans: [{ id: "pro", features: ["kioskMode"] }], kioskConfig: {} });
const owner = await createUserWithEmailAndPassword(clientAuth, "owner@pairflow.dev", "password123");
await dbAdmin.collection("users").doc(owner.user.uid).set({ uid: owner.user.uid, email: "owner@pairflow.dev", plan: "pro", displayName: "Owner" });
const tabletSignIn = await createUserWithEmailAndPassword(clientAuth, "tablet-guest@pairflow.dev", "password123");
await dbAdmin.collection("users").doc(tabletSignIn.user.uid).set({ uid: tabletSignIn.user.uid, email: "tablet-guest@pairflow.dev", plan: "free", displayName: "Tablet Guest" });

// ============ Step 1: the tablet generates its own pairing doc (KioskMode.tsx initializeTerminal) ============
await signInWithEmailAndPassword(clientAuth, "tablet-guest@pairflow.dev", "password123");
const code = "483920";
const deviceDoc = await addDoc(collection(clientDb, "terminals"), {
  pairingCode: code,
  status: "pending",
  deviceName: "Front Desk Tablet",
  lastActive: new Date().toISOString(),
  settings: { mode: "both" },
});
check("device can create its own pending terminal doc while merely signed in (not the owner)", !!deviceDoc.id);
const seeded = (await dbAdmin.collection("terminals").doc(deviceDoc.id).get()).data();
check("seeded doc has no ownerUid yet (nobody's claimed it)", seeded?.status === "pending" && !seeded?.ownerUid);

check("kioskApi has no token before pairing", !hasToken());
check("device session is refused until the owner activates", (await kioskApi.startSession(deviceDoc.id, code)) === false && !hasToken());

// ============ Step 2: owner types the code into the dashboard form -> handleAuthorizeTerminal -> kioskApi.activateTerminal ============
await signInWithEmailAndPassword(clientAuth, "owner@pairflow.dev", "password123");
let activateResult: any, activateError: any;
try { activateResult = await kioskApi.activateTerminal(code); } catch (e) { activateError = e; }
check("owner authorizing the real code succeeds (this is what the new form's submit button calls)",
  !activateError && activateResult?.terminalId === deviceDoc.id && activateResult?.deviceName === "Front Desk Tablet",
  activateError?.message);

const afterActivate = (await dbAdmin.collection("terminals").doc(deviceDoc.id).get()).data();
check("terminal is now active and bound to the owner who authorized it", afterActivate?.status === "active" && afterActivate?.ownerUid === owner.user.uid);

// Wrong / already-used code should not silently re-pair something else.
let wrongErr: any; try { await kioskApi.activateTerminal("000000"); } catch (e) { wrongErr = e; }
check("a code that matches nothing is rejected, not silently accepted", wrongErr?.status === 404);

// ============ Step 3: the device (still just signed in, not the owner) completes the handshake ============
const gotSession = await kioskApi.startSession(deviceDoc.id, code);
check("device exchanges terminalId + code for a scoped session token once paired", gotSession === true && hasToken());
const ctx = await kioskApi.context();
check("device's new token resolves to the paired terminal, owned by the right account", ctx.terminal.id === deviceDoc.id && ctx.terminal.deviceName === "Front Desk Tablet");

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
