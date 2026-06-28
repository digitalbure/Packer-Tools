import express from "express";
import axios from "axios";
import { dbAdmin } from "../firebaseAdmin";
import { authenticateUser } from "../middleware/auth";
import { getPayPalAccessToken, getPayPalConfig } from "../utils/paypal";

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
    return res.status(500).json({ error: err.message });
  }
});

router.post("/api/billing/activate-trial", authenticateUser, async (req: any, res) => {
  try {
    const { planId, trialDays } = req.body;
    const uid = req.user.uid;
    
    const userDoc = await dbAdmin.collection("users").doc(uid).get();
    const userData = userDoc.data();
    if (userData?.hasHadTrial) {
      return res.status(400).json({ error: "Trial registration key already claimed or expired." });
    }

    const days = trialDays || 14;
    const trialStartDate = new Date().toISOString();
    const trialEndDate = new Date(Date.now() + (days * 24 * 60 * 60 * 1000)).toISOString();

    await dbAdmin.collection("users").doc(uid).update({
      plan: planId,
      subscriptionStatus: 'trialing',
      trialStartDate,
      trialEndDate,
      trialActive: true,
      hasHadTrial: true,
      updatedAt: new Date().toISOString()
    });

    return res.json({ success: true, plan: planId, subscriptionStatus: 'trialing' });
  } catch (err: any) {
    console.error("Trial activation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/api/billing/activate-manual", authenticateUser, async (req: any, res) => {
  try {
    const { planId, referenceId } = req.body;
    const uid = req.user.uid;
    await dbAdmin.collection("users").doc(uid).update({
      plan: planId,
      manualPaymentPending: true,
      manualPaymentReference: referenceId || '',
      subscriptionStatus: 'pending',
      updatedAt: new Date().toISOString()
    });
    return res.json({ success: true, plan: planId, subscriptionStatus: 'pending' });
  } catch (err: any) {
    console.error("Manual activation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/api/paypal/create-order", authenticateUser, async (req, res) => {
  try {
    const { planId, amount, currency } = req.body;
    const currencyCode = currency || "USD";
    const accessToken = await getPayPalAccessToken();
    const { sandboxMode } = await getPayPalConfig();
    const host = sandboxMode ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

    const response = await axios.post(
      `${host}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currencyCode,
              value: amount.toString(),
            },
            description: `Packer Tools ${planId} Plan Subscription`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("PayPal Create Order Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create PayPal order" });
  }
});

router.post("/api/paypal/capture-order", authenticateUser, async (req: any, res) => {
  try {
    const { orderID, planId, extraSeats } = req.body;
    const accessToken = await getPayPalAccessToken();
    const { sandboxMode } = await getPayPalConfig();
    const host = sandboxMode ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

    const response = await axios.post(
      `${host}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status === 'COMPLETED') {
      const uid = req.user.uid;
      await dbAdmin.collection("users").doc(uid).update({
        plan: planId || 'pro',
        extraSeats: extraSeats || 0,
        subscriptionStatus: 'active',
        trialActive: false,
        updatedAt: new Date().toISOString()
      });
      console.log(`[PayPal] Successfully validated and upgraded user ${uid} to plan ${planId}`);
    }

    res.json(response.data);
  } catch (error: any) {
    console.error("PayPal Capture Order Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to capture PayPal order" });
  }
});

export default router;
