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

---

## 🕶️ Onboarding Kits & "In-The-Box" Ancillaries Constraints

To enforce data structural discipline when representing high-value cameras with supplied standard components (lens caps, power batteries, strapping, and cases), agents must observe the custom `addOns` schema definitions:

### 1. Unified Sub-item Typing:
The collection of bundled in-the-box items are nested under the primary camera record in a custom list array (`addOns`). The sub-items conform strictly to the following parameters inside `src/types.ts`:
```typescript
addOns?: {
  itemId?: string;
  name: string;
  price: number; // For free in-the-box items, this must default to 0
  useDefaultPrice?: boolean;
  type?: 'Accessory' | 'Consumable' | 'Attachment' | 'Add On' | 'Software' | 'Mod' | 'Other';
  notes?: string; // Optional detailed specification constraints (e.g. "SD-Card Speed")
}[];
```

### 2. Operational Rules:
- **Zero Costing Safeguard**: Factory-supplied inclusions must register with price: `0`. This keeps standard asset list calculations aligned.
- **Dynamic Kit Conversion**: If designated as a Kit (`isKit`), other system pages inside the client terminal (such as `PackingListDetail`) automatically copy and display these nested `addOns` as checked option components inside active dispatch logs.

---

## 📥 Bulk Upload & Automated Quantity Decompose / Tracking Modes

To handle high-volume setups smoothly while guaranteeing granular serialized control:

### 1. Quantity Auto-Detection:
- When a spreadsheet is imported, the platform's local fuzzy mapping engine automatically attempts to recognize the `quantity` columns alongside identity, make, and category headers.

### 2. High-Value Decompose Flags & Individual Mode Transition:
- Duplicate assets with quantities greater than 1 (represented as single bulk lines) are flagged upon import mapping.
- Administrators can opt to trigger **Decompose** mode, which replaces a single bulk line with multiple unique, separate instances (e.g., appending numeric `[#1]`, `[#2]` tags and appending incremented UIDs or auto-generated serial prefixes).
- Decomposed items automatically leverage `trackingMode: 'individual'` for precise lifecycle monitoring, barcode printing, and unique maintenance schedules, whereas batch-imported lines keep `trackingMode: 'batch'` with the aggregate counter.

---

## 🏷️ Label Studio & Printing Engine Architecture (`/src/components/QRPrintModal.tsx` & `/src/utils/labelDownload.ts`)

To ensure ultra-crisp physical barcode scanning and flexible asset tagging across mobile and desktop workflows:

### 1. Vector QR & Barcode Rendering Engine:
- All QR elements are rendered using `<QRCodeSVG>` vector graphics both in live studio viewports and inside silent iframe print roots.
- Vector QR codes bypass canvas raster blur and guarantee high contrast, zero-bleed scannability on thermal label printers (e.g. Dymo, Zebra, Brother).

### 2. Canvas Undo / Redo History Stack:
- Interactive layout modifications maintain state snapshots via `undoStack` and `redoStack`.
- Global keyboard shortcuts (`Cmd+Z` / `Ctrl+Z` for Undo, `Cmd+Shift+Z` / `Ctrl+Y` for Redo) and top toolbar buttons trigger state restoration.

### 3. Floating Context Menu (Right-Click & Touch Long-Press):
- Desktop right-click (`onContextMenu`) and touch long-press (450ms press threshold with haptic vibration feedback) open a floating dark glass context menu.
- Provides context-aware actions:
  - **Element Actions**: Edit Properties, Duplicate, Bring to Front, Send to Back, Center on Canvas, Delete, and Direct Download.
  - **Canvas Actions**: Add Text Box, Add QR Code, Add Shape, Undo, Redo, Save as PNG, Save as JPG, Save as Printable PDF, Save as Vector SVG, and Download Options & Batch.

### 4. High-DPI Export & Downloading Utility (`/src/utils/labelDownload.ts`):
- Powered by `html-to-image` and `jsPDF`.
- Supports PNG, JPG, PDF, and SVG formats with physical mm scale conversion (3.78px per mm) and resolution scales from 1x (72 DPI) to 4x (600 DPI).
- Supports transparent PNG outputs and multi-label batch PDF generation for bulk asset tags.

### 5. Asset Navigator & QR Label Library Drawer (`isAssetDrawerOpen`):
- Replaces cramped bottom preview bindings with a full modal drawer overlay featuring instant multi-field fuzzy search (Name, Tag, Brand, Model, Serial, Category) and Category/Status filter pills.
- Supports both Card Grid and Compact List views.
- Provides one-click **"Live Preview"** canvas binding and **"Queue for Label Printing"** multi-select options with haptic feedback.

### 6. Expanded Live Preview Context Dock & Native Mobile UX:
- **Desktop Dock**: Features an active asset card, horizontal fast-switcher carousel, and an expansion button (`isDockExpanded`) to reveal a multi-row asset grid directly beneath the canvas.
- **Native Mobile Experience**: Features touch-optimized bottom sheets with tactile drag handles, sticky mobile search inputs, swipeable category chips, and floating mobile CTA action bars.

---

## 🔁 Intelligent Asset Duplication Engine (`/src/utils/duplicateUtils.ts` & `/src/components/DuplicateItemModal.tsx`)

To support multi-item equipment setups where users purchase or register multiple similar assets:
1. **Intelligent Name & Asset Tag Sequence Generation**:
   - Detects existing numeric suffix patterns (`[#N]` or `(Copy N)`) and increments them automatically (e.g. `Sony FX3 [#1]` -> `Sony FX3 [#2]`).
   - Ensures asset tags (`assetTag`) remain strictly unique by auto-generating incremented suffixes or sequence formats.
2. **Duplication Configuration Modal**:
   - Allows setting duplication quantity (1 to 100 copies).
   - Provides options to reset status to `available`, clear serial numbers (`serialNumber`), and customize name/tag template patterns.
   - Live preview panel displays generated names and asset tags before confirmation.
3. **Multi-Select & Bulk Operations**:
   - Integrated into item cards, table rows, compact grids, mobile lists, item detail drawers, and the multi-select floating action bar in `GearLibrary.tsx`.
   - Writes are partitioned into Firestore `WriteBatch` chunks of max 500 items.

---

## 🚪 Kiosk Mode Item Released Gate Workflow (`/src/pages/KioskMode.tsx`)

To prevent unverified checkouts and enforce accountability before gear leaves the depot:
1. **Four-Step Checkout State Machine (`KioskStep`)**:
   - **Step 1 (`scan`/`search`)**: Select items into checkout cart.
   - **Step 2 (`user_details`)**: Assign holder name, email, and expected return date.
   - **Step 3 (`sign`)**: Capture digital authorization signature on canvas. Clicking submit saves signature data to state (`savedSignatureData`) and transitions to `item_released`.
   - **Step 4 (`item_released`)**: The **Item Release Authorization Gate**.
2. **Release Authorization Gate**:
   - Displays accountability record: equipment item manifest, recipient details, and verified signature preview.
   - Prompts for **Release Officer / Inspector Name** verification.
   - Action **"Approve & Release Equipment"**: Executes Firestore status updates (setting items to `in_use` and assigning holder), creates checkout records, triggers notifications, and transitions to the released dispatch banner.
3. **Dispatch & Handover Receipts**:
   - Renders **Equipment Released & Dispatched** confirmation badge with release reference ID and timestamp.
   - Provides 1-click actions: **Packing Slip** modal, **Email Handover Copy**, and **Finish & Close Terminal**.




