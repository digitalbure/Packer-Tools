import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronRight, Book, MessageCircle, Mail, Phone, ExternalLink, Shield, Truck, Camera, Layers, Zap, Box, ListChecks, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';

const categories = [
  { id: 'getting-started', name: 'Getting Started', icon: <Book size={20} /> },
  { id: 'packing-lists', name: 'Manifests', icon: <ListChecks size={20} /> },
  { id: 'gear-library', name: 'Gear Library', icon: <Camera size={20} /> },
  { id: 'ai-wizard', name: 'AI Wizard', icon: <Zap size={20} /> },
  { id: 'moving', name: 'Projects', icon: <Truck size={20} /> },
  { id: 'billing', name: 'Billing', icon: <Shield size={20} /> },
];

const articles = [
  {
    id: 'setup-profile',
    title: "How to set up your Profile",
    description: "Your profile is your digital ID across all manifests and projects. Here is how to get it ready.",
    category: 'getting-started',
    steps: [
      { title: "Navigate to Profile", description: "Select the 'Profile' option from the bottom of your primary sidebar." },
      { title: "Update Core Data", description: "Enter your full name, professional title, and company name. This data appears on all shared packing lists." },
      { title: "Audit Permissions", description: "Review your current plan limits (tokens, projects, lists) at the bottom of the profile page." }
    ],
    tips: ["A clear company name helps clients identify your manifests instantly."]
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
  }
];

interface HelpCenterProps {
  user: UserProfile | null;
}

export default function HelpCenter({ user }: HelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category'); // values: null means all guides

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center space-y-8">
        <div className="w-24 h-24 bg-neutral-100 rounded-[2.5rem] flex items-center justify-center text-neutral-400">
          <Shield size={48} />
        </div>
        <div className="space-y-2 max-w-sm">
          <h1 className="text-4xl font-black uppercase tracking-tighter">Portal Locked</h1>
          <p className="text-neutral-500 font-medium italic">Help Center is reserved for active operators. Please sign in to access training docs and support.</p>
        </div>
      </div>
    );
  }

  const visibleCategories = categories.filter(cat => 
    cat.id !== 'admin' || user.isSuperAdmin
  );

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         article.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? article.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-12 px-4 sm:px-8">
      <header className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
          <Book size={14} />
          <span>Operational Training</span>
        </div>
        <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tighter leading-[0.8] text-neutral-900">
           Knowledge <br/> <span className="text-primary italic">Base</span>
        </h1>
        <div className="max-w-2xl mx-auto relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-300 group-focus-within:text-primary transition-colors" size={24} />
          <input
            type="text"
            placeholder="Search guides, project parameters, or gear documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-16 pr-8 py-6 bg-white border border-neutral-100 rounded-[2.5rem] shadow-xl focus:ring-4 focus:ring-primary/10 outline-none transition text-lg font-medium"
          />
        </div>
      </header>

      <div className="space-y-10">
        <main className="space-y-10">
          <div className="grid gap-10">
            {filteredArticles.length > 0 ? (
              filteredArticles.map((article, idx) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-10 sm:p-14 rounded-[3.5rem] border border-neutral-100 shadow-sm hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group"
                >
                  <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-neutral-900 text-white rounded-full text-[8px] font-black uppercase tracking-widest">
                            How-To Guide
                          </span>
                          <span className="px-3 py-1 bg-primary/5 text-primary rounded-full text-[8px] font-black uppercase tracking-widest border border-primary/10">
                            {article.category.replace('-', ' ')}
                          </span>
                        </div>
                        <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter leading-tight group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-neutral-500 font-medium italic leading-relaxed text-lg max-w-xl">
                          {article.description}
                        </p>
                      </div>
                      <div className="hidden sm:block p-6 bg-neutral-50 rounded-[2rem] text-primary self-start transition-transform hover:scale-110">
                        <Book size={32} />
                      </div>
                    </div>

                    {article.steps && (
                      <div className="grid gap-4 py-8 border-y border-neutral-50">
                        {article.steps.map((step, sIdx) => (
                          <div key={sIdx} className="flex gap-6 group/step">
                            <div className="flex-shrink-0 w-10 h-10 bg-neutral-900 text-white rounded-2xl flex items-center justify-center font-black text-sm transition-transform group-hover/step:translate-x-2 duration-300">
                              {sIdx + 1}
                            </div>
                            <div className="space-y-1 pt-1">
                              <h4 className="text-sm font-black uppercase tracking-widest text-neutral-900">{step.title}</h4>
                              <p className="text-neutral-500 text-sm italic">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {article.tips && (
                      <div className="bg-primary/5 p-8 rounded-[2rem] border border-primary/10 flex gap-4">
                        <div className="text-primary pt-1"><Zap size={20} /></div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-black uppercase tracking-widest text-primary">Pro Tip</h4>
                          {article.tips.map((tip, tIdx) => (
                            <p key={tIdx} className="text-neutral-600 text-sm font-medium italic leading-relaxed">
                              {tip}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-4">
                       <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-primary transition-colors">
                         <span>Share Guide</span>
                         <ExternalLink size={14} />
                       </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-neutral-100">
                <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-200 mx-auto mb-6">
                  <Search size={40} />
                </div>
                <p className="text-neutral-400 font-bold uppercase tracking-widest text-xs">No records matching your parameters.</p>
              </div>
            )}
          </div>

          <section className="bg-neutral-900 text-white p-12 sm:p-20 rounded-[4rem] space-y-10 relative overflow-hidden shadow-2xl">
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center shadow-lg shadow-primary/20">
                <MessageCircle size={32} />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none">Need Direct <br/> <span className="text-primary italic">Assistance?</span></h2>
                <p className="text-neutral-400 max-w-md font-medium text-lg italic">Our operational support team is available 24/7 for high-stakes logistics coordination.</p>
              </div>
              <div className="flex flex-wrap gap-4 pt-6">
                <button className="flex items-center gap-3 bg-primary text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition shadow-xl shadow-primary/20">
                  <MessageCircle size={20} />
                  <span>Start Live Chat</span>
                </button>
                <button className="flex items-center gap-3 bg-white/5 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition border border-white/10">
                  <Mail size={20} />
                  <span>Send Ticket</span>
                </button>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
          </section>
        </main>
      </div>
    </div>
  );
}
