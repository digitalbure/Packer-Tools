import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, LayoutDashboard, Package, ClipboardCheck, Server, 
  Briefcase, Sparkles, Truck, Users, Building, Sliders, 
  LayoutGrid, Wrench, User, HelpCircle, Plus, 
  Bot, Columns, Trash2, X, CornerDownLeft, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

// Custom interface for command item
interface CommandItem {
  id: string;
  name: string;
  category: 'Modules' | 'Actions' | 'Recent Views';
  keywords: string;
  path?: string;
  action?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface CommandPaletteProps {
  onToggleSidebar?: () => void;
}

export default function CommandPalette({ onToggleSidebar }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [recentViews, setRecentViews] = useState<string[]>([]);

  // Toggle Command Palette
  const togglePalette = () => {
    setIsOpen(prev => !prev);
    setSearch('');
    setActiveIndex(0);
  };

  // Listen for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
      }
      
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Listen for custom trigger event
    const handleTrigger = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-command-palette', handleTrigger);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleTrigger);
    };
  }, [isOpen]);

  // Read Recent Views cache
  useEffect(() => {
    if (isOpen) {
      try {
        const recentStr = localStorage.getItem("packer_recent_views") || "[]";
        const recent = JSON.parse(recentStr);
        setRecentViews(recent.slice(0, 5)); // top 5 recent views
      } catch (e) {
        console.error("Error reading recent views:", e);
      }
      
      // Auto focus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Core set of commands & modules
  const commandList: CommandItem[] = [
    // Pages / Modules
    { 
      id: 'dash', 
      name: 'Dashboard Home', 
      category: 'Modules', 
      keywords: 'home dashboard main overview analytical details statistics widgets summary metrics charts panel', 
      path: '/dashboard', 
      icon: LayoutDashboard 
    },
    { 
      id: 'lib', 
      name: 'Gear Master Library', 
      category: 'Modules', 
      keywords: 'gear library assets products barcodes scanner inventories tools qr printer stock maintenance condition weight specs', 
      path: '/library', 
      icon: Package 
    },
    { 
      id: 'inv', 
      name: 'Sheet Inventories & Audits', 
      category: 'Modules', 
      keywords: 'inventories worksheet database checklists storage counts spreadsheet sheets stock verification details edit audit log', 
      path: '/inventory', 
      icon: ClipboardCheck 
    },
    { 
      id: 'racks', 
      name: 'Warehouse Racks Dashboard', 
      category: 'Modules', 
      keywords: 'racks warehousing positions location slots shelves grid allocation setup inventory layout physical structures storage module design', 
      path: '/racks', 
      icon: Server 
    },
    { 
      id: 'projects', 
      name: 'Project Briefs & Coordinates', 
      category: 'Modules', 
      keywords: 'projects assignments schedules tasks files checklists documents details coordinate lists events flight planning schedules travel jobs tracking', 
      path: '/projects', 
      icon: Briefcase 
    },
    { 
      id: 'ai-wizard', 
      name: 'AI Template Creator (Wizard)', 
      category: 'Modules', 
      keywords: 'ai assistant magic template builder recommendations interactive prompts intelligent creator smart guidelines strategy packing templates checklist wizard', 
      path: '/ai-wizard', 
      icon: Sparkles 
    },
    { 
      id: 'logistics', 
      name: 'Logistics Dispatch Control', 
      category: 'Modules', 
      keywords: 'logistics fleet vehicles trucks delivery drivers route tracker dispatch transport delivery map calendars departure arrivals schedules transit', 
      path: '/logistics', 
      icon: Truck 
    },
    { 
      id: 'contacts', 
      name: 'Contacts & External Signees', 
      category: 'Modules', 
      keywords: 'contacts team directory users email telephone numbers signatures suppliers contractors vendors clients members directories profiles', 
      path: '/contacts', 
      icon: Users 
    },
    { 
      id: 'org', 
      name: 'Organization Core Hub', 
      category: 'Modules', 
      keywords: 'organization details company setup configurations departments business hierarchy sub-groups members admins teams tenants workspace logs', 
      path: '/organization', 
      icon: Building 
    },
    { 
      id: 'scenario', 
      name: 'Loadout Scenario Simulator', 
      category: 'Modules', 
      keywords: 'scenario simulations calculator airline baggage flight limits baggage sizing parameters weight solver custom setups specs testing', 
      path: '/scenario-builder', 
      icon: Sliders 
    },
    { 
      id: 'systems', 
      name: 'Modular Systems Builder', 
      category: 'Modules', 
      keywords: 'modular systems builders diagrams wires schema audio video rigs signal connections wiring rig designer physical technical builders assemblies blocks layouts', 
      path: '/systems-builder', 
      icon: LayoutGrid 
    },
    { 
      id: 'tooling', 
      name: 'Tooling Inventory Lists', 
      category: 'Modules', 
      keywords: 'tooling custom kit list tools boxes checklists mechanical specifics electronic repair instruments toolkit technical custom pack checklists lists', 
      path: '/tooling', 
      icon: Wrench 
    },
    { 
      id: 'profile', 
      name: 'Profile Settings & Layout', 
      category: 'Modules', 
      keywords: 'user profile preferences layout avatar details email password secure theme dark mode workspace settings details edit account', 
      path: '/profile', 
      icon: User 
    },
    { 
      id: 'help', 
      name: 'Help Center & FAQs', 
      category: 'Modules', 
      keywords: 'help manual guides system support knowledge database books reference tickets questions FAQ issues tutorials instructions', 
      path: '/help', 
      icon: HelpCircle 
    },

    // Global Actions
    { 
      id: 'act-add-gear', 
      name: 'Action: Add New Gear Asset', 
      category: 'Actions', 
      keywords: 'add new gear manual import sheets scanner camera image barcode creation templates registry items details accessories pricing', 
      action: 'add-gear', 
      icon: Plus 
    },
    { 
      id: 'act-open-dukey', 
      name: 'Action: Consult Dukey AI Assistant', 
      category: 'Actions', 
      keywords: 'consult chat dialogue advice coaching dukey robot bot questions intelligence prompt answers helper guidelines strategy list builder conversation support panel', 
      action: 'open-dukey', 
      icon: Bot 
    },
    { 
      id: 'act-toggle-sidebar', 
      name: 'Action: Toggle Sidebar Layout', 
      category: 'Actions', 
      keywords: 'toggle sidebar visual screen layout navigation drawer view collapse expand scale layout width hide show side bar', 
      action: 'toggle-sidebar', 
      icon: Columns 
    },
    { 
      id: 'act-clear-cache', 
      name: 'Action: Reset History Cache & Recents', 
      category: 'Actions', 
      keywords: 'clear clear-cache reset erase storage history logs recent path lists cache reset fresh wipes index', 
      action: 'clear-cache', 
      icon: Trash2 
    }
  ];

  // Dynamic Recent Views Commands
  const recentCommands: CommandItem[] = recentViews.map((viewName, index) => {
    // Find matching command template to inherit path/icon
    const matchedCmd = commandList.find(c => c.name.toLowerCase() === viewName.toLowerCase() || viewName.toLowerCase().includes(c.name.toLowerCase()));
    return {
      id: `recent-${index}`,
      name: `Return to: ${viewName}`,
      category: 'Recent Views',
      keywords: 'recent views history pop backward navigation recall',
      path: matchedCmd?.path || '/dashboard',
      icon: matchedCmd?.icon || LayoutDashboard
    };
  });

  // Comprehensive commands list
  const allCommands = [...commandList, ...recentCommands];

  // Filter commands by search
  const filteredCommands = allCommands.filter(cmd => {
    if (!search.trim()) {
      // Show modules and actions by default, excluding already displayed recents to avoid duplicates
      return cmd.category !== 'Recent Views';
    }
    const cleanSearch = search.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(cleanSearch) ||
      cmd.category.toLowerCase().includes(cleanSearch) ||
      cmd.keywords.toLowerCase().includes(cleanSearch) ||
      (cmd.path && cmd.path.toLowerCase().includes(cleanSearch))
    );
  });

  // Handle key navigation inside palette
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!filteredCommands.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(filteredCommands[activeIndex]);
    }
  };

  // Execute Command action
  const executeCommand = (cmd: CommandItem) => {
    if (!cmd) return;

    setIsOpen(false);

    if (cmd.path) {
      navigate(cmd.path);
      toast.info(`Navigated to ${cmd.name}`);
    } else if (cmd.action) {
      switch (cmd.action) {
        case 'add-gear':
          // Set addGear=true search param to trigger the Modal
          setSearchParams({ addGear: 'true' });
          toast.success("Add Gear Modal activated");
          break;
        case 'open-dukey':
          // Dispatch custom window event
          window.dispatchEvent(new CustomEvent('open-dukey'));
          toast.success("Consulting Dukey Assistant");
          break;
        case 'toggle-sidebar':
          if (onToggleSidebar) {
            onToggleSidebar();
          } else {
            // Find sidebar trigger button in DOM or dispatch event
            const btn = document.getElementById('sidebar-collapse-trigger') as HTMLButtonElement;
            if (btn) {
              btn.click();
            } else {
              toast.warning("Sidebar toggle trigger not found");
            }
          }
          break;
        case 'clear-cache':
          localStorage.removeItem("packer_recent_views");
          setRecentViews([]);
          toast.success("Recent navigation history cache cleared successfully.");
          break;
        default:
          toast.warning("Unknown command action");
      }
    }
  };

  // Close when clicking outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Floating status shortcut hint button - positioned beautifully in desktop bottom-right page container, non-intrusive */}
      <div className="fixed bottom-6 right-20 z-[80] hidden md:flex items-center">
        <button
          onClick={togglePalette}
          className="bg-white/80 backdrop-blur border border-neutral-200 hover:border-neutral-300 hover:bg-white text-neutral-500 hover:text-neutral-800 rounded-xl px-3 py-1.5 shadow-sm transition flex items-center gap-2 text-[10px] uppercase font-black tracking-widest cursor-pointer select-none active:scale-95"
          title="Open Central Command Console (⌘K)"
          id="global-command-console-launcher"
        >
          <Search size={12} className="text-neutral-400" />
          <span>Console</span>
          <div className="flex items-center gap-0.5 ml-1 select-none">
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-300 text-[9px] text-neutral-600 font-mono">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-300 text-[9px] text-neutral-600 font-mono">K</kbd>
          </div>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div 
            className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[200] flex items-start justify-center p-4 pt-[10vh] md:pt-[15vh] overflow-y-auto"
            onClick={handleOverlayClick}
            id="command-palette-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[520px]"
              ref={containerRef}
              id="command-palette-container"
            >
              {/* Header / Search Area */}
              <div className="flex items-center border-b border-neutral-100 px-5 py-4 shrink-0 gap-3">
                <Search size={20} className="text-neutral-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a page, action, or keyword to search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-sm text-neutral-900 placeholder-neutral-400 outline-none border-none py-1 h-8 font-sans"
                  id="command-palette-search-input"
                />
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-600 transition shrink-0 cursor-pointer"
                  title="Close command console"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Instructions Bar */}
              <div className="px-5 py-1.5 bg-neutral-50/50 border-b border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500 select-none shrink-0 font-mono uppercase tracking-wider">
                <span>Central Search Console</span>
                {filteredCommands.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline">Use ↑↓ keys to select</span>
                    <span className="hidden sm:inline">↵ to run</span>
                  </div>
                )}
              </div>

              {/* Command Items List */}
              <div className="flex-1 overflow-y-auto p-2" id="command-palette-items-list">
                {filteredCommands.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-neutral-105/50 rounded-2xl flex items-center justify-center mx-auto text-neutral-400 mb-3 animate-bounce">
                      <HelpCircle size={20} />
                    </div>
                    <p className="text-xs font-bold text-neutral-700">No matching tools or entries found</p>
                    <p className="text-[10px] text-neutral-450 mt-1 max-w-xs mx-auto">Try typing broad terms like "library", "sheets", "rack", or consult our Dukey AI assistant.</p>
                  </div>
                ) : (
                  // Group commands by Category
                  ['Recent Views', 'Modules', 'Actions'].map(category => {
                    const catItems = filteredCommands.filter(c => c.category === category);
                    if (catItems.length === 0) return null;

                    return (
                      <div key={category} className="mb-3 last:mb-1">
                        <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[#0066cc] select-none mb-1">
                          {category}
                        </div>
                        <div className="space-y-0.5">
                          {catItems.map((cmd) => {
                            // Find matching index in filteredCommands array to check if active
                            const totalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                            const isActive = totalIndex === activeIndex;

                            return (
                              <button
                                key={cmd.id}
                                onClick={() => executeCommand(cmd)}
                                onMouseEnter={() => setActiveIndex(totalIndex)}
                                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all duration-150 text-left cursor-pointer group ${
                                  isActive 
                                    ? 'bg-neutral-100/90 text-neutral-900 border-l-[3.5px] border-[#0066cc]' 
                                    : 'text-neutral-600 hover:text-neutral-900 bg-transparent border-l-[3.5px] border-transparent'
                                }`}
                                id={`command-item-${cmd.id}`}
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <div className={`p-2 rounded-xl shrink-0 transition ${
                                    isActive ? 'bg-[#0066cc]/10 text-[#0066cc]' : 'bg-neutral-50 text-neutral-400 group-hover:bg-neutral-100 group-hover:text-neutral-600'
                                  }`}>
                                    <cmd.icon size={16} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold font-sans tracking-tight text-neutral-800">
                                      {cmd.name}
                                    </div>
                                    {cmd.path && (
                                      <div className={`text-[10px] font-mono mt-0.5 transition ${
                                        isActive ? 'text-neutral-500' : 'text-neutral-400'
                                      }`}>
                                        {cmd.path}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1.5 text-neutral-400 shrink-0">
                                  {isActive ? (
                                    <div className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider bg-neutral-200/50 text-neutral-600 px-2 py-0.5 rounded-lg animate-fade-in shrink-0">
                                      <span>Select</span>
                                      <CornerDownLeft size={8} />
                                    </div>
                                  ) : (
                                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition translate-x-[-4px] group-hover:translate-x-0" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Command Palette Footer */}
              <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500 shrink-0 select-none">
                <div className="flex items-center gap-1 shrink-0 font-sans">
                  <span>Press</span> 
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-[9px] text-neutral-600 font-mono shadow-sm">esc</kbd> 
                  <span>to shut console</span>
                </div>
                <div className="flex items-center gap-1 text-neutral-400 text-[9px] italic shrink-0">
                  <span>Packer Tools Power Console</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
