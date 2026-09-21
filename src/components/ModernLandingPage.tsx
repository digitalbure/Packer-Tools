import React from 'react';
import type { UserProfile, AdminSettings } from '../types';
import { useAuth } from '../providers/AuthProvider';
import CaseHero from './landing/CaseHero';
import Pricing from './landing/Pricing';
import { SiteHeader, SiteFooter, startWithGoogle, jumpToSection } from './landing/Chrome';
import { ClaudeSection, Faq, FinalCta, HowItRuns, Kiosk, Modules, Problems, Versus, Who } from './landing/sections';
import { activePlans, num, planBadge, trialLabel } from './landing/plans';
import { useLandingFonts } from './landing/useLandingFonts';
import './landing/landing.css';

interface ModernLandingPageProps {
  user: UserProfile | null;
  adminSettings: AdminSettings | null;
  onExploreMarketplace?: () => void;
}

/** The public home page. Design plan: docs/landing-design.md. Prices, limits and trials come from adminSettings.plans. */
export default function ModernLandingPage({ user, adminSettings, onExploreMarketplace }: ModernLandingPageProps) {
  useLandingFonts();
  const { selectedCommunity, setIsCommunitySelectorOpen } = useAuth();
  const plans = activePlans(adminSettings);
  const contactEmail = adminSettings?.contactEmail || 'support@packer.tools';
  const communities = adminSettings?.communities || [];
  const region = communities.find(c => c.id === selectedCommunity) || communities[0];
  const free = plans[0];
  const paid = plans.find(p => num(p.price) > 0);
  const signedIn = !!user;

  const facts: string[] = [];
  if (free) facts.push(`Free for up to ${num(free.maxGearItems).toLocaleString()} items. No card needed.`);
  if (paid) {
    const kiosk = planBadge('kioskMode', plans) || paid.name;
    facts.push(`Kiosk check-out comes with ${kiosk}${trialLabel(paid) ? `, with a ${trialLabel(paid)}` : ''}.`);
  }

  return (
    <div className="pt-lp">
      <SiteHeader signedIn={signedIn} onMarketplace={onExploreMarketplace} />
      <div>
        <section className="pl-hero" aria-labelledby="hero-h">
          <div className="pl-wrap pl-hero__grid">
            <div className="pl-hero__copy">
              <h1 id="hero-h" className="pl-display pl-h1">Know where every piece of kit is.</h1>
              <p className="pl-lede">
                Packer Tools is the inventory, packing and check-out system for crews with a lot of gear. Catalogue every item, pack cases from lists, sign kit out at a kiosk, and see who has what.
              </p>
              <div className="pl-hero__actions">
                {signedIn
                  ? <a className="pl-btn pl-btn--primary" href="#/dashboard">Open your workspace</a>
                  : <button type="button" className="pl-btn pl-btn--primary" onClick={startWithGoogle}>Start free with Google</button>}
                <a className="pl-btn pl-btn--ghost" href="#how" onClick={e => jumpToSection(e, 'how')}>See how a job runs</a>
              </div>
              {facts.length > 0 && (
                <div className="pl-hero__facts pl-fine pl-soft">{facts.map(f => <p key={f}>{f}</p>)}</div>
              )}
            </div>
            <CaseHero />
          </div>
        </section>
        <div className="pl-hazard" aria-hidden="true" />

        <Problems />
        <HowItRuns />
        <Kiosk kioskPlan={planBadge('kioskMode', plans)} />
        <Modules plans={plans} />
        <Who />
        <Versus />
        <ClaudeSection />
        <Pricing plans={plans} signedIn={signedIn} contactEmail={contactEmail} />
        <Faq plans={plans} contactEmail={contactEmail} />
        <FinalCta signedIn={signedIn} />
      </div>
      <SiteFooter contactEmail={contactEmail} regionName={region?.name} onRegion={communities.length > 1 ? () => setIsCommunitySelectorOpen(true) : undefined} />
    </div>
  );
}
