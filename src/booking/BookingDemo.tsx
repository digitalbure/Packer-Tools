import { useState } from 'react';
import BookingWidget from './BookingWidget';

/** Development preview only. Sample gear values, not shown in production. */
export default function BookingDemo() {
  const [done, setDone] = useState(false);
  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', padding: '0 1rem' }}>
      <BookingWidget dailyRate={120} deposit={500} format={(n) => `$${n.toFixed(2)}`} conditions={['Return with all cases and cables.', 'Renter covers damage while on hire.']} submitting={false} done={done} onSubmit={() => setDone(true)} onReset={() => setDone(false)} />
    </div>
  );
}
