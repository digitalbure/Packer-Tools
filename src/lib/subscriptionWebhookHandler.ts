import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface PaddleSubscriptionPayload {
  event_type: 'subscription.created' | 'subscription.updated' | 'subscription.canceled' | string;
  data: {
    id: string; // Paddle subscription ID
    status: 'active' | 'trialing' | 'paused' | 'canceled' | string;
    customer_id: string;
    custom_data?: {
      userUid?: string; // Embedded metadata containing the user's Firestore UID
      email?: string;
    };
    items?: Array<{
      price?: {
        id: string; // Price ID linked to the Plan
        product?: {
          id: string; // Product id
        }
      };
    }>;
  };
}

/**
 * Utility class to process incoming Paddle Webhook payloads and synchronize plan status.
 * Used inside server-side endpoints (port 3000) or simulated workspace webhooks triggers.
 */
export class SubscriptionWebhookHandler {
  /**
   * Main entry handler to route Paddle events
   */
  static async processWebhookEvent(payload: PaddleSubscriptionPayload): Promise<{ success: boolean; message: string }> {
    const { event_type, data } = payload;
    const userUid = data.custom_data?.userUid;
    const email = data.custom_data?.email;

    console.log(`[Paddle Webhook Handler] Received event "${event_type}" for subscription ID "${data.id}"`);

    // 1. Locate the correct user document inside Google Firestore
    let targetUid = userUid;

    if (!targetUid && email) {
      // Fallback: If UID is missing, filter the users collection by their registered email address
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnap = await getDocs(q);
        
        if (!querySnap.empty) {
          targetUid = querySnap.docs[0].id;
          console.log(`[Paddle Webhook Handler] Mapped email "${email}" to Firestore user UID "${targetUid}"`);
        }
      } catch (err) {
        console.warn("[Paddle Webhook Handler] Failed matching email fallback: ", err);
      }
    }

    if (!targetUid) {
      return {
        success: false,
        message: `Unable to map event to a valid user. custom_data.userUid and custom_data.email are both absent or unmatched.`
      };
    }

    const userDocRef = doc(db, 'users', targetUid);

    // 2. Identify the target Plan mapping based on Paddle Product/Price IDs
    let mappedPlan: 'free' | 'pro' | 'enterprise' = 'free';
    const priceId = data.items?.[0]?.price?.id;
    const productId = data.items?.[0]?.price?.product?.id;

    if (productId) {
      // Direct SKU lookup
      if (productId.toLowerCase().includes('enterprise') || productId.toLowerCase().includes('ent')) {
        mappedPlan = 'enterprise';
      } else if (productId.toLowerCase().includes('pro')) {
        mappedPlan = 'pro';
      }
    } else if (priceId) {
      // Alternative price ID mapping fallback
      if (priceId.toLowerCase().includes('enterprise') || priceId.toLowerCase().includes('ent')) {
        mappedPlan = 'enterprise';
      } else if (priceId.toLowerCase().includes('pro')) {
        mappedPlan = 'pro';
      }
    }

    // 3. Handle specific Paddle events
    try {
      switch (event_type) {
        case 'subscription.created': {
          const isTrial = data.status === 'trialing';
          await updateDoc(userDocRef, {
            plan: mappedPlan,
            subscriptionStatus: data.status,
            paddleSubscriptionId: data.id,
            paddleCustomerId: data.customer_id,
            planActivatedAt: new Date().toISOString(),
            trialEndsAt: isTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null
          });
          return {
            success: true,
            message: `User ${targetUid} successfully upgraded to "${mappedPlan}" plan (Status: ${data.status}).`
          };
        }

        case 'subscription.updated': {
          // Process renewals or tier shifts (e.g. Pro to Enterprise upgrade)
          await updateDoc(userDocRef, {
            plan: mappedPlan,
            subscriptionStatus: data.status,
            paddleSubscriptionId: data.id,
            planLastRenewedAt: new Date().toISOString()
          });
          return {
            success: true,
            message: `User ${targetUid} plan allocation updated to "${mappedPlan}" (Status: ${data.status}).`
          };
        }

        case 'subscription.canceled': {
          // Revert user to standard free template tier
          await updateDoc(userDocRef, {
            plan: 'free',
            subscriptionStatus: 'canceled',
            planCanceledAt: new Date().toISOString()
          });
          return {
            success: true,
            message: `User ${targetUid} subscription canceled. Recreted to default free tier.`
          };
        }

        default:
          return {
            success: true,
            message: `Event "${event_type}" accepted but no specific database modifications were required.`
          };
      }
    } catch (dbError: any) {
      console.error("[Paddle Webhook Handler] Firestore update transaction aborted:", dbError);
      return {
        success: false,
        message: `Database synchronization error: ${dbError.message}`
      };
    }
  }
}
