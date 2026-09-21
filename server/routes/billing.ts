import express from "express";
import axios from "axios";
import { dbAdmin } from "../firebaseAdmin";
import { authenticateUser } from "../middleware/auth";
import { getPayPalAccessToken, getPayPalConfig } from "../utils/paypal";
import { getServerPlan, computePlanPriceUsd, sanitizeSeats, PAID_PLAN_IDS } from "../utils/plans";

const router = express.Router();

router.post("/api/billing/activate-free", authenticateUser, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    await dbAdmin.collection("users").doc(uid).update({
      plan: 'free',
      extraSeats: 0,
      subscriptionStatus: 'active',
      trialActive: false,
      manualPaymentPending: false,
      updatedAt: new Date().toISOString()
    });
    return res.json({ success: true, plan: 'free' });
  } catch (err: any) {
    console.error("Free activation failed:", err.message);
    return res.status(500).json({ error: "Free activation failed." });
  }
});

router.post("/api/billing/activate-trial", authenticateUser, async (req: any, res) => {
  try {
    const { planId } = req.body || {};
    const uid = req.user.uid;

    const plan = await getServerPlan(planId);
    if (!plan || !PAID_PLAN_IDS.includes(plan.id) || !plan.trialEnabled) {
      return res.status(400).json({ error: "Trials are not available for this plan." });
    }

    const userRef = dbAdmin.collection("users").doc(uid);
    const days = plan.trialDays || 14; // server-controlled; client-supplied trialDays is ignored
    const trialStartDate = new Date().toISOString();
    const trialEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const claimed = await dbAdmin.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (snap.data()?.hasHadTrial) return false;
      tx.update(userRef, {
        plan: plan.id,
        subscriptionStatus: "trialing",
        trialStartDate,
        trialEndDate,
        trialActive: true,
        hasHadTrial: true,
        updatedAt: new Date().toISOString()
      });
      return true;
    });
    if (!claimed) {
      return res.status(400).json({ error: "Trial registration key already claimed or expired." });
    }

    return res.json({ success: true, plan: plan.id, subscriptionStatus: "trialing" });
  } catch (err: any) {
    console.error("Trial activation failed:", err.message);
    return res.status(500).json({ error: "Trial activation failed." });
  }
});

// Manual (offline) payments only record a REQUEST. The plan is granted when an admin approves it.
router.post("/api/billing/activate-manual", authenticateUser, async (req: any, res) => {
  try {
    const { planId, referenceId } = req.body || {};
    const uid = req.user.uid;
    const plan = await getServerPlan(planId);
    if (!plan || !PAID_PLAN_IDS.includes(plan.id)) {
      return res.status(400).json({ error: "Invalid plan." });
    }
    await dbAdmin.collection("users").doc(uid).update({
      manualPaymentRequestedPlan: plan.id,
      manualPaymentPending: true,
      manualPaymentReference: String(referenceId || "").slice(0, 128),
      subscriptionStatus: "pending",
      updatedAt: new Date().toISOString()
    });
    return res.json({ success: true, requestedPlan: plan.id, subscriptionStatus: "pending" });
  } catch (err: any) {
    console.error("Manual activation failed:", err.message);
    return res.status(500).json({ error: "Manual activation failed." });
  }
});

router.post("/api/paypal/create-order", authenticateUser, async (req: any, res) => {
  try {
    // Price is computed server-side; client-supplied amount/currency are ignored (charged in USD).
    const { planId, billingCycle } = req.body || {};
    const cycle: "monthly" | "annual" = billingCycle === "annual" ? "annual" : "monthly";
    const extraSeats = sanitizeSeats(req.body?.extraSeats);
    const plan = await getServerPlan(planId);
    if (!plan || !PAID_PLAN_IDS.includes(plan.id)) {
      return res.status(400).json({ error: "Invalid plan." });
    }
    const amount = computePlanPriceUsd(plan, cycle, extraSeats);
    if (!(amount > 0)) return res.status(400).json({ error: "Invalid amount." });

    const accessToken = await getPayPalAccessToken();
    const { sandboxMode } = await getPayPalConfig();
    const host = sandboxMode ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

    const response = await axios.post(
      `${host}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: "USD", value: amount.toFixed(2) },
            description: `Packer Tools ${plan.id} Plan Subscription`,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    await dbAdmin.collection("paypalOrders").doc(response.data.id).set({
      uid: req.user.uid,
      planId: plan.id,
      billingCycle: cycle,
      extraSeats,
      amount: amount.toFixed(2),
      currency: "USD",
      status: "created",
      createdAt: new Date().toISOString()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error("PayPal Create Order Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create PayPal order" });
  }
});

router.post("/api/paypal/capture-order", authenticateUser, async (req: any, res) => {
  try {
    const { orderID } = req.body || {};
    if (typeof orderID !== "string" || !/^[A-Za-z0-9_-]{5,64}$/.test(orderID)) {
      return res.status(400).json({ error: "Invalid order." });
    }
    const uid = req.user.uid;
    const orderRef = dbAdmin.collection("paypalOrders").doc(orderID);
    const orderSnap = await orderRef.get();
    const order = orderSnap.data();
    // Plan, seats and amount come from the server-side record, never from the request body.
    if (!order || order.uid !== uid) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (order.status !== "created") {
      return res.status(409).json({ error: "Order already processed." });
    }

    const accessToken = await getPayPalAccessToken();
    const { sandboxMode } = await getPayPalConfig();
    const host = sandboxMode ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

    const response = await axios.post(
      `${host}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    const capture = response.data?.purchase_units?.[0]?.payments?.captures?.[0];
    const paidOk =
      response.data?.status === "COMPLETED" &&
      capture?.status === "COMPLETED" &&
      capture?.amount?.currency_code === order.currency &&
      capture?.amount?.value === order.amount;

    if (paidOk) {
      await orderRef.update({ status: "captured", capturedAt: new Date().toISOString() });
      await dbAdmin.collection("users").doc(uid).update({
        plan: order.planId,
        extraSeats: order.extraSeats,
        subscriptionStatus: "active",
        trialActive: false,
        updatedAt: new Date().toISOString()
      });
      console.log(`[PayPal] Validated payment; upgraded user ${uid} to plan ${order.planId}`);
    } else {
      await orderRef.update({ status: "mismatch", updatedAt: new Date().toISOString() });
      console.error(`[PayPal] Capture mismatch for order ${orderID}`);
      return res.status(400).json({ error: "Payment could not be verified." });
    }

    res.json({ status: "COMPLETED", id: response.data.id });
  } catch (error: any) {
    console.error("PayPal Capture Order Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to capture PayPal order" });
  }
});

export default router;
