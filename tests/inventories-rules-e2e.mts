/**
 * Firestore rules for `inventories`: was `isSignedIn() || publicSharingEnabled`, i.e. any signed-in
 * user could read every inventory on the platform. Scoped to owner / explicit per-user grant /
 * named collaborator / org visibility / admin — matching the scoped queries the app's client code
 * now runs (see src/hooks/useVisibleInventories.ts and its callers).
 */
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc } from "firebase/firestore";
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

const owner = await mkUser("owner@invrules.dev", { orgId: "orgA" });
const stranger = await mkUser("stranger@invrules.dev", { orgId: "orgB" });
const collaborator = await mkUser("collab@invrules.dev", { orgId: "orgB" });
const orgMate = await mkUser("orgmate@invrules.dev", { orgId: "orgA" });
const grantedReader = await mkUser("granted@invrules.dev", { orgId: "orgB" });
const deniedOrgMate = await mkUser("denied@invrules.dev", {
  orgId: "orgA",
  permissions: { locations: {} }, // filled in per-inventory below
});
const admin = await mkUser("admin@invrules.dev", { orgId: "orgB", role: "admin" });

// Private inventory: owned by `owner`, org "orgA", one named collaborator, no explicit grants yet.
await dbAdmin.collection("inventories").doc("invPrivate").set({
  ownerId: owner,
  name: "Private Stock",
  visibility: { orgIds: ["orgA"], deptIds: [], teamIds: [] },
  collaborators: [{ email: "collab@invrules.dev", role: "viewer" }],
  collaboratorEmails: ["collab@invrules.dev"],
});

// Second inventory, owned by `owner`, used only for the explicit-grant and explicit-deny checks —
// grantedReader has no ownership/org/collaborator tie to it at all, only a permissions.locations entry.
await dbAdmin.collection("inventories").doc("invGranted").set({
  ownerId: owner,
  name: "Grant-Only Stock",
  visibility: { orgIds: [], deptIds: [], teamIds: [] },
  collaborators: [],
  collaboratorEmails: [],
});
await dbAdmin.collection("users").doc(grantedReader).update({ "permissions.locations.invGranted": "reader" });
// deniedOrgMate is an orgA member (which would normally grant read on invPrivate) but explicitly denied.
await dbAdmin.collection("users").doc(deniedOrgMate).update({ "permissions.locations.invPrivate": "none" });

// Public inventory: readable by anyone signed in, regardless of ownership/org/collaborator.
await dbAdmin.collection("inventories").doc("invPublic").set({
  ownerId: owner,
  name: "Public Rack",
  publicSharingEnabled: true,
  visibility: { orgIds: [], deptIds: [], teamIds: [] },
});

// Seeded demo account's starter inventory — a brand-new sign-in reads (then migrates) this on first
// login (src/providers/AuthProvider.tsx migrateDemoDataToUser), same as it already reads demo orgs/gear.
await dbAdmin.collection("inventories").doc("invDemo").set({
  ownerId: "demo-super-admin",
  name: "Demo Starter Kit",
  visibility: { orgIds: [], deptIds: [], teamIds: [] },
});

const readAs = async (uid: string, email: string, invId: string) => {
  await signInWithEmailAndPassword(auth, email, "password123");
  return getDoc(doc(fs, "inventories", invId));
};

check("owner can read their own inventory", (await allowed(readAs(owner, "owner@invrules.dev", "invPrivate"))));
check("a signed-in stranger (no ownership/org/collaborator/grant tie) cannot read it", await denied(readAs(stranger, "stranger@invrules.dev", "invPrivate")));
check("a named collaborator can read it", await allowed(readAs(collaborator, "collab@invrules.dev", "invPrivate")));
check("a member of the visibility-scoped org can read it", await allowed(readAs(orgMate, "orgmate@invrules.dev", "invPrivate")));
check("a user with an explicit 'none' grant is denied even though they're an org member", await denied(readAs(deniedOrgMate, "denied@invrules.dev", "invPrivate")));
check("a user with an explicit 'reader' grant can read an inventory they have no other tie to", await allowed(readAs(grantedReader, "granted@invrules.dev", "invGranted")));
check("that same explicit-grant user still cannot read an unrelated inventory", await denied(readAs(grantedReader, "granted@invrules.dev", "invPrivate")));
check("an admin can read any inventory, including one they'd otherwise be denied on", await allowed(readAs(admin, "admin@invrules.dev", "invPrivate")));
check("a brand-new signed-in stranger can read the seeded demo account's inventory (first-login migration)", await allowed(readAs(stranger, "stranger@invrules.dev", "invDemo")));
check("anyone signed in can read a publicly-shared inventory", await allowed(readAs(stranger, "stranger@invrules.dev", "invPublic")));

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
