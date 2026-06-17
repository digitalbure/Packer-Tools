# Agent Instructions: Packer Tools Asset & Inventory Management

This file contains guides and code constraints for future AI coding agents maintaining the **Packer Tools** workspace. It ensures database schemas, bulk assignment patterns, and Audit mode conditions remain synchronized.

---

## 📦 What is Packer Tools?
**Packer Tools** is a highly specialized, multi-industry Asset & Inventory Management and Gear Logistics platform. It is engineered to build, track, assign, and audit high-volume equipment setups across various corporate and technical domains, including:
- **General Logistics & Operations** (Default cargo/warehouse tracking)
- **Film & Production** (Cameras, lenses, light kits, sound boards)
- **Construction & Rigging** (Heavy tooling, safety harnesses, drills)
- **Automotive & Mechanics** (Pneumatic lifts, diagnostic meters, wrenches)
- **Sports & Athletic Teams** (Training gear, roster jerseys, protective kits)
- **Medical & Field Equipment** (Diagnostic bags, PPE, ventilators)

Its core features encompass multi-tenant organizational structure (Workspaces, Departments, Teams, and Members), primary inventory checklists or logs, a standalone **Kiosk Mode** (featuring signature canvases for secure check-ins/outs), a custom **Systems Builder** canvas for visual setup modeling, a custom workspace **Marketplace**, and custom **System Health telemetry** grids for administrator oversight.

---

## 🛠️ Preferred Tech Stack
The platform follows a premium, performance-oriented full-stack layout built on:

### 1. Frontend Framework & Tooling:
- **Core**: React 18+ paired with TypeScript for tight compile-time safety and type validation.
- **Build Server**: Vite as the asset pipeline and rapid bundler.
- **Styling**: Tailwind CSS utility classes following a high-contrast premium layout (soft off-whites and dark charcoal grays).
- **Animations**: Fluid, motion-driven route transitions using `motion` (imported strictly from `motion/react`).
- **Icons**: Standardized vector iconography imported exclusively from `lucide-react`. Custom inline SVG overlays are prohibited.

### 2. Backend & Persistence:
- **Cloud Database**: Google Cloud Firestore, providing server-synchronized offline persistence, real-time live observers (`onSnapshot`), and fast document reads.
- **Identity & Access**: Firebase Authentication for managed corporate logins and Google Workspace single sign-on (SSO) integration.
- **Custom Backend**: A light Node/Express custom server (`server.ts`) running on target port `3000`. In development, it proxies requests and mounts the Vite middleware; in production, it compiles down to a single bundled Node CommonJS file (`dist/server.cjs`) to guarantee reliable launch in container entry points.

### 3. Progressive Web App (PWA):
- Built-in offline support via a custom service worker (`src/sw.ts`) and `vite-plugin-pwa` to cache templates, workspace lists, and inventory sheets.

---

## ⚠️ Critical Things to Watch For (Architectural & Runtime Gotchas)

### 1. PWA Hydration & Lazy Loading:
- **Avoid Dev-Server White Screens**: The live development server operates with Hot Module Replacement (HMR) programmatically disabled (`DISABLE_HMR=true`). Service worker registrations MUST be restricted strictly to production environments (`import.meta.env.PROD`). Standard development loads must bypass service-worker interference to prevent caching of dynamic imports.
- **Lazy Page Imports**: Core pages (e.g., `KioskMode`, `AdminPanel`) are heavily detailed. Always load major modules using React's `lazy` wrapper to prevent overwhelming the client bundle size on startup.

### 2. Multi-Industry Jargon & `useIndustry()`:
- Never hardcode user labels such as "Gear", "Items", "Checklist", or "Roster" in common UI headers/components. Always retrieve appropriate industry-adjusted singular and plural nouns from the central `useIndustry()` React context (`getAdjustedLabel()`).

### 3. API Key & Security Proxies:
- Sensitive integrations (such as Google Corporate Chat Spaces & Webhooks) must **never** leak API keys, access secrets, or runtime environment variables to the browser. Proxy those requests securely through the Express API routes (`/api/*`) on the server.

---

## 🗄️ Database Fields & Type Alignments

The following types are declared in `/src/types.ts` and used across `/src/pages/GearLibrary.tsx` and `/src/pages/InventoryModule.tsx`:

### `GearItem` & `InventoryItem` Extensibility:
Ensure any custom items or gear items maintain standard fields:
- `orgId?: string` (references `organizations.id`)
- `deptId?: string` (references `departments.id`)
- `teamId?: string` (references `teams.id`)
- `assignedTo?: string` (references `users.uid` or sub-team member list)
- `currentHolder?: string` (the display name of the user currently holding the checked-out gear)
- `lastMaintenanceDate?: string` (format: `YYYY-MM-DD` date)
- `maintenanceIntervalDays?: number` (number of days between recurring maintenance)

