import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, ChevronRight, Book, MessageCircle, Mail, Phone, ExternalLink, 
  Shield, Truck, Camera, Zap, ListChecks, CheckCircle2, Plus, Heart, 
  User, Calendar, FileText, Globe, Award, Sparkles, X, ChevronDown, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const categories = [
  { id: 'getting-started', name: 'Getting Started', icon: <Book size={18} /> },
  { id: 'packer-tools-academy', name: 'Packer Academy', icon: <Award size={18} /> },
  { id: 'packing-lists', name: 'Manifests', icon: <ListChecks size={18} /> },
  { id: 'gear-library', name: 'Gear Library', icon: <Camera size={18} /> },
  { id: 'ai-wizard', name: 'AI Wizard', icon: <Zap size={18} /> },
  { id: 'moving', name: 'Projects', icon: <Truck size={18} /> },
  { id: 'billing', name: 'Billing', icon: <Shield size={18} /> },
  { id: 'developer', name: 'Developer & Embeds', icon: <Globe size={18} /> },
];

const articles = [
  {
    id: 'packer-academy-intro',
    title: "Introduction to Packer Tools Academy",
    description: "Our certified training ground for expedition coordinators, cinema focus pullers, and heavy logistics safety handlers.",
    category: 'packer-tools-academy',
    steps: [
      { title: "Enroll in a Stream", description: "Select your dedicated stream (Wilderness Survival & Outdoors, Pro Cinematography, Heavy Safety Cargo) inside the Academy Dashboard." },
      { title: "Master Payload Calculus", description: "Complete interactive micro-lessons on tare weight calibration, center-of-gravity calculations, and moisture lock auditing." },
      { title: "Earn Field Badge Credits", description: "Submit automated checklist audits with verified camera scanner photos to pass the telemetry validation benchmarks." }
    ],
    tips: ["Verified students of Packer Tools Academy receive up to a 20% discount on marketplace integrations and organization subscriptions!"]
  },
  {
    id: 'outdoors-expedition-guide',
    title: "Logistics for Outdoors & Adventure Expeditions",
    description: "Safety rules, payload balance limits, and checklist strategies for extreme alpine hiking, fly fishing, Scuba diving, and survival trips.",
    category: 'packer-tools-academy',
    steps: [
      { title: "Calibrate Dry Pack Weight", description: "Ensure survival gear, tents, and sub-zero rations do not exceed 25% of active operator bodyweight using key payload tools." },
      { title: "Moisture & Submergence Audits", description: "Group diving regulators, oxygen kits, and marine electronics under insulated dry-box categories. Tag diving equipment with automated service interval reminder alarms." },
      { title: "Telemetry Tracker Dispatch", description: "Pair emergency beacons, satellite dispatch routers, and fly fishing line presets into custom Locker Rack slots for immediate group checkout." }
    ],
    tips: ["Enable thermal lithium isolation flags on power bank cells inside sub-zero or deep underwater conditions to prevent rapid energy drain."]
  },
  {
    id: 'marketplace-operations-guide',
    title: "Marketplace & Brand Storefront Operations",
    description: "Learn how to establish custom public hiring storefronts, configure default regional currencies, and verify billing license approvals.",
    category: 'packer-tools-academy',
    steps: [
      { title: "Personalize Shopfront Info", description: "Utilize your Profile configurations to upload custom branding, store names, backgrounds, websites, and business coordinates." },
      { title: "Define Global Region Currency", description: "Update default currency (FJD, AUD, NZD, GBP, EUR, Canadian or US Dollars) via the Admin region manager dashboard." },
      { title: "Unlock Commercial Hires", description: "Observe subscription tier standards to enable Marketplace listings and overcome regulatory escrow licensing safeguards." }
    ],
    tips: ["Active Academy members can customize their storefront with advanced social handles (Instagram, LinkedIn, Twitter, Facebook) to boost trust!"]
  },
  {
    id: 'starters-navigation-setup',
    title: "How to customize Sidebar Starters & Main Navigation",
    description: "Take control of your sidebar. Consolidate less-used modules into the collapsible Starters section and hide them from the main left panel.",
    category: 'getting-started',
    steps: [
      { title: "Open Preferences Tab", description: "Go to your 'Profile' page and click on the 'Layout & Density' tab under Workspace Settings." },
      { title: "Configure Starters Settings", description: "Scroll down to 'Workspace Starters Settings' where all of the available platform modules are listed." },
      { title: "Toggle Modules", description: "Tap any module button to toggle its home. Checked modules immediately migrate to the collapsible 'Starters' section of the sidebar and hide from the main left navigation board for a clean workspace vibe." }
    ],
    tips: ["Use this configuration to keep your daily primary tools visible in the main drawer, and move secondary reference modules (like Traveller or Scenario Builder) into Starters!"]
  },
  {
    id: 'setup-profile',
    title: "How to set up your Profile & Theme",
    description: "Your profile is your digital ID and control hub. Customize bio, marketplace, and visual environments.",
    category: 'getting-started',
    steps: [
      { title: "Navigate to Profile", description: "Select the 'Profile' & settings option from your main sidebar panel." },
      { title: "Configure Theme Preferences", description: "In the right-hand sidebar section, toggle between Light Mode and pitch-black Dark Mode to set your global workspace vibe." },
      { title: "Update Core Data", description: "Enter your display name, company, and location. This details auto-fill on all shared manifests." }
    ],
    tips: ["A clear company name helps clients identify your manifests instantly, and choosing dark mode helps preserve power on industrial checking tablets."]
  },
  {
    id: 'mobile-audits',
    title: "Mastering Mobile Audits",
    description: "Learn how to use your mobile device to rapidly audit and verify gear in the field.",
    category: 'getting-started',
    steps: [
      { title: "Access Mobile View", description: "Open Packer Tools on your mobile browser. The UI adapts automatically for field use." },
      { title: "Scanner Protocol", description: "Use the 'Zap' icon (AI Scanner) to identify gear by taking a photo. The system will match it to your library." },
      { title: "Quick-Flip Status", description: "Tap the status badge on any item to instantly cycle between 'Pending', 'Packed', and 'Returned'." }
    ],
    tips: ["Use 'Kiosk Mode' for a simplified, full-screen scanning experience during large projects."]
  },
  {
    id: 'create-project',
    title: "How to create a new Project",
    description: "Projects are containers for multiple packing lists, helping you manage complex productions or events.",
    category: 'moving',
    steps: [
      { title: "Initialize Project", description: "From the Dashboard or Projects view, click 'New Project'." },
      { title: "Complete Phase 1: Identity", description: "Provide a descriptive name and a detailed brief (Description)." },
      { title: "Phase 2: Categorization", description: "Select the project type (Production, Event, etc.) and assign an internal Org Unit." },
      { title: "Phase 3: Details", description: "Set the start date and priority level. This helps your team prioritize gear prep." }
    ],
    tips: ["Use the 'Project brief' to include special instructions like 'Desert Environment' or 'International Travel'."]
  },
  {
    id: 'organization-protocol',
    title: "Organization & Rack Protocol",
    description: "Advanced techniques for managing cases, racks, and containers.",
    category: 'gear-library',
    steps: [
      { title: "Create a Container", description: "In the 'Organizer' or 'Racks' module, define your physical storage units (e.g., 'A-Rack', 'Truck Case 1')." },
      { title: "Link Manifests", description: "Assign specific packing lists to containers to track which gear is in which physical location." },
      { title: "QR Deployment", description: "Print a container-level QR code and attach it to the physical case for instant digital lookup." }
    ],
    tips: ["A 'Rack' can contain multiple 'Slots'. Use this for AV or server deployments."]
  },
  {
    id: 'manage-gear',
    title: "How to register gear in your Master Library",
    description: "Building an accurate gear library is the foundation of digital manifests.",
    category: 'gear-library',
    steps: [
      { title: "Open Library", description: "Navigate to the 'Gear Library' module from the sidebar." },
      { title: "Register Item", description: "Click 'New Item' to open the registration form." },
      { title: "Visual Verification", description: "Upload a photo of the item. This is critical for visual verification during packing." },
      { title: "Metadata Assignment", description: "Assign a unique Asset Tag, Brand, and Model. Select the correct Category for AI matching." }
    ],
    tips: ["Use 'Batch Scan' if you have many items with barcodes or QR codes already attached."]
  },
  {
    id: 'select-mode-bulk-operations',
    title: "Using Select Mode for Multi-Asset Operations",
    description: "Learn how to activate Select Mode, select multiple items, and run large-scale batch updates.",
    category: 'gear-library',
    steps: [
      { title: "Activate Select Mode", description: "In the Gear Library view bar, click 'Select Mode' to toggle checkbox selection across grids, list compacts, and tables." },
      { title: "Select Target Inventory", description: "Tap individual items to append them to your active batch selection. An elegant smart floating bar will emerge tracking counts." },
      { title: "Execute Batch Changes", description: "Use the floating triggers to update statuses, assign departments, move items to racks, or batch delete entire selections." }
    ],
    tips: ["Batch deletion acts immediately via Firestore write-batches. Be sure your selections are accurate as deletion is irreversible!"]
  },
  {
    id: 'packing-list-mastery',
    title: "How to master Packing Manifests",
    description: "Move from a list of gear to a verified, group-organized deployment manifest.",
    category: 'packing-lists',
    steps: [
      { title: "Quick Add Items", description: "Use the 'Quick Add' button inside a manifest to rapidly add items by name." },
      { title: "Group Organization", description: "Select multiple items and use the 'Group Selected' tool to organize gear into bins, cases, or departments." },
      { title: "Kit Conversion", description: "If a group is a permanent kit (like a camera body with its cage), click 'Convert to Kit' to save it for future use." },
      { title: "Verify & Lock", description: "As items are packed, use the visual verification tags to change status from 'Pending' to 'Packed'." }
    ],
    tips: ["Long-press or click the group header to expand/collapse entire sections of your manifest."]
  },
  {
    id: 'marketplace-sharing',
    title: "Marketplace & External Sharing",
    description: "Launch your gear lists to the public or private recipients with professional 'Bio' views.",
    category: 'packing-lists',
    steps: [
      { title: "Access Sharing Hub", description: "Open a manifest and click the 'Marketplace & Recipient' (ShoppingBag) icon." },
      { title: "Configure Listing", description: "Set price, transaction type (Sale/Rental), and recipient. This helps track where gear is going." },
      { title: "Generate Link in Bio", description: "Enable 'Marketplace Listing' to generate a unique, read-only URL. Anyone with this link can view the manifest as a professional landing page." }
    ],
    tips: ["The 'Link in Bio' view is fully optimized for mobile devices and shows your brand logo if configured."]
  },
  {
    id: 'ai-wizard-guide',
    title: "How to use the AI Template Wizard",
    description: "Let Gemini analyze your requirements and suggest a complete gear list based on your inventory.",
    category: 'ai-wizard',
    steps: [
      { title: "Launch Wizard", description: "Go to the 'AI Wizard' page from the sidebar." },
      { title: "Define Project", description: "Enter a natural language prompt, e.g., '3-day music video shoot in the rain'." },
      { title: "Wait for Extraction", description: "The AI will extract required gear categories and count based on your prompt." },
      { title: "Generate List", description: "The wizard cross-references your library and creates a new packing list with the suggested gear." }
    ],
    tips: ["The more descriptive your prompt, the more accurate the AI's gear suggestions will be."]
  },
  {
    id: 'qr-sharing',
    title: "How to deploy Mobile Manifests with QR",
    description: "Give your field team instant access to packing lists without requiring them to log in.",
    category: 'packing-lists',
    steps: [
      { title: "Enable Portal", description: "Open a packing list and click the 'Share' (Share2) icon." },
      { title: "Authorize Public View", description: "Toggle the 'Public View' switch to 'ON'." },
      { title: "Generate QR", description: "A QR code will appear. Click it to open a high-res version for printing." },
      { title: "Distribute Access", description: "Print the QR on travel cases or equipment racks. Anyone scanning it can view the manifest on their mobile device." }
    ],
    tips: ["Public manifests are read-only to ensure your master record stays secure."]
  },
  {
    id: 'project-workspace',
    title: "Mastering the Project Workspace",
    description: "The streamlined, high-productivity Workspace designed to grant maximum screen real-estate for large operations.",
    category: 'moving',
    steps: [
      { title: "Access the Workspace", description: "Select any active project to boot directly into its widescreen workspace layout." },
      { title: "Widescreen Top Control Bar", description: "Monitor the unified status, stage, current version, priority indicators, and sandbox controls in a single, high-density ribbon." },
      { title: "Dynamic Modular Switcher", description: "Use the left-hand primary navigation menu to seamlessly swap sub-modules (Sandbox, Costs, Composer) without losing editing focus." }
    ],
    tips: ["Collapse the primary application sidebar for an even wider fullscreen operational environment."]
  },
  {
    id: 'ai-description-assistant',
    title: "Leveraging the AI Description Assistant",
    description: "Use Gemini to draft concise descriptions for both individual equipment assets and complex hardware kits.",
    category: 'ai-wizard',
    steps: [
      { title: "Establish Key Metadata", description: "The system enforces that Name, Brand, and Model must be input first to prevent AI hallucinations." },
      { title: "Trigger Assistant", description: "Tap the Sparkles button next to the description text area in the active Edit Gear drawer." },
      { title: "Kit-Level Item Listing", description: "For designated Pack Kits, the assistant reads matched sub-item metadata and presents a clean, coherent equipment list summary." }
    ],
    tips: ["Specify unique properties in the initial details to guide the AI to formulate more targeted asset specs."]
  },
  {
    id: 'subscription-lever-activation',
    title: "Granular Plan Setting Management",
    description: "Enterprise system administrator workflow for configuring plan limits and privilege locks.",
    category: 'billing',
    steps: [
      { title: "Access Plan Configuration", description: "Open the 'System Admin' menu as a platform supervisor and select 'Plans' tab." },
      { title: "Assign Hard Resource Quotas", description: "Impose specific thresholds on packing lists, inventory limits, custom roles, and database quotas." },
      { title: "Toggle Segmented Privileges", description: "Activate enterprise switches (Decal White-Labeling, API Access Keys, 1h Support Tickets) with toggle switches." }
    ],
    tips: ["Use the Duplicate tool to instantly clone and draft new billing tiers from existing baseline blueprints."]
  },
  {
    id: 'kiosk-and-library-policies',
    title: "Global Kiosk & Equipment Policies",
    description: "Configure system-wide automatic validations, default statuses, and check-out terminal guardrails.",
    category: 'gear-library',
    steps: [
      { title: "Inspect System Settings", description: "Navigate to system admin settings under 'System Settings'." },
      { title: "Enable Strict Duplicate Prevention", description: "Toggle duplicate checks to alert operators immediately when model codes overlap." },
      { title: "Define Session Session Limits", description: "Specify session timeouts and screen saver intervals to protect unsupervised terminals." }
    ],
    tips: ["For high-security operations, enable 'Supervisor Signature' to force manual manager overrides on all kiosk transactions."]
  },
  {
    id: 'embed-rental-shop',
    title: "Embedding the Custom Rental Shop Storefront",
    description: "Learn how to instantly place a fully functioning storefront directly into your commercial website with zero backend code.",
    category: 'developer',
    steps: [
      { title: "Generate Custom Iframe or Script", description: "Navigate to 'Developer API & Embeds' inside your dashboard and customize colors, themes, and lists according to your platform layout." },
      { title: "Incorporate Widget Snippet", description: "Copy either the responsive HTML IFRAME embed code or the CSS bundle CDN client-side SDK code." },
      { title: "Paste into Site Builder", description: "Drop the block directly into Webflow, Squarespace, WordPress, or any hand-coded HTML block. The storefront will automatically match lists, pricing details, and booking logs instantly." }
    ],
    tips: ["To unlock paid checkout capabilities inside your embedded rental storefront, link your PayPal or Stripe setup under Admin settings first."]
  },
  {
    id: 'rest-api-sandbox',
    title: "Utilizing REST APIs & API Keys",
    description: "Connect to Packer database logs and query lists, gear items, and barcodes with standard HTTP REST calls.",
    category: 'developer',
    steps: [
      { title: "Acquire Secret Key Credentials", description: "Obtain your confidential live secure API token starting with 'pk_live_packer_...' in the Developer panel." },
      { title: "Configure Headers", description: "Include the credential in HTTP requests using either Authorization Bearer headers or 'x-api-key' custom parameters." },
      { title: "Test Queries on Sandbox Client", description: "Use our interactive Sandbox API client to execute GET `/api/developer/lists` or `/api/developer/gear` and inspect structured JSON answers directly." }
    ],
    tips: ["Do not expose private credentials inside browser-side React or HTML. Always proxy confidential fetch operations through backend server routes."]
  },
  {
    id: 'api-integration-examples',
    title: "API Authentication & Fetch Blueprints",
    description: "Get started immediately with copyable snippets for safe list and gear inventory endpoints retrieval.",
    category: 'developer',
    steps: [
      { title: "Header Configuration & TLS", description: "Construct your outbound requests targeting the secure HTTPS container channels. Include 'x-api-key' with your client token in the header." },
      { title: "Retrieve Active Manifests", description: "Fetch 'GET /api/developer/lists' to extract the complete list of bookings, item counts, hire prices, and periodicities." },
      { title: "Query Master Gear Catalog", description: "Fetch 'GET /api/developer/gear' to extract your total registered catalog assets, serial numbers, categories, and maintenance timers." }
    ],
    tips: [
      "Keep API calls inside your server-side environment (Node.js, python, or NextJS Server Components) to safeguard your private credentials.",
      "The sandbox explorer in the 'Developer API & Embeds' dashboard tab lets you examine return fields instantly with a live sandbox click."
    ],
    codeSamples: [
      {
        title: "List Retrieval (Node.js/JS)",
        code: `// Retrieve active rental lists
fetch('https://packer-tools.run.app/api/developer/lists', {
  method: 'GET',
  headers: {
    'x-api-key': 'pk_live_packer_your_key_here',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log("Found Active Lists:", data.lists);
})
.catch(err => console.error("API error:", err));`
      },
      {
        title: "Gear Catalog Retrieval (Python)",
        code: `# Retrieve registered master gear
import requests

url = "https://packer-tools.run.app/api/developer/gear"
headers = {
    "x-api-key": "pk_live_packer_your_key_here",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)
print("Master Inventory Payload:", response.json())`
      }
    ]
  }
];

