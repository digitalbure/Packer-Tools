import { useMemo, useState } from 'react';
import PickupDropoffWidget, { PickupDropoffState } from '../components/PickupDropoffWidget';
import { checkDates, quote } from './pricing';
import './booking.css';

export interface BookingRequest {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  startDate: string;
  endDate: string;
  conditions: string[];
  pickupDropoff: PickupDropoffState | null;
  quote: ReturnType<typeof quote>;
}

interface Props {
  dailyRate?: number;
  deposit?: number;
  format: (amount: number) => string;
  conditions: string[];
  ownerId?: string;
  submitting: boolean;
  done: boolean;
  onSubmit: (req: BookingRequest) => void;
  onReset: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const PROBLEM_TEXT = {
  missing: 'Choose a pickup date and a return date.',
  order: 'The return date is before the pickup date.',
  past: 'The pickup date has already passed.',
} as const;

export default function BookingWidget({ dailyRate, deposit, format, conditions, ownerId, submitting, done, onSubmit, onReset }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [agreed, setAgreed] = useState<string[]>([]);
  const [route, setRoute] = useState<PickupDropoffState | null>(null);
  const [tried, setTried] = useState(false);

  const problem = checkDates(start, end, today());
  const q = useMemo(() => quote({ dailyRate, deposit }, start, end), [dailyRate, deposit, start, end]);
  const missingTerms = conditions.filter((c) => !agreed.includes(c));
  const showDateError = (tried || (start && end)) && problem;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problem || !name.trim() || !email.trim() || missingTerms.length) return;
    onSubmit({ clientName: name.trim(), clientEmail: email.trim(), clientPhone: phone.trim(), startDate: start, endDate: end, conditions: agreed, pickupDropoff: route, quote: q });
  };

  const reset = () => { setName(''); setEmail(''); setPhone(''); setStart(''); setEnd(''); setAgreed([]); setRoute(null); setTried(false); onReset(); };

  return (
    <section className="bk" aria-labelledby="bk-title">
      <div className="bk__head">
        <h3 className="bk__title" id="bk-title">Request to book</h3>
        <p className="bk__sub">The owner confirms your dates and arranges pickup and deposit. Nothing is charged here.</p>
      </div>

      {done ? (
        <div className="bk__done" role="status">
          <h4>Request sent</h4>
          <p>The owner has your dates and will contact you at the email you gave.</p>
          <button type="button" className="bk__btn bk__btn--quiet" onClick={reset}>Book other dates</button>
        </div>
      ) : (
        <form className="bk__body" onSubmit={submit} noValidate>
          <div className="bk__row">
            <div className="bk__field">
              <label className="bk__label" htmlFor="bk-start">Pickup date</label>
              <input id="bk-start" className="bk__input" type="date" min={today()} value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!!showDateError} />
            </div>
            <div className="bk__field">
              <label className="bk__label" htmlFor="bk-end">Return date</label>
              <input id="bk-end" className="bk__input" type="date" min={start || today()} value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!showDateError} />
            </div>
          </div>
          {showDateError && problem && <p className="bk__err" role="alert">{PROBLEM_TEXT[problem]}</p>}

          <div className="bk__field">
            <label className="bk__label" htmlFor="bk-name">Your name or company</label>
            <input id="bk-name" className="bk__input" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !name.trim()} />
          </div>
          <div className="bk__row">
            <div className="bk__field">
              <label className="bk__label" htmlFor="bk-email">Email</label>
              <input id="bk-email" className="bk__input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={tried && !email.trim()} />
            </div>
            <div className="bk__field">
              <label className="bk__label" htmlFor="bk-phone">Phone (optional)</label>
              <input id="bk-phone" className="bk__input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="bk__field">
            <span className="bk__label">Pickup and return</span>
            <PickupDropoffWidget onChange={setRoute} ownerId={ownerId} />
          </div>

          {conditions.length > 0 && (
            <fieldset className="bk__fs">
              <legend>Owner's conditions</legend>
              {conditions.map((c) => (
                <label key={c} className="bk__check">
                  <input type="checkbox" checked={agreed.includes(c)} onChange={() => setAgreed((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))} />
                  <span>{c}</span>
                </label>
              ))}
              {tried && missingTerms.length > 0 && <p className="bk__err" role="alert">Accept each condition to continue.</p>}
            </fieldset>
          )}

          <div className="bk__sum" aria-live="polite">
            {dailyRate && dailyRate > 0 ? (
              <div className="bk__line"><span>{format(dailyRate)} per day{q.days > 0 ? ` × ${q.days} ${q.days === 1 ? 'day' : 'days'}` : ''}</span><span>{q.rental !== null ? format(q.rental) : '—'}</span></div>
            ) : (
              <p className="bk__note">The owner has not set a daily rate. Send a request and they will quote you.</p>
            )}
            {q.deposit > 0 && <div className="bk__line"><span>Refundable deposit</span><span>{format(q.deposit)}</span></div>}
            {q.total !== null && <div className="bk__line bk__line--total"><span>Estimated total</span><span>{format(q.total)}</span></div>}
            <p className="bk__note">Availability is confirmed by the owner. Delivery costs, if any, are added separately.</p>
          </div>

          <button type="submit" className="bk__btn" disabled={submitting}>{submitting ? 'Sending request' : 'Send booking request'}</button>
        </form>
      )}
    </section>
  );
}
