# 🚀 Release Information & Production Build Guide

## Current Application Version: `v5.10.0`
**Status:** Stable Production Release  
**Environment:** GCP Cloud Run Container (Vite Node Proxy)  
**Database/Backend:** Google Firestore + Firebase Authentication

This document provides complete instructions on how to build, run, and tag this repository for production deployment or continuous integration. 

---

## 📦 Complete Stable Release & Version History

Below is the consolidated history of Packer Tools, tracing all production rollouts back to the original container deployment.

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
