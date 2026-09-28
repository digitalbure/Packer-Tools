import express from "express";
import { admin, dbAdmin } from "../firebaseAdmin";
import { authenticateUser } from "../middleware/auth";
import { rateLimit, isValidEmail } from "../middleware/security";
import { executeTransfer, TransferError, type TransferItemRef } from "../transfers/executeTransfer";

/**
 * Enterprise Asset Transfer. Runs server-side (Admin SDK, bypasses Firestore rules) because:
 *  - gear items live at users/{uid}/gearLibrary/{id} — the uid is IN the path, so reassigning one
 *    is a cross-user document move, which a client-only Firestore rule can't do atomically.
 *  - looking up a recipient by email needs to read users/{uid} docs the caller doesn't own; that
 *    collection is intentionally owner/admin-only to Firestore clients.
 */
const router = express.Router();

const wrap = (fn: (req: any, res: express.Response) => Promise<any>) => async (req: any, res: express.Response) => {
  try {
    await fn(req, res);
  } catch (e: any) {
    if (e instanceof TransferError) return res.status(e.status).json({ error: e.message });
    console.error("[Transfers]", req.method, req.path, e.message);
    return res.status(500).json({ error: "Transfer service failed. Please try again." });
  }
};

router.post(
  "/api/transfers/lookup-recipient",
  authenticateUser,
  rateLimit("transfer-lookup", 30, 15 * 60 * 1000),
  wrap(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (email === String(req.user.email || "").toLowerCase()) {
      return res.status(400).json({ error: "You cannot transfer assets to your own account." });
    }

    const snap = await dbAdmin.collection("users").where("email", "==", email).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ error: `No registered packer.tools account found for "${email}".` });
    }

    const doc = snap.docs[0];
    const data = doc.data();
    res.json({
      uid: doc.id,
      displayName: data.displayName || data.company || "Packer.Tools Member",
      photoURL: data.photoURL || null,
      plan: data.plan || "Free",
    });
  })
);

router.post(
  "/api/transfers/execute",
  authenticateUser,
  rateLimit("transfer-execute", 10, 60 * 60 * 1000),
  wrap(async (req, res) => {
    const senderUid = req.user.uid as string;
    const recipientUid = String(req.body?.recipientUid || "");
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 500) : undefined;
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!recipientUid) return res.status(400).json({ error: "Missing recipient." });
    const items: TransferItemRef[] = rawItems
      .filter((i: any) => i && typeof i.id === "string" && ["gear", "gearLibrary", "inventory", "packingList"].includes(i.type))
      .map((i: any) => ({ type: i.type, id: i.id }));

    const recipientDoc = await dbAdmin.collection("users").doc(recipientUid).get();
    if (!recipientDoc.exists) return res.status(404).json({ error: "Recipient account no longer exists." });
    const recipientData = recipientDoc.data()!;

    const senderDoc = await dbAdmin.collection("users").doc(senderUid).get();
    const senderData = senderDoc.data() || {};

    const { items: recordItems } = await executeTransfer(dbAdmin, senderUid, recipientUid, items, notes);

    const refId = `TRF-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const newRecord = {
      transferReference: refId,
      senderUid,
      senderEmail: req.user.email || "",
      senderName: senderData.displayName || "Enterprise User",
      senderOrgName: senderData.company || "Enterprise Org",
      recipientUid,
      recipientEmail: recipientData.email || "",
      recipientName: recipientData.displayName || recipientData.company || "Enterprise Member",
      recipientOrgName: recipientData.company || "",
      items: recordItems,
      transferredAt: new Date().toISOString(),
      status: "completed",
      pinVerified: true,
      notes: notes || "",
    };

    const docRef = await dbAdmin.collection("assetTransfers").add(newRecord);
    res.json({ id: docRef.id, ...newRecord });
  })
);

export default router;
