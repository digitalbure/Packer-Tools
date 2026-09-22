export type DepositMode = 'off' | 'flat' | 'percent' | 'owner_choice';

export interface DepositPolicy {
  /** off: no deposit anywhere. flat: same $ amount on every listing. percent: a % of the item's price. owner_choice: each owner sets their own amount, inside min/max. */
  mode: DepositMode;
  /** Used by mode 'percent', and as the starting value an owner sees under 'owner_choice'. */
  percent: number;
  /** Used by mode 'flat', and as the starting value an owner sees under 'owner_choice'. */
  flatAmount: number;
  /** Floor applied to a computed or owner-set deposit. 0 = no floor. */
  minAmount: number;
  /** Ceiling applied to a computed or owner-set deposit. 0 = no ceiling. */
  maxAmount: number;
  /** Whether a rentable listing must carry a deposit greater than zero to be listed. */
  required: boolean;
}

export const DEFAULT_DEPOSIT_POLICY: DepositPolicy = {
  mode: 'percent',
  percent: 20,
  flatAmount: 0,
  minAmount: 0,
  maxAmount: 0,
  required: false,
};

export function normalizeDepositPolicy(raw?: Partial<DepositPolicy> | null): DepositPolicy {
  const p = { ...DEFAULT_DEPOSIT_POLICY, ...(raw || {}) };
  if (!['off', 'flat', 'percent', 'owner_choice'].includes(p.mode)) p.mode = 'percent';
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && v >= 0 ? v : fallback);
  p.percent = Math.min(100, num(p.percent, DEFAULT_DEPOSIT_POLICY.percent));
  p.flatAmount = num(p.flatAmount, 0);
  p.minAmount = num(p.minAmount, 0);
  p.maxAmount = num(p.maxAmount, 0);
  return p;
}

const clamp = (amount: number, policy: DepositPolicy) => {
  let a = Math.max(0, amount);
  if (policy.minAmount > 0) a = Math.max(a, policy.minAmount);
  if (policy.maxAmount > 0) a = Math.min(a, policy.maxAmount);
  return Math.round(a * 100) / 100;
};

/**
 * The deposit to quote a renter for one item, following the admin's policy.
 * `ownerAmount` is the owner's own figure (their listing's set deposit, or their
 * saved default) — used only under 'owner_choice', and always clamped to policy bounds.
 */
export function computeDeposit(rawPolicy: Partial<DepositPolicy> | null | undefined, itemPrice: number, ownerAmount?: number): number {
  const policy = normalizeDepositPolicy(rawPolicy);
  const price = Number.isFinite(itemPrice) && itemPrice > 0 ? itemPrice : 0;
  switch (policy.mode) {
    case 'off':
      return 0;
    case 'flat':
      return clamp(policy.flatAmount, policy);
    case 'percent':
      return clamp(price * (policy.percent / 100), policy);
    case 'owner_choice':
      return clamp(ownerAmount && ownerAmount > 0 ? ownerAmount : policy.flatAmount, policy);
  }
}

/** Whether an owner can set their own deposit amount (vs. the admin's figure applying to everyone). */
export function ownerSetsDeposit(rawPolicy: Partial<DepositPolicy> | null | undefined): boolean {
  return normalizeDepositPolicy(rawPolicy).mode === 'owner_choice';
}
