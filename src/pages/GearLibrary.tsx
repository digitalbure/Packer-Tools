import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, setDoc, orderBy, getDocs, where, writeBatch, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { 
  Package, 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  Plus, 
  Weight, 
  Calendar, 
  Tag, 
  AlertCircle, 
  TrendingUp, 
  SortAsc,
  SortDesc,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  History,
  Wrench,
  DollarSign,
  Info,
  Shield,
  Zap,
  X,
  RotateCcw,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Upload,
  FileSpreadsheet,
  Globe,
  CheckCircle,
  AlertTriangle,
  Users,
  Building,
  Sliders,
  ShieldCheck,
  Share2,
  ArrowRightLeft,
  CheckSquare,
  Cpu
} from 'lucide-react';
import ShareModal from '../components/ShareModal';
import ManualCheckoutModal from '../components/ManualCheckoutModal';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { triggerGoogleChatAlert } from '../services/googleChat';
import { UserProfile, GearItem, GearItemVersion, GearIncident, AdminSettings, Container, Organization, Department, Team } from '../types';
import { logActivity } from '../services/activityLog';
import { offlineSync, OfflineOperation } from '../services/offlineSync';
import { toast } from 'sonner';
import { useAuth } from '../providers/AuthProvider';
import { useIndustry } from '../context/IndustryContext';
import { motion, AnimatePresence } from 'motion/react';
import { SwipeableImageGallery } from '../components/SwipeableImageGallery';
import { format } from 'date-fns';
import { compressImage } from '../lib/imageUtils';
import NfcScannerModal from '../components/NfcScannerModal';

const triggerHaptic = () => {
  if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
    try {
      window.navigator.vibrate(12);
    } catch (e) {
      // safe backup fallback
    }
  }
};
import { Camera, Sparkles, Wand2, Lightbulb, Check, Layers, Luggage, Box, Briefcase, QrCode, Loader2, RefreshCw, Server, HelpCircle, ClipboardCheck } from 'lucide-react';
import QRPrintModal from '../components/QRPrintModal';
import LazyImage from '../components/LazyImage';
import { suggestItemMetadata, identifyItem } from '../services/geminiService';
import { checkLimit, canUseAI, trackAIUsage } from '../lib/limitUtils';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Legend,
  Cell
} from 'recharts';

