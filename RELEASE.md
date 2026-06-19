# 🚀 Release Information & Production Build Guide

## Current Application Version: `v4.17.0`
**Status:** Stable Production Release  
**Environment:** GCP Cloud Run Container (Vite Node Proxy)  
**Database/Backend:** Google Firestore + Firebase Authentication

This document provides complete instructions on how to build, run, and tag this repository for production deployment or continuous integration. 

---

## 📦 Complete Stable Release & Version History

Below is the consolidated history of Packer Tools, tracing all production rollouts back to the original container deployment.

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
