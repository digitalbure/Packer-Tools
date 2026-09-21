import type { FeatureKey } from '../../types';

/** All landing copy lives here. Every capability named below exists in the app today (see docs/landing-design.md). */

export const PROBLEMS: { note: string; fix: string; tilt: number }[] = [
  { note: 'Second charger stayed in the truck.', fix: 'Packing lists tick items off one by one, so the gap shows before the truck leaves.', tilt: -2 },
  { note: 'Who has the wireless receiver??', fix: 'Every check-out records who took it, when, and their signature. Anyone can look it up.', tilt: 1.5 },
  { note: 'Lens came back cracked. Who had it?', fix: 'Condition and history live on the item, so the last holder is on record.', tilt: -1 },
  { note: 'Customs wants a carnet list. We have three spreadsheets.', fix: 'Turn any packing list into an ATA carnet manifest, ready to print.', tilt: 2 },
  { note: 'How old is battery number four?', fix: 'Batteries get their own lifecycle log: charge cycles, health and retirement.', tilt: -1.5 },
  { note: 'Half the kit is on the other site.', fix: 'Keep a separate depot for each store room or site, and move kit between them with a record.', tilt: 1 },
];

export interface ModuleDef { name: string; text: string; feature?: FeatureKey }
export const MODULE_GROUPS: { title: string; modules: ModuleDef[] }[] = [
  {
    title: 'Know what you own',
    modules: [
      { name: 'Gear library', feature: 'gearLibrary', text: 'Every item with photos, serials, condition and maintenance dates. Run separate depots for each store room or site.' },
      { name: 'Inventory sheets', feature: 'inventoryManagement', text: 'Custom lists and sub-sheets for departments, consumables and shared stock, assigned to teams.' },
      { name: 'Racks', feature: 'rackingDashboard', text: 'Model a rack build unit by unit and keep it with the kit.' },
      { name: 'Batteries', text: 'Track charge cycles, health and retirement for every battery.' },
      { name: 'Reminders', feature: 'reminders', text: 'Get nudged for maintenance, inspections and overdue returns.' },
    ],
  },
  {
    title: 'Pack it right',
    modules: [
      { name: 'Packing lists and kits', text: 'Lists and reusable master kits with packed, pending and returned status, print sheets and share links.' },
      { name: 'Foam layout designer', feature: 'organizer', text: 'Draw cut-foam layouts in 2D with snapping and alignment, and export them as vector or PNG.' },
      { name: 'Travel cases', feature: 'travelCases', text: 'Pull a case\'s dimensions from a product page and preview how your gear sits inside it.' },
      { name: 'Tooling lists', feature: 'toolingLists', text: 'Tool lists built for a specific job or crew.' },
      { name: 'AI list builder', feature: 'aiWizard', text: 'Describe the job and get a starting list to edit.' },
    ],
  },
  {
    title: 'Move it and track it',
    modules: [
      { name: 'Kiosk', feature: 'kioskMode', text: 'Tablet check-out and return with signatures, emailed receipts and an order mode.' },
      { name: 'Scanning', text: 'Camera scanning for QR codes, Code 128 and 39, EAN, UPC, Data Matrix and Aztec, and NFC where the device supports it.' },
      { name: 'RFID tracking', feature: 'rfidTracking', text: 'Read RFID tags for fast sweeps of a room or a case.' },
      { name: 'Labels', text: 'Design and print QR code labels for items and cases, on label sheets or by the roll.' },
      { name: 'Asset transfer', text: 'Hand kit from one person, team or depot to another, with a record.' },
      { name: 'Logistics dashboard', feature: 'logisticsDashboard', text: 'See what is out, what is due back and what is on the move.' },
      { name: 'Customs and print manifests', text: 'ATA carnet manifests, print sheets and CSV exports.' },
    ],
  },
  {
    title: 'Run the business',
    modules: [
      { name: 'Projects and costs', feature: 'projectCost', text: 'Tie kit to a job and track what the job costs.' },
      { name: 'Suppliers and BOM', feature: 'supplierManagement', text: 'Keep supplier details and bills of materials next to the kit.' },
      { name: 'Rentals and marketplace', feature: 'marketplace', text: 'Publish a shopfront or list kit for rent.' },
      { name: 'Digital signatures', feature: 'digitalSignatures', text: 'Capture signatures at hand-over and on rental agreements.' },
    ],
  },
  {
    title: 'Organise the team',
    modules: [
      { name: 'Organizations, departments and teams', feature: 'orgManagement', text: 'Structure the workspace like your business and assign custodians to items.' },
      { name: 'Team alerts', text: 'Send check-out and return alerts to Google Chat.' },
      { name: 'Claude connector', text: 'Ask Claude about your kit in plain language, with access you approve and can remove.' },
    ],
  },
];

