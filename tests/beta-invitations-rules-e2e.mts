/** Firestore rules for the beta invitations collection (was completely unset: always denied). */
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc } from "firebase/firestore";
import { dbAdmin } from "../server/firebaseAdmin";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean) => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };
const denied = async (p: Promise<unknown>) => { try { await p; return false; } catch (e: any) { return /permission|PERMISSION/.test(String(e?.code || e?.message)); } };

const app = initializeApp({ apiKey: "x", projectId: "packer-tools" });
const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`.replace("localhost", "127.0.0.1"), { disableWarnings: true });
const cfg = JSON.parse((await import("node:fs")).readFileSync("firebase-applet-config.json", "utf8"));
const [fh, fp] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
const fs = getFirestore(app, cfg.firestoreDatabaseId); connectFirestoreEmulator(fs, fh, Number(fp));

const invited = await createUserWithEmailAndPassword(auth, "invited@pp.dev", "password123");
const other = await createUserWithEmailAndPassword(auth, "nobody@pp.dev", "password123");

await dbAdmin.collection("users").doc(invited.user.uid).set({ uid: invited.user.uid, email: "invited@pp.dev", plan: "free", role: "viewer" });
await dbAdmin.collection("users").doc(other.user.uid).set({ uid: other.user.uid, email: "nobody@pp.dev", plan: "free", role: "viewer" });
await dbAdmin.collection("betaInvitations").doc("invited@pp.dev").set({ email: "invited@pp.dev", invitedAt: new Date().toISOString() });

// createUserWithEmailAndPassword signs in as the newly created user, so currentUser is
// "other" at this point — switch back to "invited" for the first check.
await auth.updateCurrentUser(invited.user);
check("a signed-in user can read their own invite doc", (await getDoc(doc(fs, "betaInvitations", "invited@pp.dev"))).exists());

await auth.updateCurrentUser(other.user);
check("a signed-in user cannot read someone else's invite doc", await denied(getDoc(doc(fs, "betaInvitations", "invited@pp.dev"))));
check("a non-admin user cannot write an invite", await denied(setDoc(doc(fs, "betaInvitations", "nobody@pp.dev"), { email: "nobody@pp.dev" })));

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
