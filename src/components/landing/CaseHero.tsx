import React, { useState } from 'react';

type ItemId = 'cam' | 'lensA' | 'lensB' | 'lensC' | 'mon' | 'rx' | 'chg' | 'b1' | 'b2' | 'b3' | 'pouch';

interface ItemInfo { tag: string; name: string; note: string }

/** Sample data only. The page says so under the case. */
const INFO: Record<ItemId, ItemInfo> = {
  cam: { tag: 'CAM-014', name: 'Cinema camera body', note: 'In the case. Packed Tuesday 08:12 by Lee K.' },
  lensA: { tag: 'LNS-07', name: '24-70mm zoom', note: 'In the case. Last serviced 6 weeks ago.' },
  lensB: { tag: 'LNS-11', name: '50mm prime', note: 'In the case. Condition: good.' },
  lensC: { tag: 'LNS-03', name: '85mm prime', note: 'In the case. Condition: good.' },
  mon: { tag: 'MON-02', name: 'Field monitor', note: 'In the case. Packed Tuesday 08:14 by Lee K.' },
  chg: { tag: 'CHG-05', name: 'Battery charger', note: 'In the case. Packed Tuesday 08:15 by Lee K.' },
  b1: { tag: 'BAT-21', name: 'Battery pack', note: 'In the case. 84 charge cycles logged.' },
  b2: { tag: 'BAT-22', name: 'Battery pack', note: 'In the case. 79 charge cycles logged.' },
  b3: { tag: 'BAT-23', name: 'Battery pack', note: 'In the case. 12 charge cycles logged.' },
  pouch: { tag: 'CBL-01', name: 'Cable pouch', note: 'In the case. 14 cables listed.' },
  rx: { tag: 'WRX-03', name: 'Wireless receiver', note: '' },
};
const TOTAL = Object.keys(INFO).length;

function Tag({ x, y, text, r = -3 }: { x: number; y: number; text: string; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} pointerEvents="none">
      <rect width={text.length * 8.6 + 12} height={20} fill="#f2f0e6" />
      <text x={6} y={15} fontFamily="'Permanent Marker', cursive" fontSize={13} fill="#1a1d20">{text}</text>
    </g>
  );
}

function Cutout(props: React.SVGProps<SVGRectElement>) {
  return <rect fill="url(#pl-cut)" stroke="#000" strokeOpacity={0.55} strokeWidth={2} {...props} />;
}

