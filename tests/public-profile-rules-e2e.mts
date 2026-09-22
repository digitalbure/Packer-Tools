/** Firestore rules for the public storefront profile collection. */
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc } from "firebase/firestore";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean) => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };
const denied = async (p: Promise<unknown>) => { try { await p; return false; } catch (e: any) { return /permission|PERMISSION/.test(String(e?.code || e?.message)); } };

const app = initializeApp({ apiKey: "x", projectId: "packer-tools" });
const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`.replace("localhost", "127.0.0.1"), { disableWarnings: true });
const cfg = JSON.parse((await import("node:fs")).readFileSync("firebase-applet-config.json", "utf8"));
const [fh, fp] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
const fs = getFirestore(app, cfg.firestoreDatabaseId); connectFirestoreEmulator(fs, fh, Number(fp));

const owner = await createUserWithEmailAndPassword(auth, "seller@pp.dev", "password123");
const uid = owner.user.uid;
const ref = (u = uid) => doc(fs, "publicProfiles", u);

check("anyone can read a public profile that doesn't exist yet", (await getDoc(ref())).exists() === false);
check("owner can write their own safe storefront fields", await setDoc(ref(), { storeName: "Suva Camera Hire", storeBio: "We rent cameras." }).then(() => true));
check("the write is publicly readable", (await getDoc(ref())).data()?.storeName === "Suva Camera Hire");
check("owner cannot smuggle a non-whitelisted field like plan", await denied(setDoc(ref(), { storeName: "x", plan: "enterprise" })));
check("owner cannot smuggle email", await denied(setDoc(ref(), { storeName: "x", email: "leak@x.com" })));
check("another user cannot write to this owner's public profile", await denied(setDoc(ref("someone-else"), { storeName: "hijack" })));
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