const defaultStories = [
  {
    id: 'default-story-1',
    title: "Denali 2026: Sub-Zero Drone Logistics Flight Log",
    excerpt: "Prepping carbon battery warmer plates and custom visual tracker rigs in temperatures below -35°F.",
    content: "During our primary 14-day ascent, high-altitude sub-zero batteries was our maximum engineering bottleneck. We deployed customized carbon cell heater jackets, pre-wired inside partitioned sub-compartments of our primary equipment bags. Using the Packer Tools rack slots and QR system, field technicians maintained absolute telemetry of active charges and isolates without exposing units directly to moisture-loaded blizzards.",
    category: "Outdoor Expedition",
    authorName: "Alex Mercer",
    authorEmail: "alex.mercer@apex-ops.net",
    upvotes: 42,
    createdAt: new Date("2026-05-10T12:00:00Z").toLocaleDateString()
  },
  {
    id: 'default-story-2',
    title: "Cannes Red Carpet Prep: Redundancy Optics Strategy",
    excerpt: "How a high-stakes cinema production crew pre-assigned optical backups and QR codes across 14 cases.",
    content: "With 3 separate media teams working 18-hour rotations at the film festival, any loose or unregistered prime lens spells chaos. We utilized the custom case visual layout matrix to map and label focal ranges, mounting brackets, and cleaning rods into compartmentalized modules. The automatic duplicate alerts in Kiosk Mode guaranteed zero misplaced gear during late-night media offloads.",
    category: "Camera & Productions",
    authorName: "Sarah Lin",
    authorEmail: "s.lin@cannes-capture.com",
    upvotes: 89,
    createdAt: new Date("2026-05-18T15:30:00Z").toLocaleDateString()
  },
  {
    id: 'default-story-3',
    title: "Project Antarctica: Solid-State Storage Shock Arrays",
    excerpt: "Shock-isolation and auto-backup rack deployment logs on polar exploration research containers.",
    content: "Protecting live research measurements required specialized SSD shock brackets mounted inside heavy physical drawers. By registering the storage racks inside the Racking module, we could monitor exact weights, power draws, and heat distribution. Automatic alarms on our dashboard notified us immediately when thermal bounds approached degradation levels.",
    category: "IT & Network",
    authorName: "Dr. Marcus Croft",
    authorEmail: "m.croft@polar-science.org",
    upvotes: 61,
    createdAt: new Date("2026-05-22T08:15:00Z").toLocaleDateString()
  }
];