export default function CaseHero() {
  const [active, setActive] = useState<ItemId>('rx');
  const [rxIn, setRxIn] = useState(false);
  const packed = TOTAL - (rxIn ? 0 : 1);

  const bind = (id: ItemId, label: string, order: number) => ({
    className: 'pl-item',
    style: { ['--i' as string]: order } as React.CSSProperties,
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    'data-active': active === id,
    onMouseEnter: () => setActive(id),
    onFocus: () => setActive(id),
    onClick: () => setActive(id),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(id); } },
  });

  const info = INFO[active];
  const isRx = active === 'rx';

  return (
    <figure className="pl-case" aria-label="An open equipment case with every item tagged, one item signed out">
      <div className="pl-case__stage">
        <div className="pl-case__count">
          <span className="pl-tape-wrap" style={{ ['--r' as string]: '-2.5deg' } as React.CSSProperties}>
            <span className="pl-tape" aria-live="polite">{packed} of {TOTAL} packed</span>
          </span>
        </div>

        <svg viewBox="0 0 640 520" role="group" aria-label="Case contents">
          <defs>
            <linearGradient id="pl-cut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#090b0c" />
              <stop offset="1" stopColor="#171b1e" />
            </linearGradient>
            <filter id="pl-noise" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>

          {/* shell, hardware, foam */}
          <rect x="6" y="6" width="628" height="508" rx="28" fill="#0b0d0f" stroke="#2c3338" strokeWidth="2" />
          {[['M6 46 V34 a28 28 0 0 1 28 -28 H46'], ['M594 6 H606 a28 28 0 0 1 28 28 V46'], ['M634 474 V486 a28 28 0 0 1 -28 28 H594'], ['M46 514 H34 a28 28 0 0 1 -28 -28 V474']].map(([d], i) => (
            <path key={i} d={d} fill="none" stroke="#59626a" strokeWidth="7" strokeLinecap="round" />
          ))}
          <rect x="26" y="26" width="588" height="468" rx="14" fill="#202427" />
          <rect x="26" y="26" width="588" height="468" rx="14" filter="url(#pl-noise)" opacity="0.09" style={{ mixBlendMode: 'overlay' }} />

          {/* camera body */}
          <g {...bind('cam', 'CAM-014 Cinema camera body', 0)}>
            <Cutout x="46" y="46" width="250" height="140" rx="16" />
            <rect x="64" y="74" width="170" height="92" rx="10" fill="#3a4147" />
            <rect x="112" y="60" width="62" height="20" rx="4" fill="#2f353a" />
            <circle cx="150" cy="120" r="34" fill="#22272b" stroke="#141719" strokeWidth="3" />
            <circle cx="150" cy="120" r="23" fill="none" stroke="#4b535a" strokeWidth="3" />
            <rect x="216" y="66" width="64" height="112" rx="12" fill="#33393e" />
            <circle cx="228" cy="82" r="4" fill="#ff5500" />
            <rect x="42" y="42" width="258" height="148" rx="18" className="pl-item__ring" />
          </g>
          <Tag x={58} y={172} text="CAM-014" />

          {/* lenses */}
          {([['lensA', 356, 116, 56, 46, 34, 18, 1], ['lensB', 470, 116, 50, 41, 30, 15, 2], ['lensC', 566, 116, 40, 32, 23, 11, 3]] as const).map(([id, cx, cy, rc, r1, r2, r3, n]) => (
            <g key={id} {...bind(id, `${INFO[id].tag} ${INFO[id].name}`, n)}>
              <circle cx={cx} cy={cy} r={rc} fill="url(#pl-cut)" stroke="#000" strokeOpacity={0.55} strokeWidth={2} />
              <circle cx={cx} cy={cy} r={r1} fill="#2b3136" />
              <circle cx={cx} cy={cy} r={r2} fill="none" stroke="#4b535a" strokeWidth={3} />
              <circle cx={cx} cy={cy} r={r3} fill="#111417" />
              <path d={`M ${cx - r1 + 6} ${cy - 10} A ${r1} ${r1} 0 0 1 ${cx - 10} ${cy - r1 + 6}`} fill="none" stroke="#7b858c" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
              <circle cx={cx} cy={cy} r={rc + 4} className="pl-item__ring" />
            </g>
          ))}
          <Tag x={318} y={164} text="LNS-07" r={-4} />
          <Tag x={440} y={158} text="LNS-11" r={3} />
          <Tag x={540} y={148} text="LNS-03" r={-2} />

          {/* monitor */}
          <g {...bind('mon', 'MON-02 Field monitor', 4)}>
            <Cutout x="46" y="226" width="200" height="120" rx="14" />
            <rect x="58" y="240" width="176" height="92" rx="6" fill="#33393e" />
            <rect x="68" y="248" width="156" height="76" rx="3" fill="#0d0f11" />
            <polyline points="72,300 92,300 100,268 112,312 124,278 138,300 160,300 172,262 186,306 200,292 220,292" fill="none" stroke="#2f8f5b" strokeWidth="2.5" />
            <rect x="42" y="222" width="208" height="128" rx="16" className="pl-item__ring" />
          </g>
          <Tag x={60} y={330} text="MON-02" r={-2} />

          {/* wireless receiver: the slot that shows check-out and check-in */}
          <g {...bind('rx', 'WRX-03 Wireless receiver slot', 5)} className={`pl-item pl-slot ${rxIn ? 'pl-slot--in' : 'pl-slot--out'}`}>
            <Cutout x="266" y="246" width="150" height="84" rx="12" />
            <rect className="pl-slot__edge" x="266" y="246" width="150" height="84" rx="12" fill="none" />
            <g className="pl-slot__item">
              <rect x="280" y="262" width="122" height="52" rx="6" fill="#3a4147" />
              <circle cx="298" cy="288" r="6" fill="#2f8f5b" />
              <circle cx="318" cy="288" r="6" fill="#4b535a" />
              <line x1="372" y1="262" x2="386" y2="248" stroke="#59626a" strokeWidth="4" strokeLinecap="round" />
              <line x1="384" y1="262" x2="398" y2="248" stroke="#59626a" strokeWidth="4" strokeLinecap="round" />
            </g>
            <rect x="262" y="242" width="158" height="92" rx="14" className="pl-item__ring" />
          </g>
          <Tag x={278} y={318} text="WRX-03" r={2} />

          {/* charger */}
          <g {...bind('chg', 'CHG-05 Battery charger', 6)}>
            <Cutout x="436" y="236" width="178" height="104" rx="14" />
            <rect x="450" y="250" width="150" height="76" rx="8" fill="#33393e" />
            {[462, 498, 534].map(x => <rect key={x} x={x} y="262" width="28" height="42" rx="3" fill="#15181a" />)}
            <circle cx="586" cy="266" r="4" fill="#2f8f5b" />
            <rect x="432" y="232" width="186" height="112" rx="16" className="pl-item__ring" />
          </g>
          <Tag x={452} y={326} text="CHG-05" r={-2} />

          {/* batteries */}
          {([['b1', 46, 7], ['b2', 122, 8], ['b3', 198, 9]] as const).map(([id, x, n]) => (
            <g key={id} {...bind(id, `${INFO[id].tag} ${INFO[id].name}`, n)}>
              <Cutout x={x} y="376" width="64" height="108" rx="10" />
              <rect x={x + 8} y="388" width="48" height="84" rx="6" fill="#3d454b" />
              <rect x={x + 20} y="380" width="24" height="8" rx="2" fill="#59626a" />
              <circle cx={x + 32} cy="452" r="4" fill="#2f8f5b" />
              <rect x={x - 4} y="372" width="72" height="116" rx="12" className="pl-item__ring" />
            </g>
          ))}
          <Tag x={44} y={470} text="BAT-21" r={-3} />
          <Tag x={122} y={470} text="BAT-22" r={2} />
          <Tag x={198} y={470} text="BAT-23" r={-2} />

          {/* cable pouch */}
          <g {...bind('pouch', 'CBL-01 Cable pouch', 10)}>
            <Cutout x="282" y="386" width="332" height="98" rx="16" />
            <rect x="296" y="398" width="304" height="74" rx="12" fill="#2a3035" />
            <line x1="308" y1="418" x2="588" y2="418" stroke="#59626a" strokeWidth="3" strokeDasharray="5 4" />
            <rect x="330" y="436" width="90" height="22" rx="4" fill="#3a4147" />
            <rect x="430" y="436" width="60" height="22" rx="4" fill="#3a4147" />
            <rect x="278" y="382" width="340" height="106" rx="18" className="pl-item__ring" />
          </g>
          <Tag x={500} y={470} text="CBL-01" r={-2} />
        </svg>
      </div>

      <div className="pl-case__readout" data-state={isRx && rxIn ? 'in' : 'out'} aria-live="polite">
        <div className="pl-data">
          {info.tag} · {info.name}
        </div>
        {isRx ? (
          <>
            <p>
              {rxIn
                ? 'Back in the case. Scanned in by Maya R., just now. The case is complete.'
                : 'Not in the case. Signed out to Maya R., due back Thursday 17:00. Signature on file.'}
            </p>
            <div className="pl-case__actions">
              <button type="button" className="pl-btn pl-btn--primary pl-btn--small" onClick={() => setRxIn(v => !v)}>
                {rxIn ? 'Sign it out again' : 'Scan it back in'}
              </button>
            </div>
          </>
        ) : (
          <p>{info.note}</p>
        )}
      </div>
      <figcaption className="pl-fine pl-soft">Sample case: tags, names and times are made up. Tap any item, then the empty slot.</figcaption>
    </figure>
  );
}
