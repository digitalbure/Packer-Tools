/**
 * Enterprise Asset Transfer execution logic (server/transfers/executeTransfer.ts), run directly
 * against the Firestore emulator via the Admin SDK — same pattern as tests/kiosk-ops-e2e.mts,
 * since this logic runs server-side (Admin SDK bypasses rules) rather than through client rules.
 */
import { dbAdmin } from "../server/firebaseAdmin";
import { executeTransfer, TransferError } from "../server/transfers/executeTransfer";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };

const A = "senderA";
const B = "recipientB";
const STRANGER = "strangerC";

await dbAdmin.collection("users").doc(A).set({ uid: A, email: "a@transfer.dev", displayName: "Sender A", plan: "Enterprise" });
await dbAdmin.collection("users").doc(B).set({ uid: B, email: "b@transfer.dev", displayName: "Recipient B", plan: "Free" });

// ---- lone gear item transfer ----
await dbAdmin.collection("users").doc(A).collection("gearLibrary").doc("cam1").set({
  name: "Camera", ownerId: A, category: "Camera", assetTag: "CAM-1", price: 2000,
  orgId: "orgA", deptId: "deptA", teamId: "teamA", assignedTo: "someone", assignedToName: "Someone",
  visibility: "org", status: "in_use",
});

{
  const { items } = await executeTransfer(dbAdmin, A, B, [{ type: "gear", id: "cam1" }], undefined);
  check("lone gear transfer returns one record item", items.length === 1 && items[0].name === "Camera");

  const oldDoc = await dbAdmin.collection("users").doc(A).collection("gearLibrary").doc("cam1").get();
  check("old gear doc is gone from the sender's subcollection", !oldDoc.exists);

  const newDoc = await dbAdmin.collection("users").doc(B).collection("gearLibrary").doc("cam1").get();
  const newData = newDoc.data();
  check("new gear doc exists under the recipient", newDoc.exists);
  check("new doc's ownerId is the recipient", newData?.ownerId === B);
  check("org/dept/team/assignment fields are cleared", !newData?.orgId && !newData?.deptId && !newData?.teamId && !newData?.assignedTo && !newData?.assignedToName);
  check("visibility reset to private", newData?.visibility === "private");
  check("status reset to available", newData?.status === "available");
}

// ---- gear library cascade ----
await dbAdmin.collection("gearLibraries").doc("lib1").set({ ownerId: A, name: "West Coast Depot" });
await dbAdmin.collection("users").doc(A).collection("gearLibrary").doc("lens1").set({ name: "Lens", ownerId: A, libraryId: "lib1" });
await dbAdmin.collection("users").doc(A).collection("gearLibrary").doc("tripod1").set({ name: "Tripod", ownerId: A, libraryId: "lib1" });
await dbAdmin.collection("users").doc(A).collection("gearLibrary").doc("other1").set({ name: "Unrelated Item", ownerId: A, libraryId: "otherLib" });

{
  const { items } = await executeTransfer(dbAdmin, A, B, [{ type: "gearLibrary", id: "lib1" }], undefined);
  check("gearLibrary transfer reports the library plus its 2 cascaded items", items.length === 3);

  const libDoc = await dbAdmin.collection("gearLibraries").doc("lib1").get();
  check("library doc ownership flipped", libDoc.data()?.ownerId === B);

  const lens = await dbAdmin.collection("users").doc(B).collection("gearLibrary").doc("lens1").get();
  const tripod = await dbAdmin.collection("users").doc(B).collection("gearLibrary").doc("tripod1").get();
  check("cascaded item 1 moved to the recipient", lens.exists && lens.data()?.ownerId === B);
  check("cascaded item 2 moved to the recipient", tripod.exists && tripod.data()?.ownerId === B);

  const untouched = await dbAdmin.collection("users").doc(A).collection("gearLibrary").doc("other1").get();
  check("item from a different library was left untouched", untouched.exists && untouched.data()?.ownerId === A);
}

// ---- inventory: ownerId flip only, items untouched ----
await dbAdmin.collection("inventories").doc("inv1").set({ ownerId: A, name: "Studio Inventory" });
await dbAdmin.collection("inventories").doc("inv1").collection("items").doc("row1").set({ name: "Cable", assetTag: "CBL-1" });

{
  await executeTransfer(dbAdmin, A, B, [{ type: "inventory", id: "inv1" }], undefined);
  const invDoc = await dbAdmin.collection("inventories").doc("inv1").get();
  check("inventory ownerId flipped", invDoc.data()?.ownerId === B);
  const rowDoc = await dbAdmin.collection("inventories").doc("inv1").collection("items").doc("row1").get();
  check("nested inventory item is untouched and still readable", rowDoc.exists && rowDoc.data()?.name === "Cable");
}

// ---- packing list: ownerId flip only ----
await dbAdmin.collection("packingLists").doc("list1").set({ ownerId: A, name: "Falcon Job List", isTemplate: false });
{
  await executeTransfer(dbAdmin, A, B, [{ type: "packingList", id: "list1" }], undefined);
  const listDoc = await dbAdmin.collection("packingLists").doc("list1").get();
  check("packing list ownerId flipped", listDoc.data()?.ownerId === B);
}

// ---- rejects a forged ownerId field (item sits under the caller's own path, but its data claims someone else owns it) ----
await dbAdmin.collection("users").doc(STRANGER).collection("gearLibrary").doc("spoofed").set({ name: "Spoofed", ownerId: B });
{
  try {
    await executeTransfer(dbAdmin, STRANGER, B, [{ type: "gear", id: "spoofed" }], undefined);
    check("rejects a forged ownerId field on an item", false, "did not throw");
  } catch (e: any) {
    check("rejects a forged ownerId field on an item", e instanceof TransferError && e.status === 403);
  }
}

// ---- rejects transferring an item that doesn't exist under the caller's own path at all ----
{
  try {
    await executeTransfer(dbAdmin, STRANGER, B, [{ type: "gear", id: "cam1" }], undefined);
    check("rejects an item that isn't in the caller's own gear library", false, "did not throw");
  } catch (e: any) {
    check("rejects an item that isn't in the caller's own gear library", e instanceof TransferError && e.status === 404);
  }
}

// ---- rejects a non-existent recipient ----
{
  await dbAdmin.collection("users").doc(A).collection("gearLibrary").doc("cam2").set({ name: "Camera 2", ownerId: A });
  try {
    await executeTransfer(dbAdmin, A, "ghost-uid-does-not-exist", [{ type: "gear", id: "cam2" }], undefined);
    check("rejects a non-existent recipient", false, "did not throw");
  } catch (e: any) {
    check("rejects a non-existent recipient", e instanceof TransferError && e.status === 404);
  }
  const stillThere = await dbAdmin.collection("users").doc(A).collection("gearLibrary").doc("cam2").get();
  check("nothing moved when the recipient check fails", stillThere.exists && stillThere.data()?.ownerId === A);
}

// ---- rejects transferring to yourself ----
{
  try {
    await executeTransfer(dbAdmin, A, A, [{ type: "gear", id: "cam2" }], undefined);
    check("rejects self-transfer", false, "did not throw");
  } catch (e: any) {
    check("rejects self-transfer", e instanceof TransferError && e.status === 400);
  }
}

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
