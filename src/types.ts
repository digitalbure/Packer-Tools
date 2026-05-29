export type FeatureKey = 'aiWizard' | 'gearLibrary' | 'reminders' | 'versionHistory' | 'branding' | 'qrSharing' | 'toolingLists' | 'organizer' | 'travelCases' | 'logisticsDashboard' | 'movingDashboard' | 'rackingDashboard' | 'marketplace' | 'kioskMode' | 'orgManagement' | 'departments' | 'teams' | 'inventoryManagement' | 'projectCost' | 'supplierManagement' | 'bomManagement' | 'customBarcodes' | 'automaticDepreciation' | 'digitalSignatures' | 'clientPortal' | 'apiIntegrations' | 'weightAnalytics' | 'kioskOrderMode' | 'kioskDirectCheckout';

export type UserRole = 'owner' | 'admin' | 'manager' | 'technician' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  status: 'active' | 'suspended';
  suspendedReason?: string;
  settings: {
    branding: {
      logo?: string;
      primaryColor?: string;
    };
    kioskSettings: {
      requireSignature: boolean;
      allowManualSearch: boolean;
      autoLogoutMinutes: number;
    };
  };
  subscriptionPlan: string;
}

export interface Department {
  id: string;
  orgId: string;
  name: string;
  managerId?: string;
  logoUrl?: string;
}

export interface Team {
  id: string;
  orgId: string;
  deptId: string;
  name: string;
  leadId?: string;
  logoUrl?: string;
}

export interface FeatureToggles {
  [key: string]: boolean;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  annualPrice?: number;
  features: FeatureKey[];
  isDefault?: boolean;
  aiTokenLimit: number; // Monthly requests/tokens
  maxPackingLists: number;
  maxGearItems: number;
  maxRacks: number;
  maxProjects: number;
  maxContacts: number;
  maxOrganizations: number;
  maxDepartments: number;
  maxTeams: number;
  maxInventoryItems: number;
  includedSeats?: number;
  extraSeatCost?: number;
  maxStorageMb?: number;
  maxSuppliers?: number;
  maxBOMItems?: number;
  maxCustomRoles?: number;
  apiAccessEnabled?: boolean;
  customWhiteLabeling?: boolean;
  premiumSupportAccess?: boolean;
  historicalAuditLogs?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isSuperAdmin?: boolean; // Platform Super Admin
  orgId?: string;
  deptId?: string;
  teamId?: string;
  role?: UserRole; // Organization-level role
  plan: string;
  aiTokenUsage?: number;
  bio?: string;
  website?: string;
  location?: string;
  company?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  apiKey?: string;
  enabledFeatures?: FeatureKey[]; // Overrides for specific users
  disabledFeatures?: FeatureKey[]; // Overrides for specific users
  onboardingCompleted?: boolean;
  createdAt: string;
  extraSeats?: number;
  isProfilePublic?: boolean;
  activeMarketplaceCurrencies?: string[]; // Currencies activated for renting equipment in marketplace
  defaultBookingFee?: number; // User custom default booking fee % or amount
  defaultSecurityDeposit?: number; // User custom default fixed security deposit
}

