# 📘 Packer Tools Knowledge Base

Welcome to the **Packer Tools** Knowledge Base! This document provides detailed, step-by-step guides on how to use advanced operations in the platform, including the latest asset organization, bulk allocation, and audit workflows.

---

## 📁 1. Bulk Assigning Assets to Organizations, Departments, or Teams

Packer Tools allows you to batch-update and assign organizational structures and member custody to multiple items at once. This works for both the **Primary Gear Library Assets** and individual **Custom Departmental Inventory Lists**.

### 💼 Option A: For Primary Gear Library Assets
Use this workflow to re-assign primary equipment, tools, and visual camera/production gear in the main **Gear Library**.

#### Step-by-by Workflow:
1. **Enter Gear Library:** Go to the main **Gear Library** screen.
2. **Select Multiple Items:** 
   - Check the custom bubble or checkbox on the upper-left corner of the item cards (in Grid or Compact views), or use the leftmost checkbox rows in the Table list view.
   - You will see a black floating **Smart Batch Action Bar** slide up from the bottom of the page showing the count of selected items (e.g., `Selected: 3 items`).
3. **Open the Batch Panel:** Click the 🛠️ **"Batch Assign Details"** button on the floating control bar.
4. **Choose Target Allocation:** 
   - Select the target **Organization** from the dropdown menu.
   - Once selected, the **Department** dropdown filters automatically; select the sub-department.
   - Once a department is selected, choose the specific sub-team or individual **Member** to assign custody or ownership.
5. **Confirm and Save:** Click **"Apply Changes to X selected assets"**. The system executes a bulk database transaction, instantly updating all targeted assets!

---

### 📋 Option B: For Custom Inventory Listings (Multi-Department Lists Section)
Use this workflow to organize and batch-align custom spreadsheet imports or specific list components in the **Multi-Department Lists** workspace within the **Inventory Module**.

#### Step-by-by Workflow:
1. **Navigate to Inventory Module:** Click the **Inventory** link in the header/main menu and choose the **"Multi-Department Lists"** tab.
2. **Select Custom Assets:** Select your custom inventory list, then click the checkboxes on the left side of the table list rows, grid cards, or compact items.
3. **Open Bulk Assignment Map:** Click the 🛡️ **"Assign Batch"** button in the upper toolbar header next to the bulk delete controls.
4. **Input Designated Groupings:** 
   - A modal titled **"Bulk Assignment Mapping"** will pop up showing the count of custom elements selected.
   - Choose the target **Organization** and optional **Department**, **Team**, and **Member** assignments.
5. **Commit Changes:** Click **"Save Allocations"**. All selected assets inherit those visibility permissions and telemetry targets securely.

---

## 🔍 2. Using Audit Mode to Spot Inventory Issues
In both the main **Gear Library** and **Multi-Department Lists**, you can activate **Audit Mode** to visually flag assets requiring immediate attention.

### Key Flags Identified in Audit Mode:
- ⚠️ **Maintenance required / overdue:** Triggers if an item's status is `'maintenance'`, condition is `'poor'`, or if its `lastMaintenanceDate` plus `maintenanceIntervalDays` exceeds the current date.
- 📉 **Low Stock warnings:** Triggers if an asset's owned quantity matches or drops below `1` unit.
- 🔴 **Checked Out / In-Use indicators:** Visually shows items currently deployed in active production shoots or rentals.

### How to use Audit Mode:
1. Click the 🛡️ **"Audit Mode"** button in the main header or list actions bar.
2. The UI will instantly apply highlight rings (amber/red) around items that need attention.
3. You can check **"Only show attention items"** inside the warning banner to hide healthy items and focus entirely on rectifying low stock or overdue schedules.

---

## 📥 3. Connecting Custodians to Assets
When an asset is assigned to a specific **Member**, they are designated as the custodian. If the asset status is marked as `'in_use'`, the borrower's name displays across list views, letting coordinators see at a glance who holds checked-out items.
