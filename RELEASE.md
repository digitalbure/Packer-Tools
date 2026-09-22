# 🚀 Release Information & Production Build Guide

## Current Application Version: `v6.12.1`
**Status:** Stable Production Release  
**Environment:** GCP Cloud Run Container (Vite Node Proxy)  
**Database/Backend:** Google Firestore + Firebase Authentication

This document provides complete instructions on how to build, run, and tag this repository for production deployment or continuous integration. 

---

## 📦 Complete Stable Release & Version History

Below is the consolidated history of Packer Tools, tracing all production rollouts back to the original container deployment.

---

### 🏷️ Release: v6.11.0 (Marketplace: Booking Request Widget and Pickup Points)
*Released on: September 22, 2026*
- New booking request widget: pickup and return dates, day count, refundable deposit and estimated total. Dates are checked, and the wording says the owner confirms the request.
- Removed the invented $45 default daily rate. With no rate set, the widget tells the renter the owner will quote.
- Removed the sample depots (Suva Film Studio, Nadi Aviation, Pacific Harbour) that were shown to renters. Removed the simulated distance and dispatch cost estimate.
- Admin: new Pickup and return points setting under module widget rules. Choose platform points only, owners manage their own, or off. In owner mode, plan access is set per plan with the new feature Own Pickup Points, with a points-per-owner limit and an option to also offer platform points.
- Owners on a qualifying plan save their own points under Listings settings.
- Firestore rules: `users/{uid}/pickupPoints` accepts owner writes only while the admin mode is owner-managed. Deploy the updated rules.
- Tests: pricing (13), point resolution (10), rules (9, `npm run test:rules`).

### ✏️ Patch: v6.10.1 (Label Studio Sample Owner)
*Released on: September 22, 2026*
- The sample owner shown in the label preview (before an owner is entered) is now "Packer Tools Production". Tests use the same name.

---

### 🏷️ Release: v6.10.0 (Label Studio: Auto-filled Layouts, Owner Details and Old Studio Retired)
*Released on: September 22, 2026*
- **Every "print labels" button now opens the new studio with the items already filled in.** The Gear Library, packing lists, inventory sheets, item pages and Quick Actions all hand their selection to `/labels` (`LabelStudioLauncher`); the old pop-up studio (`QRPrintModal`, 5,400 lines), its suggester, its download helper and the mock `/api/labels` server route are deleted. The unused `html-to-image` dependency is removed.
- **Automatic label choice.** The studio picks the best layout for each item from its category and name (cable, case, battery and small items, flight case, or the general tag). A mixed selection is split into groups, one per label type. Choosing a template, stock or editing a box switches to manual; a checkbox turns automatic back on.
- **Owner details form** (name, phone, email, saved per user) fills `{{owner.*}}` on the label. Details saved on an item take priority for that item.
- **New global templates**, including the "Property of" layout from the owner's photographed asset tag (QR and large asset ID on the left, PROPERTY OF and the owner right-aligned): Property of at 50 x 20, 50 x 30 and 40 x 30; If found, return to; Case label 76 x 51; Flight case 100 x 150. Every starter is tested to render without errors at 300 dpi.
- **"by Packer.Tools" footer** on every starter label. It can be switched off on plans that include branding.
- **Value dropdown.** Text and code boxes now pick their content from a list (item fields, owner fields, fixed phrases such as PROPERTY OF or IF FOUND, RETURN TO) or "Customize…" for typed text. Typed text can be saved and then appears under "My saved entries" (`users/{uid}/labelEntries`, owner only).
- 90 label tests; `npm test` now runs 253 checks.
- Known gap: the old studio's NFC and RFID tabs are gone with it; they will return when they can write to real tags.

---

### 🏷️ Feature Release: v6.9.0 (New Label Studio)
*Released on: September 22, 2026*
The new Label Studio is at **Labels** in the sidebar (`/labels`). The old studio (in the gear library and other modules) keeps working until the entry points are moved over.
- **Three steps on one screen:** pick items, choose printer, label stock and template, then check the live preview and print. Warnings and errors show under the preview; printing is blocked while a code is too small to scan or the label is empty.
- **Any printer, or none.** Roll and handheld printers print at the exact label size through the printer driver (cable labels feed their full length, tail unprinted). "Any printer" prints A4 or Letter pages, either as label sheets or as a cut-and-tape layout with dashed cut lines for plain paper. "Save as images" exports black-and-white PNGs at the printer's resolution for the printer maker's own app.
- **Stock and printer profiles** from the engine: the DT60PLUS is listed as "In testing"; Zebra, Brother and DYMO are listed as planned.
- **Templates in two tiers.** Starter templates ship with the app. Company (global) templates are published by a Packer Tools admin (collection `labelTemplatesGlobal`, admin write, everyone read). Personal templates (`users/{uid}/labelTemplatesV2`) belong to their author only. Anyone can copy any template into their own set. Everything read back from storage is validated and clamped (`sanitizeSpec`).
- **Template editor** (numbers and lists, no dragging yet): add text, codes (QR, Code 128, Code 39, EAN-13, Data Matrix) and lines; set position, size and turn.
- **Firestore rules** added for the two template collections. The old shared `marketplaceTemplates` collection (any signed-in user could overwrite any template) is no longer used by the new studio.
- Development-only demo at `#/labels-demo` (not included in production builds).
- 68 label tests; `npm test` now runs 231 checks. Copy check covers the new screen.
- **Not yet done:** dragging elements on a canvas, direct printer commands (Bluetooth, ZPL), moving the old entry points to the new studio, and hands-on printer testing.

---

### 🏷️ Release: v6.8.0 (Label Stocks, Cable Labels and Rotation)
*Released on: September 22, 2026*
Label engine update. Still no change to app screens; the old studio runs until the new one replaces it.
- **Printer corrected:** the owner's test unit is the DETONGER **DT60PLUS** (2 inch, 300 dpi), not the DT60S researched earlier. The profile is now `detonger-dt60plus`, "In testing", with no assumed command set.
- **Cable wrap labels.** A label can have a blank tail (`tailMm`) after its printed area, as on 25 x 38 + 40 and 30 x 45 + 50 cable labels. The renderer reports the full feed length (78 mm and 95 mm) and shows the tail hatched in previews only.
- **Rotation.** Text and codes can be turned 90, 180 or 270 degrees, on the printer's dot grid. This is what lets a barcode run along the length of a narrow label.
- **Stock catalogue** (`src/labels/presets.ts`): every stock in the owner's DT60PLUS order (P-cable labels, silver PET, white PP), plus 50 x 25, 76 x 51, 100 x 150, a Brother 62 mm roll and two A4 sheets. Notes flag low-contrast stock (silver, red).
- **Starter templates** for the ordered stock (QR, barcode and cable layouts), the seed for global templates. Tests prove each renders without errors at 300 dpi with realistic data.
- Barcodes are confirmed in the engine: Code 128, Code 39 and EAN-13 are drawn, and refused with a clear size when too small to scan (a Code 128 across 25 mm at 300 dpi fails; turned along 38 mm it passes).
- 62 label tests; `npm test` now runs 225 checks.

---

### 🏷️ Foundation: v6.7.0 (Label Engine)
*Released on: September 22, 2026*
First step of the Label Studio rebuild (plan: `docs/label-studio-rebuild.md`). Nothing in the app screens changes yet; the old studio still runs until the new one replaces it.
- **New label engine** in `src/labels/`: one millimetre-based label model and one vector renderer that will drive the preview, browser print, sheets and image export. Real barcodes (Code 128, Code 39, EAN-13) and Data Matrix as well as QR, using `bwip-js`.
- **Labels that scan.** Every symbol is drawn on whole printer dots (crisp on thermal heads) and printing is refused when a code is too small to scan, with the size to aim for.
- **Sheets and tape-it-yourself pages** for people without a label printer: A4 / Letter grids, printer offsets, dashed cut lines and a wide gap for cutting and taping.
- **Printer profiles** with honest status. The DETONGER DT60S is "In testing" (54 mm, 203 or 300 dpi, ESC/POS and LPAPI per the vendor); nothing is marked recommended or verified until it passes hands-on testing. Bring-up plan in the docs.
- **Safety:** all item text is escaped before it reaches the SVG (tested against injected markup).
- **Copy standard** (`docs/copy-standard.md`) and `npm run check:copy`, which fails on hype wording in the modules that follow the standard. `node scripts/check-copy.mjs --all` shows the rest of the app still needs the cleanup (about 610 lines in 64 files).
- 39 new tests (`tests/labels-engine.mts`); `npm test` now runs 202 checks.

---

### ✏️ Patch: v6.6.1 (Home Page Copy Accuracy: Labels)
*Released on: September 22, 2026*
- The home page said labels could be printed as "QR and barcode". Label Studio can print **QR codes only** (the `barcode` element type exists in the code but is never created or rendered, and no barcode library is installed). Copy corrected. Scanning barcodes with the camera is unaffected and remains accurate.

---

### 🧹 Release: v6.6.0 (Paddle and Dodo Payments Removed; PayPal Only)
*Released on: September 22, 2026*
Paddle does not support marketplace platforms, so Paddle and Dodo Payments are removed. PayPal is the only payment gateway.
- **Server:** deleted the Paddle/Dodo webhook routes and signature helpers (`server/routes/webhooks.ts`, `server/utils/paddle.ts`) and their mount. The PayPal secret is now read **only** from the server environment (`PAYPAL_SECRET_KEY`), never from the publicly readable settings document. Removed the `PADDLE_*` / `DODO_*` variables from `.env.example`.
- **Client:** deleted the client-side webhook handlers, the "Billing Dashboard" (it was built on seeded mock Paddle data) and the Paddle billing screen. The payment screen is now a small PayPal-only page (on/off, sandbox, client ID). The checkout modal no longer offers Paddle or Dodo, including the fake "Simulate Instant Dodo Activation" flow. The app no longer seeds placeholder gateway keys into settings.
- **Copy:** pricing page and the Terms / Privacy / Refund seed texts now name PayPal instead of Paddle, and no longer describe a Merchant of Record.
- **Data:** the `paddle*` / `dodo*` fields are gone from the types. Old values in Firestore are untouched and unused.
- **Action for the site owner:** the live Terms and Privacy pages are stored in Firestore (`adminSettings/global.privacyContent` and `termsContent`) and still mention Paddle. Edit them in the admin console. Have the payment and tax wording reviewed, because with PayPal you are the merchant of record, not Paddle.
- Correction to an earlier note: the `paddleApiKey` seen in the settings document was the app's own placeholder text, not a real key.

---

### 🚑 Hotfix: v6.5.1 (Email Never Silently Simulates)
*Released on: September 22, 2026*
- **Bug:** email only failed loudly when `NODE_ENV=production`. The hosting runtime does not reliably set it, so with a missing or placeholder `RESEND_API_KEY` the admin test reported "sent successfully" while nothing was sent (and nothing appeared in Resend).
- **Fix:** simulation is now opt-in (`EMAIL_SIMULATE=true`, development only). Without a valid key the server returns a clear error: set a valid `RESEND_API_KEY` (starts with `re_`) and republish.
- Tests updated (`tests/email-e2e.mts`, `tests/kiosk-api-e2e.mts`).

---

### 🔌 Feature Release: v6.5.0 (Kiosk Phase 2a: Kiosk UI on the Server API, Server-verified Pairing)
*Released on: September 22, 2026*

The kiosk screens now use the Phase 1 API when a device holds a terminal token, and fall back to the existing client-side path otherwise, so kiosks already deployed keep working until they are re-paired.