export interface Contact {
  id: string;
  ownerId: string;
  name: string;
  email?: string;
  phone?: string;
  type: 'Personal' | 'Professional' | 'Business';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackingList {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  name: string;
  description?: string;
  items?: any[];
  isTemplate: boolean;
  isPublic?: boolean;
  projectId?: string;
  jobType?: string;
  teachingNotes?: string;
  brandName?: string;
  brandLogo?: string;
  shareToken?: string;
  recipientId?: string;
  recipientName?: string;
  recipientEmail?: string;
  collaboratorIds?: string[];
  collaboratorEmails?: string[];
  transactionType?: 'Personal' | 'Sale' | 'Rental' | 'Gift';
  price?: number;
  currency?: string;
  status?: 'Draft' | 'Active' | 'Sent' | 'Received' | 'Completed';
  marketplaceEnabled?: boolean;
  marketplacePrice?: number;
  marketplaceCurrency?: string;
  marketplaceDetails?: string;
  stage?: 'proposed' | 'actual';
  version?: number;
  customFields?: { [key: string]: string };
  receivedAt?: string;
  bookingFeePercent?: number; // Packing list level booking fee percent override
  securityDeposit?: number; // Packing list level security deposit fixed override
  rentalStatus?: 'awaiting_payment' | 'awaiting_release' | 'released' | 'returned'; // Stage of the hire workflow
  bookingClientSignature?: string; // Digital signature of checking out party
  bookingClientName?: string; // Name of client checking out
  bookingClientEmail?: string; // Email of client checking out
  bookingPaidAt?: string; // Timestamp of cleared payment
  createdAt: string;
  updatedAt: string;
}

export interface Rack {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  totalUnits: number; // e.g., 12 for 12U rack
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GearItem {
  id: string;
  ownerId: string;
  orgId?: string;
  deptId?: string;
  teamId?: string;
  assignedTo?: string; // User ID
  name: string;
  description?: string;
  aiLabel?: string;
  category?: string;
  isKit?: boolean;
  visibility?: 'public' | 'private'; // Public or private visibility for kits/gear
  childItemIds?: string[]; // IDs of items inside this kit
  status?: 'available' | 'in_use' | 'maintenance' | 'retired' | 'missing';
  recoveryEnabled?: boolean;
  recoveryContactName?: string;
  recoveryContactPhone?: string;
  recoveryContactEmail?: string;
  recoveryInstructions?: string;
  weight?: number;
  weightUnit?: 'g' | 'kg' | 'oz' | 'lb';
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  brand?: string;
  model?: string;
  modelNumber?: string;
  serialNumber?: string;
  releaseYear?: string;
  primaryCategory?: string;
  secondaryCategories?: string[];
  purchaseDate?: string;
  price?: number;
  currency?: string;
  condition?: 'new' | 'good' | 'fair' | 'poor';
  lastMaintenanceDate?: string;
  maintenanceIntervalDays?: number;
  usageCount?: number;
  tags?: string[];
  organizationTip?: string;
  photoUrls: string[];
  specs?: any;
  assetTag: string;
  quantity: number;
  isAvailableForRent?: boolean;
  rentalPrice?: number;
  rentalPeriod?: 'day' | 'week' | 'month';
  currentHolder?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Container {
  id: string;
  ownerId: string;
  name: string;
  type: 'toolbox' | 'suitcase' | 'pelican' | 'nanuk' | 'shelf' | 'locker' | 'custom' | 'bag' | 'case';
  model?: string;
  description?: string;
  photoUrls?: string[];
  qrCode?: string;
  packingListId?: string;
  status?: 'storage' | 'transit' | 'deployed' | 'maintenance';
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  weightLimit?: number;
  weightUnit?: 'kg' | 'lb';
  currentWeight?: number;
  locationDetails?: {
    row?: string;
    level?: string;
    bin?: string;
  };
  items: string[]; // GearItem IDs or PackingItem IDs
  createdAt: string;
  updatedAt: string;
}

export interface CaseModel {
  id: string;
  brand: 'Pelican' | 'Nanuk' | 'Other';
  model: string;
  interiorDimensions: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  exteriorDimensions: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  weight: number;
  weightUnit: 'kg' | 'lb';
  url?: string;
}

export interface OrganizerSession {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  containerIds: string[];
  unassignedItemIds: string[];
  status: 'planning' | 'packed' | 'shipped';
  createdAt: string;
  updatedAt: string;
}

export interface PackingItem {
  id: string;
  listId: string;
  name: string;
  photoUrls: string[];
  assetTag: string;
  status: 'pending' | 'packed' | 'returned';
  aiLabel?: string;
  description?: string;
  notes?: string;
  weight?: number;
  weightUnit?: 'g' | 'kg' | 'oz' | 'lb';
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  tags?: string[];
  organizationTip?: string;
  priority?: 'High' | 'Medium' | 'Low';
  order: number;
  gearId?: string; // Reference to the original GearItem in the library
  relatedItemIds?: string[]; // IDs of other PackingItems in the same list
  sourceUrl?: string;
  createdAt: string;
}

export interface RackItem {
  id: string;
  rackId: string;
  name: string;
  photoUrls: string[];
  assetTag: string;
  uPosition: number; // The starting unit position (1-indexed)
  uHeight: number; // How many units it occupies
  depth?: 'shallow' | 'standard' | 'deep';
  weight?: number;
  powerDraw?: number; // Watts
  status: 'installed' | 'removed' | 'maintenance';
  serialNumber?: string;
  purchaseDate?: string;
  notes?: string;
  createdAt: string;
  width?: 'full' | 'half'; // Full (19") or Half rack device
  orientation?: 'left' | 'right'; // If width is half, which side it mounts on
}

export interface BuildItem {
  id: string;
  projectId: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  quantity: number;
  price?: number;
  currency?: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  weight?: number;
  weightUnit?: 'kg' | 'lb';
  type: 'component' | 'loom' | 'peripheral' | 'consumable' | 'fixture' | 'fitting';
  notes?: string;
  parentId?: string; // For grouping items into rigs/racks
  isPushed?: boolean; // Flag if it was moved to main inventory
  pushedGearId?: string; // Link to the newly created GearItem
  technicalSpecs?: {
    ioCount?: string;
    voltage?: string;
    frequency?: string;
    powerConsumption?: string;
    firmware?: string;
    compatibilityNotes?: string;
    [key: string]: any;
  };
  sourceUrl?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  stage?: 'proposed' | 'actual';
  version?: number;
  status: 'planning' | 'active' | 'in_transit' | 'deployed' | 'completed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'production' | 'event' | 'logistics' | 'technical' | 'other';
  orgUnit?: string;
  location?: string;
  listIds: string[]; // References to PackingList IDs
  rackIds?: string[]; // References to Rack IDs
  isBuildMode?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackingListVersion {
  id: string;
  listId: string;
  name: string;
  description?: string;
  items: Omit<PackingItem, 'id'>[]; // Store item data without IDs to avoid conflicts on revert
  createdAt: string;
}

export interface GearItemVersion {
  id: string;
  gearId: string;
  name: string;
  category: string;
  condition: 'new' | 'good' | 'fair' | 'poor';
  photoUrls: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface GearIncident {
  id: string;
  gearId: string;
  type: 'damage' | 'theft' | 'loss' | 'repair' | 'other';
  description: string;
  date: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  createdAt: string;
}

export interface Reminder {
  id: string;
  ownerId: string;
  listId: string;
  itemId?: string;
  itemName?: string;
  type: 'return' | 'pack' | 'maintenance' | 'custom';
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
  createdAt: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags?: string[];
  updatedAt: string;
}

export interface AIConfig {
  enabled: boolean;
  model: string;
  maxTokensPerRequest: number;
  monthlyGlobalLimit: number;
  currentMonthlyUsage: number;
  cachingEnabled: boolean;
  smartPackerName: string; // Custom name for the AI assistant
}

export interface IntegrationConfig {
  apiEnabled: boolean;
  apiKey?: string;
  webhookUrl?: string;
  wordpressEnabled: boolean;
  wordpressUrl?: string;
  wordpressApiKey?: string;
  callbackUrlDev?: string;
  callbackUrlProd?: string;
  paypalClientId?: string;
}

export interface LandingPagePair {
  by: string;
  for: string;
}

export interface LandingPageFeature {
  title: string;
  description: string;
  icon: string; // Lucide icon name
}

export interface LandingPageScenario {
  title: string;
  image: string;
}

export interface LandingPageTestimonial {
  name: string;
  role: string;
  content: string;
  avatar?: string;
}

export interface LandingPageFAQ {
  question: string;
  answer: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface AIRecognitionItem {
  id: string;
  name: string;
  details: string;
  image: string;
  icon: string; // Lucide icon name
}

export interface AIRecognitionConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  items: AIRecognitionItem[];
}

export interface LandingPageContent {
  header: {
    logoText: string;
    links: NavLink[];
  };
  hero: {
    title: string;
    subtitle: string;
    description: string;
    primaryButtonText: string;
    secondaryButtonText: string;
    isEnabled: boolean;
  };
  ticker: {
    title: string;
    pairs: LandingPagePair[];
    isEnabled: boolean;
  };
  features: {
    title: string;
    description: string;
    items: LandingPageFeature[];
    isEnabled: boolean;
  };
  scenarios: {
    title: string;
    subtitle: string;
    items: LandingPageScenario[];
    isEnabled: boolean;
  };
  stats: {
    items: { label: string; value: string }[];
    isEnabled: boolean;
  };
  testimonials: {
    title: string;
    subtitle: string;
    items: LandingPageTestimonial[];
    isEnabled: boolean;
  };
  faq: {
    title: string;
    subtitle: string;
    items: LandingPageFAQ[];
    isEnabled: boolean;
  };
  cta: {
    title: string;
    description: string;
    buttonText: string;
    isEnabled: boolean;
  };
  footer: {
    copyright: string;
    links: NavLink[];
  };
}

export interface Lander {
  id: string;
  name: string;
  content: LandingPageContent;
  createdAt: any;
}

export interface KioskTerminal {
  id: string;
  orgId: string;
  name: string;
  pairingCode: string;
  isActivated: boolean;
  lastActive: any;
  location?: string;
  mode: 'both' | 'checkout' | 'checkin';
}

export interface CheckoutRecord {
  id: string;
  assetId: string;
  assetName: string;
  assetType: 'item' | 'container' | 'kit';
  userId: string;
  userName: string;
  userEmail: string;
  checkOutTime: any;
  checkInTime?: any;
  status: 'active' | 'returned';
  signature?: string; // Base64 signature
  notes?: string;
  location?: string;
}

export interface CustomPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  category: 'legal' | 'policy' | 'info' | 'other';
  status: 'draft' | 'published';
  isVisible: boolean;
  createdAt: any;
  updatedAt: any;
  lastUpdatedBy: string;
}

export interface Terminal {
  id: string;
  pairingCode: string;
  status: 'pending' | 'active';
  ownerUid: string;
  deviceName: string;
  lastActive: string;
  settings: {
    mode: 'both' | 'checkout' | 'checkin';
  };
}

export interface AdminSettings {
  branding: {
    logo?: string;
    primaryColor?: string;
    companyName?: string;
  };
  limits?: {
    maxCheckoutDurationHours?: number;
  };
  frontPageCopy: string;
  landingPage?: LandingPageContent;
  landers?: Lander[];
  activeLanderId?: string;
  activeLandingPageType?: 'main' | 'marketplace';
  billingEnabled: boolean;
  marketplaceVisibility?: 'signed-in' | 'public';
  privacyContent?: string;
  termsContent?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  plans: Plan[];
  globalFeatures: FeatureToggles;
  aiConfig: AIConfig;
  aiRecognitionConfig?: AIRecognitionConfig;
  kioskConfig?: {
    allowManualSearch: boolean;
    showItemStatus: boolean;
    requireSignature: boolean;
    autoLogoutMinutes: number;
    restrictedStatuses?: string[];
    mode?: 'direct' | 'order';
  };
  integrationConfig: IntegrationConfig;
  onboardedCurrencies?: OnboardedCurrency[];
  commissionConfig?: {
    defaultPercentage: number;
    defaultAmount: number;
    strategy: 'percentage' | 'amount' | 'both';
    categoryOverrides?: { [category: string]: { percentage: number; amount: number; strategy: 'percentage' | 'amount' | 'both' } };
    listOverrides?: { [listId: string]: { percentage: number; amount: number; strategy: 'percentage' | 'amount' | 'both' } };
    itemOverrides?: { [itemId: string]: { percentage: number; amount: number; strategy: 'percentage' | 'amount' | 'both' } };
  };
  moduleWidgetConfigs?: {
    projectCost?: {
      defaultMarginTarget: number;
      costAlarmThreshold: number;
      markupStrategy: 'percentage' | 'fixed';
    };
    supplierManagement?: {
      poPrefix: string;
      preferredTerms: string;
      automaticReorder: boolean;
    };
    bomManagement?: {
      minBOMMarkup: number;
      autoDepreciationFactor: number;
      columnsToShow: string[];
    };
    aiWizard?: {
      activeModel: string;
      maxTokens: number;
      confidenceThreshold: number;
    };
    logisticsDashboard?: {
      mileageRate: number;
      transitBufferPercent: number;
      dispatchTimeoutHours: number;
    };
    gearLibrary?: {
      defaultCurrency: string;
      enableDupCheck: boolean;
      defaultCondition: string;
    };
    kioskMode?: {
      sessionTimeoutMinutes: number;
      idleTimerSeconds: number;
      enforceSupervisorApproval: boolean;
    };
  };
}

export interface PaymentGatewayMethod {
  gateway: 'paypal' | 'manual';
  name: string;
  instructions?: string; // For manual gateways e.g. bank deposit details
  paypalClientId?: string; // Optional custom clientId for this gateway/currency
  enabled: boolean;
}

export interface OnboardedCurrency {
  code: string; // e.g. "USD", "FJD", "AUD"
  name: string; // e.g. "US Dollar", "Fiji Dollar"
  symbol: string; // e.g. "$", "FJ$"
  isActive: boolean;
  paymentMethods: PaymentGatewayMethod[];
}
