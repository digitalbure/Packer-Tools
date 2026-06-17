# Agent Instructions: Packer Tools Asset & Inventory Management

This file contains guides and code constraints for future AI coding agents maintaining the **Packer Tools** workspace. It ensures database schemas, bulk assignment patterns, and Audit mode conditions remain synchronized.

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

