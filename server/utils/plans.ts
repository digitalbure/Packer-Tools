import { dbAdmin } from "../firebaseAdmin";

export interface ServerPlan {
  id: string;
  price: number;
  annualPrice?: number;
  extraSeatCost: number;
  trialDays: number;
  trialEnabled: boolean;
}

const DEFAULT_PLANS: Record<string, ServerPlan> = {
  free: { id: "free", price: 0, extraSeatCost: 0, trialDays: 0, trialEnabled: false },
  pro: { id: "pro", price: 19, annualPrice: 180, extraSeatCost: 10, trialDays: 14, trialEnabled: true },
  enterprise: { id: "enterprise", price: 99, annualPrice: 948, extraSeatCost: 10, trialDays: 14, trialEnabled: true },
};

export const PAID_PLAN_IDS = ["pro", "enterprise"];
export const MAX_EXTRA_SEATS = 500;

/** Resolves a plan from Firestore (admin-writable only), falling back to built-in defaults. Returns null for unknown plans. */
export async function getServerPlan(planId: unknown): Promise<ServerPlan | null> {
  if (typeof planId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(planId)) return null;
  const base = DEFAULT_PLANS[planId];
  let doc: FirebaseFirestore.DocumentData | undefined;
  try {
    const snap = await dbAdmin.collection("plans").doc(planId).get();
    if (snap.exists) doc = snap.data();
  } catch (e: any) {
    console.error("[Plans] Firestore lookup failed, using defaults:", e.message);
  }
  if (!doc && !base) return null;
  const num = (v: any, fb: number) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : fb);
  return {
    id: planId,
    price: num(doc?.price, base?.price ?? 0),
    annualPrice: doc?.annualPrice !== undefined ? num(doc.annualPrice, 0) : base?.annualPrice,
    extraSeatCost: num(doc?.extraSeatCost, base?.extraSeatCost ?? 10),
    trialDays: Math.min(num(doc?.trialDays, base?.trialDays ?? 14), 30),
    trialEnabled: doc?.trialEnabled !== undefined ? !!doc.trialEnabled : (base?.trialEnabled ?? false),
  };
}

export function sanitizeSeats(v: unknown): number {
  const n = Math.floor(Number(v));
  return isFinite(n) && n > 0 ? Math.min(n, MAX_EXTRA_SEATS) : 0;
}

/** Authoritative USD price, mirrors client getPlanPrice. */
export function computePlanPriceUsd(plan: ServerPlan, cycle: "monthly" | "annual", extraSeats: number): number {
  if (plan.price === 0) return 0;
  const annual = cycle === "annual";
  const base = annual ? (plan.annualPrice || plan.price * 12) : plan.price;
  const extra = plan.extraSeatCost * extraSeats * (annual ? 12 : 1);
  return Math.round((base + extra) * 100) / 100;
}
