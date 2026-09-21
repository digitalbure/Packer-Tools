export interface RateCard {
  dailyRate?: number;
  deposit?: number;
}

export interface Quote {
  days: number;
  rental: number | null;
  deposit: number;
  total: number | null;
}

export type DateProblem = 'missing' | 'order' | 'past' | null;

const DAY_MS = 86_400_000;

function parse(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

/** Inclusive day count: picking up and returning on the same date is one day. */
export function countDays(start: string, end: string): number {
  const a = parse(start);
  const b = parse(end);
  if (a === null || b === null || b < a) return 0;
  return Math.round((b - a) / DAY_MS) + 1;
}

export function checkDates(start: string, end: string, today: string): DateProblem {
  const a = parse(start);
  const b = parse(end);
  if (a === null || b === null) return 'missing';
  if (b < a) return 'order';
  const t = parse(today);
  if (t !== null && a < t) return 'past';
  return null;
}

/** A missing or zero daily rate gives no rental price: the owner has not set one. */
export function quote(rates: RateCard, start: string, end: string): Quote {
  const days = countDays(start, end);
  const rate = rates.dailyRate && rates.dailyRate > 0 ? rates.dailyRate : null;
  const deposit = rates.deposit && rates.deposit > 0 ? rates.deposit : 0;
  const rental = rate !== null && days > 0 ? Math.round(rate * days * 100) / 100 : null;
  return { days, rental, deposit, total: rental === null ? null : Math.round((rental + deposit) * 100) / 100 };
}