- **Pairing goes through the server.** The dashboard's "Authorize Device" now calls `POST /api/kiosk/terminals/activate` (records the server-only grant), and "Deauthorize" / delete call `revoke` (grant and every token removed at once). Newly paired kiosks obtain a scoped token automatically; the 5-tap escape clears it.
- **Atomic, server-enforced actions.** With a token, scan lookup, bulk check-out, bulk check-in, self-service orders, order fulfilment and receipt emails run on the server: one transaction per request (all items released or none), restricted statuses and plan entitlement enforced, every record stamped with owner and terminal. Conflicts read plainly, for example "Camera is already checked out to Ola".
- **Receipts** from a paired kiosk no longer depend on a signed-in user.
- New client module `src/lib/kioskApi.ts`; `tests/kiosk-client-e2e.mts` (17 checks) runs it against the real server. `npm test` now runs 146 checks plus the 17 client checks.

**Not in this release (Phase 2b, needs a test kiosk device)**
- Tablets still sign in with an account to browse and to load the catalogue; running with no login at all requires migrating the remaining screens (browse/search results, travel-case / pack screens, live order list) onto the API.
- Firestore rules for `terminals`, `checkouts` and `inventories` are unchanged; they can only be tightened once no kiosk depends on direct client access. The inventory read leak therefore remains until then.
- Devices paired before this release run in legacy mode until re-paired (Deauthorize, then pair again).
### 🏠 Feature Release: v6.4.0 (New Public Home Page)
*Released on: September 22, 2026*

The public home page is rebuilt from scratch. Design rationale and tokens: `docs/landing-design.md`.

- **Message.** "Know where every piece of kit is." Written for crews with a lot of gear (film, broadcast, AV, events, then rental houses, rigging, sports, field teams). Sections: the problem, how a job runs, the kiosk, every module, who uses it, spreadsheet vs Packer Tools, the Claude connector, pricing, FAQ.
- **Design.** Built from the world of road cases, cut foam, gaffer-tape labels and manifests, not from a SaaS template. The centrepiece is an interactive open case with a tagged item in every foam cutout and one empty slot: tap it to see who has the item, tap "Scan it back in" and the case completes. Fonts: Big Shoulders Display, Barlow, Barlow Semi Condensed, Permanent Marker (loaded on this page only).
- **Honest by construction.** No invented customer counts, logos or quotes; sample data is labelled as sample. Every capability named exists in the app. **Pricing, limits, trial length and plan badges are read live from `adminSettings.plans`** (the old page hard-coded $49 / $199 and "unlimited", which matched no real plan). The page states that kiosk, signatures, projects and team features start on Pro, and that checkout is billed in USD.
- **Routing.** `landingView` defaults to `'saas'`, which the old code treated as the classic page, so the "modern" landing component had never actually been shown. The redesigned page is now the default; the classic admin-editable page still appears if an admin selects landing type `main` or `saas`.
- **Fixes found while building it:**
  - The install-app popup (`GetAppOverlay`) opened 1.5 seconds after load on every phone, covering the hero for first-time visitors. It no longer auto-opens on the public landing page (still shown inside the app, still openable manually). Its event listener is now also cleaned up correctly.
  - The app shell wrapped every page in `overflow` containers, which broke `position: sticky`; the landing route now opts out so the header stays put.
  - In-page anchors (`#how`, `#pricing`) were being read as routes by the hash router and the jump was lost; they now scroll smoothly (instantly with reduced-motion) and close the mobile menu.
- **Accessibility.** Zero axe-core violations (WCAG 2.1 AA + best-practice) at phone width; visible keyboard focus; reduced-motion respected; contrast fixed (dark text on the orange button, since white on `#FF5500` fails AA); one `<main>` landmark.
- **Page metadata** in `index.html`: real title, description and social tags.
- **Legacy landing code removed** (about 3,000 lines deleted). The classic landing page (`src/pages/LandingPage.tsx`, with its ticker, AI-recognition demo and default testimonials/FAQ) and the earlier "modern" component are gone; there is now a single `src/pages/HomePage.tsx` (route `/`) plus `src/components/landing/`. Also removed: the admin "Landing Page Manager" tab and its `LanderEditor`, the lander migration/self-heal code, the "Set as System Landing Page" action and made-up landing template (with invented $29 / $99 pricing) in Pages Manager, the `aiRecognitionConfig` seed, and the matching types and defaults (`landers`, `landingPage`, `activeLanderId`, `activeLandingPageType`, `frontPageCopy`, `aiRecognitionConfig`, the `landing` page category). Two dead sidebar links to the removed tab are gone. Existing Firestore documents keep their old fields untouched; nothing reads them any more.
- **Marketplace button fixed.** The old landing header's Marketplace button never worked (the route passed the view but not the setter). It now switches to the Marketplace view, with a "Back to Packer Tools" link. `landingView` values are now `'home'` and `'marketplace'`.
- **Invented marketplace content removed.** With no admin overrides the public Marketplace page showed a "largest, most trusted" claim, a made-up "up to 20% student discount" banner and "Packer Insights" data banner (buttons only showed "simulated inside this sandbox"). Hero copy is now neutral, and promotion banners appear only when an admin has configured a title. Unused default "partner logos" (facebook, amazon studios, HBO, Disney) deleted. Still to review by you: the Marketplace "guarantees" and fee wording.
- Known follow-ups: real product screenshots and genuine customer proof (logos, quotes) once you have them; the app's viewport meta blocks pinch-zoom (`user-scalable=no`), which is an accessibility problem app-wide.

---

### 🚑 Hotfix: v6.3.1 (Server Prices Now Read From the Admin Console Plans)
*Released on: September 22, 2026*
- **Bug (introduced in v6.0.2, the server-side billing rewrite):** the server computed PayPal prices from a `plans` collection that is empty and otherwise fell back to hard-coded defaults. Your real prices live in `adminSettings/global.plans` (Pro $19 / $180 per year / $12 per seat; Enterprise $49 / $490 / $9 per seat), which is what the pricing page and admin console use. As a result Enterprise would have been charged **$99 instead of $49**, and seats $10 instead of $12 / $9.
- **Fix:** `getServerPlan` now reads `adminSettings/global.plans` first (cached 60s; numeric strings tolerated), then the legacy `plans` collection, then built-in defaults. The Claude connector's gear-limit check reads the same source. Price edits in the admin console take effect within a minute.
- **Tests:** new `tests/billing-e2e.mts` (12 checks) pins the production prices (monthly, annual, seats, seat cap), proves client-supplied amounts are ignored, wrong-amount captures grant nothing, orders capture once, and trial length comes from the plan.
- **If any customer paid during the affected window** (any PayPal checkout since v6.0.2 went live on September 21, 2026) check the amount charged against their plan and refund or credit any overcharge.

---

### 🖥️ Feature Release: v6.3.0 (Kiosk Phase 1: Scoped Terminal Tokens & Kiosk API)
*Released on: September 22, 2026*

Additive server foundation for kiosks that never hold the owner's account. **No existing screen changes in this release**; the kiosk UI still uses its current client-side path until Phase 2 migrates it. Full reference: `docs/kiosk-api.md`.

- **Server-verified pairing.** The owner activates a kiosk through `POST /api/kiosk/terminals/activate`, which writes a server-only grant (`kioskGrants`). The client-writable `terminals` document is no longer trusted: any signed-in user could previously rewrite a *pending* terminal to point at another owner. A forged terminal now gets no token (tested). Ambiguous pairing codes are refused instead of guessed.
- **Scoped, revocable device tokens** (`kioskTokens`, hashed, 30 days, rotating refresh). Every request re-checks the grant, the terminal and the owner's `kioskMode` plan entitlement (server port of `isFeatureEnabled`), so revoking a terminal or downgrading a plan disables the kiosk within about a minute.
- **Kiosk API** (`/api/kiosk/*`): context, paged catalogue search (no composite indexes needed), scan lookup, check-out, check-in, self-service orders, order fulfilment and hand-over receipts. Every operation is scoped to the token's single owner (no endpoint accepts an owner id) and multi-item operations are all-or-nothing transactions with per-item conflict reports.
- **Tests**: `tests/kiosk-api-e2e.mts` (60 checks) covers two-tenant isolation (lookup, search, inventory, check-out, check-in, orders, fulfilment, revoke), forged terminals, atomic races, restricted statuses, kits, validation, receipts, refresh, revocation and plan downgrade. `npm test` now runs 134 checks in total.
- `renderKioskReceipt` extracted from the email route for reuse; `kioskGrants` / `kioskTokens` explicitly denied to clients in `firestore.rules`.

**Phase 2 (next)**: move the kiosk UI and the owner's pairing screen onto these endpoints, split `KioskMode.tsx`, then tighten the `terminals`, `checkouts` and `inventories` rules (the leak that lets any signed-in user read every inventory sheet).

---

### 📦 Feature Release: v6.2.0 (Kiosk Phase 0: Atomic Check-out/in, Shared Scan Lookup & Reliable Email)
*Released on: September 22, 2026*

**Kiosk (`src/pages/KioskMode.tsx`, new `src/lib/kioskOps.ts`)**
- **Atomic check-out and check-in.** Item status, kit children and the checkout record now change together in one Firestore transaction. An item that is already out can no longer be checked out a second time (two tablets scanning the same item: exactly one wins, verified with 6 simultaneous attempts). Previously these were separate writes that could leave gear stuck "in use" or double-issued.
- **One scan lookup** replaces three hand-copied versions (each up to 4 sequential queries): a direct id read plus a single `assetTag in [...]` query, run in parallel. Works for the gear library and custom inventories, and never crosses owners.
- **Consistent checkout records.** All kiosk paths now write `status: 'active'` and close it to `returned` on check-in, and add `ownerId` / `terminalId`. The handheld (PWA) scanner previously wrote `checked_out` records that check-in never closed, and check-in created duplicate `returned` rows; both are fixed (legacy `checked_out` records are closed too).
- **Order fulfilment** releases items first and marks the order fulfilled only afterwards, rolling back released items on failure (previously the order was marked fulfilled first).
- Clear messages when an item is already out ("Already checked out to X") instead of a generic failure.

**Email (`server/routes/email.ts`)**
- **The kiosk receipt email now works**: the call was missing its auth header (always 401).
- **Failures are no longer reported as successes.** The Resend SDK returns `{data, error}` instead of throwing, and the old code read only `data`; a rejected send (e.g. unverified domain) was reported as sent. Errors now surface with a hint, the fake `onboarding@resend.dev` fallback and the catch-all "simulated success" were removed, and in production a missing `RESEND_API_KEY` reports failure instead of pretending. Development still simulates.
- **Reply-To** on kiosk receipts is the operator's address, so borrower replies reach the customer, not Packer Tools.
- From-header display names are sanitized (customer-controlled company names could inject into the header). SMTP now verifies TLS certificates (was `rejectUnauthorized: false`).
- Rate limits reshaped for real use: receipts 600/hour per user, other email routes 60/hour, welcome/contact 10/hour.
- **Setup required**: verify the `packer.tools` domain in Resend (Domains, add the SPF/DKIM DNS records). Emails are sent from `@packer.tools` addresses and Resend rejects unverified domains.

**Tests**: `npm test` now runs three suites in the emulators (MCP connector 42 checks, kiosk operations 23, email 9) and CI runs them on every push.

**Findings for later phases (not changed here)**
- `src/firebase.ts` sets `experimentalForceLongPolling` and `experimentalAutoDetectLongPolling` together, which Firestore rejects, so both initialisation attempts throw and the app silently falls back to a plain `getFirestore()`: the intended persistent cache and forced long-polling never take effect.
- Kiosk Phase 1/2 (terminal tokens, server endpoints, scoped queries, tightening `inventories` / `checkouts` / `terminals` rules) is still to do; see the audit.

---

