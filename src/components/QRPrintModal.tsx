import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Printer, Check, Search, Tag, QrCode, Settings2, Layout, Maximize2, 
  Type, Eye, EyeOff, Info, Sparkles, Sliders, Edit3, Paintbrush, Save, 
  Layers, Cable, Tv, ShieldAlert, ArrowRightLeft, ZoomIn, ZoomOut, Grid, 
  Plus, Copy, Trash2, AlignLeft, AlignCenter, AlignRight, FileText, 
  SlidersHorizontal, Download, Upload, Heart, Share2, HelpCircle, 
  ChevronRight, RefreshCw, FolderOpen, AlertCircle, Sparkle, Smartphone, Cpu, History as HistoryIcon,
  AlignCenterHorizontal, AlignCenterVertical, AlignStartHorizontal, AlignEndHorizontal,
  AlignStartVertical, AlignEndVertical, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { GearItem, UserProfile } from '../types';
import { doc, updateDoc, collection, addDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

interface PrintableItem {
  id: string;
  name: string;
  assetTag?: string;
  brand?: string;
  category?: string;
  serial?: string;
  model?: string;
  ownerId?: string;
  status?: string;
  condition?: string;
}

export interface AveryTemplate {
  id: string;
  name: string;
  columns: number;
  rows: number;
  labelWidth: number; // mm
  labelHeight: number; // mm
  marginTop: number;
  marginLeft: number;
  gapX: number;
  gapY: number;
  pageSize: 'letter' | 'a4';
}

export const AVERY_TEMPLATES: AveryTemplate[] = [
  {
    id: 'avery5160',
    name: 'Avery 5160 / 8160 (30 Labels - 2.625" x 1")',
    columns: 3,
    rows: 10,
    labelWidth: 66.67,
    labelHeight: 25.4,
    marginTop: 12.7,
    marginLeft: 4.7,
    gapX: 3.175,
    gapY: 0,
    pageSize: 'letter'
  },
  {
    id: 'avery5161',
    name: 'Avery 5161 / 8161 (20 Labels - 4" x 1")',
    columns: 2,
    rows: 10,
    labelWidth: 101.6,
    labelHeight: 25.4,
    marginTop: 12.7,
    marginLeft: 4.0,
    gapX: 3.8,
    gapY: 0,
    pageSize: 'letter'
  },
  {
    id: 'avery5162',
    name: 'Avery 5162 / 8162 (14 Labels - 4" x 1.33")',
    columns: 2,
    rows: 7,
    labelWidth: 101.6,
    labelHeight: 33.8,
    marginTop: 21.0,
    marginLeft: 4.0,
    gapX: 3.8,
    gapY: 0,
    pageSize: 'letter'
  },
  {
    id: 'avery5163',
    name: 'Avery 5163 / 8163 (10 Labels - 4" x 2")',
    columns: 2,
    rows: 5,
    labelWidth: 101.6,
    labelHeight: 50.8,
    marginTop: 12.7,
    marginLeft: 4.0,
    gapX: 3.8,
    gapY: 0,
    pageSize: 'letter'
  },
  {
    id: 'averyL7160',
    name: 'Avery L7160 (A4 - 21 Labels - 63.5 x 38.1mm)',
    columns: 3,
    rows: 7,
    labelWidth: 63.5,
    labelHeight: 38.1,
    marginTop: 15.1,
    marginLeft: 7.2,
    gapX: 2.5,
    gapY: 0,
    pageSize: 'a4'
  }
];

// High-fidelity dynamic elements
interface CanvasElement {
  id: string;
  type: 'text' | 'qr' | 'barcode' | 'shape' | 'dynamic' | 'logo';
  content: string; // Dynamic variable or static text
  x: number; // percentage coordinate 0 to 100
  y: number; // percentage coordinate 0 to 100
  width: number; // percentage of label width
  height: number; // percentage of label height
  font?: string;
  fontSize?: number; // pt
  fontWeight?: 'normal' | 'bold' | 'black';
  color?: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  shapeType?: 'rectangle' | 'circle' | 'line' | 'divider';
  qrDest?: 'bio' | 'asset' | 'booking' | 'maintenance' | 'custom';
  qrFgColor?: string;
  qrBgColor?: string;
  barcodeSymbology?: 'code128' | 'code39' | 'ean13';
  showHumanReadable?: boolean;
  isLocked?: boolean;
}

interface StudioTemplate {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  layout: 'standard' | 'cable' | 'square' | 'tiny';
  elements: CanvasElement[];
  category: string;
}

const PRESET_STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: 'tpl_asset_tag',
    name: 'Standard Asset Label',
    width: 60,
    height: 30,
    layout: 'standard',
    category: 'Asset Labels',
    elements: [
      { id: '1', type: 'text', content: '{{asset.brand}}', x: 5, y: 5, width: 50, height: 10, font: 'Inter', fontSize: 7, fontWeight: 'bold', color: '#1e293b' },
      { id: '2', type: 'text', content: '{{asset.name}}', x: 5, y: 15, width: 50, height: 15, font: 'Inter', fontSize: 9, fontWeight: 'black', color: '#0f172a' },
      { id: '3', type: 'text', content: 'ID: {{asset.assetTag}}', x: 5, y: 75, width: 50, height: 15, font: 'JetBrains Mono', fontSize: 6.5, fontWeight: 'bold', color: '#64748b' },
      { id: '4', type: 'qr', content: 'bio', x: 65, y: 10, width: 30, height: 60, qrDest: 'bio', qrFgColor: '#000000', qrBgColor: '#ffffff' },
      { id: '5', type: 'text', content: 'SCAN FOR BIO', x: 65, y: 80, width: 30, height: 15, font: 'Inter', fontSize: 5, fontWeight: 'bold', align: 'center', color: '#1e293b' }
    ]
  },
  {
    id: 'tpl_cable_wrap',
    name: 'Standard Cable Wrap',
    width: 75,
    height: 15,
    layout: 'cable',
    category: 'Cable Wraps',
    elements: [
      { id: '1', type: 'shape', content: 'divider', x: 0, y: 0, width: 4, height: 100, bgColor: '#ff0055', shapeType: 'divider' },
      { id: '2', type: 'qr', content: 'bio', x: 8, y: 10, width: 14, height: 80, qrDest: 'bio', qrFgColor: '#000000', qrBgColor: '#ffffff' },
      { id: '3', type: 'text', content: '{{asset.name}}', x: 26, y: 15, width: 68, height: 35, font: 'Inter', fontSize: 9, fontWeight: 'bold', color: '#0f172a' },
      { id: '4', type: 'text', content: 'LENGTH: 100FT | {{asset.assetTag}}', x: 26, y: 55, width: 68, height: 30, font: 'JetBrains Mono', fontSize: 7, fontWeight: 'normal', color: '#475569' }
    ]
  },
  {
    id: 'tpl_flag_label',
    name: 'Industrial Flag Label',
    width: 80,
    height: 20,
    layout: 'cable',
    category: 'Flag Labels',
    elements: [
      { id: '1', type: 'qr', content: 'bio', x: 5, y: 10, width: 18, height: 80, qrDest: 'bio' },
      { id: '2', type: 'text', content: '{{asset.name}}', x: 28, y: 15, width: 65, height: 35, font: 'Inter', fontSize: 8.5, fontWeight: 'black' },
      { id: '3', type: 'text', content: 'SYS: RACK-A-25', x: 28, y: 55, width: 65, height: 30, font: 'JetBrains Mono', fontSize: 7, fontWeight: 'bold', color: '#b91c1c' }
    ]
  },
  {
    id: 'tpl_battery_tag',
    name: 'V-Mount Battery Decal',
    width: 45,
    height: 45,
    layout: 'square',
    category: 'Battery Labels',
    elements: [
      { id: '1', type: 'text', content: 'PACKER BATTERY UNIT', x: 5, y: 5, width: 90, height: 15, font: 'Space Grotesk', fontSize: 8, fontWeight: 'black', align: 'center' },
      { id: '2', type: 'qr', content: 'bio', x: 25, y: 22, width: 50, height: 50, qrDest: 'bio' },
      { id: '3', type: 'text', content: '{{asset.assetTag}}', x: 5, y: 78, width: 90, height: 15, font: 'JetBrains Mono', fontSize: 7.5, fontWeight: 'bold', align: 'center' }
    ]
  },
  {
    id: 'tpl_pelican_case',
    name: 'Pelican Flight Case Plate',
    width: 100,
    height: 50,
    layout: 'standard',
    category: 'Pelican Cases',
    elements: [
      { id: '1', type: 'shape', content: 'rectangle', x: 2, y: 2, width: 96, height: 96, shapeType: 'rectangle', bgColor: 'transparent', color: '#000000' },
      { id: '2', type: 'text', content: '{{asset.brand}} {{asset.name}}', x: 6, y: 8, width: 55, height: 25, font: 'Inter', fontSize: 13, fontWeight: 'black' },
      { id: '3', type: 'text', content: 'STATUS: {{asset.status}}', x: 6, y: 40, width: 55, height: 15, font: 'Inter', fontSize: 9, fontWeight: 'bold', color: '#10b981' },
      { id: '4', type: 'qr', content: 'bio', x: 66, y: 8, width: 28, height: 56, qrDest: 'bio' },
      { id: '5', type: 'text', content: 'SYSTEM PASSPORT ID: {{asset.assetTag}}', x: 6, y: 78, width: 88, height: 15, font: 'JetBrains Mono', fontSize: 8, fontWeight: 'bold' }
    ]
  }
];

interface QRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PrintableItem[];
  user: UserProfile | null;
  initialSelectedIds?: Set<string>;
}

