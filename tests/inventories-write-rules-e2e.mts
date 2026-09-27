/**
 * Firestore write rules for `inventories`: the update/items-write rules checked resource.data.orgId, a
 * field the app never writes, so only the owner or a platform admin could ever edit a shared inventory —
 * org-visibility, named-collaborator and explicit-grant "editor" access existed in the UI but did nothing.
 */
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc } from "firebase/firestore";
import { dbAdmin } from "../server/firebaseAdmin";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean) => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };
const denied = async (p: Promise<unknown>) => { try { await p; return false; } catch (e: any) { return /permission|PERMISSION/.test(String(e?.code || e?.message)); } };
const allowed = async (p: Promise<unknown>) => { try { await p; return true; } catch { return false; } };

const app = initializeApp({ apiKey: "x", projectId: "packer-tools" });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`.replace("localhost", "127.0.0.1"), { disableWarnings: true });
const cfg = JSON.parse((await import("node:fs")).readFileSync("firebase-applet-config.json", "utf8"));
const [fh, fp] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
const fs = getFirestore(app, cfg.firestoreDatabaseId);
connectFirestoreEmulator(fs, fh, Number(fp));

async function mkUser(email: string, extra: Record<string, unknown> = {}) {
  const cred = await createUserWithEmailAndPassword(auth, email, "password123");
  await dbAdmin.collection("users").doc(cred.user.uid).set({ uid: cred.user.uid, email, plan: "free", ...extra });
  return cred.user.uid;
}

const owner = await mkUser("owner@invwrite.dev", { orgId: "orgA" });
const orgMate = await mkUser("orgmate@invwrite.dev", { orgId: "orgA" });
const stranger = await mkUser("stranger@invwrite.dev", { orgId: "orgB" });
const editorCollab = await mkUser("editor@invwrite.dev", { orgId: "orgB" });
const viewerCollab = await mkUser("viewer@invwrite.dev", { orgId: "orgB" });
const grantedEditor = await mkUser("granted@invwrite.dev", { orgId: "orgB" });

await dbAdmin.collection("inventories").doc("inv1").set({
  ownerId: owner, name: "Original name",
  visibility: { orgIds: ["orgA"], deptIds: [], teamIds: [] },
  collaborators: [{ email: "editor@invwrite.dev", role: "editor" }, { email: "viewer@invwrite.dev", role: "viewer" }],
  collaboratorEmails: ["editor@invwrite.dev", "viewer@invwrite.dev"],
});
await dbAdmin.collection("users").doc(grantedEditor).update({ "permissions.locations.inv1": "editor" });
await dbAdmin.collection("inventories").doc("inv1").collection("items").doc("i1").set({ name: "Cable", assetTag: "CBL-1" });

const asUser = async (email: string) => signInWithEmailAndPassword(auth, email, "password123");

await asUser("orgmate@invwrite.dev");
check("an org member can now update the inventory (was blocked by the orgId field bug)", await allowed(updateDoc(doc(fs, "inventories", "inv1"), { name: "Renamed by org mate" })));
check("an org member can write an item in it", await allowed(setDoc(doc(fs, "inventories", "inv1", "items", "i2"), { name: "New item" })));

await asUser("editor@invwrite.dev");
check("a named 'editor' collaborator can update the inventory", await allowed(updateDoc(doc(fs, "inventories", "inv1"), { name: "Renamed by editor collaborator" })));

await asUser("viewer@invwrite.dev");
check("a named 'viewer' collaborator (read-only role) cannot update the inventory", await denied(updateDoc(doc(fs, "inventories", "inv1"), { name: "Hijacked by viewer" })));

await asUser("granted@invwrite.dev");
check("a user with an explicit 'editor' grant can update the inventory", await allowed(updateDoc(doc(fs, "inventories", "inv1"), { name: "Renamed by granted editor" })));

await asUser("stranger@invwrite.dev");
check("a stranger with no tie at all cannot update the inventory", await denied(updateDoc(doc(fs, "inventories", "inv1"), { name: "Hijacked" })));

await asUser("editor@invwrite.dev");
check("an editor collaborator cannot reassign ownership to themselves", await denied(updateDoc(doc(fs, "inventories", "inv1"), { ownerId: editorCollab })));
check("an editor collaborator cannot rewrite the collaborator list", await denied(updateDoc(doc(fs, "inventories", "inv1"), { collaborators: [{ email: "editor@invwrite.dev", role: "editor" }, { email: "editor@invwrite.dev", role: "owner" }] })));

await asUser("owner@invwrite.dev");
check("the real owner can still change ownerId (e.g. transferring the inventory)", await allowed(updateDoc(doc(fs, "inventories", "inv1"), { ownerId: owner })));

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