### 🏷️ Patch Release: v6.1.3 (Live Version Display)
*Released on: September 21, 2026*
- The in-app version (sidebar, footer, What's New, profile, admin, landing and onboarding screens) was hardcoded to `v5.21.0`. It is now injected at build time from `package.json` (`__APP_VERSION__` in `vite.config.ts`, exported as `APP_VERSION` from `src/version.ts`), so it always matches the release. Do not hardcode versions in UI code.
- What's New now lists the v6.1 Claude connector, security and reliability work.

---

### 🐞 Patch Release: v6.1.2 (Connector Sign-in Page Hijacked by Service Worker)
*Released on: September 21, 2026*
- **Fix**: the PWA service worker (`src/sw.ts`) answered every page navigation with the app shell (`index.html`), so in any browser that had used Packer Tools before, `/oauth/authorize` showed the Packer Tools app instead of the connector's consent page and the Claude connection never completed. The navigation fallback now excludes `/oauth/*`, `/api/*` and `/.well-known/*`.
- If a browser still shows the app at `/oauth/authorize` after publishing, open packer.tools once (the new worker activates immediately), or unregister the service worker in DevTools → Application.

---

### 🛠️ Patch Release: v6.1.1 (CI & Health Version)
*Released on: September 21, 2026*
- **CI** (`.github/workflows/ci.yml`): every push/PR now runs install, typecheck, production build and the 42-check MCP end-to-end suite (Firebase emulators). It uses `npm install` and only *warns* on lockfile drift, because AI Studio periodically rewrites `package-lock.json` on its own (it has twice dropped `jspdf` / `html-to-image` and reset the version) which breaks strict `npm ci`. Its own deploys are unaffected.
- **`/api/health`** now reports the real app version from `package.json` (was hardcoded `1.0.0-beta.1`).
- If a sync leaves `package-lock.json` out of step: run `npm install` and commit the lockfile.

---

### 🤖 Feature Release: v6.1.0 (Per-User Claude Connector: OAuth Sign-in, Scoped Tools & Admin Tiers)
*Released on: September 21, 2026*

**Connector redesign.** The MCP server is no longer a shared-secret operator connector. Every connection is now bound to one Packer Tools user.
- **OAuth 2.1 sign-in**: authorization code + PKCE (S256), dynamic client registration (`/oauth/register`), and a consent page at `/oauth/authorize` where the user signs in (Google or email) and explicitly approves. Access tokens last 1 hour; refresh tokens rotate (30 days) and cannot be replayed. Tokens, codes and clients live in Firestore (hashed, server-only), so they survive restarts and work across instances. Redirects are allow-listed (claude.ai / claude.com and loopback for CLI clients).
- **Tools run as the signed-in user** (no `uid` argument anywhere): `get_account_summary`, `list_gear`, `add_gear_item` (respects plan gear limit, stamps `ownerId`/`assetTag`), `update_gear_item`, `list_packing_lists`, `get_packing_list` (owned or shared, read-only), `list_inventory_sheets`, `get_inventory_sheet_items` (owned or same-organization). Other users' data returns "not found".
- **Admin tiers, checked live on every call** (never cached in the token): admins see `lookup_user` (sensitive fields stripped), `list_organizations`, `get_system_telemetry`, and the marketing kit/resources; only **super-admins** see `update_user_plan`, which now writes the real `plan` field (previously `planTier`, which the app ignored), validates the plan, and records every change in `adminAuditLogs`. Demoting an admin removes access immediately.
- Users can no longer read internal resources (`packer://agent-rules`, marketing playbook); `packer://gear-summary` now summarizes the caller's own library (it previously read a hardcoded `demo-super-admin` account).
- `ADMIN_API_KEY` and `MCP_CLIENT_SECRET` are **no longer used** by the MCP server and can be deleted.

**Critical fix: server database target.** `server/firebaseAdmin.ts` opened the *default* Firestore database, but project `packer-tools` only has named databases (the app uses `ai-studio-8af96458-…`). Every server-side Firestore call (billing, webhooks, PayPal config, share pages) targeted a database that does not exist. The server now uses `firestoreDatabaseId` from `firebase-applet-config.json` (override with `FIRESTORE_DATABASE_ID`).

**Testing.** New end-to-end suite `tests/mcp-e2e.mts` (`npm run test:mcp`, needs Java) runs against the Firestore + Auth emulators: 42 checks covering the OAuth flow, PKCE, single-use codes, refresh rotation, tenant isolation, plan limits, admin tiers, audit logging and live role revocation.

**Deployment notes**
- After publishing, the Cloud Run service account must have access to project `packer-tools` (Cloud Datastore User + Firebase Authentication Admin). If MCP sign-in or billing returns permission errors, grant those roles.
- Add `packer.tools` to Firebase Authentication → Authorized domains (needed for the Google sign-in popup on the consent page).
- Recommended: enable Firestore TTL policies on `expiresAt` for `mcpAuthCodes`, `mcpTokens` and `mcpRefresh`.
- Reconnect in Claude: URL `https://packer.tools/api/mcp`, transport Streamable HTTP. No client ID/secret is needed any more.

**Known issues / follow-ups**
- `inventories` is readable by any signed-in user under the Firestore rules, because the app lists the whole collection in several places (Kiosk, Organization module, assistant). Tightening the rule requires changing those client queries first. The MCP tools are scoped correctly regardless.
- The consent page's Google/email sign-in was verified for rendering only; the live sign-in was not exercised against production Firebase.
- `list_gear` with a text search scans up to 1,000 items per call.
- Legacy SSE remains at `/api/mcp/sse` and is bound to the token's user.

---

### 🔌 Patch Release: v6.0.3 (MCP Streamable HTTP & Connector Sign-in Fix)
*Released on: September 21, 2026*
- **Streamable HTTP transport**: `POST /api/mcp` now serves the current MCP Streamable HTTP transport (stateless, via the official SDK). Use `https://packer.tools/api/mcp` and select "Streamable HTTP" under Advanced in the Claude connector form. Legacy SSE remains at `/api/mcp/sse` for existing clients; `GET /api/mcp` now returns 405.
- **OAuth metadata fix**: removed the advertised `registration_endpoint` (`/oauth/register` was never implemented and returned 404, causing "Couldn't register with Packer Tools's sign-in service"). Enter the OAuth client ID `packer-tools-claude-connector` and the `MCP_CLIENT_SECRET` value manually under Advanced.
- **Lockfile**: `package-lock.json` resynced with `package.json` (`npm ci` was failing).
- MCP `serverInfo`, Developer API and Knowledge Base synced to `v6.0.3`.

---

### 🔒 Security Release: v6.0.2 (Security Audit Remediation)
*Released on: September 21, 2026*

**⚠️ Deployment action required before/at rollout** (see "Required configuration" below).

**Critical fixes**
- **Billing / entitlement bypass closed** (`server/routes/billing.ts`): plan, seat count, price and trial length are now computed server-side (`server/utils/plans.ts`). Client-supplied `amount`, `currency`, `planId` at capture and `trialDays` are ignored. PayPal orders are recorded in `paypalOrders/{orderId}`, bound to the creating user, single-use, and capture verifies the paid amount/currency before upgrading. Orders are charged in USD.
- **Manual payments no longer grant a plan**: `activate-manual` records `manualPaymentRequestedPlan` + `manualPaymentPending`; an admin must approve. Trials are claimed atomically (transaction) and only for trial-enabled paid plans.
- **MCP server authenticated** (`server/routes/mcp.ts`): all `/api/mcp*` transports now require a Bearer token. `/oauth/token` requires the client secret, authorization codes are single-use, 5-minute, and bound to an allow-listed `https` redirect URI (claude.ai / claude.com by default). Tokens are cryptographically random and expire after 24h. The hardcoded default admin key was removed; admin tools fail closed when `ADMIN_API_KEY` is unset.
- **Developer API keys** (`server/routes/developer.ts`): removed the "any key ≥ 8 chars / `pk_`/`pt_`/`sk_` prefix" acceptance and the hardcoded default key. Keys must equal `DEVELOPER_API_KEY` or match a key issued to a user. Query-string keys are no longer accepted.

**High**
- **Email abuse controls** (`server/routes/email.ts`, `server/middleware/security.ts`): per-user rate limit (30/hour), single validated recipient, HTML-escaping of all templated fields, `http(s)/mailto` only links, admin-only newsletter broadcast (max 500 recipients, sanitized rich HTML) and SMTP test. Contact-form messages are now delivered to `CONTACT_INBOX` (default `hi@packer.tools`) instead of the submitter-supplied address.
- **Firestore rules** (`firestore.rules`): `users/{uid}` is no longer world-readable (owner/admin only). Collaborators can no longer take ownership of a packing list or alter collaborator/sharing fields (previously a collaborator could set `ownerId` to themselves). Email-based collaborator access requires a verified email. `hasHadTrial` and `manualPaymentRequestedPlan` are server-only.
- **Unauthenticated endpoints**: `/api/gemini/organizer-layout` now requires auth. Label templates/print history/preview are authenticated and scoped per user (templates previously deletable by anyone; history leaked across users).
- **Webhooks**: plan mapping uses exact IDs from env (`PADDLE_PRO_IDS`, `PADDLE_ENTERPRISE_IDS`, `DODO_PRO_IDS`, `DODO_ENTERPRISE_IDS`) instead of substring matching (`"ent"`/`"pro"`); unmapped products are rejected. Paddle signatures reject timestamps older than 5 minutes.

**Medium**
- **SSRF hardening** (`server/utils/ssrf.ts`): DNS-resolution guard applied at connect time (blocks DNS rebinding), redirect hops re-validated, IPv4-mapped/NAT64/6to4/link-local IPv6 handled, response size capped.
- **Server hardening** (`server/index.ts`): security headers, `trust proxy`, global per-IP API rate limit, JSON body limit reduced 50 MB → 15 MB, `PORT` env respected.
- MCP `serverInfo`, Developer API and resources synced to `v6.0.2`.

**Required configuration (new/changed environment variables)**
| Variable | Purpose |
|---|---|
| `ADMIN_API_KEY` | **Required.** MCP admin tools. No default any more — rotate the old default key, it was public. |
| `MCP_CLIENT_SECRET` | Secret for the Claude connector OAuth client (falls back to `ADMIN_API_KEY`). |
| `DEVELOPER_API_KEY` | Optional shared developer key. |
| `MCP_ALLOWED_REDIRECT_HOSTS` | Optional extra OAuth redirect hosts (comma separated). |
| `CONTACT_INBOX` | Contact-form destination. |
| `PADDLE_PRO_IDS`, `PADDLE_ENTERPRISE_IDS`, `DODO_PRO_IDS`, `DODO_ENTERPRISE_IDS` | Comma-separated product/price IDs for webhook plan mapping. |
| `NODE_ENV=production` | Must be set in deployed environments. |

Deploy `firestore.rules` (`firebase deploy --only firestore:rules`) together with the server.

**Behaviour changes / known follow-ups**
- Existing Claude MCP connector must be re-authorized with the client secret.
- Public gear-bio pages read the owner profile; with the new `users` rule this read is denied for non-owners and the page degrades gracefully (owner branding/profile fields hidden). Follow-up: publish a `publicProfiles/{uid}` projection.
- Still open: `subscriptionStatus`/trial fields remain client-writable (`UpgradeNowModal`, `AuthProvider` write them); `gearLibrary` (+versions/incidents) is intentionally public-read for QR bio pages; Dodo signature verifier accepts a timestamp-less scheme; MCP tokens/sessions are in-memory (single instance); developer API keys are generated client-side with `Math.random`; JWT/Google tokens are stored in `localStorage`; no automated tests/CI.

---

### 🚀 Feature Release: v6.0.1 (Multi-Library Switcher, Dedicated Equipment Depots & Fluid Asset Flow)
*Released on: August 19, 2026*
- **Multi-Library Switcher & Depot Hub**: Introduced native multi-library management directly inside the Gear Library. Users can create, edit, delete, and switch between named equipment depots (e.g. Cinema Depot, Stage B Vault, Mobile Audio Unit, Staging Warehouse) with custom color badges, locations, and live asset count & valuation telemetry.
- **Batch Depot Reassignment**: Added one-click batch assignment in Select Mode, allowing multi-selected items to be moved/assigned into any library depot via chunked Firestore WriteBatch operations.
- **Depot Manifest Push**: Enabled 1-click "Push to List" from any depot card to pre-select and add all contained items into an active packing list or inventory sheet.
- **Cross-Module Terminology Standard**: Standardized unified "Add to List" and "Add to Group" terminology and non-destructive item copying flows across Gear Libraries, Inventories, and Manifests.
- **Knowledge Base Expansion**: Added dedicated documentation and step-by-step guides in the Help Center covering multi-library fleet partitioning, depot switching, and cross-module asset routing.

---

### 🚀 Major Architecture Release: v6.0.0 (Core Architecture Upgrade & Extended Fleet Logistics Engine)
*Released on: August 19, 2026*
- **Core Architecture & Fleet Scalability**: Upgraded platform data models to support expansive enterprise equipment inventories, multi-tier organizational hierarchies, and high-velocity fleet logistics.
- **Intelligent Battery & Power Asset Management**: Comprehensive battery health tracking, cycle telemetry, and maintenance forecasting for high-draw production power systems.

---

### 🚀 Feature Release: v5.21.0 (Smart Intent Onboarder & Dynamic Use-Case Auto-Configuration)
*Released on: August 15, 2026*
- **Interactive Multi-Step Intent Onboarder**: Added a 5-step smart onboarding wizard on initial sign-in and on-demand recalibration.
- **Dynamic AI Module Layout Auto-Configuration**: Auto-configures workspace navigation based on user role and industry workflow.

---

### 🚀 Feature Release: v5.20.0 (Packing List Control Center & Multi-List Management Suite)
*Released on: August 7, 2026*
- **List Settings & Configuration Suite**: Fully built out the List Settings & Actions control panel in `PackingListDetail.tsx` providing list visibility toggles (Public vs Private with shareable links & copy triggers), custom list labels/tags with hashtag rendering, list archive/unarchive controls, and list deletion.
- **Kit Conversion & Container Linking**: Enabled converting any packing list into a reusable Master Kit container with nested add-on equipment, or linking/unlinking existing flight cases and pelican organizers.
- **Cross-List Merge & Item Import/Export**: Added two-way list operations allowing users to import items from any existing list directly into the current list, or export/append current items into a target list with sequence order preservation.
- **Marketplace Publishing**: Added marketplace listing settings allowing users to set listing pricing, currency selection (USD, FJD, AUD, EUR, GBP, NZD), and marketplace pitches.
- **Print & Customs Manifest Exports**: Integrated quick print triggers for paper packing list sheets, CSV exports, and ATA Carnet customs manifest generation.

---

### 🚀 Feature Release: v5.19.4 (Universal Deletion Confirmation Modal & Safeguards)
*Released on: August 7, 2026*
- **Universal Deletion Confirmation Dialog (`ConfirmDeleteModal`)**: Introduced a reusable, motion-animated deletion confirmation modal featuring target asset highlights, batch count badges, loading states, and keyboard shortcuts (Escape key).
- **Packing List Deletion Protection (`PackingListDetail.tsx`)**: Replaced native `window.confirm` browser prompts with the confirmation modal across single item deletions, bulk selection deletions, container removals, and full packing list purge actions.
- **Inventory Sheet Safeguards (`InventoryModule.tsx`)**: Integrated deletion confirmation modal for individual inventory asset items with clear asset target names and offline sync queue awareness.
- **Rack Layout Deletion Safeguards (`RackDetail.tsx`)**: Added item removal confirmation dialogs for rack unit layouts to prevent accidental unit displacement.

---

### 🚀 Feature Release: v5.19.3 (Inline Project Creation & Mobile List Modal Optimization)
*Released on: August 7, 2026*
- **Inline Project Creation in List Setup Window**: Integrated a dedicated "+ Create New Project" option directly inside the list creation modal (`Dashboard.tsx`). Users can now provision a new project workspace on the fly while setting up a list without leaving the creation workflow.
- **Project Link Quick Toggle**: Added an interactive mode switcher (`Existing` vs `+ New Project`) alongside the `-- No Project (Standalone List) --` dropdown option for quick project assignment.
- **Mobile UI & Viewport Auto-Zoom Fixes**: Upgraded modal container with `max-h-[92vh] overflow-y-auto`, touch-friendly padding, custom dropdown arrow overlays, and iOS WebKit viewport zoom prevention (`text-base sm:text-sm`).

---

### 🚀 Maintenance Release: v5.19.2 (Mobile Selection Toolbar Centering & Responsive Alignment)
*Released on: July 26, 2026*
- **Floating Action Bar Mobile Centering & Alignment**: Resolved Framer Motion CSS transform conflicts (`x: '-50%'` combined with Tailwind `-translate-x-1/2`) that caused horizontal misalignment and clipping on mobile viewports across `GearLibrary` and `InventoryModule`.
- **Responsive Padding & Safe Viewport Margins**: Updated floating action bar containers to use `left-3 right-3 md:left-1/2 md:-translate-x-1/2` with `bottom-22 md:bottom-8` spacing for mobile viewports, preventing overlap with the mobile bottom navigation bar and ensuring touch targets remain centered.
- **Flex Child Shrink Rules**: Added `shrink-0` to toolbar action buttons inside horizontal overflow containers to preserve label readability without text squishing on small screens.

---

### 🚀 Security Hardening & Patch Release: v5.19.1 (SSRF Protection, Fail-Closed Webhooks & Developer Endpoint Auth)
*Released on: July 26, 2026*
- **SSRF Defense Engine (`/api/url-to-base64`, `/api/analyze-item`, `/api/extract-case-url`)**: Implemented dedicated IP and URL protocol validation (`server/utils/ssrf.ts`) blocking internal subnets, localhost, metadata IP addresses (`169.254.169.254`), and non-HTTP/HTTPS schemes across image downloading and spec extraction endpoints. Added dedicated `POST /api/url-to-base64` endpoint with session authentication.
- **Protected Developer API Endpoints (`/api/developer/*`)**: Secured `/api/developer/lists` and `/api/developer/gear` behind mandatory `requireDevApiKey` header/query authentication and `/api/developer/embed` behind user authentication middleware (`authenticateUser`).
- **Fail-Closed Webhook Secret Enforcement (`/api/webhooks/*`)**: Hardened Paddle (`/api/webhooks/paddle`) and Dodo (`/api/webhooks/dodopayments`) payment webhooks to fail-closed behavior. Unconfigured secrets now return `500 Internal Server Error` and missing/invalid signatures return `401 Unauthorized`.
- **Authenticated Label Operations**: Applied `authenticateUser` middleware to custom label template creation, template deletion, print logging, and marketplace publishing routes in `server/routes/labels.ts`.

---

### 🚀 Major Production Release: v5.19.0 (Landing Page Redesign, Single Header Login & Soft Dark Glassmorphism)
*Released on: July 26, 2026*
- **Landing Page Redesign**: Complete overhaul of public landing UI featuring single-header login buttons, soft dark glassmorphism aesthetic, interactive gear calculator preview, and responsive hero banners.
- **Unified Seat Pricing Model**: Added support for configurable included seats and extra seat pricing ($/month) per subscription plan in `AdminPanel.tsx`.
*Released on: July 26, 2026*
- **Dynamic Import Auto-Recovery**: Enforced exponential backoff and automatic Service Worker cache invalidation/unregistration on chunk load failures in `src/app/routes.tsx` to eliminate white-screen errors during background deployment rollouts.
- **Enhanced Crash Boundary**: Added smart import error detection and a dedicated `"Reload & Clear Cache"` recovery action to `ErrorBoundary.tsx` that forcefully purges stale PWA service workers and refreshes the browser module graph.
- **Standardized CTA Copy**: Unified call-to-actions across landing pages, pricing tables, paywalls, and profile gates to `"Start Free Trial — 14 Days →"` (primary) and `"Book a Demo"` (secondary).
- **Context-Aware Footer Bylines**: Implemented split footer bylines for formal/public contexts (`"Built by Digital Bure · Fiji · For crews worldwide"`) and in-app views (`"Made in 🇫🇯 with 💙 | App by Digital Bure"`).
- **MCP Protocol & Tools Sync**: Synchronized MCP server info, capabilities, and marketing kit resources (`packer://marketing-playbook`) to version `v5.18.6`.

---

### 🚀 Production Patch Update: v5.18.5 (Marketing Copy Alignment, CTA Standardization & Split Footer Byline)
*Released on: July 26, 2026*
- **Standardized CTA Copy**: Standardized all primary free trial and demo call-to-actions across landing pages, pricing grids, paywalls, and profile gates to `"Start Free Trial — 14 Days →"` (primary) and `"Book a Demo"` (secondary).
- **Context-Aware Split Footers**: Implemented context-specific footer bylines across public/formal pages (`"Built by Digital Bure · Fiji · For crews worldwide"`) and in-app/casual views (`"Made in 🇫🇯 with 💙 | App by Digital Bure"`).
- **MCP Marketing Kit & Positioning Alignment**: Updated `get_marketing_messaging_kit` and `packer://marketing-playbook` MCP tools to version `v5.18.5`, updated tagline to `"Production Logistics OS for Professional Crews"`, added `canonicalPositioning: "signed, bidirectional manifest"`, and aligned industry hooks to lead with signed manifest accountability.
- **Hero & Headline Copy Alignment**: Standardized top-of-funnel attention hooks to `"Did they sign for it?"` and consideration spots to `"Every item. Every crew. Accountable."`.

---

### 🚀 Production Patch Update: v5.18.4 (MCP Multi-Tenant Security, Unauthenticated Fail-Closed Protection & Claude OAuth 2.0)
*Released on: July 26, 2026*
- **Claude OAuth 2.0 Connector Handshake**: Implemented complete OAuth 2.0 authorization code and token endpoints (`/oauth/authorize`, `/oauth/token`) and discovery metadata at `/.well-known/oauth-authorization-server` for Claude AI custom connector integration.
- **Fail-Closed Unauthenticated Safety**: Removed unauthenticated fallback defaults (such as `'demo-super-admin'`) across all gear library and inventory write endpoints (`add_gear_item`, `list_gear`, `list_inventory_sheets`). Explicit `uid` user validation is now strictly enforced.
- **Elevated Admin API Authorization**: Gated cross-tenant organizational discovery, profile lookup, and system telemetry tools (`list_organizations`, `lookup_user`, `update_user_plan`, `get_system_telemetry`) behind strict `adminApiKey` authentication checks.

---

### 🚀 Production Update: v5.18.3 (Production Cloud Run Custom Domain packer.tools MCP Endpoint Integration)
*Released on: July 25, 2026*
- **Production Custom Domain Connector**: Updated all MCP Server endpoint references, terminal command documentation, and JSON configurations to target the public Cloud Run production custom domain `https://packer.tools/api/mcp/sse`.
- **Admin Documentation Panel Synchronization**: Updated the Admin Documentation tab and `KNOWLEDGE_BASE.md` to directly reference `https://packer.tools/api/mcp/sse` for instant pairing with Claude Code CLI, Claude Desktop, and Cursor.
- **Server Version Synchronization**: Updated central server definition in `server/routes/mcp.ts` and UI modals to `v5.18.3`.

---

### 🚀 Minor Update: v5.18.2 (MCP Server SSE Heartbeats, CORS & Dual-Transport Resilience)
*Released on: July 25, 2026*
- **CORS & Proxy Header Authorization**: Applied wildcard CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers`) across all `/api/mcp` endpoints to enable cross-origin connections from Claude Web, Claude Desktop, and Cursor connectors.
- **SSE Stream Keep-Alive Heartbeats**: Implemented 15-second heartbeat ping comments (`: ping\n\n`) on the `/api/mcp/sse` transport to prevent Cloud Run, Nginx, and web proxy idle timeouts.
- **Session Isolation & Express Body Parsing**: Configured isolated MCP Server instances per client session and passed pre-parsed Express JSON payloads into `SSEServerTransport.handlePostMessage`.
- **Stateless HTTP JSON-RPC Fallback**: Added direct JSON-RPC HTTP POST handling (`initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/read`) on `/api/mcp` and `/api/mcp/sse` for clients using standard REST-based RPC requests.

---

### 🚀 Patch Release: v5.18.1 (React Duplicate Key Resolution & Package Lock Alignment)
*Released on: July 25, 2026*
- **React Duplicate Keys Resolution**: Resolved non-unique key warnings across grouped categories in `GearLibrary`, brand category tags in `AdminPanel`, and release tabs in `WhatsNewModal` by applying index-indexed composite React keys.
- **Dependency & Package Lock Synchronization**: Fully resolved package lockfile migration states via `install_applet_dependencies` clean sync.
- **MCP Server Knowledge Base Sync**: Synchronized backend MCP capabilities, `RELEASE.md`, and `KNOWLEDGE_BASE.md` resources to v5.18.1 specifications.

---

### 🚀 Stable Release: v5.18.0 (Claude Code, Claude Marketing Agent & Cursor Model Context Protocol (MCP) Server)
*Released on: July 25, 2026*
- **Native Model Context Protocol (MCP) Server**: Full-duplex SSE transport endpoint (`/api/mcp/sse`) and JSON-RPC stream handling (`/api/mcp`) exposing Packer Tools as a first-class custom connector for Claude Code, Claude Marketing Agent, and Cursor.
- **Claude Marketing Agent Positioning Kit**: Dedicated `get_marketing_messaging_kit` tool and `packer://marketing-playbook` resource endpoint supplying multi-industry angles (Film, Construction, Automotive, Sports, Medical, Logistics), social copy hooks, and value props.
- **Live Capability & Documentation Sync**: Integrated `get_app_capabilities`, `get_release_notes`, and `get_knowledge_base_guide` endpoints so AI agents always possess exact, real-time knowledge of platform features, v5.18.0 updates, and layout tools.
- **Admin System Operations & Telemetry**: Exposed `lookup_user`, `update_user_plan`, `list_organizations`, and `get_system_telemetry` for remote workspace management.

---

### 🚀 Stable Release: v5.17.0 (Multi-Select Group & Ungroup Shapes Engine & Visual Marquee Box-Select in Organizer Designer)
*Released on: July 25, 2026*
- **Visual Selection Marquee (Box-Select)**: Click and drag on empty canvas space to draw a responsive selection rectangle to multi-select shapes at once.
- **Multi-Select & Group / Ungroup Shapes Engine**: Added Shift/Ctrl/Cmd multi-selection support for Organizer Designer foam shapes with keyboard shortcuts for Group (`Ctrl+G`) and Ungroup (`Ctrl+Shift+G`).
- **Interactive Group Bounding Box Overlay**: Renders dynamic purple dashed group bounding overlays with quick 'Lock Group' and 'Ungroup' action banners on multi-selection.
- **Group Drag & Proportional Scaling**: Move or resize entire grouped shape arrays simultaneously with automatic relative coordinate scaling.
- **Context Menu & Toolbar Grouping Integration**: Quick-action Group/Ungroup buttons added directly to top action toolbar and right-click canvas context menus.

---

### 🚀 Stable Release: v5.16.0 (Organizer Designer SVG/PNG CAD Export & Magnetic Snap Alignment Engine)
*Released on: July 25, 2026*
- **Vector & High-Res PNG CAD Layout Export**: Added direct SVG vector and 1600x1067 high-resolution PNG image download exports to the Organizer Designer for sharing, documentation, and laser foam printing.
- **Magnetic Snap Alignment Engine**: Implemented smart magnetic edge-to-edge, center-axis, and container boundary snapping for shape dragging and resizing with active cyan alignment guide lines.
- **Magnetic Snapping Controls & Persistence**: Integrated a toolbar magnet toggle control and saved magnetic snapping settings directly into Firestore container layout sketches.

---

### 🚀 Stable Release: v5.15.0 (Public Share Links Resolution, Non-Auth Public Asset Access & Security Rules Hardening)
*Released on: July 25, 2026*
- **Unauthenticated Item & Public Bio Access**: Shared gear items, public digital passports, and public packing lists can now be accessed directly without requiring user authentication.
- **Collection Group Firestore Fallback**: Shared item resolution automatically queries collectionGroup when owner ID params are omitted in direct links or QR scans.
- **Firestore Security Rules Hardening**: Updated security rules to allow read permissions for public gear items, booking conditions, and shared packing lists while maintaining full mutation protections.

---

### 🚀 Stable Release: v5.14.0 (Native Mobile UX Redesign, iOS Sheet Drag Handles & Tactile Haptic Feedback)
*Released on: July 25, 2026*
- **Native Mobile Navigation Bar**: Redesigned mobile bottom tab bar with spring active tab indicators (`motion/react`), dark mode glassmorphism backdrops, and expanded touch target spacing.
- **iOS Drag-Handle Action Sheets**: Upgraded Quick Create and direct workflow menus with native iOS pull handle indicators (`w-12 h-1.5 rounded-full bg-neutral-300`) and smooth gesture dismissals.
- **Tactile Touch Feedback**: Integrated browser-native haptics (`navigator.vibrate`) across all primary bottom bar buttons, top search toggles, drawer buttons, and action items for physical touch confirmation.

---

### 🚀 Stable Release: v5.13.0 (Onboarded Kit Scenario Coaching, Extended Travel Cases & 2D Spatial Blueprints)
*Released on: July 24, 2026*
- **Onboarded Kit Scenario Coaching**: Dukey AI Assistant now reads the user's actual onboarded equipment kit and explains specific operational scenarios (Film shoot, AV rack build, Outdoor expedition, Field clinic, Drone survey) using Packer Tools features.
- **Extended Travel Cases, Backpacks & Racks**: Expanded the Travel Case spec extractor and category filters to process camera backpacks (Peak Design, Lowepro), 19" rack enclosures (Gator, SKB), hard cases (Pelican, Nanuk), and soft bags.
- **2D Spatial Case Blueprints**: Interactive 2D spatial arrangement visualizer for modeling gear layout fit inside case interior dimensions before physical packing.
- **Quota-Resilient AI Fallbacks (429 handling)**: Graceful heuristic fallbacks across server AI routes (`/api/dukey-chat`, `/api/extract-case-specs`, `/api/scenario-brief`) to handle Gemini quota limit responses seamlessly without crashing.

---

### 🚀 Stable Release: v5.12.0 (Plain Paper Presets, Temporary Barcode Cut Guides & Perfect Isolation Prints)
*Released on: July 22, 2026*
- **Plain Paper Presets & Templates**: Introduced 4 new print templates designed for standard non-adhesive papers (A4 & Letter size), including 8-card grid structures and single giant temporary labels.
- **Print Cut Guides**: Plain paper templates automatically render dynamic dashed border cut guides and scissor indicators for easy trimming.
- **Perfect Print Isolation**: Refactored CSS print rules to guarantee standard background and portal isolation, preventing multi-page overflows and margin shifting.

---

### 🚀 Stable Release: v5.11.0 (Mobile Touch Target Standards & High-Density UX Optimization)
*Released on: July 20, 2026*
- **48x48px Touch Target Standard**: Optimized interactive UI elements across mobile viewports for fluid touch operation.
- **High-Density UX Layouts**: Enhanced list views, filters, and drawer panels for high-density equipment list browsing.

---

### 🚀 Stable Release: v5.10.0 (Mobile Haptic Feedback & Tactile Notifications)
*Released on: July 18, 2026*
- **Tactile QR & Barcode Scanning**: Integrates tactile, physical haptics for scanner actions on mobile setups. Recognizing a QR code or barcode triggers a short double-vibration pulse to confirm scans.
- **List Addition Success Feedback**: Manual additions, AI-crawls, or spreadsheet imports trigger a clean, single-vibration tactile click, confirming items are successfully added without screen checking.
- **Cross-Platform Navigator API Wrapper**: Programmed resilient `window.navigator.vibrate` standard wrappers, including silent fallbacks for desktop setups and multi-pulse feedback for error outcomes.

---

### 🚀 Stable Release: v5.9.0 (Public Sharing Links & Company Branding Exports)
*Released on: July 12, 2026*
- **Non-Authenticated Public Sharing**: Securely share individual asset profiles or packing lists via read-only hash-secured pages. Stakeholders, crew, or finders can view details, live location status, and contact bio without an account or login.
- **Logo & Color Branding Manifests**: Added uploader inside the PDF export config panel for corporate logos and custom primary hex colors. Logos are auto-embedded on generated cargo manifests, and brand colors apply dynamically to borders and styling.

---

### 🚀 Stable Release: v5.8.0 (Physical Avery Label Sheets Mode & Storage Exhaustion Safeguards)
*Released on: July 04, 2026*
- **Avery Label Sheets Mode**: Developed a high-precision print designer supporting standard physical label sheet layouts (Avery 5160, 5161, 5162, 5163, L7160, etc.) in `QRPrintModal.tsx`. It handles multi-column margins, rows, labels spacing, and page-breaks dynamically.
- **Avery Start Slot Selector**: Integrated starting-position selector logic allowing users to bypass previously used label slots when loading partially-used sheets, preventing physical card wastage.
- **Dashed Guideline Bounds Toggling**: Implemented interactive guideline toggle buttons enabling users to preview physical grid boundaries during layout alignment.
- **Storage QuotaExceeded Monkey-Patch Safeguards**: Embedded global monkey-patch interceptors for both `localStorage` and `sessionStorage` in `src/main.tsx` that detect Safari/Chrome private-mode storage failures and auto-purge obsolete cache data.
- **Checkout Unique Compound Keys**: Addressed duplicate key rendering warnings inside the order fulfillment list in `KioskMode.tsx` using unique index and compound id values.

---

### 🚀 Stable Release: v5.7.0 (Bulk List Copying & Multi-Select Operations)
*Released on: July 03, 2026*
- **Cross-List Bulk Copying**: Engineered advanced replication tools allowing coordinators to replicate selected gear library items completely into custom inventory sheets or packing lists, complete with automatic item instantiation.
- **Fast Status Updates**: Instantly transitions selected assets across Available, In Use, Maintenance, Retired, or Missing states, utilizing chunked Firestore batches.
- **Real-Time List Sync**: Configured deep-listening subscriptions for active packing lists, enabling on-the-fly list creations and exports in the multi-select terminal.

---

### 🚀 Stable Release: v5.6.0 (Mobile Direct Load & Loading Safeguards)
*Released on: July 02, 2026*
- **Direct Item Loading**: Allows items to be loaded directly to new or existing lists/inventories from the mobile central Add menu without requiring prior library registration.
- **Multi-Way Cross Synchronization**: Choose to automatically register directly loaded items to the Central Gear Library, or replicate them across both packing lists and custom sheet inventories.
- **Loading Skeleton Safety Fallbacks**: Added 2.5-second automated fallbacks to real-time sync connections, ensuring the app gracefully bypasses slow database snapshots and never remains stuck.

---

### 🚀 Stable Release: v5.5.0 (Service Worker IndexedDB Caching)
*Released on: July 02, 2026*
- **Resilient SW Caching**: Primary gear library list and custom inventories are cached locally inside the Service Worker's IndexedDB, avoiding blank screens.
- **Automated Offline Failover**: The app seamlessly detects project read-quota exceptions or internet outages and instantly feeds records from the local database.

---

### 🚀 Stable Release: v5.4.0 (Server-Side OG Meta Tag Injection & Unified Collapsible Admin Sidebar)
*Released on: July 02, 2026*
- **Server-Side OpenGraph (OG) Injection**: Developed a custom backend share router `/server/routes/share.ts` to intercept `/gear/:id` and `/p/:id` (or `/list/:id`) query URLs. It queries the matching assets or packing list metadata dynamically in Firestore and injects genuine OpenGraph title, description, image, and Twitter meta tags directly into the delivered `index.html` headers. This replaces simulated client-side mockups with actual high-fidelity social sharing card previews.
- **Clean Canonical URL QR Code Routing**: Updated QR Code generation canvases across the dashboard (`AddGearModal.tsx`), label printing sheets (`QRPrintModal.tsx`), share drawer modals (`ShareModal.tsx`), and detail pages (`GearBioPage.tsx`) to generate clean URL routes (e.g., `/gear/:id` instead of hash-wrapped `/#/gear/:id`), preventing search indexing issues and aligning with correct server-side proxy interception.
- **Differentiated Scanning Passports**: Refactored the public asset detail interface (`GearBioPage.tsx`) to render completely custom layouts based on physical state: missing or lost items display an urgent Red "Safe Recovery Portal" return form, while healthy items render an elegant Emerald "Digital Asset Passport" displaying certified equipment specifications.
- **Unified 'Admin' Collapsible Navigation Sidebar**: Reorganized the primary left-hand navigation panel to consolidate administration tools (Gear Library, Organization Settings, and Super Admin panel) into a single collapsible "Admin" header. This increases layout density, avoids sidebar pollution, and enhances screen real-estate for inventory lists.

---

### 🚀 Stable Release: v5.3.0 (Unified Lists Hub Dashboard & Workspace Inventory Navigation)
*Released on: June 30, 2026*
- **Unified Lists Hub Dashboard**: Refactored the dashboard lists layout into a high-density, three-column "Lists Hub". Displaying Pack Lists, Kit templates, and List of Inventories side-by-side with deployment indicators and live counts.
- **Sidebar Lists Navigation**: Deployed a direct navigation action button for the Lists Hub in the main collapsible Sidebar navigation panel above the "Add Gear" action.
- **Version Alignment**: Incremented system versions and secure build labels across the codebase including `package.json`, footer status indicators, print styles, and profile notifications.

---

### 🚀 Stable Release: v5.2.1 (Aesthetic Key Safeguards & Travel Manifest Printing)
*Released on: June 29, 2026*
- **Dynamic Render Key Safeguards**: Resolved React double-key rendering and React children mapping collisions across major selection, bulk alignment, and categories list arrays in the main **Gear Library** and **Custom Inventory Module**. Integrated robust key-bindings utilizing incremented index offsets and scope-prefix markers.
- **Travel Manifest Export & High-Res PDF Print Rules**: Hardened `@media print` style blocks in the custom **ATA Carnet & Travel Manifest** widget. Flattened grid arrays, hid interactive controls/buttons dynamically during printing, applied clean borders, and constrained page-break rules to guarantee pristine physical sheets.
- **Normalized System Metadata & Version Sync**: Aligned system versions across `package.json`, administrative documentation panels, footer indicators, and navigation rails to reflect the stable `v5.2.1` release.

---

### 🚀 Stable Release: v4.35.0 (Firestore Read-Unit Protection & Scaling Pagination)
*Released on: June 29, 2026*
- **Firestore Scale Protection & Read Safeguard**: Engineered dual-path pagination query blocks across both the primary **Gear Library** and the **Custom Inventory Module**. Added lazy query buffers limiting listeners to 50 documents by default (`limit(50)`), protecting users from massive multi-thousand-document read-unit spikes on collection syncs.
- **Real-Time Low-Overhead Metadata Counting**: Integrated server-side document counter utilities (`getCountFromServer`) that query index counts dynamically on data changes. This tracks the absolute total records in the database with up to 100x lower resource and financial cost than retrieving raw payloads.
- **Visual Read Optimization Dashboards**: Installed tactile indicators and sync panels inside major list views, displaying current active cache state and total database records. Embedded rapid buttons ("⚡ Load Next 50 Items") for on-demand batch query expansion.

---

### 🚀 Stable Release: v4.34.0 (Hybrid Auto-Mapping & Manual AI Alignments for Bulk Importing)
*Released on: June 29, 2026*
- **Hybrid Auto-Mapping Column Alignment**: Engineered a dual-path alignment engine for uploaded spreadsheet headers. It runs rapid local fuzzy heuristics instantly offline. If key required fields (like item name) are not successfully identified, it seamlessly falls back to the server-side AI Column Matching Schema Engine (`/api/map-inventory`) to ensure maximum coverage and speed.
- **Tactile 'Run AI Auto-Map' Buttons**: Deployed clickable tactile controls ("✨ Run AI Auto-Map") inside the import sandbox layout of both the main **Gear Library** and **Custom Inventory Module**, giving operators manual on-demand control to trigger or re-run AI-powered header matching.
- **Enhanced Progress Telemetry & Toasts**: Integrated real-time toast alerts informing users when columns are instantly aligned using local rules, paired with custom spinner indicators and button disabled bindings during concurrent network requests.

---

### 🚀 Stable Release: v4.33.0 (PayPal Security Hardening & Global Currency Exchange Integration)
*Released on: June 28, 2026*
- **PayPal Backend API Key Security**: Hardened PayPal integration by restricting sensitive PayPal Secret Keys strictly to the Express backend (`/server/utils/paypal.ts`) and processing payments securely via backend endpoints (`/api/paypal/*`). Only public PayPal Client IDs are utilized on the client-side to guarantee maximum credential isolation.
- **Global Currency Exchange Service**: Implemented context-driven automated conversion on pricing values across marketplace searches, item detail panels, custom inventories, and checkout modules.
- **Regional Checkout Synchronization**: Integrated active currency state synchronization within both the Paywall upgrade portal and Checkout flow components. Configured PayPal orders dynamically to convert the original plan amounts into the user's selected regional currencies (e.g. FJD, AUD, NZD) on-the-fly, ensuring precise payment processing and complete consistency.

---

### 🚀 Stable Release: v4.32.0 (Google Chat Integration Upgrades & Global Marketplace Status Control)
*Released on: June 27, 2026*
- **Google Chat Secure Express Proxies**: Deployed full Express server API routes (`/api/googlechat/spaces` and `/api/googlechat/message`) to secure private Google OAuth access tokens and prevent third-party exposure.
- **Manual Custom Space Linker Option**: Integrated an elegant, high-contrast custom form allowing administrators to link Google Chat spaces manually by inputting the space path (e.g. `spaces/AAAAxxxx`) and display labels directly.
- **Unified Channel Disconnect Action**: Added a simple, responsive "Disconnect Channel" action that clears active Google Chat configurations in Firestore, restoring the organization setup layout instantly.
- **Global Marketplace Status Control**: Configured a master activation/deactivation toggle under the Marketplace settings, allowing administrators to restrict active search, listing, and booking actions globally during maintenance.

---

### 🚀 Stable Release: v4.31.0 (Hierarchical Group Workspace & Adaptive Modal Navigator)
*Released on: June 26, 2026*
- **Hierarchical Organizer Workspace Overlay**: Revamped the primary group/shelf card detail view into an immersive, multi-pane overlay. Left pane displays visual specifications, detailed descriptions, and physical status tags. Right pane visualizes interactive checklist contents with granular sub-item expansion support.
- **Intelligent Navigator & Quick Switcher**: Engineered an adaptive selector drawer directly into the top command bar, empowering organizers to rapidly toggle, cycle, and preview sibling storage containers (e.g., pelican cases, shelves, lockers) without closing the window.
- **Bulk Allocation Proposal Panels**: Supported live staging drafts of entire inventory sheets or kits directly into active compartments, allowing coordinators to confirm or discard changes in a dedicated sandbox environment.

---

### 🚀 Stable Release: v4.30.0 (Smart Quick Add Safeguards & Multi-Channel Background Asset Integration)
*Released on: June 25, 2026*
- **Aesthetic Duplicate Detection Safeguards**: Integrated duplicate item detection in the Packing List Quick Add widget, prompting coordinators for confirmations before committing duplicate names to prevent accidental redundant entries.
- **Smart Background Photo & Metadata Lookup**: Programmed real-time background queries matching user-input names to existing Gear Library records, auto-loading matching item photographs and organizational categories on-the-fly without manual input.
- **High-Velocity Multi-Photo Local Sourcing**: Upgraded file capture selectors inside the Quick Add component to support simultaneous, multi-file uploads from device drives, applying automated client-side canvas-based compression to maintain fast rendering.
- **Robust User Interface Mechanics**: Integrated responsive, fluid loader transitions, and disabled state bindings during concurrent database executions to prevent system latency.

---

### 🚀 Stable Release: v4.29.0 (Structured CSV Export & Elegant PDF Report Generation)
*Released on: June 24, 2026*
- **Packing List CSV Export**: Empowered coordinators to export detailed packing lists and load manifest items (Item Name, Asset Tag, Status, Category, Priority, Weight, Dimensions, Tags, Notes, and Descriptions) as structured, standard CSV reports for offline record-keeping.
- **Departmental Inventory PDF Report & Print Mode**: Integrated a gorgeous, print-ready, high-fidelity PDF layout generator for departmental inventory sheets. Includes complete financial valuation aggregates, stock status metrics, and responsive category-grouped visual boards.
- **Custom Print Customization Controls**: Granted administrators complete toggles to live-render lists with/without status descriptions, apply ultra-compact line heights for massive lists, and group assets by category prior to saving or printing.

---

### 🚀 Stable Release: v4.28.0 (Brand Image & Logo Upload and Display Integration)
*Released on: June 24, 2026*
- **Seamless Local Image Upload Support**: Integrated a file-drag-and-drop & browse local uploader inside the Brand Creator form in the Admin Panel, compressing images on-the-fly to robust base64 strings using browser canvas capabilities.
- **Dynamic Brand Logo Fallback/URL paste**: Preserved full URL pasting capabilities as an alternative to file uploads, allowing complete multi-sourcing flexibility for administrators.
- **Unified Brand Image Display**: Rendered matching brand logo images dynamically across the primary Gear Library inventory item cards, active Marketplace listings cards, and public booking/purchase modals.

---

### 🚀 Stable Release: v4.27.0 (Smart Optics Lens Taxonomy & Multi-Profile Interactive Import Sandbox)
*Released on: June 24, 2026*
- **Seamless Lens Taxonomy Integration**: Propagated high-fidelity lens-specific details (`lensType`, `lensMount`, `focalLength`, `maxAperture`, `formatCoverage`, `focusType`) from the individual item lists directly to the Marketplace listings, avoiding redundant duplicate data entry.
- **Auto-Populated Marketplace Listing Specs**: Configured the Edit Offer modal inside the Listings Module to automatically and asynchronously look up sub-items, detect optics/lenses, and pre-populate brand, model, and taxonomy specs.
- **Interactive Import Sandbox Playground**: Replaced the static CSV column mapping with an advanced interactive spreadsheet sandbox. Users can choose industry-tailored scenario profiles (Standard, AV Technical Manuals, or Production BOMs), dynamically add/delete draft rows, edit cell values inline, and batch-apply rules like Auto-Classifying categories or setting quantities.

---

### 🚀 Stable Release: v4.26.0 (Universal Image Paste & Multi-Channel Photo Sourcing)
*Released on: June 24, 2026*
- **Universal Clipboard Image Paste**: Integrated seamless paste event listeners across both the Quick Add Modal and the Gear Library Photo Picker, enabling users to instantly copy an image from their web browser or file system and paste it (`Ctrl+V` or `Cmd+V`) directly to upload.
- **Multi-Channel Media Inputs**: Expanded Manual Gear Onboarding step 1 to allow full local file uploads, native device camera captures, and direct clipboard image pasting rather than just text URL references.
- **Client-Side Image Auto-Compression**: Applied clean Canvas-based client-side image compression (`compressImage`) to all newly pasted/uploaded photos, preserving high-contrast detail while minimizing Firestore record sizes and accelerating page loads.

---

### 🚀 Stable Release: v4.25.0 (Optimized Mobile Interaction & Universal Floating Access Controls)
*Released on: June 21, 2026*
- **Tactile Floating Action Buttons (FAB)**: Engineered tactile, high-contrast Floating Action Buttons (FABs) in the bottom-right corner of the **Gear Library** (using deep brand black) and **Marketplace** pages (using signature brand red `#ff4f3a`) to optimize mobile interaction density and speed up entry creation workflows.
- **Micro-haptic Tactile Triggering**: Configured native physical haptic vibration pulses (`window.navigator.vibrate`) on touch devices for FAB clicks, mirroring physical remote clicker interactions.
- **Active Scaling Bounds**: Applied active tactile scale factors (`active:scale-90 duration-75`) on the FAB elements to deliver precise micro-interactive feedback on mobile viewports.

---

### 🚀 Stable Release: v4.24.0 (Performance Skeletons & Tactile Active States)
*Released on: June 21, 2026*
- **Integrated High-Performance Loading Skeletons**: Swapped out generic full-screen loading spinners on the Gear Library and Marketplace pages with elegant, shimmering structure skeletons which precisely mirror active grid and card layouts, completely eliminating layout shifting.
- **Haptic Vibration Feedback**: Integrated browser-native haptic feedback (`window.navigator.vibrate`) on touch devices for critical active commands including "Add Item" and "Audit Mode Toggle".
- **Visual Active States**: Programmed responsive active scale bounds (`active:scale-95 duration-75`) on master control buttons for instant tactile user-feedback on mobile viewports.
- **Pull-to-Refresh Support**: Engineered full pull-to-refresh swipe down gestures with custom spinner indicators for seamless real-time data synchronization on mobile screens.

---

### 🚀 Stable Release: v4.23.0 (Mobile UX Optimizations & Responsive Gestures)
*Released on: June 21, 2026*
- **Collapsible Mobile Action Toolbars**: Designed and integrated fully responsive, collapsible filtering and action drawers across the Custom Inventories page and Gear Library view. Dense search options are hidden behind a high-contrast togglable panel on smaller screens, resolving component horizontal spillover.
- **Visual Swipe Gestures Support**: Engineered pointer and touch-swipe observers (`onTouchStart`/`onTouchEnd`) inside the Marketplace Detail view which let users cycle fluidly through listing asset photographs with natural left/right hand gestures.
- **Overlaid Chevron Asset Navigators**: Placed visible navigation arrows on the left and right margins of the detailed Listing illustration box—always displayed on mobile layouts and elegantly sliding in on desktop cursor-hover.
- **Scroll-to-Head Transitions**: Improved mobile viewport shifts, aligning automatic scroll positioning (`window.scrollTo` top:0) upon selecting marketplace entries, matching the standard app design language.
- **Scrollable Horizontal Sub-Tabs**: Upgraded the tab bars within the Active Listings module to support non-shrinkable scrollable flex containers, preventing horizontal squishing on compact screens.

---

### 🚀 Stable Release: v4.22.0 (Ancillary Classification & Packing List Portals)
*Released on: June 21, 2026*
- **Organizational 'Organizer' Classification**: Created and integrated a dedicated 'Organizer' categories and sub-item dropdown configurations (representing pouches, bags, and cases) across AddGearModal, GearLibrary, PackingListDetail, with correct display tags in the Marketplace catalog views.
- **Interactive Inter-Checklist Porting Engine**: Implemented full Copy / Move bulk action flows allowing packers to duplicate or migrate multiple selected items seamlessly across target packing lists with fully managed clean-up and activity tracking.

---

### 🚀 Stable Release: v4.19.0 (Navigation Ergonomics & Responsive Enhancements)
*Released on: June 19, 2026*
- **Symmetrical Operator Flow**: Relocated the Account metadata card to the absolute pinnacle of standard user layouts for faster identity validation.
- **Ergonomic Dashboard Interception**: Integrated the Primary Dashboard entry directly above high-frequency utility triggers like "Scan to Pack" inside the primary navigation panel.
- **Symmetric Action Grid**: Reordered and polished key interactive triggers to standard layout sequence: Add Gear, New List, and Scan to Pack.

---

### 🚀 Stable Release: v4.18.0 (Security Hardening, Package Cleansing & Production Readiness)
*Released on: June 19, 2026*
- **Role-Based Access Hardening**: Developed `docs/admin-setup.md` guiding secure, cryptographic provisioning of first-time `superAdmin` accounts using the Firebase Admin SDK. Emphasized role authorization over hardcoded developer context boundaries.
- **Normalized Package Metadata**: Transformed package name metadata in `package.json` and `metadata.json` to reflect `packer-tools` matching enterprise specifications, along with fine-tuned platform descriptions.
- **Security Vulnerability Cleansing**: Audited dependencies, successfully resolved high-severity and moderate vulnerabilities across libraries (e.g. `uuid`, `axios`, etc.), lowering overall exposure.
- **Enterprise Readiness Certification**: Established `docs/production-readiness.md` validating complete container compatibility, secure environment isolation protocols, and robust firestore rule coverage.

---

### 🚀 Stable Release: v4.17.0 (Merchant Gateway Upgrades & Core Feature Calibration)
*Released on: June 19, 2026*
- **Expanded Dodo Merchant Checkout Channels**: Deployed comprehensive annual checkout linkages (`dodoCheckoutUrlAnnual`) across core payment mapping settings, matching live checkout buttons for self-service subscription upgrades dynamically.
- **Dynamic Handshake Integrations**: Enhanced the payment system console to support real-time connection checks and live production Dodo presets syncing in the admin dashboard.
- **Module Version Alignments**: Synchronized modular schemas, feature presets, and overall system core layers to prepare for high-volume enterprise deployment.

---

### 🚀 Stable Release: v4.16.0 (Unified Administrative Hierarchy & Primary Sidebar Convergence)
*Released on: June 19, 2026*
- **Administrative Navigation Consolidation & Nested Routing**: Refactored the eight modular System Settings (Branding, Email, Billing, Multi-Industry, Marketplace, Widgets, Bug Finder, SMTP) out of the secondary page layouts and integrated them as real-time collapsible subItems within the primary sidebar (`Sidebar.tsx`).
- **URL Search Parameter State Syncing**: Interfaced `settingsSubTab` in `AdminPanel.tsx` directly with URL search query parameter `sub`. Clicking the primary sidebar subItems updates URL paths seamlessly, allowing direct, deep-linked access and preserving active-item highlights.
- **De-cluttered Desktop Dashboard Canvas**: Deactivated the double-nested vertical left rail inside System Settings on desktop screens, allowing high-contrast lists, custom tables, and forms to run on full horizontal screens without cramped boundaries.

---

### 🚀 Stable Release: v4.13.0 (Systems Builder Authorization & Self-Service Beta Enroller)
*Released on: June 17, 2026*
- **Systems Builder Security Audit & Registry**: Hardened and configured comprehensive security rules for the Systems Builder feature under a custom `/systemsBuilds/{buildId}` namespace in `firestore.rules`. Established strict ownership validation (`isValidSystemsBuild()`) preventing unauthorized cross-tenant writes or read tampering.
- **Self-Service Beta Program Access**: Deployed an interactive, high-contrast purple control panel within the Developer Dashboard allowing any registered user to toggle their official platform-wide `isBetaTester` status seamlessly with instantaneous visual feedback, bypassing manual administrative whitelisting.
- **Instant Dashboard Syncing**: Connected the newly toggled beta flag to the main workspace layout, allowing users to instantly reveal or hide the deep debug `🧪 Beta Bug Finder` workbench tab without requiring page reloads.

---

### 🚀 Stable Release: v4.12.0 (Administrative System Health & Concurrency Load Simulator)
*Released on: June 17, 2026*
- **Administrative System Health Dashboard**: Designed and integrated a production-ready telemetry component under the "System Health" tab of the Admin Panel, visualizing live Firebase Firestore document counts, transaction volume distribution curves, and real-time SLA patterns.
- **Serverless Cloud Aggregations Audit**: Built on-demand database syncing utilizing lightweight `getCountFromServer()` checks across collections (including Users, Lists, Projects, Logs, and Custom Sheets), eliminating unneeded memory consumption.
- **Durable Concurrency Load Simulator**: Implemented interactive scaling controls for Daily Active Users (DAU), Reads, and Writes per session to automatically recalculate hourly operations, project pricing schedules, and flag potential write hotspots.
- **Hotspot Auditing Index Guidelines**: Documented complete structural check-indexes mapping micro-batch actions, large query limits, and write-lock mitigations, supporting high enterprise scalability.

---

### 🚀 Stable Release: v4.11.0 (Enterprise Scalability & High-Volume Query Safeguards)
*Released on: June 17, 2026*
- **Query Cost & Overhead Mitigation**: Migrated multiple system dashboard tracking queries in `limitUtils` from pulling expensive list-snapshots (`getDocs`) to utilizing server-side optimized aggregation functions (`getCountFromServer`). This prevents client memory exhaustion and slashes Firebase billing costs for checking active item limitations down to near-zero.
- **Write-Batch Splitting Engine**: Fixed and upgraded bulk action processors across the Gear Library and custom inventories. Any operations updating, creating, copying, or deleting assets in large batches are dynamically split into micro-batches of maximum 250-500 operations to prevent exceeding Firestore's strict single-batch limit of 500 documents.
- **Robust High-Efficiency Pagination**: Validated and updated reactive interface buffers in both catalog grids and dataset tables. Large sheets with millions of entities are rendered seamlessly via decoupled page limits and virtual sorting.

---

### 🚀 Stable Release: v4.10.0 (Production Custom Domain Mapping & Routing)
*Released on: June 16, 2026*
- **Custom Domain Migration**: Configured and successfully mapped the professional custom domain **`packer.tools`** to the Cloud Run project, preparing the application for full-scale live production.
- **Embedded Routing & API Update**: Migrated embedded widget iframe links, developer API endpoint sandboxes, and developer tools documentation code snippets from the legacy temporary `packer-tools.run.app` address to use the direct secure `https://packer.tools` URL.
- **System Synchronization**: Verified and updated production references across the application to provide seamless, consistent platform identity and correct payment gateway integration checks.

---

### 🚀 Stable Release: v4.9.0 (System Settings Integration & Bug Finder Relaunch)
*Released on: June 11, 2026*
- **Settings Dashboard Consolidation**: Moved the **Bug Reports Finder** directly under **System Settings** to keep the left-hand panel uncluttered and organize core administrative tools cohesively.
- **Real-Time Active Notification Lights**: Added responsive red glowing notification indicators to the System Settings navigation entry whenever a beta tester registers an unresolved issue (`open` or `in_review`) in Firestore.
- **Unified Progression Resolves**: Retained the interactive, full-featured status modification controls allowing admins to update status, track screenshots, and publish resolutions instantly back to users.

---

### 🚀 Stable Release: v4.8.0 (Starters Navigation Customization)
*Released on: June 11, 2026*
- **Customizable Workspace Starters Settings**: Created a new control panel under the User Preferences tab permitting custom grouping of navigation elements.
- **Dynamic Main-Panel Hiding**: Modules checked by the user migrate instantly into the collapsible "Starters" sidebar drawer and are cleanly hidden from the primary left drawer interface for space optimization.
- **Enhanced Sidebar Versatility**: Synchronized responsive mobile drawers with user preferences, ensuring identical tidy layouts across small screen terminals.

---

### 🚀 Stable Release: v4.7.0 (Select Mode & Multi-Asset Bulk Operations)
*Released on: June 05, 2026*
- **Checklist Select Toggle Mode**: Introduced a global toggle button for Select Mode inside the main view controller ribbon. This instantly formats assets with selectable checkboxes across all layouts (Grid, Compact, and Mobile Lists) for rapid operational dispatch.
- **Robust Cloud Batch Operations Integration**: Interlinked multi-select arrays with complete Firestore atomic batch transaction handlers, facilitating bulk operations including **Move to Rack**, **Change Status**, and high-security transactional **Batch Deletes**.

---

### 🚀 Stable Release: v4.6.0 (Merchant Service Compliance & Custom Dispatch Routing)
*Released on: May 25, 2026*
- **Legal & Compliance Custom Pages Seeding**: Created high-quality compliance layouts for **Privacy Policy**, **Terms of Service**, and **Refund Policy** under custom routes (`/pg/privacy-policy`, etc.) based on requirements of major payment gateways (like Paddle). Seeded company metadata for Street Level Digital Engagement (SLEDIEN) Pte Ltd, Digital Bure, and Fiji registrations dynamically to Firestore.
- **Custom Pickup & Drop-off Preference Logistics**: Integrated granular Dispatch Routing options directly into Listings and Marketplace order workflows. Users can now choose between Preset Depot Locations (e.g., Suva Film Studio, Nadi Aviation Terminal, Pacific Harbour Lounge) and Custom Address Sites, with instantaneous cost and distance propagation.

---

### 🚀 Stable Release: v4.5.0 (User Layout & Dashboard Customization)
*Released on: May 12, 2026*
- **Granular Dashboard Column & Widget Toggle**: Allowed operators to toggle individual landing page segments on their administrative homepage, including performance metric cards, live visualizer graphs, maintenance schedules, recent list rosters, kiosk terminal panels, safety consoles, and fleet dispatch trackers.
- **Dynamic Quick Action Button Filter**: Empowered users in their settings to check/uncheck available quick access trigger cards. Unselected action buttons are automatically omitted from the dashboard layout.
- **Boot-Up Sidebar Collapse Choice**: Tied a persistent layout preference to the main app layout, letting users choose whether the sidebar starts fully collapsed to maximize visual real-estate.

---

### 🚀 Stable Release: v4.4.0 (Diagnostics & Bug Reporting)
*Released on: April 28, 2026*
- **Interactive Screenshot Diagnostics**: Integrated an on-page diagnostics report system featuring client-side canvas snapshot scaling/cropping to fit under Firestore's 100KB limits.
- **Admin Control Actions**: Built administrative dashboard views with crossout formatting indicating resolved tasks, backed by real-time status updates in Firestore.

---

### 🚀 Stable Release: v4.3.0 (Brand Shopfronts & Regional Currencies)
*Released on: April 10, 2026*
- **Dynamic Regional Currencies**: Designed admin configuration panels allowing instant workspace conversion among USD, FJD, AUD, NZD, GBP, CAD, or EUR with direct regional symbol swaps (e.g., `FJ$`).
- **Brand Storefront Profiles**: Released public profiles (`#/shop/:uid`) designed to host professional seller bios, headers, and social accounts.
- **Pro Tier Paywalls**: Enforced subscription paywall limits restricting marketplace catalog publishing to premium tier users.

---

### 🚀 Stable Release: v4.2.0 (Theme Preferences & Contrast Refinements)
*Released on: March 24, 2026*
- **Global Theme Engine**: Designed a secure Visual Theme Context allowing operators to alternate between Dark and Light Mode layout preferences with automatic `localStorage` caching.
- **Tailwind Surface Overrides**: Fully optimized high-contrast dark styles to increase text readability under variable warehouse illumination.

---

### 🚀 Stable Release: v4.1.0 (Outdoors & Academy Edition)
*Released on: March 08, 2026*
- **Adventure Presets**: Preloaded dedicated workspace nomenclature configurations for Hiking, Marine Scuba, and Search & Rescue.
- **Packer Tools Academy**: Initialized a specialized knowledge portal detailing legal dry payload limits, moisture audit tasks, and sub-zero battery storage.
- **Adaptive Layout Refinements**: Redesigned main viewports containing multi-column headers into cleanly compressed mobile headers.

---

### 🚀 Stable Release: v4.0.0 (Zero-Zero Trust Privacy & Kiosk Mode)
*Released on: February 15, 2026*
- **Multi-Layer Privacy Modes**: Implemented fine-grained visibility rules (🔒 Private, 👥 Team, 🏢 Dept, 🏢 Org, 🌐 Public) across the entire Gear Library and custom inventory sheets.
- **Kiosk Mode Terminal**: Rolled out the dedicated `/kiosk` terminal view featuring QR-code scanner triggers and 60-second automatic Firestore-synced PIN rotations.
- **Industry Presets Swapping**: Added quick toggle ribbons to swap equipment nomenclatures across Cinema, Construction, Medical, and General Logistics.

---

### 🚀 Stable Release: v3.2.0 (AI Cargo Advisory & Dukey Assistant Upgrade)
*Released on: January 25, 2026*
- **Gemini API Integration**: Leveraged the `@google/genai` SDK on secure server-side proxy routes to analyze storage list payloads.
- **Cargo Recommendation Cards**: Exposed actionable warnings during package allocation concerning heavy cargo payloads, dangerous materials, and safety requirements.
- **Dukey Assistant Core**: Programmed automated descriptive copy generators resolving empty item specifications.

---

### 🚀 Stable Release: v3.1.0 (Encrypted DB Schema & Whitelisting)
*Released on: January 08, 2026*
- **DB Schema Spec v3.1.2**: Migrated database structures to enforce encrypted metadata constraints, preventing third-party listing exposure.
- **Secured API Access**: Built standard JWT validation pipelines ensuring whitelisted endpoint validation.

---

### 🚀 Stable Release: v3.0.0 (Escrow Hires & Public Listings)
*Released on: December 18, 2025*
- **Rental Marketplace Core**: Added support for escrow payment tracking, hourly hire planners, and schedule validation engines.
- **In-App Booking Forms**: Introduced modal rental calendar forms calculating booking fees and security deposits on-the-fly.

---

### 🚀 Stable Release: v2.4.0 (Stable Core Optimization)
*Released on: November 24, 2025*
- **Platform Build v2.4.9**: Greatly enhanced Firestore query performance by introducing responsive caching layers and localized snapshot synchronization.
- **Cascade Cascading Selectors**: Handled multi-select associations dynamically cascading across Organization → Department → Team selectors.

---

### 🚀 Stable Release: v2.3.0 (Asset Barcode & QR Label Sheets)
*Released on: November 10, 2025*
- **Dynamic Dimension Presets**: Loaded physical template selectors for Dymo 30334, Brother TZe tape rolls, and standard Avery A4 sheets inside the label printer panel.
- **Custom Scale Parameters**: Allowed operators to define manual width/height scaling grids to match non-standard labels.

---

### 🚀 Stable Release: v2.2.0 (Physical Shelf Racks & Storage Coordinates)
*Released on: October 20, 2025*
- **Shelf Mapping Visualizers**: Created a physical shelving grid component allowing warehouse operators to plot exact shelf bays (e.g., Aisle 2, Row B, Tray 4).
- **Interactive Spot Highlights**: Linked inventory list components to coordinates, accelerating physical item retrieval.

---

### 🚀 Stable Release: v2.1.0 (Supply Chain & Lead-Time Analytics)
*Released on: September 30, 2025*
- **Lead-Time Estimator Algorithms**: Built reactive calculations flagging custom list elements that exceed standard shipping timeframes.
- **Inventory Stock Alarms**: Added low physical stock warnings identifying gear shortages.

---

### 🚀 Stable Release: v2.0.0 (Departmental Custom Sheeting)
*Released on: September 05, 2025*
- **Custom Inventory Lists**: Deployed isolated, user-owned non-synchronized lists alongside the primary Gear library catalog.
- **Spreadsheet AI Importers**: Embedded structured text-parsers matching uploaded spreadsheet rows to standardized schema attributes.

---

### 🚀 Stable Release: v1.3.0 (Recipient Contact Syncing)
*Released on: August 18, 2025*
- **Shared Direct Links**: Allowed users to generate secure, readable marketplace links to send to external recipients.
- **Recipient Directories**: Designed an isolated contact workbook in Firebase tracking client contact details and phone references.

---

### 🚀 Stable Release: v1.2.0 (AI Scraper Engine Core)
*Released on: July 30, 2025*
- **AI Scraper Engine v1.2.6**: Connected the platform to server-side AI extractors to fetch item brand, weight, and model data.

---

### 🚀 Stable Release: v1.1.0 (Multi-Tenant Schema Migration)
*Released on: July 12, 2025*
- **Metadata Extension**: Migrated Firestore records to include dedicated security tags tracking organizational ownership.

---

### 🚀 Stable Release: v1.0.0 (Initial Cloud Run Container Deployment)
*Released on: June 15, 2025*
- **Container Architecture**: Successfully provisioned a Google Cloud Run container bound to internal routing ports.
- **Locker Room Workspace**: Initialized the primary asset tracking module enabling remote teams to manage high-value production equipment.
- **Firebase Database Setup**: Wired Firebase Firestore databases and cloud security rules for high-speed synchronization.

---

## 🛠️ Local Build & Compilation Guide

To run or custom build this beta version of the application, follow these guidelines:

### Prerequisites:
- **Node.js** v18+ or v20+
- **npm** or **yarn**

### 1. Repository Configuration
Add local environment vars inside your `.env` file from the referenced `.env.example`:
```env
# Required for database connections
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here

# Required for server-side operations
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Dependency Setup
Install code declarations and workspace modules:
```bash
npm install
```

### 3. Running in Development (HMR & Node Host Proxy)
Spins up the fast Node/Express server routing static requests:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the live responsive interface.

### 4. Code Quality & Formatting Check
Verify syntax and correct typings before committing changes:
```bash
npm run lint
```

### 5. Production Compilation
Bundle the full-stack single entry point and client-side files:
```bash
npm run build
```
The resulting build directory will be generated inside `/dist/`.

---

## 🔗 How to Release & Tag on GitHub
When promoting this trial sandbox version to candidate status on telemetry channels, tag it on GitHub via git CLI:

```bash
# 1. Commit any current beta changes
git add .
git commit -m "release: v1.0.0-beta.1 integration of qr-sticker templates and cost matrices"

# 2. Add an annotated lightweight version tag
git tag -a v1.0.0-beta.1 -m "Active beta tag for tests"

# 3. Ship changes & push tags upstream to origin matching pipelines
git push origin main
git push origin v1.0.0-beta.1
```

Once pushed, GitHub Actions or Google Cloud Build can intercept this semantic version pattern (`v*`) to auto-ship binaries safely!