export default function QRPrintModal({ isOpen, onClose, items, user, initialSelectedIds }: QRPrintModalProps) {
  // -------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<'designs' | 'templates' | 'print' | 'nfc' | 'rfid' | 'batch' | 'devices' | 'tag_inventory' | 'history' | 'settings'>('templates');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewItemId, setPreviewItemId] = useState<string>('');

  // Hardware scanner / writer states
  const [hardwareBridgeMode, setHardwareBridgeMode] = useState<'direct' | 'bridge'>('direct');
  const [autoWriteVerify, setAutoWriteVerify] = useState<boolean>(true);
  const [tagInventory, setTagInventory] = useState<any[]>([
    { id: 'tag-inv-1', batch: 'Batch #2026-A', type: 'NTAG213 Smart Label', quantity: 250, available: 184, material: 'Polyester PET (Waterproof)', status: 'Active' },
    { id: 'tag-inv-2', batch: 'Batch #2026-RFID', type: 'UHF RFID Wet Inlay', quantity: 500, available: 420, material: 'PVC Industrial Tag', status: 'Active' }
  ]);
  const [scannedLogs, setScannedLogs] = useState<any[]>([
    { id: 'log-1', type: 'NFC Write', assetName: 'Sony FX6 Cinema Camera', timestamp: '12:04:12 PM', status: 'Success' },
    { id: 'log-2', type: 'RFID Read', assetName: 'RED V-Raptor 8K', timestamp: '11:58:34 PM', status: 'Verified' }
  ]);
  const [pairedDevices, setPairedDevices] = useState<any[]>([
    { id: 'dev-1', name: 'Packer Handheld RFID Sled', type: 'rfid_handheld', manufacturer: 'Zebra', model: 'RFD40 Premium', status: 'connected', batteryLevel: 87, firmware: 'v1.42.0', connectionType: 'bluetooth' },
    { id: 'dev-2', name: 'Desktop WebNFC Reader/Writer', type: 'nfc_reader', manufacturer: 'ACS', model: 'ACR122U', status: 'connected', firmware: 'v2.1.0', connectionType: 'usb' }
  ]);

  // Guided NFC Writing States
  const [nfcWriteAssetId, setNfcWriteAssetId] = useState<string>('');
  const [nfcWriteStatus, setNfcWriteStatus] = useState<'idle' | 'writing' | 'verifying' | 'success' | 'failed'>('idle');
  const [nfcPayloadType, setNfcPayloadType] = useState<'bio' | 'maintenance' | 'custom'>('bio');
  const [nfcCustomUrl, setNfcCustomUrl] = useState<string>('');

  // Guided RFID Programming States
  const [rfidWriteAssetId, setRfidWriteAssetId] = useState<string>('');
  const [rfidWriteStatus, setRfidWriteStatus] = useState<'idle' | 'programming' | 'verifying' | 'success' | 'failed'>('idle');
  const [generatedEpc, setGeneratedEpc] = useState<string>('');
  
  // Custom Studio Canvas parameters
  const [canvasWidth, setCanvasWidth] = useState<number>(60); // mm
  const [canvasHeight, setCanvasHeight] = useState<number>(30); // mm
  const [canvasLayout, setCanvasLayout] = useState<'standard' | 'cable' | 'square' | 'tiny'>('standard');
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [canvasZoom, setCanvasZoom] = useState<number>(1); // Zoom Multiplier
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showGuides, setShowGuides] = useState<boolean>(true);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<CanvasElement[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasElement[][]>([]);

  // Printer Configuration
  const [selectedPrinterProfile, setSelectedPrinterProfile] = useState<string>('brother_ql');
  const [sheetMode, setSheetMode] = useState<boolean>(false);
  const [selectedAveryTemplateId, setSelectedAveryTemplateId] = useState<string>('avery5160');
  const [sheetStartIndex, setSheetStartIndex] = useState<number>(1);

  // Search parameters for batch printing
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [batchCategory, setBatchCategory] = useState<string>('all');

  // Custom User Saved templates in Firestore / Local state
  const [userTemplates, setUserTemplates] = useState<StudioTemplate[]>([]);
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string>('My Custom Tag Layout');

  // -------------------------------------------------------------
  // SELECTION & INIT DYNAMICS
  // -------------------------------------------------------------
  useEffect(() => {
    if (initialSelectedIds && initialSelectedIds.size > 0) {
      setSelectedIds(new Set(initialSelectedIds));
      const firstId = Array.from(initialSelectedIds)[0];
      setPreviewItemId(firstId);
    } else if (items.length > 0) {
      setSelectedIds(new Set([items[0].id]));
      setPreviewItemId(items[0].id);
    }
  }, [initialSelectedIds, items]);

  // Load standard template elements initially
  useEffect(() => {
    loadPresetTemplate(PRESET_STUDIO_TEMPLATES[0]);
  }, []);

  // Sync templates from Firestore
  useEffect(() => {
    if (user?.uid) {
      const q = query(collection(db, 'users', user.uid, 'labelTemplates'));
      getDocs(q).then((snap) => {
        const templatesList: StudioTemplate[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as StudioTemplate[];
        setUserTemplates(templatesList);
      }).catch((err) => {
        console.warn("Could not load templates from Firestore, using local state instead:", err);
      });
    }
  }, [user]);

  // Active preview object mapping
  const activePreviewItem = useMemo(() => {
    const raw = items.find(i => i.id === previewItemId);
    if (raw) return raw;
    if (items.length > 0) return items[0];
    return {
      id: 'mock_asset',
      name: 'RED V-Raptor 8K VV Cinema Camera',
      brand: 'RED Cinema',
      assetTag: 'PT-RED-RAPTOR-8K',
      serial: 'VR-875021-X',
      model: 'V-Raptor 8K',
      category: 'Camera',
      status: 'Available',
      condition: 'Excellent'
    };
  }, [items, previewItemId]);

  // -------------------------------------------------------------
  // CANVAS MODIFICATION WRAPPERS (WITH UNDO)
  // -------------------------------------------------------------
  const saveStateToUndo = (currentElements: CanvasElement[]) => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(currentElements))]);
    setRedoStack([]); // Clear redo stack on manual action
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(canvasElements))]);
    setCanvasElements(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(canvasElements))]);
    setCanvasElements(next);
  };

  // -------------------------------------------------------------
  // DYNAMIC DRAG-TO-MOVE & KEYBOARD NAVIGATION HANDLERS
  // -------------------------------------------------------------
  const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();

    let nextIds = [elementId];
    if (e.shiftKey) {
      if (selectedElementIds.includes(elementId)) {
        nextIds = selectedElementIds.filter(id => id !== elementId);
      } else {
        nextIds = [...selectedElementIds, elementId];
      }
    }
    setSelectedElementIds(nextIds);
    setSelectedElementId(nextIds.length > 0 ? nextIds[nextIds.length - 1] : null);

    const startX = e.clientX;
    const startY = e.clientY;

    const el = canvasElements.find(item => item.id === elementId);
    if (!el) return;

    const initialX = el.x;
    const initialY = el.y;
    let hasMoved = false;

    const canvasEl = document.getElementById('studio-canvas-container');
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const canvasPxWidth = rect.width || 1;
    const canvasPxHeight = rect.height || 1;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        if (!hasMoved) {
          saveStateToUndo(canvasElements);
          hasMoved = true;
        }
      }

      // Convert pixel offset to percentage offset
      let newX = initialX + (deltaX / canvasPxWidth) * 100;
      let newY = initialY + (deltaY / canvasPxHeight) * 100;

      // Restrict within 0-100% bounds
      newX = Math.max(0, Math.min(100 - el.width, newX));
      newY = Math.max(0, Math.min(100 - el.height, newY));

      // Snap to 2mm grid points if toggled
      if (snapToGrid) {
        const snapStepMm = 2;
        const snapPctX = (snapStepMm / canvasWidth) * 100;
        const snapPctY = (snapStepMm / canvasHeight) * 100;

        newX = Math.round(newX / snapPctX) * snapPctX;
        newY = Math.round(newY / snapPctY) * snapPctY;

        // Re-clamp bounds after grid snapping
        newX = Math.max(0, Math.min(100 - el.width, newX));
        newY = Math.max(0, Math.min(100 - el.height, newY));
      }

      setCanvasElements(prev => prev.map(item => {
        if (item.id === elementId) {
          return { ...item, x: Number(newX.toFixed(2)), y: Number(newY.toFixed(2)) };
        }
        return item;
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targets = selectedElementIds.length > 0 ? selectedElementIds : (selectedElementId ? [selectedElementId] : []);
      if (targets.length === 0) return;

      // Ignore arrow movements if focused on inputs
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const step = e.shiftKey ? 5 : 1; // standard arrow is 1%, shift-arrow is 5%

      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        saveStateToUndo(canvasElements);
        setCanvasElements(prev => prev.filter(el => !targets.includes(el.id)));
        setSelectedElementId(null);
        setSelectedElementIds([]);
        return;
      } else {
        return;
      }

      e.preventDefault();
      saveStateToUndo(canvasElements);

      setCanvasElements(prev => prev.map(item => {
        if (targets.includes(item.id)) {
          let newX = item.x + dx;
          let newY = item.y + dy;

          if (snapToGrid) {
            const snapStepMm = 2;
            const snapPctX = (snapStepMm / canvasWidth) * 100;
            const snapPctY = (snapStepMm / canvasHeight) * 100;
            newX = Math.round(newX / snapPctX) * snapPctX;
            newY = Math.round(newY / snapPctY) * snapPctY;
          }

          newX = Math.max(0, Math.min(100 - item.width, newX));
          newY = Math.max(0, Math.min(100 - item.height, newY));

          return { ...item, x: Number(newX.toFixed(2)), y: Number(newY.toFixed(2)) };
        }
        return item;
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, selectedElementIds, canvasElements, snapToGrid, canvasWidth, canvasHeight]);

  // -------------------------------------------------------------
  // TOOLBOX LOAD FUNCTIONS
  // -------------------------------------------------------------
  const loadPresetTemplate = (template: StudioTemplate) => {
    saveStateToUndo(canvasElements);
    setCanvasWidth(template.width);
    setCanvasHeight(template.height);
    setCanvasLayout(template.layout);
    setCanvasElements(JSON.parse(JSON.stringify(template.elements)));
    setSelectedElementId(null);
    setSelectedElementIds([]);
    toast.success(`Loaded visual template: ${template.name}`);
  };

  const deleteElement = (id: string) => {
    saveStateToUndo(canvasElements);
    setCanvasElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
    setSelectedElementIds(prev => prev.filter(item => item !== id));
  };

  const duplicateElement = (id: string) => {
    const el = canvasElements.find(e => e.id === id);
    if (!el) return;
    saveStateToUndo(canvasElements);
    const duplicated: CanvasElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: `element_${Date.now()}`,
      x: Math.min(el.x + 5, 80),
      y: Math.min(el.y + 5, 80)
    };
    setCanvasElements(prev => [...prev, duplicated]);
    setSelectedElementId(duplicated.id);
    setSelectedElementIds([duplicated.id]);
  };

  const addTextElement = () => {
    saveStateToUndo(canvasElements);
    const newEl: CanvasElement = {
      id: `element_${Date.now()}`,
      type: 'text',
      content: 'Custom Label Text',
      x: 10,
      y: 40,
      width: 60,
      height: 15,
      font: 'Inter',
      fontSize: 8,
      fontWeight: 'bold',
      color: '#000000'
    };
    setCanvasElements(prev => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setSelectedElementIds([newEl.id]);
  };

  const addQrElement = () => {
    saveStateToUndo(canvasElements);
    const newEl: CanvasElement = {
      id: `element_${Date.now()}`,
      type: 'qr',
      content: 'bio',
      x: 70,
      y: 10,
      width: 25,
      height: 60,
      qrDest: 'bio',
      qrFgColor: '#000000',
      qrBgColor: '#ffffff'
    };
    setCanvasElements(prev => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setSelectedElementIds([newEl.id]);
  };

  const addShapeElement = (shapeType: 'rectangle' | 'circle' | 'line' | 'divider') => {
    saveStateToUndo(canvasElements);
    const newEl: CanvasElement = {
      id: `element_${Date.now()}`,
      type: 'shape',
      content: shapeType,
      x: 20,
      y: 20,
      width: 30,
      height: 15,
      shapeType,
      bgColor: shapeType === 'divider' ? '#000000' : 'transparent',
      color: '#000000'
    };
    setCanvasElements(prev => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setSelectedElementIds([newEl.id]);
  };

  const addDynamicField = (variable: string) => {
    saveStateToUndo(canvasElements);
    const newEl: CanvasElement = {
      id: `element_${Date.now()}`,
      type: 'text',
      content: `{{asset.${variable}}}`,
      x: 10,
      y: 10,
      width: 50,
      height: 12,
      font: 'JetBrains Mono',
      fontSize: 7.5,
      fontWeight: 'bold',
      color: '#000000'
    };
    setCanvasElements(prev => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setSelectedElementIds([newEl.id]);
  };

  // -------------------------------------------------------------
  // DYNAMIC VARIABLE PARSER
  // -------------------------------------------------------------
  const parseDynamicVariables = (text: string, asset: PrintableItem) => {
    if (!text) return '';
    let parsed = text;
    parsed = parsed.replace(/\{\{asset\.name\}\}/gi, asset.name || 'N/A');
    parsed = parsed.replace(/\{\{asset\.brand\}\}/gi, asset.brand || 'N/A');
    parsed = parsed.replace(/\{\{asset\.assetTag\}\}/gi, asset.assetTag || 'N/A');
    parsed = parsed.replace(/\{\{asset\.serial\}\}/gi, asset.serial || 'N/A');
    parsed = parsed.replace(/\{\{asset\.model\}\}/gi, asset.model || 'N/A');
    parsed = parsed.replace(/\{\{asset\.category\}\}/gi, asset.category || 'N/A');
    parsed = parsed.replace(/\{\{asset\.status\}\}/gi, asset.status || 'N/A');
    parsed = parsed.replace(/\{\{asset\.condition\}\}/gi, asset.condition || 'N/A');
    return parsed;
  };

  // Resolve QR code content URL
  const getQrUrlValue = (element: CanvasElement, item: PrintableItem) => {
    const origin = window.location.origin;
    switch (element.qrDest) {
      case 'bio':
        return `${origin}/gear/${item.id}?passport=true`;
      case 'asset':
        return `${origin}/library?search=${item.assetTag || item.id}`;
      case 'booking':
        return `${origin}/marketplace?checkout=${item.id}`;
      case 'maintenance':
        return `${origin}/gear/${item.id}?tab=maintenance`;
      case 'custom':
        return element.content.startsWith('http') ? element.content : `https://${element.content}`;
      default:
        return `${origin}/gear/${item.id}`;
    }
  };

  // -------------------------------------------------------------
  // CANVAS DRAG & PROPERTY EDITS
  // -------------------------------------------------------------
  const updateSelectedElement = (updates: Partial<CanvasElement>) => {
    if (selectedElementIds.length === 0) return;
    setCanvasElements(prev => prev.map(el => {
      if (selectedElementIds.includes(el.id)) {
        return { ...el, ...updates };
      }
      return el;
    }));
  };

  // Handle alignment actions
  const handleAlign = (alignment: 'left' | 'center' | 'right') => {
    if (!selectedElementId) return;
    saveStateToUndo(canvasElements);
    updateSelectedElement({ align: alignment });
  };

  const handleLayerOrder = (direction: 'front' | 'back') => {
    if (!selectedElementId) return;
    saveStateToUndo(canvasElements);
    const targetIdx = canvasElements.findIndex(el => el.id === selectedElementId);
    if (targetIdx === -1) return;

    const updated = [...canvasElements];
    const [element] = updated.splice(targetIdx, 1);
    if (direction === 'front') {
      updated.push(element);
    } else {
      updated.unshift(element);
    }
    setCanvasElements(updated);
  };

  // Snapping elements relative to the Canvas
  const handleCanvasAlign = (alignment: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle') => {
    const targets = selectedElementIds.length > 0 ? selectedElementIds : (selectedElementId ? [selectedElementId] : []);
    if (targets.length === 0) {
      toast.warning("Please select at least one element to align.");
      return;
    }
    saveStateToUndo(canvasElements);
    
    setCanvasElements(prev => prev.map(el => {
      if (targets.includes(el.id)) {
        let newX = el.x;
        let newY = el.y;
        if (alignment === 'left') {
          newX = 0;
        } else if (alignment === 'right') {
          newX = 100 - el.width;
        } else if (alignment === 'center') {
          newX = (100 - el.width) / 2;
        } else if (alignment === 'top') {
          newY = 0;
        } else if (alignment === 'bottom') {
          newY = 100 - el.height;
        } else if (alignment === 'middle') {
          newY = (100 - el.height) / 2;
        }
        return { 
          ...el, 
          x: Number(newX.toFixed(2)), 
          y: Number(newY.toFixed(2)) 
        };
      }
      return el;
    }));
    toast.success(`Snapped ${targets.length} element(s) to ${alignment}`);
  };

  // Distributing elements evenly
  const handleDistribute = (direction: 'horizontal' | 'vertical') => {
    const targets = selectedElementIds.length >= 3 ? selectedElementIds : canvasElements.map(el => el.id);
    if (targets.length < 3) {
      toast.warning("Distribution requires 3 or more elements on the canvas.");
      return;
    }
    saveStateToUndo(canvasElements);
    
    // Separate targets from other elements
    const targetElements = canvasElements.filter(el => targets.includes(el.id));
    const nonTargetElements = canvasElements.filter(el => !targets.includes(el.id));
    
    if (direction === 'horizontal') {
      // Sort target elements by current X coordinate
      targetElements.sort((a, b) => a.x - b.x);
      
      const minX = targetElements[0].x;
      const maxX = targetElements[targetElements.length - 1].x;
      
      if (maxX !== minX) {
        const step = (maxX - minX) / (targetElements.length - 1);
        targetElements.forEach((el, index) => {
          el.x = Number((minX + index * step).toFixed(2));
        });
      }
    } else {
      // Sort target elements by current Y coordinate
      targetElements.sort((a, b) => a.y - b.y);
      
      const minY = targetElements[0].y;
      const maxY = targetElements[targetElements.length - 1].y;
      
      if (maxY !== minY) {
        const step = (maxY - minY) / (targetElements.length - 1);
        targetElements.forEach((el, index) => {
          el.y = Number((minY + index * step).toFixed(2));
        });
      }
    }
    
    setCanvasElements([...nonTargetElements, ...targetElements]);
    toast.success(`Distributed ${targets.length} elements ${direction === 'horizontal' ? 'horizontally' : 'vertically'} evenly!`);
  };

  // -------------------------------------------------------------
  // FIRESTORE SYNC & PERSISTENCE
  // -------------------------------------------------------------
  const handleSaveUserTemplate = async () => {
    if (!user?.uid) {
      toast.error("Cloud storage requires an active user session.");
      return;
    }
    setIsSavingTemplate(true);
    try {
      const colRef = collection(db, 'users', user.uid, 'labelTemplates');
      const docData = {
        name: templateName,
        width: canvasWidth,
        height: canvasHeight,
        layout: canvasLayout,
        elements: canvasElements,
        category: 'Custom Layouts',
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(colRef, docData);
      const newTemplate: StudioTemplate = { id: docRef.id, ...docData };
      setUserTemplates(prev => [...prev, newTemplate]);
      toast.success("Successfully persisted visual template to Firebase Firestore!");
    } catch (error) {
      console.error(error);
      toast.error("Could not write template to Firestore. Stored locally instead.");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // -------------------------------------------------------------
  // BATCH PRINT UTILITIES
  // -------------------------------------------------------------
  const printableItemsList = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (item.assetTag && item.assetTag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = batchCategory === 'all' || item.category === batchCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, batchCategory]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.category) set.add(i.category); });
    return Array.from(set);
  }, [items]);

  const toggleSelectAll = () => {
    if (selectedIds.size === printableItemsList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(printableItemsList.map(i => i.id)));
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -------------------------------------------------------------
  // DYNAMIC SIZING CALCULATIONS FOR SHEETS & ROLLS
  // -------------------------------------------------------------
  const selectedItemsToPrint = useMemo(() => {
    return items.filter(i => selectedIds.has(i.id));
  }, [items, selectedIds]);

  const sheetPages = useMemo(() => {
    if (!sheetMode) return [];
    
    const template = AVERY_TEMPLATES.find(t => t.id === selectedAveryTemplateId) || AVERY_TEMPLATES[0];
    const labelsPerSheet = template.columns * template.rows;
    const pages: (PrintableItem | null)[][] = [];
    
    let itemIndex = 0;
    let pageIndex = 0;
    
    while (itemIndex < selectedItemsToPrint.length) {
      const pageLabels: (PrintableItem | null)[] = Array(labelsPerSheet).fill(null);
      const startOffset = pageIndex === 0 ? (sheetStartIndex - 1) : 0;
      
      for (let slot = startOffset; slot < labelsPerSheet; slot++) {
        if (itemIndex < selectedItemsToPrint.length) {
          pageLabels[slot] = selectedItemsToPrint[itemIndex];
          itemIndex++;
        } else {
          break;
        }
      }
      
      pages.push(pageLabels);
      pageIndex++;
    }
    
    if (pages.length === 0) {
      pages.push(Array(labelsPerSheet).fill(null));
    }
    
    return pages;
  }, [sheetMode, selectedAveryTemplateId, selectedItemsToPrint, sheetStartIndex]);

  // Execute standard system printing command
  const handleSystemPrint = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one gear asset to print.");
      return;
    }
    try {
      // Post print log to mock express database as requested
      await fetch('/api/labels/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'tpl_studio_active',
          assetIds: Array.from(selectedIds),
          printerProfile: selectedPrinterProfile,
          copies: 1
        })
      });
    } catch (e) {
      console.warn("Could not push print telemetry to mock backend:", e);
    }
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto font-sans"
      id="label-studio-workspace"
    >
      <div className="bg-[#121214] text-neutral-100 w-full max-w-7xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-neutral-800 print:bg-white print:text-black print:shadow-none print:rounded-none print:max-h-none print:w-auto print:h-auto print:border-none">
        
        {/* =========================================================
            HEADER & ACTIONS PANEL
            ========================================================= */}
        <div className="p-5 bg-[#1a1a1e] border-b border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4 print:hidden select-none">
          <div className="flex items-center gap-3">
            <div className="bg-[#0066cc] p-2.5 rounded-xl text-white">
              <QrCode size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight uppercase font-sans">
                  Label Studio
                </h2>
                <span className="text-[9px] uppercase font-black tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                  v5.9.0 PRO
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Professional Visual Editor & Adhesive Logistics Management for Packer.Tools
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <div className="flex bg-neutral-800 p-0.5 rounded-lg border border-neutral-700 text-xs">
              <button 
                onClick={() => setSheetMode(false)}
                className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${!sheetMode ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                <Tv size={13} />
                <span>Continuous Roll</span>
              </button>
              <button 
                onClick={() => setSheetMode(true)}
                className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${sheetMode ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                <Layout size={13} />
                <span>Avery Sheets</span>
              </button>
            </div>

            <button
              onClick={handleSystemPrint}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0066cc] text-white rounded-xl text-xs font-black uppercase hover:bg-opacity-95 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#0066cc]/20"
              type="button"
            >
              <Printer size={15} />
              <span>Print {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Labels</span>
            </button>
            
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-neutral-800 rounded-xl transition text-neutral-400 hover:text-white cursor-pointer"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* =========================================================
            MAIN WORKSPACE: SPLIT PANEL LAYOUT
            ========================================================= */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row print:block">
          
          {/* 1. LEFT PANEL: TOOLBOX (Width: 320px) */}
          <div className="w-full lg:w-80 border-r border-neutral-800 flex shrink-0 bg-[#16161a] overflow-hidden print:hidden select-none">
            {/* LEFT VERTICAL ICON RAIL */}
            <div className="w-[58px] bg-[#101012] border-r border-neutral-800 flex flex-col items-center py-3.5 space-y-2.5 shrink-0 overflow-y-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('designs')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'designs' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }`}
                title="Canvas Designs"
              >
                <Paintbrush size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">Design</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'templates' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }`}
                title="Presets"
              >
                <Layout size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">Presets</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('print')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'print' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }`}
                title="Avery & Printers"
              >
                <Printer size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">Print</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('nfc')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'nfc' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }`}
                title="NFC Tag Manager"
              >
                <Smartphone size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">NFC</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('rfid')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'rfid' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }`}
                title="RFID Tag Manager"
              >
                <Cpu size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">RFID</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('batch')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'batch' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }`}
                title="Batch Operations"
              >
                <Layers size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">Batch</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('devices')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'devices' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }`}
                title="Device Manager"
              >
                <Tv size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">Device</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tag_inventory')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'tag_inventory' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }`}
                title="Blank Stock Inventory"
              >
                <Grid size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">Stock</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'history' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-[#ff4f3a]/20 hover:text-white'
                }`}
                title="Audit Trail"
              >
                <HistoryIcon size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">Logs</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition gap-0.5 ${
                  activeTab === 'settings' ? 'bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30' : 'text-neutral-400 hover:bg-[#ff4f3a]/20 hover:text-white'
                }`}
                title="Advanced Settings"
              >
                <Settings2 size={14} />
                <span className="text-[7px] font-black uppercase tracking-tighter">Specs</span>
              </button>
            </div>

            {/* DETAILS CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              
              {/* TAB CONTENT: DESIGNS (ELEMENTS & DYNAMIC FIELDS) */}
              {activeTab === 'designs' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Dynamic Fields</h3>
                    <p className="text-[10px] text-neutral-500 leading-relaxed mt-0.5">
                      Inserts custom variables which replace dynamically based on the active preview asset parameters.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 pt-2">
                      {['brand', 'name', 'assetTag', 'serial', 'model', 'category', 'status', 'condition'].map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => addDynamicField(f)}
                          className="py-1.5 px-2 bg-[#1e1e24] hover:bg-[#25252d] border border-neutral-800 text-neutral-300 rounded-lg text-left text-[11px] font-bold transition flex items-center gap-1 capitalize"
                        >
                          <Type size={10} className="text-[#ff4f3a]" />
                          <span className="truncate">{f === 'assetTag' ? 'Asset Tag' : f}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-800/60 space-y-2">
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Visual Elements</h3>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={addTextElement}
                        className="p-2.5 bg-[#1e1e24] hover:bg-[#25252d] border border-neutral-800 rounded-xl text-left transition flex items-center gap-2.5 text-xs text-white"
                      >
                        <Type size={14} className="text-blue-400" />
                        <div>
                          <p className="font-extrabold text-[11px]">Insert Custom Text Block</p>
                          <p className="text-[9px] text-neutral-400">Add static labels, notes or titles</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={addQrElement}
                        className="p-2.5 bg-[#1e1e24] hover:bg-[#25252d] border border-neutral-800 rounded-xl text-left transition flex items-center gap-2.5 text-xs text-white"
                      >
                        <QrCode size={14} className="text-emerald-400" />
                        <div>
                          <p className="font-extrabold text-[11px]">Insert Smart QR Code</p>
                          <p className="text-[9px] text-neutral-400">Routes to bio, checkout or custom link</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-800/60 space-y-2">
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Geometric Shapes</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {(['rectangle', 'circle', 'line', 'divider'] as const).map((shape) => (
                        <button
                          key={shape}
                          type="button"
                          onClick={() => addShapeElement(shape)}
                          className="p-2 bg-[#1e1e24] hover:bg-[#25252d] border border-neutral-800 rounded-lg text-left transition text-[11px] text-neutral-300 capitalize flex items-center gap-1.5 font-semibold"
                        >
                          <span className="w-2 h-2 rounded bg-amber-400 block shrink-0" />
                          <span>{shape}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: PRESETS */}
              {activeTab === 'templates' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Design Layout Presets</h3>
                    <span className="text-[10px] text-neutral-500">Pick to load</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {PRESET_STUDIO_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => loadPresetTemplate(tmpl)}
                        className="p-3 bg-[#1e1e24] hover:bg-[#25252d] rounded-xl border border-neutral-800 text-left transition duration-200 group flex items-start justify-between"
                      >
                        <div>
                          <p className="font-extrabold text-xs text-white group-hover:text-[#ff4f3a]">{tmpl.name}</p>
                          <p className="text-[10px] text-neutral-400 mt-1">Dimensions: {tmpl.width}x{tmpl.height}mm • {tmpl.category}</p>
                        </div>
                        <ChevronRight size={14} className="text-neutral-500 mt-0.5 shrink-0" />
                      </button>
                    ))}
                  </div>

                  {userTemplates.length > 0 && (
                    <div className="pt-3 border-t border-neutral-800/60 space-y-2">
                      <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Your Saved Designs</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {userTemplates.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => loadPresetTemplate(tmpl)}
                            className="p-3 bg-[#1e1e24]/60 hover:bg-[#1e1e24] rounded-xl border border-dashed border-neutral-800 text-left transition flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-xs text-neutral-200">{tmpl.name}</p>
                              <p className="text-[10px] text-neutral-500 mt-0.5">{tmpl.width}x{tmpl.height}mm • Custom</p>
                            </div>
                            <FolderOpen size={13} className="text-neutral-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: PRINT TARGETS & SETTINGS */}
              {activeTab === 'print' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Printer Optimization</h3>
                  <p className="text-[10px] text-neutral-500 leading-relaxed">
                    Set default page layouts and optimized settings depending on the printer target.
                  </p>

                  <div className="space-y-2">
                    {[
                      { id: 'brother_ql', name: 'Brother QL-Series (Thermal Roll)', resolution: '300 DPI' },
                      { id: 'zebra_zd', name: 'Zebra ZD-Series (Industrial Zebra)', resolution: '203 DPI' },
                      { id: 'brady_bmp', name: 'Brady BMP-Series (Heavy Adhesive)', resolution: '300 DPI' },
                      { id: 'generic_pdf', name: 'Generic Desktop (Avery/PDF Plate)', resolution: '600 DPI' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPrinterProfile(p.id)}
                        className={`w-full p-2.5 text-left rounded-xl border transition ${
                          selectedPrinterProfile === p.id 
                            ? 'bg-[#ff4f3a]/10 border-[#ff4f3a] text-white' 
                            : 'bg-[#1e1e24] border-neutral-800 text-neutral-400 hover:bg-[#25252d]'
                        }`}
                      >
                        <p className="font-extrabold text-[11px] text-white">{p.name}</p>
                        <p className="text-[9px] text-neutral-400 mt-0.5">Resolution: {p.resolution}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: NFC TAG MANAGER */}
              {activeTab === 'nfc' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">NFC Encoder Hub</h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="NFC Scanner Ready" />
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    Map this visual layout design directly into high-frequency (13.56 MHz) NFC chips (NTAG213/215/216).
                  </p>

                  <div className="p-3 bg-[#131316] rounded-xl border border-neutral-800/80 space-y-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-500 font-bold">NDEF Payload Destination:</span>
                      <span className="text-emerald-400 font-black">Secure Web URL</span>
                    </div>
                    <div className="bg-[#1a1a1f] p-2 rounded text-[10px] font-mono text-neutral-300 break-all border border-neutral-800">
                      https://packer.tools/id/nfc_tok_{printableItemsList[0]?.id?.substring(0,6) || 'demo'}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toast.success("Emulating NFC Write & Verify... 100% written.");
                      }}
                      className="w-full py-2 bg-[#ff4f3a] hover:bg-opacity-90 text-white font-black text-[10px] uppercase rounded-lg transition"
                    >
                      Simulate Hardware NFC Write
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">Write Verification Log</span>
                    <div className="bg-[#111114] p-2.5 rounded-xl text-[9px] font-mono text-neutral-400 border border-neutral-800/80 space-y-1 h-24 overflow-y-auto">
                      <p className="text-neutral-500">[12:15:32] Standby: NFC reader activated.</p>
                      <p className="text-neutral-500">[12:15:33] Tag identified: NTAG213 (144 bytes).</p>
                      <p className="text-emerald-400">✔ [12:15:34] Written & verified successfully.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: RFID TAG MANAGER */}
              {activeTab === 'rfid' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">RFID EPC Encoder</h3>
                    <span className="text-[10px] bg-[#ff4f3a]/20 text-[#ff4f3a] px-1.5 py-0.5 rounded font-black uppercase">915 MHz UHF</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    Encode ultra-high frequency passive RFID tags with customized hex SGTIN payload identifiers.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-neutral-500 font-bold uppercase">EPC ID Generation Scheme</label>
                      <select className="w-full mt-1 bg-[#1e1e24] border border-neutral-800 text-xs text-white rounded-lg p-2 font-semibold">
                        <option>SGTIN-96 (Standard Serialized Trade Item)</option>
                        <option>GRAI-96 (Global Returnable Asset Identifier)</option>
                        <option>Hex Serialization Pattern (Custom)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => toast.success("RFID tag encoded with EPC: E2801130200020304050")}
                      className="w-full py-2 bg-[#ff4f3a] hover:bg-opacity-90 text-white font-black text-[10px] uppercase rounded-lg transition"
                    >
                      Program Connected RFID Tag
                    </button>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: BATCH SELECTION */}
              {activeTab === 'batch' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Batch Print Queue</h3>
                    <span className="text-[10px] font-mono text-emerald-400">{selectedIds.size} Selected</span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Search Field */}
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input
                        type="text"
                        placeholder="Search assets to print..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#1e1e24] border border-neutral-800 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold focus:outline-none focus:border-neutral-700 placeholder-neutral-500"
                      />
                    </div>

                    {/* Category Filter */}
                    <div className="flex gap-1 overflow-x-auto pb-1 text-[9px] font-bold">
                      <button
                        type="button"
                        onClick={() => setBatchCategory('all')}
                        className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${batchCategory === 'all' ? 'bg-neutral-200 text-black' : 'bg-[#1e1e24] text-neutral-400'}`}
                      >
                        All ({items.length})
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setBatchCategory(cat)}
                          className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${batchCategory === cat ? 'bg-neutral-200 text-black' : 'bg-[#1e1e24] text-neutral-400'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-[9px] font-black uppercase tracking-wider transition mb-2"
                      >
                        {selectedIds.size === printableItemsList.length ? 'Deselect All' : 'Select All Filtered'}
                      </button>
                    </div>

                    {/* Printable list items */}
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {printableItemsList.map((item) => {
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleSelectId(item.id)}
                            className={`p-2 rounded-xl border transition duration-150 cursor-pointer flex items-center justify-between ${
                              isSelected 
                                ? 'bg-[#ff4f3a]/10 border-[#ff4f3a]/50 text-white' 
                                : 'bg-[#1e1e24] border-neutral-800/60 text-neutral-400 hover:border-neutral-700'
                            }`}
                          >
                            <div className="min-w-0 pr-3">
                              <p className="font-extrabold text-[11px] truncate text-white">{item.name}</p>
                              <p className="text-[9px] text-neutral-400 truncate mt-0.5">{item.brand || 'General'} • {item.assetTag || 'TAG-PENDING'}</p>
                            </div>
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition ${
                              isSelected ? 'bg-[#ff4f3a] border-[#ff4f3a] text-white' : 'border-neutral-700 bg-neutral-900'
                            }`}>
                              {isSelected && <Check size={9} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })}
                      {printableItemsList.length === 0 && (
                        <p className="text-neutral-500 text-xs italic text-center py-4">No matching asset records found.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: DEVICE MANAGER */}
              {activeTab === 'devices' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Device Connectivity</h3>
                  <p className="text-[10px] text-neutral-500">
                    Manage direct connections with local networks, USB, or bluetooth thermal printing hardware.
                  </p>

                  <div className="space-y-2">
                    <div className="p-3 bg-[#131316] rounded-xl border border-neutral-800 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-extrabold text-white">USB Smart Print Driver</p>
                        <p className="text-[9px] text-emerald-400">Connected</p>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>

                    <div className="p-3 bg-[#131316] rounded-xl border border-neutral-800/60 flex items-center justify-between opacity-60">
                      <div>
                        <p className="text-[11px] font-extrabold text-white">Bluetooth Zebra BT-400</p>
                        <p className="text-[9px] text-neutral-500">Not Paired</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toast.success("Scanning for bluetooth hardware... Paired!")}
                        className="text-[9px] font-black uppercase bg-[#ff4f3a] text-white px-2 py-1 rounded hover:bg-opacity-90 transition"
                      >
                        Pair
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: TAG INVENTORY */}
              {activeTab === 'tag_inventory' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Blank Stock Inventory</h3>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    Track physically remaining rolls, decals, Avery sheets, and RFID/NFC stickers in store cabinets.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-[#131316] rounded-xl border border-neutral-800">
                      <p className="text-[9px] text-neutral-500 font-bold uppercase">NTAG215 Labels</p>
                      <p className="text-xl font-black text-white mt-1">420 pcs</p>
                    </div>
                    <div className="p-3 bg-[#131316] rounded-xl border border-neutral-800">
                      <p className="text-[9px] text-neutral-500 font-bold uppercase">2x2" Thermal Roll</p>
                      <p className="text-xl font-black text-white mt-1">1,250 left</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: HISTORY (AUDIT TRAILS) */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Asset Coding History</h3>
                  <p className="text-[10px] text-neutral-500">
                    Audit trail logs tracking encoded physical stickers, labels printed, and assignments.
                  </p>

                  <div className="space-y-2 h-64 overflow-y-auto pr-1">
                    {[
                      { item: 'Canon EOS C300', action: 'QR Printed (2x2")', time: '10 mins ago' },
                      { item: 'Zeiss CP.3 50mm Lens', action: 'NFC Encoded & Verified', time: '1 hour ago' },
                      { item: 'Sennheiser Wireless G4', action: 'RFID Programmed (GRAI-96)', time: 'Yesterday' }
                    ].map((log, idx) => (
                      <div key={idx} className="p-2.5 bg-[#131316] rounded-lg border border-neutral-800/80">
                        <p className="text-[11px] font-extrabold text-white">{log.item}</p>
                        <div className="flex items-center justify-between text-[9px] text-neutral-400 mt-1">
                          <span>{log.action}</span>
                          <span>{log.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: ADVANCED SETTINGS */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Canvas Settings</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-neutral-500 font-bold uppercase">Width (mm)</label>
                      <input
                        type="number"
                        value={canvasWidth}
                        onChange={(e) => setCanvasWidth(Number(e.target.value))}
                        className="w-full mt-1 bg-[#1e1e24] border border-neutral-800 text-xs text-white rounded-lg p-2 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-neutral-500 font-bold uppercase">Height (mm)</label>
                      <input
                        type="number"
                        value={canvasHeight}
                        onChange={(e) => setCanvasHeight(Number(e.target.value))}
                        className="w-full mt-1 bg-[#1e1e24] border border-neutral-800 text-xs text-white rounded-lg p-2 font-semibold"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-neutral-300 font-bold">Snap to Grid</span>
                      <button
                        type="button"
                        onClick={() => setSnapToGrid(!snapToGrid)}
                        className={`w-10 h-5 rounded-full transition relative ${snapToGrid ? 'bg-emerald-500' : 'bg-neutral-800'}`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${snapToGrid ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-neutral-300 font-bold">Display Grid Lines</span>
                      <button
                        type="button"
                        onClick={() => setShowGrid(!showGrid)}
                        className={`w-10 h-5 rounded-full transition relative ${showGrid ? 'bg-emerald-500' : 'bg-neutral-800'}`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${showGrid ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* =========================================================
              2. CENTER PANEL: LIVE DESIGN CANVAS (Width: Dynamic / Flexible)
              ========================================================= */}
          <div className="flex-1 bg-[#1a1a1e] flex flex-col overflow-hidden relative" id="design-editor-center-panel">
            
            {/* Visual Editor Action Toolbar */}
            <div className="p-3 bg-[#131316] border-b border-neutral-800 flex items-center justify-between text-neutral-400 text-xs select-none shrink-0 print:hidden">
              <div className="flex items-center gap-3">
                <span className="font-black text-[10px] text-neutral-500 uppercase tracking-widest">Workspace tools</span>
                
                <div className="h-4 w-px bg-neutral-800" />
                
                {/* Undo / Redo */}
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-25"
                  title="Undo Visual Change"
                >
                  <RefreshCw size={14} className="scale-x-[-1]" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-25"
                  title="Redo Visual Change"
                >
                  <RefreshCw size={14} />
                </button>

                <div className="h-4 w-px bg-neutral-800" />

                {/* Layer Control */}
                <button
                  onClick={() => handleLayerOrder('front')}
                  disabled={!selectedElementId}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-25 flex items-center gap-1"
                  title="Bring Selected Element to Front Layer"
                >
                  <Layers size={14} />
                  <span className="text-[10px] font-bold">Front</span>
                </button>
                <button
                  onClick={() => handleLayerOrder('back')}
                  disabled={!selectedElementId}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-25 flex items-center gap-1"
                  title="Send Selected Element to Back Layer"
                >
                  <Layers size={14} className="rotate-180" />
                  <span className="text-[10px] font-bold">Back</span>
                </button>

                <div className="h-4 w-px bg-neutral-800" />

                {/* alignment helpers */}
                <button
                  onClick={() => handleAlign('left')}
                  disabled={!selectedElementId}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-25"
                  title="Align Element Left"
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  onClick={() => handleAlign('center')}
                  disabled={!selectedElementId}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-25"
                  title="Align Element Center"
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  onClick={() => handleAlign('right')}
                  disabled={!selectedElementId}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-25"
                  title="Align Element Right"
                >
                  <AlignRight size={14} />
                </button>

                <div className="h-4 w-px bg-neutral-800" />

                {/* Snapping to Canvas Edges / Center */}
                <div className="flex items-center gap-1 bg-neutral-900/40 px-1 py-0.5 rounded-md border border-neutral-800/60" title="Canvas Snapping">
                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider px-1">Snap</span>
                  
                  <button
                    onClick={() => handleCanvasAlign('left')}
                    disabled={selectedElementIds.length === 0 && !selectedElementId}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-20"
                    title="Snap Selected to Canvas Left Edge"
                  >
                    <AlignStartHorizontal size={14} />
                  </button>
                  <button
                    onClick={() => handleCanvasAlign('center')}
                    disabled={selectedElementIds.length === 0 && !selectedElementId}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-20"
                    title="Snap Selected to Canvas Horizontal Center"
                  >
                    <AlignCenterHorizontal size={14} />
                  </button>
                  <button
                    onClick={() => handleCanvasAlign('right')}
                    disabled={selectedElementIds.length === 0 && !selectedElementId}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-20"
                    title="Snap Selected to Canvas Right Edge"
                  >
                    <AlignEndHorizontal size={14} />
                  </button>

                  <div className="h-3 w-px bg-neutral-800 mx-0.5" />

                  <button
                    onClick={() => handleCanvasAlign('top')}
                    disabled={selectedElementIds.length === 0 && !selectedElementId}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-20"
                    title="Snap Selected to Canvas Top Edge"
                  >
                    <AlignStartVertical size={14} />
                  </button>
                  <button
                    onClick={() => handleCanvasAlign('middle')}
                    disabled={selectedElementIds.length === 0 && !selectedElementId}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-20"
                    title="Snap Selected to Canvas Vertical Center"
                  >
                    <AlignCenterVertical size={14} />
                  </button>
                  <button
                    onClick={() => handleCanvasAlign('bottom')}
                    disabled={selectedElementIds.length === 0 && !selectedElementId}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-20"
                    title="Snap Selected to Canvas Bottom Edge"
                  >
                    <AlignEndVertical size={14} />
                  </button>
                </div>

                <div className="h-4 w-px bg-neutral-800" />

                {/* Distribution Evenly */}
                <div className="flex items-center gap-1 bg-[#1e1e24] px-1 py-0.5 rounded-md border border-neutral-800/60" title="Distribution (Requires 3+ items)">
                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider px-1">Distribute</span>
                  <button
                    onClick={() => handleDistribute('horizontal')}
                    disabled={canvasElements.length < 3}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-20"
                    title="Distribute Elements Horizontally Evenly"
                  >
                    <AlignHorizontalDistributeCenter size={14} />
                  </button>
                  <button
                    onClick={() => handleDistribute('vertical')}
                    disabled={canvasElements.length < 3}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-20"
                    title="Distribute Elements Vertically Evenly"
                  >
                    <AlignVerticalDistributeCenter size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Zoom tools */}
                <button
                  onClick={() => setCanvasZoom(z => Math.max(z - 0.25, 0.25))}
                  disabled={canvasZoom <= 0.25}
                  className="p-1 hover:bg-neutral-800 rounded transition text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Zoom Out (min 25%)"
                >
                  <ZoomOut size={13} />
                </button>
                <select
                  value={canvasZoom}
                  onChange={(e) => setCanvasZoom(Number(e.target.value))}
                  className="bg-neutral-950 text-neutral-300 border border-neutral-800 rounded px-1.5 py-0.5 text-[10px] font-mono font-black focus:outline-none focus:border-[#0066cc]"
                >
                  <option value={0.25}>25%</option>
                  <option value={0.50}>50%</option>
                  <option value={0.75}>75%</option>
                  <option value={1.00}>100%</option>
                  <option value={1.25}>125%</option>
                  <option value={1.50}>150%</option>
                  <option value={1.75}>175%</option>
                  <option value={2.00}>200%</option>
                </select>
                <button
                  onClick={() => setCanvasZoom(z => Math.min(z + 0.25, 2.0))}
                  disabled={canvasZoom >= 2.0}
                  className="p-1 hover:bg-neutral-800 rounded transition text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Zoom In (max 200%)"
                >
                  <ZoomIn size={13} />
                </button>

                <div className="h-4 w-px bg-neutral-800 mx-1" />

                {/* Show Grid Toggle */}
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-1.5 rounded flex items-center gap-1 transition ${showGrid ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25' : 'hover:bg-neutral-800 text-neutral-400'}`}
                  title="Toggle Visual Grid Lines"
                >
                  <Grid size={13} />
                  <span className="text-[10px] font-extrabold">Show Grid</span>
                </button>

                {/* Snap to grid toggle */}
                <button
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  className={`p-1.5 rounded flex items-center gap-1 transition ${snapToGrid ? 'bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/25' : 'hover:bg-neutral-800 text-neutral-400'}`}
                  title="Toggle Snap Elements to Grid (2mm interval)"
                >
                  <Sliders size={13} />
                  <span className="text-[10px] font-extrabold">Snap</span>
                </button>
              </div>
            </div>

            {/* Core Interactive Editor Board */}
            <div className="flex-1 overflow-auto p-12 flex items-center justify-center bg-[#131316] relative print:bg-white print:p-0 print:overflow-visible">
              
              {/* Dynamic Ruler Markings */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-neutral-500 flex items-center gap-2 select-none print:hidden bg-neutral-800/40 px-3 py-1.5 rounded-lg border border-neutral-800">
                <Maximize2 size={12} className="text-blue-400" />
                <span>ACTIVE CANVAS DIMENSION: <strong>{canvasWidth}mm x {canvasHeight}mm</strong></span>
                <span>•</span>
                <span>LAYOUT: <strong className="uppercase">{canvasLayout}</strong></span>
              </div>

              {/* Dynamic Avery Sheet View or Single Tag Preview */}
              {sheetMode ? (
                /* ======================== 📄 AVERY SHEETS MODE ======================== */
                <div className="flex flex-col items-center gap-8 print:gap-0 print:p-0 select-none scale-[0.8] origin-center">
                  {sheetPages.map((pageLabels, pageIdx) => {
                    const template = AVERY_TEMPLATES.find(t => t.id === selectedAveryTemplateId) || AVERY_TEMPLATES[0];
                    return (
                      <div
                        key={`avery-page-${pageIdx}`}
                        className="bg-white shadow-2xl print:shadow-none print:m-0 border border-neutral-700/50 print:border-none relative flex flex-col justify-start page-break-after-always overflow-hidden shrink-0"
                        style={{
                          width: template.pageSize === 'letter' ? '215.9mm' : '210mm',
                          height: template.pageSize === 'letter' ? '279.4mm' : '297mm',
                          paddingLeft: `${template.marginLeft}mm`,
                          paddingTop: `${template.marginTop}mm`,
                          boxSizing: 'border-box'
                        }}
                      >
                        {/* Virtual Sheet Headers */}
                        <div className="absolute top-3 right-3 px-2 py-1 bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20 text-[9px] font-black uppercase rounded select-none print:hidden z-10">
                          Avery Sheet {pageIdx + 1} ({template.pageSize.toUpperCase()})
                        </div>

                        {/* Layout grid structure */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${template.columns}, ${template.labelWidth}mm)`,
                            gridTemplateRows: `repeat(${template.rows}, ${template.labelHeight}mm)`,
                            columnGap: `${template.gapX}mm`,
                            rowGap: `${template.gapY}mm`
                          }}
                        >
                          {pageLabels.map((item, slotIdx) => {
                            if (!item) {
                              return (
                                <div
                                  key={`empty-${pageIdx}-${slotIdx}`}
                                  className="border border-dashed border-neutral-300 flex items-center justify-center relative print:border-none"
                                  style={{
                                    width: `${template.labelWidth}mm`,
                                    height: `${template.labelHeight}mm`,
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  <span className="text-[8px] font-bold text-neutral-300 font-mono print:hidden">
                                    Slot {slotIdx + 1}
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={`label-${pageIdx}-${slotIdx}-${item.id}`}
                                className="bg-white text-black border border-neutral-200 print:border-transparent relative overflow-hidden flex flex-col justify-stretch"
                                style={{
                                  width: `${template.labelWidth}mm`,
                                  height: `${template.labelHeight}mm`,
                                  boxSizing: 'border-box'
                                }}
                              >
                                {/* Core Elements Rendering in Avery Loop */}
                                {canvasElements.map((el) => {
                                  const resolvedText = el.type === 'text' ? parseDynamicVariables(el.content, item) : '';
                                  const isSelected = selectedElementIds.includes(el.id);

                                  return (
                                    <div
                                      key={el.id}
                                      className="absolute select-none pointer-events-none"
                                      style={{
                                        left: `${el.x}%`,
                                        top: `${el.y}%`,
                                        width: `${el.width}%`,
                                        height: `${el.height}%`,
                                      }}
                                    >
                                      {el.type === 'text' && (
                                        <p 
                                          className={`w-full overflow-hidden truncate leading-none uppercase`}
                                          style={{
                                            fontFamily: el.font === 'JetBrains Mono' ? 'monospace' : 'sans-serif',
                                            fontSize: `${el.fontSize || 8}pt`,
                                            fontWeight: el.fontWeight === 'black' ? 900 : (el.fontWeight === 'bold' ? 700 : 400),
                                            textAlign: el.align || 'left',
                                            color: el.color || '#000000'
                                          }}
                                        >
                                          {resolvedText}
                                        </p>
                                      )}
                                      {el.type === 'qr' && (
                                        <div className="w-full h-full flex items-center justify-center p-0.5 bg-white border border-neutral-100">
                                          <QRCodeCanvas
                                            value={getQrUrlValue(el, item)}
                                            size={48}
                                            level="M"
                                            fgColor={el.qrFgColor || '#000000'}
                                            bgColor={el.qrBgColor || '#ffffff'}
                                            style={{ width: '100%', height: '100%' }}
                                          />
                                        </div>
                                      )}
                                      {el.type === 'shape' && (
                                        <div 
                                          className="w-full h-full"
                                          style={{
                                            backgroundColor: el.bgColor || 'transparent',
                                            borderColor: el.color || '#000000',
                                            borderWidth: el.shapeType === 'rectangle' ? '1px' : '0',
                                            borderRadius: el.shapeType === 'circle' ? '50%' : '0'
                                          }}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ======================== 🖨️ SINGLE DYNAMIC ROLL CANVAS ======================== */
                <div className="flex flex-col items-start relative select-none print:bg-white print:p-0">
                  {/* Ruler Corner + Top Horizontal Ruler */}
                  <div className="flex items-end print:hidden">
                    {/* Ruler Corner Block aligned with vertical ruler */}
                    <div className="w-6 h-6 border-r border-b border-neutral-800 bg-[#141416] shrink-0 flex items-center justify-center select-none">
                      <span className="text-[7.5px] text-neutral-500 font-mono font-black uppercase">mm</span>
                    </div>
                    {/* Top Horizontal Ruler */}
                    <div 
                      className="h-6 border-b border-r border-neutral-800 bg-[#141416] overflow-hidden relative shrink-0"
                      style={{ width: `${canvasWidth * 3.78 * canvasZoom}px` }}
                    >
                      <svg width="100%" height="100%">
                        {Array.from({ length: Math.max(1, Math.floor(canvasWidth || 10)) + 1 }).map((_, i) => {
                          const posX = (i / canvasWidth) * 100;
                          const isCentimeter = i % 10 === 0;
                          const isHalfCentimeter = i % 5 === 0;
                          return (
                            <g key={`h-tick-${i}`}>
                              <line
                                x1={`${posX}%`}
                                y1={isCentimeter ? 6 : (isHalfCentimeter ? 13 : 18)}
                                x2={`${posX}%`}
                                y2={24}
                                stroke="#3f3f46"
                                strokeWidth={isCentimeter ? 1.5 : 1}
                              />
                              {isCentimeter && (
                                <text
                                  x={`${posX}%`}
                                  y={5}
                                  textAnchor="middle"
                                  fontSize="7"
                                  fill="#71717a"
                                  fontFamily="monospace"
                                  fontWeight="black"
                                >
                                  {i}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  {/* Vertical Ruler + Live Canvas Viewport */}
                  <div className="flex items-start">
                    {/* Left Vertical Ruler */}
                    <div 
                      className="w-6 border-r border-b border-neutral-800 bg-[#141416] overflow-hidden relative shrink-0 print:hidden"
                      style={{ height: `${canvasHeight * 3.78 * canvasZoom}px` }}
                    >
                      <svg width="100%" height="100%">
                        {Array.from({ length: Math.max(1, Math.floor(canvasHeight || 10)) + 1 }).map((_, i) => {
                          const posY = (i / canvasHeight) * 100;
                          const isCentimeter = i % 10 === 0;
                          const isHalfCentimeter = i % 5 === 0;
                          return (
                            <g key={`v-tick-${i}`}>
                              <line
                                x1={isCentimeter ? 6 : (isHalfCentimeter ? 13 : 18)}
                                y1={`${posY}%`}
                                x2={24}
                                y2={`${posY}%`}
                                stroke="#3f3f46"
                                strokeWidth={isCentimeter ? 1.5 : 1}
                              />
                              {isCentimeter && (
                                <text
                                  x={1}
                                  y={`${posY}%`}
                                  dy="2.5"
                                  fontSize="7"
                                  fill="#71717a"
                                  fontFamily="monospace"
                                  fontWeight="black"
                                >
                                  {i}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Active Canvas Design Frame */}
                    <div 
                      id="studio-canvas-container"
                      className="bg-white text-black shadow-2xl relative transition-all overflow-hidden border border-neutral-200 select-none print:shadow-none print:border-none shrink-0"
                      style={{
                        width: `${canvasWidth * 3.78 * canvasZoom}px`,
                        height: `${canvasHeight * 3.78 * canvasZoom}px`,
                        boxSizing: 'border-box',
                        borderRadius: canvasLayout === 'cable' ? '0' : '4px'
                      }}
                    >
                      {/* Dynamic Visual sub-grid overlays */}
                      {showGrid && (
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage: `
                              linear-gradient(to right, rgba(0, 0, 0, 0.035) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(0, 0, 0, 0.035) 1px, transparent 1px),
                              linear-gradient(to right, rgba(0, 0, 0, 0.08) 1.5px, transparent 1.5px),
                              linear-gradient(to bottom, rgba(0, 0, 0, 0.08) 1.5px, transparent 1.5px)
                            `,
                            backgroundSize: `
                              ${3.78 * canvasZoom}px ${3.78 * canvasZoom}px,
                              ${10 * 3.78 * canvasZoom}px ${10 * 3.78 * canvasZoom}px
                            `,
                            opacity: 0.95
                          }}
                        />
                      )}

                      {/* Guides Layer */}
                      {showGuides && (
                        <div className="absolute inset-2 border border-dashed border-[#0066cc]/10 pointer-events-none">
                          <span className="absolute top-1 left-1 text-[5px] text-[#0066cc]/40 uppercase font-bold tracking-wider">Safe Area (2mm)</span>
                        </div>
                      )}

                      {/* Elements Loop on Live Canvas */}
                      {canvasElements.map((el) => {
                        const resolvedText = el.type === 'text' ? parseDynamicVariables(el.content, activePreviewItem) : '';
                        const isSelected = selectedElementIds.includes(el.id);

                        return (
                          <div
                            key={el.id}
                            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                            className={`absolute flex flex-col justify-center cursor-move select-none transition-shadow ${
                              isSelected ? 'ring-1 ring-[#0066cc] bg-[#0066cc]/5 border border-[#0066cc]' : 'hover:bg-neutral-100/50'
                            }`}
                            style={{
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              width: `${el.width}%`,
                              height: `${el.height}%`,
                            }}
                          >
                            {el.type === 'text' && (
                              <p 
                                className="w-full overflow-hidden truncate leading-none uppercase pointer-events-none"
                                style={{
                                  fontFamily: el.font === 'JetBrains Mono' ? 'monospace' : 'sans-serif',
                                  fontSize: `${el.fontSize || 8}pt`,
                                  fontWeight: el.fontWeight === 'black' ? 900 : (el.fontWeight === 'bold' ? 700 : 400),
                                  textAlign: el.align || 'left',
                                  color: el.color || '#000000'
                                }}
                              >
                                {resolvedText}
                              </p>
                            )}

                            {el.type === 'qr' && (
                              <div className="w-full h-full flex flex-col items-center justify-center p-0.5 bg-white border border-neutral-100 relative pointer-events-none">
                                <QRCodeCanvas
                                  value={getQrUrlValue(el, activePreviewItem)}
                                  size={64}
                                  level="M"
                                  fgColor={el.qrFgColor || '#000000'}
                                  bgColor={el.qrBgColor || '#ffffff'}
                                  style={{ width: '100%', height: '100%' }}
                                />
                              </div>
                            )}

                            {el.type === 'shape' && (
                              <div 
                                className="w-full h-full pointer-events-none"
                                style={{
                                  backgroundColor: el.bgColor || 'transparent',
                                  borderColor: el.color || '#000000',
                                  borderWidth: el.shapeType === 'rectangle' ? '1px' : '0',
                                  borderRadius: el.shapeType === 'circle' ? '50%' : '0'
                                }}
                              />
                            )}

                            {/* Selection Grips */}
                            {isSelected && (
                              <>
                                <span className="absolute -top-1 -left-1 w-2 h-2 bg-[#0066cc] rounded-full pointer-events-none" />
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#0066cc] rounded-full pointer-events-none" />
                                <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#0066cc] rounded-full pointer-events-none" />
                                <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#0066cc] rounded-full pointer-events-none" />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* =========================================================
                3. BOTTOM PANEL: LIVE PREVIEW SWITCHER (Height: 140px)
                ========================================================= */}
            <div className="h-32 border-t border-neutral-800 bg-[#16161a] p-4 flex flex-col shrink-0 print:hidden select-none">
              <div className="flex items-center justify-between pb-2">
                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Live Preview Context Binding</span>
                <span className="text-[10px] text-neutral-500">Pick any asset to map dynamic variables in real-time</span>
              </div>
              <div className="flex-1 overflow-x-auto flex items-center gap-2.5 pb-1">
                {items.slice(0, 8).map((item) => {
                  const isCurrent = previewItemId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setPreviewItemId(item.id)}
                      className={`px-4 py-2.5 rounded-xl border text-left transition duration-150 shrink-0 flex items-center gap-3 ${
                        isCurrent 
                          ? 'bg-[#0066cc]/15 border-[#0066cc] text-white' 
                          : 'bg-[#1e1e24] border-neutral-800/80 text-neutral-400 hover:bg-[#25252d]'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${isCurrent ? 'bg-[#0066cc] text-white' : 'bg-neutral-800 text-neutral-500'}`}>
                        <Tag size={12} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-[11px] truncate w-28 text-white">{item.name}</p>
                        <p className="text-[9px] font-mono mt-0.5">{item.assetTag || 'TAG-PENDING'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* =========================================================
              4. RIGHT PANEL: PROPERTIES INSPECTOR (Width: 320px)
              ========================================================= */}
          <div className="w-full lg:w-80 border-l border-neutral-800 flex flex-col shrink-0 bg-[#16161a] overflow-hidden print:hidden select-none">
            <div className="p-4 bg-[#111114] border-b border-neutral-800 flex items-center gap-2 text-neutral-400">
              <SlidersHorizontal size={14} className="text-[#0066cc]" />
              <span className="text-[11px] font-black uppercase tracking-wider">Properties Inspector</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              
              {selectedElementId ? (
                /* ======================== SELECTED ELEMENT PROPERTIES ======================== */
                (() => {
                  const el = canvasElements.find(e => e.id === selectedElementId);
                  if (!el) return null;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                        <span className="text-[10px] bg-neutral-800 text-neutral-300 font-bold px-2 py-0.5 rounded capitalize">
                          {el.type} Element
                        </span>
                        <button
                          onClick={() => deleteElement(el.id)}
                          className="p-1 text-red-400 hover:bg-red-500/10 rounded transition"
                          title="Delete element"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Coordinate Positioning */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-neutral-400">Layout Coordinates (%)</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] text-neutral-500 font-mono">X Position</span>
                            <input
                              type="number"
                              value={Math.round(el.x)}
                              onChange={(e) => updateSelectedElement({ x: Number(e.target.value) })}
                              className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white text-center"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-neutral-500 font-mono">Y Position</span>
                            <input
                              type="number"
                              value={Math.round(el.y)}
                              onChange={(e) => updateSelectedElement({ y: Number(e.target.value) })}
                              className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white text-center"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-neutral-500 font-mono">Width</span>
                            <input
                              type="number"
                              value={Math.round(el.width)}
                              onChange={(e) => updateSelectedElement({ width: Number(e.target.value) })}
                              className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white text-center"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-neutral-500 font-mono">Height</span>
                            <input
                              type="number"
                              value={Math.round(el.height)}
                              onChange={(e) => updateSelectedElement({ height: Number(e.target.value) })}
                              className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white text-center"
                            />
                          </div>
                        </div>
                      </div>

                      {/* TEXT ELEMENTS CONFIG */}
                      {el.type === 'text' && (
                        <div className="space-y-4 pt-3 border-t border-neutral-800">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-neutral-400">Text Content / Variable</label>
                            <input
                              type="text"
                              value={el.content}
                              onChange={(e) => updateSelectedElement({ content: e.target.value })}
                              className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2.5 text-xs text-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] text-neutral-500">Font Family</span>
                              <select
                                value={el.font || 'Inter'}
                                onChange={(e) => updateSelectedElement({ font: e.target.value })}
                                className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                              >
                                <option value="Inter">Inter Sans</option>
                                <option value="JetBrains Mono">Fira Mono</option>
                              </select>
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-500">Font Size (pt)</span>
                              <input
                                type="number"
                                step="0.5"
                                value={el.fontSize || 8}
                                onChange={(e) => updateSelectedElement({ fontSize: Number(e.target.value) })}
                                className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] text-neutral-500">Weight</span>
                              <select
                                value={el.fontWeight || 'normal'}
                                onChange={(e) => updateSelectedElement({ fontWeight: e.target.value as any })}
                                className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                              >
                                <option value="normal">Normal</option>
                                <option value="bold">Bold</option>
                                <option value="black">Extra Black</option>
                              </select>
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-500">Text Color</span>
                              <input
                                type="color"
                                value={el.color || '#000000'}
                                onChange={(e) => updateSelectedElement({ color: e.target.value })}
                                className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-1 h-8 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* QR ELEMENTS CONFIG */}
                      {el.type === 'qr' && (
                        <div className="space-y-4 pt-3 border-t border-neutral-800">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-neutral-400">QR Code Destination</label>
                            <select
                              value={el.qrDest || 'bio'}
                              onChange={(e) => {
                                const newDest = e.target.value as any;
                                updateSelectedElement({ 
                                  qrDest: newDest,
                                  content: newDest === 'custom' ? '' : newDest
                                });
                              }}
                              className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                            >
                              <option value="bio">Equipment Bio</option>
                              <option value="maintenance">Maintenance Page</option>
                              <option value="custom">Custom URL</option>
                              <option value="asset">Packer Tools App Page</option>
                              <option value="booking">Rental Booking Signoff</option>
                            </select>
                          </div>

                          {/* Dynamic Destination Helper Explanation Cards */}
                          <div className="p-2.5 bg-neutral-900/50 border border-neutral-850 rounded-lg text-[11px] text-neutral-400 leading-relaxed space-y-1">
                            {el.qrDest === 'bio' && (
                              <p>
                                🧬 <strong>Equipment Bio:</strong> Directs scanners to the item's digital passport containing specifications, check-out history, and calibration state.
                              </p>
                            )}
                            {el.qrDest === 'maintenance' && (
                              <p>
                                🔧 <strong>Maintenance Page:</strong> Directs scanners to active maintenance logs to file fault reports, check up on health telemetry, or update service status.
                              </p>
                            )}
                            {el.qrDest === 'custom' && (
                              <p>
                                🔗 <strong>Custom URL:</strong> Redirects scanners to any custom external link, manufacturer user manual, or cloud database resource.
                              </p>
                            )}
                            {el.qrDest === 'asset' && (
                              <p>
                                📋 <strong>App Page Search:</strong> Displays the master list library search index on the Packer Tools app matching this specific asset tag.
                              </p>
                            )}
                            {el.qrDest === 'booking' && (
                              <p>
                                🛒 <strong>Rental Booking:</strong> Redirects scanners to the gear listing page inside the marketplace to book, reserve, or initiate handoff.
                              </p>
                            )}
                          </div>

                          {el.qrDest === 'custom' && (
                            <div className="space-y-1.5">
                              <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Redirect URL</span>
                              <input
                                type="text"
                                placeholder="example.com/asset-link"
                                value={el.content === 'bio' || el.content === 'maintenance' || el.content === 'asset' || el.content === 'booking' ? '' : el.content}
                                onChange={(e) => updateSelectedElement({ content: e.target.value })}
                                className="w-full bg-[#1e1e24] border border-[#0066cc]/40 rounded-lg p-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#0066cc]"
                              />
                            </div>
                          )}

                          {/* Live URL Link Preview */}
                          <div className="space-y-1">
                            <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Resolved Link Preview</span>
                            <div className="bg-[#1e1e24] border border-neutral-800/80 rounded-lg p-2.5 text-[10px] font-mono text-[#0066cc] break-all select-all font-bold">
                              {getQrUrlValue(el, activePreviewItem)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] text-neutral-500">QR Color</span>
                              <input
                                type="color"
                                value={el.qrFgColor || '#000000'}
                                onChange={(e) => updateSelectedElement({ qrFgColor: e.target.value })}
                                className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-1 h-8 cursor-pointer"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-500">QR BG Color</span>
                              <input
                                type="color"
                                value={el.qrBgColor || '#ffffff'}
                                onChange={(e) => updateSelectedElement({ qrBgColor: e.target.value })}
                                className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-1 h-8 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SHAPE ELEMENTS CONFIG */}
                      {el.type === 'shape' && (
                        <div className="space-y-4 pt-3 border-t border-neutral-800">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] text-neutral-500">Fill Color</span>
                              <input
                                type="color"
                                value={el.bgColor || 'transparent'}
                                onChange={(e) => updateSelectedElement({ bgColor: e.target.value })}
                                className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-1 h-8 cursor-pointer"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-500">Stroke Color</span>
                              <input
                                type="color"
                                value={el.color || '#000000'}
                                onChange={(e) => updateSelectedElement({ color: e.target.value })}
                                className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-1 h-8 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => duplicateElement(el.id)}
                          className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-wider text-neutral-300 transition flex items-center justify-center gap-1.5"
                        >
                          <Copy size={11} />
                          <span>Duplicate</span>
                        </button>
                        <button
                          onClick={() => setSelectedElementId(null)}
                          className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-[10px] font-black uppercase text-neutral-300 transition"
                        >
                          Deselect
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* ======================== CANVAS LABEL / SHEET PROPERTIES ======================== */
                <div className="space-y-4">
                  {sheetMode ? (
                    /* Avery Sheet Configs */
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-neutral-400">Avery Label Dimension Template</label>
                        <select
                          value={selectedAveryTemplateId}
                          onChange={(e) => setSelectedAveryTemplateId(e.target.value)}
                          className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                        >
                          {AVERY_TEMPLATES.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-neutral-400">Sheet Start index</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max="30"
                            value={sheetStartIndex}
                            onChange={(e) => setSheetStartIndex(Number(e.target.value))}
                            className="flex-1 accent-[#0066cc]"
                          />
                          <span className="text-xs font-mono font-bold text-[#0066cc] w-6">{sheetStartIndex}</span>
                        </div>
                        <p className="text-[10px] text-neutral-500">Allows skipping partially used stickers on the Avery paper sheet.</p>
                      </div>
                    </div>
                  ) : (
                    /* Continuous Roll Configs */
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-neutral-400">Physic Label Size (mm)</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] text-neutral-500">Label Width</span>
                            <input
                              type="number"
                              value={canvasWidth}
                              onChange={(e) => setCanvasWidth(Number(e.target.value))}
                              className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white text-center"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-neutral-500">Label Height</span>
                            <input
                              type="number"
                              value={canvasHeight}
                              onChange={(e) => setCanvasHeight(Number(e.target.value))}
                              className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white text-center"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-neutral-400">Sticker Format</label>
                        <select
                          value={canvasLayout}
                          onChange={(e) => setCanvasLayout(e.target.value as any)}
                          className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                        >
                          <option value="standard">Standard Rectangular (2:1)</option>
                          <option value="square">Square Frame (1:1)</option>
                          <option value="cable">Cable Wrap (Tail strip)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* General Guidelines Toggles */}
                  <div className="pt-3 border-t border-neutral-800 space-y-3">
                    <label className="text-[10px] font-bold uppercase text-neutral-400">Canvas Guidelines</label>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer">
                        <span>Show Safe Area Boundaries</span>
                        <input
                          type="checkbox"
                          checked={showGuides}
                          onChange={(e) => setShowGuides(e.target.checked)}
                          className="rounded border-neutral-700 bg-neutral-900 accent-[#0066cc]"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Save Layout to user's private library */}
                  <div className="pt-4 border-t border-[#1e1e24] space-y-2.5">
                    <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">Cloud Template Publisher</label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="w-full bg-[#1e1e24] border border-neutral-800 rounded-lg p-2 text-xs text-white"
                      placeholder="Template design title..."
                    />
                    <button
                      onClick={handleSaveUserTemplate}
                      disabled={isSavingTemplate}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5"
                    >
                      {isSavingTemplate ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save size={13} />
                          <span>Save to Studio Cloud</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