export const INDUSTRIES: { name: string; kit: string[]; wrong: string; fix: string }[] = [
  {
    name: 'Film and broadcast',
    kit: ['Camera bodies', 'Lenses', 'Wireless mics', 'Monitors', 'Batteries', 'Light kits'],
    wrong: 'Kit is split across trucks and shoots, and one missing battery stops the day.',
    fix: 'Pack each case from a list, tag every item, and sign gear out to whoever takes it. Print the carnet list when the job goes abroad.',
  },
  {
    name: 'Events and AV',
    kit: ['Racks', 'Cable looms', 'Speakers', 'Lighting', 'Flight cases'],
    wrong: 'What goes out at load-in is not what comes back at load-out, and nobody knows which case has the spare.',
    fix: 'Case layouts and rack models show what belongs where. Scan everything out and back in, and see what is missing before the truck leaves.',
  },
  {
    name: 'Rental houses',
    kit: ['Cameras', 'Lenses', 'Audio', 'Lighting', 'Support'],
    wrong: 'Queues at the counter, forgotten signatures, and arguments about the condition.',
    fix: 'A kiosk at the counter takes name, signature and return date. Condition sits on each item, and receipts go out on their own.',
  },
  {
    name: 'Rigging and construction',
    kit: ['Harnesses', 'Drills', 'Rigging hardware', 'Meters'],
    wrong: 'Tools walk off, and inspection dates slip.',
    fix: 'Set an inspection interval per item, get reminders when one is due, and see who holds each tool.',
  },
  {
    name: 'Sports and teams',
    kit: ['Training gear', 'Jerseys', 'Protective kit'],
    wrong: 'Kit issued at the start of the season does not all come back.',
    fix: 'Issue kit to a person, see it on their record, and check it in at the end.',
  },
  {
    name: 'Medical and field teams',
    kit: ['Diagnostic bags', 'PPE', 'Monitors'],
    wrong: 'A bag goes out missing one item and nobody finds out until it is needed.',
    fix: 'A packing list per bag, scanned out and back in, with maintenance dates on each device.',
  },
];

export const VERSUS: [string, string, string][] = [
  ['Where an item is right now', 'Scroll, then ask in the chat.', 'On the item: in a case, in a depot, or with a named person.'],
  ['Who signed for it', 'Someone remembers.', 'Name, time and signature at every hand-over.'],
  ['Finding an item', 'Ctrl+F and hope the names match.', 'Scan the tag, or search by name, tag or serial number.'],
  ['What is missing before you leave', 'Read the list twice.', 'The packing list shows what is packed and what is not.'],
  ['Condition and repairs', 'A note in a cell.', 'History on the item: condition, maintenance and incidents.'],
  ['Customs paperwork', 'Retype it.', 'Print an ATA carnet manifest from the list.'],
  ['No signal', 'Works until it stops syncing.', 'Check-outs queue on the device and sync when it reconnects.'],
];

export const KIOSK_POINTS = [
  'Scan a QR code or barcode, or search by name.',
  'Capture a name, email, signature and expected return date.',
  'Email a receipt to the borrower.',
  'Keep working with no signal. Check-outs sync when the tablet is back online.',
  'Or switch to order mode: people request kit, staff release it.',
  'Revoke a kiosk from your dashboard whenever you need to.',
];
