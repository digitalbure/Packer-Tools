/** Firestore rules for `gearLibraries` (the "Create Gear Library" multi-depot switcher) — had no rule at
 *  all, so every create/update/delete failed with permission-denied since the collection was introduced. */
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, collection } from "firebase/firestore";

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

const owner = await createUserWithEmailAndPassword(auth, "owner@gearlib.dev", "password123");
const stranger = await createUserWithEmailAndPassword(auth, "stranger@gearlib.dev", "password123");

await signInWithEmailAndPassword(auth, "owner@gearlib.dev", "password123");
const created = await addDoc(collection(fs, "gearLibraries"), {
  name: "SLEDIEN Gear", description: "SLEDIEN managed inventory", location: "",
  color: "amber", icon: "warehouse", ownerId: owner.user.uid, ownerEmail: "owner@gearlib.dev",
  orgId: "", deptId: "", isDefault: false,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});
check("owner can create a gear library (this is the exact payload the Create Library modal sends)", !!created.id);
check("owner can read it back", (await getDoc(doc(fs, "gearLibraries", created.id))).exists());
check("owner can rename it", await allowed(updateDoc(doc(fs, "gearLibraries", created.id), { name: "Renamed", updatedAt: new Date().toISOString() })));

await signInWithEmailAndPassword(auth, "stranger@gearlib.dev", "password123");
check("a stranger cannot read someone else's library", await denied(getDoc(doc(fs, "gearLibraries", created.id))));
check("a stranger cannot rename someone else's library", await denied(updateDoc(doc(fs, "gearLibraries", created.id), { name: "Hijacked" })));
check("a stranger cannot delete someone else's library", await denied(deleteDoc(doc(fs, "gearLibraries", created.id))));
check("a stranger cannot create a library claiming someone else as owner", await denied(setDoc(doc(fs, "gearLibraries", "forged"), {
  name: "Forged", ownerId: owner.user.uid, ownerEmail: "owner@gearlib.dev", createdAt: new Date().toISOString(),
})));

await signInWithEmailAndPassword(auth, "owner@gearlib.dev", "password123");
check("owner can delete their own library", await allowed(deleteDoc(doc(fs, "gearLibraries", created.id))));

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
