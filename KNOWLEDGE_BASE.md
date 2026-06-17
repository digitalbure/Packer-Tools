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

## 📁 1.2. Select Mode and Multi-Asset Bulk Operations (v4.7.0)

To support rapid warehouse operations, physical audits, and logistics coordination, Packer Tools features a dedicated **Select Mode**. This mode streamlines selecting multiple items at once to perform coordinated batch updates.

### ⚙️ How to Activate and Use Select Mode:
1. **Toggle Select Mode:** Click the 🔘 **"Select Mode"** button in the main configuration bar of your Gear Library workspace.
2. **Interactive Multi-Selection:** Checkboxes will appear on all assets in Grid, Compact, and mobile List representations. Tap any item's card or row to add it to your batch selection. All selected items will receive high-contrast blue selection rings.
3. **Smart Floating Action Bar:** Once items are selected, the action bar emerges at the bottom of your screen tracking exact counts.
4. **Trigger Bulk Operations:** Use the dedicated action triggers on this bar:
   - 📦 **Pack:** Bundle selected assets for transport or checklists.
   - 🥞 **Bundle / Kit:** Combine elements into a logical or permanent hardware kit.
   - 📥 **Export:** Instantly export selected assets' metadata to CSV files.
   - 🎨 **Assign Batch:** Reassign organization, department, department team, or individual custody tags.
   - 🖨️ **Move to Rack:** Deploy the selected items directly into a physical warehouse shelf location or AV tray.
   - 🛠️ **Change Status:** Batch-transition states to Available, In Use, Maintenance, Retired, or Missing.
   - 🗑️ **Delete:** Permanently remove selected items from your master database using a unified transactional Firestore batch operation.

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

---

## 🎨 4. Public Brand Shopfronts & Regional Currencies Settings (v4.10.0)

Packer Tools offers advanced customization options for rental marketplace operators and gear hire companies looking to build a professional public presence.

### 🏢 Setting up your Public Shopfront
Authorized operators can deploy a high-fidelity, independent public brand storefront accessible at `#/shop/:uid`. 

#### Step-by-Step Brand Configuration:
1. **Navigate to Brand Settings:** Open your main **Profile Page** (`#/profile`) and scroll to the **Public Shopfront & Brand Settings** card.
2. **Branding Assets Input:**
   - Define your **Store Name** (e.g., *Sulu-Light Cinema Fiji*) and biography overview.
   - Insert URLs for **Logo/Profile Image** and a high-resolution **Cover Banner**.
   - Input your customer support connections (Store Email, Phone number, and Website partner link).
3. **Link Social Handles:** Connect your professional social channels including Twitter, Instagram, LinkedIn, and Facebook profiles.
4. **Publish Store:** Click **Save Store Settings**. Your public link is immediately compiled at the top of the panel via the **"View Live Store"** shortcut.

### 🪙 Configuring the Global Marketplace Currency
To maintain flawless rate synchronization across multi-national hire markets, administrators can configure the default workspace currency:
1. **Navigate to Admin Control:** Go to the **Admin Panel** (`#/admin`) and choose the **Settings** / **Global Configurations** layout.
2. **Choose Default Currency:** Locate the **"Default Marketplace Currency"** dropdown selector inside the Regions configuration column.
3. **Select Active Code:** Toggle between **USD**, **FJD** (Fijian Dollar), **AUD** (Australian Dollar), **NZD** (New Zealand Dollar), **GBP** (British Pound), **CAD** (Canadian Dollar), or **EUR** (Euro).
4. **Instant Synchronization:** Clicking submit updates pricing displays, marketplace cards, Bio view lists, and public checkouts dynamically across the entire organization.

### 🔒 Marketplace Listing Permissions
To post items or complete escrow hires, users must be associated with the appropriate subscription pricing plan. If an operator's workspace is on the **Free Tier**, clicking the listings editor dynamically prompts an **Upgrade Blockout Wall** preventing unauthorized publications until subscription standards are cleared.

---

## 🎨 5. Personalizing Workspace Layout & Preferences (v4.8.0)

Packer Tools allows detailed control over how the application is presented on your specific account, providing a personalized experience optimized for your hardware and daily operational task load.

### 🎛️ Modifying Dashboard Columns & Widgets
You can choose to preserve real-estate by only rendering panels critical to your workflows:
1. **Open User Settings:** Navigate to your **Profile Page** (`#/profile`).
2. **Scroll to Dash Layout Builder:** Scroll down to the **Custom Dashboard Column & Widget Builder** card.
3. **Toggle Active Widgets:** Switch the state indicators to enable/disable specific elements:
   - *Performance Metric Cards:* Show/hide total kit valuations and stock summary counts.
   - *Deployments Chart:* Toggle the visual bar diagram illustrating asset weight distributions.
   - *Maintenance Schedules:* Toggle countdown reminders indicating overdue visual checks.
   - *Recent Lists:* Toggle the list registry card containing latest packing lists.
   - *Kiosk Mode Terminal:* Toggle tablet connection QR tags.
   - *Safety Console & Fleet Dispatch:* Control heavy industrial and vehicle compliance check cards.
4. Toggling automatically persists settings to the Firestore cloud database instantly.

### ⚡ Customizing Rapid Action Triggers
By default, the Dashboard renders various action shortcut creation buttons. You can refine this:
1. Under **Visible Quick Actions Buttons**, simply select/uncheck specific trigger elements.
2. Unchecked actions (such as `+ inventory` or `+ tech rack`) are dynamically hidden from your landing page, allowing a simpler, clutter-free action hub layout.

### 📐 Navigating with Starters sidebar drawer
For secondary or supplementary modules, users can clean up their main sidebar navigation:
1. Scroll down to the **Workspace Starters Settings** on the layout settings page.
2. Toggling on a module moves it to the **Starters** group in the sidebar, removing it from the main left navigation view for clutter clearance.

### 📐 Booting with Collapsed Navigation Sidebar
For operators functioning on lower-resolution tablets, laptop terminals, or portable visual carts:
1. Locate the **Default Navigation Sidebar Width** selector in your configuration cards.
2. Toggle **Start Sidebar Collapsed** to **ON**.
3. During future app opens or system cold-boots, the sidebar will initialize in its collapsed state, affording maximum layout width from the very first rendering frame.

---

## 🐞 6. System Settings & Bug Reports Finder (v4.9.0)

Administrator accounts now access a unified Bug Reports Finder directly situated within the core System Settings dashboard.
1. **Real-time Diagnostic Badges:** Unresolved beta-testing requests (unresolved status tags like `open` or `in_review`) trigger an immediate red glowing alert glow on the settings panel navigation item.
2. **Full Resolution Controls:** Allows admins to track incoming browser layouts, analyze tester diagnostics, append resolution messages, and update status logs returning live progress notifications to clients instantly.

---

## 🌐 7. Production Custom Domain Mapping & Routing (v4.10.0)

We have mapped the official **`packer.tools`** domain directly to our scalable Google Cloud Run container architecture.
1. **Routing Synchronization:** All iframe embed generators, developer sandbox REST toolcodes, and platform reference links resolve directly to `https://packer.tools`.
2. **Authentication Integrations:** Federated security headers have been synchronized to whitelist the production address, securing OAuth redirects and public store bio checkout widgets flawlessly.


