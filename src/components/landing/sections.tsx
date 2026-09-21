import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Plan } from '../../types';
import { INDUSTRIES, KIOSK_POINTS, MODULE_GROUPS, PROBLEMS, VERSUS } from './content';
import { planBadge, num, trialLabel } from './plans';
import { startWithGoogle } from './Chrome';

/* ------------------------------------------------------------------ problems */
export function Problems() {
  return (
    <section className="pl-section pl-dark" aria-labelledby="problems-h">
      <div className="pl-wrap pl-problems">
        <div className="pl-problems__head">
          <h2 id="problems-h" className="pl-display pl-h2">Kit goes missing in the gaps between tools.</h2>
          <p className="pl-lede pl-soft">
            The list is in a spreadsheet. The promises are in a group chat. Nothing holds the truth about where each item is right now.
          </p>
        </div>
        <ul className="pl-strips">
          {PROBLEMS.map(p => (
            <li key={p.note} className="pl-strip">
              <span className="pl-tape-wrap" style={{ ['--r' as string]: `${p.tilt}deg` } as React.CSSProperties}>
                <span className="pl-tape">{p.note}</span>
              </span>
              <p className="pl-soft">{p.fix}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ how it runs */
const CHECKLIST: [string, boolean, string][] = [
  ['Camera body', true, 'CAM-014'],
  ['24-70mm zoom', true, 'LNS-07'],
  ['Battery pack x3', true, 'BAT-21'],
  ['Wireless receiver', false, 'Maya R.'],
];

export function HowItRuns() {
  return (
    <section id="how" className="pl-section" aria-labelledby="how-h">
      <div className="pl-wrap" style={{ display: 'grid', gap: 'clamp(2rem,4vw,3rem)' }}>
        <h2 id="how-h" className="pl-display pl-h2">How a job runs in Packer Tools</h2>
        <ol className="pl-steps">
          <li className="pl-step">
            <span className="pl-step__no" aria-hidden="true">1</span>
            <div className="pl-step__body">
              <h3 className="pl-h3">Catalogue it once</h3>
              <p className="pl-body">Add each item with a photo, serial number, category and asset tag. Print QR or barcode labels for the kit and the cases. Already have a spreadsheet? Import the CSV.</p>
            </div>
            <div className="pl-step__art">
              <div className="pl-label" aria-hidden="true">
                <QRCodeSVG value="https://packer.tools" size={86} marginSize={0} level="M" />
                <div>
                  <div className="pl-label__id">CAM-014</div>
                  <div className="pl-fine">Cinema camera body</div>
                  <div className="pl-fine pl-soft">Depot A, shelf 3</div>
                </div>
              </div>
            </div>
          </li>
          <li className="pl-step">
            <span className="pl-step__no" aria-hidden="true">2</span>
            <div className="pl-step__body">
              <h3 className="pl-h3">Pack it from a list</h3>
              <p className="pl-body">Build packing lists and reusable kits. Lay out the foam in the case designer, or preview how gear sits in a case before you pack it. Progress shows as each item is packed.</p>
            </div>
            <div className="pl-step__art">
              <ul className="pl-checklist" aria-label="Example packing list">
                {CHECKLIST.map(([name, on, meta]) => (
                  <li key={name}>
                    <span className="pl-box" data-on={on} aria-hidden="true" />
                    <span>{name}</span>
                    <span className="pl-fine pl-soft">{on ? meta : `out: ${meta}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
          <li className="pl-step">
            <span className="pl-step__no" aria-hidden="true">3</span>
            <div className="pl-step__body">
              <h3 className="pl-h3">Sign it out</h3>
              <p className="pl-body">Scan at the counter or on a phone. The borrower&rsquo;s name, email and signature are recorded, and a receipt goes to their inbox.</p>
            </div>
            <div className="pl-step__art">
              <div className="pl-sign" aria-hidden="true">
                <svg viewBox="0 0 300 70" fill="none" stroke="#14181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 48 C 30 8, 44 8, 40 40 C 38 58, 58 20, 74 30 C 84 38, 74 52, 96 40 C 116 28, 118 52, 140 36 C 160 22, 170 50, 200 34 L 280 30" />
                </svg>
                <div className="pl-fine pl-soft" style={{ borderTop: '1px solid var(--line)', paddingTop: '0.3rem' }}>Maya R. &middot; Thursday 17:00</div>
              </div>
            </div>
          </li>
          <li className="pl-step">
            <span className="pl-step__no" aria-hidden="true">4</span>
            <div className="pl-step__body">
              <h3 className="pl-h3">Get it back and keep the record</h3>
              <p className="pl-body">Scan returns in. Audit mode flags what is overdue, running low or due for maintenance, and every item keeps its history.</p>
            </div>
            <div className="pl-step__art">
              <div className="pl-flags" aria-label="Example audit flags">
                <div className="pl-flag"><i /><span>Wireless receiver</span><span className="pl-fine">overdue</span></div>
                <div className="pl-flag" data-tone="warn"><i /><span>24-70mm zoom</span><span className="pl-fine">service due</span></div>
                <div className="pl-flag" data-tone="ok"><i /><span>Camera body</span><span className="pl-fine">returned</span></div>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ kiosk */
type Tab = 'scan' | 'sign' | 'receipt';
const TABS: [Tab, string][] = [['scan', 'Scan'], ['sign', 'Sign'], ['receipt', 'Receipt']];

function TabletScreen({ tab }: { tab: Tab }) {
  if (tab === 'scan') {
    return (
      <div className="pl-screen">
        <h3>Scan a tag</h3>
        <div className="pl-scan" aria-hidden="true"><div className="pl-scan__frame" /></div>
        <div>
          <div className="pl-line"><span>CAM-014 Cinema camera body</span><span className="pl-ok" aria-label="added" /></div>
          <div className="pl-line"><span>WRX-03 Wireless receiver</span><span className="pl-ok" aria-label="added" /></div>
        </div>
        <span className="pl-btn pl-btn--primary pl-btn--small" style={{ justifySelf: 'start' }}>Review 2 items</span>
      </div>
    );
  }
  if (tab === 'sign') {
    return (
      <div className="pl-screen">
        <h3>Sign out 2 items</h3>
        <div className="pl-field"><small>Name</small>Maya R.</div>
        <div className="pl-field"><small>Return by</small>Thursday 17:00</div>
        <div className="pl-field" style={{ padding: '0.3rem 0.7rem' }}>
          <small>Signature</small>
          <svg viewBox="0 0 300 50" height="38" fill="none" stroke="#14181b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 34 C 24 4, 36 4, 34 28 C 32 44, 50 14, 64 22 C 74 30, 66 40, 84 30 C 100 20, 104 40, 124 28 L 200 24" />
          </svg>
        </div>
      </div>
    );
  }
  return (
    <div className="pl-screen">
      <h3>Released to Maya R.</h3>
      <div><span className="pl-ok" aria-hidden="true" /></div>
      <div>
        <div className="pl-line"><span>CAM-014 Cinema camera body</span><span className="pl-fine">out</span></div>
        <div className="pl-line"><span>WRX-03 Wireless receiver</span><span className="pl-fine">out</span></div>
      </div>
      <p className="pl-fine pl-soft">Receipt emailed. Due back Thursday 17:00.</p>
    </div>
  );
}

export function Kiosk({ kioskPlan }: { kioskPlan: string | null }) {
  const [tab, setTab] = useState<Tab>('scan');
  return (
    <section id="kiosk" className="pl-section pl-dark" aria-labelledby="kiosk-h">
      <div className="pl-wrap pl-kiosk">
        <div className="pl-kiosk__copy">
          <h2 id="kiosk-h" className="pl-display pl-h2">A check-out counter that runs itself.</h2>
          <p className="pl-lede">
            Set up a tablet as a kiosk for your own inventory. Pair it with a one-time code from your dashboard, then let crew, renters or staff sign gear out and back in. Every transaction lands in your records.
          </p>
          <ul className="pl-ticks">{KIOSK_POINTS.map(t => <li key={t}>{t}</li>)}</ul>
          {kioskPlan && <p className="pl-fine pl-soft">Kiosk mode is included with {kioskPlan} and above.</p>}
        </div>
        <div className="pl-tablet-wrap">
          <div className="pl-tabs" role="tablist" aria-label="Kiosk screens">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" className="pl-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          <div className="pl-tablet" role="tabpanel" aria-label={`Kiosk ${tab} screen (illustration)`}>
            <TabletScreen tab={tab} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ modules */
export function Modules({ plans }: { plans: Plan[] }) {
  return (
    <section id="modules" className="pl-section" aria-labelledby="modules-h">
      <div className="pl-wrap pl-manifest">
        <div style={{ display: 'grid', gap: '1rem' }}>
          <h2 id="modules-h" className="pl-display pl-h2">Everything that goes in the case.</h2>
          <p className="pl-lede pl-soft">One system for the whole life of your kit, from the day you buy it to the day you retire it. A badge means the module needs that plan.</p>
        </div>
        <div className="pl-groups">
          {MODULE_GROUPS.map(g => (
            <div key={g.title} className="pl-group">
              <h3 className="pl-h3 pl-group__head">{g.title}</h3>
              <dl>
                {g.modules.map(m => {
                  const badge = planBadge(m.feature, plans);
                  return (
                    <div key={m.name} className="pl-mod">
                      <dt>{m.name}{badge && <span className="pl-badge">{badge}</span>}</dt>
                      <dd>{m.text}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ who */
export function Who() {
  const [i, setI] = useState(0);
  const cur = INDUSTRIES[i];
  return (
    <section id="who" className="pl-section" aria-labelledby="who-h">
      <div className="pl-wrap" style={{ display: 'grid', gap: 'clamp(2rem,4vw,3rem)' }}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <h2 id="who-h" className="pl-display pl-h2">Built for crews with a lot of kit.</h2>
          <p className="pl-lede pl-soft">Anywhere expensive equipment leaves the building and has to come back. Packer Tools renames Gear, Items and Checklists to suit your industry.</p>
        </div>
        <div className="pl-who">
          <div className="pl-who__tabs" role="tablist" aria-label="Industries" aria-orientation="vertical">
            {INDUSTRIES.map((x, n) => (
              <button key={x.name} type="button" role="tab" id={`who-tab-${n}`} aria-selected={i === n} aria-controls="who-panel" className="pl-who__tab" onClick={() => setI(n)}>
                {x.name}
              </button>
            ))}
          </div>
          <div id="who-panel" role="tabpanel" aria-labelledby={`who-tab-${i}`} className="pl-who__panel">
            <h3 className="pl-h3">{cur.name}</h3>
            <ul className="pl-kit" aria-label="Typical kit">{cur.kit.map(k => <li key={k}>{k}</li>)}</ul>
            <dl className="pl-pair">
              <div><dt>What goes wrong</dt><dd className="pl-soft">{cur.wrong}</dd></div>
              <div><dt>What Packer Tools does</dt><dd>{cur.fix}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ versus */
export function Versus() {
  return (
    <section className="pl-section pl-dark" aria-labelledby="vs-h">
      <div className="pl-wrap" style={{ display: 'grid', gap: '1.75rem' }}>
        <h2 id="vs-h" className="pl-display pl-h2">Spreadsheet and group chat, or Packer Tools?</h2>
        <div className="pl-vs__wrap" role="region" aria-label="Comparison table" tabIndex={0}>
          <table className="pl-vs">
            <thead><tr><th scope="col"><span className="pl-fine pl-soft" style={{ fontFamily: 'var(--f-body)', fontWeight: 500, textTransform: 'none' }}>When you need to know</span></th><th scope="col">Today</th><th scope="col">Packer Tools</th></tr></thead>
            <tbody>
              {VERSUS.map(([q, a, b]) => (
                <tr key={q}><th scope="row">{q}</th><td>{a}</td><td>{b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ claude */
export function ClaudeSection() {
  return (
    <section className="pl-section" aria-labelledby="claude-h">
      <div className="pl-wrap pl-claude">
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <h2 id="claude-h" className="pl-display pl-h2">Ask Claude about your kit.</h2>
          <p className="pl-lede">
            Connect Claude to your Packer Tools account and ask in plain language. Claude can look up gear, check who has what, add new items and update their status.
          </p>
          <p className="pl-body pl-soft">You sign in yourself and approve the connection. It only reaches your account, and you can disconnect it whenever you like.</p>
        </div>
        <div className="pl-chat" aria-label="Example conversation">
          <div className="pl-msg pl-msg--you"><span>Which items for Thursday&rsquo;s shoot are still out?</span></div>
          <div className="pl-msg pl-msg--claude">
            <span>Two. The wireless receiver WRX-03 is with Maya R., due back Thursday 17:00. Battery pack BAT-22 is in maintenance. Everything else is in the case.</span>
          </div>
          <p className="pl-fine pl-soft">Example conversation. Names and tags are made up.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ faq */
export function Faq({ plans, contactEmail }: { plans: Plan[]; contactEmail: string }) {
  const free = plans[0]; const pro = plans[1];
  const cost = free
    ? `${free.name} covers up to ${num(free.maxGearItems).toLocaleString()} items and ${num(free.maxPackingLists).toLocaleString()} packing lists. ${pro ? `${pro.name} adds the kiosk, signatures, projects and team features${trialLabel(pro) ? `, with a ${trialLabel(pro)}` : ''}.` : ''} Plans are billed in USD.`
    : 'Start on the free plan and upgrade when you need the kiosk and team features.';
  const items: [string, string][] = [
    ['Do I need to install anything?', 'No. Packer Tools runs in the browser. Add it to your phone or tablet home screen and it opens full screen and keeps working offline.'],
    ['What can I scan?', 'QR codes and common barcodes (Code 128, Code 39, EAN, UPC, Data Matrix, Aztec) with the camera. RFID tracking is on the Enterprise plan.'],
    ['Can I import my spreadsheet?', 'Yes. Import a CSV into the gear library, then add photos and tags as you go.'],
    ['What happens when there is no signal?', 'Check-outs and returns made on a kiosk or the scanner app are saved on the device and sync when it reconnects.'],
    ['Can my whole team use it?', 'Yes. Create an organization with departments and teams, assign items to custodians, and give people roles. Team features start on the Pro plan.'],
    ['Does it work for my industry?', 'It is built around film, broadcast, AV and events, and it also suits rental houses, rigging, sports and field teams. Labels such as Gear and Items adapt to your industry.'],
    ['How much does it cost?', cost],
  ];
  return (
    <section id="faq" className="pl-section" aria-labelledby="faq-h">
      <div className="pl-wrap pl-faq">
        <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
          <h2 id="faq-h" className="pl-display pl-h2">Questions.</h2>
          <p className="pl-soft">Something else? Write to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
        </div>
        <div>{items.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ final */
export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="pl-section pl-dark" aria-labelledby="final-h">
      <div className="pl-wrap pl-final">
        <h2 id="final-h" className="pl-display pl-h1" style={{ maxWidth: '12ch' }}>Pack the next job with nothing left to chance.</h2>
        {signedIn
          ? <a className="pl-btn pl-btn--primary" href="#/dashboard">Open your workspace</a>
          : <button type="button" className="pl-btn pl-btn--primary" onClick={startWithGoogle}>Start free with Google</button>}
      </div>
    </section>
  );
}