interface HelpCenterProps {
  user: UserProfile | null;
}

export default function HelpCenter({ user }: HelpCenterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');

  const [activeTab, setActiveTab] = useState<'guides' | 'stories' | 'policies'>('guides');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuideCat, setSelectedGuideCat] = useState<string | null>(categoryParam);

  useEffect(() => {
    if (categoryParam) {
      setSelectedGuideCat(categoryParam);
      setActiveTab('guides');
    } else {
      setSelectedGuideCat(null);
    }
  }, [categoryParam]);
  
  // Stories module states
  const [dbStories, setDbStories] = useState<any[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedStoryForView, setSelectedStoryForView] = useState<any | null>(null);
  const [likedStories, setLikedStories] = useState<Set<string>>(new Set());

  // New story model properties
  const [newTitle, setNewTitle] = useState('');
  const [newExcerpt, setNewExcerpt] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('Camera & Productions');
  const [newAuthorName, setNewAuthorName] = useState(user?.displayName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load persistent stories from Firestore
  useEffect(() => {
    if (!user) return;
    const storiesRef = collection(db, 'stories');
    const q = query(storiesRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        let dateString = '';
        if (data.createdAt) {
          try {
            dateString = data.createdAt.toDate().toLocaleDateString();
          } catch {
            dateString = new Date(data.createdAt).toLocaleDateString();
          }
        } else {
          dateString = new Date().toLocaleDateString();
        }
        fetched.push({
          id: doc.id,
          ...data,
          createdAt: dateString
        });
      });
      setDbStories(fetched);
    }, (error) => {
      console.error("Error watching stories collection:", error);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center space-y-8" id="help-locked-state">
        <div className="w-24 h-24 bg-neutral-100 rounded-[2.5rem] flex items-center justify-center text-neutral-400">
          <Shield size={48} />
        </div>
        <div className="space-y-4 max-w-sm">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-neutral-900">Portal Locked</h1>
          <p className="text-neutral-500 font-medium italic leading-relaxed">
            Help Center is reserved for active operators. Please sign in to access training docs, operator logs, and platform policies.
          </p>
        </div>
      </div>
    );
  }

  // Handle submits to firestore
  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Please fill in the title and the content writeup.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: newTitle,
        excerpt: newExcerpt || newContent.substring(0, 100) + '...',
        content: newContent,
        category: newCategory,
        authorName: newAuthorName || user.displayName || "Anonymous Operator",
        authorEmail: user.email || "jnakasamai@gmail.com",
        upvotes: 0,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'stories'), payload);
      toast.success("Flight Log published to Help Center arena.");
      
      // Reset variables
      setNewTitle('');
      setNewExcerpt('');
      setNewContent('');
      setNewCategory('Camera & Productions');
      setIsSubmitModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Publish error: ${err.message || 'database isolated'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upvote/Like story
  const handleLikeStory = async (story: any) => {
    if (likedStories.has(story.id)) {
      toast.info("You've already verified and upvoted this flight log.");
      return;
    }

    // Toggle liked state local
    setLikedStories(prev => {
      const next = new Set(prev);
      next.add(story.id);
      return next;
    });

    // Check if default mock or real DB doc
    if (story.id.startsWith('default-story-')) {
      toast.success("Verified and upvoted mock log!");
      return;
    }

    try {
      const storyRef = doc(db, 'stories', story.id);
      await updateDoc(storyRef, {
        upvotes: increment(1)
      });
      toast.success("Flight Log upvoted!");
    } catch (err) {
      console.error("Error updating upvote count:", err);
    }
  };

  // Filter manuals list
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         article.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedGuideCat ? article.category === selectedGuideCat : true;
    return matchesSearch && matchesCategory;
  });

  // Merge mock stories with db stories
  const allStories = [...dbStories, ...defaultStories].filter(s => {
    if (!searchQuery) return true;
    return s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           s.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-10 px-4 sm:px-8" id="help-center-root">
      {/* 1. Header display */}
      <header className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
          <Book size={13} />
          <span>OPERATIONAL DEPLOYMENT TERMINAL</span>
        </div>
        <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tighter leading-[0.8] text-neutral-900">
           Help & <br/> <span className="text-primary italic">Knowledge</span>
        </h1>
        <p className="text-neutral-500 max-w-xl mx-auto text-base italic font-medium leading-relaxed">
          Access authoritative instructions, study field expedition flight logs, or review security policies.
        </p>

        {/* Dynamic Widescreen Tab Selection Switcher */}
        <div className="flex justify-center pt-4" id="help-center-tabs">
          <div className="bg-neutral-100 p-1 rounded-2xl flex items-center gap-1 border border-neutral-200">
            <button
              onClick={() => { setActiveTab('guides'); setSearchQuery(''); }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'guides' 
                  ? 'bg-neutral-900 text-white shadow-lg' 
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Book size={14} />
              <span>Guides & Manuals</span>
            </button>
            <button
              onClick={() => { setActiveTab('stories'); setSearchQuery(''); setSearchParams({}); }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'stories' 
                  ? 'bg-neutral-900 text-white shadow-lg' 
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Sparkles size={14} />
              <span>Operator Stories</span>
            </button>
            <button
              onClick={() => { setActiveTab('policies'); setSearchQuery(''); setSearchParams({}); }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'policies' 
                  ? 'bg-neutral-900 text-white shadow-lg' 
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <FileText size={14} />
              <span>T&C policies</span>
            </button>
          </div>
        </div>

        {/* Global Search Strip (only for guides or stories) */}
        {activeTab !== 'policies' && (
          <div className="max-w-2xl mx-auto relative group pt-2">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-300 group-focus-within:text-primary transition-colors" size={20} />
            <input
              type="text"
              placeholder={
                activeTab === 'guides' 
                  ? "Search platform manuals, checklists, and configurations..."
                  : "Search flight logs, sub-zero tips, and gear reviews..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-8 py-4 bg-white border border-neutral-200 rounded-3xl shadow-sm focus:ring-4 focus:ring-primary/10 outline-none transition text-base font-medium"
            />
          </div>
        )}
      </header>

      {/* Main Panel views switcher */}
      <AnimatePresence mode="wait">
        {/* VIEW 1: MANUALS & GUIDES */}
        {activeTab === 'guides' && (
          <motion.div
            key="guides-container"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Category selection tag container */}
            <div className="flex flex-wrap items-center justify-center gap-2 py-2">
              <button
                onClick={() => setSearchParams({})}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  selectedGuideCat === null
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSearchParams({ category: cat.id })}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    selectedGuideCat === cat.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            {/* Articles Grid list */}
            <div className="grid gap-8">
              {filteredArticles.length > 0 ? (
                filteredArticles.map((article, idx) => (
                  <div
                    key={article.id}
                    className="bg-white p-8 sm:p-10 rounded-[2.5rem] border border-neutral-200 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-neutral-950 text-white rounded-md text-[8px] font-black uppercase tracking-widest">
                            Official Manual
                          </span>
                          <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-md text-[8px] font-black uppercase tracking-widest border border-primary/20">
                            {article.category.replace('-', ' ')}
                          </span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter leading-tight text-neutral-900">
                          {article.title}
                        </h3>
                        <p className="text-neutral-500 font-medium italic text-base leading-relaxed max-w-xl">
                          {article.description}
                        </p>
                      </div>

                      {article.steps && (
                        <div className="grid gap-3 pt-4 pb-2 border-t border-neutral-100">
                          {article.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex gap-4 group/step">
                              <div className="flex-shrink-0 w-8 h-8 bg-neutral-900 text-white rounded-xl flex items-center justify-center font-black text-xs">
                                {sIdx + 1}
                              </div>
                              <div className="space-y-0.5 pt-0.5">
                                <h4 className="text-xs font-black uppercase tracking-widest text-neutral-900">{step.title}</h4>
                                <p className="text-neutral-500 text-xs italic">{step.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {article.tips && (
                        <div className="bg-primary/5 p-6 rounded-2xl border border-primary/15 flex gap-3">
                          <div className="text-primary pt-0.5"><Zap size={16} /></div>
                          <div className="space-y-0.5">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Pro Tip</h4>
                            {article.tips.map((tip, tIdx) => (
                              <p key={tIdx} className="text-neutral-600 text-xs font-semibold italic">
                                {tip}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {'codeSamples' in article && (article as any).codeSamples && (
                        <div className="space-y-4 pt-4 border-t border-neutral-100">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-900 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#ff4f3a] rounded-full" />
                            <span>API Code Integration Snippets</span>
                          </h4>
                          <div className="grid md:grid-cols-2 gap-6">
                            {((article as any).codeSamples as any[]).map((sample, sIdx) => (
                              <div key={sIdx} className="space-y-2">
                                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block">{sample.title}</span>
                                <pre className="p-4 bg-neutral-900 text-emerald-400 rounded-2xl text-[10px] font-mono overflow-x-auto whitespace-pre leading-relaxed border border-neutral-800 text-left">
                                  {sample.code}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-200">
                  <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-300 mx-auto mb-4">
                    <Search size={28} />
                  </div>
                  <p className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">No compatible guides found.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW 2: STORIES SECTION */}
        {activeTab === 'stories' && (
          <motion.div
            key="stories-container"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Top row actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-neutral-900">Operator Flight Logs & Chronicles</h2>
                <p className="text-xs text-neutral-500 italic">Expedition diaries, pack logs, logistics checklists, and audits shared by other operators</p>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(true)}
                className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-black uppercase tracking-wider text-[10px] hover:scale-[1.02] active:scale-95 transition shadow-sm hover:shadow"
              >
                <Plus size={14} />
                <span>Publish Flight Log</span>
              </button>
            </div>

            {/* Stories Grid */}
            <div className="grid sm:grid-cols-2 gap-6">
              {allStories.map((story) => (
                <div 
                  key={story.id}
                  className="bg-white p-6 rounded-3xl border border-neutral-200 hover:border-neutral-300 shadow-sm flex flex-col justify-between hover:shadow transition-all duration-300 group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 bg-neutral-100 text-neutral-700 rounded-md text-[8px] font-black uppercase tracking-wider">
                        {story.category}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-medium italic">{story.createdAt}</span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-lg font-black uppercase tracking-tight text-neutral-900 hover:text-primary transition-colors cursor-pointer" onClick={() => setSelectedStoryForView(story)}>
                        {story.title}
                      </h4>
                      <p className="text-neutral-500 text-xs font-medium italic leading-relaxed line-clamp-3">
                        {story.excerpt || story.content || ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-neutral-100 mt-6">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-neutral-900 text-white font-black text-[9px] rounded-full flex items-center justify-center uppercase">
                        {story.authorName ? story.authorName.charAt(0) : 'O'}
                      </div>
                      <div className="leading-tight">
                        <p className="text-[10px] font-black text-neutral-900">{story.authorName || 'Anonymous'}</p>
                        <p className="text-[8px] text-neutral-400 font-mono italic">{story.authorEmail || ''}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleLikeStory(story)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                          likedStories.has(story.id)
                            ? 'bg-rose-50 text-rose-500 hover:text-rose-600'
                            : 'bg-neutral-50 text-neutral-500 hover:text-rose-500 hover:bg-rose-50/50'
                        }`}
                      >
                        <Heart size={11} className={likedStories.has(story.id) ? 'fill-current' : ''} />
                        <span>Upvotes ({story.upvotes || 0})</span>
                      </button>
                      <button 
                        onClick={() => setSelectedStoryForView(story)}
                        className="text-[9px] font-black uppercase tracking-wider text-neutral-400 hover:text-primary transition-colors"
                      >
                        Read Log
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* VIEW 3: POLICIES SECTION */}
        {activeTab === 'policies' && (
          <motion.div
            key="policies-container"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Header info */}
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h2 className="text-xl font-black uppercase tracking-tight text-neutral-900">Platform Policies & Compliance Center</h2>
              <p className="text-xs text-neutral-500 italic">Official regulatory standards, Terms and Conditions of service, and user privacy guarantees.</p>
            </div>

            {/* Terms and Privacy detailed cards */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Terms are shown beautifully */}
              <div className="bg-white p-8 sm:p-10 rounded-[2rem] border border-neutral-200 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Terms of Service</h3>
                    <p className="text-[10px] text-neutral-400 font-mono">LAST REVISED: MAY 29, 2026</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs leading-relaxed text-neutral-600 font-medium italic overflow-y-auto max-h-[350px] pr-2">
                  <p className="font-extrabold text-neutral-900 not-italic uppercase tracking-wider">1. Acceptance of Terms</p>
                  <p>Welcome to Packer Tools. By creating an account or using our platform, physical racks organizer, custom inventory audited suites, visual checklists, and AI template generators, you agree to comply with and be bound by these strict Terms of Service.</p>
                  
                  <p className="font-extrabold text-neutral-900 not-italic uppercase tracking-wider">2. Operator Responsibilities & Accounts</p>
                  <p>As a registered operator, you are completely responsible for updating and registering accurate equipment weights, brands, asset tags, and hazardous battery variables. Misrepresentation of field-sensitive equipment specs is grounds for immediate credential suspension.</p>

                  <p className="font-extrabold text-neutral-900 not-italic uppercase tracking-wider">3. AI Template Usage & Disclaimers</p>
                  <p>Our AI Packing Template Wizard generates automated logistics recommendations powered by Google Gemini. While highly targeted based on your input parameters and usage habits, these templates serve as auxiliary suggestions only. It remains your absolute responsibility to double-verify physical expedition kit survival necessities.</p>

                  <p className="font-extrabold text-neutral-900 not-italic uppercase tracking-wider">4. Billing, Resource Quotas, & Tiers</p>
                  <p>We enforce hard quantitative thresholds on active checklists and gear tracking lists. Upgrading subscription tier limits (Free, Pro, Enterprise) modifies permitted allocations. Downgrading limits access to features like Kiosk duplicator mode and Travel Case sizing solvers.</p>
                </div>
              </div>

              {/* Privacy Policy */}
              <div className="bg-white p-8 sm:p-10 rounded-[2rem] border border-neutral-200 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center">
                    <Globe size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Privacy & Consent Policy</h3>
                    <p className="text-[10px] text-neutral-400 font-mono">LAST REVISED: MAY 29, 2026</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs leading-relaxed text-neutral-600 font-medium italic overflow-y-auto max-h-[350px] pr-2">
                  <p className="font-extrabold text-neutral-900 not-italic uppercase tracking-wider">1. Information We Collect</p>
                  <p>We collect essential operational parameters required to track your equipment. This includes name, organization identifiers, role levels, active list counts, and your physical container weight specifications. We also track recent interface events to learn user habits (e.g. visited tabs) to train Dukey Assistant to furnish relevant advice.</p>
                  
                  <p className="font-extrabold text-neutral-900 not-italic uppercase tracking-wider">2. How Your Data Is Secured</p>
                  <p>We leverage Firestore enterprise authentication and rule sets to isolate accounts. Standard operators cannot read across organization boundaries or private project details. Stories published inside the Help Center are visible globally to all authenticated Packer Tools operators.</p>

                  <p className="font-extrabold text-neutral-900 not-italic uppercase tracking-wider">3. No Secondary Sharing</p>
                  <p>We never compile, rent, or lease your equipment manifests, asset tags, billing profiles, or custom inventories to any external third-party advertisers. All telemetry remains isolated inside Cloud Run vaults.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Support footer segment */}
      <section className="bg-neutral-900 text-white p-10 sm:p-14 rounded-[2.5rem] space-y-8 relative overflow-hidden shadow-xl" id="direct-assistance-panel">
        <div className="relative z-10 space-y-4">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-md">
            <MessageCircle size={26} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Need Direct Assistance?</h2>
            <p className="text-neutral-400 max-w-sm font-semibold text-sm italic">Our operational team is available 24/7 for high-stakes expedition coordinates.</p>
          </div>
          <div className="flex flex-wrap gap-3 pt-4">
            <button className="flex items-center gap-2 bg-primary text-white px-6 py-4 rounded-xl font-black uppercase tracking-wider text-[10px] hover:scale-[1.02] active:scale-95 transition">
              <MessageCircle size={16} />
              <span>Start Live Chat</span>
            </button>
            <button className="flex items-center gap-2 bg-white/5 text-white px-6 py-4 rounded-xl font-black uppercase tracking-wider text-[10px] hover:bg-white/10 transition border border-white/10">
              <Mail size={16} />
              <span>Submit Ticket</span>
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      </section>

      {/* 2. SUBMIT FLIGHT LOG MODAL */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-xl rounded-[2.5rem] border border-neutral-100 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-6 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <h3 className="font-black uppercase tracking-tight text-sm">Publish New Flight Log</h3>
              </div>
              <button 
                onClick={() => setIsSubmitModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateStory} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Chronicle Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mount Rainier Packing Prep Rules"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Category Tag</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs font-bold"
                  >
                    <option>Camera & Productions</option>
                    <option>Outdoor Expedition</option>
                    <option>IT & Network</option>
                    <option>General Planning</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Author Display Name</label>
                  <input
                    type="text"
                    placeholder="Operator Name"
                    value={newAuthorName}
                    onChange={(e) => setNewAuthorName(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Brief Excerpt</label>
                <input
                  type="text"
                  placeholder="A one-sentence summary of the chronicle..."
                  value={newExcerpt}
                  onChange={(e) => setNewExcerpt(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Full Expedition Writeup</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Tell your story. Explain how you setup, audited weight, packed elements, survived challenging parameters, or managed inventory..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-xs font-medium italic"
                />
              </div>

              <div className="pt-4 border-t border-neutral-150 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-3 bg-primary text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:scale-100"
                >
                  {isSubmitting ? "Uploading Logs..." : "Submit to Arena"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 3. FLIGHT LOG VIEW DETAIL MODAL */}
      {selectedStoryForView && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-xl rounded-[2.5rem] border border-neutral-100 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Header info */}
            <div className="p-6 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-primary" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Operator Chronicle Log</span>
              </div>
              <button 
                onClick={() => setSelectedStoryForView(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-neutral-100 text-neutral-700 rounded-md text-[8px] font-black uppercase tracking-wider">
                    {selectedStoryForView.category}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono italic">{selectedStoryForView.createdAt}</span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-neutral-900">{selectedStoryForView.title}</h3>
                
                {selectedStoryForView.excerpt && (
                  <p className="text-sm text-neutral-400 font-bold italic leading-relaxed border-l-4 border-primary pl-4 py-1">
                    "{selectedStoryForView.excerpt}"
                  </p>
                )}
              </div>

              {/* Author Strip */}
              <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl">
                <div className="w-10 h-10 bg-neutral-900 text-white font-black text-sm rounded-full flex items-center justify-center uppercase">
                  {selectedStoryForView.authorName ? selectedStoryForView.authorName.charAt(0) : 'O'}
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-neutral-900">{selectedStoryForView.authorName || 'Anonymous Master'}</h5>
                  <p className="text-[10px] text-neutral-500 font-medium italic">Verified Field Analyst | {selectedStoryForView.authorEmail || ''}</p>
                </div>
              </div>

              {/* Content body */}
              <div className="space-y-4">
                <p className="text-neutral-700 text-sm leading-relaxed font-medium italic whitespace-pre-line bg-neutral-50 p-6 rounded-2xl border border-neutral-150">
                  {selectedStoryForView.content}
                </p>
              </div>

              {/* Upvote triggers inside details */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-150">
                <button
                  onClick={() => handleLikeStory(selectedStoryForView)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-colors ${
                    likedStories.has(selectedStoryForView.id)
                      ? 'bg-rose-50 text-rose-500 hover:text-rose-600'
                      : 'bg-neutral-50 text-neutral-500 hover:text-rose-500 hover:bg-rose-50/50'
                  }`}
                >
                  <Heart size={14} className={likedStories.has(selectedStoryForView.id) ? 'fill-current' : ''} />
                  <span>Recommend ({selectedStoryForView.upvotes || 0})</span>
                </button>

                <button
                  onClick={() => setSelectedStoryForView(null)}
                  className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition hover:bg-neutral-800"
                >
                  Close Log
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
