/** Firestore rules for owner pickup points. Needs the emulators started with firestore.rules loaded. */
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { dbAdmin } from "../server/firebaseAdmin";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean) => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };
const denied = async (p: Promise<unknown>) => { try { await p; return false; } catch (e: any) { return /permission|PERMISSION/.test(String(e?.code || e?.message)); } };

console.log("hosts", process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST);
const [fh0, fp] = process.env.FIRESTORE_EMULATOR_HOST!.split(":"); const fh = fh0;
const app = initializeApp({ apiKey: "x", projectId: "packer-tools" });
const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`.replace("localhost","127.0.0.1"), { disableWarnings: true });
const cfg = JSON.parse((await import("node:fs")).readFileSync("firebase-applet-config.json", "utf8"));
const fs = getFirestore(app, cfg.firestoreDatabaseId); connectFirestoreEmulator(fs, fh, Number(fp));

const owner = await createUserWithEmailAndPassword(auth, "owner@pp.dev", "password123");
const uid = owner.user.uid;
const point = { name: "Main yard", address: "2 Side St" };
const setMode = (mode: string | null) => dbAdmin.collection("adminSettings").doc("global").set(mode ? { moduleWidgetConfigs: { pickupPoints: { mode } } } : {});
const ref = (id: string, u = uid) => doc(fs, "users", u, "pickupPoints", id);

await setMode("platform");
check("platform mode: owner cannot write a point", await denied(setDoc(ref("a"), point)));
await setMode("off");
check("off: owner cannot write a point", await denied(setDoc(ref("a"), point)));
await setMode(null);
check("unset mode behaves as platform", await denied(setDoc(ref("a"), point)));
await setMode("owners");
await setDoc(ref("a"), point);
check("owners mode: owner can write a point", (await getDoc(ref("a"))).exists());
check("owners mode: another user's path is refused", await denied(setDoc(ref("b", "someone-else"), point)));
check("invalid point (no address) is refused", await denied(setDoc(ref("c"), { name: "x" })));
check("oversized name is refused", await denied(setDoc(ref("d"), { name: "n".repeat(101), address: "a" })));
await setMode("platform");
check("points stay readable when mode changes", (await getDoc(ref("a"))).exists());
await deleteDoc(ref("a"));
check("owner can always delete their own point", !(await getDoc(ref("a"))).exists());
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
