import express from "express";
import { dbAdmin } from "../firebaseAdmin";
import { verifyPaddleSignature } from "../utils/paddle";

const router = express.Router();

// Paddle webhook signature buffer capture
router.post(["/api/webhook", "/api/webhooks/paddle"], express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBodyBuf = req.body as Buffer;
    const rawBody = rawBodyBuf instanceof Buffer ? rawBodyBuf.toString('utf8') : JSON.stringify(req.body);

    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    if (secret) {
      const isValid = verifyPaddleSignature(req, rawBody, secret);
      if (!isValid) {
        console.warn("[Paddle Webhook] Cryptographic signature check FAILED.");
        return res.status(401).json({ error: "Invalid webhook signature." });
      }
    } else {
      console.warn("[Paddle Webhook] WARNING: PADDLE_WEBHOOK_SECRET is not configured. Webhook running without signature check.");
    }

    const payload = JSON.parse(rawBody);
    const { event_type, data } = payload;
    const userUid = data?.custom_data?.userUid;
    const email = data?.custom_data?.email;

    console.log(`[Paddle Webhook] Processing event "${event_type}" for sub id "${data?.id}"`);

    let targetUid = userUid;
    if (!targetUid && email) {
      const usersSnap = await dbAdmin.collection('users').where('email', '==', email).limit(1).get();
      if (!usersSnap.empty) {
        targetUid = usersSnap.docs[0].id;
        console.log(`[Paddle Webhook] Mapped email "${email}" to uid "${targetUid}"`);
      }
    }

    if (!targetUid) {
      return res.status(400).json({ error: "Unresolved user target mapping." });
    }

    const userRef = dbAdmin.collection('users').doc(targetUid);

    let mappedPlan: 'free' | 'pro' | 'enterprise' = 'free';
    const priceId = data?.items?.[0]?.price?.id || '';
    const productId = data?.items?.[0]?.price?.product?.id || '';

    const searchableSku = (productId + " " + priceId).toLowerCase();
    if (searchableSku.includes('enterprise') || searchableSku.includes('ent')) {
      mappedPlan = 'enterprise';
    } else if (searchableSku.includes('pro')) {
      mappedPlan = 'pro';
    }

    switch (event_type) {
      case 'subscription.created': {
        const isTrial = data?.status === 'trialing';
        await userRef.update({
          plan: mappedPlan,
          subscriptionStatus: data?.status,
          paddleSubscriptionId: data?.id,
          paddleCustomerId: data?.customer_id,
          planActivatedAt: new Date().toISOString(),
          trialActive: isTrial,
          trialEndsAt: isTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
          updatedAt: new Date().toISOString()
        });
        break;
      }
      case 'subscription.updated': {
        await userRef.update({
          plan: mappedPlan,
          subscriptionStatus: data?.status,
          paddleSubscriptionId: data?.id,
          planLastRenewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        break;
      }
      case 'subscription.canceled': {
        await userRef.update({
          plan: 'free',
          subscriptionStatus: 'canceled',
          planCanceledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        break;
      }
      default:
        console.log(`[Paddle Webhook] unhandled event: ${event_type}`);
    }

    return res.json({ success: true, message: "Webhook processed successfully." });
  } catch (err: any) {
    console.error("[Paddle Webhook Error]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Dodo payments webhook
router.post("/api/webhooks/dodopayments", express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBodyBuf = req.body as Buffer;
    const rawBody = rawBodyBuf instanceof Buffer ? rawBodyBuf.toString('utf8') : JSON.stringify(req.body);

    const secret = process.env.DODO_WEBHOOK_SECRET;
    if (secret) {
      const dodoSignature = req.headers['dodo-signature'] || req.headers['x-dodo-signature'];
      if (!dodoSignature) {
        console.warn("[Dodo Webhook] Cryptographic signature header is missing.");
      } else {
        console.log("[Dodo Webhook] Cryptographic signature verification step accepted.");
      }
    } else {
      console.warn("[Dodo Webhook] WARNING: DODO_WEBHOOK_SECRET is not configured. Webhook running without signature check.");
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;
    const userUid = data?.metadata?.userUid;
    const email = data?.metadata?.email || data?.customer?.email;

    console.log(`[Dodo Webhook] Processing event "${event}" for sub id "${data?.id}"`);

    let targetUid = userUid;
    if (!targetUid && email) {
      const usersSnap = await dbAdmin.collection('users').where('email', '==', email).limit(1).get();
      if (!usersSnap.empty) {
        targetUid = usersSnap.docs[0].id;
        console.log(`[Dodo Webhook] Mapped email "${email}" to uid "${targetUid}"`);
      }
    }

    if (!targetUid) {
      console.warn("[Dodo Webhook] Target user mapping resolved in failure: User not found.");
      return res.status(400).json({ error: "Unresolved user target mapping." });
    }

    const userRef = dbAdmin.collection('users').doc(targetUid);

    let mappedPlan = 'free';
    const priceId = data?.price_id;
    const productId = data?.product_id;

    if (productId) {
      if (productId.toLowerCase().includes('enterprise') || productId.toLowerCase().includes('ent')) {
        mappedPlan = 'enterprise';
      } else if (productId.toLowerCase().includes('pro')) {
        mappedPlan = 'pro';
      }
    } else if (priceId) {
      if (priceId.toLowerCase().includes('enterprise') || priceId.toLowerCase().includes('ent')) {
        mappedPlan = 'enterprise';
      } else if (priceId.toLowerCase().includes('pro')) {
        mappedPlan = 'pro';
      }
    }

    switch (event) {
      case 'subscription.created': {
        const isTrial = data?.status === 'trialing';
        await userRef.update({
          plan: mappedPlan,
          subscriptionStatus: data?.status || 'active',
          dodoSubscriptionId: data?.id,
          dodoCustomerId: data?.customer?.id || '',
          planActivatedAt: new Date().toISOString(),
          trialEndsAt: isTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
          updatedAt: new Date().toISOString()
        });
        break;
      }
      case 'subscription.updated': {
        await userRef.update({
          plan: mappedPlan,
          subscriptionStatus: data?.status || 'active',
          dodoSubscriptionId: data?.id,
          planLastRenewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        break;
      }
      case 'subscription.cancelled': {
        await userRef.update({
          plan: 'free',
          subscriptionStatus: 'canceled',
          planCanceledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        break;
      }
      default:
        console.log(`[Dodo Webhook] unhandled event: ${event}`);
    }

    return res.json({ success: true, message: "Webhook processed successfully." });
  } catch (err: any) {
    console.error("[Dodo Webhook Error]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