export default function GearLibrary({ user, adminSettings: propAdminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const { formatCurrency } = useAuth();
  const { getAdjustedLabel, customTerms } = useIndustry();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [dbBrands, setDbBrands] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  useEffect(() => {
    const unsubBrands = onSnapshot(collection(db, 'marketplaceBrands'), (snapshot) => {
      setDbBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn(err));

    const unsubCategories = onSnapshot(collection(db, 'marketplaceCategories'), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by sortOrder
      cats.sort((a: any, b: any) => {
        const orderA = a.sortOrder !== undefined ? a.sortOrder : 9999;
        const orderB = b.sortOrder !== undefined ? b.sortOrder : 9999;
        return orderA - orderB;
      });
      setDbCategories(cats.filter((c: any) => c.assignToPackerTools !== false));
    }, (err) => console.warn(err));

    return () => {
      unsubBrands();
      unsubCategories();
    };
  }, []);

  const resolvedCategories = useMemo(() => {
    if (dbCategories.length > 0) {
      const names = dbCategories.map(c => c.name);
      if (!names.includes('Other')) {
        names.push('Other');
      }
      return names;
    }
    return ['Camera', 'Lens', 'Audio', 'Lighting', 'Support', 'Electronics', 'Cables', 'Power', 'Accessories', 'Other'];
  }, [dbCategories]);
  const [importStep, setImportStep] = useState(1);
  const [importData, setImportData] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<{ [key: string]: number }>({});
  const [importMappingIssues, setImportMappingIssues] = useState<string[]>([]);
  const [isMapping, setIsMapping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import Sandbox interactive states
  const [sandboxPreset, setSandboxPreset] = useState<'standard' | 'av_manuals' | 'production_bom'>('standard');
  const [sandboxEditableData, setSandboxEditableData] = useState<any[][]>([]);
  const [activeEditingCell, setActiveEditingCell] = useState<{ rowIdx: number, colIdx: number } | null>(null);
  const [cellInputValue, setCellInputValue] = useState('');

  // States for pulling from custom inventories
  const [inventories, setInventories] = useState<any[]>([]);
  const [selectedSyncInventory, setSelectedSyncInventory] = useState<any | null>(null);
  const [syncInventoryItems, setSyncInventoryItems] = useState<any[]>([]);
  const [loadingSyncItems, setLoadingSyncItems] = useState(false);
  const [selectedSyncItemIds, setSelectedSyncItemIds] = useState<Set<string>>(new Set());
  const [syncSearch, setSyncSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const qInvs = query(collection(db, 'inventories'));
    const unsub = onSnapshot(qInvs, (snap) => {
      const allInvs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const userInvs = allInvs.filter((inv: any) => 
        inv.ownerId === user.uid ||
        inv.ownerEmail?.toLowerCase() === user.email?.toLowerCase() ||
        inv.collaborators?.some((c: any) => c.email?.toLowerCase() === user.email?.toLowerCase())
      );
      setInventories(userInvs);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!selectedSyncInventory) {
      setSyncInventoryItems([]);
      return;
    }
    setLoadingSyncItems(true);
    getDocs(collection(db, 'inventories', selectedSyncInventory.id, 'items'))
      .then((snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSyncInventoryItems(items);
        setSelectedSyncItemIds(new Set(items.map((i: any) => i.id)));
      })
      .catch((err) => {
        console.error("Error loading sync inventory items:", err);
        toast.error("Failed to load inventory items.");
      })
      .finally(() => {
        setLoadingSyncItems(false);
      });
  }, [selectedSyncInventory]);

  const handleImportFromInventory = async () => {
    if (!user || !selectedSyncInventory || selectedSyncItemIds.size === 0) return;
    setIsImporting(true);
    const toastId = toast.loading(`Copying ${selectedSyncItemIds.size} items to your library...`);
    try {
      const itemsToImport = syncInventoryItems.filter(item => selectedSyncItemIds.has(item.id));
      
      for (let i = 0; i < itemsToImport.length; i += 500) {
        const chunk = itemsToImport.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const newItemRef = doc(collection(db, 'users', user.uid, 'gearLibrary'));
          batch.set(newItemRef, {
            name: item.name || '',
            description: item.description || '',
            brand: item.brand || '',
            model: item.model || '',
            modelNumber: item.modelNumber || '',
            serialNumber: item.serialNumber || '',
            primaryCategory: item.primaryCategory || 'Other',
            category: item.primaryCategory || 'Other',
            weight: Number(item.weight) || 0,
            weightUnit: (item.weightUnit || 'g'),
            price: Number(item.price) || 0,
            condition: (item.condition || 'good'),
            quantity: Number(item.quantity) || 1,
            status: (item.status || 'available'),
            ownerId: user.uid,
            assetTag: item.assetTag || `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            usageCount: 0,
            photoUrls: item.photoUrls || ['https://picsum.photos/seed/gear/400/400'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      }

      toast.success(`Successfully added ${selectedSyncItemIds.size} items to Gear Library!`, { id: toastId });
      setSelectedSyncInventory(null);
      setIsImportModalOpen(false);
    } catch (err) {
      console.error("Error importing from custom inventory:", err);
      toast.error("Failed to copy items into Gear Library.", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  // States and handler for exporting/moving from central gear library to any custom inventories or packing lists
  const [isExportToInventoryOpen, setIsExportToInventoryOpen] = useState(false);
  const [exportTargetType, setExportTargetType] = useState<'inventory' | 'packingList'>('inventory');
  const [selectedExportInventoryId, setSelectedExportInventoryId] = useState('');
  const [selectedExportPackingListId, setSelectedExportPackingListId] = useState('');
  const [isExportingToInventory, setIsExportingToInventory] = useState(false);
  const [isCreateNewInventoryForExport, setIsCreateNewInventoryForExport] = useState(false);
  const [newExportInventoryName, setNewExportInventoryName] = useState('');
  const [newExportInventoryDesc, setNewExportInventoryDesc] = useState('');
  const [packingLists, setPackingLists] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const qLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(qLists, (snap) => {
      const lists = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPackingLists(lists);
    }, (err) => {
      console.error("Error loading packing lists in GearLibrary:", err);
      handleFirestoreError(err, OperationType.LIST, 'packingLists');
    });
    return unsub;
  }, [user?.uid]);

  const handleExportToInventory = async () => {
    let targetId = exportTargetType === 'inventory' ? selectedExportInventoryId : selectedExportPackingListId;
    let targetName = '';

    setIsExportingToInventory(true);
    const toastId = toast.loading(
      isCreateNewInventoryForExport 
        ? `Creating new ${exportTargetType === 'inventory' ? 'inventory' : 'packing list'} "${newExportInventoryName}" and copying...` 
        : `Copying items...`
    );

    try {
      if (isCreateNewInventoryForExport) {
        if (!newExportInventoryName.trim()) {
          toast.error(`Please provide a name for the new ${exportTargetType === 'inventory' ? 'inventory' : 'packing list'}.`, { id: toastId });
          setIsExportingToInventory(false);
          return;
        }

        if (exportTargetType === 'inventory') {
          const newDocRef = doc(collection(db, 'inventories'));
          const payload = {
            id: newDocRef.id,
            name: newExportInventoryName.trim(),
            description: newExportInventoryDesc.trim() || 'Created from Gear Library selection',
            ownerId: user.uid,
            ownerEmail: user.email,
            orgId: user.orgId || '',
            visibility: {
              orgIds: user.orgId ? [user.orgId] : [],
              deptIds: [],
              teamIds: []
            },
            collaborators: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(newDocRef, payload);
          targetId = newDocRef.id;
          targetName = newExportInventoryName.trim();
        } else {
          // Create packing list
          const newDocRef = await addDoc(collection(db, 'packingLists'), {
            ownerId: user.uid,
            ownerEmail: user.email,
            name: newExportInventoryName.trim(),
            description: newExportInventoryDesc.trim() || 'Created from Gear Library selection',
            isTemplate: false,
            workspaceId: '',
            projectId: '',
            shareToken: Math.random().toString(36).substring(2, 15),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          targetId = newDocRef.id;
          targetName = newExportInventoryName.trim();
        }
      } else {
        if (!targetId) {
          toast.error(`Please select a target ${exportTargetType === 'inventory' ? 'inventory list' : 'packing list'}.`, { id: toastId });
          setIsExportingToInventory(false);
          return;
        }
        if (exportTargetType === 'inventory') {
          const targetInv = inventories.find(inv => inv.id === targetId);
          if (!targetInv) {
            toast.error("Selected inventory not found.", { id: toastId });
            setIsExportingToInventory(false);
            return;
          }
          targetName = targetInv.name;
        } else {
          const targetList = packingLists.find(list => list.id === targetId);
          if (!targetList) {
            toast.error("Selected packing list not found.", { id: toastId });
            setIsExportingToInventory(false);
            return;
          }
          targetName = targetList.name;
        }
      }

      const itemsToExport = gear.filter(item => selectedItems.has(item.id));

      if (exportTargetType === 'inventory') {
        const colRef = collection(db, 'inventories', targetId, 'items');
        for (let i = 0; i < itemsToExport.length; i += 500) {
          const chunk = itemsToExport.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach(item => {
            const docRef = doc(colRef);
            batch.set(docRef, {
              id: docRef.id,
              name: item.name || '',
              description: item.description || '',
              brand: item.brand || '',
              model: item.model || '',
              modelNumber: item.modelNumber || '',
              serialNumber: item.serialNumber || '',
              primaryCategory: item.category || 'Other',
              weight: item.weight || null,
              weightUnit: item.weightUnit || 'g',
              price: item.price || 0,
              condition: item.condition || 'good',
              quantity: item.quantity || 1,
              status: item.status || 'available',
              assetTag: item.assetTag || `ASSET-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              photoUrls: item.photoUrls || ['https://picsum.photos/seed/gear/400/400'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          });
          await batch.commit();
        }
      } else {
        // Exporting to packing list (packingLists/{listId}/items)
        const colRef = collection(db, 'packingLists', targetId, 'items');
        for (let i = 0; i < itemsToExport.length; i += 500) {
          const chunk = itemsToExport.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach(item => {
            const docRef = doc(colRef);
            batch.set(docRef, {
              id: docRef.id,
              listId: targetId,
              name: item.name || '',
              aiLabel: item.category || 'Other',
              status: 'pending',
              priority: 'Medium',
              photoUrls: item.photoUrls || [],
              quantity: item.quantity || 1,
              assetTag: item.assetTag || `AI-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              createdAt: new Date().toISOString(),
              notes: (item.brand || item.model) ? `Brand: ${item.brand || ''}, Model: ${item.model || ''}` : '',
              description: item.description || '',
              gearItemId: item.id
            });
          });
          await batch.commit();
        }
      }

      toast.success(`Exported ${itemsToExport.length} items to "${targetName}" successfully!`, { id: toastId });
      setSelectedItems(new Set());
      setIsExportToInventoryOpen(false);
      setSelectedExportInventoryId('');
      setSelectedExportPackingListId('');
      setNewExportInventoryName('');
      setNewExportInventoryDesc('');
      setIsCreateNewInventoryForExport(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export items: verification/database error.", { id: toastId });
    } finally {
      setIsExportingToInventory(false);
    }
  };

  // States for pulling items from custom inventories when building kits
  const [kitSourceTab, setKitSourceTab] = useState<'library' | 'inventory'>('library');
  const [kitSelectedInventory, setKitSelectedInventory] = useState<any | null>(null);
  const [kitInventoryItems, setKitInventoryItems] = useState<any[]>([]);
  const [loadingKitInventoryItems, setLoadingKitInventoryItems] = useState(false);
  const [kitInventorySearch, setKitInventorySearch] = useState('');

  // Fetch kit inventory items
  useEffect(() => {
    if (!kitSelectedInventory) {
      setKitInventoryItems([]);
      return;
    }
    setLoadingKitInventoryItems(true);
    getDocs(collection(db, 'inventories', kitSelectedInventory.id, 'items'))
      .then((snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setKitInventoryItems(items);
      })
      .catch((err) => {
        console.error("Error loading kit inventory items:", err);
        toast.error("Failed to load inventory items.");
      })
      .finally(() => {
        setLoadingKitInventoryItems(false);
      });
  }, [kitSelectedInventory]);

  const handleAddInventoryItemToKit = async (item: any) => {
    const toastId = toast.loading(`Copying "${item.name}" to library and registering into kit...`);
    try {
      const newDocRef = await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), {
        name: item.name || '',
        description: item.description || '',
        brand: item.brand || '',
        model: item.model || '',
        modelNumber: item.modelNumber || '',
        serialNumber: item.serialNumber || '',
        primaryCategory: item.primaryCategory || 'Other',
        category: item.primaryCategory || 'Other',
        weight: Number(item.weight) || 0,
        weightUnit: (item.weightUnit || 'g'),
        price: Number(item.price) || 0,
        condition: (item.condition || 'good'),
        quantity: Number(item.quantity) || 1,
        status: (item.status || 'available'),
        ownerId: user.uid,
        assetTag: item.assetTag || `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        usageCount: 0,
        photoUrls: item.photoUrls || ['https://picsum.photos/seed/gear/400/400'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const createdGearItem: GearItem = {
        id: newDocRef.id,
        name: item.name || '',
        description: item.description || '',
        brand: item.brand || '',
        model: item.model || '',
        modelNumber: item.modelNumber || '',
        serialNumber: item.serialNumber || '',
        primaryCategory: item.primaryCategory || 'Other',
        category: item.primaryCategory || 'Other',
        weight: Number(item.weight) || 0,
        weightUnit: (item.weightUnit || 'g'),
        price: Number(item.price) || 0,
        condition: (item.condition || 'good'),
        quantity: Number(item.quantity) || 1,
        status: (item.status || 'available'),
        ownerId: user.uid,
        assetTag: item.assetTag || `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        usageCount: 0,
        photoUrls: item.photoUrls || ['https://picsum.photos/seed/gear/400/400'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as GearItem;

      toast.success(`"${item.name}" successfully added to Gear Library!`, { id: toastId });
      
      // Open inheritance modal with the new gear item to link to kit childItemIds
      setInheritanceModal({ isOpen: true, pendingItem: createdGearItem });
    } catch (err) {
      console.error("Error adding inventory item to kit:", err);
      toast.error("Failed to copy item to Gear Library.", { id: toastId });
    }
  };

  const runLocalFuzzyMapping = (headers: string[]): { [key: string]: number } => {
    const newMapping: { [key: string]: number } = {};
    const rules: { [key: string]: string[] } = {
      name: ['name', 'item', 'title', 'device', 'equipment', 'product', 'gear'],
      brand: ['brand', 'manufacturer', 'make', 'brandname'],
      model: ['model', 'model name', 'type model', 'modelno'],
      modelNumber: ['model number', 'modelno', 'part number', 'partno'],
      serialNumber: ['serial number', 'serial', 'sn', 's/n', 'serialno'],
      primaryCategory: ['category', 'primary category', 'type', 'group', 'class', 'tag category'],
      weight: ['weight', 'mass', 'heavy'],
      weightUnit: ['weight unit', 'weightunit', 'unit'],
      price: ['price', 'cost', 'value', 'msrp', 'rate'],
      condition: ['condition', 'state', 'wear'],
      quantity: ['quantity', 'qty', 'count', 'amount', 'pieces', 'stock'],
      status: ['status', 'availability', 'state status'],
      description: ['description', 'notes', 'info', 'desc', 'details']
    };

    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [field, keywords] of Object.entries(rules)) {
        if (newMapping[field] !== undefined) continue;
        const matched = keywords.some(kw => {
          const kwNorm = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalized === kwNorm || normalized.includes(kwNorm) || kwNorm.includes(normalized);
        });
        if (matched) {
          newMapping[field] = index;
        }
      }
    });
    setImportMapping(newMapping);
    return newMapping;
  };

  const downloadTemplate = (format: 'csv' | 'xlsx') => {
    const headers = ['Name', 'Brand', 'Model', 'Category', 'Quantity', 'Price', 'SerialNumber', 'ModelNumber', 'Description'];
    const sampleRows = [
      ['Sony FX3 Cinema Camera', 'Sony', 'ILME-FX3', 'Camera', '2', '3899', 'S01-2948192-H', 'FX3', 'Full-frame cinema line camera with XLR handle'],
      ['Aputure LS 600d Pro', 'Aputure', 'LS-600d-Pro', 'Lighting', '1', '1890', 'AP-600D-9928', '600d Pro', 'High-output LED daylight light storm kit'],
      ['Sennheiser MKH416 Shotgun Mic', 'Sennheiser', 'MKH416-P48U3', 'Audio', '3', '999', 'SEN-416-8819', 'MKH416', 'Industry standard RF condenser shotgun microphone']
    ];

    if (format === 'csv') {
      const csvContent = [headers.join(','), ...sampleRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'packer_tools_gear_import_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gear Template');
      XLSX.writeFile(wb, 'packer_tools_gear_import_template.xlsx');
    }
    toast.success(`Sample template ${format.toUpperCase()} downloaded!`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      Papa.parse(file, {
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const rows = results.data as any[][];
            const headers = rows[0].map(h => String(h).trim());
            setImportHeaders(headers);
            setImportData(rows.slice(1));
            setSandboxEditableData(rows.slice(1));
            setImportStep(2);
            const localMap = runLocalFuzzyMapping(headers);
            const hasRequiredName = localMap.name !== undefined;
            const matchedCount = Object.keys(localMap).length;
            if (hasRequiredName && matchedCount >= 2) {
              toast.success("Auto-mapped columns instantly using local heuristics!");
            } else {
              mapHeadersAI(headers, rows.slice(1, 4));
            }
          }
        },
        header: false,
        skipEmptyLines: true
      });
    } else {
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          if (json.length > 0) {
            const headers = json[0].map(h => String(h).trim());
            setImportHeaders(headers);
            setImportData(json.slice(1));
            setSandboxEditableData(json.slice(1));
            setImportStep(2);
            const localMap = runLocalFuzzyMapping(headers);
            const hasRequiredName = localMap.name !== undefined;
            const matchedCount = Object.keys(localMap).length;
            if (hasRequiredName && matchedCount >= 2) {
              toast.success("Auto-mapped columns instantly using local heuristics!");
            } else {
              mapHeadersAI(headers, json.slice(1, 4));
            }
          }
        } catch (err) {
          console.error("Error parsing Excel file:", err);
          toast.error("Failed to parse Excel file. Is it password-protected or corrupted?");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleUrlImport = async () => {
    if (!importUrl) return;
    const toastId = toast.loading("Fetching data from URL...");
    try {
      const response = await fetch(importUrl);
      const blob = await response.blob();
      const file = new File([blob], "imported_file", { type: blob.type });
      processFile(file);
      toast.success("File retrieved successfully", { id: toastId });
    } catch (error) {
      console.error("URL Import Error:", error);
      toast.error("Failed to fetch file from URL. Ensure it's a direct public link.", { id: toastId });
    }
  };

  const mapHeadersAI = async (headers: string[], sampleData: any[][]) => {
    setIsMapping(true);
    try {
      const response = await fetch('/api/map-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, sampleData })
      });
      const result = await response.json();
      if (result.mapping) {
        setImportMapping(result.mapping);
        setImportMappingIssues(result.unmappedHeaders || []);
        toast.success("AI has automatically mapped your columns!");
      }
    } catch (error) {
      console.error("Mapping Error:", error);
      toast.error("AI mapping failed, please map columns manually.");
    } finally {
      setIsMapping(false);
    }
  };

  const executeImport = async () => {
    const finalData = sandboxEditableData.length > 0 ? sandboxEditableData : importData;
    if (!user || finalData.length === 0) return;
    setIsImporting(true);
    const toastId = toast.loading(`Importing ${finalData.length} items...`);
    
    try {
      // Chunking for Firestore (max 500 per batch)
      const batchSize = 400; // conservative
      for (let i = 0; i < finalData.length; i += batchSize) {
        const chunk = finalData.slice(i, i + batchSize);
        const batch = writeBatch(db);
        
        chunk.forEach(row => {
          const getItemValue = (field: string) => {
            const index = importMapping[field];
            if (index === undefined || index === null) return undefined;
            return row[index];
          };

          const name = String(getItemValue('name') || '').trim();
          if (!name) return; // Skip empty rows

          const newItemRef = doc(collection(db, 'users', user.uid, 'gearLibrary'));
          const pCat = String(getItemValue('primaryCategory') || 'Other');
          
          let description = String(getItemValue('description') || '');
          let addOns: any[] = [];
          let isKit = false;
          let notes = '';

          if (sandboxPreset === 'av_manuals') {
            notes = `AV Integration Documented. Manual: https://support.google.com/search?q=${encodeURIComponent(name + ' manual')}`;
            description = description ? `${description}\n${notes}` : notes;
          } else if (sandboxPreset === 'production_bom') {
            isKit = true;
            addOns = [
              { name: 'Standard Power Cable', price: 0, type: 'Accessory', notes: 'Factory Supplied' },
              { name: 'Heavy Duty Pelican Case', price: 0, type: 'Add On', notes: 'Waterproof protective enclosure' }
            ];
          }

          batch.set(newItemRef, {
            name,
            description,
            brand: String(getItemValue('brand') || ''),
            model: String(getItemValue('model') || ''),
            modelNumber: String(getItemValue('modelNumber') || ''),
            serialNumber: String(getItemValue('serialNumber') || ''),
            primaryCategory: pCat,
            category: pCat,
            weight: Number(getItemValue('weight')) || 0,
            weightUnit: String(getItemValue('weightUnit') || 'g') as any,
            price: Number(getItemValue('price')) || 0,
            condition: (String(getItemValue('condition') || 'good').toLowerCase()) as any,
            quantity: Number(getItemValue('quantity')) || 1,
            status: (String(getItemValue('status') || 'available').toLowerCase()) as any,
            ownerId: user.uid,
            assetTag: `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            usageCount: 0,
            photoUrls: ['https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isKit,
            addOns,
            sandboxPreset
          });
        });

        await batch.commit();
        const progress = Math.min(100, Math.round(((i + chunk.length) / finalData.length) * 100));
        toast.loading(`Importing: ${progress}%...`, { id: toastId });
      }

      toast.success(`Successfully imported ${finalData.length} items!`, { id: toastId });
      setIsImportModalOpen(false);
      setImportStep(1);
      setImportData([]);
      setSandboxEditableData([]);
    } catch (error) {
      console.error("Import Error:", error);
      toast.error("Failed to complete import. See console for details.", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const [gear, setGear] = useState<GearItem[]>([]);
  const [gearLimit, setGearLimit] = useState(50);
  const [totalGearCount, setTotalGearCount] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = offlineSync.subscribe((queue, online, syncing) => {
      setOfflineQueue(queue);
      setIsOnline(online);
      setIsSyncing(syncing);
    });
    return () => unsubscribe();
  }, []);
  const [settings, setSettings] = useState<AdminSettings | null>(propAdminSettings);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isPulling, setIsPulling] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading("Synchronizing Gear Library...");
    try {
      await getDocs(collection(db, 'users', user.uid, 'gearLibrary'));
      toast.success("Synchronized: Gear Library is up-to-date!", { id: toastId });
    } catch (err) {
      console.warn("Pull-to-refresh sync failed:", err);
      toast.error("Synchronization failed.", { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStartY(e.touches[0].pageY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || touchStartY === null || window.scrollY > 0) return;
    const currentY = e.touches[0].pageY;
    const diffY = currentY - touchStartY;
    if (diffY > 0) {
      const progress = Math.min((diffY / 120) * 100, 100);
      setPullProgress(progress);
    } else {
      setPullProgress(0);
    }
  };

  const handleTouchEnd = () => {
    if (isPulling) {
      if (pullProgress >= 85) {
        handleRefresh();
      }
      setIsPulling(false);
      setTouchStartY(null);
      setPullProgress(0);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [privacyLayerFilter, setPrivacyLayerFilter] = useState<'all' | 'private' | 'team' | 'dept' | 'org' | 'public'>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [categoryFilterMode, setCategoryFilterMode] = useState<'primary' | 'all'>('primary');

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, privacyLayerFilter, selectedCondition, categoryFilterMode]);
  const [isAIAutoRegistering, setIsAIAutoRegistering] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'createdAt' | 'weight' | 'price' | 'usageCount' | 'health'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingItem, setEditingItem] = useState<GearItem | null>(null);
  const [customNewTag, setCustomNewTag] = useState('');
  const [customEditTag, setCustomEditTag] = useState('');

  // States for Editing Accessories / Add-Ons
  const [accessoryEditIdx, setAccessoryEditIdx] = useState<number | null>(null);
  const [accessoryEditForm, setAccessoryEditForm] = useState<any | null>(null);

  const startTouchPress = (onLongPress: () => void) => {
    let pressTimer: any = null;
    const start = () => {
      pressTimer = setTimeout(() => {
        onLongPress();
      }, 500); // 500ms long press duration is perfect
    };
    const cancel = () => {
      if (pressTimer) clearTimeout(pressTimer);
    };
    return {
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchMove: cancel,
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel
    };
  };

  const handleSaveAccessoryEdit = () => {
    if (!editingItem || accessoryEditIdx === null || !accessoryEditForm) return;
    const list = [...(editingItem.addOns || [])];
    list[accessoryEditIdx] = {
      ...list[accessoryEditIdx],
      name: accessoryEditForm.name.trim(),
      type: accessoryEditForm.type,
      price: accessoryEditForm.price,
      notes: accessoryEditForm.notes.trim() || undefined
    };
    setEditingItem({
      ...editingItem,
      addOns: list
    });
    setAccessoryEditForm(null);
    setAccessoryEditIdx(null);
    toast.success("Accessory changes applied locally. Click Save Changes at the bottom of the drawer to save permanently!");
  };
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<GearItemVersion[]>([]);
  const [showIncidents, setShowIncidents] = useState(false);
  const [incidents, setIncidents] = useState<GearIncident[]>([]);
  const [isLoggingIncident, setIsLoggingIncident] = useState(false);
  const [newIncident, setNewIncident] = useState<Partial<GearIncident>>({
    type: 'damage',
    description: '',
    date: new Date().toISOString().split('T')[0],
    severity: 'medium',
    resolved: false
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>(() => {
    if (window.innerWidth < 768) return 'list';
    return user?.viewDensity === 'compact' ? 'compact' : 'grid';
  });

  useEffect(() => {
    if (user?.viewDensity) {
      setViewMode(user.viewDensity === 'compact' ? 'compact' : 'grid');
    }
  }, [user?.viewDensity]);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Batch Move to Rack & Change Status states
  const [racks, setRacks] = useState<any[]>([]);
  const [isMoveToRackModalOpen, setIsMoveToRackModalOpen] = useState(false);
  const [selectedRackId, setSelectedRackId] = useState('');
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [selectedBatchStatus, setSelectedBatchStatus] = useState<'available' | 'in_use' | 'maintenance' | 'retired' | 'missing'>('available');

  // Batch organizational assignment states
  const [isBatchAssignModalOpen, setIsBatchAssignModalOpen] = useState(false);
  const [batchOrgId, setBatchOrgId] = useState('');
  const [batchDeptId, setBatchDeptId] = useState('');
  const [batchTeamId, setBatchTeamId] = useState('');
  const [batchAssignedTo, setBatchAssignedTo] = useState('');
  const [shouldUpdateOrg, setShouldUpdateOrg] = useState(true);
  const [shouldUpdateDept, setShouldUpdateDept] = useState(true);
  const [shouldUpdateTeam, setShouldUpdateTeam] = useState(true);
  const [shouldUpdateAssignee, setShouldUpdateAssignee] = useState(true);
  const [isBatchAssigning, setIsBatchAssigning] = useState(false);

  // Workflow guidance model
  const [checkoutGuidanceModal, setCheckoutGuidanceModal] = useState(false);

  // Undo bulk action states
  const [lastBulkAction, setLastBulkAction] = useState<{
    type: 'status' | 'rack' | 'assign' | 'delete';
    items: {
      gearItem: GearItem;
      previousRackId?: string | null;
      createdRackItemId?: string;
      selectedRackId?: string;
      previousData?: {
        status?: string;
        orgId?: string;
        deptId?: string;
        teamId?: string;
        assignedTo?: string;
      };
    }[];
    timestamp: number;
  } | null>(null);

  useEffect(() => {
    if (!lastBulkAction) return;
    const timer = setTimeout(() => {
      setLastBulkAction(null);
    }, 15000); // 15 seconds visibility
    return () => clearTimeout(timer);
  }, [lastBulkAction]);

  // Audit Mode states and helpers
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [showOnlyAttentionNeeded, setShowOnlyAttentionNeeded] = useState(false);

  const isMaintenanceOutdated = (item: GearItem) => {
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

  const isLowInventory = (item: GearItem) => {
    const qty = item.quantity !== undefined ? item.quantity : 1;
    return qty <= 1;
  };

  // AI Compatibility States
  const [isCompatModalOpen, setIsCompatModalOpen] = useState(false);
  const [compatItems, setCompatItems] = useState<GearItem[]>([]);
  const [compatResult, setCompatResult] = useState<{
    status: 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE';
    summary: string;
    issues: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW'; description: string; affectedItems: string[] }>;
    recommendations: string[];
  } | null>(null);
  const [loadingCompat, setLoadingCompat] = useState(false);
  const [compatError, setCompatError] = useState<string | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [isPackingModalOpen, setIsPackingModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);
  const [analyticsView, setAnalyticsView] = useState<'roi' | 'utilization' | 'combined'>('combined');
  const [selectedGearItemView, setSelectedGearItemView] = useState<GearItem | null>(null);
  const [sharingGearItem, setSharingGearItem] = useState<GearItem | null>(null);
  const [sharingGearType, setSharingGearType] = useState<'gear' | 'kit'>('gear');
  const [manualCheckoutGearItem, setManualCheckoutGearItem] = useState<GearItem | null>(null);
  const [manualCheckoutGearType, setManualCheckoutGearType] = useState<'gear' | 'kit'>('gear');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem(`gear_cache_sync_time_${user?.uid}`);
  });
  const [showOfflineDashboard, setShowOfflineDashboard] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Network connection restored! Re-syncing gear database...");
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("Lost network connection. Packer Offline Cache activated.", {
        description: "You can continue working completely offline.",
        duration: 5000
      });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user?.uid]);

  // NFC Scanner State variables
  const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
  const [nfcScanMode, setNfcScanMode] = useState<'associate' | 'search'>('search');
  const [nfcTargetItem, setNfcTargetItem] = useState<{ id: string; name: string; type: 'gear' | 'inventory'; inventoryId?: string } | undefined>(undefined);

  // Read NFC redirect triggers (if redirected from Inventory page after an NFC match)
  useEffect(() => {
    const redirectGearId = localStorage.getItem('nfc_redirect_gear_id');
    if (redirectGearId && gear.length > 0) {
      localStorage.removeItem('nfc_redirect_gear_id');
      const foundItem = gear.find(i => i.id === redirectGearId);
      if (foundItem) {
        setEditingItem(foundItem);
      }
    }
  }, [gear]);

  const handleNfcSearchSuccess = (foundItem: any, type: 'gear' | 'inventory', inventoryId?: string) => {
    if (type === 'gear') {
      setEditingItem(foundItem);
    } else {
      if (inventoryId) {
        localStorage.setItem('nfc_redirect_inventory_id', inventoryId);
        localStorage.setItem('nfc_redirect_item_id', foundItem.id);
        navigate('/inventory');
      }
    }
  };

  const toggleItemSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedItems(newSelected);
  };

  const handleCreateKitFromSelection = () => {
    const selectedGearItems = gear.filter(i => selectedItems.has(i.id));
    setNewItem({
      name: '',
      category: 'Kit',
      isKit: true,
      childItemIds: Array.from(selectedItems),
      status: 'available',
      condition: 'good',
      weight: selectedGearItems.reduce((acc, i) => acc + (i.weight || 0), 0),
      price: selectedGearItems.reduce((acc, i) => acc + (i.price || 0), 0),
      brand: 'Custom Kit',
      description: `Reusable kit containing: ${selectedGearItems.map(i => i.name).join(', ')}`,
      tags: ['Kit'],
      quantity: 1,
      photoUrls: selectedGearItems[0]?.photoUrls || ['https://picsum.photos/seed/kit/400/400']
    });
    setIsAddModalOpen(true);
    setAddStep(1);
    setSelectedItems(new Set());
  };

  const handleCheckCompatibility = async () => {
    if (selectedItems.size !== 2) {
      toast.error("Please select exactly 2 items for compatibility check.");
      return;
    }
    
    // Find the actual GearItem objects
    const selectedIds = Array.from(selectedItems);
    const selectedGearItems = gear.filter(item => selectedIds.includes(item.id));
    
    if (selectedGearItems.length !== 2) {
      toast.error("Error finding selected items.");
      return;
    }
    
    setCompatItems(selectedGearItems);
    setIsCompatModalOpen(true);
    setLoadingCompat(true);
    setCompatError(null);
    setCompatResult(null);
    
    try {
      const response = await fetch('/api/check-compatibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: selectedGearItems.map(item => ({
            name: item.name,
            brand: item.brand || '',
            model: item.model || '',
            primaryCategory: item.primaryCategory || '',
            category: item.category || '',
            description: item.description || '',
            specs: item.specs || null
          }))
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to run compatibility analysis');
      }
      
      const data = await response.json();
      setCompatResult(data);
    } catch (err: any) {
      console.error(err);
      setCompatError(err.message || 'Error executing AI compatibility check');
    } finally {
      setLoadingCompat(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!editingItem) return;

    if (!editingItem.name?.trim() || !editingItem.brand?.trim() || !editingItem.model?.trim()) {
      toast.error("Please provide at least the Item Name, Brand, and Model before activating the AI description assistant!");
      return;
    }

    setIsGeneratingDescription(true);
    const toastId = toast.loading("Invoking AI Description Assistant...");
    try {
      const response = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingItem.name,
          brand: editingItem.brand,
          model: editingItem.model,
          description: editingItem.description || "",
          isKit: !!(editingItem.isKit || editingItem.category === 'Kit' || editingItem.category === 'Kits' || editingItem.primaryCategory === 'Kit' || editingItem.primaryCategory === 'Kits'),
          childItems: childItems || []
        })
      });

      if (!response.ok) {
        throw new Error("Server error: " + response.status);
      }

      const data = await response.json();
      if (data.description) {
        setEditingItem(prev => prev ? {
          ...prev,
          description: data.description
        } : null);
        toast.success("AI description updated beautifully!", { id: toastId });
      } else {
        toast.error("AI returned an empty description.", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate AI description.", { id: toastId });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    if (type === 'kit') {
      setSelectedCategory('Kits');
      setSearchTerm('');
    }
    if (params.get('addGear') === 'true') {
      setIsAddModalOpen(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (!isAddModalOpen) {
      if (searchParams.get('addGear') === 'true') {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('addGear');
        setSearchParams(newParams);
      }
    }
  }, [isAddModalOpen, searchParams, setSearchParams]);
  const [newItem, setNewItem] = useState<Partial<GearItem>>({
    name: '',
    category: 'Other',
    primaryCategory: 'Other',
    secondaryCategories: [],
    model: '',
    modelNumber: '',
    serialNumber: '',
    releaseYear: '',
    status: 'available',
    condition: 'good',
    weight: 0,
    price: 0,
    brand: '',
    description: '',
    tags: [],
    organizationTip: '',
    quantity: 1,
    photoUrls: ['https://picsum.photos/seed/gear/400/400']
  });
  const [addStep, setAddStep] = useState(1);
  const [trackingMode, setTrackingMode] = useState<'bulk' | 'serialized'>('bulk');
  const [serialPrefix, setSerialPrefix] = useState('');
  const [serialStartNum, setSerialStartNum] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [childItems, setChildItems] = useState<GearItem[]>([]);
  const [isAddingToKit, setIsAddingToKit] = useState(false);
  const [showAddOnCreator, setShowAddOnCreator] = useState(false);
  const [selectedAddOnItemId, setSelectedAddOnItemId] = useState('');
  const [customAddOnName, setCustomAddOnName] = useState('');
  const [addOnType, setAddOnType] = useState<'Organizer' | 'Accessory' | 'Consumable' | 'Attachment' | 'Add On' | 'Software' | 'Mod' | 'Other'>('Accessory');
  const [addOnNotes, setAddOnNotes] = useState('');
  const [addOnPriceOption, setAddOnPriceOption] = useState<'default' | 'custom'>('custom');
  const [addOnCustomPrice, setAddOnCustomPrice] = useState(0);
  const [inheritanceModal, setInheritanceModal] = useState<{
    isOpen: boolean;
    pendingItem: GearItem | null;
  }>({
    isOpen: false,
    pendingItem: null
  });

  const [photoPickerModal, setPhotoPickerModal] = useState<{
    isOpen: boolean;
    target: 'new' | 'edit';
  }>({
    isOpen: false,
    target: 'edit'
  });
  const [searchTextForPhotos, setSearchTextForPhotos] = useState('');
  const [selectedSystemPhotos, setSelectedSystemPhotos] = useState<string[]>([]);

  const handlePhotoPicked = (urls: string[]) => {
    if (photoPickerModal.target === 'edit' && editingItem) {
      setEditingItem({
        ...editingItem,
        photoUrls: [...(editingItem.photoUrls || []), ...urls]
      });
    } else {
      setNewItem({
        ...newItem,
        photoUrls: [...(newItem.photoUrls || []), ...urls]
      });
      setIsDirty(true);
    }
  };

  const handlePhotoUploadEvent = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const compressed = await compressImage(files[i]);
          urls.push(compressed);
        } catch (err) {
          toast.error(`Failed to process ${files[i].name}`);
        }
      }
      if (urls.length > 0) {
        handlePhotoPicked(urls);
        toast.success(`Successfully added ${urls.length} photo(s)`);
      }
    }
  };

  const processPasteFile = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      handlePhotoPicked([compressed]);
      toast.success("Successfully added pasted photo!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to process pasted image file.");
    }
  };

  const handleClipboardPasteForPicker = async () => {
    try {
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const file = new File([blob], "pasted-image.png", { type });
            await processPasteFile(file);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        toast.error("No image found on clipboard. Try copying an image first or press Ctrl+V / Command+V.");
      }
    } catch (err) {
      toast.error("Clipboard permission denied or no image found. Try pressing Ctrl+V / Command+V.");
    }
  };

  useEffect(() => {
    if (!photoPickerModal.isOpen) return;
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await processPasteFile(file);
            setPhotoPickerModal(prev => ({ ...prev, isOpen: false }));
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [photoPickerModal.isOpen, photoPickerModal.target, editingItem, newItem]);

  const getSystemPhotosAvailable = () => {
    const photos: { url: string; itemName: string; itemBrand?: string; isChild: boolean }[] = [];
    
    // First, add photos from childItems (items in the kit)
    childItems.forEach(item => {
      item.photoUrls?.forEach(url => {
        if (url && !photos.some(p => p.url === url)) {
          photos.push({
            url,
            itemName: item.name,
            itemBrand: item.brand,
            isChild: true
          });
        }
      });
    });

    // Next, add photos from other gear items (filtered by search)
    gear.forEach(item => {
      const matchesSearch = !searchTextForPhotos || 
        item.name.toLowerCase().includes(searchTextForPhotos.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchTextForPhotos.toLowerCase());

      if (matchesSearch) {
        item.photoUrls?.forEach(url => {
          if (url && !photos.some(p => p.url === url)) {
            photos.push({
              url,
              itemName: item.name,
              itemBrand: item.brand,
              isChild: false
            });
          }
        });
      }
    });

    return photos;
  };

  const getPrimaryCategory = (item: GearItem | Partial<GearItem>) => item.primaryCategory || item.category || 'Other';
  const getSecondaryCategories = (item: GearItem | Partial<GearItem>) => item.secondaryCategories || [];

  const handleAIAutoRegister = async (item: Partial<GearItem>, updateStateFn: (updatedFields: Partial<GearItem>) => void) => {
    if (!item.name) {
      toast.error("Please enter a product name first to help the AI search!");
      return;
    }
    
    setIsAIAutoRegistering(true);
    const toastId = toast.loading("🤖 AI is analyzing details and registering serial/model numbers...");
    
    try {
      const firstPhoto = item.photoUrls?.[0];
      const hasBase64Image = firstPhoto && firstPhoto.startsWith("data:");
      
      const response = await fetch("/api/register-serial-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productName: item.name,
          photoBase64: hasBase64Image ? firstPhoto : undefined,
          textContext: `${item.brand || ""} ${item.description || ""}`.trim()
        }),
      });
      
      if (!response.ok) {
        throw new Error("API request failed");
      }
      
      const data = await response.json();
      
      const updates: Partial<GearItem> = {};
      if (data.model) updates.model = data.model;
      if (data.modelNumber) updates.modelNumber = data.modelNumber;
      if (data.serialNumber) updates.serialNumber = data.serialNumber;
      if (data.releaseYear) updates.releaseYear = data.releaseYear;
      
      updateStateFn(updates);
      setIsDirty(true);
      
      toast.success("🤖 Successfully registered details using AI!", { id: toastId });
    } catch (err) {
      console.error("AI auto registration error:", err);
      toast.error("Failed to automatically register fields with AI.", { id: toastId });
    } finally {
      setIsAIAutoRegistering(false);
    }
  };

  const handleSyncKitCategories = (kit: Partial<GearItem>, updateStateFn: (updatedFields: Partial<GearItem>) => void) => {
    const currentIds = kit.childItemIds || [];
    if (currentIds.length === 0) {
      toast.error("Assemble some items into this kit first before syncing categories!");
      return;
    }
    
    const children = gear.filter(g => currentIds.includes(g.id));
    if (children.length === 0) {
      toast.error("No gear items linked to this kit could be found in the library.");
      return;
    }
    
    const childCategories = children.map(c => c.primaryCategory || c.category || 'Other');
    
    const frequencyMap: { [key: string]: number } = {};
    childCategories.forEach(cat => {
      frequencyMap[cat] = (frequencyMap[cat] || 0) + 1;
    });
    
    let mostFrequentCategory = childCategories[0];
    let maxCount = 0;
    Object.keys(frequencyMap).forEach(cat => {
      if (frequencyMap[cat] > maxCount) {
        maxCount = frequencyMap[cat];
        mostFrequentCategory = cat;
      }
    });
    
    const otherCategories = Array.from(new Set(childCategories)).filter(cat => cat !== mostFrequentCategory);
    
    updateStateFn({
      primaryCategory: mostFrequentCategory,
      category: mostFrequentCategory,
      secondaryCategories: otherCategories
    });
    setIsDirty(true);
    
    toast.success(`⚡ Set Primary Category to '${mostFrequentCategory}' and Secondary to [${otherCategories.join(', ')}] based on child items!`);
  };

  useEffect(() => {
    const item = editingItem || (isAddModalOpen ? newItem : null);
    if (item?.isKit && item.childItemIds?.length) {
      const fetchChildren = async () => {
        // Filter out IDs that might match the current item (though usually not an issue for newItem)
        const validIds = item.childItemIds!.filter(id => id && id !== item.id);
        if (validIds.length === 0) {
          setChildItems([]);
          return;
        }

        const q = query(
          collection(db, 'users', user.uid, 'gearLibrary'),
          where('__name__', 'in', validIds.slice(0, 30))
        );
        const snap = await getDocs(q);
        setChildItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)));
      };
      fetchChildren();
    } else {
      setChildItems([]);
    }
  }, [editingItem, newItem.childItemIds, isAddModalOpen, user.uid]);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('gear_item_draft');
    if (savedDraft && !isAddModalOpen) {
      try {
        const draft = JSON.parse(savedDraft);
        setNewItem(prev => ({ ...prev, ...draft }));
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
  }, [isAddModalOpen]);

  // Save draft to localStorage whenever it changes
  useEffect(() => {
    if (isAddModalOpen || (newItem.name || newItem.brand || newItem.description)) {
      localStorage.setItem('gear_item_draft', JSON.stringify(newItem));
    }
  }, [newItem, isAddModalOpen]);

  const handleAddModalClose = async () => {
    // If dirty, we could auto-save, but for "Add New", auto-saving to DB might create partial items.
    // So we just keep the draft in localStorage and close.
    // If the user explicitly clicking 'Add to Library', we clear the draft.
    setIsAddModalOpen(false);
    setAddStep(1);
    setIsDirty(false);
  };
  const [isQRPrintModalOpen, setIsQRPrintModalOpen] = useState(false);
  useEffect(() => {
    const handleOpenQRPrint = () => {
      setIsQRPrintModalOpen(true);
    };
    window.addEventListener('open-qr-print-modal', handleOpenQRPrint);
    return () => window.removeEventListener('open-qr-print-modal', handleOpenQRPrint);
  }, []);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [aiSuggestions, setAiSuggestions] = useState<{
    name?: string;
    category?: string;
    tags?: string[];
    organizationTip?: string;
  } | null>(null);

  // Early local cache loading for lightning-fast offline startup support
  useEffect(() => {
    if (!user?.uid) return;
    const cacheKey = `gear_cache_${user.uid}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setGear(parsed);
          setLoading(false);
        }
      } catch (e) {
        console.error("Error loading offline cache:", e);
      }
    }

    // Load robust local IndexedDB cache from Service Worker
    offlineSync.getCachedGearList(user.uid).then(swCachedGear => {
      if (Array.isArray(swCachedGear) && swCachedGear.length > 0) {
        setGear(swCachedGear);
        setLoading(false);
      }
    }).catch(err => {
      console.warn("Failed to load gear list from Service Worker:", err);
    });
    
    const containerKey = `containers_cache_${user.uid}`;
    const cachedCon = localStorage.getItem(containerKey);
    if (cachedCon) {
      try {
        const parsedCon = JSON.parse(cachedCon);
        if (Array.isArray(parsedCon)) {
          setContainers(parsedCon);
        }
      } catch (e) {}
    }

    const cachedSett = localStorage.getItem('settings_cache');
    if (cachedSett) {
      try {
        const parsedSett = JSON.parse(cachedSett);
        if (parsedSett) {
          setSettings(parsedSett);
        }
      } catch (e) {}
    }
  }, [user?.uid]);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const q = query(
      collection(db, 'users', user.uid, 'gearLibrary'),
      orderBy('createdAt', 'desc'),
      limit(gearLimit)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem));
      
      // Fetch total count for read-optimization controls
      getCountFromServer(collection(db, 'users', user.uid, 'gearLibrary'))
        .then(countSnap => setTotalGearCount(countSnap.data().count))
        .catch(err => console.warn("Failed to fetch gear count:", err));
      
      // Dynamic synchronization fallback: Map name (case-insensitive) to best populated item details
      const bestItemDetails: Record<string, Partial<GearItem>> = {};
      rawItems.forEach(item => {
        const key = item.name.trim().toLowerCase();
        if (!key) return;
        const currentBest = bestItemDetails[key];
        
        const score = (item.brand ? 2 : 0) + (item.model ? 1 : 0) + (item.modelNumber ? 1 : 0) + (item.price ? 1 : 0) + (item.weight ? 1 : 0) + (item.photoUrls && item.photoUrls.length && !item.photoUrls[0].includes('placeholder') && !item.photoUrls[0].includes('picsum') ? 2 : 0);
        const currentBestScore = currentBest ? ((currentBest.brand ? 2 : 0) + (currentBest.model ? 1 : 0) + (currentBest.modelNumber ? 1 : 0) + (currentBest.price ? 1 : 0) + (currentBest.weight ? 1 : 0) + (currentBest.photoUrls && currentBest.photoUrls.length && !currentBest.photoUrls[0].includes('placeholder') && !currentBest.photoUrls[0].includes('picsum') ? 2 : 0)) : -1;
        
        if (score > currentBestScore) {
          bestItemDetails[key] = {
            brand: item.brand,
            model: item.model,
            modelNumber: item.modelNumber,
            serialNumber: item.serialNumber,
            releaseYear: item.releaseYear,
            weight: item.weight,
            weightUnit: item.weightUnit,
            price: item.price,
            photoUrls: item.photoUrls,
            description: item.description,
            rentalPrice: item.rentalPrice,
            rentalPeriod: item.rentalPeriod,
            currency: item.currency,
            secondaryCategories: item.secondaryCategories
          };
        }
      });

      const items = rawItems.map(item => {
        const key = item.name.trim().toLowerCase();
        const fallback = bestItemDetails[key];
        if (fallback) {
          return {
            ...item,
            brand: item.brand || fallback.brand || '',
            model: item.model || fallback.model || '',
            modelNumber: item.modelNumber || fallback.modelNumber || '',
            serialNumber: item.serialNumber || fallback.serialNumber || '',
            releaseYear: item.releaseYear || fallback.releaseYear || '',
            weight: item.weight || fallback.weight || 0,
            weightUnit: item.weightUnit || fallback.weightUnit || 'g',
            price: item.price || fallback.price || 0,
            photoUrls: (item.photoUrls && item.photoUrls.length > 0) ? item.photoUrls : (fallback.photoUrls || []),
            description: item.description || fallback.description || '',
            rentalPrice: item.rentalPrice || fallback.rentalPrice || 0,
            rentalPeriod: item.rentalPeriod || fallback.rentalPeriod || 'day',
            currency: item.currency || fallback.currency || '$',
            secondaryCategories: (item.secondaryCategories && item.secondaryCategories.length > 0) ? item.secondaryCategories : (fallback.secondaryCategories || [])
          };
        }
        return item;
      });

      const sortedGearList = items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setGear(sortedGearList);
      localStorage.setItem(`gear_cache_${user.uid}`, JSON.stringify(sortedGearList));
      offlineSync.cacheGearList(user.uid, sortedGearList);
      const syncTime = new Date().toISOString();
      localStorage.setItem(`gear_cache_sync_time_${user.uid}`, syncTime);
      setLastSyncTime(syncTime);
      setLoading(false);
    }, (error) => {
      console.warn("GearLibrary: Error listening to gear library:", error);
      setLoading(false);
    });
    const unsubscribeSettings = onSnapshot(doc(db, 'adminSettings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const settingsData = docSnap.data() as AdminSettings;
        setSettings(settingsData);
        localStorage.setItem(`settings_cache`, JSON.stringify(settingsData));
      }
    }, (error) => {
      console.warn("GearLibrary: Error listening to global settings:", error);
    });

    const unsubscribeContainers = onSnapshot(collection(db, 'users', user.uid, 'containers'), (snapshot) => {
      const contList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Container));
      setContainers(contList);
      localStorage.setItem(`containers_cache_${user.uid}`, JSON.stringify(contList));
    }, (error) => {
      console.warn("GearLibrary: Error listening to containers:", error);
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
      unsubscribeSettings();
      unsubscribeContainers();
    };
  }, [user.uid, gearLimit]);

  useEffect(() => {
    if (!user.uid) return;
    const unsubOrgs = onSnapshot(query(collection(db, 'organizations'), where('ownerId', '==', user.uid)), (snap) => {
      setOrganizations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization)));
    }, (error) => {
      console.warn("GearLibrary: Error listening to organizations:", error);
    });
    
    if (user.orgId) {
      const unsubDepts = onSnapshot(query(collection(db, 'departments'), where('orgId', '==', user.orgId)), (snap) => {
        setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
      }, (error) => {
        console.warn("GearLibrary: Error listening to departments:", error);
      });
      const unsubTeams = onSnapshot(query(collection(db, 'teams'), where('orgId', '==', user.orgId)), (snap) => {
        setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
      }, (error) => {
        console.warn("GearLibrary: Error listening to teams:", error);
      });
      const unsubUsers = onSnapshot(query(collection(db, 'users'), where('orgId', '==', user.orgId)), (snap) => {
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      }, (error) => {
        console.warn("GearLibrary: Error listening to users in org:", error);
      });
      return () => {
        unsubOrgs();
        unsubDepts();
        unsubTeams();
        unsubUsers();
      };
    }

    return () => {
      unsubOrgs();
    };
  }, [user.uid, user.orgId]);

  useEffect(() => {
    setAiSuggestions(null);
  }, [editingItem?.id, isAddModalOpen]);

  const handlePackSelection = async () => {
    if (!selectedCaseId) {
      toast.error("Please select a target bag or case");
      return;
    }
    
    setIsPackingModalOpen(false);
    const toastId = toast.loading("Packing items...");
    
    try {
      const targetCase = containers.find(c => c.id === selectedCaseId);
      if (!targetCase) throw new Error("Target case not found");
      
      const newItems = [...targetCase.items, ...Array.from(selectedItems)];
      // Deduplicate
      const uniqueItems = Array.from(new Set(newItems));
      
      await updateDoc(doc(db, 'users', user.uid, 'containers', selectedCaseId), {
        items: uniqueItems,
        updatedAt: new Date().toISOString()
      });
      
      setSelectedItems(new Set());
      setSelectedCaseId(null);
      toast.success(`Successfully packed ${selectedItems.size} items into ${targetCase.name}`, { id: toastId });
    } catch (error) {
      console.error("Packing error:", error);
      toast.error("Failed to pack items", { id: toastId });
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'racks'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("Error fetching racks in GearLibrary:", err);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const handleUndoBulkAction = async (directRecord?: any) => {
    const record = directRecord || lastBulkAction;
    if (!record) return;
    
    const toastId = toast.loading("Undoing last bulk operation...");
    try {
      const updatedAt = new Date().toISOString();

      if (record.type === 'delete') {
        const itemsList = record.items;
        for (let i = 0; i < itemsList.length; i += 500) {
          const chunk = itemsList.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach((itemRec: any) => {
            if (!itemRec.gearItem?.id) return;
            const itemRef = doc(db, 'users', user?.uid, 'gearLibrary', itemRec.gearItem.id);
            batch.set(itemRef, {
              ...itemRec.gearItem,
              updatedAt
            });
          });
          await batch.commit();
        }
        
        await logActivity(
          user?.uid,
          user?.displayName || user?.email || 'Platform User',
          'gear_undo',
          `Undone batch deletion: Restored ${record.items.length} gear items`,
          { count: record.items.length }
        );
        toast.success(`Successfully restored ${record.items.length} deleted items!`, { id: toastId });
      } 
      else if (record.type === 'status') {
        const itemsList = record.items;
        for (let i = 0; i < itemsList.length; i += 500) {
          const chunk = itemsList.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach((itemRec: any) => {
            if (!itemRec.gearItem?.id) return;
            const itemRef = doc(db, 'users', user?.uid, 'gearLibrary', itemRec.gearItem.id);
            batch.update(itemRef, {
              status: itemRec.previousData?.status || 'available',
              updatedAt
            });
          });
          await batch.commit();
        }
        
        await logActivity(
          user?.uid,
          user?.displayName || user?.email || 'Platform User',
          'gear_undo',
          `Undone batch status update: Reverted ${record.items.length} items`,
          { count: record.items.length }
        );
        toast.success(`Successfully reverted status for ${record.items.length} items!`, { id: toastId });
      }
      else if (record.type === 'rack') {
        const itemsList = record.items;
        for (let i = 0; i < itemsList.length; i += 250) {
          const chunk = itemsList.slice(i, i + 250);
          const batch = writeBatch(db);
          chunk.forEach((itemRec: any) => {
            if (!itemRec.gearItem?.id) return;
            const itemRef = doc(db, 'users', user?.uid, 'gearLibrary', itemRec.gearItem.id);
            batch.update(itemRef, {
              rackId: itemRec.previousRackId || '',
              updatedAt
            });

            if (itemRec.createdRackItemId && itemRec.selectedRackId) {
              const rackItemRef = doc(db, 'racks', itemRec.selectedRackId, 'items', itemRec.createdRackItemId);
              batch.delete(rackItemRef);
            }
          });
          await batch.commit();
        }

        await logActivity(
          user?.uid,
          user?.displayName || user?.email || 'Platform User',
          'gear_undo',
          `Undone batch rack transfer`,
          { count: record.items.length }
        );
        toast.success(`Successfully removed items from rack and restored previous positions!`, { id: toastId });
      }
      else if (record.type === 'assign') {
        const itemsList = record.items;
        for (let i = 0; i < itemsList.length; i += 500) {
          const chunk = itemsList.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach((itemRec: any) => {
            if (!itemRec.gearItem?.id) return;
            const itemRef = doc(db, 'users', user?.uid, 'gearLibrary', itemRec.gearItem.id);
            batch.update(itemRef, {
              orgId: itemRec.previousData?.orgId || '',
              deptId: itemRec.previousData?.deptId || '',
              teamId: itemRec.previousData?.teamId || '',
              assignedTo: itemRec.previousData?.assignedTo || '',
              updatedAt
            });
          });
          await batch.commit();
        }

        await logActivity(
          user?.uid,
          user?.displayName || user?.email || 'Platform User',
          'gear_undo',
          `Undone batch reassignments`,
          { count: record.items.length }
        );
        toast.success(`Successfully reverted batch reassignments!`, { id: toastId });
      }

      setLastBulkAction(null);
    } catch (err) {
      console.error("Undo error:", err);
      toast.error("Failed to undo bulk operation.", { id: toastId });
    }
  };

  const handleBatchMoveToRack = async () => {
    if (selectedItems.size === 0) {
      toast.error("No items selected");
      return;
    }
    if (!selectedRackId) {
      toast.error("Please select a target rack");
      return;
    }

    const targetRack = racks.find(r => r.id === selectedRackId);
    if (!targetRack) {
      toast.error("Target rack not found");
      return;
    }

    const toastId = toast.loading(`Moving ${selectedItems.size} items to ${targetRack.name}...`);
    try {
      const updatedAt = new Date().toISOString();
      const itemsToRestore: any[] = [];
      const assetIds = Array.from(selectedItems);

      for (let i = 0; i < assetIds.length; i += 250) {
        const chunk = assetIds.slice(i, i + 250);
        const batch = writeBatch(db);
        chunk.forEach(itemId => {
          const item = gear.find(i => i.id === itemId);
          if (item) {
            const itemRef = doc(db, 'users', user.uid, 'gearLibrary', itemId);
            batch.update(itemRef, { 
              rackId: selectedRackId,
              updatedAt
            });

            const rackItemRef = doc(collection(db, 'racks', selectedRackId, 'items'));
            batch.set(rackItemRef, {
              name: item.name || 'Unnamed Asset',
              uPosition: 1,
              uHeight: 1,
              assetTag: item.assetTag || '',
              serialNumber: item.serialNumber || '',
              purchaseDate: item.purchaseDate || '',
              rackId: selectedRackId,
              gearItemId: item.id,
              status: 'installed',
              photoUrls: item.photoUrls || [],
              createdAt: updatedAt
            });

            itemsToRestore.push({
              gearItem: { ...item },
              previousRackId: item.rackId || null,
              createdRackItemId: rackItemRef.id,
              selectedRackId
            });
          }
        });
        await batch.commit();
      }
      
      const newUndoRecord = {
        type: 'rack' as const,
        items: itemsToRestore,
        timestamp: Date.now()
      };
      setLastBulkAction(newUndoRecord);

      setSelectedItems(new Set());
      setIsMoveToRackModalOpen(false);
      
      toast.success(`Successfully moved items to Rack "${targetRack.name}"`, {
        id: toastId,
        action: {
          label: "Undo",
          onClick: () => handleUndoBulkAction(newUndoRecord)
        }
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to batch move items to rack", { id: toastId });
    }
  };

  const handleBatchChangeStatus = async () => {
    if (selectedItems.size === 0) {
      toast.error("No items selected");
      return;
    }

    const toastId = toast.loading(`Changing status of ${selectedItems.size} items...`);
    try {
      const updatedAt = new Date().toISOString();
      const itemsToRestore: any[] = [];
      const assetIds = Array.from(selectedItems);

      for (let i = 0; i < assetIds.length; i += 500) {
        const chunk = assetIds.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach(itemId => {
          const item = gear.find(i => i.id === itemId);
          if (item) {
            const itemRef = doc(db, 'users', user.uid, 'gearLibrary', itemId);
            batch.update(itemRef, { 
              status: selectedBatchStatus,
              updatedAt
            });

            itemsToRestore.push({
              gearItem: { ...item },
              previousData: { status: item.status || 'available' }
            });
          }
        });
        await batch.commit();
      }

      const newUndoRecord = {
        type: 'status' as const,
        items: itemsToRestore,
        timestamp: Date.now()
      };
      setLastBulkAction(newUndoRecord);

      setSelectedItems(new Set());
      setIsChangeStatusModalOpen(false);

      toast.success(`Successfully changed status of items to ${selectedBatchStatus}`, {
        id: toastId,
        action: {
          label: "Undo",
          onClick: () => handleUndoBulkAction(newUndoRecord)
        }
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to batch change status", { id: toastId });
    }
  };

  const handleBatchAssign = async () => {
    if (selectedItems.size === 0) {
      toast.error("No items selected");
      return;
    }
    
    setIsBatchAssigning(true);
    const toastId = toast.loading(`Batch updating ${selectedItems.size} items...`);
    
    try {
      const updatedAt = new Date().toISOString();
      const itemsToRestore: any[] = [];
      const assetIds = Array.from(selectedItems);
      
      for (let i = 0; i < assetIds.length; i += 500) {
        const chunk = assetIds.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach(itemId => {
          const item = gear.find(i => i.id === itemId);
          if (item) {
            const itemRef = doc(db, 'users', user.uid, 'gearLibrary', itemId);
            const updateData: any = { updatedAt };
            
            if (shouldUpdateOrg) {
              updateData.orgId = batchOrgId || '';
              if (!shouldUpdateDept) {
                updateData.deptId = '';
                updateData.teamId = '';
              }
            }
            
            if (shouldUpdateDept) {
              updateData.deptId = batchDeptId || '';
              if (!shouldUpdateTeam) {
                updateData.teamId = '';
              }
            }
            
            if (shouldUpdateTeam) {
              updateData.teamId = batchTeamId || '';
            }
            
            if (shouldUpdateAssignee) {
              updateData.assignedTo = batchAssignedTo || '';
            }
            
            batch.update(itemRef, updateData);

            itemsToRestore.push({
              gearItem: { ...item },
              previousData: {
                orgId: item.orgId || '',
                deptId: item.deptId || '',
                teamId: item.teamId || '',
                assignedTo: item.assignedTo || ''
              }
            });
          }
        });
        await batch.commit();
      }

      const newUndoRecord = {
        type: 'assign' as const,
        items: itemsToRestore,
        timestamp: Date.now()
      };
      setLastBulkAction(newUndoRecord);

      setSelectedItems(new Set());
      setIsBatchAssignModalOpen(false);

      toast.success(`Successfully batch assigned details details!`, {
        id: toastId,
        action: {
          label: "Undo",
          onClick: () => handleUndoBulkAction(newUndoRecord)
        }
      });
    } catch (error) {
      console.error("Batch assign error:", error);
      toast.error("Failed to batch update items.", { id: toastId });
    } finally {
      setIsBatchAssigning(false);
    }
  };

  const smartPackerName = settings?.aiConfig?.smartPackerName || 'Smart Packer';

  // Merge database snapshot with pending offline gear changes for instant local rendering
  const effectiveGear = useMemo(() => {
    let items = [...gear];

    // Filter operations related to user's gearLibrary subcollection:
    // collectionPath: ['users', userId, 'gearLibrary', docId]
    const relevantOps = offlineQueue.filter(op => {
      return op.collectionPath[0] === 'users' && 
             op.collectionPath[2] === 'gearLibrary';
    });

    relevantOps.forEach(op => {
      if (op.type === 'delete') {
        items = items.filter(it => it.id !== op.docId);
      } else if (op.type === 'update') {
        const idx = items.findIndex(it => it.id === op.docId);
        if (idx !== -1) {
          items[idx] = { 
            ...items[idx], 
            ...op.data, 
            isOfflinePending: true,
            offlineOpId: op.id 
          };
        }
      } else if (op.type === 'set') {
        if (!items.some(it => it.id === op.docId)) {
          items.push({
            id: op.docId,
            ...op.data,
            isOfflinePending: true,
            offlineOpId: op.id
          });
        }
      }
    });

    return items;
  }, [gear, offlineQueue]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    effectiveGear.forEach(item => {
      const p = getPrimaryCategory(item);
      if (p && p !== 'Kit' && p !== 'Kits' && p !== 'All') {
        cats.add(p);
      }
      if (categoryFilterMode === 'all') {
        getSecondaryCategories(item).forEach(s => {
          if (s && s !== 'Kit' && s !== 'Kits' && s !== 'All') {
            cats.add(s);
          }
        });
      }
    });
    return ['All', 'Kits', ...Array.from(cats)];
  }, [effectiveGear, categoryFilterMode]);

  const filteredGear = useMemo(() => {
    return effectiveGear.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                           item.brand?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           item.tags?.some(tag => tag.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' 
        ? true 
        : selectedCategory === 'Kits' 
          ? (item.isKit || item.category === 'Kit' || item.category === 'Kits' || item.primaryCategory === 'Kit' || item.primaryCategory === 'Kits') 
          : (categoryFilterMode === 'primary'
            ? getPrimaryCategory(item) === selectedCategory
            : (getPrimaryCategory(item) === selectedCategory || getSecondaryCategories(item).includes(selectedCategory))
          );
      const matchesCondition = selectedCondition === 'all' || item.condition === selectedCondition;

      // Privacy View Layer filter check
      if (privacyLayerFilter !== 'all') {
        const itemVis = item.visibility || 'public';
        if (privacyLayerFilter !== itemVis) {
          return false;
        }
      }

      // Audit Mode filters
      if (isAuditMode && showOnlyAttentionNeeded) {
        const needsAttention = isMaintenanceOutdated(item) || isLowInventory(item);
        if (!needsAttention) return false;
      }

      return matchesSearch && matchesCategory && matchesCondition;
    }).sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'weight':
          comparison = (a.weight || 0) - (b.weight || 0);
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'usageCount':
          comparison = (a.usageCount || 0) - (b.usageCount || 0);
          break;
        case 'health':
          comparison = getHealthScore(a) - getHealthScore(b);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [effectiveGear, debouncedSearchTerm, selectedCategory, categoryFilterMode, selectedCondition, privacyLayerFilter, isAuditMode, showOnlyAttentionNeeded, sortField, sortOrder]);

  const paginatedGear = useMemo(() => {
    if (itemsPerPage === -1) return filteredGear;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredGear.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredGear, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === -1) return 1;
    return Math.max(1, Math.ceil(filteredGear.length / itemsPerPage));
  }, [filteredGear.length, itemsPerPage]);

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Item',
      message: 'Are you sure you want to remove this item from your library?',
      onConfirm: async () => {
        const path = `users/${user.uid}/gearLibrary/${id}`;
        try {
          if (!isOnline) {
            const targetItem = effectiveGear.find(it => it.id === id);
            await offlineSync.queueOperation({
              type: 'delete',
              collectionPath: ['users', user.uid, 'gearLibrary', id],
              docId: id,
              label: `Delete gear: ${targetItem?.name || 'Item'}`
            });
            toast.success('Flagged item for removal offline.');
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            return;
          }

          const targetItem = effectiveGear.find(it => it.id === id);
          await deleteDoc(doc(db, 'users', user.uid, 'gearLibrary', id));
          await logActivity(
            user.uid,
            user.displayName || user.email || 'Platform User',
            'gear_delete',
            `Removed gear "${targetItem?.name || 'Unknown Item'}" from Gear Library`,
            { gearName: targetItem?.name || 'Unknown' }
          );
          toast.success('Item removed from library');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, path);
        }
      }
    });
  };

  const handleBatchDelete = async () => {
    if (selectedItems.size === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Remove Selected Items',
      message: `Are you sure you want to remove all ${selectedItems.size} selected items from your library? This action is irreversible.`,
      onConfirm: async () => {
        const toastId = toast.loading(`Removing ${selectedItems.size} items from library...`);
        try {
          if (!isOnline) {
            const batchOperations = Array.from(selectedItems).map(id => {
              const targetItem = effectiveGear.find(it => it.id === id);
              return offlineSync.queueOperation({
                type: 'delete',
                collectionPath: ['users', user?.uid, 'gearLibrary', id],
                docId: id,
                label: `Delete gear: ${targetItem?.name || 'Item'}`
              });
            });
            await Promise.all(batchOperations);
            toast.success(`Flagged ${selectedItems.size} items for removal offline.`, { id: toastId });
            setSelectedItems(new Set());
            setIsMultiSelectMode(false);
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            return;
          }

          const itemsToRestore = Array.from(selectedItems).map(id => {
            const item = effectiveGear.find(u => u.id === id);
            return {
              gearItem: { ...item } as GearItem
            };
          }).filter(u => u.gearItem !== undefined && u.gearItem.id !== undefined);

          const ids = Array.from(selectedItems);
          for (let i = 0; i < ids.length; i += 500) {
            const chunk = ids.slice(i, i + 500);
            const batch = writeBatch(db);
            chunk.forEach(id => {
              const itemRef = doc(db, 'users', user?.uid, 'gearLibrary', id);
              batch.delete(itemRef);
            });
            await batch.commit();
          }

          await logActivity(
            user?.uid,
            user?.displayName || user?.email || 'Platform User',
            'gear_delete',
            `Removed ${selectedItems.size} items from Gear Library via batch deletion`,
            { count: selectedItems.size }
          );

          const newUndoRecord = {
            type: 'delete' as const,
            items: itemsToRestore,
            timestamp: Date.now()
          };
          setLastBulkAction(newUndoRecord);

          toast.success(`Successfully removed ${selectedItems.size} assets from library`, {
            id: toastId,
            action: {
              label: "Undo",
              onClick: () => handleUndoBulkAction(newUndoRecord)
            }
          });
          setSelectedItems(new Set());
          setIsMultiSelectMode(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          toast.error("Failed to batch delete items.", { id: toastId });
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          handleFirestoreError(error, OperationType.DELETE, `users/${user?.uid}/gearLibrary`);
        }
      }
    });
  };

  const cleanUndefinedFields = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => cleanUndefinedFields(item));
    }
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = cleanUndefinedFields(val);
      }
    }
    return clean;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const { id, ...data } = editingItem;
      const updatedAt = new Date().toISOString();
      const path = `users/${user.uid}/gearLibrary/${id}`;

      const pCat = data.primaryCategory || data.category || 'Other';
      const updatePayload = cleanUndefinedFields({
        ...data,
        category: pCat,
        primaryCategory: pCat,
        secondaryCategories: data.secondaryCategories || [],
        model: data.model || '',
        modelNumber: data.modelNumber || '',
        serialNumber: data.serialNumber || '',
        releaseYear: data.releaseYear || '',
        updatedAt: updatedAt
      });

      if (!isOnline) {
        await offlineSync.queueOperation({
          type: 'update',
          collectionPath: ['users', user.uid, 'gearLibrary', id],
          docId: id,
          data: updatePayload,
          label: `Update gear: ${data.name || 'Item'}`
        });
        setEditingItem(null);
        toast.success('Updated gear details offline.');
        return;
      }

      // Log version before updating
      await addDoc(collection(db, 'users', user.uid, 'gearLibrary', id, 'versions'), cleanUndefinedFields({
        gearId: id,
        name: data.name,
        category: pCat,
        condition: data.condition || 'good',
        photoUrls: data.photoUrls || [],
        updatedAt: updatedAt,
        updatedBy: user.uid
      }));

      await updateDoc(doc(db, 'users', user.uid, 'gearLibrary', id), updatePayload);

      // Write-time synchronization: Propagate item-specific details to all items with matching name
      const sameNameItems = gear.filter(g => g.id !== id && g.name && g.name.trim().toLowerCase() === data.name.trim().toLowerCase());
      if (sameNameItems.length > 0) {
        for (let i = 0; i < sameNameItems.length; i += 500) {
          const chunk = sameNameItems.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach(item => {
            const itemRef = doc(db, 'users', user.uid, 'gearLibrary', item.id);
            batch.update(itemRef, {
              brand: data.brand || '',
              model: data.model || '',
              modelNumber: data.modelNumber || '',
              serialNumber: data.serialNumber || '',
              releaseYear: data.releaseYear || '',
              weight: data.weight || 0,
              weightUnit: data.weightUnit || 'g',
              price: data.price || 0,
              photoUrls: data.photoUrls || [],
              description: data.description || '',
              isAvailableForRent: data.isAvailableForRent ?? false,
              isSale: data.isSale ?? false,
              rentalPrice: data.rentalPrice || 0,
              rentalHourlyPrice: data.rentalHourlyPrice || 0,
              rentalDeposit: data.rentalDeposit || 0,
              rentalPeriod: data.rentalPeriod || 'day',
              currency: data.currency || '$',
              secondaryCategories: data.secondaryCategories || [],
              minRentalDays: data.minRentalDays || 1,
              maxRentalDays: data.maxRentalDays || 30,
              lensType: data.lensType || '',
              lensMount: data.lensMount || '',
              focalLength: data.focalLength || '',
              maxAperture: data.maxAperture || '',
              formatCoverage: data.formatCoverage || '',
              focusType: data.focusType || '',
              updatedAt: updatedAt
            });
          });
          await batch.commit();
        }
      }

      setEditingItem(null);
      toast.success('Item updated (including duplicates) and version logged');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/gearLibrary/${editingItem.id}`);
    }
  };

  const fetchHistory = async (gearId: string) => {
    try {
      const q = query(
        collection(db, 'users', user.uid, 'gearLibrary', gearId, 'versions'),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItemVersion));
      setHistoryItems(history);
      setShowHistory(true);
    } catch (error) {
      toast.error('Failed to fetch history');
    }
  };

  const handleRevert = async (version: GearItemVersion) => {
    if (!editingItem) return;
    setConfirmModal({
      isOpen: true,
      title: 'Revert Version',
      message: 'Revert this item to this version? Current changes will be lost.',
      onConfirm: async () => {
        const path = `users/${user.uid}/gearLibrary/${editingItem.id}`;
        try {
          const updatedItem = {
            ...editingItem,
            name: version.name,
            category: version.category,
            condition: version.condition,
            photoUrls: version.photoUrls,
            updatedAt: new Date().toISOString()
          };
          
          const { id, ...data } = updatedItem;
          await updateDoc(doc(db, 'users', user.uid, 'gearLibrary', id), cleanUndefinedFields(data));
          setEditingItem(updatedItem);
          setShowHistory(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          toast.success('Item reverted to selected version');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, path);
        }
      }
    });
  };

  const fetchIncidents = async (gearId: string) => {
    try {
      const q = query(
        collection(db, 'users', user.uid, 'gearLibrary', gearId, 'incidents'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const fetchedIncidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearIncident));
      setIncidents(fetchedIncidents);
      setShowIncidents(true);
    } catch (error) {
      toast.error('Failed to fetch incidents');
    }
  };

  const handleLogIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const path = `users/${user.uid}/gearLibrary/${editingItem.id}/incidents`;
      const incidentData = {
        ...newIncident,
        gearId: editingItem.id,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'users', user.uid, 'gearLibrary', editingItem.id, 'incidents'), incidentData);
      
      // If incident is severe, update item condition automatically
      if (newIncident.severity === 'high' || newIncident.severity === 'critical') {
        await updateDoc(doc(db, 'users', user.uid, 'gearLibrary', editingItem.id), {
          condition: 'poor',
          updatedAt: new Date().toISOString()
        });
        setEditingItem({ ...editingItem, condition: 'poor' });
      }

      setIsLoggingIncident(false);
      setNewIncident({
        type: 'damage',
        description: '',
        date: new Date().toISOString().split('T')[0],
        severity: 'medium',
        resolved: false
      });
      fetchIncidents(editingItem.id);
      toast.success('Incident logged successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/gearLibrary/${editingItem.id}/incidents`);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    if (!editingItem) return;
    const path = `users/${user.uid}/gearLibrary/${editingItem.id}/incidents/${incidentId}`;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'gearLibrary', editingItem.id, 'incidents', incidentId), {
        resolved: true
      });
      fetchIncidents(editingItem.id);
      toast.success('Incident marked as resolved');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleAIScan = async (base64Image: string) => {
    const aiCheck = await canUseAI(user, settings);
    if (!aiCheck.allowed) {
      toast.error(aiCheck.reason);
      return;
    }

    setIsAIProcessing(true);
    setAiSuggestions(null);
    try {
      const result = await identifyItem(base64Image.split(',')[1] || base64Image);
      if (result.isClear) {
        await trackAIUsage(user.uid);
        
        // Optimization: Check if we already have this item in the library to reuse metadata
        const existingItem = settings?.aiConfig?.cachingEnabled 
          ? gear.find(g => g.name.toLowerCase() === result.name.toLowerCase())
          : null;

        const finalData = existingItem ? {
          name: existingItem.name,
          category: existingItem.category,
          tags: existingItem.tags,
          organizationTip: existingItem.organizationTip
        } : result;

        setAiSuggestions({
          name: finalData.name,
          category: finalData.category,
          tags: finalData.tags,
          organizationTip: finalData.organizationTip
        });
        
        // Auto-apply if it's a new item and name is empty
        if (isAddModalOpen && !newItem.name) {
          setNewItem(prev => ({
            ...prev,
            name: finalData.name,
            category: finalData.category || prev.category,
            tags: [...new Set([...(prev.tags || []), ...(finalData.tags || [])])],
            organizationTip: finalData.organizationTip || prev.organizationTip
          }));
          toast.success(`${smartPackerName} identified and applied: ${finalData.name}`);
        } else {
          toast.success(`${smartPackerName} identified: ${finalData.name}${existingItem ? ' (from library)' : ''}`);
        }
      } else {
        toast.warning(`${smartPackerName} identification unclear: ${result.reason}`);
      }
    } catch (error) {
      console.error("AI Identification failed:", error);
      toast.error(`${smartPackerName} identification failed`);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleMagicSuggest = async () => {
    const aiCheck = await canUseAI(user, settings);
    if (!aiCheck.allowed) {
      toast.error(aiCheck.reason);
      return;
    }

    const name = editingItem ? editingItem.name : newItem.name;
    const category = editingItem ? editingItem.category : newItem.category;

    if (!name) {
      toast.error('Please enter an item name first');
      return;
    }

    setIsAIProcessing(true);
    setAiSuggestions(null);
    try {
      // Optimization: Check if we already have this item in the library
      const existingItem = settings?.aiConfig?.cachingEnabled 
        ? gear.find(g => g.name.toLowerCase() === name.toLowerCase() && g.category === category)
        : null;

      if (existingItem && settings?.aiConfig?.cachingEnabled) {
        setAiSuggestions({
          category: existingItem.category,
          tags: existingItem.tags,
          organizationTip: existingItem.organizationTip
        });
        toast.success(`${smartPackerName} suggestions loaded from existing library item`);
      } else {
        const result = await suggestItemMetadata(name, category);
        await trackAIUsage(user.uid);
        setAiSuggestions({
          category: result.suggestedCategory,
          tags: result.suggestedTags,
          organizationTip: result.organizationTip
        });
        toast.success(`${smartPackerName} suggestions ready`);
      }
    } catch (error) {
      console.error("AI Metadata suggestion failed:", error);
      toast.error(`${smartPackerName} suggestions failed`);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const [isEstimatingWeight, setIsEstimatingWeight] = useState(false);

  const handleEstimateWeight = async (target: 'new' | 'edit') => {
    const item = target === 'edit' ? editingItem : newItem;
    if (!item) return;

    if (!item.name?.trim()) {
      toast.error('Please enter an item name first so AI has context');
      return;
    }

    const aiCheck = await canUseAI(user, settings);
    if (!aiCheck.allowed) {
      toast.error(aiCheck.reason);
      return;
    }

    setIsEstimatingWeight(true);
    const toastId = toast.loading("AI is estimating weight...");
    try {
      const response = await fetch("/api/estimate-weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          brand: item.brand || '',
          model: item.model || '',
          description: item.description || ''
        })
      });

      if (!response.ok) {
        throw new Error("Server error: " + response.status);
      }

      const data = await response.json();
      if (data.weight !== undefined) {
        if (target === 'edit') {
          setEditingItem(prev => prev ? {
            ...prev,
            weight: data.weight,
            weightUnit: data.weightUnit || prev.weightUnit || 'g'
          } : null);
        } else {
          setNewItem(prev => ({
            ...prev,
            weight: data.weight,
            weightUnit: data.weightUnit || prev.weightUnit || 'g'
          }));
        }
        await trackAIUsage(user.uid);
        if (data.reasoning) {
          toast.success(`Weight loaded: ${data.weight} ${data.weightUnit}. ${data.reasoning}`, { id: toastId, duration: 6000 });
        } else {
          toast.success(`Weight estimated successfully: ${data.weight} ${data.weightUnit}`, { id: toastId });
        }
      } else {
        toast.error("Could not obtain weight specs from AI.", { id: toastId });
      }
    } catch (error) {
      console.error("AI Weight estimation failed:", error);
      toast.error("AI Weight estimation failed. Please try again.", { id: toastId });
    } finally {
      setIsEstimatingWeight(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newItem.name?.trim()) {
      toast.error('Please enter an item name');
      return;
    }

    const limitCheck = await checkLimit(user, settings, 'gearItems');
    if (!limitCheck.allowed) {
      toast.error(`Limit reached: You can only have ${limitCheck.limit} gear items on the ${user.plan} plan.`);
      return;
    }

    try {
      const path = `users/${user.uid}/gearLibrary`;
      const pCat = newItem.primaryCategory || newItem.category || 'Other';
      const colRef = collection(db, 'users', user.uid, 'gearLibrary');
      
      const isBatchAutogen = trackingMode === 'serialized' && (newItem.quantity || 1) > 1;

      if (isBatchAutogen && isOnline) {
        const qtyToGen = newItem.quantity || 1;
        const batch = writeBatch(db);
        const generatedNames: string[] = [];
        
        for (let i = 1; i <= qtyToGen; i++) {
          const newDocRef = doc(colRef);
          
          // Generate sequential / custom serial
          let computedSerial = newItem.serialNumber || '';
          if (serialPrefix.trim()) {
            const startNum = parseInt(serialStartNum) || 1;
            computedSerial = `${serialPrefix.trim()}${startNum + (i - 1)}`;
          } else if (newItem.serialNumber) {
            computedSerial = `${newItem.serialNumber}-${i}`;
          }
          
          const payload = cleanUndefinedFields({
            ...newItem,
            name: `${newItem.name} [#${i}]`,
            category: pCat,
            primaryCategory: pCat,
            secondaryCategories: newItem.secondaryCategories || [],
            model: newItem.model || '',
            modelNumber: newItem.modelNumber || '',
            serialNumber: computedSerial,
            releaseYear: newItem.releaseYear || '',
            ownerId: user.uid,
            assetTag: `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            usageCount: 0,
            quantity: 1, // Individual serialized status
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          
          batch.set(newDocRef, payload);
          generatedNames.push(payload.name);
        }
        
        await batch.commit();

        if (user.orgId) {
          triggerGoogleChatAlert(
            user.orgId, 
            'gear_added', 
            `🆕 *Batch Serialized Gear Registered*:\n• *Parent Asset*: ${newItem.name}\n• *Total Copies Onboarded*: ${qtyToGen}\n• *By*: ${user.displayName || user.email || 'Team User'}`
          ).catch(err => console.warn('Google Chat notification skipped:', err));
        }

        await logActivity(
          user.uid,
          user.displayName || user.email || 'Platform User',
          'gear_add_batch',
          `Batch onboarded ${qtyToGen} serialized copies of "${newItem.name}"`,
          { parentName: newItem.name, qty: qtyToGen }
        );
      } else {
        const preGeneratedId = doc(colRef).id;
        const newGearPayload = cleanUndefinedFields({
          ...newItem,
          category: pCat,
          primaryCategory: pCat,
          secondaryCategories: newItem.secondaryCategories || [],
          model: newItem.model || '',
          modelNumber: newItem.modelNumber || '',
          serialNumber: newItem.serialNumber || '',
          releaseYear: newItem.releaseYear || '',
          ownerId: user.uid,
          assetTag: `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          usageCount: 0,
          quantity: newItem.quantity || 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        if (!isOnline) {
          await offlineSync.queueOperation({
            type: 'set',
            collectionPath: ['users', user.uid, 'gearLibrary', preGeneratedId],
            docId: preGeneratedId,
            data: {
              ...newGearPayload,
              id: preGeneratedId
            },
            label: `Add gear: ${newItem.name || 'Item'}`
          });
        } else {
          await addDoc(colRef, newGearPayload);
          if (user.orgId) {
            triggerGoogleChatAlert(
              user.orgId, 
              'gear_added', 
              `🆕 *New Gear Registered*:\n• *Name*: ${newItem.name}\n• *Category*: ${newItem.category}\n• *Condition*: ${newItem.condition}\n• *By*: ${user.displayName || user.email || 'Team User'}`
            ).catch(err => console.warn('Google Chat notification skipped:', err));
          }
          await logActivity(
            user.uid,
            user.displayName || user.email || 'Platform User',
            'gear_add',
            `Added gear "${newItem.name}" to Gear Library`,
            { gearName: newItem.name }
          );
        }
      }

      setIsAddModalOpen(false);
      setNewItem({
        name: '',
        category: 'Other',
        primaryCategory: 'Other',
        secondaryCategories: [],
        model: '',
        modelNumber: '',
        serialNumber: '',
        releaseYear: '',
        condition: 'good',
        weight: 0,
        price: 0,
        brand: '',
        description: '',
        tags: [],
        organizationTip: '',
        quantity: 1,
        photoUrls: ['https://picsum.photos/seed/gear/400/400']
      });
      setTrackingMode('bulk');
      setSerialPrefix('');
      setSerialStartNum('');
      toast.success(trackingMode === 'serialized' && (newItem.quantity || 1) > 1 
        ? `Batch generated ${newItem.quantity} serialized copies successfully!` 
        : 'Gear added to library'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/gearLibrary`);
    }
  };

  const getInsights = () => {
    const insights = [];
    
    const poorConditionItems = gear.filter(i => i.condition === 'poor');
    if (poorConditionItems.length > 0) {
      insights.push({
        type: 'maintenance',
        icon: <AlertCircle className="text-amber-500" />,
        title: 'Maintenance Alert',
        text: `You have ${poorConditionItems.length} item(s) in poor condition. Schedule a check for "${poorConditionItems[0].name}" soon.`
      });
    }

    if (totalWeight > 10000) {
      insights.push({
        type: 'weight',
        icon: <Weight className="text-primary" />,
        title: 'Weight Optimization',
        text: `Your library total is ${(totalWeight / 1000).toFixed(1)}kg. Consider lighter alternatives for your heaviest items.`
      });
    }

    if (totalValue > 5000) {
      insights.push({
        type: 'insurance',
        icon: <Shield className="text-blue-500" />,
        title: 'Insurance Tip',
        text: `With a gear value of $${totalValue.toLocaleString()}, ensure your travel insurance covers high-value equipment.`
      });
    }

    const highUsage = [...gear].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0];
    if (highUsage && (highUsage.usageCount || 0) > 5) {
      insights.push({
        type: 'usage',
        icon: <TrendingUp className="text-green-500" />,
        title: 'Core Essential',
        text: `"${highUsage.name}" is your most used item (${highUsage.usageCount} trips). It's a key part of your kit.`
      });
    }

    return insights.length > 0 ? insights.slice(0, 2) : [
      {
        type: 'welcome',
        icon: <Zap className="text-primary" />,
        title: `Welcome to ${smartPackerName}`,
        text: `Add more gear to unlock personalized ${smartPackerName} insights and maintenance tracking.`
      }
    ];
  };

  const totalWeight = gear.reduce((acc, item) => acc + (item.weight || 0), 0);
  const totalValue = gear.reduce((acc, item) => acc + (item.price || 0), 0);

  const get6MonthAnalyticsData = () => {
    const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
    const activeGearValue = totalValue || 12500;
    
    // Count items currently in_use for a realistic current state
    const inUseItems = gear.filter(i => i.status === 'in_use').length;
    const currentUtilRate = gear.length ? Math.round((inUseItems / gear.length) * 100) : 55;
    
    // Baseline trends that scale with actual live current status
    const baseTrends = [
      { utilMult: 0.80, revFactor: 0.042 },
      { utilMult: 0.88, revFactor: 0.048 },
      { utilMult: 1.05, revFactor: 0.055 },
      { utilMult: 1.12, revFactor: 0.064 },
      { utilMult: 1.22, revFactor: 0.078 },
      { utilMult: 1.30, revFactor: 0.088 }
    ];

    let accumulatedRevenue = 0;

    return baseTrends.map((trend, index) => {
      const monthName = months[index];
      // Bound utilization between 15% and 95%
      const calculatedUtilRate = Math.min(95, Math.max(15, Math.round(currentUtilRate * trend.utilMult)));
      const monthlyRevenue = activeGearValue * (calculatedUtilRate / 100) * trend.revFactor;
      accumulatedRevenue += monthlyRevenue;
      
      const accumulativeROI = activeGearValue > 0 ? ((accumulatedRevenue / activeGearValue) * 100) : 0;
      
      return {
        month: monthName,
        utilization: calculatedUtilRate,
        revenue: Math.round(monthlyRevenue),
        accumulatedRevenue: Math.round(accumulatedRevenue),
        roi: parseFloat(accumulativeROI.toFixed(1))
      };
    });
  };

  const applyInheritanceToItems = async (itemIds: string[], kitItem: Partial<GearItem>) => {
    const toastId = toast.loading("Updating organizational assignments...");
    try {
      const updates = itemIds.map(id => {
        const itemRef = doc(db, 'users', user.uid, 'gearLibrary', id);
        return updateDoc(itemRef, {
          orgId: kitItem.orgId || '',
          deptId: kitItem.deptId || kitItem.orgId ? '' : undefined,
          teamId: kitItem.teamId || kitItem.deptId ? '' : undefined,
          updatedAt: new Date().toISOString()
        });
      });
      await Promise.all(updates);
      toast.success("Assignments updated", { id: toastId });
    } catch (error) {
      console.error("Inheritance error:", error);
      toast.error("Failed to update assignments", { id: toastId });
    }
  };

  const getHealthScore = (item: GearItem) => {
    let score = 100;
    if (item.condition === 'good') score -= 10;
    if (item.condition === 'fair') score -= 30;
    if (item.condition === 'poor') score -= 60;
    
    score -= (item.usageCount || 0) * 2;
    return Math.max(0, score);
  };

  const handleIncrementUsage = async (item: GearItem) => {
    const path = `users/${user.uid}/gearLibrary/${item.id}`;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'gearLibrary', item.id), {
        usageCount: (item.usageCount || 0) + 1,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Usage updated for ${item.name}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const renderMarketplaceSetup = (item: GearItem, setItem: (updatedItem: GearItem) => void) => {
    const isMarketplaceEnabled = item.secondaryCategories?.includes('Rentable') || false;

    // Fiji FRCS compliance check
    const hasPlatformRepresentation = user.fijiBusinessStatus === 'platform_representation' || user.fijiUsePlatformBusinessLicense === true;
    const hasRegisteredBusiness = user.fijiBusinessStatus === 'registered' || (!!user.fijiBusinessRegisteredName && !!user.fijiBusinessLicenseNumber);
    const hasVerifiedListerOption = hasRegisteredBusiness || hasPlatformRepresentation || user.fijiAllowPackerListToList === true;

    // Helper to add addon
    const handleAddAddOn = () => {
      let addonName = '';
      let defaultPrice = 0;
      
      if (selectedAddOnItemId) {
        const found = gear.find(g => g.id === selectedAddOnItemId);
        if (found) {
          addonName = `${found.brand || ''} ${found.model || found.name}`.trim();
          defaultPrice = found.rentalPrice || 0;
        }
      } else if (customAddOnName.trim()) {
        addonName = customAddOnName.trim();
      }

      if (!addonName) {
        toast.error("Please specify a custom accessory name or select an existing gear item");
        return;
      }

      const finalPrice = addOnPriceOption === 'default' ? defaultPrice : addOnCustomPrice;

      const newAddOn = {
        itemId: selectedAddOnItemId || undefined,
        name: addonName,
        price: finalPrice,
        useDefaultPrice: addOnPriceOption === 'default',
        type: addOnType,
        notes: addOnNotes.trim() || undefined
      };

      const currentAddOns = item.addOns || [];
      setItem({
        ...item,
        addOns: [...currentAddOns, newAddOn]
      });

      // Reset form
      setSelectedAddOnItemId('');
      setCustomAddOnName('');
      setAddOnType('Accessory');
      setAddOnNotes('');
      setAddOnCustomPrice(0);
      setAddOnPriceOption('custom');
      setShowAddOnCreator(false);
      toast.success(`Add-on "${addonName}" bundled successfully!`);
    };

    const handleRemoveAddOn = (index: number) => {
      const current = item.addOns || [];
      const updated = current.filter((_, idx) => idx !== index);
      setItem({ ...item, addOns: updated });
      toast.success("Add-on removed");
    };

    return (
      <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 space-y-5 shadow-sm text-left">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div>
            <h4 className="font-extrabold text-sm text-neutral-800 flex items-center gap-2">
              <Globe size={18} className="text-[#0066cc]" />
              <span>Public Marketplace Configuration</span>
            </h4>
            <p className="text-[11px] text-neutral-500 mt-1">
              Configure rentability, outright buyouts, and bundle accessories.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={isMarketplaceEnabled}
              onChange={(e) => {
                if (e.target.checked && !hasVerifiedListerOption) {
                  toast.error("Fiji Compliance Required: Register your FRCS business info or select Platform Representation in your User Profile under Business & KYC tab first!");
                  return;
                }
                const list = item.secondaryCategories || [];
                const updatedCategories = e.target.checked 
                  ? [...list, 'Rentable']
                  : list.filter(c => c !== 'Rentable');
                setItem({ 
                  ...item, 
                  secondaryCategories: updatedCategories,
                  isAvailableForRent: e.target.checked,
                  isSale: e.target.checked ? (item.isSale ?? false) : false
                });
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0044cc]"></div>
          </label>
        </div>

        {/* Fiji FRCS Compliance Banner */}
        {hasVerifiedListerOption && (
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col gap-1 text-[11px] font-medium leading-relaxed">
            {hasRegisteredBusiness ? (
              <span className="text-[#002f6c] font-bold flex items-center gap-1.5">
                🇫🇯 Compliant Direct Storefront Listing
              </span>
            ) : hasPlatformRepresentation ? (
              <span className="text-amber-600 font-bold flex items-center gap-1.5 animate-pulse">
                🇫🇯 Compliant Platform represented (Subject to 10% platform fee)
              </span>
            ) : (
              <span className="text-neutral-500 font-bold flex items-center gap-1.5">
                🇫🇯 Verified Listing (Authorized sub-lister)
              </span>
            )}
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
              Registered Business: {user.fijiBusinessRegisteredName || "Platform Representative"}
            </p>
          </div>
        )}

        {isMarketplaceEnabled ? (
          <div className="space-y-6 animate-fadeIn font-sans">
            {/* Listing Flexibility Choice */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Flexibility Settings</span>
              <p className="text-[11px] text-neutral-400">Make this item available for daily rental, outright purchase/sale, or both options simultaneously.</p>
              
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const currentlyRent = item.isAvailableForRent !== false;
                    const nextRent = !currentlyRent;
                    // Prevent unchecking both
                    if (!nextRent && !item.isSale) {
                      toast.error("At least one option must be selected if marketplace is active.");
                      return;
                    }
                    setItem({ ...item, isAvailableForRent: nextRent });
                  }}
                  className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition ${
                    item.isAvailableForRent !== false
                      ? 'bg-neutral-50 border-neutral-900 ring-1 ring-neutral-900'
                      : 'bg-white border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <span className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                    <input 
                      type="checkbox" 
                      checked={item.isAvailableForRent !== false} 
                      onChange={() => {}} // handled by parent btn
                      className="rounded text-neutral-900 focus:ring-0" 
                    />
                    <span>Allow Daily Rental</span>
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1">Renters reserve this per day.</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextSale = !item.isSale;
                    // Prevent unchecking both
                    if (!nextSale && item.isAvailableForRent === false) {
                      toast.error("At least one option must be selected if marketplace is active.");
                      return;
                    }
                    setItem({ ...item, isSale: nextSale });
                  }}
                  className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition ${
                    item.isSale === true
                      ? 'bg-neutral-50 border-neutral-900 ring-1 ring-neutral-900'
                      : 'bg-white border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <span className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                    <input 
                      type="checkbox" 
                      checked={item.isSale === true} 
                      onChange={() => {}} // handled by parent btn
                      className="rounded text-neutral-900 focus:ring-0" 
                    />
                    <span>Allow Outright Buyout</span>
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1">Users purchase item out-of-hand.</span>
                </button>
              </div>
            </div>

            {/* Rental Rates Setting */}
            {item.isAvailableForRent !== false && (
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/60 grid sm:grid-cols-2 gap-4 animate-fadeIn">
                <div className="col-span-2 border-b border-neutral-100 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">Rental Pricing Structures & Security Deposits</span>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Rental Price / Hour</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-neutral-400">{item.currency || '$'}</span>
                    <input
                      type="number"
                      value={item.rentalHourlyPrice || ''}
                      onChange={(e) => setItem({ ...item, rentalHourlyPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-neutral-200 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0066cc]"
                      placeholder="e.g. 10"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Rental Price / Day</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-neutral-400">{item.currency || '$'}</span>
                    <input
                      type="number"
                      value={item.rentalPrice || ''}
                      onChange={(e) => setItem({ ...item, rentalPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-neutral-200 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0066cc]"
                      placeholder="e.g. 45"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Booking Security Deposit</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-neutral-400">{item.currency || '$'}</span>
                    <input
                      type="number"
                      value={item.rentalDeposit || ''}
                      onChange={(e) => setItem({ ...item, rentalDeposit: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-neutral-200 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0066cc]"
                      placeholder="e.g. 150"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Currency Unit</label>
                  <select
                    value={item.currency || '$'}
                    onChange={(e) => setItem({ ...item, currency: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0066cc]"
                  >
                    <option value="$">USD ($)</option>
                    <option value="€">EUR (€)</option>
                    <option value="£">GBP (£)</option>
                    <option value="A$">AUD (A$)</option>
                    <option value="FJD">FJD (FJD)</option>
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Rental Policy</label>
                  <select
                    value={item.rentalPeriod || 'day'}
                    onChange={(e) => setItem({ ...item, rentalPeriod: e.target.value as any })}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0066cc]"
                  >
                    <option value="day">Instant Booking (Auto-accept reservation contracts)</option>
                    <option value="week">Manual verification (Host verification requirements)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Min Rental Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 1"
                    value={item.minRentalDays || ''}
                    onChange={(e) => setItem({ ...item, minRentalDays: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0066cc]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Max Rental Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 30"
                    value={item.maxRentalDays || ''}
                    onChange={(e) => setItem({ ...item, maxRentalDays: parseInt(e.target.value) || 30 })}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0066cc]"
                  />
                </div>

                {/* Rental Add-ons Support */}
                <div className="col-span-2 pt-3 border-t border-neutral-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block">Optional Rental Add-Ons</span>
                      <span className="text-[10px] text-neutral-400 block -mt-0.5">Bundle lenses, cables, or filters with custom rates.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddOnCreator(!showAddOnCreator)}
                      className="flex items-center gap-1 bg-[#0066cc]/15 hover:bg-[#0066cc]/25 text-[#0066cc] px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                    >
                      <Plus size={11} />
                      <span>{showAddOnCreator ? 'Hide Form' : 'Add Add-On'}</span>
                    </button>
                  </div>

                  {showAddOnCreator && (
                    <div className="bg-white border border-neutral-200 p-3.5 rounded-xl space-y-3.5 shadow-sm animate-fadeIn text-xs">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Step 1: Choose or name the Add-On</label>
                        <select
                          value={selectedAddOnItemId}
                          onChange={(e) => {
                            setSelectedAddOnItemId(e.target.value);
                            if (e.target.value) {
                              const selected = gear.find(g => g.id === e.target.value);
                              if (selected) {
                                setAddOnCustomPrice(selected.rentalPrice || 0);
                              }
                              setCustomAddOnName('');
                            }
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                        >
                          <option value="">-- Select from existing Gear Library --</option>
                          {gear.filter(g => g.id !== item.id).map(g => (
                            <option key={g.id} value={g.id}>
                              {g.brand || ''} {g.model || g.name} (Own rate: {formatCurrency(g.rentalPrice || 0, g.currency || 'FJD')}/day)
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-2">
                          <hr className="grow border-neutral-200" />
                          <span className="text-[9px] text-neutral-400 uppercase font-bold">Or Add Custom Accessory</span>
                          <hr className="grow border-neutral-200" />
                        </div>

                        <input
                          type="text"
                          disabled={!!selectedAddOnItemId}
                          value={customAddOnName}
                          onChange={(e) => setCustomAddOnName(e.target.value)}
                          placeholder="e.g. Filter Kit / SD Card / Rain Cover"
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none disabled:opacity-50"
                        />

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-wide font-bold text-neutral-400 block">Classification Type</label>
                            <select
                              value={addOnType}
                              onChange={(e) => setAddOnType(e.target.value as any)}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-[11px] outline-none"
                            >
                              <option value="Organizer">🎒 Organizer (pouch, bag, rack, etc.)</option>
                              <option value="Accessory">🕶️ Accessory</option>
                              <option value="Consumable">🔋 Consumable (Battery, Card, etc)</option>
                              <option value="Attachment">⛓️ Attachment (Rig, mount, lens)</option>
                              <option value="Add On">🔌 Add On</option>
                              <option value="Software">💿 Software / License</option>
                              <option value="Mod">🔧 Custom Mod</option>
                              <option value="Other">📦 Other</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase tracking-wide font-bold text-neutral-400 block">Ancillary Notes (Optional)</label>
                            <input
                              type="text"
                              value={addOnNotes}
                              onChange={(e) => setAddOnNotes(e.target.value)}
                              placeholder="e.g. 10m cord, speed-class"
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-[11px] outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Step 2: Price Configuration (Flex Rate & Discounts)</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={!selectedAddOnItemId}
                            onClick={() => {
                              setAddOnPriceOption('default');
                              const selected = gear.find(g => g.id === selectedAddOnItemId);
                              if (selected) {
                                setAddOnCustomPrice(selected.rentalPrice || 0);
                              }
                            }}
                            className={`p-2 rounded-lg border text-left text-[11px] transition ${
                              addOnPriceOption === 'default'
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-neutral-50 text-neutral-600 border-neutral-200 disabled:opacity-30'
                            }`}
                          >
                            <span className="font-bold block">Default Value</span>
                            <span className="text-[9px] opacity-75">Use item's regular price</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAddOnPriceOption('custom')}
                            className={`p-2 rounded-lg border text-left text-[11px] transition ${
                              addOnPriceOption === 'custom'
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                            }`}
                          >
                            <span className="font-bold block">Discounted/Cheaper/Free</span>
                            <span className="text-[9px] opacity-75">Set special promotional rate</span>
                          </button>
                        </div>
                      </div>

                      {addOnPriceOption === 'custom' && (
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Special Rate if booked together</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-xs font-bold text-neutral-400">{item.currency || '$'}</span>
                            <input
                              type="number"
                              value={addOnCustomPrice}
                              onChange={(e) => setAddOnCustomPrice(parseFloat(e.target.value) || 0)}
                              className="w-2/3 bg-neutral-50 border border-neutral-200 rounded-lg pl-7 pr-4 py-1 text-xs outline-none"
                              placeholder="0 for free"
                            />
                            <span className="text-[10px] text-neutral-400 p-2 italic">{addOnCustomPrice === 0 ? '🆓 FREE Add-on!' : 'Special bundle rate'}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddOnCreator(false);
                            setSelectedAddOnItemId('');
                            setCustomAddOnName('');
                          }}
                          className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-[10px] font-black uppercase tracking-wider"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddAddOn}
                          className="px-3 py-1 bg-[#0066cc] hover:bg-[#0055b3] text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                        >
                          Add Add-on Option
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Render list of active addons */}
                  <div className="space-y-2">
                    <p className="text-[9px] text-neutral-400 italic">💡 Tap the edit icon or long-press on an item to modify details.</p>
                    {item.addOns && item.addOns.length > 0 ? (
                      <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden bg-white">
                        {item.addOns.map((add, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-2.5 text-xs hover:bg-neutral-50 transition select-none cursor-pointer"
                            {...startTouchPress(() => {
                              setAccessoryEditIdx(idx);
                              setAccessoryEditForm({
                                name: add.name,
                                type: add.type || 'Accessory',
                                price: add.price || 0,
                                notes: add.notes || ''
                              });
                            })}
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-neutral-800">{add.name}</span>
                                {add.type && (
                                  <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded-md">
                                    {add.type}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-neutral-400 italic">
                                {add.itemId ? '🏷️ Catalogued Item' : '⚙️ Custom Accessory'} | Price if bundled: <strong className="text-emerald-600">{item.currency || '$'}{add.price}</strong> {add.price === 0 && ' (Free!)'}
                              </span>
                              {add.notes && (
                                <span className="text-[9px] text-amber-600 font-medium">Notes: {add.notes}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAccessoryEditIdx(idx);
                                  setAccessoryEditForm({
                                    name: add.name,
                                    type: add.type || 'Accessory',
                                    price: add.price || 0,
                                    notes: add.notes || ''
                                  });
                                }}
                                className="p-1.5 text-neutral-400 hover:text-primary rounded-lg hover:bg-neutral-100 transition"
                                title="Edit Accessory (or Long-Press on Mobile)"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveAddOn(idx);
                                }}
                                className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-neutral-100 transition"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-3 border border-dashed border-neutral-200 rounded-xl bg-white">
                        <p className="text-[10px] text-neutral-400 italic">No add-ons associated yet. Offer discounts on key accessories!</p>
                      </div>
                    )}
                  </div>

                  {/* Accessory Edit Modal Inline */}
                  {accessoryEditForm !== null && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                      <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-neutral-200/50 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                          <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                            <Edit2 size={16} className="text-primary" />
                            <span>Edit Accessory Details</span>
                          </h4>
                          <button 
                            type="button" 
                            onClick={() => setAccessoryEditForm(null)}
                            className="text-neutral-400 hover:text-neutral-600"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="space-y-3 text-xs text-left">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-neutral-400">Name</label>
                            <input
                              type="text"
                              value={accessoryEditForm.name}
                              onChange={(e) => setAccessoryEditForm({ ...accessoryEditForm, name: e.target.value })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 outline-none font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-neutral-400">Classification Type</label>
                            <select
                              value={accessoryEditForm.type}
                              onChange={(e) => setAccessoryEditForm({ ...accessoryEditForm, type: e.target.value as any })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs outline-none"
                            >
                              <option value="Organizer">🎒 Organizer</option>
                              <option value="Accessory">🕶️ Accessory</option>
                              <option value="Consumable">🔋 Consumable</option>
                              <option value="Attachment">⛓️ Attachment</option>
                              <option value="Add On">🔌 Add On</option>
                              <option value="Software">💿 Software</option>
                              <option value="Mod">🔧 Custom Mod</option>
                              <option value="Other">📦 Other</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-neutral-400">Rate / Price ({item.currency || '$'})</label>
                            <input
                              type="number"
                              value={accessoryEditForm.price}
                              onChange={(e) => setAccessoryEditForm({ ...accessoryEditForm, price: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 outline-none font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-neutral-400">Notes (Optional)</label>
                            <input
                              type="text"
                              value={accessoryEditForm.notes}
                              onChange={(e) => setAccessoryEditForm({ ...accessoryEditForm, notes: e.target.value })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setAccessoryEditForm(null)}
                            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-neutral-600"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveAccessoryEdit}
                            className="px-4 py-2 bg-[#0066cc] hover:bg-[#0055b3] text-white rounded-xl text-[10px] font-black uppercase tracking-wider"
                          >
                            Apply Localy
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Outright sale price setup */}
            {item.isSale === true && (
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/60 grid sm:grid-cols-2 gap-4 animate-fadeIn">
                <div className="col-span-2 border-b border-neutral-100 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">Outright Buyout Purchase Option</span>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Buyout Sale Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-neutral-400">{item.currency || '$'}</span>
                    <input
                      type="number"
                      value={item.salePrice || item.price || ''}
                      onChange={(e) => setItem({ ...item, salePrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-neutral-200 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-[#0066cc]"
                      placeholder="Enter outright sales price"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1">Allows users inside or outside your organization to securely purchase this asset from your storage pool.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-neutral-400 italic text-center py-2 bg-neutral-50 rounded-2xl">
            Toggle on to activate marketplace listings and build flexible bundle/sale workflows.
          </p>
        )}
      </div>
    );
  };

  const renderAISuggestions = (item: Partial<GearItem>, setItem: (item: any) => void) => {
    if (!aiSuggestions) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-primary/5 border border-primary/10 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles size={16} />
            <span className="text-xs font-black uppercase tracking-widest">{smartPackerName} Suggestions</span>
          </div>
          <button 
            type="button"
            onClick={() => setAiSuggestions(null)}
            className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-600"
          >
            Dismiss
          </button>
        </div>

        <div className="grid gap-4">
          {aiSuggestions.name && aiSuggestions.name !== item.name && (
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-primary/10">
              <div className="space-y-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Suggested Name</p>
                <p className="text-sm font-bold">{aiSuggestions.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setItem({ ...item, name: aiSuggestions.name })}
                className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition"
              >
                Apply
              </button>
            </div>
          )}

          {aiSuggestions.category && aiSuggestions.category !== item.category && (
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-primary/10">
              <div className="space-y-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Suggested Category</p>
                <p className="text-sm font-bold">{aiSuggestions.category}</p>
              </div>
              <button
                type="button"
                onClick={() => setItem({ ...item, category: aiSuggestions.category })}
                className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition"
              >
                Apply
              </button>
            </div>
          )}

          {aiSuggestions.tags && aiSuggestions.tags.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-primary/10">
              <div className="space-y-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Suggested Tags</p>
                <div className="flex flex-wrap gap-1">
                  {aiSuggestions.tags.map((tag, idx) => (
                    <span key={`${tag}-${idx}`} className="px-2 py-0.5 bg-neutral-50 text-neutral-500 rounded-md text-[8px] font-bold uppercase">{tag}</span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newTags = [...new Set([...(item.tags || []), ...aiSuggestions.tags!])];
                  setItem({ ...item, tags: newTags });
                }}
                className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition"
              >
                Add All
              </button>
            </div>
          )}

          {aiSuggestions.organizationTip && (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <Lightbulb size={12} />
                <p className="text-[8px] font-black uppercase tracking-widest">Organization Tip</p>
              </div>
              <p className="text-xs text-neutral-600 italic leading-relaxed">{aiSuggestions.organizationTip}</p>
              <button
                type="button"
                onClick={() => setItem({ ...item, organizationTip: aiSuggestions.organizationTip })}
                className="mt-2 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
              >
                Save Tip
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const groupedGearEntries = useMemo(() => {
    if (selectedCategory !== 'All') return [];
    
    // stable list of categories, excluding 'All'
    const categoryList = categories.filter(c => c !== 'All');
    
    const entries = categoryList.map(cat => {
      const groupItems = paginatedGear.filter(item => {
        const isKit = (item.isKit || item.category === 'Kit' || item.category === 'Kits' || item.primaryCategory === 'Kit' || item.primaryCategory === 'Kits');
        if (cat === 'Kits') return isKit;
        return !isKit && getPrimaryCategory(item) === cat;
      });
      return { categoryNormalized: cat, items: groupItems };
    }).filter(entry => entry.items.length > 0);

    return entries;
  }, [paginatedGear, selectedCategory, categories]);

  const renderGridItem = (item: GearItem) => (
    <motion.div
      layout
      key={item.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={(e) => {
        if (isMultiSelectMode) {
          toggleItemSelection(item.id, e);
        } else {
          setSelectedGearItemView(item);
        }
      }}
      className={`group bg-white rounded-xl md:rounded-[2rem] border transition-all duration-500 overflow-hidden flex flex-col cursor-pointer min-w-0 w-full ${
        selectedItems.has(item.id)
          ? 'ring-2 ring-[#0066cc] border-[#0066cc] shadow-md bg-sky-50/10'
          : isAuditMode && (isMaintenanceOutdated(item) || isLowInventory(item))
            ? 'ring-2 ring-amber-500 border-amber-500 shadow-amber-200 shadow-xl'
            : 'border-neutral-100 shadow-sm hover:shadow-2xl'
      }`}
    >
      <div className="relative aspect-square sm:aspect-[16/10] overflow-hidden bg-neutral-50">
        <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10 font-bold">
          <button 
            type="button"
            onClick={(e) => toggleItemSelection(item.id, e)}
            className={`w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl border-2 flex items-center justify-center transition-all no-min-h aspect-square shrink-0 ${
              selectedItems.has(item.id) 
                ? 'bg-[#0066cc] border-[#0066cc] text-white shadow-lg scale-110' 
                : isMultiSelectMode
                  ? 'bg-white border-[#0066cc]/45 text-[#0066cc] shadow-sm'
                  : 'bg-white/80 backdrop-blur border-white/20 text-transparent hover:border-black/20 hover:text-black/10'
            }`}
          >
            <Check size={14} className={`md:w-4 md:h-4 ${selectedItems.has(item.id) || isMultiSelectMode ? 'opacity-100' : 'opacity-0'}`} strokeWidth={4} />
          </button>
        </div>

        {item.status === 'in_use' && (
          <div className="absolute inset-0 bg-neutral-900/65 backdrop-blur-[1.5px] flex flex-col items-center justify-center p-4 z-10 text-center select-none">
            <span className="px-2.5 py-1 bg-red-600 border border-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-md flex items-center gap-1">
              <X size={10} strokeWidth={3} />
              Checked Out / Unavailable
            </span>
            <span className="text-[9px] text-neutral-300 font-bold mt-1 uppercase tracking-wider">{item.currentHolder || 'In Use'}</span>
          </div>
        )}

        <LazyImage 
          src={item.photoUrls?.[0]} 
          alt={item.name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {item.condition === 'poor' && (
          <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4 px-2 py-0.5 md:px-3 md:py-1 bg-amber-500 text-white text-[8px] md:text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1 md:gap-1.5">
            <AlertCircle size={10} />
            Maintenance
          </div>
        )}
      </div>
      <div className="p-4 md:p-6 space-y-3 md:space-y-4 flex-1 flex flex-col">
        {isAuditMode && (
          <div className="space-y-1">
            {isMaintenanceOutdated(item) && (
              <div className="py-1 px-2.5 bg-rose-50 border border-rose-100 rounded-lg text-[9px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1">
                <AlertCircle size={10} className="text-rose-500" />
                <span>Maint Required</span>
              </div>
            )}
            {isLowInventory(item) && (
              <div className="py-1 px-2.5 bg-amber-50 border border-amber-100 rounded-lg text-[9px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1">
                <AlertCircle size={10} className="text-amber-500" />
                <span>Low Stock ({item.quantity !== undefined ? item.quantity : 1} owned)</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-1.5">
              {item.isKit && <Layers size={10} />}
              {item.category}
              {item.visibility && item.visibility !== 'public' && (
                <span className={`font-extrabold text-[8px] tracking-normal px-1 py-0.5 rounded text-white ${
                  item.visibility === 'private' ? 'bg-red-500' :
                  item.visibility === 'team' ? 'bg-blue-500' :
                  item.visibility === 'dept' ? 'bg-indigo-500' :
                  'bg-amber-600'
                }`}>
                  {item.visibility.toUpperCase()}
                </span>
              )}
            </p>
            <p className="text-[9px] md:text-[10px] font-mono text-neutral-300 tracking-wider">#{item.assetTag.slice(-4)}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black text-lg md:text-xl leading-tight group-hover:text-primary transition line-clamp-2 uppercase tracking-tight flex-1">{item.name}</h3>
            {item.isOfflinePending && (
              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 border border-amber-600 text-white animate-pulse flex items-center gap-1 shrink-0">
                Sync Pending
              </span>
            )}
          </div>
          {item.brand && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {(() => {
                const brandObj = dbBrands.find(b => b.name?.toLowerCase() === item.brand.toLowerCase() || b.id?.toLowerCase() === item.brand.toLowerCase());
                return brandObj?.logo ? (
                  <img
                    src={brandObj.logo}
                    alt={item.brand}
                    className="h-3 w-auto object-contain rounded opacity-75 animate-in fade-in"
                    referrerPolicy="no-referrer"
                  />
                ) : null;
              })()}
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-neutral-400">{item.brand}</p>
            </div>
          )}
        </div>

        {(item.primaryCategory === 'Lens' || item.category === 'Lens') && (item.lensType || item.lensMount || item.focalLength) && (
          <div className="flex flex-wrap gap-1 pt-1.5">
            {item.lensType && (
              <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[9px] font-bold uppercase tracking-wider font-sans border border-neutral-150">
                {item.lensType}
              </span>
            )}
            {item.lensMount && (
              <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9px] font-bold uppercase tracking-wider font-sans">
                {item.lensMount}
              </span>
            )}
            {item.focalLength && (
              <span className="px-1.5 py-0.5 bg-neutral-900 text-white rounded text-[9px] font-bold uppercase tracking-wider font-mono">
                {item.focalLength}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-neutral-400 pt-2.5 md:pt-4 border-t border-neutral-100 mt-auto">
          <div className="flex items-center gap-1">
            <Weight size={9} className="text-neutral-300 md:w-3 md:h-3 shrink-0" />
            <span className="font-bold shrink-0">{item.weight ? `${item.weight}g` : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1">
            <History size={9} className="text-neutral-300 md:w-3 md:h-3 shrink-0" />
            <span className="font-bold shrink-0">{item.usageCount || 0}</span>
          </div>
          <div className="flex-grow"></div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualCheckoutGearItem(item);
              setManualCheckoutGearType(item.isKit ? 'kit' : 'gear');
            }}
            className={`px-1.5 py-0.5 md:px-2 md:py-1 transition rounded-lg text-[8.5px] font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0 ${
              item.status === 'in_use'
                ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                : 'bg-primary/10 hover:bg-primary/20 text-primary'
            }`}
            title={item.status === 'in_use' ? "Check In Asset" : "Check Out Asset"}
          >
            <ArrowRightLeft size={9} />
            <span>{item.status === 'in_use' ? 'In' : 'Out'}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSharingGearItem(item);
              setSharingGearType(item.isKit ? 'kit' : 'gear');
            }}
            className="px-1.5 py-0.5 md:px-2 md:py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 transition rounded-lg text-[8.5px] font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0"
            title="Share with Customer"
          >
            <Share2 size={9} strokeWidth={2.5} />
            <span>Share</span>
          </button>
          <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ${
            getHealthScore(item) > 70 ? 'bg-green-500' :
            getHealthScore(item) > 40 ? 'bg-amber-500' : 'bg-red-500'
          }`} title={`Health: ${getHealthScore(item)}%`} />
        </div>
      </div>
    </motion.div>
  );

  const renderCompactItem = (item: GearItem) => (
    <motion.div
      layout
      key={item.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={(e) => {
        if (isMultiSelectMode) {
          toggleItemSelection(item.id, e);
        } else {
          setSelectedGearItemView(item);
        }
      }}
      className={`group bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col cursor-pointer ${
        selectedItems.has(item.id)
          ? 'ring-2 ring-[#0066cc] border-[#0066cc] shadow-md bg-sky-50/10'
          : isAuditMode && (isMaintenanceOutdated(item) || isLowInventory(item))
            ? 'ring-2 ring-amber-500 border-amber-500 shadow-md'
            : 'border-neutral-100 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-50">
        <div className="absolute top-2 left-2 z-10">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleItemSelection(item.id, e); }}
            className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all no-min-h aspect-square shrink-0 ${
              selectedItems.has(item.id) 
                ? 'bg-[#0066cc] border-[#0066cc] text-white shadow-lg scale-110' 
                : isMultiSelectMode
                  ? 'bg-white border-[#0066cc]/45 text-[#0066cc] shadow-sm'
                  : 'bg-white/80 backdrop-blur border-white/20 text-transparent hover:border-white'
            }`}
          >
            <Check size={10} className={selectedItems.has(item.id) || isMultiSelectMode ? 'opacity-100' : 'opacity-0'} strokeWidth={4} />
          </button>
        </div>

        {item.status === 'in_use' && (
          <div className="absolute inset-0 bg-neutral-900/65 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 z-10 text-center select-none">
            <span className="px-1.5 py-0.5 bg-red-600 border border-red-500 text-white text-[7.5px] font-black uppercase tracking-widest rounded shadow">
              OUT / IN USE
            </span>
            <span className="text-[7.5px] text-neutral-300 font-bold mt-0.5 truncate max-w-full uppercase tracking-wider">{item.currentHolder || 'Checked Out'}</span>
          </div>
        )}

        <LazyImage 
          src={item.photoUrls?.[0]} 
          alt={item.name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button"
            onClick={() => {
              setSharingGearItem(item);
              setSharingGearType(item.isKit ? 'kit' : 'gear');
            }}
            className="p-1.5 bg-white rounded-lg text-neutral-900 hover:text-primary transition"
            title="Share"
          >
            <Share2 size={14} />
          </button>
          <button 
            type="button"
            onClick={() => {
              setManualCheckoutGearItem(item);
              setManualCheckoutGearType(item.isKit ? 'kit' : 'gear');
            }}
            className="p-1.5 bg-white rounded-lg text-neutral-900 hover:text-primary transition"
            title={item.status === 'in_use' ? "Check In" : "Check Out"}
          >
            <ArrowRightLeft size={14} />
          </button>
          <button 
            type="button"
            onClick={() => setEditingItem(item)}
            className="p-1.5 bg-white rounded-lg text-neutral-900 hover:text-primary transition"
          >
            <Edit2 size={14} />
          </button>
          <button 
            type="button"
            onClick={() => handleDelete(item.id)}
            className="p-1.5 bg-white rounded-lg text-neutral-900 hover:text-accent transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-1">
        {isAuditMode && (
          <div className="flex flex-wrap gap-1 mb-1">
            {isMaintenanceOutdated(item) && (
              <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 border border-rose-100 text-rose-700">Maint Overdue</span>
            )}
            {isLowInventory(item) && (
              <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700">Low Stock</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1 min-w-0">
          {item.isOfflinePending && (
            <RefreshCw size={8} className="animate-spin text-amber-500 shrink-0" />
          )}
          <h3 className="font-bold text-xs leading-tight line-clamp-1 group-hover:text-primary transition flex-1">{item.name}</h3>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1">
            {item.isKit && <Layers size={8} />}
            {item.category}
          </p>
          <p className="text-[8px] font-bold text-neutral-400">x{item.quantity || 1}</p>
          <div className={`w-1.5 h-1.5 rounded-full ${
            getHealthScore(item) > 70 ? 'bg-green-500' :
            getHealthScore(item) > 40 ? 'bg-amber-500' : 'bg-red-500'
          }`} />
        </div>
      </div>
    </motion.div>
  );

  const renderTableRow = (item: GearItem, uniqueKey: string = item.id) => (
    <tr key={uniqueKey} className={`border-b transition ${
      isAuditMode && (isMaintenanceOutdated(item) || isLowInventory(item))
        ? 'bg-amber-50/40 border-amber-250 border-l-4 border-l-amber-500' 
        : selectedItems.has(item.id) ? 'bg-primary/5' : 'hover:bg-neutral-50 border-neutral-50'
    }`}>
      <td className="px-8 py-4">
        <button 
          type="button"
          onClick={(e) => toggleItemSelection(item.id, e)}
          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all no-min-h aspect-square shrink-0 ${
            selectedItems.has(item.id) 
              ? 'bg-primary border-primary text-white' 
              : 'bg-white border-neutral-200 hover:border-primary/50'
          }`}
        >
          {selectedItems.has(item.id) && <Check size={12} strokeWidth={4} />}
        </button>
      </td>
      <td className="px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <LazyImage src={item.photoUrls?.[0]} className="w-12 h-12 rounded-xl object-cover border border-neutral-100" />
            {item.status === 'in_use' && (
              <div className="absolute inset-0 bg-neutral-900/60 rounded-xl flex items-center justify-center">
                <span className="text-[7px] font-black text-rose-500 bg-white px-0.5 rounded leading-none">OUT</span>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold">{item.name}</p>
              {item.isOfflinePending && (
                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 border border-amber-600 text-white animate-pulse flex items-center gap-1 shrink-0">
                  <RefreshCw size={8} className="animate-spin" /> Sync Pending
                </span>
              )}
              {item.status === 'in_use' && (
                <span className="text-[8px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">Checked Out</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <p className="text-xs text-neutral-400 font-mono">{item.assetTag}</p>
              {isAuditMode && isMaintenanceOutdated(item) && (
                <span className="text-[8px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.5 rounded">Maint Overdue</span>
              )}
              {isAuditMode && isLowInventory(item) && (
                <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-100 px-1 py-0.5 rounded">Low Stock</span>
              )}
            </div>
            {(item.primaryCategory === 'Lens' || item.category === 'Lens') && (item.lensType || item.lensMount || item.focalLength || item.maxAperture) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.lensType && (
                  <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[9px] font-bold uppercase tracking-wider font-sans border border-neutral-150">
                    {item.lensType}
                  </span>
                )}
                {item.lensMount && (
                  <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9px] font-bold uppercase tracking-wider font-sans">
                    {item.lensMount}
                  </span>
                )}
                {item.focalLength && (
                  <span className="px-1.5 py-0.5 bg-neutral-900 text-white rounded text-[9px] font-bold uppercase tracking-wider font-mono">
                    {item.focalLength}
                  </span>
                )}
                {item.maxAperture && (
                  <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-100 text-amber-800 rounded text-[9px] font-bold uppercase tracking-wider font-mono">
                    {item.maxAperture}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-8 py-4">
        <span className="flex items-center gap-2 px-3 py-1 bg-neutral-100 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit">
          {item.isKit && <Layers size={10} className="text-primary" />}
          {item.category}
        </span>
      </td>
      <td className="px-8 py-4 text-center font-bold text-sm">
        {item.quantity || 1}
      </td>
      <td className="px-8 py-4 text-sm text-neutral-500">
        {item.weight ? `${item.weight}g` : '-'}
      </td>
      <td className="px-8 py-4">
        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          item.condition === 'new' ? 'bg-green-100 text-green-700' :
          item.condition === 'good' ? 'bg-blue-100 text-blue-700' :
          item.condition === 'fair' ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        }`}>
          {item.condition}
        </div>
      </td>
      <td className="px-8 py-4">
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              setManualCheckoutGearItem(item);
              setManualCheckoutGearType(item.isKit ? 'kit' : 'gear');
            }} 
            className={`p-2 transition rounded-lg ${item.status === 'in_use' ? 'text-rose-600 hover:bg-rose-50' : 'text-primary hover:bg-primary/5'}`}
            title={item.status === 'in_use' ? "Check In Asset" : "Check Out Asset"}
          >
            <ArrowRightLeft size={16} />
          </button>
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              setSharingGearItem(item);
              setSharingGearType(item.isKit ? 'kit' : 'gear');
            }} 
            className="p-2 text-neutral-400 hover:text-primary transition"
            title="Share with Customer"
          >
            <Share2 size={16} />
          </button>
          <button type="button" onClick={() => setEditingItem(item)} className="p-2 text-neutral-400 hover:text-primary transition"><Edit2 size={16} /></button>
          <button type="button" onClick={() => handleDelete(item.id)} className="p-2 text-neutral-400 hover:text-accent transition"><Trash2 size={16} /></button>
        </div>
      </td>
    </tr>
  );

  const renderMobileListItem = (item: GearItem, uniqueKey: string = item.id) => (
    <div 
      key={uniqueKey} 
      className={`p-4 rounded-2xl border flex items-center gap-4 transition-all cursor-pointer ${
        selectedItems.has(item.id)
          ? 'bg-sky-50/10 border-[#0066cc] ring-2 ring-[#0066cc]'
          : isAuditMode && (isMaintenanceOutdated(item) || isLowInventory(item))
            ? 'bg-amber-50/30 border-amber-500 ring-2 ring-amber-500'
            : 'bg-white border-neutral-100 hover:border-primary/20'
      }`}
      onClick={(e) => {
        if (isMultiSelectMode) {
          toggleItemSelection(item.id, e);
        } else {
          setSelectedGearItemView(item);
        }
      }}
    >
      <div 
        onClick={(e) => { e.stopPropagation(); toggleItemSelection(item.id, e); }}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 aspect-square no-min-h ${
          selectedItems.has(item.id) 
            ? 'bg-[#0066cc] border-[#0066cc] text-white' 
            : isMultiSelectMode
              ? 'bg-white border-[#0066cc]/45 text-[#0066cc]'
              : 'bg-neutral-50 border-neutral-200'
        }`}
      >
        <Check size={12} className={selectedItems.has(item.id) || isMultiSelectMode ? 'opacity-100' : 'opacity-0'} />
      </div>
      <div className="relative shrink-0">
        <LazyImage src={item.photoUrls?.[0]} className="w-16 h-16 rounded-xl object-cover border border-neutral-100 shrink-0" />
        {item.status === 'in_use' && (
          <div className="absolute inset-0 bg-neutral-900/60 rounded-xl flex items-center justify-center">
            <span className="text-[8px] font-black text-rose-500 bg-white px-1 py-0.5 rounded leading-none shadow">OUT</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            {item.isOfflinePending && (
              <RefreshCw size={8} className="animate-spin text-amber-500 shrink-0" />
            )}
            <h3 className="font-bold text-sm truncate">{item.name}</h3>
            {item.status === 'in_use' && (
              <span className="text-[7px] font-bold text-rose-600 bg-rose-50 px-1 rounded uppercase">Out</span>
            )}
          </div>
          <div className={`w-2 h-2 rounded-full shrink-0 ${
            getHealthScore(item) > 70 ? 'bg-green-500' :
            getHealthScore(item) > 40 ? 'bg-amber-500' : 'bg-red-500'
          }`} />
        </div>
        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-1">{item.category}</p>
        
        {isAuditMode && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {isMaintenanceOutdated(item) && (
              <span className="text-[7.5px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 px-1 rounded">Maint Overdue</span>
            )}
            {isLowInventory(item) && (
              <span className="text-[7.5px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 px-1 rounded">Low Stock</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-[10px] text-neutral-500">
          <span className="flex items-center gap-1"><Weight size={10}/> {item.weight ? `${item.weight}g` : '-'}</span>
          <span className="flex items-center gap-1"><Package size={10}/> x{item.quantity || 1}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <button 
          type="button" 
          onClick={() => {
            setSharingGearItem(item);
            setSharingGearType(item.isKit ? 'kit' : 'gear');
          }} 
          className="p-2 bg-neutral-50 rounded-lg text-neutral-400 hover:text-primary hover:bg-neutral-100 transition"
          title="Share"
        >
          <Share2 size={16} />
        </button>
        <button type="button" onClick={() => setEditingItem(item)} className="p-2 bg-neutral-50 rounded-lg text-neutral-400"><Edit2 size={16} /></button>
      </div>
    </div>
  );

  const exportOfflineBackup = () => {
    const backupData = {
      app: 'packer-tools',
      exportedAt: new Date().toISOString(),
      user: { uid: user?.uid, email: user?.email },
      gear,
      containers,
      settings
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `packer_tools_backup_${user?.uid}_${new Date().toISOString().split('T')[0]}.ptbk`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Offline backup exported successfully!");
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6 md:space-y-8 pb-20 w-full animate-pulse select-none">
        {/* Header Skeleton */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 pt-4 border-b border-neutral-100 pb-6">
          <div className="space-y-3">
            <div className="h-4 bg-neutral-200/60 rounded w-24 animate-pulse" />
            <div className="h-8 bg-neutral-200/60 rounded w-64 md:w-80 animate-pulse" />
            <div className="h-3 bg-neutral-200/60 rounded w-48 animate-pulse" />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-10 bg-neutral-200/60 rounded-xl flex-1 sm:w-32 animate-pulse" />
            <div className="h-12 bg-neutral-200/60 rounded-full w-40 animate-pulse" />
          </div>
        </header>

        {/* Toolbar Filter / Search Ribbon Skeleton */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-neutral-50 px-6 py-5 rounded-2xl md:rounded-[2.5rem] border border-neutral-100 gap-y-4">
          <div className="relative flex-1 max-w-lg h-12 bg-neutral-200/60 rounded-xl animate-pulse" />
          <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full lg:w-auto">
            <div className="h-10 bg-neutral-200/60 rounded-xl w-32 animate-pulse" />
            <div className="h-10 bg-neutral-200/60 rounded-xl w-36 animate-pulse" />
            <div className="h-10 bg-neutral-200/60 rounded-xl w-40 animate-pulse" />
          </div>
        </div>

        {/* Category Pills Ribbon Skeleton */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 bg-neutral-200/50 border border-neutral-100 rounded-full px-4 inline-flex items-center shrink-0 w-24 animate-pulse" />
          ))}
        </div>

        {/* Grid Cards List Skeleton */}
        <div className="grid grid-cols-1 min-[450px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 w-full">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl md:rounded-[2rem] border border-neutral-100 overflow-hidden flex flex-col h-[380px] w-full animate-pulse">
              <div className="aspect-[16/10] bg-neutral-200/60 w-full animate-pulse" />
              <div className="p-4 md:p-6 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="h-3 bg-neutral-200/60 rounded w-1/4 animate-pulse" />
                  <div className="h-6 bg-neutral-200/60 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-neutral-200/60 rounded w-1/2 animate-pulse" />
                </div>
                <div className="flex justify-between pt-4 border-t border-neutral-50 items-center">
                  <div className="h-3 bg-neutral-200/60 rounded w-1/4 animate-pulse" />
                  <div className="h-3 bg-neutral-200/60 rounded w-1/3 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="max-w-7xl mx-auto px-4 md:px-6 space-y-6 md:space-y-8 pb-20 overflow-x-hidden w-full relative"
    >
      {/* Mobile Pull-to-Refresh Visual Indicator */}
      <div 
        style={{ height: isRefreshing ? '50px' : `${pullProgress * 0.4}px`, opacity: isRefreshing || pullProgress > 10 ? 1 : 0 }}
        className="w-full flex items-center justify-center overflow-hidden transition-all duration-155 bg-white/40 rounded-2xl border border-neutral-200/50 text-neutral-600 gap-2 text-xs font-mono font-black uppercase tracking-wider select-none mb-4"
      >
        <RefreshCw size={14} className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: isRefreshing ? 'none' : `rotate(${pullProgress * 3.6}deg)` }} />
        <span>{isRefreshing ? 'Synchronizing...' : pullProgress >= 85 ? 'Release to Sync' : 'Pull to Refresh'}</span>
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3 md:gap-4 flex-wrap">
            <h1 className="text-2xl md:text-5xl font-black tracking-tighter flex items-center gap-2 md:gap-3 uppercase italic truncate">
              Gear Library
            </h1>
            <button 
              onClick={() => setShowOfflineDashboard(!showOfflineDashboard)}
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border transition shrink-0 ${
                isOffline 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse cursor-pointer' 
                  : 'bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 cursor-pointer'
              }`}
              title="Click to manage local cached status"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-amber-500' : 'bg-green-500'}`} />
              <span>{isOffline ? 'Offline Active' : 'Online / Cached'}</span>
            </button>
            <button 
              onClick={() => setIsDashboardVisible(!isDashboardVisible)}
              className="p-1.5 md:p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors flex items-center gap-2 shrink-0"
              title="Toggle Dashboard Stats"
            >
              {isDashboardVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest pr-1 md:pr-2">{isDashboardVisible ? 'Close' : 'Stats'}</span>
            </button>
          </div>
          <p className="text-neutral-500 text-[9px] md:text-sm font-bold uppercase tracking-widest opacity-70">Inventory Management System</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full sm:w-auto">
          <div className="bg-neutral-50 p-1 rounded-2xl border border-neutral-100 flex w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide flex-nowrap shrink-0 max-w-full">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex-1 shrink-0 px-3 sm:px-4 p-2 rounded-xl text-[9.5px] md:text-[10px] font-black uppercase tracking-widest text-[#0066cc] hover:bg-[#e6f0ff] transition flex items-center justify-center gap-1.5"
            >
              <Upload size={14} className="shrink-0" />
              <span>Import</span>
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`flex-1 shrink-0 px-3 sm:px-4 p-2 rounded-xl text-[9.5px] md:text-[10px] font-black uppercase tracking-widest transition ${viewMode === 'grid' ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-neutral-900'}`}
            >
              Grid
            </button>
            <button 
              onClick={() => setViewMode('compact')}
              className={`flex-1 shrink-0 px-3 sm:px-4 p-2 rounded-xl text-[9.5px] md:text-[10px] font-black uppercase tracking-widest transition ${viewMode === 'compact' ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-neutral-900'}`}
            >
              Tiny
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 shrink-0 px-3 sm:px-4 p-2 rounded-xl text-[9.5px] md:text-[10px] font-black uppercase tracking-widest transition ${viewMode === 'list' && !isMultiSelectMode ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-neutral-900'}`}
            >
              List
            </button>
            <button 
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                if (isMultiSelectMode) {
                  setSelectedItems(new Set());
                }
              }}
              className={`flex-1 shrink-0 px-3 sm:px-4 p-2 rounded-xl text-[9.5px] md:text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 ${isMultiSelectMode ? 'bg-black text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-900'}`}
              title="Toggle checklist selection mode"
              id="multi-select-toggle-button"
            >
              <CheckSquare size={13} className="shrink-0" />
              <span>Select Mode</span>
            </button>
          </div>
          <button 
            onClick={() => {
              triggerHaptic();
              setSearchParams({ addGear: 'true' });
            }}
            className="bg-black text-white px-5 py-2.5 md:px-8 md:py-4 rounded-full font-black uppercase text-[10px] md:text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all active:scale-95 duration-75 shadow-xl sm:flex-none flex-1 w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Item</span>
          </button>
        </div>
      </header>

      {/* Offline Management Panel / Notification Callout */}
      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-amber-500/10 border border-amber-500/20 text-amber-700 px-6 py-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold shadow-inner"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <div>
                <p className="font-black uppercase tracking-wider text-[11px]">Packer Tools Offline Sandbox Active</p>
                <p className="text-amber-600 font-bold mt-0.5">Running securely from encrypted local cache. All revisions will sync back automatically when cellular or internet connection is restored.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowOfflineDashboard(!showOfflineDashboard)} 
              className="px-4 py-2 bg-amber-500 text-white rounded-xl uppercase tracking-wider text-[10px] font-black hover:bg-amber-600 transition self-start md:self-auto cursor-pointer"
            >
              Manage Sandbox Cache ({gear.length} items)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Mode Toggle Dashboard Shelf */}
      <AnimatePresence>
        {showOfflineDashboard && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#0F1012] border border-neutral-800/80 rounded-[2rem] text-[#E4E4E7]"
          >
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-800/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${isOffline ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-green-500/10 border-green-500/40 text-green-500'}`}>
                    <RefreshCw size={20} className={isOffline ? "" : "animate-spin"} style={{ animationDuration: '6s' }} />
                  </div>
                  <div>
                    <h2 className="text-md font-black uppercase tracking-tight text-white leading-none">Packer Edge Sync Engine</h2>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Hybrid Local Database & Media Cache</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowOfflineDashboard(false)}
                  className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#050607] p-5 rounded-2xl border border-neutral-800/40 space-y-2">
                  <span className="text-[9px] text-[#FF5500] font-black uppercase tracking-wider">Sync Status</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-sans tracking-tight">
                      {isOffline ? 'OFFLINE' : 'ONLINE'}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                  </div>
                  <p className="text-[10px] text-neutral-500 font-bold leading-normal">
                    {isOffline 
                      ? "Disconnected from server. Using local multi-tab cache store." 
                      : "Direct connection with Cloud Run network pool active."}
                  </p>
                </div>

                <div className="bg-[#050607] p-5 rounded-2xl border border-neutral-800/40 space-y-2">
                  <span className="text-[9px] text-neutral-400 font-black uppercase tracking-wider">Stashed Resources</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-sans tracking-tight">{gear.length} Items</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 font-bold leading-normal">
                    {containers.length} containers & transit cases cached offline successfully.
                  </p>
                </div>

                <div className="bg-[#050607] p-5 rounded-2xl border border-neutral-800/40 space-y-2">
                  <span className="text-[9px] text-neutral-400 font-black uppercase tracking-wider">Last Server Synchronization</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-sans tracking-tight truncate max-w-full">
                      {lastSyncTime ? format(new Date(lastSyncTime), 'HH:mm:ss') : 'Never'}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 font-bold leading-normal">
                    Recorded {lastSyncTime ? format(new Date(lastSyncTime), 'PP') : 'no local sync timestamp recorded'}
                  </p>
                </div>
              </div>

              <div className="bg-[#18191B] border border-neutral-800/60 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-semibold text-neutral-300">
                <div className="space-y-1">
                  <p className="font-extrabold text-white text-[11px] uppercase tracking-wider">Export Sandbox Snapshot Backup (.PTBK)</p>
                  <p className="text-neutral-500 text-[10px]">Download standard serial JSON container payload of your offline inventory as safety insurance.</p>
                </div>
                <button
                  type="button"
                  onClick={exportOfflineBackup}
                  className="px-5 py-3 bg-neutral-800 border border-neutral-700 text-white rounded-xl hover:bg-neutral-700 transition flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] font-black shrink-0 cursor-pointer"
                >
                  <FileSpreadsheet size={15} />
                  <span>Export Backup</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overview Dropdown Shelf */}
      <AnimatePresence>
        {isDashboardVisible && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-neutral-950 rounded-[2rem] text-white"
          >
            <div className="p-4 md:p-8 space-y-6 md:space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                {[
                  { label: 'Total Items', value: gear.length, icon: <Package size={18} />, color: 'text-blue-400' },
                  { label: 'Total Weight', value: `${(totalWeight / 1000).toFixed(2)} kg`, icon: <Weight size={18} />, color: 'text-purple-400' },
                  { label: 'Total Value', value: `$${totalValue.toLocaleString()}`, icon: <DollarSign size={18} />, color: 'text-green-400' },
                  { label: 'Maintenance', value: gear.filter(i => i.condition === 'poor' || getHealthScore(i) < 30).length, icon: <Wrench size={18} />, color: 'text-amber-400' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white/5 p-4 md:p-6 rounded-xl md:rounded-2xl border border-white/5 space-y-2 md:space-y-4">
                    <div className={`w-8 h-8 md:w-10 md:h-10 bg-white/10 ${stat.color} rounded-lg md:rounded-xl flex items-center justify-center`}>
                      {stat.icon}
                    </div>
                    <div className="space-y-0.5 md:space-y-1">
                      <p className="text-[8px] md:text-[10px] font-black text-neutral-500 uppercase tracking-widest">{stat.label}</p>
                      <h3 className="text-sm md:text-2xl font-black">{stat.value}</h3>
                    </div>
                  </div>
                ))}
              </div>

              {/* Insights inside shelf */}
              <div className="grid lg:grid-cols-2 gap-4 md:gap-6 pt-6 md:pt-8 border-t border-white/10">
                {getInsights().map((insight, idx) => (
                  <div key={idx} className="flex gap-4 md:gap-6 items-start p-4 md:p-6 bg-white/5 rounded-2xl md:rounded-3xl border border-white/5">
                    <div className="p-3 md:p-4 bg-white/10 rounded-xl md:rounded-2xl shrink-0">
                      {insight.icon}
                    </div>
                    <div>
                      <h4 className="font-black uppercase tracking-tighter text-sm md:text-lg">{insight.title}</h4>
                      <p className="text-neutral-400 text-[10px] md:text-sm leading-relaxed mt-1">{insight.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Six-Month Performance, Rental ROI & Utilization Trends */}
              <div className="pt-6 md:pt-8 border-t border-white/10 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-black uppercase tracking-tighter text-sm md:text-xl flex items-center gap-2">
                      <TrendingUp className="text-indigo-400" />
                      <span>ROI & UTILIZATION REPORTS</span>
                    </h4>
                    <p className="text-neutral-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider">Metrics and financial performance over the last 6 months</p>
                  </div>
                  
                  {/* View Toggle */}
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 self-start md:self-auto">
                    {[
                      { id: 'combined', label: 'Overview' },
                      { id: 'roi', label: 'Rental ROI %' },
                      { id: 'utilization', label: 'Utilization Trend' }
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setAnalyticsView(btn.id as any)}
                        className={`px-3 md:px-4 py-1.5 rounded-xl text-[9.5px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                          analyticsView === btn.id 
                            ? 'bg-white text-black font-black shadow-sm' 
                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Dynamic Visual Chart (Recharts) */}
                  <div className="lg:col-span-2 bg-white/5 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-white/5 space-y-4">
                    <div className="h-64 md:h-72 w-full font-mono text-[10px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {analyticsView === 'roi' ? (
                          <AreaChart data={get6MonthAnalyticsData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRoi" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" stroke="#737373" tickLine={false} />
                            <YAxis stroke="#737373" tickLine={false} unit="%" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px', color: '#fff' }}
                              labelFormatter={(lbl) => `Month: ${lbl}`}
                              formatter={(value) => [`${value}%`, 'Accumulated ROI']}
                            />
                            <Area type="monotone" dataKey="roi" stroke="#818cf8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRoi)" />
                          </AreaChart>
                        ) : analyticsView === 'utilization' ? (
                          <BarChart data={get6MonthAnalyticsData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" stroke="#737373" tickLine={false} />
                            <YAxis stroke="#737373" tickLine={false} unit="%" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px', color: '#fff' }}
                              labelFormatter={(lbl) => `Month: ${lbl}`}
                              formatter={(value) => [`${value}%`, 'Equipment Utilization']}
                            />
                            <Bar dataKey="utilization" fill="#34d399" radius={[8, 8, 0, 0]}>
                              {get6MonthAnalyticsData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 5 ? '#34d399' : '#10b981'} fillOpacity={0.8} />
                              ))}
                            </Bar>
                          </BarChart>
                        ) : (
                          <LineChart data={get6MonthAnalyticsData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" stroke="#737373" tickLine={false} />
                            <YAxis yAxisId="left" stroke="#818cf8" tickLine={false} unit="%" />
                            <YAxis yAxisId="right" orientation="right" stroke="#34d399" tickLine={false} unit="%" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px', color: '#fff' }}
                            />
                            <Legend wrapperStyle={{ color: '#fff', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                            <Line yAxisId="left" type="monotone" dataKey="roi" name="Rental ROI %" stroke="#818cf8" strokeWidth={3} activeDot={{ r: 6 }} />
                            <Line yAxisId="right" type="monotone" dataKey="utilization" name="Utilization %" stroke="#34d399" strokeWidth={3} />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Summary card showcasing dynamic ROI performance intelligence */}
                  <div className="bg-white/5 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-white/5 flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-yellow-400" />
                        <h5 className="font-mono text-[9px] font-black uppercase tracking-widest text-neutral-400">Library Insights</h5>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-[10px] text-neutral-400 font-medium">Avg Utilization</span>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {Math.round(get6MonthAnalyticsData().reduce((acc, d) => acc + d.utilization, 0) / 6)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-[10px] text-neutral-400 font-medium">Estimated ROI</span>
                          <span className="text-xs font-mono font-bold text-indigo-400">
                            {get6MonthAnalyticsData()[5].roi}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-[10px] text-neutral-400 font-medium">Accumulated Revenue</span>
                          <span className="text-xs font-mono font-bold text-white">
                            ${get6MonthAnalyticsData()[5].accumulatedRevenue.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-[10px] text-neutral-400 font-medium">Active Book Value</span>
                          <span className="text-xs font-mono font-bold text-neutral-300">
                            ${(totalValue || 12500).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl space-y-1">
                      <p className="text-[9px] text-[#0066cc] uppercase tracking-widest font-black">Strategic Tip</p>
                      <p className="text-[10px] text-neutral-400 leading-relaxed font-semibold">
                        Your rental portfolio value of <span className="text-white">${(totalValue || 12500).toLocaleString()}</span> has yielded a continuous net positive return. Optimize camera rig availability to maximize next-quarter yields.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard Toggle Label */}
      {!isDashboardVisible && gear.length > 0 && (
        <div className="">
           <button 
            onClick={() => setIsDashboardVisible(true)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 hover:text-primary transition"
          >
            <TrendingUp size={14} />
            <span>Show Insights & Inventory Stats</span>
          </button>
        </div>
      )}

      {/* Item View Popover */}
      <AnimatePresence>
        {selectedGearItemView && (
          <div 
            className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4 overflow-y-auto"
            onClick={() => setSelectedGearItemView(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-neutral-100 flex items-start justify-between bg-neutral-50/50">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-wider">
                      {selectedGearItemView.aiLabel || selectedGearItemView.primaryCategory || selectedGearItemView.category || 'Gear Details'}
                    </span>
                    {selectedGearItemView.assetTag && (
                      <span className="px-2.5 py-1 bg-neutral-100 text-neutral-500 rounded-xl text-[10px] font-mono font-bold">
                        {selectedGearItemView.assetTag}
                      </span>
                    )}
                    {selectedGearItemView.isKit && (
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-xl text-[10px] font-black uppercase tracking-wider">
                        Kit Setup
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-neutral-900 tracking-tight leading-snug">
                    {selectedGearItemView.name}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedGearItemView(null)} 
                  className="p-2 hover:bg-neutral-150 rounded-xl transition text-neutral-400 hover:text-neutral-950 shrink-0 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {/* Swipeable Photo Gallery */}
                {selectedGearItemView.photoUrls && selectedGearItemView.photoUrls.length > 0 && (
                  <SwipeableImageGallery
                    photoUrls={selectedGearItemView.photoUrls}
                    itemName={selectedGearItemView.name}
                  />
                )}

                {/* Bento Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Hardware Profile Card */}
                  <div className="p-5 bg-neutral-50 border border-neutral-100 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Hardware Profile</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Brand</span>
                        <span className="text-neutral-800 font-bold">{selectedGearItemView.brand || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Model</span>
                        <span className="text-neutral-800 font-bold">{selectedGearItemView.model || '—'}</span>
                      </div>
                      {selectedGearItemView.modelNumber && (
                        <div className="flex justify-between py-1 border-b border-neutral-100">
                          <span className="text-neutral-400 font-medium">Model #</span>
                          <span className="text-neutral-800 font-mono font-bold">{selectedGearItemView.modelNumber}</span>
                        </div>
                      )}
                      {selectedGearItemView.serialNumber && (
                        <div className="flex justify-between py-1 border-b border-neutral-100">
                          <span className="text-neutral-400 font-medium">Serial #</span>
                          <span className="text-neutral-800 font-mono font-bold">{selectedGearItemView.serialNumber}</span>
                        </div>
                      )}
                      {selectedGearItemView.releaseYear && (
                        <div className="flex justify-between py-1 border-b border-neutral-100">
                          <span className="text-neutral-400 font-medium">Release Year</span>
                          <span className="text-neutral-800 font-bold">{selectedGearItemView.releaseYear}</span>
                        </div>
                      )}
                      {selectedGearItemView.rfidTag && (
                        <div className="flex justify-between py-1 border-b border-neutral-100">
                          <span className="text-neutral-400 font-medium">RFID Tag</span>
                          <span className="text-indigo-600 font-mono font-bold">{selectedGearItemView.rfidTag}</span>
                        </div>
                      )}
                      {selectedGearItemView.nfcTag && (
                        <div className="flex justify-between py-1">
                          <span className="text-neutral-400 font-medium">NFC Tag</span>
                          <span className="text-amber-600 font-mono font-bold">{selectedGearItemView.nfcTag}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Maintenance & Lifecycle */}
                  <div className="p-5 bg-neutral-50 border border-neutral-100 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Status & Lifecycle</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Condition</span>
                        <span className={`capitalize font-black px-2 py-0.5 rounded-md text-[10px] ${
                          selectedGearItemView.condition === 'new' ? 'bg-green-100 text-green-700' :
                          selectedGearItemView.condition === 'good' ? 'bg-blue-100 text-blue-700' :
                          selectedGearItemView.condition === 'fair' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {selectedGearItemView.condition || 'good'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Device Status</span>
                        <span className={`capitalize font-black px-2 py-0.5 rounded-md text-[10px] ${
                          selectedGearItemView.status === 'available' ? 'bg-green-100 text-green-700' :
                          selectedGearItemView.status === 'in_use' ? 'bg-blue-100 text-blue-700' :
                          selectedGearItemView.status === 'maintenance' ? 'bg-orange-100 text-orange-700' :
                          'bg-neutral-100 text-neutral-700'
                        }`}>
                          {selectedGearItemView.status || 'available'}
                        </span>
                      </div>
                      {selectedGearItemView.status === 'in_use' && (
                        <div className="flex justify-between py-1 border-b border-neutral-100">
                          <span className="text-neutral-400 font-medium">Current Holder</span>
                          <span className="text-blue-600 font-bold">{selectedGearItemView.currentHolder || 'Checked Out'}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Last Maintained</span>
                        <span className="text-neutral-800 font-bold">{selectedGearItemView.lastMaintenanceDate || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-400 font-medium">Next Maintenance</span>
                        <span className={`font-bold ${isMaintenanceOutdated(selectedGearItemView) ? 'text-red-600 flex items-center gap-1' : 'text-neutral-800'}`}>
                          {isMaintenanceOutdated(selectedGearItemView) && <AlertTriangle size={12} className="text-red-500 animate-bounce" />}
                          {(() => {
                            const item = selectedGearItemView;
                            if (!item.lastMaintenanceDate || !item.maintenanceIntervalDays) return 'As Needed';
                            try {
                              const last = new Date(item.lastMaintenanceDate);
                              const nextDue = new Date(last.getTime() + (item.maintenanceIntervalDays * 24 * 60 * 60 * 1000));
                              return format(nextDue, 'yyyy-MM-dd');
                            } catch {
                              return 'Error';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Logistics Metrics */}
                  <div className="p-5 bg-neutral-50 border border-neutral-100 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Logistics Metrics</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Total Weight</span>
                        <span className="text-neutral-800 font-bold">
                          {selectedGearItemView.weight ? `${selectedGearItemView.weight} ${selectedGearItemView.weightUnit || 'g'}` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Master Price</span>
                        <span className="text-neutral-800 font-mono font-bold">
                          {formatCurrency(selectedGearItemView.price || 0, selectedGearItemView.currency || 'USD')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Quantity</span>
                        <span className="text-neutral-800 font-bold">{selectedGearItemView.quantity || 1}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-400 font-medium">Assigned Location</span>
                        <span className="text-neutral-800 font-bold truncate max-w-[150px]">
                          {selectedGearItemView.rackId ? (racks.find(r => r.id === selectedGearItemView.rackId)?.name || 'Rack Storage') : 'General Storage'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Operations Telemetry */}
                  <div className="p-5 bg-neutral-50 border border-neutral-100 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Field Telemetry</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Log field usage count</span>
                        <span className="text-neutral-800 font-bold">{selectedGearItemView.usageCount || 0} runs</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-400 font-medium">Tracking Mode</span>
                        <span className="capitalize text-neutral-800 font-bold">Individual</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-400 font-medium">Telemetry Pulse</span>
                        <span className="text-green-600 font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-ping inline-block" /> Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secondary Categories if present */}
                {selectedGearItemView.secondaryCategories && selectedGearItemView.secondaryCategories.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Secondary Categories</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedGearItemView.secondaryCategories.map((c, idx) => (
                        <span key={`${c}-${idx}`} className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-[9px] font-bold uppercase tracking-wider transition border border-neutral-200/40">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Marketplace Listing Details (if rental or sale enabled) */}
                {(selectedGearItemView.isAvailableForRent || selectedGearItemView.isAvailableForSale) && (
                  <div className="p-5 bg-amber-50/30 border border-amber-100 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600">Marketplace & Commercial Listing</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {selectedGearItemView.isAvailableForRent && (
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase">Rental Rate</span>
                          <span className="text-neutral-800 font-bold">
                            {formatCurrency(selectedGearItemView.rentalPrice || 0, selectedGearItemView.currency || 'USD')} / {selectedGearItemView.rentalPeriod || 'day'}
                          </span>
                        </div>
                      )}
                      {selectedGearItemView.isAvailableForSale && (
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase">Sale Value</span>
                          <span className="text-neutral-800 font-bold">
                            {formatCurrency(selectedGearItemView.salePrice || 0, selectedGearItemView.currency || 'USD')}
                          </span>
                        </div>
                      )}
                      {selectedGearItemView.rentalDeposit !== undefined && (
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase">Secured Deposit</span>
                          <span className="text-neutral-800 font-bold">
                            {formatCurrency(selectedGearItemView.rentalDeposit, selectedGearItemView.currency || 'USD')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Operations Control Panel */}
                <div className="p-5 border border-indigo-100 bg-indigo-50/10 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Operations Console</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <button 
                      onClick={() => { handleIncrementUsage(selectedGearItemView); setSelectedGearItemView({...selectedGearItemView, usageCount: (selectedGearItemView.usageCount || 0) + 1}) }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      Log Field Usage (+1)
                    </button>

                    <button 
                      onClick={() => { 
                        setSharingGearItem(selectedGearItemView); 
                        setSharingGearType(selectedGearItemView.isKit ? 'kit' : 'gear');
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-neutral-800 transition shadow-sm cursor-pointer"
                    >
                      <Share2 size={14} />
                      Share & Book Item
                    </button>

                    <button 
                      onClick={() => { setSelectedGearItemView(null); navigate(`/gear/${selectedGearItemView.id}`); }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition shadow-sm cursor-pointer"
                    >
                      <QrCode size={14} />
                      View QR Passport
                    </button>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => fetchHistory(selectedGearItemView.id)}
                        className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition cursor-pointer"
                      >
                        <History size={12} />
                        History
                      </button>
                      <button 
                        onClick={() => fetchIncidents(selectedGearItemView.id)}
                        className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition cursor-pointer"
                      >
                        <AlertCircle size={12} />
                        Log Issue
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes & Bio */}
                {(selectedGearItemView.description || selectedGearItemView.organizationTip) && (
                  <div className="space-y-4">
                    {selectedGearItemView.organizationTip && (
                      <div className="p-5 border border-amber-100 bg-amber-50/20 rounded-2xl space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600">Organization Tip</h4>
                        <p className="text-xs text-neutral-700 leading-relaxed font-medium italic">"{selectedGearItemView.organizationTip}"</p>
                      </div>
                    )}

                    {selectedGearItemView.description && (
                      <div className="p-5 border border-neutral-100 bg-neutral-50/30 rounded-2xl space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Item Biography & Specs</h4>
                        <p className="text-xs text-neutral-600 leading-relaxed font-medium whitespace-pre-line">{selectedGearItemView.description}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Optics & Lens Specs (if present) */}
                {(selectedGearItemView.lensType || selectedGearItemView.lensMount || selectedGearItemView.focalLength || selectedGearItemView.maxAperture) && (
                  <div className="p-5 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-600">Optics & Lens Taxonomy</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase">Lens Type</span>
                        <span className="text-purple-950 font-bold">{selectedGearItemView.lensType || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase">Lens Mount</span>
                        <span className="text-purple-950 font-bold">{selectedGearItemView.lensMount || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase">Focal Length</span>
                        <span className="text-purple-950 font-mono font-bold">{selectedGearItemView.focalLength || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase">Max Aperture</span>
                        <span className="text-purple-950 font-mono font-bold">{selectedGearItemView.maxAperture || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add-Ons & Accessories if present */}
                {selectedGearItemView.addOns && selectedGearItemView.addOns.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Standard In-The-Box Inclusions & Accessories</span>
                    <div className="border border-neutral-100 rounded-2xl overflow-hidden bg-neutral-50/50">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-neutral-100 text-neutral-500 font-bold border-b border-neutral-200">
                            <th className="p-3 text-left">Accessory Name</th>
                            <th className="p-3 text-left">Type</th>
                            <th className="p-3 text-right">Costing</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {selectedGearItemView.addOns.map((add, addIdx) => (
                            <tr key={addIdx} className="hover:bg-neutral-50 transition-colors">
                              <td className="p-3 font-bold text-neutral-800">{add.name}</td>
                              <td className="p-3 text-neutral-500">{add.type || 'Accessory'}</td>
                              <td className="p-3 text-right font-mono font-bold text-neutral-900">
                                {add.price === 0 ? 'FREE' : `$${add.price}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
                <button
                  onClick={() => { handleDelete(selectedGearItemView.id); setSelectedGearItemView(null); }}
                  className="px-5 py-3.5 bg-red-50 text-red-600 hover:bg-red-100 transition rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Retire</span>
                </button>
                <button
                  onClick={() => setSelectedGearItemView(null)}
                  className="flex-1 py-3.5 bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition rounded-2xl font-bold uppercase tracking-wider text-xs shadow-sm cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => { setEditingItem(selectedGearItemView); setSelectedGearItemView(null); }}
                  className="flex-1 py-3.5 bg-black text-white hover:bg-neutral-800 transition rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Edit2 size={14} />
                  <span>Edit Item</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filters & Search */}
      <div className="space-y-4 w-full">
        {/* Desktop Filters & Search Block */}
        <div className="hidden lg:flex flex-col lg:flex-row gap-3 md:gap-4">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input
              type="text"
              placeholder="Search library..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-xl md:rounded-2xl pl-10 md:pl-12 pr-12 py-3 md:py-4 outline-none focus:ring-2 focus:ring-primary transition shadow-sm text-sm font-semibold"
            />
            <button
              type="button"
              onClick={() => {
                setNfcScanMode('search');
                setNfcTargetItem(undefined);
                setIsNfcModalOpen(true);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-neutral-100 rounded-xl transition text-neutral-500 hover:text-primary"
              title="Scan NFC Tag"
            >
              <Cpu size={16} className="text-[#F27D26]" />
            </button>
          </div>
          
          <div className="flex flex-wrap sm:flex-nowrap gap-2 md:gap-3 w-full lg:w-auto">
            <button
              type="button"
              id="audit-mode-toggle"
              onClick={() => {
                triggerHaptic();
                setIsAuditMode(prev => !prev);
              }}
              className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer select-none active:scale-95 duration-75 ${
                isAuditMode 
                  ? "bg-amber-500 text-white border-amber-500 shadow-md animate-pulse"
                  : "bg-white text-neutral-500 border-neutral-200 hover:text-black hover:border-black"
              }`}
            >
              <Sliders size={12} className={isAuditMode ? "text-white" : "text-neutral-400"} />
              <span>Audit Mode {isAuditMode ? "ON" : "OFF"}</span>
            </button>

            <div className="flex-1 sm:flex-none sm:w-48 flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-2 md:py-2.5 shadow-sm min-w-0">
              <Filter size={14} className="text-neutral-400 shrink-0" />
              <select 
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="bg-transparent text-[9px] md:text-sm font-bold outline-none cursor-pointer uppercase tracking-widest w-full truncate"
              >
                <option value="all">Condition</option>
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>

            <div className="flex-1 lg:w-48 lg:flex-none flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-2 md:py-2.5 shadow-sm min-w-0">
              <TrendingUp size={14} className="text-neutral-400 shrink-0" />
              <select 
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="bg-transparent text-[9px] md:text-sm font-bold outline-none cursor-pointer uppercase tracking-widest w-full truncate"
              >
                <option value="createdAt">Date</option>
                <option value="name">Name</option>
                <option value="weight">Weight</option>
                <option value="price">Value</option>
                <option value="usageCount">Usage</option>
                <option value="health">Health</option>
              </select>
              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-1 hover:bg-neutral-100 rounded-lg transition shrink-0"
              >
                {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Filters & Search Block */}
        <div className="flex lg:hidden flex-col gap-2 w-full">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                type="text"
                placeholder="Search library..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-12 py-3 outline-none focus:ring-1 focus:ring-primary transition shadow-sm text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => {
                  setNfcScanMode('search');
                  setNfcTargetItem(undefined);
                  setIsNfcModalOpen(true);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-neutral-100 rounded-xl transition text-neutral-500 hover:text-primary"
                title="Scan NFC Tag"
              >
                <Cpu size={14} className="text-[#F27D26]" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowMobileControls(prev => !prev)}
              className={`px-3 flex items-center justify-center border rounded-xl gap-1 bg-white hover:bg-neutral-50 border-neutral-200 text-xs font-black uppercase text-neutral-700 h-11 transition-all select-none ${
                showMobileControls ? 'bg-neutral-900 border-neutral-900 text-white' : ''
              }`}
            >
              <Sliders size={14} className={showMobileControls ? "text-[#f59e0b]" : "text-neutral-500"} />
              <span>{showMobileControls ? "Hide Filters" : "Filters"}</span>
            </button>
          </div>

          {showMobileControls && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-200/50 mt-1"
            >
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  id="audit-mode-toggle-mobile"
                  onClick={() => {
                    triggerHaptic();
                    setIsAuditMode(prev => !prev);
                    setShowMobileControls(false);
                  }}
                  className={`w-full py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer select-none active:scale-95 duration-75 ${
                    isAuditMode 
                      ? "bg-amber-500 text-white border-amber-500 shadow-md animate-pulse"
                      : "bg-white text-neutral-500 border-neutral-200 hover:text-black hover:border-black"
                  }`}
                >
                  <Sliders size={12} className={isAuditMode ? "text-white animate-bounce" : "text-amber-500"} />
                  <span>Audit Mode {isAuditMode ? "ON" : "OFF"}</span>
                </button>

                <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-1 h-11 min-w-0">
                  <Filter size={14} className="text-neutral-400 shrink-0" />
                  <select 
                    value={selectedCondition}
                    onChange={(e) => {
                      setSelectedCondition(e.target.value);
                      setShowMobileControls(false);
                    }}
                    className="bg-transparent text-[10px] font-bold outline-none cursor-pointer uppercase tracking-widest w-full truncate h-full"
                  >
                    <option value="all">Every Condition</option>
                    <option value="new">New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-1 h-11 min-w-0">
                  <TrendingUp size={14} className="text-neutral-400 shrink-0" />
                  <select 
                    value={sortField}
                    onChange={(e) => {
                      setSortField(e.target.value as any);
                      setShowMobileControls(false);
                    }}
                    className="bg-transparent text-[10px] font-bold outline-none cursor-pointer uppercase tracking-widest w-full truncate h-full"
                  >
                    <option value="createdAt">Sort: Date</option>
                    <option value="name">Sort: Name</option>
                    <option value="weight">Sort: Weight</option>
                    <option value="price">Sort: Value</option>
                    <option value="usageCount">Sort: Usage</option>
                    <option value="health">Sort: Health</option>
                  </select>
                  <button 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-1.5 hover:bg-neutral-100 rounded-lg transition shrink-0 ml-auto border border-neutral-150"
                  >
                    {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {isAuditMode && (
          <div id="audit-mode-feedback" className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Sliders className="text-amber-500 shrink-0" size={16} />
              <div>
                <span className="font-extrabold uppercase tracking-wide text-amber-800">Audit Mode Active</span>
                <p className="text-[11px] text-amber-700 font-medium leading-tight mt-0.5">Highlighting assets with outdated maintenance schedules or low inventory counts.</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none text-amber-800 bg-white border border-amber-200 px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-wider font-extrabold hover:bg-amber-50 transition">
              <input 
                type="checkbox" 
                checked={showOnlyAttentionNeeded}
                onChange={(e) => setShowOnlyAttentionNeeded(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-neutral-350 cursor-pointer"
              />
              <span>Only show attention items</span>
            </label>
          </div>
        )}

        {/* Category Filter Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs mb-3 border-b border-light pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">View Scheme:</span>
            <div className="flex bg-neutral-100 p-0.5 rounded-xl border border-neutral-200 flex-wrap gap-0.5 sm:gap-0">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilterMode('primary');
                  setSelectedCategory('All');
                }}
                className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${categoryFilterMode === 'primary' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                Primary Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilterMode('all');
                  setSelectedCategory('All');
                }}
                className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${categoryFilterMode === 'all' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                Include Secondary
              </button>
            </div>
          </div>
          <span className="text-[9px] font-mono text-neutral-400 font-bold uppercase">
            {categoryFilterMode === 'primary' ? 'No duplication by default' : 'Shared secondary categories active'}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] whitespace-nowrap transition border uppercase tracking-widest ${
                selectedCategory === cat 
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-md' 
                  : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dynamic Privacy View Layers Switcher */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl md:rounded-[2rem] p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers size={16} />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-800">Privacy View Layers</h4>
              <p className="text-[10px] text-neutral-450 mt-0.5 uppercase tracking-wider">Display inventory assets by their access boundaries</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 w-full lg:w-auto">
            {[
              { id: 'all', label: 'All Access Layers', icon: Layers },
              { id: 'private', label: 'User Layer (Private)', icon: ShieldCheck },
              { id: 'team', label: 'Team Layer', icon: Briefcase },
              { id: 'dept', label: 'Dept Layer', icon: Box },
              { id: 'org', label: 'Org Layer', icon: Luggage },
              { id: 'public', label: 'Public Layer', icon: Share2 }
            ].map(layer => {
              const Icon = layer.icon;
              const isSelected = privacyLayerFilter === layer.id;
              return (
                <button
                  key={layer.id}
                  onClick={() => setPrivacyLayerFilter(layer.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition duration-150 border ${
                    isSelected 
                      ? 'bg-primary text-white border-primary shadow-sm' 
                      : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-450 hover:text-neutral-850'
                  }`}
                >
                  <Icon size={12} />
                  <span>{layer.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gear Grid/List */}
      {filteredGear.length === 0 ? (
        gear.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] p-8 md:p-16 text-center border border-neutral-150 shadow-xl max-w-4xl mx-auto space-y-8 my-8 flex flex-col items-center justify-center relative overflow-hidden w-full"
          >
            {/* Ambient Background decoration */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full filter blur-3xl pointer-events-none -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none translate-y-1/2" />

            {/* Icon Stack */}
            <div className="relative">
              <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mx-auto border border-neutral-100 shadow-inner relative z-10 animate-pulse">
                <Package size={44} className="text-neutral-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-accent text-white rounded-lg flex items-center justify-center shadow-md animate-bounce">
                <Plus size={12} />
              </div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 bg-neutral-900 text-white rounded-full flex items-center justify-center shadow-md">
                <Cpu size={14} className="text-neutral-200" />
              </div>
            </div>

            <div className="space-y-3 max-w-lg mx-auto relative z-10">
              <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-neutral-900">
                Your {customTerms.gearLabelPlural} Library is Empty
              </h3>
              <p className="text-neutral-500 text-xs md:text-sm leading-relaxed">
                Build a centralized database for your {customTerms.gearLabelPlural.toLowerCase()}. 
                Track current holders, register safety inspections, auto-generate QR asset codes, and enable smart template dispatching.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md relative z-10">
              <button
                onClick={() => {
                  triggerHaptic();
                  setSearchParams({ addGear: 'true' });
                }}
                className="w-full sm:w-auto bg-black text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 duration-100"
              >
                <Plus size={16} />
                <span>Add First {customTerms.gearLabelSingular}</span>
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="w-full sm:w-auto bg-neutral-50 hover:bg-neutral-100 text-neutral-800 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider border border-neutral-200 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload size={16} className="text-neutral-500" />
                <span>Import Spreadsheet</span>
              </button>
            </div>

            {/* Informational Hint */}
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-neutral-50 px-4 py-2 rounded-full border border-neutral-150">
              💡 Tip: Import an Excel sheet to populate hundreds of items instantly
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 md:p-16 text-center border border-dashed border-neutral-200 space-y-6 w-full max-w-3xl mx-auto my-6"
          >
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto border border-neutral-100">
              <Search size={28} className="text-neutral-300" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-neutral-800">No matching items found</h3>
              <p className="text-neutral-500 text-xs md:text-sm">
                We couldn't find any {customTerms.gearLabelPlural.toLowerCase()} matching your active query, selected category, or condition filters.
              </p>
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSelectedCondition('all');
                setPrivacyLayerFilter('all');
              }}
              className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
            >
              Clear Filters & Search
            </button>
          </motion.div>
        )
      ) : viewMode === 'grid' ? (
        selectedCategory === 'All' ? (
          <div className="space-y-12 w-full">
            {groupedGearEntries.map(({ categoryNormalized, items }) => (
              <div key={categoryNormalized} className="space-y-4">
                <div className="flex items-center gap-4 border-b border-neutral-100 pb-2.5">
                  <h2 className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-neutral-400">
                    {categoryNormalized === 'Kits' ? 'Kits & Bundles' : categoryNormalized}
                  </h2>
                  <span className="text-[10px] font-mono font-bold text-neutral-400 px-2 py-0.5 bg-neutral-100 rounded-md">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <div className="grid grid-cols-1 min-[450px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 w-full">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => renderGridItem(item))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[450px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 w-full">
            <AnimatePresence mode="popLayout">
              {paginatedGear.map((item) => renderGridItem(item))}
            </AnimatePresence>
          </div>
        )
      ) : viewMode === 'compact' ? (
        selectedCategory === 'All' ? (
          <div className="space-y-12 w-full">
            {groupedGearEntries.map(({ categoryNormalized, items }) => (
              <div key={categoryNormalized} className="space-y-4">
                <div className="flex items-center gap-4 border-b border-neutral-100 pb-2.5">
                  <h2 className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-neutral-400">
                    {categoryNormalized === 'Kits' ? 'Kits & Bundles' : categoryNormalized}
                  </h2>
                  <span className="text-[10px] font-mono font-bold text-neutral-400 px-2 py-0.5 bg-neutral-100 rounded-md">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <div className="grid grid-cols-1 min-[450px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => renderCompactItem(item))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[450px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <AnimatePresence mode="popLayout">
              {paginatedGear.map((item) => renderCompactItem(item))}
            </AnimatePresence>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="hidden md:block bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
              <tr className="border-b border-neutral-50">
                <th className="px-8 py-6 w-10">
                  <button 
                    onClick={() => {
                      const allPageSelected = paginatedGear.length > 0 && paginatedGear.every(i => selectedItems.has(i.id));
                      if (allPageSelected) {
                        const next = new Set(selectedItems);
                        paginatedGear.forEach(i => next.delete(i.id));
                        setSelectedItems(next);
                      } else {
                        const next = new Set(selectedItems);
                        paginatedGear.forEach(i => next.add(i.id));
                        setSelectedItems(next);
                      }
                    }}
                    className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all no-min-h aspect-square shrink-0 ${
                      paginatedGear.length > 0 && paginatedGear.every(i => selectedItems.has(i.id))
                        ? 'bg-primary border-primary text-white' 
                        : 'bg-white border-neutral-200'
                    }`}
                  >
                    {paginatedGear.length > 0 && paginatedGear.every(i => selectedItems.has(i.id)) && <Check size={12} strokeWidth={4} />}
                  </button>
                </th>
                <th 
                  className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-neutral-400 cursor-pointer hover:text-primary transition"
                  onClick={() => {
                    if (sortField === 'name') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    else { setSortField('name'); setSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Item {sortField === 'name' && (sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                  </div>
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Category</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-center">Qty</th>
                <th 
                  className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-neutral-400 cursor-pointer hover:text-primary transition"
                  onClick={() => {
                    if (sortField === 'weight') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    else { setSortField('weight'); setSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Weight {sortField === 'weight' && (sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                  </div>
                </th>
                <th 
                  className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-neutral-400 cursor-pointer hover:text-primary transition"
                  onClick={() => {
                    if (sortField === 'health') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    else { setSortField('health'); setSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Condition {sortField === 'health' && (sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                  </div>
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedCategory === 'All' ? (
                groupedGearEntries.map(({ categoryNormalized, items }) => (
                  <React.Fragment key={categoryNormalized}>
                    <tr className="bg-neutral-50/50">
                      <td colSpan={7} className="px-8 py-3.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-neutral-400 border-y border-neutral-100/80">
                        {categoryNormalized === 'Kits' ? 'Kits & Bundles' : categoryNormalized} ({items.length})
                      </td>
                    </tr>
                    {items.map((item, idx) => renderTableRow(item, `group-${categoryNormalized}-${item.id}-${idx}`))}
                  </React.Fragment>
                ))
              ) : (
                paginatedGear.map((item, idx) => renderTableRow(item, `paginated-${item.id}-${idx}`))
              )}
            </tbody>
            </table>
          </div>
          
          {/* Mobile List View (Cards) */}
          <div className="md:hidden space-y-3">
            {selectedCategory === 'All' ? (
               groupedGearEntries.map(({ categoryNormalized, items }) => (
                <div key={categoryNormalized} className="space-y-3 pt-6 first:pt-0">
                  <div className="flex items-center gap-3 border-b border-neutral-100 pb-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                      {categoryNormalized === 'Kits' ? 'Kits & Bundles' : categoryNormalized}
                    </h4>
                    <span className="text-[9px] font-mono font-bold text-neutral-400 px-1.5 py-0.5 bg-neutral-100 rounded">
                      {items.length}
                    </span>
                  </div>
                  {items.map((item, idx) => renderMobileListItem(item, `group-mob-${categoryNormalized}-${item.id}-${idx}`))}
                </div>
              ))
            ) : (
              paginatedGear.map((item, idx) => renderMobileListItem(item, `paginated-mob-${item.id}-${idx}`))
            )}
          </div>
        </div>
      )}

      {/* Database Pagination & Read Optimization controls */}
      {totalGearCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-50 px-8 py-5 rounded-3xl border border-neutral-200 shadow-sm w-full mt-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${gear.length < totalGearCount ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${gear.length < totalGearCount ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <p className="text-xs font-semibold text-neutral-600">
              {gear.length < totalGearCount ? (
                <>
                  Read Protection Active: Loaded <span className="font-mono font-bold text-neutral-800">{gear.length}</span> of <span className="font-mono font-bold text-neutral-800">{totalGearCount}</span> gear items.
                </>
              ) : (
                <>
                  Read Protection Active: Fully synchronized <span className="font-mono font-bold text-neutral-800">{totalGearCount}</span> of <span className="font-mono font-bold text-neutral-800">{totalGearCount}</span> records.
                </>
              )}
            </p>
          </div>

          {gear.length < totalGearCount && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGearLimit(prev => prev + 50)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                ⚡ Load Next 50 Items
              </button>
              <button
                type="button"
                onClick={() => setGearLimit(totalGearCount + 10)}
                className="px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm"
              >
                Synchronize All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pagination component with clean styling and dropdown options */}
      {filteredGear.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-8 py-6 rounded-3xl border border-neutral-100 shadow-sm w-full">
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>
              Showing{' '}
              <span className="font-mono font-bold text-neutral-800">
                {itemsPerPage === -1 ? 1 : (currentPage - 1) * itemsPerPage + 1}
              </span>{' '}
              to{' '}
              <span className="font-mono font-bold text-neutral-800">
                {itemsPerPage === -1 ? filteredGear.length : Math.min(currentPage * itemsPerPage, filteredGear.length)}
              </span>{' '}
              of{' '}
              <span className="font-mono font-bold text-neutral-800">
                {filteredGear.length}
              </span>{' '}
              items
            </span>
            {filteredGear.length > 250 && (
              <span className="text-[9px] font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-emerald-600 uppercase tracking-widest">
                Optimized Scale
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Items per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-neutral-700 shadow-sm"
              >
                <option value={24}>24</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={-1}>All Items</option>
              </select>
            </div>

            {itemsPerPage !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-neutral-150 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-white text-neutral-500 transition cursor-pointer text-xs font-semibold flex items-center justify-center min-w-[32px] h-[32px]"
                  title="First Page"
                >
                  <ChevronLeft size={14} className="stroke-[2.5]" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 h-[32px] text-xs font-semibold rounded-xl border border-neutral-150 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-white text-neutral-500 transition cursor-pointer"
                >
                  Prev
                </button>

                <div className="flex items-center px-3 h-[32px]">
                  <span className="text-xs font-semibold text-neutral-700">
                    <span className="font-mono text-neutral-900 font-bold">{currentPage}</span> /{' '}
                    <span className="font-mono text-neutral-500">{totalPages}</span>
                  </span>
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 h-[32px] text-xs font-semibold rounded-xl border border-neutral-150 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-white text-neutral-500 transition cursor-pointer"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-neutral-150 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-white text-neutral-500 transition cursor-pointer text-xs font-semibold flex items-center justify-center min-w-[32px] h-[32px]"
                  title="Last Page"
                >
                  <ChevronRight size={14} className="stroke-[2.5]" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}



      {/* Bulk Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col relative overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 md:p-8 flex items-center justify-between border-b border-neutral-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-neutral-900 text-white rounded-2xl">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Bulk Inventory Import</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Step {importStep} of 2 • AI-Powered Migration</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {selectedSyncInventory ? (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100 gap-4">
                      <div>
                        <h3 className="font-bold text-neutral-900 uppercase">Syncing: {selectedSyncInventory.name}</h3>
                        <p className="text-xs text-neutral-400">{syncInventoryItems.length} items found inside this Shared Inventory</p>
                      </div>
                      <button 
                        onClick={() => setSelectedSyncInventory(null)}
                        className="text-xs font-bold text-neutral-500 hover:text-black uppercase tracking-wider bg-white px-3 py-1.5 rounded-xl border border-neutral-200 transition shrink-0"
                      >
                        Choose another list
                      </button>
                    </div>

                    {loadingSyncItems ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider animate-pulse">Loading Inventory Items...</p>
                      </div>
                    ) : syncInventoryItems.length === 0 ? (
                      <div className="text-center py-12 bg-neutral-50 rounded-[2rem] border border-dashed border-neutral-200 text-neutral-400">
                        This custom inventory department is currently empty. Add items to it first!
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Search Bar for Syncing Inventory Items */}
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                          <input
                            type="text"
                            placeholder="Filter list items by name, category, brand, asset tag..."
                            value={syncSearch}
                            onChange={(e) => setSyncSearch(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-bold"
                          />
                        </div>

                        {(() => {
                          const filteredSyncInventoryItems = syncInventoryItems.filter((item: any) => {
                            const lowerSearch = syncSearch.toLowerCase();
                            return (
                              (item.name || '').toLowerCase().includes(lowerSearch) ||
                              (item.assetTag || '').toLowerCase().includes(lowerSearch) ||
                              (item.brand || '').toLowerCase().includes(lowerSearch) ||
                              (item.model || '').toLowerCase().includes(lowerSearch) ||
                              (item.primaryCategory || '').toLowerCase().includes(lowerSearch)
                            );
                          });

                          const allFilteredSelected = filteredSyncInventoryItems.length > 0 && 
                            filteredSyncInventoryItems.every(i => selectedSyncItemIds.has(i.id));

                          return (
                            <>
                              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-400 pb-2 border-b border-neutral-100">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={(e) => {
                                      const next = new Set(selectedSyncItemIds);
                                      if (e.target.checked) {
                                        filteredSyncInventoryItems.forEach(i => next.add(i.id));
                                      } else {
                                        filteredSyncInventoryItems.forEach(i => next.delete(i.id));
                                      }
                                      setSelectedSyncItemIds(next);
                                    }}
                                    className="rounded border-neutral-300 text-primary focus:ring-primary"
                                  />
                                  <span>
                                    {syncSearch ? `Select All Matching (${filteredSyncInventoryItems.length})` : `Select All (${syncInventoryItems.length})`}
                                  </span>
                                </label>
                                <span>{selectedSyncItemIds.size} selected for import</span>
                              </div>

                              <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2">
                                {filteredSyncInventoryItems.length === 0 ? (
                                  <div className="text-center py-12 text-xs font-bold bg-neutral-50 border border-dashed border-neutral-200 text-neutral-400 rounded-2xl">
                                    No items match your search filter
                                  </div>
                                ) : (
                                  filteredSyncInventoryItems.map((item) => {
                                    const isChecked = selectedSyncItemIds.has(item.id);
                                    return (
                                      <div key={item.id} className="flex items-center justify-between p-3.5 bg-neutral-50 hover:bg-neutral-100/70 rounded-2xl transition border border-neutral-100/50">
                                        <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              const next = new Set(selectedSyncItemIds);
                                              if (isChecked) {
                                                next.delete(item.id);
                                              } else {
                                                next.add(item.id);
                                              }
                                              setSelectedSyncItemIds(next);
                                            }}
                                            className="rounded border-neutral-300 text-primary focus:ring-primary shrink-0"
                                          />
                                          <div className="min-w-0">
                                            <p className="font-bold text-xs truncate uppercase text-neutral-900">{item.name}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-1">
                                              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-neutral-200">{item.assetTag}</span>
                                              {item.brand && <span>• {item.brand}</span>}
                                              {item.model && <span>• {item.model}</span>}
                                            </div>
                                          </div>
                                        </label>
                                        <span className="text-[9px] font-black uppercase tracking-widest py-1 px-3 rounded-full bg-neutral-950 text-white shrink-0 ml-2">
                                          {item.primaryCategory || 'Other'}
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={handleImportFromInventory}
                                disabled={selectedSyncItemIds.size === 0 || isImporting}
                                className="w-full py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg disabled:opacity-50 transition"
                              >
                                {isImporting ? 'Syncing...' : `Import ${selectedSyncItemIds.size} Selected Items to Gear Library`}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : importStep === 1 ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* File Upload Area */}
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDragOver(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDragOver(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDragOver(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            processFile(file);
                          }
                        }}
                        className={`border-2 border-dashed ${isDragOver ? 'border-[#0066cc] bg-[#e6f0ff]/30 scale-[1.02]' : 'border-neutral-200'} rounded-[2rem] p-8 flex flex-col items-center justify-center text-center space-y-4 hover:border-black hover:bg-neutral-50 transition-all cursor-pointer group`}
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileUpload}
                        />
                        <div className={`p-5 rounded-3xl transition ${isDragOver ? 'bg-[#0066cc] text-white' : 'bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white'}`}>
                          <Upload size={32} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold uppercase tracking-tight">Upload Spreadsheet</p>
                          <p className="text-xs text-neutral-400">Supports CSV, Excel (.xlsx, .xls) files</p>
                          <p className="text-[10px] text-neutral-400 font-medium">Drag & drop your file here, or click to browse</p>
                        </div>
                        <div className="pt-2 flex flex-col gap-1.5 w-full border-t border-neutral-100/60 mt-3" onClick={(e) => e.stopPropagation()}>
                          <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Sample Templates</p>
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              type="button"
                              onClick={() => downloadTemplate('csv')}
                              className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[9px] font-black uppercase tracking-wider rounded-lg transition flex items-center gap-1 border border-neutral-200/50"
                            >
                              <FileSpreadsheet size={10} />
                              CSV
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadTemplate('xlsx')}
                              className="px-2.5 py-1.5 bg-[#e2f1e5] hover:bg-[#d0ebd6] text-green-700 text-[9px] font-black uppercase tracking-wider rounded-lg transition flex items-center gap-1 border border-green-200/50"
                            >
                              <FileSpreadsheet size={10} />
                              Excel
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* URL Import Area */}
                      <div className="border border-neutral-200 rounded-[2rem] p-8 space-y-6 flex flex-col justify-center">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Globe size={18} className="text-neutral-900" />
                            <p className="text-sm font-bold uppercase tracking-tight">Import from URL</p>
                          </div>
                          <p className="text-xs text-neutral-400">Paste direct link to CSV or Excel file</p>
                        </div>
                        <div className="space-y-3">
                          <input 
                            type="url"
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            placeholder="https://example.com/inventory.csv"
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs focus:ring-2 focus:ring-neutral-900 outline-none transition"
                          />
                          <button 
                            type="button"
                            onClick={handleUrlImport}
                            disabled={!importUrl}
                            className="w-full py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50 transition"
                          >
                            Fetch File
                          </button>
                        </div>
                      </div>

                      {/* Pull from Custom Inventory Area */}
                      <div className="border border-neutral-200 rounded-[2rem] p-8 space-y-6 flex flex-col justify-center">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Layers size={18} className="text-neutral-900" />
                            <p className="text-sm font-bold uppercase tracking-tight font-black">Sync shared inventory</p>
                          </div>
                          <p className="text-xs text-neutral-400">Import items directly from your custom list details</p>
                        </div>
                        {inventories.length === 0 ? (
                          <div className="text-[10px] font-black uppercase text-neutral-400 p-4 bg-neutral-50 rounded-2xl text-center">
                            No custom inventories found
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <select
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs focus:ring-2 focus:ring-neutral-900 outline-none font-bold uppercase tracking-wider"
                              onChange={(e) => {
                                const inv = inventories.find(i => i.id === e.target.value);
                                if (inv) setSelectedSyncInventory(inv);
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>Select Custom List...</option>
                              {inventories.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.name}
                                </option>
                              ))}
                            </select>
                            <p className="text-[9px] text-neutral-400 font-medium italic mt-1 text-center">Instantly sync lists to your library</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={18} />
                        <p className="text-xs font-black uppercase tracking-widest">Enterprise Migration Tip</p>
                      </div>
                      <p className="text-xs text-amber-600 leading-relaxed">
                        For broadcast systems or production company inventories, ensure your headers are in the first row. 
                        Our AI will attempt to understand complex multi-layered data automatically.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Header Controls & Scenario Presets */}
                    <div className="p-5 bg-neutral-900 text-white rounded-[2rem] space-y-4 shadow-xl border border-neutral-850">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <span className="text-[8px] bg-[#ff4f3a] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                            Interactive Playground
                          </span>
                          <h3 className="text-sm font-black uppercase tracking-widest mt-1 text-white flex items-center gap-2">
                            ⚙️ Temporary Import Sandbox
                          </h3>
                        </div>

                        {/* Presets Selector */}
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-neutral-400 uppercase">Scenario Profile:</label>
                          <select
                            value={sandboxPreset}
                            onChange={(e) => {
                              const p = e.target.value as any;
                              setSandboxPreset(p);
                              if (p === 'av_manuals') {
                                toast.info("AV technical manuals scenario activated. Device documentation URLs will be auto-generated.");
                              } else if (p === 'production_bom') {
                                toast.info("Production BOM scenario activated. Standard protective cases & power cables will be bundled.");
                              } else {
                                toast.info("Standard inventory scenario profile selected.");
                              }
                            }}
                            className="bg-neutral-800 border border-neutral-700 text-white text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer hover:bg-neutral-750 transition"
                          >
                            <option value="standard">Standard Gear Setup</option>
                            <option value="av_manuals">AV Technical Manuals & Integration</option>
                            <option value="production_bom">Production BOM (Kits & Bundle Accessories)</option>
                          </select>
                        </div>
                      </div>

                      {/* Informational Profile Header */}
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {sandboxPreset === 'standard' && "Standard mode: Imports spreadsheet records using simple column bindings."}
                        {sandboxPreset === 'av_manuals' && "🔧 AV Integration Profile: Automatically appends technical document references and search queries for manuals onto every imported hardware record."}
                        {sandboxPreset === 'production_bom' && "🎬 Production BOM Profile: Automatically converts listings to Kit format and registers heavy duty Pelican cases and standard power cabling under standard in-the-box add-ons."}
                      </p>

                      {/* Fast operations bar */}
                      <div className="pt-3 border-t border-neutral-800 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newRow = Array(importHeaders.length || 6).fill('');
                            setSandboxEditableData([newRow, ...sandboxEditableData]);
                            toast.success("Inserted a new blank draft row at the top of the sandbox!");
                          }}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-white border border-neutral-700 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition"
                        >
                          ➕ Add New Row
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            mapHeadersAI(importHeaders, sandboxEditableData.slice(0, 3));
                          }}
                          disabled={isMapping}
                          className="px-3 py-1.5 bg-[#0066cc] hover:bg-[#0055b3] text-white disabled:opacity-50 border border-transparent rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition shadow-md"
                        >
                          {isMapping ? (
                            <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : '✨ Run AI Auto-Map'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const nameIdx = importMapping['name'];
                            const catIdx = importMapping['primaryCategory'];
                            if (nameIdx !== undefined && catIdx !== undefined) {
                              const updated = sandboxEditableData.map(row => {
                                const r = [...row];
                                const nameLower = String(r[nameIdx] || '').toLowerCase();
                                if (!r[catIdx]) {
                                  if (nameLower.includes('camera') || nameLower.includes('red') || nameLower.includes('sony')) r[catIdx] = 'Cameras';
                                  else if (nameLower.includes('lens') || nameLower.includes('cooke') || nameLower.includes('prime')) r[catIdx] = 'Lenses';
                                  else if (nameLower.includes('light') || nameLower.includes('led') || nameLower.includes('aputure')) r[catIdx] = 'Lighting';
                                  else if (nameLower.includes('audio') || nameLower.includes('mic') || nameLower.includes('sound')) r[catIdx] = 'Audio';
                                  else r[catIdx] = 'Support';
                                }
                                return r;
                              });
                              setSandboxEditableData(updated);
                              toast.success("AI auto-classified blank categories from item names!");
                            } else {
                              toast.error("Please map columns to both Name and Category first.");
                            }
                          }}
                          className="px-3 py-1.5 bg-neutral-850 hover:bg-neutral-850 border border-neutral-700 text-neutral-300 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition"
                        >
                          🏷️ Auto-Classify Categories
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const qtyIdx = importMapping['quantity'];
                            if (qtyIdx !== undefined) {
                              const updated = sandboxEditableData.map(row => {
                                const r = [...row];
                                if (!r[qtyIdx] || isNaN(Number(r[qtyIdx]))) r[qtyIdx] = '1';
                                return r;
                              });
                              setSandboxEditableData(updated);
                              toast.success("Set empty/invalid quantities to 1!");
                            } else {
                              toast.error("Please map a column to 'Quantity' first.");
                            }
                          }}
                          className="px-3 py-1.5 bg-neutral-850 hover:bg-neutral-850 border border-neutral-700 text-neutral-300 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition"
                        >
                          🔢 Set Quantities to 1
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSandboxEditableData(importData);
                            toast.success("Restored sandbox rows to original file layout.");
                          }}
                          className="px-3 py-1.5 bg-neutral-850 hover:bg-neutral-850 border border-neutral-700 text-[#ff4f3a] rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition ml-auto"
                        >
                          🔄 Reset Sandbox
                        </button>
                      </div>
                    </div>

                    {/* Mapping Matrix & Sandbox Grid */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500">
                          Interactive Sandbox Spreadsheet Grid
                        </h4>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          💡 Click any cell to edit content inline • Set bindings in column headers
                        </span>
                      </div>

                      <div className="border border-neutral-200 rounded-[2rem] overflow-hidden shadow-sm bg-white">
                        <div className="overflow-x-auto max-h-[450px]">
                          <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                            <thead className="bg-neutral-100 border-b border-neutral-200 uppercase font-black text-neutral-600 sticky top-0 z-10 text-[9px] tracking-wider">
                              <tr>
                                <th className="px-3 py-4 w-[60px] text-center border-r border-neutral-200">Index</th>
                                {importHeaders.map((header, colIdx) => {
                                  // Find if this col index is mapped to any field
                                  const currentField = Object.keys(importMapping).find(k => importMapping[k] === colIdx) || '';
                                  return (
                                    <th key={colIdx} className="px-4 py-3 border-r border-neutral-200 w-[200px] bg-neutral-50">
                                      <div className="flex flex-col">
                                        <span className="text-neutral-700 truncate block font-bold text-[11px]" title={header}>
                                          {header}
                                        </span>
                                        <select
                                          value={currentField}
                                          onChange={(e) => {
                                            const f = e.target.value;
                                            const newMapping = { ...importMapping };
                                            if (f) {
                                              // Remove existing mapping of this field from other columns
                                              Object.keys(newMapping).forEach(key => {
                                                if (newMapping[key] === colIdx) {
                                                  delete newMapping[key];
                                                }
                                              });
                                              newMapping[f] = colIdx;
                                            } else {
                                              Object.keys(newMapping).forEach(key => {
                                                if (newMapping[key] === colIdx) {
                                                  delete newMapping[key];
                                                }
                                              });
                                            }
                                            setImportMapping(newMapping);
                                            toast.success(`Mapped column "${header}" to field: ${f || 'Unmapped'}`);
                                          }}
                                          className="mt-1.5 w-full text-[9px] bg-neutral-900 text-white rounded-lg px-2 py-1 outline-none font-black tracking-widest cursor-pointer hover:bg-neutral-800 transition"
                                        >
                                          <option value="">(No Field Mapped)</option>
                                          <option value="name">Map to Name *</option>
                                          <option value="brand">Map to Brand</option>
                                          <option value="model">Map to Model</option>
                                          <option value="primaryCategory">Map to Category</option>
                                          <option value="quantity">Map to Quantity</option>
                                          <option value="price">Map to Price</option>
                                          <option value="serialNumber">Map to Serial Number</option>
                                          <option value="modelNumber">Map to Model Number</option>
                                          <option value="weight">Map to Weight</option>
                                          <option value="condition">Map to Condition</option>
                                          <option value="status">Map to Status</option>
                                        </select>
                                      </div>
                                    </th>
                                  );
                                })}
                                <th className="px-3 py-3 w-[80px] text-center">Actions</th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-neutral-150 text-[11px]">
                              {sandboxEditableData.slice(0, 50).map((row, rowIdx) => (
                                <tr key={rowIdx} className="hover:bg-neutral-50 transition font-medium group">
                                  <td className="px-3 py-3 text-center text-neutral-400 font-mono border-r border-neutral-150 bg-neutral-50">
                                    {rowIdx + 1}
                                  </td>
                                  {row.map((cell, colIdx) => {
                                    const isEditing = activeEditingCell?.rowIdx === rowIdx && activeEditingCell?.colIdx === colIdx;
                                    const currentField = Object.keys(importMapping).find(k => importMapping[k] === colIdx) || '';
                                    return (
                                      <td 
                                        key={colIdx} 
                                        onClick={() => {
                                          setActiveEditingCell({ rowIdx, colIdx });
                                          setCellInputValue(String(cell || ''));
                                        }}
                                        className={`px-4 py-2.5 border-r border-neutral-150 relative truncate cursor-pointer transition-all ${
                                          isEditing ? 'bg-primary/5 ring-1 ring-primary' : ''
                                        } ${currentField ? 'bg-emerald-50/25 text-neutral-900 font-semibold' : 'text-neutral-500'}`}
                                      >
                                        {isEditing ? (
                                          <input
                                            type="text"
                                            value={cellInputValue}
                                            autoFocus
                                            onChange={(e) => setCellInputValue(e.target.value)}
                                            onBlur={() => {
                                              const updated = [...sandboxEditableData];
                                              updated[rowIdx][colIdx] = cellInputValue;
                                              setSandboxEditableData(updated);
                                              setActiveEditingCell(null);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                const updated = [...sandboxEditableData];
                                                updated[rowIdx][colIdx] = cellInputValue;
                                                setSandboxEditableData(updated);
                                                setActiveEditingCell(null);
                                              }
                                            }}
                                            className="w-full bg-white text-xs p-1 outline-none font-bold text-neutral-900 rounded border border-primary shadow-sm"
                                          />
                                        ) : (
                                          <span>{String(cell || '-')}</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center border-l border-neutral-150">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = sandboxEditableData.filter((_, idx) => idx !== rowIdx);
                                        setSandboxEditableData(updated);
                                        toast.success(`Removed draft row #${rowIdx + 1}`);
                                      }}
                                      className="p-1 hover:bg-red-50 text-red-500 rounded-lg transition"
                                      title="Delete Row"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination notes info */}
                        <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                          <span>📋 Live Sandboxed: {sandboxEditableData.length} records detected</span>
                          <span>🔍 Showing top 50 rows for performance optimization</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 md:p-8 border-t border-neutral-100 flex items-center justify-between">
                {importStep === 1 ? (
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    Maximum recommended: 5,000 items per import
                  </p>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setImportStep(1)}
                    className="px-6 py-4 border border-neutral-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 transition"
                  >
                    Back to Upload
                  </button>
                )}
                
                {importStep === 2 && (
                  <button 
                    type="button"
                    onClick={executeImport}
                    disabled={isImporting || !importMapping['name']}
                    className="px-10 py-4 bg-[#0066cc] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-[#0055b3] disabled:opacity-50 shadow-xl transition-all"
                  >
                    {isImporting ? <RotateCcw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    <span>{isImporting ? 'Importing Gear...' : `Finalize & Import ${importData.length} Items`}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleAddModalClose();
          }}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-2xl rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleAdd} className="flex flex-col h-full max-h-[95vh] md:max-h-[90vh]">
              <div className="p-6 md:p-8 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Add Gear</h2>
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3].map(s => (
                      <div key={s} className={`h-1 w-8 rounded-full transition-colors ${addStep >= s ? 'bg-primary' : 'bg-neutral-100'}`} />
                    ))}
                  </div>
                </div>
                <button type="button" onClick={handleAddModalClose} className="p-2 hover:bg-neutral-100 rounded-xl transition">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {addStep === 1 && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Item Name</label>
                          <button 
                            type="button"
                            onClick={handleMagicSuggest}
                            disabled={isAIProcessing || !newItem.name}
                            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 disabled:opacity-50 transition"
                          >
                            <Sparkles size={12} />
                            <span>{isAIProcessing ? 'Thinking...' : 'Magic Suggest'}</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={newItem.name}
                          onChange={e => {
                            const val = e.target.value;
                            const matches = gear.filter(g => g.name && g.name.trim().toLowerCase() === val.trim().toLowerCase());
                            if (matches.length > 0) {
                              const existing = matches[0];
                              setNewItem({
                                ...newItem,
                                name: val,
                                brand: newItem.brand || existing.brand || '',
                                model: newItem.model || existing.model || '',
                                modelNumber: newItem.modelNumber || existing.modelNumber || '',
                                serialNumber: newItem.serialNumber || existing.serialNumber || '',
                                releaseYear: newItem.releaseYear || existing.releaseYear || '',
                                weight: newItem.weight || existing.weight || 0,
                                weightUnit: newItem.weightUnit || existing.weightUnit || 'g',
                                price: newItem.price || existing.price || 0,
                                description: newItem.description || existing.description || '',
                                rentalPrice: newItem.rentalPrice || existing.rentalPrice || 0,
                                currency: newItem.currency || existing.currency || '$',
                                rentalPeriod: newItem.rentalPeriod || existing.rentalPeriod || 'day',
                                secondaryCategories: newItem.secondaryCategories && newItem.secondaryCategories.length > 0 ? newItem.secondaryCategories : existing.secondaryCategories || []
                              });
                            } else {
                              setNewItem({ ...newItem, name: val });
                            }
                            setIsDirty(true);
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                          placeholder="e.g. Sony A7IV"
                          required
                        />
                      </div>
                      <div className="space-y-2 relative">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Brand</label>
                          {dbBrands.length > 0 && (
                            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">
                              Matches loaded directory
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={newItem.brand || ''}
                            onChange={e => {
                              setNewItem({ ...newItem, brand: e.target.value });
                              setIsDirty(true);
                            }}
                            placeholder="Type or select a manufacturer..."
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                            list="add-brands-datalist"
                          />
                          <datalist id="add-brands-datalist">
                            {dbBrands.map(b => (
                              <option key={b.id} value={b.name}>{b.origin ? `${b.name} (${b.origin})` : b.name}</option>
                            ))}
                          </datalist>
                        </div>
                        {/* Top Brand recommendation chips for single click */}
                        {dbBrands.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5">
                            {dbBrands.slice(0, 5).map(b => (
                              <button
                                type="button"
                                key={b.id}
                                onClick={() => {
                                  setNewItem({ ...newItem, brand: b.name });
                                  setIsDirty(true);
                                }}
                                className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition ${
                                  newItem.brand === b.name
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-neutral-300'
                                }`}
                              >
                                {b.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Primary Category</label>
                        <select
                          value={newItem.primaryCategory || newItem.category || 'Other'}
                          onChange={e => {
                            const val = e.target.value;
                            setNewItem({ 
                              ...newItem, 
                              category: val,
                              primaryCategory: val,
                              isKit: val === 'Kit'
                            });
                            setIsDirty(true);
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                        >
                          <option value="Kit">Kit (Bundle)</option>
                          {resolvedCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Status</label>
                        <select
                          value={newItem.status || 'available'}
                          onChange={e => {
                            if (e.target.value === 'in_use') {
                              toast.error("Standard catalog items cannot be checked out (set to 'In Use') individually.", {
                                duration: 5000
                              });
                              setCheckoutGuidanceModal(true);
                              return;
                            }
                            setNewItem({ ...newItem, status: e.target.value as any });
                            setIsDirty(true);
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                        >
                          <option value="available">Available</option>
                          <option value="in_use">In Use (Handover Required)</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="retired">Retired</option>
                          <option value="missing">Missing</option>
                        </select>
                      </div>

                      {/* Secondary Categories Selection Section */}
                      <div className="space-y-3 col-span-full border-t border-neutral-100 pt-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Secondary Categories (Tags)</span>
                        <p className="text-[10px] text-neutral-400 -mt-1">Assign optional additional categories or custom tags for extra searchability</p>
                        
                        {/* Selected Tag Pills */}
                        <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                          {(newItem.secondaryCategories || []).length === 0 ? (
                            <span className="text-[10px] italic text-neutral-400">No secondary categories assigned. Click preset badges or type custom ones below.</span>
                          ) : (
                            (newItem.secondaryCategories || []).map((cat, idx) => (
                              <div
                                key={`${cat}-${idx}`}
                                className="px-2.5 py-1 bg-neutral-900 text-white text-[10px] font-bold uppercase rounded-lg flex items-center gap-1.5 shadow-sm"
                              >
                                <span>{cat}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = newItem.secondaryCategories || [];
                                    setNewItem({ ...newItem, secondaryCategories: current.filter(c => c !== cat) });
                                    setIsDirty(true);
                                  }}
                                  className="text-neutral-300 hover:text-white font-black text-xs"
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Custom tag typing & presets */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={customNewTag}
                              onChange={(e) => setCustomNewTag(e.target.value)}
                              placeholder="Type custom tag / category and press Add..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const tag = customNewTag.trim();
                                  if (tag) {
                                    const current = newItem.secondaryCategories || [];
                                    if (!current.includes(tag)) {
                                      setNewItem({ ...newItem, secondaryCategories: [...current, tag] });
                                      setIsDirty(true);
                                    }
                                    setCustomNewTag('');
                                  }
                                }
                              }}
                              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const tag = customNewTag.trim();
                                if (tag) {
                                  const current = newItem.secondaryCategories || [];
                                  if (!current.includes(tag)) {
                                    setNewItem({ ...newItem, secondaryCategories: [...current, tag] });
                                    setIsDirty(true);
                                  }
                                  setCustomNewTag('');
                                }
                              }}
                              className="px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase"
                            >
                              Add
                            </button>
                          </div>

                          {/* Quick presets */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {['Full Frame', 'Anamorphic', 'Zoom', 'E-mount', ...resolvedCategories].map(cat => {
                              const primary = newItem.primaryCategory || newItem.category || 'Other';
                              if (cat === primary) return null;

                              const secondaryList = newItem.secondaryCategories || [];
                              const isSelected = secondaryList.includes(cat);
                              if (isSelected) return null; // already selected, show only unselected as presets

                              return (
                                <button
                                  type="button"
                                  key={cat}
                                  onClick={() => {
                                    const current = newItem.secondaryCategories || [];
                                    setNewItem({ ...newItem, secondaryCategories: [...current, cat] });
                                    setIsDirty(true);
                                  }}
                                  className="px-2.5 py-0.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-500 hover:text-neutral-800 text-[9px] font-bold uppercase rounded-lg transition"
                                >
                                  + {cat}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {newItem.isKit && (
                          <button
                            type="button"
                            onClick={() => handleSyncKitCategories(newItem, (updatedFields) => setNewItem({ ...newItem, ...updatedFields }))}
                            className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#0066cc] bg-[#e6f0ff] hover:bg-[#cce0ff] px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
                          >
                            <Sparkles size={11} />
                            <span>⚡ Intelligent Sync Categories from Contents</span>
                          </button>
                        )}
                      </div>



                      {/* Equipment Registry Details (Serial, Model, release year, model numbers) */}
                      <div className="border border-neutral-200/65 rounded-[2rem] p-5 bg-neutral-50/50 space-y-4 col-span-full border-t border-b py-5 my-2">
                        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-800">Registration & Inventory Identifiers</h4>
                            <p className="text-[10px] text-neutral-400 mt-0.5">Define models, serial numbers, and years below or extract with AI</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAIAutoRegister(newItem, (updates) => setNewItem({ ...newItem, ...updates }))}
                            disabled={isAIAutoRegistering || !newItem.name}
                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#0066cc] bg-[#e6f0ff] hover:bg-[#cce0ff] hover:text-[#0055b3] transition px-3 py-2 rounded-xl disabled:opacity-50"
                          >
                            {isAIAutoRegistering ? <Sparkles size={11} className="animate-spin text-primary" /> : <Sparkles size={11} className="text-primary" />}
                            <span>{isAIAutoRegistering ? 'Registering...' : '🤖 Autofill with AI'}</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model Name</label>
                            <input
                              type="text"
                              value={newItem.model || ''}
                              onChange={e => {
                                setNewItem({ ...newItem, model: e.target.value });
                                setIsDirty(true);
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition"
                              placeholder="Sony A7IV"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model Number</label>
                            <input
                              type="text"
                              value={newItem.modelNumber || ''}
                              onChange={e => {
                                setNewItem({ ...newItem, modelNumber: e.target.value });
                                setIsDirty(true);
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition"
                              placeholder="ILCE-7M4"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Serial Number</label>
                            <input
                              type="text"
                              value={newItem.serialNumber || ''}
                              onChange={e => {
                                setNewItem({ ...newItem, serialNumber: e.target.value });
                                setIsDirty(true);
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition"
                              placeholder="S01-987654-A"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Release Year</label>
                            <input
                              type="text"
                              value={newItem.releaseYear || ''}
                              onChange={e => {
                                setNewItem({ ...newItem, releaseYear: e.target.value });
                                setIsDirty(true);
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition"
                              placeholder="2021"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Photos</label>
                      <div className="flex flex-wrap gap-4">
                        {newItem.photoUrls?.map((url, idx) => (
                          <div key={idx} className="relative group w-20 h-20">
                            <img src={url} className="w-full h-full object-cover rounded-xl border border-neutral-200" />
                            <button 
                              type="button"
                              onClick={() => {
                                setNewItem({ ...newItem, photoUrls: newItem.photoUrls?.filter((_, i) => i !== idx) });
                                setIsDirty(true);
                              }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoPickerModal({ isOpen: true, target: 'new' });
                            setSelectedSystemPhotos([]);
                            setSearchTextForPhotos('');
                          }}
                          className="w-20 h-20 rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-400 hover:border-primary hover:text-primary transition"
                        >
                          <Camera size={20} />
                          <span className="text-[8px] font-bold uppercase mt-1">Add</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {addStep === 2 && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Weight</label>
                          <button 
                            type="button"
                            onClick={() => handleEstimateWeight('new')}
                            disabled={isEstimatingWeight || !newItem.name}
                            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 disabled:opacity-50 transition"
                            title="AI Assistant: Search and fill automatic weight specs based on name/brand"
                          >
                            <Sparkles size={12} className={isEstimatingWeight ? 'animate-spin' : ''} />
                            <span>{isEstimatingWeight ? 'Consulting specs...' : 'AI Pull Weight'}</span>
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={newItem.weight || ''}
                            onChange={e => {
                              setNewItem({ ...newItem, weight: parseFloat(e.target.value) });
                              setIsDirty(true);
                            }}
                            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                            placeholder="0.00"
                          />
                          <select
                            value={newItem.weightUnit || 'g'}
                            onChange={e => {
                              setNewItem({ ...newItem, weightUnit: e.target.value as any });
                              setIsDirty(true);
                            }}
                            className="w-24 bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-3 outline-none focus:ring-2 focus:ring-primary transition text-xs font-bold"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="lb">lb</option>
                            <option value="oz">oz</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Condition</label>
                        <select
                          value={newItem.condition}
                          onChange={e => {
                            setNewItem({ ...newItem, condition: e.target.value as any });
                            setIsDirty(true);
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                        >
                          <option value="new">New</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                          <option value="poor">Poor</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Price ($)</label>
                        <input
                          type="number"
                          value={newItem.price}
                          onChange={e => {
                            setNewItem({ ...newItem, price: parseFloat(e.target.value) });
                            setIsDirty(true);
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                        />
                      </div>
                      <div className="space-y-2.5 sm:col-span-2 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] block">📦 Asset Tracking Strategy</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setTrackingMode('bulk')}
                            className={`p-3.5 rounded-xl border flex flex-col items-start text-left transition-all ${
                              trackingMode === 'bulk'
                                ? 'bg-neutral-900 border-neutral-900 text-white shadow-md'
                                : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                            }`}
                          >
                            <span className="text-xs font-black uppercase tracking-tight">Bulk Quantity Tracking</span>
                            <span className="text-[9px] opacity-75 mt-1 leading-normal">For standard non-serialized accessories / bulk items (e.g. 10x spigots, 50x safety ropes). Single library entry with combined stock quantity.</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setTrackingMode('serialized')}
                            className={`p-3.5 rounded-xl border flex flex-col items-start text-left transition-all ${
                              trackingMode === 'serialized'
                                ? 'bg-neutral-900 border-neutral-900 text-white shadow-md'
                                : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                            }`}
                          >
                            <span className="text-xs font-black uppercase tracking-tight">Serialized Asset Tracking</span>
                            <span className="text-[9px] opacity-75 mt-1 leading-normal">For precious serialized parent equipment (e.g. 5x Sony Cameras, Lenses). Auto-creates distinct individual records with custom barcodes and unique serials.</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                          {trackingMode === 'serialized' ? 'Quantity of Copies to Deploy' : 'Quantity Owned'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={newItem.quantity}
                          onChange={e => {
                            setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 });
                            setIsDirty(true);
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                        />
                      </div>

                      {trackingMode === 'serialized' && (newItem.quantity || 1) > 1 && (
                        <div className="p-4 bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl sm:col-span-2 space-y-3">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#0066cc] block">⚙️ Autogenerate Sequential Serials & Labels</span>
                          <p className="text-[9px] text-neutral-400 leading-normal">
                            We will compile and save <strong>{newItem.quantity}</strong> separate database items (e.g. <em>{newItem.name} [#1]</em> to <em>{newItem.name} [#{newItem.quantity}]</em>) each tracking distinct health metrics and QR lines.
                          </p>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Serial Number Prefix (Optional)</label>
                              <input
                                type="text"
                                value={serialPrefix}
                                onChange={(e) => setSerialPrefix(e.target.value)}
                                placeholder="e.g. SN-FX6-"
                                className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-[#0066cc]"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Starting Serial Number (Optional)</label>
                              <input
                                type="text"
                                value={serialStartNum}
                                onChange={(e) => setSerialStartNum(e.target.value)}
                                placeholder="e.g. 1001"
                                className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-[#0066cc]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-bold">Last Maintenance Date</label>
                        <input
                          type="date"
                          value={newItem.lastMaintenanceDate || ''}
                          onChange={e => {
                            setNewItem({ ...newItem, lastMaintenanceDate: e.target.value });
                            setIsDirty(true);
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition text-xs font-semibold"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-bold">Maintenance Interval (Days)</label>
                        <input
                          type="number"
                          min="0"
                          value={newItem.maintenanceIntervalDays || ''}
                          onChange={e => {
                            setNewItem({ ...newItem, maintenanceIntervalDays: parseInt(e.target.value) || 0 });
                            setIsDirty(true);
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                          placeholder="e.g. 180"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {newItem.tags?.map((tag, idx) => (
                          <span key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                            {tag}
                            <button type="button" onClick={() => {
                              setNewItem({ ...newItem, tags: newItem.tags?.filter((_, i) => i !== idx) });
                              setIsDirty(true);
                            }} className="hover:text-red-500">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        <input 
                          type="text"
                          placeholder="Add tag..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val && !newItem.tags?.includes(val)) {
                                setNewItem({ ...newItem, tags: [...(newItem.tags || []), val] });
                                setIsDirty(true);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                          className="bg-transparent border-none outline-none text-[10px] font-bold uppercase tracking-wider w-24"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {addStep === 3 && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Description</label>
                      <textarea
                        value={newItem.description}
                        onChange={e => {
                          setNewItem({ ...newItem, description: e.target.value });
                          setIsDirty(true);
                        }}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition h-32 resize-none"
                        placeholder="Add details about your gear..."
                      />
                    </div>

                    {newItem.organizationTip && (
                      <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl flex gap-3">
                        <Lightbulb className="text-primary shrink-0" size={20} />
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">AI Organization Tip</p>
                          <p className="text-xs text-neutral-600 italic leading-relaxed">{newItem.organizationTip}</p>
                        </div>
                      </div>
                    )}
                    {renderAISuggestions(newItem, (updated) => {
                      setNewItem(updated);
                      setIsDirty(true);
                    })}

                    <div className="space-y-4 pt-6 border-t border-neutral-100">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Organizational Assignment</h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Organization</label>
                          <select 
                            value={newItem.orgId || ''}
                            onChange={(e) => {
                              setNewItem({ ...newItem, orgId: e.target.value, deptId: '', teamId: '' });
                              setIsDirty(true);
                            }}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                          >
                            <option value="">Personal / Unassigned</option>
                            {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Department</label>
                          <select 
                            disabled={!newItem.orgId}
                            value={newItem.deptId || ''}
                            onChange={(e) => {
                              setNewItem({ ...newItem, deptId: e.target.value, teamId: '' });
                              setIsDirty(true);
                            }}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-50"
                          >
                            <option value="">None</option>
                            {departments.filter(d => d.orgId === newItem.orgId).map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Team</label>
                          <select 
                            disabled={!newItem.deptId}
                            value={newItem.teamId || ''}
                            onChange={(e) => {
                              setNewItem({ ...newItem, teamId: e.target.value });
                              setIsDirty(true);
                            }}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-50"
                          >
                            <option value="">None</option>
                            {teams.filter(t => t.deptId === newItem.deptId).map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Assign to User</label>
                          <select 
                            value={newItem.assignedTo || ''}
                            onChange={(e) => {
                              setNewItem({ ...newItem, assignedTo: e.target.value });
                              setIsDirty(true);
                            }}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                          >
                            <option value="">None (Float)</option>
                            {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                          </select>
                        </div>

                        {/* Privacy View Layers Selector */}
                        <div className="space-y-2 col-span-full border-t border-dashed border-neutral-200 pt-4 mt-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary font-bold">Privacy View Layers & Access Mode</label>
                          <select 
                            value={newItem.visibility || 'public'}
                            onChange={(e) => {
                              setNewItem({ ...newItem, visibility: e.target.value as any });
                              setIsDirty(true);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition text-xs font-semibold text-neutral-700"
                          >
                            <option value="private">🔒 Private View Layer (User level - Only me)</option>
                            <option value="team">👥 Team View Layer (Visible only in My Team)</option>
                            <option value="dept">🏢 Department View Layer (Visible only in My Dept)</option>
                            <option value="org">🏛️ Organization View Layer (Visible only in My Org)</option>
                            <option value="public">🌐 Public Access Layer (Visible to everyone)</option>
                          </select>
                          <p className="text-[9px] text-neutral-450 italic uppercase tracking-wider">Defines the access visibility boundary for this item across kits, lists, and search queries.</p>
                        </div>
                      </div>
                    </div>

                    {newItem.isKit && (
                      <div className="space-y-4 pt-6 border-t border-neutral-100">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-primary">Kit Contents</label>
                            <p className="text-xs text-neutral-500">{childItems.length} items bundled in this package</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAddingToKit(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
                          >
                            <Plus size={14} />
                            <span>Add Item to Kit</span>
                          </button>
                        </div>
                        
                        <div className="grid gap-3">
                          {childItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100 group">
                              <div className="flex items-center gap-3">
                                <LazyImage src={item.photoUrls?.[0]} className="w-10 h-10 object-cover rounded-lg" />
                                <div>
                                  <p className="text-sm font-bold">{item.name}</p>
                                  <p className="text-[10px] text-neutral-400 font-mono">{item.assetTag}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedIds = newItem.childItemIds?.filter(id => id !== item.id) || [];
                                  setNewItem({ ...newItem, childItemIds: updatedIds });
                                }}
                                className="p-2 text-neutral-300 hover:text-red-500 transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          {childItems.length === 0 && (
                            <div className="text-center py-8 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                              <p className="text-xs text-neutral-400">No items in this kit yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="p-6 md:p-8 bg-neutral-50 flex gap-4">
                {addStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setAddStep(prev => prev - 1)}
                    className="flex-1 md:flex-none px-6 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition text-sm md:text-base flex items-center justify-center text-center"
                  >
                    Back
                  </button>
                )}
                {addStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setAddStep(prev => prev + 1)}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg text-sm md:text-base flex items-center justify-center text-center"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg text-sm md:text-base flex items-center justify-center text-center"
                  >
                    Add to Library
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-2xl rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden"
          >
            <form onSubmit={handleUpdate} className="flex flex-col h-full max-h-[95vh] md:max-h-[90vh]">
              <div className="p-6 md:p-8 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Edit Gear</h2>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => fetchHistory(editingItem.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                    >
                      <History size={14} />
                      <span className="hidden xs:inline">History</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => fetchIncidents(editingItem.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                    >
                      <AlertCircle size={14} />
                      <span className="hidden xs:inline">Incidents</span>
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setEditingItem(null)} className="absolute top-4 right-4 p-2 hover:bg-neutral-100 rounded-xl transition sm:static sm:p-2">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Item Name</label>
                      <button 
                        type="button"
                        onClick={handleMagicSuggest}
                        disabled={isAIProcessing || !editingItem.name}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 disabled:opacity-50 transition"
                      >
                        <Sparkles size={12} />
                        <span>{isAIProcessing ? 'Thinking...' : 'Magic Suggest'}</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={editingItem.name}
                      onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                      required
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Brand</label>
                      {dbBrands.length > 0 && (
                        <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">
                          Matches loaded directory
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={editingItem.brand || ''}
                        onChange={e => setEditingItem({ ...editingItem, brand: e.target.value })}
                        placeholder="Type or select a manufacturer..."
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                        list="editing-brands-datalist"
                      />
                      <datalist id="editing-brands-datalist">
                        {dbBrands.map(b => (
                          <option key={b.id} value={b.name}>{b.origin ? `${b.name} (${b.origin})` : b.name}</option>
                        ))}
                      </datalist>
                    </div>
                    {/* Top Brand recommendation chips for single click */}
                    {dbBrands.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {dbBrands.slice(0, 5).map(b => (
                          <button
                            type="button"
                            key={b.id}
                            onClick={() => setEditingItem({ ...editingItem, brand: b.name })}
                            className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition ${
                              editingItem.brand === b.name
                                ? 'bg-primary/10 border-primary text-primary'
                                : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-neutral-300'
                            }`}
                          >
                            {b.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Primary Category</label>
                    <select
                      value={editingItem.primaryCategory || editingItem.category || 'Other'}
                      onChange={e => {
                        const val = e.target.value;
                        setEditingItem({ 
                          ...editingItem, 
                          category: val,
                          primaryCategory: val,
                          isKit: val === 'Kit'
                        });
                      }}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                    >
                      <option value="Kit">Kit (Bundle)</option>
                      {resolvedCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Secondary Categories Selection Section */}
                  <div className="space-y-3 col-span-full border-t border-neutral-100 pt-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Secondary Categories (Tags)</span>
                    <p className="text-[10px] text-neutral-400 -mt-1">Assign optional additional categories or custom tags for extra searchability</p>
                    
                    {/* Selected Tag Pills */}
                    <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                      {(editingItem.secondaryCategories || []).length === 0 ? (
                        <span className="text-[10px] italic text-neutral-400">No secondary categories assigned. Click preset badges or type custom ones below.</span>
                      ) : (
                        (editingItem.secondaryCategories || []).map((cat, idx) => (
                          <div
                            key={`${cat}-${idx}`}
                            className="px-2.5 py-1 bg-neutral-900 text-white text-[10px] font-bold uppercase rounded-lg flex items-center gap-1.5 shadow-sm"
                          >
                            <span>{cat}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = editingItem.secondaryCategories || [];
                                setEditingItem({ ...editingItem, secondaryCategories: current.filter(c => c !== cat) });
                              }}
                              className="text-neutral-300 hover:text-white font-black text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Custom tag typing & presets */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customEditTag}
                          onChange={(e) => setCustomEditTag(e.target.value)}
                          placeholder="Type custom tag / category and press Add..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const tag = customEditTag.trim();
                              if (tag) {
                                const current = editingItem.secondaryCategories || [];
                                if (!current.includes(tag)) {
                                  setEditingItem({ ...editingItem, secondaryCategories: [...current, tag] });
                                }
                                setCustomEditTag('');
                              }
                            }
                          }}
                          className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const tag = customEditTag.trim();
                            if (tag) {
                              const current = editingItem.secondaryCategories || [];
                              if (!current.includes(tag)) {
                                setEditingItem({ ...editingItem, secondaryCategories: [...current, tag] });
                              }
                              setCustomEditTag('');
                            }
                          }}
                          className="px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase"
                        >
                          Add
                        </button>
                      </div>

                      {/* Quick presets */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {['Full Frame', 'Anamorphic', 'Zoom', 'E-mount', ...resolvedCategories].map(cat => {
                          const primary = editingItem.primaryCategory || editingItem.category || 'Other';
                          if (cat === primary) return null;

                          const secondaryList = editingItem.secondaryCategories || [];
                          const isSelected = secondaryList.includes(cat);
                          if (isSelected) return null; // already selected, show only unselected as presets

                          return (
                            <button
                              type="button"
                              key={cat}
                              onClick={() => {
                                const current = editingItem.secondaryCategories || [];
                                setEditingItem({ ...editingItem, secondaryCategories: [...current, cat] });
                              }}
                              className="px-2.5 py-0.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-500 hover:text-neutral-800 text-[9px] font-bold uppercase rounded-lg transition"
                            >
                              + {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {editingItem.isKit && (
                      <button
                        type="button"
                        onClick={() => handleSyncKitCategories(editingItem, (updatedFields) => setEditingItem({ ...editingItem, ...updatedFields }))}
                        className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#0066cc] bg-[#e6f0ff] hover:bg-[#cce0ff] px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
                      >
                        <Sparkles size={11} />
                        <span>⚡ Intelligent Sync Categories from Contents</span>
                      </button>
                    )}
                  </div>

                  {/* Lens-Specific Smart Taxonomy Specifications Panel */}
                  {(editingItem.primaryCategory === 'Lens' || editingItem.category === 'Lens') && (
                    <div className="space-y-4 col-span-full border border-neutral-200/50 p-5 rounded-[2rem] bg-neutral-50/50 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
                        <span className="text-sm font-black text-neutral-800">📸 Lens Taxonomy Specifications</span>
                        <span className="px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded-full text-[8px] font-black uppercase tracking-wider">
                          Smart Fields
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        Capture precise attributes to power advanced sorting, filtering, and cross-mount inspections.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block">Lens Classification</label>
                          <select
                            value={editingItem.lensType || ''}
                            onChange={e => setEditingItem({ ...editingItem, lensType: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition"
                          >
                            <option value="">Select classification...</option>
                            <option value="Prime">Prime (Single Focal Length)</option>
                            <option value="Zoom">Zoom (Variable Focal Length)</option>
                            <option value="Cinema Prime">Cinema Prime (Manual, T-Stops)</option>
                            <option value="Cinema Zoom">Cinema Zoom (Manual, Parfocal)</option>
                            <option value="Anamorphic">Anamorphic (Cinema Aspect Squeeze)</option>
                            <option value="Broadcast">Broadcast / ENG (Servo Integrated)</option>
                            <option value="Macro">Macro (Extreme Close-Up)</option>
                            <option value="Fisheye">Fisheye (Ultra-Wide Distortion)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block">Bayonet Mount Type</label>
                          <select
                            value={editingItem.lensMount || ''}
                            onChange={e => setEditingItem({ ...editingItem, lensMount: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition"
                          >
                            <option value="">Select mount compatibility...</option>
                            <option value="Sony E-Mount">Sony E-Mount</option>
                            <option value="Canon EF-Mount">Canon EF-Mount</option>
                            <option value="Canon RF-Mount">Canon RF-Mount</option>
                            <option value="Nikon F-Mount">Nikon F-Mount</option>
                            <option value="Nikon Z-Mount">Nikon Z-Mount</option>
                            <option value="ARRI PL-Mount">ARRI PL-Mount</option>
                            <option value="L-Mount">L-Mount Alliance</option>
                            <option value="Micro Four Thirds">Micro Four Thirds (MFT)</option>
                            <option value="Fujifilm X-Mount">Fujifilm X-Mount</option>
                            <option value="Hasselblad H-Mount">Hasselblad H-Mount</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block">Focal Length (e.g. 50mm or 24-70mm)</label>
                          <input
                            type="text"
                            placeholder="e.g. 50mm, 24-70mm"
                            value={editingItem.focalLength || ''}
                            onChange={e => setEditingItem({ ...editingItem, focalLength: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block">Max Aperture (e.g. f/1.4 or T1.5)</label>
                          <input
                            type="text"
                            placeholder="e.g. f/1.4, T1.5, f/2.8"
                            value={editingItem.maxAperture || ''}
                            onChange={e => setEditingItem({ ...editingItem, maxAperture: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block">Format Coverage / Sensor Circle</label>
                          <select
                            value={editingItem.formatCoverage || ''}
                            onChange={e => setEditingItem({ ...editingItem, formatCoverage: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition"
                          >
                            <option value="">Select sensor coverage...</option>
                            <option value="Full Frame">Full Frame (35mm Standard)</option>
                            <option value="Super35">Super35 / APS-C</option>
                            <option value="Medium Format">Medium Format (Large Circle)</option>
                            <option value="Micro Four Thirds">Micro Four Thirds (MFT)</option>
                            <option value="VistaVision">VistaVision / Large Format (LF)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block">Focus Control Mechanism</label>
                          <select
                            value={editingItem.focusType || ''}
                            onChange={e => setEditingItem({ ...editingItem, focusType: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition"
                          >
                            <option value="">Select focus control...</option>
                            <option value="Manual Focus Only">Manual Focus Only (Cinema Gear Ring)</option>
                            <option value="Autofocus / Manual">Autofocus with Manual Override</option>
                            <option value="Electronic Focus-by-wire">Electronic Focus-by-wire</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Equipment Registry Details (Serial, Model, release year, model numbers) */}
                  <div className="border border-neutral-200/65 rounded-[2rem] p-5 bg-neutral-50/50 space-y-4 col-span-full border-t border-b py-5 my-2">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-800">Registration & Inventory Identifiers</h4>
                        <p className="text-[10px] text-neutral-400 mt-0.5">Define models, serial numbers, and years below or extract with AI</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAIAutoRegister(editingItem, (updates) => setEditingItem({ ...editingItem, ...updates }))}
                        disabled={isAIAutoRegistering || !editingItem.name}
                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#0066cc] bg-[#e6f0ff] hover:bg-[#cce0ff] hover:text-[#0055b3] transition px-3 py-2 rounded-xl disabled:opacity-50"
                      >
                        {isAIAutoRegistering ? <Sparkles size={11} className="animate-spin text-primary" /> : <Sparkles size={11} className="text-primary" />}
                        <span>{isAIAutoRegistering ? 'Registering...' : '🤖 Autofill with AI'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model Name</label>
                        <input
                          type="text"
                          value={editingItem.model || ''}
                          onChange={e => setEditingItem({ ...editingItem, model: e.target.value })}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition"
                          placeholder="Sony A7IV"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model Number</label>
                        <input
                          type="text"
                          value={editingItem.modelNumber || ''}
                          onChange={e => setEditingItem({ ...editingItem, modelNumber: e.target.value })}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition"
                          placeholder="ILCE-7M4"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Serial Number</label>
                        <input
                          type="text"
                          value={editingItem.serialNumber || ''}
                          onChange={e => setEditingItem({ ...editingItem, serialNumber: e.target.value })}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition"
                          placeholder="S01-987654-A"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Release Year</label>
                        <input
                          type="text"
                          value={editingItem.releaseYear || ''}
                          onChange={e => setEditingItem({ ...editingItem, releaseYear: e.target.value })}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition"
                          placeholder="2021"
                        />
                      </div>
                      <div className="space-y-1 col-span-2 lg:col-span-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">NFC Tag ID / Serial</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingItem.nfcTag || ''}
                            onChange={e => setEditingItem({ ...editingItem, nfcTag: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary transition font-mono uppercase"
                            placeholder="No NFC Tag Associated"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setNfcTargetItem({
                                id: editingItem.id,
                                name: editingItem.name,
                                type: 'gear'
                              });
                              setNfcScanMode('associate');
                              setIsNfcModalOpen(true);
                            }}
                            className="px-3 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 shrink-0 border border-neutral-800"
                          >
                            <Cpu size={12} className="text-[#F27D26]" />
                            <span>Link Tag</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Weight</label>
                      <button 
                        type="button"
                        onClick={() => handleEstimateWeight('edit')}
                        disabled={isEstimatingWeight || !editingItem.name}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 disabled:opacity-50 transition"
                        title="AI Assistant: Search and fill automatic weight specs based on name/brand"
                      >
                        <Sparkles size={12} className={isEstimatingWeight ? 'animate-spin' : ''} />
                        <span>{isEstimatingWeight ? 'Consulting specs...' : 'AI Pull Weight'}</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editingItem.weight || ''}
                        onChange={e => setEditingItem({ ...editingItem, weight: parseFloat(e.target.value) })}
                        className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                        placeholder="0.00"
                      />
                      <select
                        value={editingItem.weightUnit || 'g'}
                        onChange={e => setEditingItem({ ...editingItem, weightUnit: e.target.value as any })}
                        className="w-24 bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-3 outline-none focus:ring-2 focus:ring-primary transition text-xs font-bold"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                        <option value="oz">oz</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Status</label>
                    <select
                      value={editingItem.status || 'available'}
                      onChange={e => {
                        if (e.target.value === 'in_use') {
                          toast.error("Standard catalog items cannot be checked out (set to 'In Use') individually.", {
                            duration: 5000
                          });
                          setCheckoutGuidanceModal(true);
                          return;
                        }
                        setEditingItem({ ...editingItem, status: e.target.value as any });
                      }}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                    >
                      <option value="available">Available</option>
                      <option value="in_use">In Use (Handover Required)</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                      <option value="missing">Missing</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Condition</label>
                    <select
                      value={editingItem.condition || 'good'}
                      onChange={e => setEditingItem({ ...editingItem, condition: e.target.value as any })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                    >
                      <option value="new">New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Price ($)</label>
                    <input
                      type="number"
                      value={editingItem.price || ''}
                      onChange={e => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Quantity Owned</label>
                    <input
                      type="number"
                      min="1"
                      value={editingItem.quantity || 1}
                      onChange={e => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-bold">Last Maintenance Date</label>
                    <input
                      type="date"
                      value={editingItem.lastMaintenanceDate || ''}
                      onChange={e => setEditingItem({ ...editingItem, lastMaintenanceDate: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-bold">Maintenance Interval (Days)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingItem.maintenanceIntervalDays || ''}
                      onChange={e => setEditingItem({ ...editingItem, maintenanceIntervalDays: parseInt(e.target.value) || 0 })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                      placeholder="e.g. 180"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Photos</label>
                  <div className="flex flex-wrap gap-4">
                    {editingItem.photoUrls?.map((url, idx) => (
                      <div key={idx} className="relative group w-20 h-20">
                        <img src={url} className="w-full h-full object-cover rounded-xl border border-neutral-200" />
                        <button 
                          type="button"
                          onClick={() => setEditingItem({ ...editingItem, photoUrls: editingItem.photoUrls?.filter((_, i) => i !== idx) })}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition"
                        >
                          <X size={12} />
                        </button>
                        {idx === 0 && (
                          <button
                            type="button"
                            onClick={() => handleAIScan(url)}
                            disabled={isAIProcessing}
                            className="absolute bottom-1 right-1 p-1 bg-primary text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                            title="Identify with AI"
                          >
                            <Wand2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPickerModal({ isOpen: true, target: 'edit' });
                        setSelectedSystemPhotos([]);
                        setSearchTextForPhotos('');
                      }}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-400 hover:border-primary hover:text-primary transition"
                    >
                      <Camera size={20} />
                      <span className="text-[8px] font-bold uppercase mt-1">Add</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {editingItem.tags?.map((tag, idx) => (
                      <span key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                        {tag}
                        <button type="button" onClick={() => setEditingItem({ ...editingItem, tags: editingItem.tags?.filter((_, i) => i !== idx) })} className="hover:text-red-500">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <input 
                      type="text"
                      placeholder="Add tag..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !editingItem.tags?.includes(val)) {
                            setEditingItem({ ...editingItem, tags: [...(editingItem.tags || []), val] });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                      className="bg-transparent border-none outline-none text-[10px] font-bold uppercase tracking-wider w-24"
                    />
                  </div>
                </div>

                {editingItem.organizationTip && (
                  <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl flex gap-3">
                    <Lightbulb className="text-primary shrink-0" size={20} />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">AI Organization Tip</p>
                      <p className="text-xs text-neutral-600 italic leading-relaxed">{editingItem.organizationTip}</p>
                    </div>
                  </div>
                )}
                {renderAISuggestions(editingItem, setEditingItem)}

                {/* Rentability & Marketplace Setup */}
                <div className="space-y-4 pt-6 border-t border-neutral-100">
                  {renderMarketplaceSetup(editingItem, setEditingItem)}
                </div>

                <div className="space-y-4 pt-6 border-t border-neutral-100">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Organizational Assignment</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Organization</label>
                      <select 
                        value={editingItem.orgId || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, orgId: e.target.value, deptId: '', teamId: '' })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                      >
                        <option value="">Personal / Unassigned</option>
                        {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Department</label>
                      <select 
                        disabled={!editingItem.orgId}
                        value={editingItem.deptId || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, deptId: e.target.value, teamId: '' })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-50"
                      >
                        <option value="">None</option>
                        {departments.filter(d => d.orgId === editingItem.orgId).map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Team</label>
                      <select 
                        disabled={!editingItem.deptId}
                        value={editingItem.teamId || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, teamId: e.target.value })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-50"
                      >
                        <option value="">None</option>
                        {teams.filter(t => t.deptId === editingItem.deptId).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Assign to User</label>
                      <select 
                        value={editingItem.assignedTo || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, assignedTo: e.target.value })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition"
                      >
                        <option value="">None (Float)</option>
                        {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                      </select>
                    </div>

                    {/* Privacy View Layers Selector */}
                    <div className="space-y-2 col-span-full border-t border-dashed border-neutral-200 pt-4 mt-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary font-bold">Privacy View Layers & Access Mode</label>
                      <select 
                        value={editingItem.visibility || 'public'}
                        onChange={(e) => setEditingItem({ ...editingItem, visibility: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition text-xs font-semibold text-neutral-700"
                      >
                        <option value="private">🔒 Private View Layer (User level - Only me)</option>
                        <option value="team">👥 Team View Layer (Visible only in My Team)</option>
                        <option value="dept">🏢 Department View Layer (Visible only in My Dept)</option>
                        <option value="org">🏛️ Organization View Layer (Visible only in My Org)</option>
                        <option value="public">🌐 Public Access Layer (Visible to everyone)</option>
                      </select>
                      <p className="text-[9px] text-neutral-450 italic uppercase tracking-wider">Defines the access visibility boundary for this item across kits, lists, and search queries.</p>
                    </div>
                  </div>
                </div>



                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Description</label>
                    <div className="flex items-center gap-2">
                      {!(editingItem.name?.trim() && editingItem.brand?.trim() && editingItem.model?.trim()) ? (
                        <span className="text-[9px] text-neutral-400 font-medium italic">
                          ✍️ Add Name, Brand & Model to unlock AI Assistant
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isGeneratingDescription}
                          onClick={handleGenerateDescription}
                          className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition disabled:opacity-50 animate-pulse"
                        >
                          <Sparkles size={11} className={isGeneratingDescription ? "animate-spin" : ""} />
                          <span>{isGeneratingDescription ? "Generating..." : "✨ AI Assistant"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={editingItem.description || ''}
                    onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition h-32 resize-none"
                    placeholder="Enter or generate a cohesive description..."
                  />
                </div>

                {editingItem.isKit && (
                  <div className="space-y-4 pt-6 border-t border-neutral-100">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Kit Contents</label>
                        <p className="text-xs text-neutral-500">{childItems.length} items bundled in this package</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddingToKit(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
                      >
                        <Plus size={14} />
                        <span>Add Item to Kit</span>
                      </button>
                    </div>
                    
                    <div className="grid gap-3">
                      {childItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100 group">
                          <div className="flex items-center gap-3">
                            <LazyImage src={item.photoUrls?.[0]} className="w-10 h-10 object-cover rounded-lg" />
                            <div>
                              <p className="text-sm font-bold">{item.name}</p>
                              <p className="text-[10px] text-neutral-400 font-mono">{item.assetTag}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedIds = editingItem.childItemIds?.filter(id => id !== item.id) || [];
                              setEditingItem({ ...editingItem, childItemIds: updatedIds });
                            }}
                            className="p-2 text-neutral-300 hover:text-red-500 transition md:opacity-0 md:group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {childItems.length === 0 && (
                        <div className="text-center py-8 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                          <p className="text-xs text-neutral-400">No items in this kit yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 md:p-8 bg-neutral-50 flex gap-4">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition text-sm md:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg text-sm md:text-base"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Incidents Modal */}
      {showIncidents && editingItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-5 sm:p-8 border-b border-neutral-100 flex items-center justify-between">
              <div className="space-y-1 min-w-0 pr-4">
                <h2 className="text-xl sm:text-2xl font-black truncate">Incident Reports</h2>
                <p className="text-xs text-neutral-500 truncate">Track damages, theft, or loss for {editingItem.name}</p>
              </div>
              <button onClick={() => setShowIncidents(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition shrink-0">
                <X size={20} className="sm:hidden" />
                <X size={24} className="hidden sm:block" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
              {isLoggingIncident ? (
                <form onSubmit={handleLogIncident} className="bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Log New Incident</h3>
                    <button type="button" onClick={() => setIsLoggingIncident(false)} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Type</label>
                      <select 
                        value={newIncident.type}
                        onChange={e => setNewIncident({ ...newIncident, type: e.target.value as any })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="damage">Damage</option>
                        <option value="theft">Theft</option>
                        <option value="loss">Loss</option>
                        <option value="repair">Repair</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Severity</label>
                      <select 
                        value={newIncident.severity}
                        onChange={e => setNewIncident({ ...newIncident, severity: e.target.value as any })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Date of Incident</label>
                      <input 
                        type="date"
                        value={newIncident.date}
                        onChange={e => setNewIncident({ ...newIncident, date: e.target.value })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Description</label>
                      <textarea 
                        value={newIncident.description}
                        onChange={e => setNewIncident({ ...newIncident, description: e.target.value })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                        placeholder="Describe what happened..."
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-lg">
                    Log Incident
                  </button>
                </form>
              ) : (
                <button 
                  onClick={() => setIsLoggingIncident(true)}
                  className="w-full py-4 border-2 border-dashed border-neutral-200 rounded-[2rem] text-neutral-400 hover:text-primary hover:border-primary transition flex flex-col items-center justify-center gap-2"
                >
                  <Plus size={24} />
                  <span className="font-bold text-sm">Log New Incident</span>
                </button>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-neutral-400">Recent Incidents</h3>
                {incidents.length === 0 ? (
                  <p className="text-center py-8 text-neutral-400 text-sm">No incidents reported for this item.</p>
                ) : (
                  incidents.map((incident) => (
                    <div key={incident.id} className={`p-6 rounded-3xl border ${incident.resolved ? 'bg-neutral-50 border-neutral-100' : 'bg-red-50/30 border-red-100'} space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                            incident.type === 'theft' || incident.type === 'loss' ? 'bg-neutral-900 text-white' : 'bg-red-500 text-white'
                          }`}>
                            <AlertCircle size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold capitalize">{incident.type}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">{format(new Date(incident.date), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            incident.severity === 'critical' ? 'bg-red-600 text-white' :
                            incident.severity === 'high' ? 'bg-red-100 text-red-600' :
                            incident.severity === 'medium' ? 'bg-amber-100 text-amber-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {incident.severity}
                          </span>
                          {!incident.resolved && (
                            <button 
                              onClick={() => handleResolveIncident(incident.id)}
                              className="px-3 py-1 bg-white border border-neutral-200 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition"
                            >
                              Resolve
                            </button>
                          )}
                          {incident.resolved && (
                            <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-green-600">
                              <CheckCircle2 size={10} />
                              Resolved
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed">{incident.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 sm:p-8 bg-neutral-50">
              <button
                onClick={() => setShowIncidents(false)}
                className="w-full py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition"
              >
                Close Incidents
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && editingItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-xl rounded-2xl sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-5 sm:p-8 border-b border-neutral-100 flex items-center justify-between">
              <div className="space-y-1 min-w-0 pr-4">
                <h2 className="text-xl sm:text-2xl font-black truncate">Version History</h2>
                <p className="text-xs text-neutral-500 truncate">Track changes for {editingItem.name}</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition shrink-0">
                <X size={20} className="sm:hidden" />
                <X size={24} className="hidden sm:block" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-4">
              {historyItems.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                    <Clock size={32} className="text-neutral-200" />
                  </div>
                  <p className="text-neutral-500">No history found for this item.</p>
                </div>
              ) : (
                historyItems.map((version) => (
                  <div 
                    key={version.id}
                    className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100 space-y-4 hover:border-primary/30 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <Clock size={20} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{format(new Date(version.updatedAt), 'MMM d, yyyy • HH:mm')}</p>
                          <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest">Version ID: {version.id.slice(0, 8)}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRevert(version)}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-primary hover:text-white border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-sm"
                      >
                        <RotateCcw size={14} />
                        <span>Revert</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Name</p>
                        <p className="text-xs font-bold truncate">{version.name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Category</p>
                        <p className="text-xs font-bold">{version.category}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Condition</p>
                        <div className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          version.condition === 'new' ? 'bg-green-100 text-green-700' :
                          version.condition === 'good' ? 'bg-blue-100 text-blue-700' :
                          version.condition === 'fair' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {version.condition}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Photos</p>
                        <p className="text-xs font-bold">{version.photoUrls.length} images</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 sm:p-8 bg-neutral-50">
              <button
                onClick={() => setShowHistory(false)}
                className="w-full py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition"
              >
                Close History
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <QRPrintModal 
        isOpen={isQRPrintModalOpen}
        onClose={() => setIsQRPrintModalOpen(false)}
        items={gear}
        user={user}
        initialSelectedIds={selectedItems}
      />

      {/* Floating Action Bar for Selections */}
      <AnimatePresence>
        {(selectedItems.size > 0 || isMultiSelectMode) && (
          <motion.div 
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            className="fixed bottom-26 md:bottom-8 left-1/2 -translate-x-1/2 z-[90] flex flex-col md:flex-row items-center gap-4 bg-neutral-900 text-white p-4 md:px-8 md:py-5 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl border border-white/10 w-[min(calc(100%-2rem),48rem)]"
          >
            <div className="flex items-center justify-between w-full md:w-auto md:border-r md:border-white/10 md:pr-6 md:mr-2">
              <div className="flex items-center gap-3">
                <div className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-black transition-all ${selectedItems.size > 0 ? 'bg-[#0066cc] text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                  {selectedItems.size}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs md:text-sm font-bold text-neutral-300 whitespace-nowrap uppercase tracking-widest leading-none">Selected</span>
                  {selectedItems.size === 0 && <span className="text-[8px] font-black uppercase tracking-wider text-neutral-500 mt-1">Tap items to select</span>}
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedItems(new Set());
                  setIsMultiSelectMode(false);
                }}
                className="md:hidden p-2 hover:bg-white/10 rounded-xl transition text-neutral-400 hover:text-white"
                title="Exit Selection Mode"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible w-full md:w-auto scrollbar-hide pb-1 md:pb-0">
              <button 
                onClick={() => setIsPackingModalOpen(true)}
                disabled={selectedItems.size === 0}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-neutral-800 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-neutral-700 transition shadow-lg whitespace-nowrap border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Pack selected assets"
              >
                <Luggage className="w-4 h-4" />
                <span>Pack</span>
              </button>

              <button 
                onClick={handleCreateKitFromSelection}
                disabled={selectedItems.size === 0}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-neutral-900 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-neutral-100 transition shadow-lg whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
                title="Combine selected into a bundle kit"
              >
                <Layers className="w-4 h-4" />
                <span>Bundle</span>
              </button>

              <button 
                onClick={() => setIsExportToInventoryOpen(true)}
                disabled={selectedItems.size === 0}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 transition shadow-lg whitespace-nowrap border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Copy/Export selected assets to other lists"
              >
                <Upload size={14} className="text-emerald-200" />
                <span>Move to List</span>
              </button>

              <button 
                onClick={() => {
                  setBatchOrgId('');
                  setBatchDeptId('');
                  setBatchTeamId('');
                  setBatchAssignedTo('');
                  setShouldUpdateOrg(true);
                  setShouldUpdateDept(true);
                  setShouldUpdateTeam(true);
                  setShouldUpdateAssignee(true);
                  setIsBatchAssignModalOpen(true);
                }}
                disabled={selectedItems.size === 0}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-neutral-800 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-neutral-750 border border-white/10 transition shadow-lg whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
                title="Bulk change organization, department or team assignment"
              >
                <Sliders size={14} className="text-amber-400 font-bold" />
                <span>Assign Batch</span>
              </button>

              <button 
                onClick={() => {
                  setSelectedRackId('');
                  setIsMoveToRackModalOpen(true);
                }}
                disabled={selectedItems.size === 0}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-neutral-800 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-neutral-750 border border-white/10 transition shadow-lg whitespace-nowrap animate-fade-in disabled:opacity-30 disabled:cursor-not-allowed"
                title="Deploy selected equipment to rack"
              >
                <Server size={14} className="text-blue-400 font-bold" />
                <span>Move to Rack</span>
              </button>

              <button 
                onClick={() => {
                  setSelectedBatchStatus('available');
                  setIsChangeStatusModalOpen(true);
                }}
                disabled={selectedItems.size === 0}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-neutral-800 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-neutral-750 border border-white/10 transition shadow-lg whitespace-nowrap animate-fade-in disabled:opacity-30 disabled:cursor-not-allowed"
                title="Change status of selected to Maintenance, etc."
              >
                <Sliders size={14} className="text-purple-400 font-bold" />
                <span>Change Status</span>
              </button>

              <button 
                onClick={() => setIsQRPrintModalOpen(true)}
                disabled={selectedItems.size === 0}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-neutral-800 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-neutral-750 border border-white/10 transition shadow-lg whitespace-nowrap"
                title="Generate and print QR codes/labels for selected items"
              >
                <QrCode size={14} className="text-blue-400 font-bold" />
                <span>Print QR</span>
              </button>

              <button 
                onClick={handleBatchDelete}
                disabled={selectedItems.size === 0}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-950/40 text-red-400 border border-red-900/40 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition shadow-lg whitespace-nowrap border-white/5"
                title="Batch delete selected assets permanently"
              >
                <Trash2 size={13} className="text-red-400 shrink-0" />
                <span>Delete</span>
              </button>

              {selectedItems.size === 2 && (
                <button 
                  onClick={handleCheckCompatibility}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:brightness-110 transition shadow-lg whitespace-nowrap"
                  title="Run compatibility diagnostic"
                >
                  <Zap className="w-4 h-4 fill-amber-300 stroke-amber-100" />
                  <span>AI Compatibility</span>
                </button>
              )}
              
              <button 
                onClick={() => {
                  setSelectedItems(new Set());
                  setIsMultiSelectMode(false);
                }}
                className="hidden md:block p-2 hover:bg-white/10 rounded-xl transition text-neutral-400 hover:text-white"
                title="Exit Selection Mode"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo action banner */}
      <AnimatePresence>
        {lastBulkAction && (
          <motion.div
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            className="fixed bottom-26 md:bottom-6 left-1/2 -translate-x-1/2 z-[95] flex items-center justify-between gap-4 bg-neutral-900 border border-white/15 text-white rounded-2xl px-6 py-4 shadow-2xl w-[90%] max-w-md"
            id="undo-bulk-action-banner"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
                <RotateCcw size={16} />
              </div>
              <div className="flex flex-col">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">Action Completed</p>
                <p className="text-xs font-bold text-neutral-200 mt-0.5">
                  {lastBulkAction.type === 'delete' && `Deleted ${lastBulkAction.items.length} gear items`}
                  {lastBulkAction.type === 'status' && `Changed status of ${lastBulkAction.items.length} items`}
                  {lastBulkAction.type === 'rack' && `Moved ${lastBulkAction.items.length} items to rack`}
                  {lastBulkAction.type === 'assign' && `Reassigned ${lastBulkAction.items.length} items`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => handleUndoBulkAction()}
                className="px-4 py-2 bg-[#0066cc] hover:bg-[#0052a3] text-white font-black uppercase tracking-widest text-[9px] rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-md"
                id="undo-action-trigger-btn"
              >
                <RotateCcw size={11} />
                <span>Undo</span>
              </button>
              <button
                onClick={() => setLastBulkAction(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition"
                title="Dismiss banner"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Move to Rack Modal */}
      <AnimatePresence>
        {isMoveToRackModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-100 font-sans"
            >
              <div className="p-6 md:p-8 flex items-center justify-between border-b border-[#f4f4f5]">
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-neutral-900 text-white rounded-2xl">
                    <Server size={20} />
                  </span>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Move Selected to Rack</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">
                      Deploying {selectedItems.size} items to structural hardware
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMoveToRackModalOpen(false)}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                <div className="bg-neutral-100/50 p-4 border border-neutral-200 rounded-2xl flex items-start gap-3">
                  <Info size={16} className="text-neutral-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                    Moving items to a rack will update their location association and automatically install them as Rack Equipment inside the chosen rack workspace.
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400">Select Target Rack Workspace</label>
                  {racks.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-neutral-200 rounded-2xl bg-neutral-50 space-y-4">
                      <p className="text-xs text-neutral-400 italic font-bold">No physical racks created yet.</p>
                      <button 
                        onClick={() => {
                          setIsMoveToRackModalOpen(false);
                          navigate('/racks');
                        }}
                        className="mx-auto px-6 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition flex items-center gap-2 cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Create Rack Workspace</span>
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedRackId}
                      onChange={(e) => setSelectedRackId(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary transition cursor-pointer"
                    >
                      <option value="">-- Choose a Rack --</option>
                      {racks.map(rack => (
                        <option key={rack.id} value={rack.id}>{rack.name} ({rack.totalUnits}U)</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="p-6 md:p-8 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                <button
                  onClick={() => setIsMoveToRackModalOpen(false)}
                  className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition shadow-sm text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchMoveToRack}
                  disabled={!selectedRackId}
                  className="flex-1 py-4 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black uppercase tracking-widest text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  Move Assets
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Change Status Modal */}
      <AnimatePresence>
        {isChangeStatusModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-100 font-sans"
            >
              <div className="p-6 md:p-8 flex items-center justify-between border-b border-[#f4f4f5]">
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-neutral-900 text-white rounded-2xl">
                    <Sliders size={20} />
                  </span>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Change Status</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">
                      Formally changing condition of {selectedItems.size} selected items
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChangeStatusModalOpen(false)}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400">Select New Asset Status</label>
                  <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {[
                      { id: 'available', label: 'Available', desc: 'Item is stored securely and ready to pack/deploy' },
                      { id: 'in_use', label: 'In Use', desc: 'Item is dispatched on active operation (Handover required)' },
                      { id: 'maintenance', label: 'Maintenance', desc: 'Item is under technical repair/service cycle' },
                      { id: 'retired', label: 'Retired', desc: 'Item is decommissioned from the fleet' },
                      { id: 'missing', label: 'Missing', desc: 'Item cannot be located in current scan' }
                    ].map(statusOption => (
                      <button
                        key={statusOption.id}
                        type="button"
                        onClick={() => setSelectedBatchStatus(statusOption.id as any)}
                        className={`w-full p-4 rounded-2xl flex items-start gap-4 border text-left transition cursor-pointer ${
                          selectedBatchStatus === statusOption.id 
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-md' 
                            : 'bg-white text-neutral-800 border-neutral-100 hover:bg-neutral-50'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border-2 mt-1 shrink-0 ${
                          selectedBatchStatus === statusOption.id ? 'bg-primary border-primary' : 'bg-white border-neutral-300'
                        }`} />
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide">{statusOption.label}</p>
                          <p className={`text-[10px] font-medium leading-relaxed mt-0.5 ${selectedBatchStatus === statusOption.id ? 'text-neutral-300' : 'text-neutral-400'}`}>
                            {statusOption.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                <button
                  onClick={() => setIsChangeStatusModalOpen(false)}
                  className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition shadow-sm text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchChangeStatus}
                  className="flex-1 py-4 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black uppercase tracking-widest text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  Update Statuses
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export to Custom Inventory Modal */}
      <AnimatePresence>
        {isExportToInventoryOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-100"
            >
              <div className="p-6 md:p-8 flex items-center justify-between border-b border-[#f4f4f5]">
                <div className="flex items-center gap-3">
                  <label className="p-3 bg-neutral-900 text-white rounded-2xl">
                    <FileSpreadsheet size={20} />
                  </label>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Export / Copy to Lists</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">
                      Target {selectedItems.size} items to custom lists
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExportToInventoryOpen(false)}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                  Copying these items will completely replicate them into your chosen list or checklist.
                </p>

                {/* List Type Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block font-sans">
                    Select Target Type
                  </label>
                  <div className="flex bg-neutral-100 p-1.5 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setExportTargetType('inventory');
                        setIsCreateNewInventoryForExport(false);
                      }}
                      className={`flex-1 py-2.5 text-center text-xs font-black uppercase tracking-wider rounded-xl transition ${
                        exportTargetType === 'inventory' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      📁 Custom Sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportTargetType('packingList');
                        setIsCreateNewInventoryForExport(false);
                      }}
                      className={`flex-1 py-2.5 text-center text-xs font-black uppercase tracking-wider rounded-xl transition ${
                        exportTargetType === 'packingList' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      ✈️ Packing List
                    </button>
                  </div>
                </div>

                {/* Tab choice (Existing vs New) */}
                <div className="flex bg-neutral-100 p-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setIsCreateNewInventoryForExport(false)}
                    className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-xl transition ${
                      !isCreateNewInventoryForExport ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    Copy to Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateNewInventoryForExport(true)}
                    className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-xl transition ${
                      isCreateNewInventoryForExport ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    💡 Create New & Copy
                  </button>
                </div>

                {isCreateNewInventoryForExport ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block font-sans">
                        New {exportTargetType === 'inventory' ? 'Inventory' : 'Packing List'} Name
                      </label>
                      <input
                        type="text"
                        placeholder={exportTargetType === 'inventory' ? "e.g. Facility Maintenance Inventory" : "e.g. European Production Tour 2026"}
                        value={newExportInventoryName}
                        onChange={(e) => setNewExportInventoryName(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-neutral-900 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block font-sans">
                        Description (Optional)
                      </label>
                      <textarea
                        placeholder="Brief purpose of this checklist or custom list..."
                        value={newExportInventoryDesc}
                        onChange={(e) => setNewExportInventoryDesc(e.target.value)}
                        rows={2}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-neutral-900 outline-none resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block font-sans">
                      Choose Target {exportTargetType === 'inventory' ? 'Custom Sheet' : 'Packing List'}
                    </label>
                    {exportTargetType === 'inventory' ? (
                      inventories.length === 0 ? (
                        <div className="text-xs font-bold text-center p-6 bg-neutral-50 border border-neutral-200 text-neutral-400 rounded-2xl">
                          No custom sheets found. Click "Create New & Copy" above to generate one on the fly!
                        </div>
                      ) : (
                        <select
                          value={selectedExportInventoryId}
                          onChange={(e) => setSelectedExportInventoryId(e.target.value)}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs focus:ring-2 focus:ring-neutral-900 outline-none font-bold uppercase tracking-wider transition"
                        >
                          <option value="" disabled>Select Custom Sheet...</option>
                          {inventories.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name} ({inv.ownerEmail || 'Shared'})
                            </option>
                          ))}
                        </select>
                      )
                    ) : (
                      packingLists.length === 0 ? (
                        <div className="text-xs font-bold text-center p-6 bg-neutral-50 border border-neutral-200 text-neutral-400 rounded-2xl">
                          No packing lists found. Click "Create New & Copy" above to generate one on the fly!
                        </div>
                      ) : (
                        <select
                          value={selectedExportPackingListId}
                          onChange={(e) => setSelectedExportPackingListId(e.target.value)}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs focus:ring-2 focus:ring-neutral-900 outline-none font-bold uppercase tracking-wider transition"
                        >
                          <option value="" disabled>Select Packing List...</option>
                          {packingLists.map((list) => (
                            <option key={list.id} value={list.id}>
                              {list.name} ({list.ownerEmail || 'Owned'})
                            </option>
                          ))}
                        </select>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                <button
                  onClick={() => setIsExportToInventoryOpen(false)}
                  className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition shadow-sm text-xs uppercase tracking-wider font-sans"
                >
                  Cancel
                </button>
                <button
                  disabled={
                    isExportingToInventory || 
                    (isCreateNewInventoryForExport 
                      ? !newExportInventoryName.trim() 
                      : (exportTargetType === 'inventory' 
                          ? (!selectedExportInventoryId || inventories.length === 0) 
                          : (!selectedExportPackingListId || packingLists.length === 0)
                        )
                    )
                  }
                  onClick={handleExportToInventory}
                  className="flex-1 py-4 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black uppercase tracking-widest text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isExportingToInventory ? 'Copying...' : `Copy Selected (${selectedItems.size})`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="text-red-500" size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black tracking-tight text-neutral-900">{confirmModal.title}</h3>
                  <p className="text-neutral-500 font-medium leading-relaxed">{confirmModal.message}</p>
                </div>
              </div>
              <div className="p-8 bg-neutral-50 flex gap-4">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition shadow-lg shadow-red-200"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI System Compatibility Checker Modal */}
      <AnimatePresence>
        {isCompatModalOpen && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-900 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-xl flex items-center justify-center text-white shadow-md">
                    <Zap className="w-5 h-5 fill-amber-300 stroke-amber-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black leading-none">AI Compatibility Check</h3>
                    <p className="text-xs text-neutral-400 font-medium mt-1">Powered by Gemini 3.1 Pro</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCompatModalOpen(false)} 
                  className="p-2 hover:bg-white/10 rounded-xl transition text-neutral-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {/* Selected Items Comparison Header */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center relative">
                  {compatItems.map((item, idx) => (
                    <div key={item.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-200 border border-neutral-300 shrink-0">
                        {item.photoUrls?.[0] ? (
                          <LazyImage src={item.photoUrls[0]} className="w-full h-full object-cover" alt={item.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-400 bg-neutral-100 text-xs font-bold">
                            #{idx + 1}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase text-primary tracking-widest">{item.primaryCategory || item.category || 'Gear'}</span>
                        <h4 className="text-xs font-bold text-neutral-800 truncate leading-tight mt-0.5">{item.name}</h4>
                        <p className="text-[10px] text-neutral-500 truncate mt-0.5">{item.brand || 'No Brand'} • {item.model || 'No Model'}</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-neutral-200 shadow-sm items-center justify-center z-10 font-bold text-xs text-neutral-400 select-none">
                    &
                  </div>
                </div>

                {loadingCompat ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-bold text-neutral-800">Analyzing System Interfaces...</p>
                      <p className="text-xs text-neutral-500 animate-pulse">Checking specs, connectivity guidelines, and voltage parameters...</p>
                    </div>
                  </div>
                ) : compatError ? (
                  <div className="p-6 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3 text-red-700">
                    <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-500" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-black uppercase tracking-wider">Analysis Failed</h4>
                      <p className="text-xs font-medium leading-relaxed">{compatError}</p>
                      <button 
                        onClick={handleCheckCompatibility} 
                        className="mt-3 px-4 py-2 text-white bg-red-650 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <RefreshCw size={12} />
                        <span>Retry Check</span>
                      </button>
                    </div>
                  </div>
                ) : compatResult ? (
                  <div className="space-y-6">
                    {/* Compatibility Verdict Banner */}
                    <div className={`p-6 rounded-2xl border flex items-start gap-4 transition-all ${
                      compatResult.status === 'COMPATIBLE' 
                        ? 'bg-emerald-50/70 text-emerald-800 border-emerald-100'
                        : compatResult.status === 'WARNING'
                        ? 'bg-amber-50/70 text-amber-800 border-amber-100'
                        : 'bg-rose-50/70 text-rose-800 border-rose-100'
                    }`}>
                      <div className={`p-3 rounded-xl shrink-0 ${
                        compatResult.status === 'COMPATIBLE'
                          ? 'bg-emerald-500 text-white'
                          : compatResult.status === 'WARNING'
                          ? 'bg-amber-500 text-white'
                          : 'bg-rose-500 text-white'
                      }`}>
                        {compatResult.status === 'COMPATIBLE' && <Check size={20} strokeWidth={3} />}
                        {compatResult.status === 'WARNING' && <AlertTriangle size={20} strokeWidth={3} />}
                        {compatResult.status === 'INCOMPATIBLE' && <X size={20} strokeWidth={3} />}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                          AI Compatibility Verdict
                        </span>
                        <h4 className="text-base font-black tracking-tight leading-tight">
                          {compatResult.status === 'COMPATIBLE' && 'Fully Compatible'}
                          {compatResult.status === 'WARNING' && 'Compatible with Warnings'}
                          {compatResult.status === 'INCOMPATIBLE' && 'Incompatible System'}
                        </h4>
                        <p className="text-xs font-medium leading-relaxed opacity-90 mt-1">{compatResult.summary}</p>
                      </div>
                    </div>

                    {/* Identified Compatibility Issues */}
                    {compatResult.issues && compatResult.issues.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5 ml-1">
                          <span>Identified Risks & Constraints</span>
                          <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded text-[9px] font-bold">{compatResult.issues.length}</span>
                        </h4>
                        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden bg-white">
                          {compatResult.issues.map((issue, idx) => (
                            <div key={idx} className="p-4 flex items-start gap-3 hover:bg-neutral-50/50 transition duration-150">
                              <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0 mt-0.5 ${
                                issue.severity === 'HIGH' 
                                  ? 'bg-rose-100 text-rose-700'
                                  : issue.severity === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {issue.severity}
                              </span>
                              <div className="space-y-1 min-w-0">
                                <p className="text-xs font-bold text-neutral-800 leading-normal">{issue.description}</p>
                                {issue.affectedItems && issue.affectedItems.length > 0 && (
                                  <p className="text-[10px] text-neutral-400 font-medium">
                                    Affected: <span className="font-semibold text-neutral-500">{issue.affectedItems.join(', ')}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-50/40 border border-emerald-100/60 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold">
                        <Check size={14} className="text-emerald-500" />
                        <span>No conflicts or connection warnings identified by AI specs auditor.</span>
                      </div>
                    )}

                    {/* AI Recommendations */}
                    {compatResult.recommendations && compatResult.recommendations.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 ml-1">Intelligent System Recommendations</h4>
                        <ul className="space-y-2">
                          {compatResult.recommendations.map((rec, idx) => (
                            <li key={idx} className="p-3 bg-indigo-50/10 border border-indigo-100/50 rounded-2xl flex items-start gap-2.5 hover:bg-indigo-50/20 transition">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                              <p className="text-xs text-neutral-700 font-medium leading-relaxed">{rec}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="p-6 md:p-8 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                <button
                  onClick={() => setIsCompatModalOpen(false)}
                  className="w-full py-4 bg-white border border-neutral-200 text-neutral-700 rounded-2xl font-bold hover:bg-neutral-100 transition shadow-sm text-xs uppercase font-black tracking-widest text-center"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add to Kit Selection Modal */}
      <AnimatePresence>
        {isAddingToKit && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-black">Add Item to Kit</h3>
                <button onClick={() => setIsAddingToKit(false)} className="p-2 hover:bg-neutral-100 rounded-xl">
                  <X size={20} />
                </button>
              </div>

              {/* Sourcing Tabs */}
              <div className="flex border-b border-neutral-100 px-8 bg-neutral-50/50">
                <button 
                  onClick={() => setKitSourceTab('library')}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-wider border-b-2 text-center transition-all ${kitSourceTab === 'library' ? 'border-primary text-primary' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
                >
                  Central Gear Library
                </button>
                <button 
                  onClick={() => setKitSourceTab('inventory')}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-wider border-b-2 text-center transition-all ${kitSourceTab === 'inventory' ? 'border-primary text-primary' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
                >
                  custom inventories
                </button>
              </div>
              
              {kitSourceTab === 'library' ? (
                <>
                  <div className="p-6 border-b border-neutral-100">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                      <input
                        type="text"
                        placeholder="Search by name or asset tag..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {gear
                      .filter(i => {
                        const currentItem = editingItem || newItem;
                        return !i.isKit && i.id !== currentItem?.id && !currentItem?.childItemIds?.includes(i.id) && 
                          (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.assetTag.toLowerCase().includes(searchTerm.toLowerCase()));
                      })
                      .map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setInheritanceModal({ isOpen: true, pendingItem: item });
                          }}
                          className="w-full flex items-center justify-between p-4 bg-white border border-neutral-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition group text-left"
                        >
                          <div className="flex items-center gap-3">
                            <LazyImage src={item.photoUrls?.[0]} className="w-10 h-10 object-cover rounded-lg" />
                            <div>
                              <p className="font-bold text-neutral-900">{item.name}</p>
                              <p className="text-[10px] text-neutral-400 font-mono">{item.assetTag}</p>
                            </div>
                          </div>
                          <Plus size={18} className="text-neutral-300 group-hover:text-primary transition" />
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Sourcing From custom inventories */}
                  <div className="p-6 border-b border-neutral-100 space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Select Custom Inventory</label>
                      <select
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary transition"
                        value={kitSelectedInventory?.id || ''}
                        onChange={(e) => {
                          const selected = inventories.find(inv => inv.id === e.target.value);
                          setKitSelectedInventory(selected || null);
                        }}
                      >
                        <option value="">-- Choose Inventory List --</option>
                        {inventories.map(inv => (
                          <option key={inv.id} value={inv.id}>{inv.name}</option>
                        ))}
                      </select>
                    </div>

                    {kitSelectedInventory && (
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                        <input
                          type="text"
                          placeholder={`Search items in ${kitSelectedInventory.name}...`}
                          value={kitInventorySearch}
                          onChange={(e) => setKitInventorySearch(e.target.value)}
                          className="w-full pl-12 pr-6 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-bold"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {!kitSelectedInventory ? (
                      <div className="text-center py-12 text-neutral-400 text-xs font-bold uppercase tracking-wider">
                        Please choose a custom inventory sheet/list first
                      </div>
                    ) : loadingKitInventoryItems ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-2">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-neutral-400 animate-pulse">Loading Inventory items...</span>
                      </div>
                    ) : kitInventoryItems.length === 0 ? (
                      <div className="text-center py-12 text-neutral-400 text-xs font-bold uppercase">
                        This Custom Inventory sheet has no items.
                      </div>
                    ) : (
                      (() => {
                        const currentItem = editingItem || newItem;
                        const filtered = kitInventoryItems.filter(i => {
                          const nameMatch = (i.name || '').toLowerCase().includes(kitInventorySearch.toLowerCase()) || 
                                           (i.assetTag || '').toLowerCase().includes(kitInventorySearch.toLowerCase());
                          // Exclude items that are already linked in this kit
                          const isAlreadyInKit = currentItem?.childItemIds?.includes(i.id);
                          return nameMatch && !isAlreadyInKit;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-12 text-neutral-400 text-xs font-bold uppercase">
                              No items match search filter.
                            </div>
                          );
                        }

                        return filtered.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleAddInventoryItemToKit(item)}
                            className="w-full flex items-center justify-between p-4 bg-white border border-neutral-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition group text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400 uppercase font-black text-[9px] shrink-0 font-mono border border-neutral-200">
                                {item.assetTag?.slice(-3) || 'G'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-xs uppercase text-neutral-900 truncate">{item.name}</p>
                                <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-0.5">
                                  <span>{item.assetTag}</span>
                                  {item.brand && <span className="truncate">• {item.brand}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 bg-neutral-900 text-white group-hover:bg-primary transition px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest leading-none">
                              <span>Add</span>
                              <Plus size={10} />
                            </div>
                          </button>
                        ));
                      })()
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Packing Modal */}
      <AnimatePresence>
        {isPackingModalOpen && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black">Pack into Case/Bag</h3>
                  <p className="text-sm text-neutral-500 font-bold">Select destination for {selectedItems.size} items</p>
                </div>
                <button onClick={() => setIsPackingModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-4">
                {containers.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto text-neutral-200">
                      <Box size={32} />
                    </div>
                    <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">No active bags or cases found in your organizer.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {containers.map(container => (
                      <button
                        key={container.id}
                        onClick={() => setSelectedCaseId(container.id)}
                        className={`group relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                          selectedCaseId === container.id 
                            ? 'border-primary bg-primary/5 shadow-lg' 
                            : 'border-neutral-100 bg-white hover:border-neutral-300'
                        }`}
                      >
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-neutral-100">
                          {container.photoUrls?.[0] ? (
                            <LazyImage src={container.photoUrls[0]} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-50 text-neutral-300">
                              <Box size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase tracking-widest text-primary px-1.5 py-0.5 bg-primary/10 rounded">
                              {container.type}
                            </span>
                          </div>
                          <h4 className="font-bold text-neutral-900 group-hover:text-primary transition">{container.name}</h4>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                            {container.items.length} Items Packed
                          </p>
                        </div>
                        {selectedCaseId === container.id && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white">
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                <button
                  onClick={() => setIsPackingModalOpen(false)}
                  className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={!selectedCaseId}
                  onClick={handlePackSelection}
                  className="flex-1 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-black transition shadow-lg disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <Luggage size={18} />
                  <span>Pack Selected Items</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Assign Modal */}
      <AnimatePresence>
        {isBatchAssignModalOpen && (
          <div className="fixed inset-0 bg-neutral-900/65 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-neutral-900 flex items-center gap-2">
                    <Sliders className="text-primary" size={22} />
                    <span>Batch Assign Settings</span>
                  </h3>
                  <p className="text-sm text-neutral-500 font-bold font-sans">Applying changes to {selectedItems.size} selected assets</p>
                </div>
                <button onClick={() => setIsBatchAssignModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6 font-sans">
                {/* Info Tip */}
                <div className="bg-neutral-50 border border-neutral-150 p-4 rounded-2xl text-xs text-neutral-500 leading-relaxed font-semibold">
                  Check individual properties to include them in the batch operation. Unchecked fields will remain untouched on existing assets.
                </div>

                {/* Organization Field */}
                <div className="space-y-2 border-b border-neutral-50 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="shouldUpdateOrg"
                        checked={shouldUpdateOrg} 
                        onChange={(e) => setShouldUpdateOrg(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="shouldUpdateOrg" className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 select-none cursor-pointer">
                        Batch Organization
                      </label>
                    </div>
                    {shouldUpdateOrg && (
                      <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">Will Overwrite</span>
                    )}
                  </div>
                  {shouldUpdateOrg && (
                    <select 
                      value={batchOrgId}
                      onChange={(e) => {
                        setBatchOrgId(e.target.value);
                        setBatchDeptId('');
                        setBatchTeamId('');
                      }}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary text-xs font-semibold text-neutral-800"
                    >
                      <option value="">Personal / Unassigned</option>
                      {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  )}
                </div>

                {/* Department Field */}
                <div className="space-y-2 border-b border-neutral-50 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="shouldUpdateDept"
                        checked={shouldUpdateDept} 
                        onChange={(e) => setShouldUpdateDept(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="shouldUpdateDept" className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 select-none cursor-pointer">
                        Batch Department
                      </label>
                    </div>
                    {shouldUpdateDept && (
                      <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">Will Overwrite</span>
                    )}
                  </div>
                  {shouldUpdateDept && (
                    <select 
                      disabled={!batchOrgId}
                      value={batchDeptId}
                      onChange={(e) => {
                        setBatchDeptId(e.target.value);
                        setBatchTeamId('');
                      }}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 text-xs font-semibold text-neutral-800"
                    >
                      <option value="">None / Reset Assigned Department</option>
                      {departments.filter(d => d.orgId === batchOrgId).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Team Field */}
                <div className="space-y-2 border-b border-neutral-50 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="shouldUpdateTeam"
                        checked={shouldUpdateTeam} 
                        onChange={(e) => setShouldUpdateTeam(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="shouldUpdateTeam" className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 select-none cursor-pointer">
                        Batch Team
                      </label>
                    </div>
                    {shouldUpdateTeam && (
                      <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">Will Overwrite</span>
                    )}
                  </div>
                  {shouldUpdateTeam && (
                    <select 
                      disabled={!batchDeptId}
                      value={batchTeamId}
                      onChange={(e) => setBatchTeamId(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 text-xs font-semibold text-neutral-800"
                    >
                      <option value="">None / Reset Assigned Team</option>
                      {teams.filter(t => t.deptId === batchDeptId).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Assign to User Field */}
                <div className="space-y-2 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="shouldUpdateAssignee"
                        checked={shouldUpdateAssignee} 
                        onChange={(e) => setShouldUpdateAssignee(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="shouldUpdateAssignee" className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 select-none cursor-pointer">
                        Batch Assign User
                      </label>
                    </div>
                    {shouldUpdateAssignee && (
                      <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">Will Overwrite</span>
                    )}
                  </div>
                  {shouldUpdateAssignee && (
                    <select 
                      value={batchAssignedTo}
                      onChange={(e) => setBatchAssignedTo(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary text-xs font-semibold text-neutral-800"
                    >
                      <option value="">None (Float / Unassigned)</option>
                      {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                    </select>
                  )}
                </div>

              </div>

              <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsBatchAssignModalOpen(false)}
                  className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition shadow-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBatchAssigning || (!shouldUpdateOrg && !shouldUpdateDept && !shouldUpdateTeam && !shouldUpdateAssignee)}
                  onClick={handleBatchAssign}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase text-[10px] tracking-wider hover:brightness-105 transition shadow-lg disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {isBatchAssigning ? <Loader2 size={16} className="animate-spin" /> : <Sliders size={16} />}
                  <span>Apply Batch Changes</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Guidance Intercept Modal */}
      <AnimatePresence>
        {checkoutGuidanceModal && (
          <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col font-sans"
            >
              <div className="p-8 border-b border-neutral-100 flex items-center justify-between bg-amber-50">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-amber-655" size={28} />
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">Handover Workflow Required</h3>
                    <p className="text-[10px] text-[#5c4000] font-black uppercase tracking-wider">Security and custody tracking enforcement</p>
                  </div>
                </div>
                <button onClick={() => setCheckoutGuidanceModal(false)} className="p-2 hover:bg-amber-100 text-[#5c4000] rounded-xl transition">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <p className="text-xs text-neutral-600 leading-relaxed font-bold">
                  ⚠️ <strong>Standard platform policy:</strong> Individual stock assets cannot be checked out (set to 'In Use') directly from the catalog. To ensure safety logs, custody signatures, and contract terms are followed, assets must go through one of two official check out tracks:
                </p>

                <div className="space-y-4">
                  {/* Track A */}
                  <div className="p-4 border border-neutral-150 rounded-2xl hover:bg-neutral-50 transition flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-neutral-950 text-white shrink-0 flex items-center justify-center font-black text-xs select-none">A</span>
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-neutral-950 uppercase tracking-tight">Attach to a Packing Checklist</h4>
                      <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
                        Create a planning checklist or include the item in an active packing list inside a project, then complete paywalls & check-out signatures.
                      </p>
                    </div>
                  </div>

                  {/* Track B */}
                  <div className="p-4 border border-neutral-150 rounded-2xl hover:bg-neutral-50 transition flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white shrink-0 flex items-center justify-center font-black text-xs select-none">B</span>
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-primary uppercase tracking-tight">Self-Service Gear Terminal</h4>
                      <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
                        Open the <strong>Gear Kiosk Terminal (Kiosk Mode)</strong>, enter credentials, and carry out a verified instant handover custody swipe.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutGuidanceModal(false)}
                  className="flex-1 py-3.5 bg-white border border-neutral-200 text-neutral-600 rounded-xl font-bold hover:bg-neutral-100 transition text-xs shadow-sm"
                >
                  Got It
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutGuidanceModal(false);
                    navigate('/logistics');
                  }}
                  className="flex-1 py-3.5 bg-neutral-900 hover:bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition shadow-lg flex items-center justify-center gap-2"
                >
                  <span>Go to Packing Lists</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutGuidanceModal(false);
                    navigate('/kiosk');
                  }}
                  className="flex-1 py-3.5 bg-primary hover:brightness-105 text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition shadow-lg flex items-center justify-center gap-2"
                >
                  <span>Open Kiosk Mode</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inheritance Selection Modal */}
      <AnimatePresence>
        {inheritanceModal.isOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                  <Shield size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black tracking-tight text-neutral-900">Inherit Assignment?</h3>
                  <p className="text-neutral-500 font-medium leading-relaxed">
                    Should this item and/or others in the kit inherit organizational settings from the kit parent?
                  </p>
                </div>
              </div>
              <div className="p-8 bg-neutral-50 grid gap-3">
                <button
                  onClick={async () => {
                    const kit = editingItem || newItem;
                    const item = inheritanceModal.pendingItem!;
                    await applyInheritanceToItems([item.id], kit);
                    if (editingItem) {
                      setEditingItem({ ...editingItem, childItemIds: [...(editingItem.childItemIds || []), item.id] });
                    } else {
                      setNewItem({ ...newItem, childItemIds: [...(newItem.childItemIds || []), item.id] });
                    }
                    setInheritanceModal({ isOpen: false, pendingItem: null });
                    setIsAddingToKit(false);
                  }}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg text-[10px] uppercase tracking-widest"
                >
                  Apply to this item
                </button>
                <button
                  onClick={async () => {
                    const kit = editingItem || newItem;
                    const item = inheritanceModal.pendingItem!;
                    const currentIds = editingItem ? (editingItem.childItemIds || []) : (newItem.childItemIds || []);
                    const allIds = [...currentIds, item.id];
                    await applyInheritanceToItems(allIds, kit);
                    if (editingItem) {
                      setEditingItem({ ...editingItem, childItemIds: allIds });
                    } else {
                      setNewItem({ ...newItem, childItemIds: allIds });
                    }
                    setInheritanceModal({ isOpen: false, pendingItem: null });
                    setIsAddingToKit(false);
                  }}
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-black transition shadow-lg text-[10px] uppercase tracking-widest"
                >
                  Apply to all in kit
                </button>
                <button
                  onClick={() => {
                    const item = inheritanceModal.pendingItem!;
                    if (editingItem) {
                      setEditingItem({ ...editingItem, childItemIds: [...(editingItem.childItemIds || []), item.id] });
                    } else {
                      setNewItem({ ...newItem, childItemIds: [...(newItem.childItemIds || []), item.id] });
                    }
                    setInheritanceModal({ isOpen: false, pendingItem: null });
                    setIsAddingToKit(false);
                  }}
                  className="w-full py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition text-[10px] uppercase tracking-widest"
                >
                  Skip Inheritance
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Photo Picker Modal */}
      <AnimatePresence>
        {photoPickerModal.isOpen && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
                    <Camera className="text-primary" size={20} />
                    <span>Add Photo</span>
                  </h3>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mt-1">
                    Select photo source for {photoPickerModal.target === 'edit' ? editingItem?.name : 'new item'}
                  </p>
                </div>
                <button
                  onClick={() => setPhotoPickerModal({ ...photoPickerModal, isOpen: false })}
                  className="p-2 hover:bg-neutral-100 rounded-xl transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* hidden input helpers */}
              <input
                type="file"
                multiple
                accept="image/*"
                id="photo-picker-upload-input"
                className="hidden"
                onChange={async (e) => {
                  await handlePhotoUploadEvent(e);
                  setPhotoPickerModal({ ...photoPickerModal, isOpen: false });
                }}
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                id="photo-picker-camera-input"
                className="hidden"
                onChange={async (e) => {
                  await handlePhotoUploadEvent(e);
                  setPhotoPickerModal({ ...photoPickerModal, isOpen: false });
                }}
              />

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Mode Selector Row */}
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('photo-picker-upload-input')?.click();
                    }}
                    className="flex flex-col items-center justify-center p-6 bg-neutral-50 border border-neutral-200 hover:border-primary hover:bg-primary/5 rounded-2xl transition group text-center space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-neutral-200 text-neutral-600 group-hover:bg-primary group-hover:text-white transition shadow-sm">
                      <Upload size={18} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-neutral-700">Upload Photo/file</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('photo-picker-camera-input')?.click();
                    }}
                    className="flex flex-col items-center justify-center p-6 bg-neutral-50 border border-neutral-200 hover:border-primary hover:bg-primary/5 rounded-2xl transition group text-center space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-neutral-200 text-neutral-600 group-hover:bg-primary group-hover:text-white transition shadow-sm">
                      <Camera size={18} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-neutral-700">Take Photo (Camera)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClipboardPasteForPicker}
                    className="flex flex-col items-center justify-center p-6 bg-neutral-50 border border-neutral-200 hover:border-primary hover:bg-primary/5 rounded-2xl transition group text-center space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-neutral-200 text-neutral-600 group-hover:bg-primary group-hover:text-white transition shadow-sm">
                      <ClipboardCheck size={18} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-neutral-700">Paste Clipboard</span>
                  </button>
                </div>

                {/* Direct web URL / image link input */}
                <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">Or Add via Web URL / Direct Image Link</span>
                    <span className="text-[8px] font-bold text-neutral-400 uppercase">Avoids local file storage</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Paste direct photo link (e.g. Unsplash, Imgur)..."
                      id="photo-picker-url-input"
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition placeholder-neutral-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.currentTarget as HTMLInputElement).value.trim();
                          if (val) {
                            handlePhotoPicked([val]);
                            setPhotoPickerModal({ ...photoPickerModal, isOpen: false });
                            toast.success("Successfully added image from web link!");
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('photo-picker-url-input') as HTMLInputElement;
                        const val = input?.value?.trim();
                        if (val) {
                          handlePhotoPicked([val]);
                          setPhotoPickerModal({ ...photoPickerModal, isOpen: false });
                          toast.success("Successfully added image from web link!");
                        } else {
                          toast.error("Please enter a valid image URL first.");
                        }
                      }}
                      className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition shrink-0"
                    >
                      Add Link
                    </button>
                  </div>
                </div>

                {/* Database / System selection area */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Select Existing Item Photos</span>
                    <div className="relative w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={searchTextForPhotos}
                        onChange={(e) => setSearchTextForPhotos(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                      />
                    </div>
                  </div>

                  {/* Child Items segment (Priority - Kit items highlight) */}
                  {childItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="bg-primary/5 px-4 py-2 rounded-xl flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary">Photos of Items in this Kit</span>
                        <span className="text-[8px] font-bold text-neutral-400 uppercase">{childItems.length} items linked</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {getSystemPhotosAvailable().filter(p => p.isChild).map((p, idx) => {
                          const isSelected = selectedSystemPhotos.includes(p.url);
                          return (
                            <button
                              key={`child-${idx}`}
                              type="button"
                              onClick={() => {
                                setSelectedSystemPhotos(prev =>
                                  prev.includes(p.url) ? prev.filter(u => u !== p.url) : [...prev, p.url]
                                );
                              }}
                              className={`relative group h-20 rounded-xl overflow-hidden border transition text-left ${isSelected ? 'border-primary ring-2 ring-primary' : 'border-neutral-200 hover:border-neutral-400'}`}
                            >
                              <LazyImage src={p.url} className="w-full h-full object-cover" />
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[7px] text-white font-mono truncate">
                                {p.itemName}
                              </div>
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-primary text-white p-0.5 rounded-full shadow-md">
                                  <Check size={10} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                        {getSystemPhotosAvailable().filter(p => p.isChild).length === 0 && (
                          <div className="col-span-4 text-center py-4 text-xs font-bold text-neutral-400">
                            No photos found on items in this kit.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* General Gear Library segment */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block px-1">Other Lab / Library photos</span>
                    <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                      {getSystemPhotosAvailable().filter(p => !p.isChild).map((p, idx) => {
                        const isSelected = selectedSystemPhotos.includes(p.url);
                        return (
                          <button
                            key={`all-${idx}`}
                            type="button"
                            onClick={() => {
                              setSelectedSystemPhotos(prev =>
                                prev.includes(p.url) ? prev.filter(u => u !== p.url) : [...prev, p.url]
                              );
                            }}
                            className={`relative group h-20 rounded-xl overflow-hidden border transition text-left ${isSelected ? 'border-primary ring-2 ring-primary' : 'border-neutral-200 hover:border-neutral-400'}`}
                          >
                            <LazyImage src={p.url} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[7px] text-white font-mono truncate">
                              {p.itemName}
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-primary text-white p-0.5 rounded-full shadow-md">
                                <Check size={10} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                      {getSystemPhotosAvailable().filter(p => !p.isChild).length === 0 && (
                        <div className="col-span-4 text-center py-8 text-xs font-bold text-neutral-400">
                          No images found matching filter.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                <button
                  type="button"
                  onClick={() => setPhotoPickerModal({ ...photoPickerModal, isOpen: false })}
                  className="flex-1 py-3.5 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition text-[10px] uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedSystemPhotos.length === 0}
                  onClick={() => {
                    handlePhotoPicked(selectedSystemPhotos);
                    setPhotoPickerModal({ ...photoPickerModal, isOpen: false });
                    toast.success(`Successfully loaded ${selectedSystemPhotos.length} photo(s) into current item`);
                  }}
                  className="flex-1 py-3.5 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:pointer-events-none"
                >
                  Confirm ({selectedSystemPhotos.length}) Photos
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sharingGearItem && (
          <ShareModal 
            type={sharingGearType} 
            data={sharingGearItem} 
            onClose={() => setSharingGearItem(null)} 
            user={user}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {manualCheckoutGearItem && (
          <ManualCheckoutModal
            type={manualCheckoutGearType}
            data={manualCheckoutGearItem}
            user={user}
            onClose={() => setManualCheckoutGearItem(null)}
          />
        )}
      </AnimatePresence>

      <NfcScannerModal
        isOpen={isNfcModalOpen}
        onClose={() => setIsNfcModalOpen(false)}
        mode={nfcScanMode}
        targetItem={nfcTargetItem}
        currentUser={user}
        onAssociateSuccess={(tagId) => {
          if (editingItem) {
            setEditingItem({ ...editingItem, nfcTag: tagId });
          }
        }}
        onSearchSuccess={handleNfcSearchSuccess}
      />

      {/* Floating Action Button (FAB) for Quick Add */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40">
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setSearchParams({ addGear: 'true' });
          }}
          className="bg-black hover:bg-neutral-800 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-90 duration-75 border border-neutral-800 focus:outline-none hover:shadow-neutral-300"
          aria-label="Quick Add Item"
          title="Quick Add Item"
        >
          <Plus size={24} className="text-white" />
        </button>
      </div>
    </div>
  );
}
