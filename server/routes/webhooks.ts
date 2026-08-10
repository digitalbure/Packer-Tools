import express from "express";
import crypto from "crypto";
import { dbAdmin } from "../firebaseAdmin";
import { verifyPaddleSignature } from "../utils/paddle";

const router = express.Router();

function safeTimingCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function verifyDodoSignature(req: express.Request, rawBody: string, secret: string): boolean {
  const signatureHeader = (req.headers['dodo-signature'] || req.headers['x-dodo-signature'] || req.headers['webhook-signature']) as string || '';
  if (!signatureHeader) return false;

  let timestamp = '';
  let signature = '';

  if (signatureHeader.includes('=')) {
    const parts = signatureHeader.split(/[,;]/);
    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') timestamp = v;
      if (k === 'v1' || k === 'sig' || k === 'signature') signature = v;
    }
  } else {
    signature = signatureHeader.trim();
  }

  if (!signature) return false;

  const payloadToSign = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const computedHex = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');
  const computedBase64 = crypto.createHmac('sha256', secret).update(payloadToSign).digest('base64');
  const computedHexRaw = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  return (
    safeTimingCompare(computedHex, signature) ||
    safeTimingCompare(computedBase64, signature) ||
    safeTimingCompare(computedHexRaw, signature)
  );
}

// Paddle webhook signature buffer capture
router.post(["/api/webhook", "/api/webhooks/paddle"], express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBodyBuf = req.body as Buffer;
    const rawBody = rawBodyBuf instanceof Buffer ? rawBodyBuf.toString('utf8') : JSON.stringify(req.body);

    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Paddle Webhook] ERROR: PADDLE_WEBHOOK_SECRET is not configured. Webhook request rejected (fail-closed security rule).");
      return res.status(500).json({ error: "Webhook secret is not configured on the server." });
    }
    const isValid = verifyPaddleSignature(req, rawBody, secret);
    if (!isValid) {
      console.warn("[Paddle Webhook] Cryptographic signature check FAILED.");
      return res.status(401).json({ error: "Invalid webhook signature." });
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
    if (!secret) {
      console.error("[Dodo Webhook] ERROR: DODO_WEBHOOK_SECRET is not configured. Webhook request rejected (fail-closed security rule).");
      return res.status(500).json({ error: "Webhook secret is not configured on the server." });
    }
    
    const isValid = verifyDodoSignature(req, rawBody, secret);
    if (!isValid) {
      console.warn("[Dodo Webhook] Cryptographic signature check FAILED.");
      return res.status(401).json({ error: "Invalid webhook signature." });
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
