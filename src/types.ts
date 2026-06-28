export type FeatureKey = 'aiWizard' | 'gearLibrary' | 'reminders' | 'versionHistory' | 'branding' | 'qrSharing' | 'toolingLists' | 'organizer' | 'travelCases' | 'logisticsDashboard' | 'movingDashboard' | 'rackingDashboard' | 'marketplace' | 'marketplaceListings' | 'kioskMode' | 'orgManagement' | 'departments' | 'teams' | 'inventoryManagement' | 'projectCost' | 'supplierManagement' | 'bomManagement' | 'customBarcodes' | 'automaticDepreciation' | 'digitalSignatures' | 'clientPortal' | 'apiIntegrations' | 'weightAnalytics' | 'kioskOrderMode' | 'kioskDirectCheckout' | 'rfidTracking';

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
  maxWorkspaces?: number;
  trialDays?: number;
  trialEnabled?: boolean;
  isActive?: boolean; // Activate/Deactivate subscription plans
  paddleProductId?: string;
  paddlePriceIdMonthly?: string;
  paddlePriceIdAnnual?: string;
  paddleCheckoutUrl?: string;
  dodoProductId?: string;
  dodoPriceIdMonthly?: string;
  dodoPriceIdAnnual?: string;
  dodoCheckoutUrl?: string;
  dodoCheckoutUrlAnnual?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isSuperAdmin?: boolean; // Platform Super Admin
  isBetaTester?: boolean; // Can test beta modules
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
  layoutTheme?: 'standard' | 'workflow';
  onboardingCompleted?: boolean;
  configOnboardingCompleted?: boolean;
  activeWorkspacePreset?: string;
  customPresets?: { id: string; name: string; disabledFeatures: FeatureKey[] }[];
  onboardingConfig?: {
    industry: string;
    role: string;
    intent: string;
    isLiteMode: boolean;
  };
  createdAt: string;
  extraSeats?: number;
  isProfilePublic?: boolean;
  selectedStarters?: string[];
  activeMarketplaceCurrencies?: string[]; // Currencies activated for renting equipment in marketplace
  defaultBookingFee?: number; // User custom default booking fee % or amount
  defaultSecurityDeposit?: number; // User custom default fixed security deposit
  country?: string; // User selected marketplace country
  dashboardMode?: 'minimal' | 'all';
  viewDensity?: 'compact' | 'comfortable';
  fijiCity?: string;
  fijiProvince?: string;
  phoneNumber?: string;
  fijiPhone?: string;
  fijiDetailsCaptured?: boolean;
  fijiDetailsCapturedAt?: string;
  layoutPreferences?: {
    showRecentLists?: boolean;
    showMaintenanceAlerts?: boolean;
    showQuickActionGrid?: boolean;
    showStatsCards?: boolean;
    showDistributionChart?: boolean;
    showKioskTerminal?: boolean;
    showSafetyConsole?: boolean;
    showFleetDispatch?: boolean;
    enableSystemPulseTelemetry?: boolean;
    visibleQuickActions?: string[]; // e.g. ['packing_list', 'inventory', 'rack', 'system_build', 'listing']
    sidebarCollapsedInitially?: boolean;
  };
  subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  trialStartDate?: string;
  trialEndDate?: string;
  trialActive?: boolean;
  // KYC & Verified Seller Store Fields
  kycStatus?: 'not_started' | 'pending' | 'verified' | 'rejected';
  kycSubmittedAt?: string;
  disableQuickActions?: boolean;
  kycFullIdName?: string;
  kycIdType?: 'passport' | 'national_id' | 'drivers_license';
  kycIdNumber?: string;
  kycRejectReason?: string;
  storeName?: string;
  storeBio?: string;
  storeLogo?: string;
  storeCoverImage?: string;
  storeCustomUrl?: string;
  storeWebsite?: string;
  storeEmail?: string;
  storePhone?: string;
  storeTwitter?: string;
  storeInstagram?: string;
  storeLinkedin?: string;
  storeFacebook?: string;
  // Fiji Business & FRCS KYC Compliance fields
  fijiBusinessStatus?: 'not_started' | 'registered' | 'platform_representation';
  fijiFrcsTin?: string;
  fijiBusinessLicenseNumber?: string;
  fijiBusinessRegisteredName?: string;
  fijiBusinessType?: 'sole_trader' | 'partnership' | 'company' | 'cooperative';
  fijiUsePlatformBusinessLicense?: boolean;
  fijiAllowPackerListToList?: boolean;
  activeWorkspaceId?: string;
  workspaces?: Workspace[];
  selectedIndustry?: string;
  selectedCommunity?: string;
  betaTrialInitialized?: boolean;
  trialEnabled?: boolean;
  permissions?: {
    locations?: {
      [inventoryId: string]: 'reader' | 'editor' | 'auditor' | 'none';
    };
    packingLists?: {
      view?: boolean;
      edit?: boolean;
      export?: boolean;
      audit?: boolean;
    };
  };
}

