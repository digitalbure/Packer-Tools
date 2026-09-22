import { useEffect, useState } from 'react';
import { usePickupPoints } from '../booking/usePickupPoints';
import '../booking/booking.css';

/** Stored on each booking. Field names are kept so older bookings and callers still read correctly. */
export interface PickupDropoffState {
  pickupType: 'preset' | 'custom';
  pickupLocationId: string;
  pickupLabel?: string;
  pickupCustomAddress: string;
  pickupTimeSlot: string;
  pickupNotes: string;
  dropoffType: 'preset' | 'custom';
  dropoffLocationId: string;
  dropoffLabel?: string;
  dropoffCustomAddress: string;
  dropoffTimeSlot: string;
  dropoffNotes: string;
  distanceKm: number;
  transitCost: number;
}

interface Props {
  onChange: (state: PickupDropoffState) => void;
  initialState?: Partial<PickupDropoffState>;
  ownerId?: string;
}

const SLOTS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

const CUSTOM = '__custom__';

function Leg({ title, prefix, points, allowCustom, value, onValue, address, onAddress, slot, onSlot, notes, onNotes }: {
  title: string; prefix: string; points: { id: string; name: string; address: string; city?: string }[]; allowCustom: boolean;
  value: string; onValue: (v: string) => void; address: string; onAddress: (v: string) => void;
  slot: string; onSlot: (v: string) => void; notes: string; onNotes: (v: string) => void;
}) {
  const chosen = points.find((p) => p.id === value);
  return (
    <fieldset className="bk__fs">
      <legend>{title}</legend>
      {points.length > 0 && (
        <div className="bk__field">
          <label className="bk__label" htmlFor={`${prefix}-point`}>Location</label>
          <select id={`${prefix}-point`} className="bk__input" value={value} onChange={(e) => onValue(e.target.value)}>
            {points.map((p) => <option key={p.id} value={p.id}>{p.name}{p.city ? `, ${p.city}` : ''}</option>)}
            {allowCustom && <option value={CUSTOM}>Another address</option>}
          </select>
          {chosen && <p className="bk__note">{chosen.address}</p>}
        </div>
      )}
      {value === CUSTOM && (
        <div className="bk__field">
          <label className="bk__label" htmlFor={`${prefix}-addr`}>Address</label>
          <input id={`${prefix}-addr`} className="bk__input" value={address} onChange={(e) => onAddress(e.target.value)} autoComplete="street-address" />
        </div>
      )}
      <div className="bk__field">
        <label className="bk__label" htmlFor={`${prefix}-slot`}>Time of day</label>
        <select id={`${prefix}-slot`} className="bk__input" value={slot} onChange={(e) => onSlot(e.target.value)}>
          {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div className="bk__field">
        <label className="bk__label" htmlFor={`${prefix}-notes`}>Notes (optional)</label>
        <input id={`${prefix}-notes`} className="bk__input" value={notes} onChange={(e) => onNotes(e.target.value)} />
      </div>
    </fieldset>
  );
}

export default function PickupDropoffWidget({ onChange, initialState, ownerId }: Props) {
  const { enabled, points, allowCustom } = usePickupPoints(ownerId);
  const first = points[0]?.id ?? CUSTOM;

  const [pLoc, setPLoc] = useState(initialState?.pickupType === 'custom' ? CUSTOM : initialState?.pickupLocationId || '');
  const [dLoc, setDLoc] = useState(initialState?.dropoffType === 'custom' ? CUSTOM : initialState?.dropoffLocationId || '');
  const [pAddr, setPAddr] = useState(initialState?.pickupCustomAddress || '');
  const [dAddr, setDAddr] = useState(initialState?.dropoffCustomAddress || '');
  const [pSlot, setPSlot] = useState(initialState?.pickupTimeSlot || 'morning');
  const [dSlot, setDSlot] = useState(initialState?.dropoffTimeSlot || 'afternoon');
  const [pNotes, setPNotes] = useState(initialState?.pickupNotes || '');
  const [dNotes, setDNotes] = useState(initialState?.dropoffNotes || '');

  const validOr = (v: string) => (v === CUSTOM ? (allowCustom || points.length === 0 ? CUSTOM : first) : points.some((p) => p.id === v) ? v : first);
  const pSel = validOr(pLoc);
  const dSel = validOr(dLoc);

  useEffect(() => {
    if (!enabled) return;
    const name = (id: string) => points.find((p) => p.id === id)?.name || '';
    onChange({
      pickupType: pSel === CUSTOM ? 'custom' : 'preset',
      pickupLocationId: pSel === CUSTOM ? '' : pSel,
      pickupLabel: pSel === CUSTOM ? '' : name(pSel),
      pickupCustomAddress: pSel === CUSTOM ? pAddr : '',
      pickupTimeSlot: pSlot,
      pickupNotes: pNotes,
      dropoffType: dSel === CUSTOM ? 'custom' : 'preset',
      dropoffLocationId: dSel === CUSTOM ? '' : dSel,
      dropoffLabel: dSel === CUSTOM ? '' : name(dSel),
      dropoffCustomAddress: dSel === CUSTOM ? dAddr : '',
      dropoffTimeSlot: dSlot,
      dropoffNotes: dNotes,
      distanceKm: 0,
      transitCost: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, points, pSel, dSel, pAddr, dAddr, pSlot, dSlot, pNotes, dNotes]);

  if (!enabled) return <p className="bk__note">The owner arranges pickup and return with you after you send the request.</p>;

  return (
    <div style={{ display: 'grid', gap: '.75rem' }}>
      <Leg title="Pickup" prefix="pk" points={points} allowCustom={allowCustom} value={pSel} onValue={setPLoc} address={pAddr} onAddress={setPAddr} slot={pSlot} onSlot={setPSlot} notes={pNotes} onNotes={setPNotes} />
      <Leg title="Return" prefix="rt" points={points} allowCustom={allowCustom} value={dSel} onValue={setDLoc} address={dAddr} onAddress={setDAddr} slot={dSlot} onSlot={setDSlot} notes={dNotes} onNotes={setDNotes} />
    </div>
  );
}
