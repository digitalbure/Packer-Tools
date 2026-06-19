import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface DodoSubscriptionPayload {
  event: 'subscription.created' | 'subscription.updated' | 'subscription.cancelled' | string;
  data: {
    id: string; // Dodo subscription ID
    status: 'active' | 'trialing' | 'paused' | 'cancelled' | string;
    customer: {
      id: string;
      email: string;
      name?: string;
    };
    metadata?: {
      userUid?: string; // Embedded metadata containing the user's Firestore UID
      email?: string;
    };
    product_id?: string;
    price_id?: string;
    billing_cycle?: 'monthly' | 'annual' | string;
  };
}

/**
 * Utility class to process incoming Dodo Payments Webhook payloads and synchronize plan status.
 * Used inside server-side endpoints (port 3000) or simulated workspace webhooks triggers.
 */
export class DodoPaymentsWebhookHandler {
  /**
   * Main entry handler to route Dodo Payments events
   */
  static async processWebhookEvent(payload: DodoSubscriptionPayload): Promise<{ success: boolean; message: string }> {
    const { event, data } = payload;
    const userUid = data.metadata?.userUid;
    const email = data.metadata?.email || data.customer?.email;

    console.log(`[Dodo Payments Webhook Handler] Received event "${event}" for subscription ID "${data.id}"`);

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
          console.log(`[Dodo Payments Webhook Handler] Mapped email "${email}" to Firestore user UID "${targetUid}"`);
        }
      } catch (err) {
        console.warn("[Dodo Payments Webhook Handler] Failed matching email fallback: ", err);
      }
    }

    if (!targetUid) {
      return {
        success: false,
        message: `Unable to map event to a valid user. metadata.userUid and customer.email are both absent or unmatched.`
      };
    }

    const userDocRef = doc(db, 'users', targetUid);

    // 2. Identify the target Plan mapping based on Dodo Product/Price IDs
    let mappedPlan: 'free' | 'pro' | 'enterprise' = 'free';
    const priceId = data.price_id;
    const productId = data.product_id;

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

    // 3. Handle specific Dodo events
    try {
      switch (event) {
        case 'subscription.created': {
          const isTrial = data.status === 'trialing';
          await updateDoc(userDocRef, {
            plan: mappedPlan,
            subscriptionStatus: data.status,
            dodoSubscriptionId: data.id,
            dodoCustomerId: data.customer?.id || '',
            planActivatedAt: new Date().toISOString(),
            trialEndsAt: isTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null
          });
          return {
            success: true,
            message: `User ${targetUid} successfully upgraded to "${mappedPlan}" plan via Dodo Payments (Status: ${data.status}).`
          };
        }

        case 'subscription.updated': {
          await updateDoc(userDocRef, {
            plan: mappedPlan,
            subscriptionStatus: data.status,
            dodoSubscriptionId: data.id,
            planLastRenewedAt: new Date().toISOString()
          });
          return {
            success: true,
            message: `User ${targetUid} plan allocation updated to "${mappedPlan}" via Dodo Payments (Status: ${data.status}).`
          };
        }

        case 'subscription.cancelled': {
          await updateDoc(userDocRef, {
            plan: 'free',
            subscriptionStatus: 'canceled',
            planCanceledAt: new Date().toISOString()
          });
          return {
            success: true,
            message: `User ${targetUid} subscription canceled. Reconfigured to default free tier.`
          };
        }

        default:
          return {
            success: true,
            message: `Event "${event}" accepted but no specific database modifications were required.`
          };
      }
    } catch (dbError: any) {
      console.error("[Dodo Payments Webhook Handler] Firestore update transaction aborted:", dbError);
      return {
        success: false,
        message: `Database synchronization error: ${dbError.message}`
      };
    }
  }
}
