/** Kiosk operations against the Firestore emulator (client SDK, open rules: this tests logic, not rules). */
import { connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../src/firebase";
import { findItem, checkOutItem, checkInItem, ItemConflictError, type ItemSource } from "../src/lib/kioskOps";

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
connectFirestoreEmulator(db, host, Number(port));

let pass = 0, failed = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };

const OWNER = "owner1";
const lib: ItemSource = { kind: "library", ownerUid: OWNER };
const inv: ItemSource = { kind: "inventory", ownerUid: OWNER, inventoryId: "inv1" };
const put = (path: string[], data: any) => setDoc(doc(db, path[0], ...path.slice(1)), data);
const status = async (path: string[]) => (await getDoc(doc(db, path[0], ...path.slice(1)))).data()?.status;
const records = async (assetId: string) => (await getDocs(query(collection(db, "checkouts"), where("assetId", "==", assetId)))).docs.map(d => d.data());
const actor = { ownerUid: OWNER, name: "Guest A", email: "a@x.dev", terminalId: "T1" };

await put(["users", OWNER, "gearLibrary", "cam1"], { name: "Camera", assetTag: "PT-ABC123", status: "available", ownerId: OWNER });
await put(["users", OWNER, "gearLibrary", "kit1"], { name: "Kit", assetTag: "PT-KIT001", status: "available", isKit: true, childItemIds: ["c1", "c2"], ownerId: OWNER });
await put(["users", OWNER, "gearLibrary", "c1"], { name: "Child 1", status: "available" });
await put(["users", OWNER, "gearLibrary", "c2"], { name: "Child 2", status: "available" });
await put(["users", OWNER, "gearLibrary", "lens1"], { name: "Lens", assetTag: "PT-LENS01", status: "available" });
await put(["inventories", "inv1", "items", "row1"], { name: "Cable", assetTag: "CBL-1" });

// ---- lookup ----
check("find by document id", (await findItem(lib, "cam1"))?.id === "cam1");
check("find by asset tag", (await findItem(lib, "PT-ABC123"))?.id === "cam1");
check("find by lower-case tag (upper-case fallback)", (await findItem(lib, "pt-abc123"))?.id === "cam1");
check("find from a /gear/<id> QR URL", (await findItem(lib, "https://packer.tools/gear/cam1?x=1"))?.id === "cam1");
check("unknown code returns null", (await findItem(lib, "NOPE")) === null);
check("path-injection value returns null", (await findItem(lib, "a/b")) === null);
const invItem: any = await findItem(inv, "CBL-1");
check("custom-inventory lookup is normalised", invItem?.id === "row1" && invItem.category === "Gear" && invItem.status === "available");
check("lookup never crosses owners", (await findItem({ kind: "library", ownerUid: "someoneElse" }, "cam1")) === null);

// ---- atomic check-out ----
const item: any = await findItem(lib, "cam1");
const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => checkOutItem(lib, item, { ...actor, name: `Guest ${i}` })));
const okCount = results.filter(r => r.status === "fulfilled").length;
const conflicts = results.filter(r => r.status === "rejected" && (r as any).reason instanceof ItemConflictError && (r as any).reason.reason === "already_out").length;
check("6 simultaneous check-outs: exactly one wins", okCount === 1 && conflicts === 5, `ok=${okCount} conflicts=${conflicts}`);
const recs = await records("cam1");
check("exactly one open checkout record written", recs.length === 1 && recs[0].status === "active" && recs[0].ownerId === OWNER && recs[0].terminalId === "T1");
check("item is in use", (await status(["users", OWNER, "gearLibrary", "cam1"])) === "in_use");

// ---- check-in ----
const back = await checkInItem(lib, item, actor);
const recsAfter = await records("cam1");
check("check-in reports item was out", back.wasOut === true);
check("check-in closes the open record (no duplicate)", recsAfter.length === 1 && recsAfter[0].status === "returned" && !!recsAfter[0].checkInTime);
check("item available again", (await status(["users", OWNER, "gearLibrary", "cam1"])) === "available");
const again = await checkInItem(lib, item, actor);
check("second check-in is harmless", again.wasOut === false);
check("re-checkout after return works", !!(await checkOutItem(lib, item, actor)));
await checkInItem(lib, item, actor);

// ---- legacy 'checked_out' records (older PWA path) get closed ----
await put(["checkouts", "legacy1"], { assetId: "lens1", status: "checked_out", ownerId: OWNER });
await put(["users", OWNER, "gearLibrary", "lens1"], { name: "Lens", assetTag: "PT-LENS01", status: "in_use", currentHolder: "X" });
await checkInItem(lib, { id: "lens1", name: "Lens" } as any, actor);
check("legacy checked_out record is closed", (await getDoc(doc(db, "checkouts", "legacy1"))).data()?.status === "returned");
check("no extra record created when one was open", (await records("lens1")).length === 1);

// ---- kits ----
const kit: any = await findItem(lib, "kit1");
await checkOutItem(lib, kit, actor);
check("kit check-out sets children in use with kitId", (await status(["users", OWNER, "gearLibrary", "c1"])) === "in_use" && (await getDoc(doc(db, "users", OWNER, "gearLibrary", "c2"))).data()?.kitId === "kit1");
await checkInItem(lib, kit, actor);
check("kit check-in frees children", (await status(["users", OWNER, "gearLibrary", "c1"])) === "available" && (await getDoc(doc(db, "users", OWNER, "gearLibrary", "c2"))).data()?.kitId === null);

// ---- errors ----
let missing: any; try { await checkOutItem(lib, { id: "ghost", name: "Ghost" } as any, actor); } catch (e) { missing = e; }
check("missing item -> ItemConflictError(missing)", missing instanceof ItemConflictError && missing.reason === "missing");
let held: any; await checkOutItem(lib, item, { ...actor, name: "Holder H" });
try { await checkOutItem(lib, item, actor); } catch (e) { held = e; }
check("conflict error names the current holder", held instanceof ItemConflictError && held.holder === "Holder H");

// ---- custom inventory source ----
const row: any = await findItem(inv, "CBL-1");
await checkOutItem(inv, row, actor);
check("check-out works on custom-inventory items", (await status(["inventories", "inv1", "items", "row1"])) === "in_use");

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