export interface Workspace {
  id: string;
  name: string;
  industry: string; // e.g., 'production' | 'construction' | 'costume' | 'car_rental' | 'it' | 'event' | 'general'
  createdAt: string;
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
  featured?: boolean;
  featuredPriority?: number;
  sponsored?: boolean;
  adHeadline?: string;
  moderationStatus?: 'approved' | 'pending' | 'suspended';
  category?: string;
  workspaceId?: string;
  itemsCount?: number;
  customFields?: { [key: string]: string };
  receivedAt?: string;
  bookingFeePercent?: number; // Packing list level booking fee percent override
  securityDeposit?: number; // Packing list level security deposit fixed override
  rentalStatus?: 'awaiting_payment' | 'awaiting_release' | 'released' | 'returned'; // Stage of the hire workflow
  bookingClientSignature?: string; // Digital signature of checking out party
  bookingClientName?: string; // Name of client checking out
  bookingClientEmail?: string; // Email of client checking out
  bookingPaidAt?: string; // Timestamp of cleared payment
  image?: string; // Primary image for listing
  pickupType?: 'preset' | 'custom';
  pickupLocationId?: string;
  pickupCustomAddress?: string;
  dropoffType?: 'preset' | 'custom';
  dropoffLocationId?: string;
  dropoffCustomAddress?: string;
  createdAt: string;
  updatedAt: string;
  brand?: string;
  model?: string;
  lensType?: string;
  lensMount?: string;
  focalLength?: string;
  maxAperture?: string;
  formatCoverage?: string;
  focusType?: string;
}

export interface RentalAgreement {
  id?: string;
  packingListId: string;
  type: 'pickup' | 'dropoff';
  signeeName: string;
  signeeEmail: string;
  signeePhone?: string;
  signatureUrl: string; // Base64 dataURL
  termsAccepted: string[];
  notes?: string;
  signedAt: string; // ISO String
  agreementDate: string; // Formatting date for display
  itemsCaptured: Array<{
    id: string;
    name: string;
    status: string;
    condition?: string;
    assetTag?: string;
  }>;
  witnessedByUid?: string;
  witnessedByName?: string;
  witnessedByEmail?: string;
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
  visibility?: 'public' | 'private' | 'team' | 'dept' | 'org'; // Privacy view layers (User/private, Team, Department, Organization, Public)
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
  assetTag?: string;
  quantity?: number;
  isOfflinePending?: boolean;
  offlineOpId?: string;
  isAvailableForRent?: boolean;
  rentalPrice?: number;
  rentalHourlyPrice?: number;
  rentalDeposit?: number;
  rentalPeriod?: 'day' | 'week' | 'month';
  currentHolder?: string;
  workspaceId?: string;
  rackId?: string;
  createdAt?: string;
  updatedAt?: string;
  isSale?: boolean;
  kitId?: string | null;
  marketplaceType?: 'rental' | 'sale' | 'both' | null;
  isAvailableForSale?: boolean;
  salePrice?: number;
  addOns?: { 
    itemId?: string; 
    name: string; 
    price: number; 
    useDefaultPrice?: boolean;
    type?: 'Organizer' | 'Accessory' | 'Consumable' | 'Attachment' | 'Add On' | 'Software' | 'Mod' | 'Other';
    notes?: string;
  }[];
  minRentalDays?: number;
  maxRentalDays?: number;
  lensType?: string;
  lensMount?: string;
  focalLength?: string;
  maxAperture?: string;
  formatCoverage?: string;
  focusType?: string;
  nfcTag?: string;
  rfidTag?: string;
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
  status?: 'storage' | 'transit' | 'deployed' | 'maintenance' | 'missing';
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
  parentId?: string | null;
  notes?: string;
  pinCode?: string;
  isLocked?: boolean;
  sections?: ContainerSection[];
  createdAt: string;
  updatedAt: string;
}

