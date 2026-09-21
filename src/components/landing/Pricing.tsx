import React, { useState } from 'react';
import type { FeatureKey, Plan } from '../../types';
import { useAuth } from '../../providers/AuthProvider';
import { num, trialLabel } from './plans';
import { startWithGoogle } from './Chrome';

const BASE: string[] = ['Gear library and packing lists', 'Foam layout designer', 'Travel case blueprints', 'QR labels and share links', 'Reminders'];
const INCLUDED: [FeatureKey, string][] = [
  ['kioskMode', 'Kiosk check-out and returns'],
  ['kioskOrderMode', 'Kiosk order mode'],
  ['digitalSignatures', 'Signature capture'],
  ['orgManagement', 'Organizations, departments and teams'],
  ['inventoryManagement', 'Inventory sheets'],
  ['projectCost', 'Projects and costs'],
  ['supplierManagement', 'Suppliers and BOM'],
  ['marketplace', 'Rentals and marketplace'],
  ['customBarcodes', 'Custom barcodes'],
  ['apiIntegrations', 'API access'],
  ['branding', 'Your own branding'],
  ['rfidTracking', 'RFID tracking'],
  ['weightAnalytics', 'Weight analytics'],
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'FJD', 'CAD', 'NZD'];

export default function Pricing({ plans, signedIn, contactEmail }: { plans: Plan[]; signedIn: boolean; contactEmail: string }) {
  const [yearly, setYearly] = useState(false);
  const { formatCurrency, selectedCurrency, setSelectedCurrency } = useAuth();
  const hasAnnual = plans.some(p => num(p.annualPrice) > 0);
  const featuredId = plans.length > 2 ? plans[1].id : undefined;

  if (plans.length === 0) return null;
  return (
    <section id="pricing" className="pl-section" aria-labelledby="pricing-h" style={{ background: 'var(--raised)' }}>
      <div className="pl-wrap pl-pricing">
        <div className="pl-pricing__head">
          <h2 id="pricing-h" className="pl-display pl-h2">Start free. Add the kiosk when you are ready.</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', alignItems: 'center' }}>
            {hasAnnual && (
              <div className="pl-toggle" role="group" aria-label="Billing period">
                <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
                <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
              </div>
            )}
            <label className="pl-fine">
              <span className="pl-soft">Show prices in </span>
              <select className="pl-currency" value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <p className="pl-fine pl-soft">You are billed in US dollars. Other currencies are shown for reference.</p>
        </div>

        <div className="pl-plans">
          {plans.map(p => {
            const price = num(p.price);
            const annual = num(p.annualPrice);
            const showYearly = yearly && annual > 0 && price > 0;
            const perMonth = showYearly ? annual / 12 : price;
            const trial = trialLabel(p);
            const paid = price > 0;
            return (
              <article key={p.id} className="pl-plan" data-featured={p.id === featuredId}>
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  <h3 className="pl-h3">{p.name}</h3>
                  <div className="pl-plan__price">
                    {paid ? formatCurrency(perMonth, 'USD') : 'Free'}
                    {paid && <small> per month</small>}
                  </div>
                  <p className="pl-fine pl-soft">
                    {paid ? (showYearly ? `Billed yearly at ${formatCurrency(annual, 'USD')}.` : hasAnnual && annual > 0 ? `Or ${formatCurrency(annual, 'USD')} billed yearly.` : 'Billed monthly.') : 'No card needed.'}
                    {paid && num(p.extraSeatCost) > 0 ? ` Extra seats ${formatCurrency(num(p.extraSeatCost), 'USD')} each per month.` : ''}
                  </p>
                </div>

                {signedIn ? (
                  <a className={`pl-btn ${p.id === featuredId ? 'pl-btn--primary' : 'pl-btn--ghost'}`} href="#/dashboard">Open your workspace</a>
                ) : (
                  <button type="button" className={`pl-btn ${p.id === featuredId ? 'pl-btn--primary' : 'pl-btn--ghost'}`} onClick={startWithGoogle}>
                    {paid && trial ? `Start the ${trial}` : 'Start free with Google'}
                  </button>
                )}

                <div className="pl-limits pl-data">
                  <div><span>Gear items</span><span>{num(p.maxGearItems).toLocaleString()}</span></div>
                  <div><span>Packing lists</span><span>{num(p.maxPackingLists).toLocaleString()}</span></div>
                  <div><span>Inventory sheet items</span><span>{num(p.maxInventoryItems).toLocaleString()}</span></div>
                  <div><span>Projects</span><span>{num(p.maxProjects) > 0 ? num(p.maxProjects).toLocaleString() : 'None'}</span></div>
                </div>

                <ul className="pl-incl">
                  {BASE.map(t => <li key={t} data-on="true">{t}</li>)}
                  {INCLUDED.map(([key, label]) => <li key={key} data-on={!!p.features?.includes(key)}>{label}</li>)}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="pl-body pl-soft">
          Need more seats, a custom agreement or help moving a big inventory? Write to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </div>
    </section>
  );
}
