# 🚀 Release Information & Production Build Guide

## Current Application Version: `v4.4.0`
**Status:** Stable Production Release  
**Environment:** GCP Cloud Run Container (Vite Node Proxy)  
**Database/Backend:** Google Firestore + Firebase Authentication

This document provides complete instructions on how to build, run, and tag this repository for production deployment or continuous integration. 

---

## 📦 Complete Stable Release & Version History

Below is the consolidated history of Packer Tools, tracing all production rollouts back to the original container deployment.

---

### 🚀 Stable Release: v4.4.0 (Diagnostics & Bug Reporting)
- **Interactive Screenshot Diagnostics**: Integrated an on-page diagnostics report system featuring client-side canvas snapshot scaling/cropping to fit under Firestore's 100KB limits.
- **Admin Control Actions**: Built administrative dashboard views with crossout formatting indicating resolved tasks, backed by real-time status updates in Firestore.

---

### 🚀 Stable Release: v4.3.0 (Brand Shopfronts & Regional Currencies)
- **Dynamic Regional Currencies**: Designed admin configuration panels allowing instant workspace conversion among USD, FJD, AUD, NZD, GBP, CAD, or EUR with direct regional symbol swaps (e.g., `FJ$`).
- **Brand Storefront Profiles**: Released public profiles (`#/shop/:uid`) designed to host professional seller bios, headers, and social accounts.
- **Pro Tier Paywalls**: Enforced subscription paywall limits restricting marketplace catalog publishing to premium tier users.

---

### 🚀 Stable Release: v4.2.0 (Theme Preferences & Contrast Refinements)
- **Global Theme Engine**: Designed a secure Visual Theme Context allowing operators to alternate between Dark and Light Mode layout preferences with automatic `localStorage` caching.
- **Tailwind Surface Overrides**: Fully optimized high-contrast dark styles to increase text readability under variable warehouse illumination.

---

### 🚀 Stable Release: v4.1.0 (Outdoors & Academy Edition)
- **Adventure Presets**: Preloaded dedicated workspace nomenclature configurations for Hiking, Marine Scuba, and Search & Rescue.
- **Packer Tools Academy**: Initialized a specialized knowledge portal detailing legal dry payload limits, moisture audit tasks, and sub-zero battery storage.
- **Adaptive Layout Refinements**: Redesigned main viewports containing multi-column headers into cleanly compressed mobile headers.

---

### 🚀 Stable Release: v4.0.0 (Zero-Trust Privacy & Kiosk Mode)
- **Multi-Layer Privacy Modes**: Implemented fine-grained visibility rules (🔒 Private, 👥 Team, 🏢 Dept, 🏢 Org, 🌐 Public) across the entire Gear Library and custom inventory sheets.
- **Kiosk Mode Terminal**: Rolled out the dedicated `/kiosk` terminal view featuring QR-code scanner triggers and 60-second automatic Firestore-synced PIN rotations.
- **Industry Presets Swapping**: Added quick toggle ribbons to swap equipment nomenclatures across Cinema, Construction, Medical, and General Logistics.

---

### 🚀 Stable Release: v3.2.0 (AI Cargo Advisory & Dukey Assistant Upgrade)
- **Gemini API Integration**: Leveraged the `@google/genai` SDK on secure server-side proxy routes to analyze storage list payloads.
- **Cargo Recommendation Cards**: Exposed actionable warnings during package allocation concerning heavy cargo payloads, dangerous materials, and safety requirements.
- **Dukey Assistant Core**: Programmed automated descriptive copy generators resolving empty item specifications.

---

### 🚀 Stable Release: v3.1.0 (Encrypted DB Schema & Whitelisting)
- **DB Schema Spec v3.1.2**: Migrated database structures to enforce encrypted metadata constraints, preventing third-party listing exposure.
- **Secured API Access**: Built standard JWT validation pipelines ensuring whitelisted endpoint validation.

---

### 🚀 Stable Release: v3.0.0 (Escrow Hires & Public Listings)
- **Rental Marketplace Core**: Added support for escrow payment tracking, hourly hire planners, and schedule validation engines.
- **In-App Booking Forms**: Introduced modal rental calendar forms calculating booking fees and security deposits on-the-fly.

---

### 🚀 Stable Release: v2.4.0 (Stable Core Optimization)
- **Platform Build v2.4.9**: Greatly enhanced Firestore query performance by introducing responsive caching layers and localized snapshot synchronization.
- **Cascade Cascading Selectors**: Handled multi-select associations dynamically cascading across Organization → Department → Team selectors.

---

### 🚀 Stable Release: v2.3.0 (Asset Barcode & QR Label Sheets)
- **Dynamic Dimension Presets**: Loaded physical template selectors for Dymo 30334, Brother TZe tape rolls, and standard Avery A4 sheets inside the label printer panel.
- **Custom Scale Parameters**: Allowed operators to define manual width/height scaling grids to match non-standard labels.

---

### 🚀 Stable Release: v2.2.0 (Physical Shelf Racks & Storage Coordinates)
- **Shelf Mapping Visualizers**: Created a physical shelving grid component allowing warehouse operators to plot exact shelf bays (e.g., Aisle 2, Row B, Tray 4).
- **Interactive Spot Highlights**: Linked inventory list components to coordinates, accelerating physical item retrieval.

---

### 🚀 Stable Release: v2.1.0 (Supply Chain & Lead-Time Analytics)
- **Lead-Time Estimator Algorithms**: Built reactive calculations flagging custom list elements that exceed standard shipping timeframes.
- **Inventory Stock Alarms**: Added low physical stock warnings identifying gear shortages.

---

### 🚀 Stable Release: v2.0.0 (Departmental Custom Sheeting)
- **Custom Inventory Lists**: Deployed isolated, user-owned non-synchronized lists alongside the primary Gear library catalog.
- **Spreadsheet AI Importers**: Embedded structured text-parsers matching uploaded spreadsheet rows to standardized schema attributes.

---

### 🚀 Stable Release: v1.3.0 (Recipient Contact Syncing)
- **Shared Direct Links**: Allowed users to generate secure, readable marketplace links to send to external recipients.
- **Recipient Directories**: Designed an isolated contact workbook in Firebase tracking client contact details and phone references.

---

### 🚀 Stable Release: v1.2.0 (AI Scraper Engine Core)
- **AI Scraper Engine v1.2.6**: Connected the platform to server-side AI extractors to fetch item brand, weight, and model data.

---

### 🚀 Stable Release: v1.1.0 (Multi-Tenant Schema Migration)
- **Metadata Extension**: Migrated Firestore records to include dedicated security tags tracking organizational ownership.

---

### 🚀 Stable Release: v1.0.0 (Initial Cloud Run Container Deployment)
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