export interface ContainerSection {
  id: string;
  name: string;
  description?: string;
  items: string[]; // GearItem or PackingItem IDs placed in this section
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
  addOns?: { 
    itemId?: string; 
    name: string; 
    price: number; 
    useDefaultPrice?: boolean;
    type?: 'Organizer' | 'Accessory' | 'Consumable' | 'Attachment' | 'Add On' | 'Software' | 'Mod' | 'Other';
    notes?: string;
  }[];
  lensType?: string;
  lensMount?: string;
  focalLength?: string;
  maxAperture?: string;
  formatCoverage?: string;
  focusType?: string;
  rfidTag?: string;
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
  imageUrl?: string;
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

export interface Group {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  entityType: 'packing_lists' | 'kits' | 'projects' | 'inventories' | 'organizers' | 'gear' | 'general';
  entityIds: string[];
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
  gcpPricingServiceEnabled?: boolean;
  gcpPricingApiKey?: string;
  supplierScraperServiceEnabled?: boolean;
  supplierScraperModel?: string;
  compatibilityServiceEnabled?: boolean;
  compatibilityModel?: string;
  bomLeadServiceEnabled?: boolean;
  bomRiskThreshold?: number;
  paddleApiKey?: string;
  paddleEnabled?: boolean;
  dodoApiKey?: string;
  dodoEnabled?: boolean;
  dodoSandboxMode?: boolean;
  dodoWebhookSecret?: string;
  paypalSecretKey?: string;
  paypalEnabled?: boolean;
  paypalSandboxMode?: boolean;
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

export interface AppCommunity {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  currency: string;
  flag: string;
  companyName?: string;
  isActive: boolean;
  taxName?: string;
  taxRate?: number;
  locationOnboardEnabled?: boolean;
  locationOnboardRadiusKm?: number;
}

export interface AdminSettings {
  communities?: AppCommunity[];
  branding: {
    logo?: string;
    primaryColor?: string;
    companyName?: string;
    pwaName?: string;
    pwaShortName?: string;
    pwaBgColor?: string;
    pwaThemeColor?: string;
    pwaIcon192Url?: string;
    pwaIcon512Url?: string;
    faviconUrl?: string;
  };
  emailBranding?: {
    logoUrl?: string;
    primaryColor?: string;
    companyName?: string;
    footerText?: string;
    footerLinks?: Array<{ label: string; href: string }>;
    defaultFromType?: 'no-reply' | 'hi' | 'team';
  };
  limits?: {
    maxCheckoutDurationHours?: number;
  };
  frontPageCopy: string;
  landingPage?: LandingPageContent;
  landers?: Lander[];
  activeLanderId?: string;
  activeLandingPageType?: 'main' | 'marketplace';
  rootVisibility?: 'public' | 'auth_only';
  billingEnabled: boolean;
  marketplaceVisibility?: 'signed-in' | 'public';
  privacyContent?: string;
  termsContent?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  plans: Plan[];
  globalFeatures: FeatureToggles;
  betaFeatures?: { [key: string]: boolean }; // Toggles for modules in beta mode
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
  multiIndustryConfig?: {
    enabledIndustries: string[];
    customTerms?: {
      [industryId: string]: {
        gearLabelSingular: string;
        gearLabelPlural: string;
        listLabelSingular: string;
        listLabelPlural: string;
        description: string;
      }
    }
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
    photoWidget?: {
      restrictByPlan?: boolean;
      allowUrlPasteLite?: boolean;
      allowClipboardLite?: boolean;
      allowSystemSearchLite?: boolean;
      allowUrlPastePro?: boolean;
      allowClipboardPro?: boolean;
      allowSystemSearchPro?: boolean;
    };
  };
  marketplaceRegionConfig?: {
    launchCountry: string;
    availableCountries: string[];
    restrictToAvailableCountries: boolean;
    defaultCurrency?: string;
  };
  taxConfig?: {
    fijiVatRate: number;
    fijiVatType: 'VIP' | 'VEP';
    otherCountriesTaxRates?: { [country: string]: { rate: number; type: 'exclusive' | 'inclusive' } };
  };
  marketplaceLandingPageConfig?: {
    heroTitle?: string;
    heroSubtitle?: string;
    heroDescription?: string;
    showPromotions?: boolean;
    bannerATitle?: string;
    bannerASubtitle?: string;
    bannerAButtonText?: string;
    bannerAImage?: string;
    bannerBTitle?: string;
    bannerBSubtitle?: string;
    bannerBButtonText?: string;
    bannerBImage?: string;
    showStaffPicks?: boolean;
    showCategories?: boolean;
    showGuarantees?: boolean;
    requiresEduVerification?: boolean;
    partnerLogosText?: string;
    partnerLogosList?: string[];
    showFeatured?: boolean;
    showShippedToYou?: boolean;
    showLatestGear?: boolean;
    showPopularItems?: boolean;
  };
  footerNavConfig?: {
    enabled: boolean;
    alignMobileCentred: boolean;
    showHowItWorks?: boolean;
    showJoinUs?: boolean;
    links: Array<{
      label: string;
      href: string;
      isExternal?: boolean;
    }>;
  };
  systemHealthAlerts?: {
    emailAlertsEnabled: boolean;
    uiAlertsEnabled: boolean;
    alertRecipientEmails: string[];
    readThresholdHourly: number;
    writeThresholdHourly: number;
    concurrentWriteThreshold: number;
    lastTriggeredAt?: string;
  };
  betaModeEnabled?: boolean;
  smtp?: SmtpConfig;
}

export interface SmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  enabled?: boolean;
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

export const INDUSTRIES = [
  { id: 'production', name: 'Video Production & Pro AV', icon: 'Camera', gearLabelSingular: 'Camera/Device', gearLabelPlural: 'Gear Library', listLabelSingular: 'Shoot List', listLabelPlural: 'Packing Lists', description: 'Log cameras, lenses, filters, sound devices, and staging kits. Auto-compile media metadata.' },
  { id: 'construction', name: 'Construction & Contracting', icon: 'Wrench', gearLabelSingular: 'Tool/Machine', gearLabelPlural: 'Tools & Equipment', listLabelSingular: 'Site Manifest', listLabelPlural: 'Job Site Manifests', description: 'Track commercial hammers, rigging materials, fleet tools, safety gear, and scaffolding.' },
  { id: 'outdoors', name: 'Outdoors & Adventure (Hiking, Fishing, Diving)', icon: 'Compass', gearLabelSingular: 'Adventure Gear/Item', gearLabelPlural: 'Adventure & Outdoors Gear', listLabelSingular: 'Expedition List', listLabelPlural: 'Expedition Packing Lists', description: 'Catalog hiking gear, camping tents, fishing rods, diving regulators, scuba tanks, and outdoors adventure kits. Auto-calculate payload weight.' },
  { id: 'costume', name: 'Wardrobe & Costume Houses', icon: 'Shirt', gearLabelSingular: 'Garment/Dress', gearLabelPlural: 'Costumes & Dresses', listLabelSingular: 'Dressing Rack', listLabelPlural: 'Dressing Rack Specs', description: 'Catalog couture dresses, hangers, period garments, shoes, and sizing checklists.' },
  { id: 'car_rental', name: 'Car Rentals & Fleets', icon: 'Car', gearLabelSingular: 'Vehicle/Fleet', gearLabelPlural: 'Vehicles & Cars', listLabelSingular: 'Fleet Booking', listLabelPlural: 'Vehicle Bookings', description: 'Manage car reservations, trucks, vans, driver assignments, and checklist logs.' },
  { id: 'it', name: 'IT & Cloud Infrastructure', icon: 'Cpu', gearLabelSingular: 'Hardware/Server', gearLabelPlural: 'Hardware & Servers', listLabelSingular: 'Rack Manifest', listLabelPlural: 'Server Rack Manifests', description: 'Manage server racks, networking switches, fiber arrays, and desk allocations.' },
  { id: 'event', name: 'Event & Banquet Planning', icon: 'Cake', gearLabelSingular: 'Event Item', gearLabelPlural: 'Chairs, Tables & Cables', listLabelSingular: 'Event Checklist', listLabelPlural: 'Event Checklists', description: 'Track table layouts, banquet chairs, audio/visual inputs, stage decors, and caterings.' },
  { id: 'sports', name: 'Sports & Teams Training', icon: 'Trophy', gearLabelSingular: 'Athletic Gear/Kit', gearLabelPlural: 'Athletic Gear & Kits', listLabelSingular: 'Roster Checklist', listLabelPlural: 'Roster & Team Lists', description: 'Catalog team sports equipment, jerseys, dynamic training cones, helmets, soccer balls, custom team sports gear bags, and specialized athletic trainer accessories.' },
  { id: 'general', name: 'General Equipment', icon: 'Package', gearLabelSingular: 'Asset', gearLabelPlural: 'Gear Library', listLabelSingular: 'Packing List', listLabelPlural: 'Packing Lists', description: 'Universal tracking for multi-disciplinary gear libraries and general utilities.' }
];

export interface BugReport {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  description: string;
  module: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_review' | 'resolved' | 'fixed';
  createdAt: string;
  adminNotes?: string;
  adminNotesUpdatedAt?: string;
  screenshots?: string[];
}


