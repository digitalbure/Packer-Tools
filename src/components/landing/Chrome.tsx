import React from 'react';
import { signInWithGoogle } from '../../firebase';
import PackerLogo from '../PackerLogo';
import { APP_VERSION } from '../../version';

/**
 * The app uses hash routing (#/dashboard), so a plain #section link is read as a route and the jump is lost.
 * Scroll to the section ourselves; respect reduced-motion, and close the mobile menu if the link was inside it.
 */
export function jumpToSection(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
}

export function startWithGoogle() {
  signInWithGoogle().catch(() => undefined); // errors surface in the app's own auth handling
}

const NAV: [string, string][] = [
  ['#how', 'How it runs'],
  ['#kiosk', 'Kiosk'],
  ['#modules', 'Modules'],
  ['#who', 'Who it is for'],
  ['#pricing', 'Pricing'],
  ['#faq', 'FAQ'],
];

export function SiteHeader({ signedIn, onMarketplace }: { signedIn: boolean; onMarketplace?: () => void }) {
  return (
    <header className="pl-header">
      <div className="pl-wrap pl-header__bar">
        <a className="pl-brand" href="#/" aria-label="Packer Tools home">
          <PackerLogo variant="symbol-only" size={34} />
          <span>Packer Tools</span>
        </a>
        <nav className="pl-nav" aria-label="Sections">
          {NAV.map(([href, label]) => <a key={href} href={href} onClick={e => jumpToSection(e, href.slice(1))}>{label}</a>)}
          {onMarketplace && <a href="#/marketplace" onClick={(e) => { e.preventDefault(); onMarketplace(); }}>Marketplace</a>}
        </nav>
        <div className="pl-header__cta">
          {signedIn ? (
            <a className="pl-btn pl-btn--primary pl-btn--small" href="#/dashboard">Open your workspace</a>
          ) : (
            <button type="button" className="pl-btn pl-btn--primary pl-btn--small" onClick={startWithGoogle}>Start free</button>
          )}
          <details className="pl-menu">
            <summary aria-label="Open menu">Menu</summary>
            <div className="pl-menu__panel">
              {NAV.map(([href, label]) => <a key={href} href={href} onClick={e => jumpToSection(e, href.slice(1))}>{label}</a>)}
              {onMarketplace && <a href="#/marketplace" onClick={(e) => { e.preventDefault(); onMarketplace(); }}>Marketplace</a>}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ contactEmail, regionName, onRegion }: { contactEmail: string; regionName?: string; onRegion?: () => void }) {
  return (
    <footer className="pl-footer">
      <div className="pl-wrap pl-footer__grid">
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <a className="pl-brand" href="#/" aria-label="Packer Tools home">
            <PackerLogo variant="symbol-only" size={28} />
            <span>Packer Tools</span>
          </a>
          <p className="pl-fine pl-soft">
            Inventory, packing and check-out for crews with a lot of gear. Version {APP_VERSION}. Questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        </div>
        <nav aria-label="Footer">
          <a href="#/help">Help</a>
          <a href="#/contact">Contact</a>
          <a href="#/pricing">Plans</a>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
          {onRegion && <a href="#/" onClick={(e) => { e.preventDefault(); onRegion(); }}>Region: {regionName || 'Global'}</a>}
        </nav>
      </div>
    </footer>
  );
}
