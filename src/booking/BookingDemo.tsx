import { useState } from 'react';
import BookingWidget from './BookingWidget';
import { PickupPointsAdminCard } from './PickupPointsAdminCard';
import { AdminSettings } from '../types';

/** Development preview only. Sample gear values, not shown in production. */
export default function BookingDemo() {
  const [done, setDone] = useState(false);
  const [settings, setSettings] = useState<AdminSettings | null>({ plans: [{ id: 'pro', name: 'Pro', features: ['pickupPoints'] }], moduleWidgetConfigs: { pickupPoints: { mode: 'owners', includePlatformPoints: true, allowCustomAddress: true, maxOwnerPoints: 10, platformPoints: [{ id: 'a', name: 'Sample depot', address: '1 Example Street, City' }] } } } as unknown as AdminSettings);
  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', padding: '0 1rem', display: 'grid', gap: '1.5rem' }}>
      <PickupPointsAdminCard settings={settings} setSettings={setSettings} />
      <BookingWidget dailyRate={120} deposit={500} format={(n) => `$${n.toFixed(2)}`} conditions={['Return with all cases and cables.', 'Renter covers damage while on hire.']} submitting={false} done={done} onSubmit={() => setDone(true)} onReset={() => setDone(false)} />
    </div>
  );
}
