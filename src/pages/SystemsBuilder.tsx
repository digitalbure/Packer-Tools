import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, GearItem, BuildItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, 
  Plus, 
  Trash2, 
  Layers, 
  Zap, 
  DollarSign, 
  Weight, 
  Package, 
  Search, 
  CheckCircle2, 
  ChevronDown, 
  TrendingUp, 
  LayoutGrid, 
  Cable, 
  Construction, 
  RefreshCw,
  FolderPlus,
  Hammer,
  ShieldAlert,
  Info,
  BookOpen,
  Cpu,
  Download,
  Import,
  FolderClosed,
  PlusCircle,
  FolderLock,
  ChevronRight,
  Globe,
  Settings,
  ShieldCheck,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface SystemsBuild {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

// Full product database from premium suppliers
const CATALOGUE_DATABASE = [
  // Blackmagic Design Catalog
  { name: 'ATEM Constellation 8K Mixer', category: 'Switcher', brand: 'Blackmagic Design', model: 'Constellation 8K', price: 9995, type: 'component' as const, supplierId: 'blackmagic', specs: '40 x 12G-SDI inputs, 24 x 12G-SDI aux outputs, 4 M/Es, SuperSource' },
  { name: 'ATEM 2 M/E Advanced Panel', category: 'Control Panel', brand: 'Blackmagic Design', model: '2 M/E Panel', price: 5995, type: 'component' as const, supplierId: 'blackmagic', specs: '2 Independent system control rows, 20 crosspoint buttons, highres LCD menus' },
  { name: 'ATEM SDI Pro ISO Switcher', category: 'Switcher', brand: 'Blackmagic Design', model: 'ATEM SDI Pro', price: 795, type: 'component' as const, supplierId: 'blackmagic', specs: '4 sdi inputs, stream overlays, H.264 engine, multi-view outputs' },
  { name: 'Smart Videohub 12G 40x40', category: 'Router', brand: 'Blackmagic Design', model: 'Videohub 40', price: 2995, type: 'component' as const, supplierId: 'blackmagic', specs: 'Multi-rate 12G-SDI, LCD screen, direct dial inputs controls' },
  { name: 'HyperDeck Studio 4K Pro Recorder', category: 'Recorder', brand: 'Blackmagic Design', model: 'HyperDeck Studio', price: 1595, type: 'component' as const, supplierId: 'blackmagic', specs: 'Dual SD slots, dual SSD slots, recording in Prores, DNx, H.264 up to 2160p60' },
  { name: 'DeckLink Quad 2 PCIe Card', category: 'Capture Card', brand: 'Blackmagic Design', model: 'Quad 2 PCIe', price: 995, type: 'component' as const, supplierId: 'blackmagic', specs: '8-channel bidirectional SDI capture card for workstations' },
  { name: 'Teranex AV Broadcast Converter', category: 'Converter', brand: 'Blackmagic Design', model: 'Teranex AV Model', price: 1695, type: 'component' as const, supplierId: 'blackmagic', specs: 'Up/down/cross converter with 1089 conversions, low latency SD/HD/Ultra HD' },
  { name: 'Pocket Cinema Camera 6K Pro', category: 'Camera', brand: 'Blackmagic Design', model: 'BMPCC 6K Pro', price: 2535, type: 'component' as const, supplierId: 'blackmagic', specs: 'Super 35 sensor, motorized ND filters, 1500 nits HDR tilting display' },

  // Lectrosonics Catalog
  { name: 'DSQD 4-Channel Receiver Unit', category: 'Wireless Receiver', brand: 'Lectrosonics', model: 'DSQD', price: 6100, type: 'component' as const, supplierId: 'lectrosonics', specs: 'Four-channel digital half-rack receiver, Dante outputs, 256-bit encryption' },
  { name: 'DCR822 Dual-Channel Receiver', category: 'Wireless Receiver', brand: 'Lectrosonics', model: 'DCR822', price: 3950, type: 'component' as const, supplierId: 'lectrosonics', specs: 'Dual-channel digital slot receiver, vector diversity, microSD onboard recording' },
  { name: 'DPR Digital Plug-On Transmitter', category: 'Transmitter', brand: 'Lectrosonics', model: 'DPR-A', price: 1750, type: 'component' as const, supplierId: 'lectrosonics', specs: 'Digital wireless plug-on transmitter with phantom power, high power RF outputs' },
  { name: 'DBu Digital Beltpack Transmitter', category: 'Transmitter', brand: 'Lectrosonics', model: 'DBu-A', price: 1620, type: 'component' as const, supplierId: 'lectrosonics', specs: 'Digital wireless beltpack, wideband tuning, rugged aluminum layout' },
  { name: 'HMa Digital Plug-on Transmitter', category: 'Transmitter', brand: 'Lectrosonics', model: 'HMa Wideband', price: 1450, type: 'component' as const, supplierId: 'lectrosonics', specs: 'UHF Plug-on transmitter with selectable phantom, digital hybrid audio' },
  { name: 'SRC Dual-Channel Slot Mount Receiver', category: 'Wireless Receiver', brand: 'Lectrosonics', model: 'SRC Slot', price: 2790, type: 'component' as const, supplierId: 'lectrosonics', specs: 'Camera-mount dual diversity receiver, super slot compatible' },

  // Shure Pro Catalog
  { name: 'ULXD4D Dual Wireless Receiver', category: 'Wireless Receiver', brand: 'Shure', model: 'ULXD4D', price: 2950, type: 'component' as const, supplierId: 'shure', specs: 'Dual-channel digital wireless, 24-bit audio, Dante networking, encryption' },
  { name: 'ULXD2/SM58 Handheld Transmitter', category: 'Transmitter', brand: 'Shure', model: 'ULXD2-SM58', price: 470, type: 'component' as const, supplierId: 'shure', specs: 'Digital handheld transmitter paired with legendary SM58 capsule' },
  { name: 'ULXD1 Bodypack Transmitter', category: 'Transmitter', brand: 'Shure', model: 'ULXD1 Wide', price: 410, type: 'component' as const, supplierId: 'shure', specs: 'Digital bodypack transmitter with high spectral efficiency' },
  { name: 'PSM 1000 IEM Transmitters Pair', category: 'In-Ear Monitor', brand: 'Shure', model: 'PSM1000', price: 4995, type: 'component' as const, supplierId: 'shure', specs: 'Dual transmitter network, stereo/mono, pristine RF stability, Ethernet control' },
  { name: 'SM7B Studio Vocal Microphone', category: 'Microphone', brand: 'Shure', model: 'SM7B', price: 399, type: 'component' as const, supplierId: 'shure', specs: 'Cardioid studio microphone with flat, wide-range frequency response' },

  // Middle Atlantic Catalog
  { name: 'EGR-4428 EGR Series Rack Enclosure', category: 'Rack Enclosure', brand: 'Middle Atlantic', model: 'EGR-4428', price: 1195, type: 'fixture' as const, supplierId: 'middleatlantic', specs: '44U height, 28" depth premium mobile frame, side ventilation paneling' },
  { name: 'UTS1 1U Utility Clamping Shelf', category: 'Rack Hardware', brand: 'Middle Atlantic', model: 'UTS1-Shelf', price: 75, type: 'fixture' as const, supplierId: 'middleatlantic', specs: '1U clamping utility shelf, holds up to 50 lbs hardware equipment' },
  { name: 'PDT-1015C-NS Power Strip System', category: 'Power Distribution', brand: 'Middle Atlantic', model: 'PDT-1015C', price: 165, type: 'fixture' as const, supplierId: 'middleatlantic', specs: 'Thin-profile 10-outlet vertical power distribution strip with surge suppression' },
  { name: 'Premium Rack Fan Panel 2U', category: 'Rack Cooling', brand: 'Middle Atlantic', model: 'QFAN-2', price: 220, type: 'fixture' as const, supplierId: 'middleatlantic', specs: 'Dual ultra-quiet exhaust fans with automated temperature control sensors' },

  // Sennheiser Wireless Catalog
  { name: 'EW-DX EM 2 Receiver Unit', category: 'Wireless Receiver', brand: 'Sennheiser', model: 'EW-DX-EM2', price: 1199, type: 'component' as const, supplierId: 'sennheiser', specs: 'Dual-channel half-rack wireless receiver, 134 dB dynamic range, network active' },
  { name: 'EW-DX SKM Handheld Mic Transmitter', category: 'Transmitter', brand: 'Sennheiser', model: 'EW-DX-SKM', price: 399, type: 'component' as const, supplierId: 'sennheiser', specs: 'Digital handheld transmitter, quick mute switch, programmable e-ink display' },
  { name: 'EW-DX SK Bodypack Transmitter', category: 'Transmitter', brand: 'Sennheiser', model: 'EW-DX-SK', price: 349, type: 'component' as const, supplierId: 'sennheiser', specs: 'Digital beltpack transmitter with 3.5mm jack audio input' },
  { name: 'MKE 600 Directional Shotgun Mic', category: 'Microphone', brand: 'Sennheiser', model: 'MKE600', price: 329, type: 'component' as const, supplierId: 'sennheiser', specs: 'Highly directional shotgun speech microphone, battery/phantom power' },
  { name: 'HD 25 High Noise Headphones', category: 'Monitors', brand: 'Sennheiser', model: 'HD-25-1-II', price: 149, type: 'component' as const, supplierId: 'sennheiser', specs: 'Professional closed-back monitoring headphones, high ambient noise attenuation' }
];

const SUPPLIERS = [
  { id: 'blackmagic', name: 'Blackmagic Design', category: 'AV, switchers, routing and capture converters', logoBg: 'bg-indigo-50 text-indigo-700', rating: 'Enterprise System partner', itemsCount: 8 },
  { id: 'lectrosonics', name: 'Lectrosonics Inc.', category: 'High-end wireless, beltpacks receivers RF audio', logoBg: 'bg-amber-50 text-amber-700', rating: 'Premium RF integration', itemsCount: 6 },
  { id: 'shure', name: 'Shure Pro Audios', category: 'Axient Audio, digital microphone arrays & IEM transmitters', logoBg: 'bg-emerald-50 text-emerald-700', rating: 'Gold standard industry standard', itemsCount: 5 },
  { id: 'middleatlantic', name: 'Middle Atlantic', category: 'Standard server enclosures, thermal racks, power distribution strips', logoBg: 'bg-sky-50 text-sky-700', rating: 'Structural rig framing', itemsCount: 4 },
  { id: 'sennheiser', name: 'Sennheiser Pro', category: 'Broadcasting monitors, speech shotguns, RF transmitters', logoBg: 'bg-rose-50 text-rose-700', rating: 'Global broadcasting standard', itemsCount: 5 }
];

const COMMON_CATALOG = [
  { name: 'vMix Pro Live Production Software', category: 'Software', brand: 'vMix', model: 'Pro', price: 1200, type: 'component' as const, specs: 'Stream and switch live audio/video sources, multi-coder' },
  { name: 'vMix Super Server Reference Rack Computer', category: 'Workstation', brand: 'Custom Rig', model: 'vMix Rack Core V2', price: 4500, type: 'component' as const, specs: '12-core Xenon, dual RTX-4080s, highspeed storage raid' },
  { name: '12U Shock Mount Transit Case Box', category: 'Transit Enclosures', brand: 'Protective Case', model: '12U Heavy Shock Mount', price: 1200, type: 'component' as const, specs: 'Waterproof outer cage with vibration isolating dampers' },
  { name: 'Professional SDI Video Cable Loom 5-way 20m', category: 'Cable Loom', brand: 'Belden Cable', model: 'SDI Loom 20m', price: 450, type: 'loom' as const, specs: 'Premium impedance matched lines with integrated outer loom wrapper' },
  { name: 'BNC to BNC Video Jumper Cable 1.5m', category: 'Cable Loom', brand: 'Generic Coax', model: 'BNC 1.5m jumper', price: 15, type: 'loom' as const, specs: 'Flexible coax patch cable for patchbays' },
  { name: 'Rackmount Heavy Tray Shelf 1U', category: 'Hardware Unit', brand: 'Server Rack', model: 'Flat Shelf 1U', price: 45, type: 'fixture' as const, specs: 'Solid steel non-ventilated mounting server tray' },
  { name: 'Premium Heavy Gaffer Tape Bundle black 3-pack', category: 'Consumable pack', brand: 'Gaffer Tech', model: 'Gaff Bundle 3x', price: 65, type: 'consumable' as const, specs: 'High-adhesiveness residue-free fabric camera tape' }
];

export default function SystemsBuilder({ user }: { user: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'projects' | 'catalogues' | 'ai_specs' | 'reflib'>('projects');
  
  const [builds, setBuilds] = useState<SystemsBuild[]>([]);
  const [activeBuild, setActiveBuild] = useState<SystemsBuild | null>(null);
  const [buildItems, setBuildItems] = useState<BuildItem[]>([]);
  const [gearLibrary, setGearLibrary] = useState<GearItem[]>([]);
  
  const [loadingBuilds, setLoadingBuilds] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  
  const [catalogSearch, setCatalogSearch] = useState('');
  const [gearSearch, setGearSearch] = useState('');
  
  // Create / Edit project metadata
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBuildName, setNewBuildName] = useState('');
  const [newBuildDesc, setNewBuildDesc] = useState('');
  
  // Custom manual component payload
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customItem, setCustomItem] = useState({
    name: '',
    category: 'component',
    brand: '',
    model: '',
    price: 0,
    quantity: 1,
    type: 'component' as 'component' | 'loom' | 'fixture' | 'consumable',
  });
  
  // AI specification onboarding parameters
  const [aiInput, setAiInput] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Supplier Catalogue Interactive States
  const [importedSuppliers, setImportedSuppliers] = useState<string[]>(() => {
    const saved = localStorage.getItem('systems_imported_suppliers');
    return saved ? JSON.parse(saved) : ['blackmagic']; // Default pre-imported brand
  });
  const [importingSupplierId, setImportingSupplierId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  // Sync state changes for imported suppliers
  useEffect(() => {
    localStorage.setItem('systems_imported_suppliers', JSON.stringify(importedSuppliers));
  }, [importedSuppliers]);

  // App-wide Auto save & disrupted session recovery for Systems Projects & AI spec inputs
  useEffect(() => {
    if (user?.uid) {
      const savedBuildName = localStorage.getItem(`systems_autosave_name_${user.uid}`);
      if (savedBuildName) {
        setNewBuildName(savedBuildName);
        toast.info("Resumed disrupted systems project name draft.");
      }
      
      const savedBuildDesc = localStorage.getItem(`systems_autosave_desc_${user.uid}`);
      if (savedBuildDesc) setNewBuildDesc(savedBuildDesc);

      const savedAiInput = localStorage.getItem(`systems_autosave_ai_${user.uid}`);
      if (savedAiInput) setAiInput(savedAiInput);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`systems_autosave_name_${user.uid}`, newBuildName);
    }
  }, [newBuildName, user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`systems_autosave_desc_${user.uid}`, newBuildDesc);
    }
  }, [newBuildDesc, user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`systems_autosave_ai_${user.uid}`, aiInput);
    }
  }, [aiInput, user?.uid]);

  // Sync Systems design projects list
  useEffect(() => {
    if (!user.uid) return;
    const q = query(collection(db, 'systemsBuilds'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemsBuild));
      setBuilds(fetched);
      
      // Initialize an illustrative project if there are absolutely no system projects exist yet
      if (fetched.length === 0 && !loadingBuilds) {
        try {
          await addDoc(collection(db, 'systemsBuilds'), {
            name: 'Broadcast Flypack Hub Rig',
            description: 'Modular high-bandwidth integration array supporting multi-camera studio workflows and web encoding grids.',
            ownerId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("SystemsBuilder: Error creating starter project:", err);
        }
      }
      
      if (fetched.length > 0) {
        if (!activeBuild || !fetched.some(f => f.id === activeBuild.id)) {
          setActiveBuild(fetched[0]);
        } else {
          const freshActive = fetched.find(f => f.id === activeBuild.id);
          if (freshActive) setActiveBuild(freshActive);
        }
      }
      setLoadingBuilds(false);
    }, (error) => {
      console.warn("SystemsBuilder: Failed to load projects:", error);
      setLoadingBuilds(false);
    });
    return unsub;
  }, [user.uid, loadingBuilds, activeBuild?.id]);

  // Sync Real Gear library
  useEffect(() => {
    if (!user.uid) return;
    const q = query(collection(db, 'users', user.uid, 'gearLibrary'));
    const unsub = onSnapshot(q, (snap) => {
      setGearLibrary(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem)));
    }, (error) => {
      console.warn("SystemsBuilder: Error syncing gear library:", error);
    });
    return unsub;
  }, [user.uid]);

  // Sync sandboxed items inside selected project
  useEffect(() => {
    if (!activeBuild) {
      setBuildItems([]);
      return;
    }
    setLoadingItems(true);
    const q = query(
      collection(db, 'buildItems'),
      where('projectId', '==', activeBuild.id),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setBuildItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BuildItem)));
      setLoadingItems(false);
    }, (error) => {
      console.warn("SystemsBuilder: Error syncing project components:", error);
      setLoadingItems(false);
    });
    return unsub;
  }, [activeBuild?.id, user.uid]);

  // Handle supplier catalog importing simulation
  const handleImportSupplierCatalog = (supplierId: string, supplierName: string) => {
    if (importedSuppliers.includes(supplierId)) {
      toast.info(`${supplierName} catalogue is already imported and synchronized!`);
      return;
    }
    
    setImportingSupplierId(supplierId);
    setImportProgress(0);
    
    const interval = setInterval(() => {
      setImportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setImportedSuppliers((prevSuppliers) => [...prevSuppliers, supplierId]);
          setImportingSupplierId(null);
          toast.success(`Successfully imported and compiled standard reference specifications catalog for ${supplierName}!`);
          return 100;
        }
        return prev + 20;
      });
    }, 180);
  };

  const handleCreateBuild = async () => {
    if (!newBuildName.trim()) {
      toast.error("Please enter a name for the systems design project.");
      return;
    }
    try {
      await addDoc(collection(db, 'systemsBuilds'), {
        name: newBuildName,
        description: newBuildDesc,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      // Clear auto-saved draft build name and description
      if (user?.uid) {
        localStorage.removeItem(`systems_autosave_name_${user.uid}`);
        localStorage.removeItem(`systems_autosave_desc_${user.uid}`);
      }
      setNewBuildName('');
      setNewBuildDesc('');
      setShowCreateModal(false);
      toast.success("New system design project initiated!");
    } catch (e) {
      toast.error("Failed to initialize system blueprint draft.");
    }
  };

  const handleDeleteBuild = async (buildId: string) => {
    if (!window.confirm("Are you sure you want to delete this System Project configuration? This will permanently wipe out its sandboxed component builds.")) return;
    try {
      await deleteDoc(doc(db, 'systemsBuilds', buildId));
      toast.success("System project configuration successfully deleted");
      if (activeBuild?.id === buildId) {
        setActiveBuild(null);
      }
    } catch (e) {
      toast.error("Could not delete project configuration.");
    }
  };

  const handleAddItemToSandbox = async (itemData: Partial<BuildItem>) => {
    if (!activeBuild) {
      toast.error("Please select or create an active System Project first!");
      return;
    }
    try {
      await addDoc(collection(db, 'buildItems'), {
        name: itemData.name,
        category: itemData.category || 'Other',
        brand: itemData.brand || '',
        model: itemData.model || '',
        price: itemData.price || 0,
        quantity: itemData.quantity || 1,
        type: itemData.type || 'component',
        projectId: activeBuild.id,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        isPushed: false
      });
      toast.success(`${itemData.name} added to ${activeBuild.name} blueprints sandbox!`);
    } catch (err) {
      toast.error("Failed to add reference component.");
    }
  };

  const handleAddCustomItem = async () => {
    if (!customItem.name.trim()) {
      toast.error("Brand name / piece nickname is required.");
      return;
    }
    await handleAddItemToSandbox(customItem);
    setCustomItem({
      name: '',
      category: 'component',
      brand: '',
      model: '',
      price: 0,
      quantity: 1,
      type: 'component'
    });
    setIsAddingCustom(false);
  };

  const handleUpdateItemQuantity = async (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      await deleteDoc(doc(db, 'buildItems', itemId));
      return;
    }
    await updateDoc(doc(db, 'buildItems', itemId), { quantity: newQty });
  };

  const handleUpdateItemPrice = async (itemId: string, customPrice: number) => {
    try {
      await updateDoc(doc(db, 'buildItems', itemId), { price: Math.max(0, customPrice) });
      toast.success("Blueprint unit quote customized");
    } catch (e) {
      toast.error("Price change failed");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteDoc(doc(db, 'buildItems', itemId));
    toast.success("Component deleted from virtual blueprint layout");
  };

  const handlePushToMainInventory = async (item: BuildItem) => {
    if (item.isPushed) return;
    try {
      const gearRef = await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), {
        ownerId: user.uid,
        orgId: user.orgId || null,
        name: item.name,
        category: item.category,
        brand: item.brand || '',
        model: item.model || '',
        quantity: item.quantity,
        price: item.price || 0,
        currency: 'USD',
        status: 'available',
        photoUrls: [],
        assetTag: `SYS-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'buildItems', item.id), {
        isPushed: true,
        pushedGearId: gearRef.id
      });
      toast.success(`${item.name} permanently deployed as a real asset into your Gear Library!`);
    } catch (err) {
      toast.error("Failed to push virtual item to physical gear array.");
    }
  };

  const handleAIOnboard = async () => {
    if (!aiInput.trim()) return;
    setIsAiAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: aiInput.startsWith('http') ? '' : aiInput,
          url: aiInput.startsWith('http') ? aiInput : ''
        })
      });
      const data = await res.json();
      
      const parsedItemSpec: Partial<BuildItem> = {
        name: data.name || (aiInput.startsWith('http') ? 'Analyzed Device Specs' : aiInput),
        brand: data.brand || 'Artificial Intelligence',
        model: data.model || 'Cognitive Spec',
        category: data.category || 'Production Switcher',
        price: data.price || 1500,
        type: 'component',
        quantity: 1,
      };

      await handleAddItemToSandbox(parsedItemSpec);
      if (user?.uid) {
        localStorage.removeItem(`systems_autosave_ai_${user.uid}`);
      }
      setAiInput('');
      toast.success("Intelligence Copilot successfully cataloged device payload & specifications!");
    } catch (e) {
      toast.error("Cognitive analysis offline. Deployed using manual heuristics.");
      await handleAddItemToSandbox({
        name: aiInput.length > 25 ? aiInput.substring(0, 25) + '...' : aiInput,
        category: 'Auxiliary Audio/Video',
        price: 250,
        quantity: 1,
        type: 'component'
      });
      if (user?.uid) {
        localStorage.removeItem(`systems_autosave_ai_${user.uid}`);
      }
      setAiInput('');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Compile active system metrics
  const totalCost = buildItems.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);
  const totalCount = buildItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
  
  // Custom estimated system weight helper
  const estimatedWeightLbs = buildItems.reduce((acc, item) => {
    const qty = item.quantity || 1;
    if (item.type === 'loom') return acc + (8 * qty);
    if (item.type === 'fixture') return acc + (1.5 * qty);
    if (item.type === 'consumable') return acc + (0.5 * qty);
    return acc + (14 * qty); // Hardware components weight default
  }, 0);

  // Generate current systems references catalogue list (Common items + items from imported brand lists)
  const fullAvailableCatalogue = [...COMMON_CATALOG];
  importedSuppliers.forEach((supId) => {
    const matchingProducts = CATALOGUE_DATABASE.filter(p => p.supplierId === supId);
    matchingProducts.forEach((prod) => {
      if (!fullAvailableCatalogue.some(c => c.name === prod.name)) {
        fullAvailableCatalogue.push(prod);
      }
    });
  });

  const filteredCatalog = fullAvailableCatalogue.filter(c => 
    c.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    c.category.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    c.brand.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const filteredGear = gearLibrary.filter(g => 
    g.name.toLowerCase().includes(gearSearch.toLowerCase()) ||
    (g.category && g.category.toLowerCase().includes(gearSearch.toLowerCase()))
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-16 px-4 md:px-8">
      {/* Page Header banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[#ff4f3a] text-white flex items-center justify-center shadow-lg shadow-[#ff4f3a]/20">
              <Hammer size={18} />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-800">Systems Designer Suite</h1>
          </div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">
            Architect, quote, and compile virtual hardware rigs & supplier Bills-Of-Materials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active project dropdown selector */}
          <div className="relative">
            <select
              value={activeBuild?.id || ''}
              onChange={(e) => {
                const selected = builds.find(b => b.id === e.target.value);
                if (selected) setActiveBuild(selected);
              }}
              className="appearance-none bg-neutral-50 hover:bg-neutral-105 text-black border border-neutral-200 pl-4 pr-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-neutral-200 font-sans"
            >
              {builds.length === 0 ? (
                <option value="">No Active Projects</option>
              ) : (
                builds.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))
              )}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-[#ff4f3a] hover:bg-[#ff4f3a]/90 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 duration-100"
          >
            <FolderPlus size={14} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Systems Builder Sidebar Navigation */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-4 rounded-[2rem] border border-neutral-100 shadow-sm space-y-2">
            <p className="text-[10px] font-black tracking-widest text-neutral-400 uppercase px-3 pt-2">System Workspaces</p>
            
            <button
              id="sb-tab-projects"
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition ${
                activeTab === 'projects'
                  ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderClosed size={16} />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-black uppercase tracking-wider">System Projects</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wide leading-none ${activeTab === 'projects' ? 'text-white/60' : 'text-neutral-400'}`}>Blueprint & Rig sandbox</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full ${activeTab === 'projects' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                {builds.length}
              </span>
            </button>

            <button
              id="sb-tab-catalogues"
              onClick={() => setActiveTab('catalogues')}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition ${
                activeTab === 'catalogues'
                  ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen size={16} />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-black uppercase tracking-wider">Supplier Catalogues</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wide leading-none ${activeTab === 'catalogues' ? 'text-white/60' : 'text-neutral-400'}`}>Blackmagic, Lectrosonics...</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full ${activeTab === 'catalogues' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                {importedSuppliers.length} Imported
              </span>
            </button>

            <button
              id="sb-tab-ai-specs"
              onClick={() => setActiveTab('ai_specs')}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition ${
                activeTab === 'ai_specs'
                  ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Cpu size={16} />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-black uppercase tracking-wider">AI Specs Parser</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wide leading-none ${activeTab === 'ai_specs' ? 'text-white/60' : 'text-neutral-400'}`}>Scan spec sheets & URLs</p>
                </div>
              </div>
            </button>

            <button
              id="sb-tab-reflib"
              onClick={() => setActiveTab('reflib')}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition ${
                activeTab === 'reflib'
                  ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package size={16} />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-black uppercase tracking-wider">Deploy My Inventory</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wide leading-none ${activeTab === 'reflib' ? 'text-white/60' : 'text-neutral-400'}`}>Pull real physical gear</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full ${activeTab === 'reflib' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                {gearLibrary.length} items
              </span>
            </button>
          </div>

          {activeBuild && (
            <div className="bg-neutral-50 p-6 rounded-[2rem] border border-neutral-150 space-y-4">
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-neutral-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Current Scope</span>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-tight text-neutral-800">{activeBuild.name}</h4>
                <p className="text-[10px] text-neutral-500 leading-normal">{activeBuild.description || 'No system details document parsed.'}</p>
              </div>
              
              <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase text-neutral-400">Created:</span>
                <span className="text-[9px] font-mono font-bold text-neutral-600">{new Date(activeBuild.createdAt).toLocaleDateString()}</span>
              </div>

              <button
                onClick={() => handleDeleteBuild(activeBuild.id)}
                className="w-full flex items-center justify-center gap-2 py-2.5 hover:bg-rose-50 border border-neutral-200 hover:border-rose-100 text-neutral-500 hover:text-[#ff4f3a] transition rounded-xl text-[9px] font-black uppercase tracking-widest"
              >
                <Trash2 size={12} />
                <span>Delete Rig Space</span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active tab views */}
        <div className="lg:col-span-9 space-y-8">
          
          {/* TAB 1: System Projects Designer Workspace */}
          {activeTab === 'projects' && (
            <div className="space-y-8">
              
              {/* Metrics Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Est. Rig budget</p>
                    <p className="text-2xl font-black uppercase tracking-tighter">${totalCost.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <DollarSign size={20} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Module Count</p>
                    <p className="text-2xl font-black uppercase tracking-tighter">{totalCount} Pieces</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <LayoutGrid size={20} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm flex items-center justify-between">
                  <div className="space-y-1 flex flex-col justify-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Estimated Weight</p>
                    <p className="text-2xl font-black uppercase tracking-tighter text-amber-600">~{estimatedWeightLbs} LBS</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                    <Weight size={20} />
                  </div>
                </div>
              </div>

              {/* Blueprint details header */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-50 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-widest text-neutral-700">Project Blueprint Specifications list</h3>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Virtual sandboxed items drafted for active design configuration.</p>
                  </div>

                  <button
                    onClick={() => setIsAddingCustom(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-[9px] font-mono font-black uppercase tracking-widest transition"
                  >
                    <Plus size={12} />
                    <span>Onboard Piece</span>
                  </button>
                </div>

                {/* Custom Item Insertion Drawer */}
                <AnimatePresence>
                  {isAddingCustom && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-neutral-50 rounded-[2rem] p-6 border border-neutral-100 space-y-4 overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#ff4f3a]">Onboard Spec Custom Piece</span>
                        <button onClick={() => setIsAddingCustom(false)} className="text-[9px] font-black uppercase text-neutral-400 hover:text-black">Close</button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-neutral-400">Designation Name</label>
                          <input
                            placeholder="e.g. ATEM switcher, beltpack..."
                            value={customItem.name}
                            onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-neutral-400">Manufacturer Brand</label>
                          <input
                            placeholder="e.g. Lectrosonics, Shure..."
                            value={customItem.brand}
                            onChange={(e) => setCustomItem({ ...customItem, brand: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-neutral-400">Model Specs</label>
                          <input
                            placeholder="e.g. Model v2-X..."
                            value={customItem.model}
                            onChange={(e) => setCustomItem({ ...customItem, model: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-neutral-400">Estimated Unit Price</label>
                          <input
                            type="number"
                            value={customItem.price}
                            onChange={(e) => setCustomItem({ ...customItem, price: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-neutral-400">Blueprint Quantity</label>
                          <input
                            type="number"
                            value={customItem.quantity}
                            onChange={(e) => setCustomItem({ ...customItem, quantity: parseInt(e.target.value) || 1 })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-neutral-400">Category Type</label>
                          <select
                            value={customItem.type}
                            onChange={(e: any) => setCustomItem({ ...customItem, type: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none"
                          >
                            <option value="component">Component Hardware</option>
                            <option value="loom">Cable / Loom</option>
                            <option value="fixture">Mount / Fixture</option>
                            <option value="consumable">Consumable material</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={handleAddCustomItem}
                        className="w-full py-3 bg-[#ff4f3a] text-white hover:bg-neutral-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                      >
                        Confirm Custom Component Details
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Build list items output */}
                <div className="space-y-3">
                  {loadingItems ? (
                    <div className="py-20 text-center">
                      <RefreshCw className="animate-spin text-neutral-400 mx-auto" size={24} />
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-2">Syncing Blueprint Schema...</p>
                    </div>
                  ) : buildItems.length === 0 ? (
                    <div className="py-16 text-center space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                        <Construction size={22} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-tight text-neutral-700">Sandbox Empty</p>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                          Deploy high-end items by moving to the "Supplier Catalogues" tab, importing a brand, or scanning specifications.
                        </p>
                      </div>
                    </div>
                  ) : (
                    buildItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                          item.isPushed 
                            ? 'border-neutral-100 bg-neutral-50/40 opacity-70' 
                            : 'border-neutral-150 hover:border-neutral-250 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                            {item.type === 'loom' ? <Cable size={18} /> : <Wrench size={18} />}
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black uppercase tracking-tight text-neutral-800">{item.name}</h4>
                              {item.isPushed && (
                                <span className="text-[7px] font-mono font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded uppercase">In Library</span>
                              )}
                            </div>
                            <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                              {item.brand || 'No Manufacturer'} • {item.model || 'No Model specs'} • <span className="lowercase text-neutral-400">[{item.category}]</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-6 border-t sm:border-0 border-neutral-50 pt-3 sm:pt-0">
                          {/* Cost Editor Input */}
                          <div className="text-left sm:text-right font-sans">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-black text-neutral-400 font-mono">$</span>
                              <input
                                type="number"
                                defaultValue={item.price}
                                onBlur={(e) => handleUpdateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                                className="w-16 bg-neutral-50 border border-neutral-100 font-black text-xs px-1 text-center outline-none focus:bg-white rounded"
                                title="Click to edit unit cost details"
                              />
                            </div>
                            <p className="text-[8px] font-semibold text-neutral-400 uppercase tracking-widest mt-1">Est. Tot: ${((item.price || 0) * (item.quantity || 1)).toLocaleString()}</p>
                          </div>

                          {/* Quantities counter */}
                          <div className="flex items-center gap-1.5 bg-neutral-50 p-1 border border-neutral-200 rounded-lg shrink-0">
                            <button
                              onClick={() => handleUpdateItemQuantity(item.id, (item.quantity || 1) - 1)}
                              className="w-6 h-6 rounded bg-white hover:bg-neutral-100 border border-neutral-100 flex items-center justify-center text-xs font-bold shadow-sm"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-[10px] font-black">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateItemQuantity(item.id, (item.quantity || 1) + 1)}
                              className="w-6 h-6 rounded bg-white hover:bg-neutral-100 border border-neutral-100 flex items-center justify-center text-xs font-bold shadow-sm"
                            >
                              +
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {!item.isPushed && (
                              <button
                                onClick={() => handlePushToMainInventory(item)}
                                className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-[#ff4f3a] text-white hover:border-[#ff4f3a] transition text-[8px] font-black uppercase tracking-widest rounded-lg shrink-0"
                              >
                                Push to Library
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-neutral-300 hover:text-[#ff4f3a] p-1.5 transition"
                              title="Delete Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Supplier Catalogues Widget */}
          {activeTab === 'catalogues' && (
            <div className="space-y-8">
              
              {/* Supplier Directory Catalogues Board */}
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-black uppercase tracking-tighter text-neutral-800">Supplier Catalogue Integration</h3>
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Authorize and import standardized hardware catalogues directly into your Systems references database.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {SUPPLIERS.map((sup) => {
                    const isImported = importedSuppliers.includes(sup.id);
                    const isImporting = importingSupplierId === sup.id;

                    return (
                      <div key={sup.id} className="p-6 bg-neutral-50/50 hover:bg-neutral-50 rounded-3xl border border-neutral-105-relative flex flex-col justify-between gap-5 transition hover:shadow-md">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${sup.logoBg}`}>
                              {sup.name}
                            </div>
                            <span className="text-[8px] font-mono font-black uppercase text-neutral-400">{sup.rating}</span>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] text-neutral-500 leading-normal font-bold uppercase tracking-wide">{sup.category}</p>
                            <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-widest">{sup.itemsCount} premium items indexed</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                          {isImported ? (
                            <div className="flex items-center gap-1.5 text-emerald-600">
                              <ShieldCheck size={16} />
                              <span className="text-[9px] font-black uppercase tracking-wider">Imported Spec</span>
                            </div>
                          ) : isImporting ? (
                            <div className="w-full space-y-1">
                              <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-100" style={{ width: `${importProgress}%` }} />
                              </div>
                              <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest text-center">Syncing {importProgress}%</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleImportSupplierCatalog(sup.id, sup.name)}
                              className="w-full py-2.5 bg-neutral-900 border border-neutral-800 hover:bg-[#ff4f3a] text-white hover:border-[#ff4f3a] transition rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-sm shadow-black/5"
                            >
                              <Download size={12} />
                              <span>Import Catalogue</span>
                            </button>
                          )}

                          {isImported && (
                            <button
                              onClick={() => {
                                setImportedSuppliers(prev => prev.filter(s => s !== sup.id));
                                toast.info(`Deregistered ${sup.name} suppliers from project references.`);
                              }}
                              className="text-[8px] font-black uppercase tracking-wider text-neutral-400 hover:text-[#ff4f3a] transition"
                            >
                              Remove Catalog
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Integrated Systems Catalog Database browser */}
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-50 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-widest text-neutral-700">Browse Systems Catalogue references</h3>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Search active equipment models from imported supplier files.</p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                    <input
                      placeholder="SEARCH VENDOR CATALOGS..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-150 pl-10 pr-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white focus:ring-1 focus:ring-neutral-200 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCatalog.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-neutral-100 text-neutral-400 rounded-3xl">
                      No matching models found in current active suppliers lists. Import more suppliers above.
                    </div>
                  ) : (
                    filteredCatalog.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-5 bg-neutral-50/40 hover:bg-neutral-50 border border-neutral-150 rounded-2xl flex flex-col justify-between gap-4 transition hover:shadow-sm"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[8px] font-mono font-black uppercase text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200/60 leading-none">
                              {c.brand}
                            </span>
                            <span className="text-[9px] font-black text-neutral-400 font-mono lowercase">[{c.category}]</span>
                          </div>

                          <div className="space-y-1">
                            <h4 className="text-xs font-black uppercase text-neutral-800 leading-tight">{c.name}</h4>
                            <p className="text-[9px] text-neutral-400 font-semibold font-sans leading-relaxed">
                              {(c as any).specs || `Premium equipment built specifically for specialized broadcast system frameworks.`}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-4">
                          <span className="text-xs font-black text-indigo-700 font-sans">${c.price.toLocaleString()}</span>
                          
                          <button
                            onClick={() => handleAddItemToSandbox({
                              name: c.name,
                              category: c.category,
                              brand: c.brand,
                              model: c.model,
                              price: c.price,
                              type: c.type,
                              quantity: 1
                            })}
                            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-[#ff4f3a] text-white hover:bg-neutral-900 transition rounded-lg shrink-0"
                          >
                            Deploy to active project
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI Specs Scan */}
          {activeTab === 'ai_specs' && (
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
              <div className="space-y-1 border-b border-neutral-55 pb-4">
                <h3 className="text-xl font-black uppercase tracking-tighter text-neutral-800">Intelligence Specs Reader</h3>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Paste raw specs pages or retail URLs to parse full configuration items automatically.</p>
              </div>

              <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 text-[10px] font-bold text-amber-800 flex items-start gap-3">
                <Zap className="shrink-0 mt-0.5 text-amber-500 animate-pulse" size={16} />
                <div className="space-y-1">
                  <p className="uppercase tracking-widest font-black leading-none text-amber-900">Direct Retail URL specifications scraping enabled</p>
                  <p className="leading-relaxed">
                    Paste product links from major supplier blogs, B&H photo, Sweetwater, and other logistics directories. Our parser utilizes server-side Gemini intelligence models to identify brand name, part number specifications, categories, and estimated pricing automatically prior to system rigs deployment.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Spec Payload Source</label>
                  <textarea
                    rows={6}
                    placeholder="PASTE WEB ENDPOINT URL (e.g., https://www.blackmagicdesign.com/atem-constellation) OR INPUT RAW DEVICE SPECIFICATIONS PAYLOAD DOCUMENT..."
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-[10px] font-bold outline-none leading-relaxed focus:bg-white focus:ring-1 focus:ring-neutral-200 transition-all font-sans"
                  />
                </div>

                <button
                  onClick={handleAIOnboard}
                  disabled={isAiAnalyzing || !aiInput.trim()}
                  className="w-full py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isAiAnalyzing ? (
                    <>
                      <RefreshCw className="animate-spin text-neutral-400" size={14} />
                      <span>Compiling blueprint payload spec parameters...</span>
                    </>
                  ) : (
                    <>
                      <Cpu size={14} />
                      <span>Onboard blueprint parameters</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Own Gear Inventory reference */}
          {activeTab === 'reflib' && (
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-55 pb-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-black uppercase tracking-tighter text-neutral-800">Deploy owned inventory gear</h3>
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Quickly select physical serialized devices from your organization inventory lists to reference inside active designs.</p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                  <input
                    placeholder="SEARCH OWN GEAR..."
                    value={gearSearch}
                    onChange={(e) => setGearSearch(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-150 pl-10 pr-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white focus:ring-1 focus:ring-neutral-200 transition"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredGear.length === 0 ? (
                  <div className="py-16 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400 border-2 border-dashed border-neutral-100 rounded-3xl">
                    No matching equipment found in your inventory. Onboard real gear inside your "Gear Library" tab first.
                  </div>
                ) : (
                  filteredGear.map((g) => (
                    <div
                      key={g.id}
                      className="p-5 bg-neutral-50/50 hover:bg-neutral-50 border border-neutral-150 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white border border-neutral-150 text-neutral-600 flex items-center justify-center shrink-0">
                          <Package size={20} />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black uppercase tracking-tight text-neutral-800">{g.name}</h4>
                          <p className="text-[9px] text-[#ff4f3a] font-bold uppercase tracking-wider">
                            Asset: {g.assetTag || 'NO TAG ID'} • {g.brand || 'No Brand'} {g.model && `[${g.model}]`} • Status: {g.status || 'available'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-y-0 border-neutral-50 pt-3 sm:pt-0">
                        <span className="text-xs font-black text-neutral-700 font-sans">${(g.price || 0).toLocaleString()}</span>
                        
                        <button
                          onClick={() => handleAddItemToSandbox({
                            name: g.name,
                            category: g.category || 'Gear Reference',
                            brand: g.brand || '',
                            model: g.model || '',
                            price: g.price || 0,
                            type: 'component',
                            quantity: 1
                          })}
                          className="px-3.5 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-emerald-600 hover:border-emerald-500 text-white transition text-[8px] font-black uppercase tracking-widest rounded-lg shrink-0"
                        >
                          Pull reference spec
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Draft New Specification Dialog modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-2xl space-y-6 overflow-hidden"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-black uppercase tracking-tighter text-neutral-800">New Systems Design Project</h3>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Define custom integration parameters & blueprint targets</p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[#ff4f3a]">Project Name / designation</label>
                  <input
                    placeholder="e.g. Broadcast flypack rig core, live workstation setup..."
                    value={newBuildName}
                    onChange={(e) => setNewBuildName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs font-semibold outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[#ff4f3a]">Design Scope & Target specifications</label>
                  <textarea
                    rows={4}
                    placeholder="Describe targets, routing requirements, structural components connectivity..."
                    value={newBuildDesc}
                    onChange={(e) => setNewBuildDesc(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-xs font-semibold outline-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-neutral-150 hover:bg-neutral-250 text-neutral-550 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBuild}
                  className="flex-1 bg-neutral-900 hover:bg-[#ff4f3a] text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition"
                >
                  Initialize Workspace Rig
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
