import type { Firestore } from "firebase-admin/firestore";

export class TransferError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type TransferItemType = "gear" | "gearLibrary" | "inventory" | "packingList";
export interface TransferItemRef {
  type: TransferItemType;
  id: string;
}

export interface TransferRecordItem {
  id: string;
  name: string;
  category?: string;
  assetTag?: string;
  serialNumber?: string;
  type: "gear" | "kit" | "list" | "inventory" | "gearLibrary";
  price?: number;
  weight?: number;
  quantity?: number;
}

export interface ExecuteTransferResult {
  transferReference: string;
  items: TransferRecordItem[];
  recordId: string;
}

const CHUNK_SIZE = 400;

// Fields that describe the sender's own org structure — meaningless (and potentially exposing
// sender-org identifiers) to the recipient, so every moved gear item is reset to a clean slate.
function clearedGearItemFields() {
  return {
    orgId: "",
    deptId: "",
    teamId: "",
    assignedTo: "",
    assignedToName: "",
    assignedToPhoto: "",
    visibility: "private" as const,
    status: "available" as const,
  };
}

async function runChunked(db: Firestore, ops: Array<(batch: FirebaseFirestore.WriteBatch) => void>) {
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    chunk.forEach(op => op(batch));
    await batch.commit();
  }
}

/**
 * Executes an ownership transfer of one or more assets from senderUid to recipientUid.
 * Every item is re-read and re-verified server-side — the caller's claimed selection is never trusted.
 * gear items live at users/{uid}/gearLibrary/{id} (uid is IN the path), so "transferring" one is a
 * delete-here / create-there move, not a field update — inventories, gearLibraries and packingLists
 * nest their contents under the entity itself, so those are plain ownerId flips.
 */
export async function executeTransfer(
  db: Firestore,
  senderUid: string,
  recipientUid: string,
  refs: TransferItemRef[],
  notes: string | undefined
): Promise<{ items: TransferRecordItem[] }> {
  if (senderUid === recipientUid) throw new TransferError(400, "Cannot transfer assets to yourself.");
  if (!refs.length) throw new TransferError(400, "No items selected for transfer.");

  const recipientDoc = await db.collection("users").doc(recipientUid).get();
  if (!recipientDoc.exists) throw new TransferError(404, "Recipient account no longer exists.");

  const recordItems: TransferRecordItem[] = [];
  const ops: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

  // Expand gearLibrary refs into their own transfer plus every gear item that belongs to it.
  const expandedRefs: TransferItemRef[] = [];
  const cascadedGearIds = new Map<string, string[]>(); // libraryId -> gear item ids already queued (avoid double-queue)

  for (const ref of refs) {
    expandedRefs.push(ref);
    if (ref.type === "gearLibrary") {
      const libSnap = await db.collection("gearLibraries").doc(ref.id).get();
      if (!libSnap.exists) throw new TransferError(404, `Gear library ${ref.id} not found.`);
      if (libSnap.data()?.ownerId !== senderUid) throw new TransferError(403, `You do not own gear library "${libSnap.data()?.name || ref.id}".`);

      const itemsSnap = await db.collection("users").doc(senderUid).collection("gearLibrary").where("libraryId", "==", ref.id).get();
      const ids: string[] = [];
      itemsSnap.forEach(d => {
        ids.push(d.id);
        expandedRefs.push({ type: "gear", id: d.id });
      });
      cascadedGearIds.set(ref.id, ids);
    }
  }

  const seenGearIds = new Set<string>();

  for (const ref of expandedRefs) {
    if (ref.type === "gear") {
      if (seenGearIds.has(ref.id)) continue;
      seenGearIds.add(ref.id);

      const docRef = db.collection("users").doc(senderUid).collection("gearLibrary").doc(ref.id);
      const snap = await docRef.get();
      if (!snap.exists) throw new TransferError(404, `Gear item ${ref.id} not found.`);
      const data = snap.data()!;
      if (data.ownerId && data.ownerId !== senderUid) throw new TransferError(403, `You do not own "${data.name || ref.id}".`);

      const newDocRef = db.collection("users").doc(recipientUid).collection("gearLibrary").doc(ref.id);
      const newData = { ...data, id: ref.id, ownerId: recipientUid, ...clearedGearItemFields() };

      ops.push(batch => {
        batch.set(newDocRef, newData);
        batch.delete(docRef);
      });

      recordItems.push({
        id: ref.id,
        name: data.name || "Untitled item",
        category: data.category,
        assetTag: data.assetTag,
        serialNumber: data.serialNumber,
        type: data.isKit ? "kit" : "gear",
        price: data.price,
        weight: data.weight,
      });
    } else if (ref.type === "gearLibrary") {
      const docRef = db.collection("gearLibraries").doc(ref.id);
      const snap = await docRef.get();
      if (!snap.exists) throw new TransferError(404, `Gear library ${ref.id} not found.`);
      const data = snap.data()!;
      if (data.ownerId !== senderUid) throw new TransferError(403, `You do not own gear library "${data.name || ref.id}".`);

      ops.push(batch => batch.update(docRef, { ownerId: recipientUid }));

      recordItems.push({
        id: ref.id,
        name: data.name || "Untitled gear library",
        category: "Gear Library",
        type: "gearLibrary",
        quantity: cascadedGearIds.get(ref.id)?.length || 0,
      });
    } else if (ref.type === "inventory") {
      const docRef = db.collection("inventories").doc(ref.id);
      const snap = await docRef.get();
      if (!snap.exists) throw new TransferError(404, `Inventory ${ref.id} not found.`);
      const data = snap.data()!;
      if (data.ownerId !== senderUid) throw new TransferError(403, `You do not own inventory "${data.name || ref.id}".`);

      ops.push(batch => batch.update(docRef, { ownerId: recipientUid }));

      recordItems.push({
        id: ref.id,
        name: data.name || "Untitled inventory",
        category: "Inventory",
        type: "inventory",
      });
    } else if (ref.type === "packingList") {
      const docRef = db.collection("packingLists").doc(ref.id);
      const snap = await docRef.get();
      if (!snap.exists) throw new TransferError(404, `Packing list ${ref.id} not found.`);
      const data = snap.data()!;
      if (data.ownerId !== senderUid) throw new TransferError(403, `You do not own packing list "${data.name || ref.id}".`);

      ops.push(batch => batch.update(docRef, { ownerId: recipientUid, ownerEmail: "" }));

      recordItems.push({
        id: ref.id,
        name: data.name || "Untitled packing list",
        category: "Packing List",
        type: "list",
      });
    } else {
      throw new TransferError(400, `Unknown transfer item type: ${(ref as any).type}`);
    }
  }

  await runChunked(db, ops);
  return { items: recordItems };
}
