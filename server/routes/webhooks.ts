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

/**
 * Exact-match plan mapping from environment config, e.g.
 *   PADDLE_PRO_IDS="pri_abc,pro_abc"  PADDLE_ENTERPRISE_IDS="pri_xyz"  (same for DODO_*)
 * No substring matching: an unknown identifier maps to null and the webhook is rejected.
 */
function mapProviderPlan(productId: any, priceId: any, provider: 'PADDLE' | 'DODO'): 'pro' | 'enterprise' | null {
  const ids = [productId, priceId].filter((v): v is string => typeof v === 'string' && v.length > 0);
  const list = (name: string) => (process.env[`${provider}_${name}_IDS`] || '').split(',').map(x => x.trim()).filter(Boolean);
  const ent = list('ENTERPRISE');
  const pro = list('PRO');
  if (ids.some(i => ent.includes(i))) return 'enterprise';
  if (ids.some(i => pro.includes(i))) return 'pro';
  return null;
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

    const priceId = data?.items?.[0]?.price?.id || '';
    const productId = data?.items?.[0]?.price?.product?.id || '';
    const mappedPlan = mapProviderPlan(productId, priceId, 'PADDLE');
    if (mappedPlan === null && event_type !== 'subscription.canceled') {
      console.error(`[Paddle Webhook] Unmapped product/price (${productId}/${priceId}); refusing to change plan.`);
      return res.status(422).json({ error: "Unmapped plan identifier." });
    }

    switch (event_type) {
      case 'subscription.created': {
        const isTrial = data?.status === 'trialing';
        await userRef.update({
          plan: mappedPlan ?? 'free',
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
          plan: mappedPlan ?? 'free',
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

    const mappedPlan = mapProviderPlan(data?.product_id, data?.price_id, 'DODO');
    if (mappedPlan === null && event !== 'subscription.cancelled') {
      console.error(`[Dodo Webhook] Unmapped product/price (${data?.product_id}/${data?.price_id}); refusing to change plan.`);
      return res.status(422).json({ error: "Unmapped plan identifier." });
    }

    switch (event) {
      case 'subscription.created': {
        const isTrial = data?.status === 'trialing';
        await userRef.update({
          plan: mappedPlan ?? 'free',
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
          plan: mappedPlan ?? 'free',
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
