/** Firestore rules for `users/{uid}/labelOwnerPresets` — the new named owner-preset feature in Label Studio. */
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

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

const owner = await createUserWithEmailAndPassword(auth, "owner@labelpresets.dev", "password123");
const stranger = await createUserWithEmailAndPassword(auth, "stranger@labelpresets.dev", "password123");

await signInWithEmailAndPassword(auth, "owner@labelpresets.dev", "password123");
const ref = doc(fs, "users", owner.user.uid, "labelOwnerPresets", "p1");
check("owner can save a named owner preset", await allowed(setDoc(ref, { label: "Sledien Media", name: "Sledien", phone: "+679...", email: "hi@sledien.com" })));
check("owner can read it back", (await getDoc(ref)).exists());

await signInWithEmailAndPassword(auth, "stranger@labelpresets.dev", "password123");
check("a stranger cannot read someone else's owner preset", await denied(getDoc(ref)));
check("a stranger cannot write to someone else's owner preset path", await denied(setDoc(ref, { label: "Hijacked", name: "x", phone: "", email: "" })));

await signInWithEmailAndPassword(auth, "owner@labelpresets.dev", "password123");
check("owner can delete their own preset", await allowed(deleteDoc(ref)));

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