---

## 🏗️ Bulk Assignment Implementation Patterns

### 1. Primary Gear Library (`/src/pages/GearLibrary.tsx`)
- **State selection:** `selectedItems: Set<string>`
- **Database Collection:** `collection(db, 'gear')`
- **Component Modal:** `isBatchAssignModalOpen` toggles the multi-select batch panel. Batch changes are executed using a Firestore `writeBatch(db)` directly.

### 2. Custom Inventory Module (`/src/pages/InventoryModule.tsx`)
- **State selection:** `selectedInventoryItems: Set<string>`
- **Database Collection:** Nested items inside custom sheets: `collection(db, 'inventories', selectedInventory.id, 'items')`
- **Method Handler:** `handleInventoryBulkAssign` runs on the selected sub-group. Updates fields dynamically via `batch.update()`.

---

## 🔎 Audit Mode Logic Definitions

We have shared helper logic written in both `/src/pages/GearLibrary.tsx` and `/src/pages/InventoryModule.tsx`. When editing or extending these components, ensure that:

1. **Outdated Maintenance Calculation:**
   ```typescript
   const isMaintenanceOutdated = (item: GearItem | InventoryItem) => {
     if (item.status === 'maintenance') return true;
     if (item.condition === 'poor') return true;
     if (item.maintenanceIntervalDays && item.maintenanceIntervalDays > 0) {
       if (!item.lastMaintenanceDate) return true;
       try {
         const last = new Date(item.lastMaintenanceDate).getTime();
         const nextDue = last + (item.maintenanceIntervalDays * 24 * 60 * 60 * 1000);
         return nextDue < Date.now();
       } catch {
         return true;
       }
     }
     return false;
   };
   ```

2. **Low Stock Detection:**
   ```typescript
   const isLowInventory = (item: GearItem | InventoryItem) => {
     const qty = item.quantity !== undefined ? item.quantity : 1;
     return qty <= 1;
   };
   ```

3. **Status Render Requirements:**
   - Active status check: If `item.status === 'in_use'`, indicate that the item is "Unavailable / Checked Out" or "OUT". Show `item.currentHolder` if populated.

---

## ⚡ Firestore Batch Processing Guidelines

To ensure the system scales comfortably to millions of items, all AI agents and developers **MUST** observe the following database constraints:

1. **Max Operation Limits**: Firestore has a strict limit of **500 operations per `WriteBatch`**.
2. **Mandatory Chunking**: Never write code that aggregates items into a single `.commit()` block if the count of selected items can exceed 500 (or 250 for heavier compound operations). Always use a loop-based partitioning pattern:
   ```typescript
   const ids = Array.from(selectedItems);
   for (let i = 0; i < ids.length; i += 500) {
     const chunk = ids.slice(i, i + 500);
     const batch = writeBatch(db);
     chunk.forEach(id => {
       // logic...
     });
     await batch.commit();
   }
   ```
3. **Low-Overhead Counting**: Never use `getDocs` list queries when of checking database limits (pricing tiers, user counts, visual analytics). Always call `getCountFromServer(query)` to minimize infrastructure costs and prevent memory leaks.

---

## ⚙️ Workspace Setup Calibration & presets

To enable rapid adaptation to various industries and densities, Packer Tools includes a multi-step **Config Onboarder** and a custom **Workspace Setup** preset system.

### 1. Dynamic Features Flagging (`disabledFeatures` array)
Visible features are managed reactively across the sidebar navigation and dashboard components using the `isFeatureEnabled` utility, referencing `user.disabledFeatures`.

### 2. Built-in Layout Presets
- **Packing Setup** (`packing`): Toggles focus exclusively onto smart packing checklists, case organizer grids, and container checklists.
- **Inventory Setup** (`inventory`): Toggles focus exclusively onto master items inventory, repairs & maintenance, and vendor CRM templates.
- **Tagging & Barcode Setup** (`tagging`): Toggles focus exclusively onto barcode layout printing sheets and scanner inspection tasks.
- **Max Setup** (`max`): Enables full access for all modules and widgets.

### 3. Custom Presets Button Synthesis
Users can save custom feature sets as dynamic tab triggers in `/src/components/QuickActionsDrawer.tsx` under the **Workspace Setup** tab.
These custom calibration structures are stored as:
`customPresets: { id: string, name: string, disabledFeatures: FeatureKey[] }[]`
under the central `users/{uid}` database profile document. Adding, applying, or deleting custom layout presets instantly syncs across the browser dynamically via the existing `onSnapshot` real-time listener.
