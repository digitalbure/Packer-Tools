import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Printer, Check, Search, Tag, QrCode, Settings2, Layout, Maximize2, Minimize2,
  Type, Eye, EyeOff, Info, Sparkles, Sliders, Edit3, Paintbrush, Save, 
  Layers, Cable, Tv, ShieldAlert, ArrowRightLeft, ZoomIn, ZoomOut, Grid, List,
  Plus, Copy, Trash2, AlignLeft, AlignCenter, AlignRight, FileText, 
  SlidersHorizontal, Download, Upload, Heart, Share2, HelpCircle, Filter, ArrowUpDown,
  ChevronRight, RefreshCw, FolderOpen, AlertCircle, Sparkle, Smartphone, Cpu, History as HistoryIcon,
  AlignCenterHorizontal, AlignCenterVertical, AlignStartHorizontal, AlignEndHorizontal,
  AlignStartVertical, AlignEndVertical, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  Undo2, Redo2, CheckSquare, Square, Package, Box, ChevronDown, ChevronUp
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { GearItem, UserProfile } from '../types';
import { doc, updateDoc, collection, addDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { getLabelRecommendation } from '../services/labelSuggester';
import { hapticResizeTick, hapticMedium, hapticLight } from '../utils/haptics';
import { downloadLabelFromElement, downloadBatchLabelsPdf, clearPrinterCssCache, LabelExportFormat } from '../utils/labelDownload';

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
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerBio?: string;
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
  isPlainPaper?: boolean;
}

export const AVERY_TEMPLATES: AveryTemplate[] = [
  {
    id: 'plainA4_8grid',
    name: 'Plain A4 Paper - 8 Cut-out Cards (2x4 Grid, with Cut Lines)',
    columns: 2,
    rows: 4,
    labelWidth: 90.0,
    labelHeight: 60.0,
    marginTop: 25.0,
    marginLeft: 12.0,
    gapX: 6.0,
    gapY: 6.0,
    pageSize: 'a4',
    isPlainPaper: true
  },
  {
    id: 'plainLetter_8grid',
    name: 'Plain Letter Paper - 8 Cut-out Cards (2x4 Grid, with Cut Lines)',
    columns: 2,
    rows: 4,
    labelWidth: 92.0,
    labelHeight: 56.0,
    marginTop: 24.0,
    marginLeft: 13.0,
    gapX: 6.0,
    gapY: 6.0,
    pageSize: 'letter',
    isPlainPaper: true
  },
  {
    id: 'plainA4_single',
    name: 'Plain A4 Paper - 1 Centered Temporary Card (Large, No Paper Waste)',
    columns: 1,
    rows: 1,
    labelWidth: 120.0,
    labelHeight: 80.0,
    marginTop: 100.0,
    marginLeft: 45.0,
    gapX: 0,
    gapY: 0,
    pageSize: 'a4',
    isPlainPaper: true
  },
  {
    id: 'plainLetter_single',
    name: 'Plain Letter Paper - 1 Centered Temporary Card (Large, No Paper Waste)',
    columns: 1,
    rows: 1,
    labelWidth: 120.0,
    labelHeight: 80.0,
    marginTop: 90.0,
    marginLeft: 48.0,
    gapX: 0,
    gapY: 0,
    pageSize: 'letter',
    isPlainPaper: true
  },
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

export interface StudioTemplate {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  layout: 'standard' | 'cable' | 'square' | 'tiny';
  elements: CanvasElement[];
  category: string;
}

export const PRESET_STUDIO_TEMPLATES: StudioTemplate[] = [
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
  },
  {
    id: 'tpl_certags_portrait',
    name: 'Certags-Style Portrait Plate',
    width: 45,
    height: 80,
    layout: 'standard',
    category: 'Industrial Tags',
    elements: [
      { id: '1', type: 'shape', content: 'rectangle', x: 4, y: 3, width: 92, height: 94, shapeType: 'rectangle', bgColor: 'transparent', color: '#000000' },
      { id: '2', type: 'text', content: 'Property Of', x: 10, y: 8, width: 80, height: 5, font: 'Inter', fontSize: 6.5, fontWeight: 'bold', align: 'center', color: '#000000' },
      { id: '3', type: 'text', content: '{{asset.brand}}', x: 10, y: 15, width: 80, height: 10, font: 'Inter', fontSize: 11, fontWeight: 'black', align: 'center', color: '#000000' },
      { id: '4', type: 'shape', content: 'divider', x: 15, y: 28, width: 70, height: 1, shapeType: 'divider', bgColor: '#000000', color: '#000000' },
      { id: '5', type: 'text', content: 'Asset Number', x: 10, y: 33, width: 80, height: 5, font: 'Inter', fontSize: 6.5, fontWeight: 'bold', align: 'center', color: '#000000' },
      { id: '6', type: 'text', content: '{{asset.assetTag}}', x: 10, y: 40, width: 80, height: 10, font: 'JetBrains Mono', fontSize: 10, fontWeight: 'bold', align: 'center', color: '#000000' },
      { id: '7', type: 'qr', content: 'bio', x: 25, y: 55, width: 50, height: 28, qrDest: 'bio', qrFgColor: '#000000', qrBgColor: '#ffffff' },
      { id: '8', type: 'text', content: 'Scan Passport', x: 10, y: 86, width: 80, height: 5, font: 'Inter', fontSize: 5, fontWeight: 'bold', align: 'center', color: '#000000' }
    ]
  },
  {
    id: 'tpl_small_electronics_thermal',
    name: 'High-Res Small Electronics Tag',
    width: 35,
    height: 15,
    layout: 'tiny',
    category: 'Small Electronics',
    elements: [
      { id: '1', type: 'text', content: '{{asset.brand}}', x: 3, y: 5, width: 55, height: 18, font: 'Inter', fontSize: 5, fontWeight: 'bold' },
      { id: '2', type: 'text', content: '{{asset.name}}', x: 3, y: 25, width: 55, height: 35, font: 'Inter', fontSize: 6.5, fontWeight: 'black' },
      { id: '3', type: 'qr', content: 'bio', x: 62, y: 10, width: 35, height: 80, qrDest: 'bio' },
      { id: '4', type: 'text', content: '{{asset.assetTag}}', x: 3, y: 65, width: 55, height: 20, font: 'JetBrains Mono', fontSize: 5, fontWeight: 'bold' }
    ]
  },
  {
    id: 'tpl_rack_mount_tag',
    name: 'Heavy-Duty Rack Mount Strip',
    width: 90,
    height: 12,
    layout: 'standard',
    category: 'Rack Mounts',
    elements: [
      { id: '1', type: 'shape', content: 'divider', x: 0, y: 0, width: 3, height: 100, bgColor: '#10b981', shapeType: 'divider' },
      { id: '2', type: 'text', content: 'RACK UNIT: {{asset.name}}', x: 5, y: 10, width: 60, height: 40, font: 'Inter', fontSize: 7, fontWeight: 'black' },
      { id: '3', type: 'text', content: 'BRAND: {{asset.brand}} | {{asset.assetTag}}', x: 5, y: 55, width: 60, height: 35, font: 'JetBrains Mono', fontSize: 5.5, fontWeight: 'bold', color: '#64748b' },
      { id: '4', type: 'qr', content: 'bio', x: 80, y: 10, width: 15, height: 80, qrDest: 'bio' }
    ]
  }
];

interface QRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PrintableItem[];
  user: UserProfile | null;
  initialSelectedIds?: Set<string>;
  initialTab?: 'designs' | 'templates' | 'print' | 'nfc' | 'rfid' | 'batch' | 'devices' | 'tag_inventory' | 'history' | 'settings';
}

export default function QRPrintModal({ isOpen, onClose, items, user, initialSelectedIds, initialTab }: QRPrintModalProps) {
  // -------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<'designs' | 'templates' | 'print' | 'nfc' | 'rfid' | 'batch' | 'devices' | 'tag_inventory' | 'history' | 'settings'>('templates');
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'tools' | 'inspector'>('canvas');

  // Column resizing state (Drag to resize columns)
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(320); // px
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(320); // px
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const [isResizingRight, setIsResizingRight] = useState<boolean>(false);

  // Column drag resize handlers
  const handleStartResizeLeft = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    hapticMedium();
    setIsResizingLeft(true);
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const initialWidth = leftPanelWidth;
    let lastW = initialWidth;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = curX - startX;
      const newW = Math.max(220, Math.min(520, initialWidth + deltaX));
      if (Math.abs(newW - lastW) >= 15) {
        hapticResizeTick();
        lastW = newW;
      }
      setLeftPanelWidth(newW);
    };

    const handleUp = () => {
      setIsResizingLeft(false);
      window.removeEventListener('mousemove', handleMove as any);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove as any);
      window.removeEventListener('touchend', handleUp);
    };

    window.addEventListener('mousemove', handleMove as any);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove as any, { passive: false });
    window.addEventListener('touchend', handleUp);
  };

  const handleStartResizeRight = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    hapticMedium();
    setIsResizingRight(true);
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const initialWidth = rightPanelWidth;
    let lastW = initialWidth;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = startX - curX;
      const newW = Math.max(220, Math.min(520, initialWidth + deltaX));
      if (Math.abs(newW - lastW) >= 15) {
        hapticResizeTick();
        lastW = newW;
      }
      setRightPanelWidth(newW);
    };

    const handleUp = () => {
      setIsResizingRight(false);
      window.removeEventListener('mousemove', handleMove as any);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove as any);
      window.removeEventListener('touchend', handleUp);
    };

    window.addEventListener('mousemove', handleMove as any);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove as any, { passive: false });
    window.addEventListener('touchend', handleUp);
  };

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
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

  // Right-click & Long-press Context Menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string | null } | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close context menu on window click / Escape key
  useEffect(() => {
    const handleWindowClick = () => setContextMenu(null);
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleWindowClick);
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, elementId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    hapticMedium();

    if (elementId) {
      setSelectedElementId(elementId);
      if (!selectedElementIds.includes(elementId)) {
        setSelectedElementIds([elementId]);
      }
    }

    const menuWidth = 230;
    const menuHeight = 320;
    const winW = typeof window !== 'undefined' ? window.innerWidth : 800;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 600;
    const x = Math.max(10, Math.min(e.clientX, winW - menuWidth - 10));
    const y = Math.max(10, Math.min(e.clientY, winH - menuHeight - 10));

    setContextMenu({ x, y, elementId });
  };

  const handleTouchStartContext = (e: React.TouchEvent, elementId: string | null) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
      hapticMedium();
      if (elementId) {
        setSelectedElementId(elementId);
        if (!selectedElementIds.includes(elementId)) {
          setSelectedElementIds([elementId]);
        }
      }
      const menuWidth = 230;
      const menuHeight = 320;
      const winW = typeof window !== 'undefined' ? window.innerWidth : 800;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 600;
      const x = Math.max(10, Math.min(touchX, winW - menuWidth - 10));
      const y = Math.max(10, Math.min(touchY, winH - menuHeight - 10));
      setContextMenu({ x, y, elementId });
    }, 450);
  };

  const handleTouchMoveContext = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchEndContext = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  // Printer Configuration
  const [selectedPrinterProfile, setSelectedPrinterProfile] = useState<string>('brother_ql');
  const [sheetMode, setSheetMode] = useState<boolean>(false);
  const [selectedAveryTemplateId, setSelectedAveryTemplateId] = useState<string>('avery5160');
  const [sheetStartIndex, setSheetStartIndex] = useState<number>(1);
  const [showCropMarks, setShowCropMarks] = useState<boolean>(false);
  const [printOffsetX, setPrintOffsetX] = useState<number>(0); // mm
  const [printOffsetY, setPrintOffsetY] = useState<number>(0); // mm
  const [copiesPerItem, setCopiesPerItem] = useState<number>(1);
  const [batchPdfProgress, setBatchPdfProgress] = useState<{ current: number; total: number } | null>(null);

  // Download Modal & Export Options State
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [downloadFormat, setDownloadFormat] = useState<LabelExportFormat>('png');
  const [downloadScale, setDownloadScale] = useState<number>(3); // 3x = 300 DPI
  const [downloadBg, setDownloadBg] = useState<'white' | 'transparent'>('white');
  const [downloadTarget, setDownloadTarget] = useState<'current' | 'selected'>('current');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Dedicated Multi-Page Batch PDF Generation Engine
  const handleBatchPdfDownload = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one asset to include in the batch PDF.");
      return;
    }

    setIsExporting(true);
    try {
      const offscreenRoot = document.getElementById('label-studio-workspace-print-root');
      if (!offscreenRoot) {
        toast.error("Batch print DOM node not found.");
        return;
      }

      const origStyle = offscreenRoot.getAttribute('style') || '';
      const origClass = offscreenRoot.className;

      // Temporarily render in offscreen fixed container for accurate capture
      offscreenRoot.className = "block bg-white text-black p-0 m-0";
      offscreenRoot.style.position = 'fixed';
      offscreenRoot.style.left = '-9999px';
      offscreenRoot.style.top = '-9999px';
      offscreenRoot.style.zIndex = '-9999';
      offscreenRoot.style.visibility = 'visible';

      await new Promise(res => setTimeout(res, 250));

      let pageElements: HTMLElement[] = [];
      let pdfPageWidthMm = canvasWidth;
      let pdfPageHeightMm = canvasHeight;

      if (sheetMode) {
        const template = AVERY_TEMPLATES.find(t => t.id === selectedAveryTemplateId) || AVERY_TEMPLATES[0];
        pdfPageWidthMm = template.pageSize === 'letter' ? 215.9 : 210;
        pdfPageHeightMm = template.pageSize === 'letter' ? 279.4 : 297;

        const pages = offscreenRoot.querySelectorAll('[id^="print-avery-page-"]');
        pageElements = Array.from(pages) as HTMLElement[];
      } else {
        pdfPageWidthMm = canvasWidth;
        pdfPageHeightMm = canvasHeight;

        const labels = offscreenRoot.querySelectorAll('[id^="print-roll-label-"]');
        pageElements = Array.from(labels) as HTMLElement[];
      }

      if (pageElements.length === 0) {
        toast.error("No printable pages generated for batch export.");
        offscreenRoot.className = origClass;
        offscreenRoot.setAttribute('style', origStyle);
        return;
      }

      toast.info(`Compiling ${pageElements.length}-page PDF document for ${selectedItemsToPrint.length} label(s)...`);

      await downloadBatchLabelsPdf(
        pageElements,
        `packer-batch-labels-${selectedIds.size}-assets`,
        pdfPageWidthMm,
        pdfPageHeightMm,
        downloadScale,
        (current, total) => {
          setBatchPdfProgress({ current, total });
        }
      );

      offscreenRoot.className = origClass;
      offscreenRoot.setAttribute('style', origStyle);

      toast.success(`Successfully generated and downloaded ${pageElements.length}-page PDF document!`);
    } catch (err) {
      console.error("Batch PDF generation failed:", err);
      clearPrinterCssCache();
      toast.error("Failed to compile multi-page batch PDF. Printer CSS cache cleared; please retry.");
    } finally {
      setIsExporting(false);
      setBatchPdfProgress(null);
      setIsDownloadModalOpen(false);
    }
  };

  const handleClearPrinterCache = () => {
    hapticMedium();
    const result = clearPrinterCssCache();
    if (result.success) {
      toast.success(`Printer CSS Cache Cleared! (${result.clearedCount} style node(s) purged and layout reflowed)`);
    } else {
      toast.error('Encountered an issue resetting printer CSS cache.');
    }
  };

  const handleExecuteDownload = async (overrideFormat?: LabelExportFormat) => {
    const fmt = overrideFormat || downloadFormat;

    if ((downloadTarget === 'selected' || fmt === 'pdf') && selectedIds.size > 1) {
      await handleBatchPdfDownload();
      return;
    }

    setIsExporting(true);
    await new Promise(res => setTimeout(res, 60));
    try {
      const canvasContainer = document.getElementById('studio-canvas-container');
      if (!canvasContainer) {
        toast.error('Label canvas element not found');
        return;
      }

      const activeItem = printableItemsList.find(i => i.id === previewItemId) || items[0];
      const baseFilename = activeItem?.name ? `${activeItem.name}-label` : 'packer-tools-label';

      toast.info(`Downloading clean label as ${fmt.toUpperCase()}...`);
      await downloadLabelFromElement(canvasContainer, {
        filename: baseFilename,
        format: fmt,
        scale: downloadScale,
        backgroundColor: downloadBg === 'transparent' ? 'transparent' : '#ffffff',
        widthMm: canvasWidth,
        heightMm: canvasHeight,
      });
      toast.success(`Label exported as ${fmt.toUpperCase()} successfully!`);
    } catch (err) {
      console.error('Failed to export label:', err);
      toast.error('Error downloading label image. Please try again.');
    } finally {
      setIsExporting(false);
      setIsDownloadModalOpen(false);
    }
  };

  // Search parameters for batch printing
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [batchCategory, setBatchCategory] = useState<string>('all');

  // Asset Navigator Drawer & Enhanced Dock States
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState<boolean>(false);
  const [isDockExpanded, setIsDockExpanded] = useState<boolean>(false);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState<string>('');
  const [drawerCategory, setDrawerCategory] = useState<string>('all');
  const [drawerStatusFilter, setDrawerStatusFilter] = useState<string>('all');
  const [drawerSortOrder, setDrawerSortOrder] = useState<'name' | 'tag' | 'category'>('name');
  const [drawerLayoutView, setDrawerLayoutView] = useState<'grid' | 'list'>('grid');

  // Custom User Saved templates in Firestore / Local state
  const [userTemplates, setUserTemplates] = useState<StudioTemplate[]>([]);
  const [globalTemplates, setGlobalTemplates] = useState<StudioTemplate[]>([]);
  const [templateScope, setTemplateScope] = useState<'user' | 'global'>('user');
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string>('My Custom Tag Layout');

  // -------------------------------------------------------------
  // SELECTION & INIT DYNAMICS
  // -------------------------------------------------------------
  const [lastSuggestedItemId, setLastSuggestedItemId] = useState<string>('');
  const [currentRecommendation, setCurrentRecommendation] = useState<any>(null);

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
      // 1. Fetch personal user templates
      const q = query(collection(db, 'users', user.uid, 'labelTemplates'));
      getDocs(q).then((snap) => {
        const templatesList: StudioTemplate[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as StudioTemplate[];
        setUserTemplates(templatesList);
        if (templatesList.length > 0) {
          loadPresetTemplate(templatesList[0]);
        }
      }).catch((err) => {
        console.warn("Could not load templates from Firestore:", err);
      });

      // 2. Fetch global marketplace templates
      const qGlobal = query(collection(db, 'marketplaceTemplates'));
      getDocs(qGlobal).then((snap) => {
        const templatesList: StudioTemplate[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as StudioTemplate[];
        setGlobalTemplates(templatesList);
      }).catch((err) => {
        console.warn("Could not load global templates from Firestore:", err);
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

  // Smart template suggest mechanism on item selection
  useEffect(() => {
    if (isOpen && activePreviewItem && activePreviewItem.id !== lastSuggestedItemId) {
      setLastSuggestedItemId(activePreviewItem.id);
      
      const recommendation = getLabelRecommendation(
        activePreviewItem.name,
        activePreviewItem.category || '',
        { brand: activePreviewItem.brand, model: activePreviewItem.model }
      );
      
      setCurrentRecommendation(recommendation);

      const suggestedTpl = PRESET_STUDIO_TEMPLATES.find(t => t.id === recommendation.suggestedTemplateId) || PRESET_STUDIO_TEMPLATES[0];

      if (suggestedTpl) {
        // Load suggested parameters silently to keep interface seamless, then show smart toast feedback
        setCanvasWidth(suggestedTpl.width);
        setCanvasHeight(suggestedTpl.height);
        setCanvasLayout(suggestedTpl.layout);
        setCanvasElements(JSON.parse(JSON.stringify(suggestedTpl.elements)));
        setSelectedElementId(null);
        setSelectedElementIds([]);
        toast.info(`Smart Analyzer: Auto-mapped to "${suggestedTpl.name}" for category "${activePreviewItem.category || 'Other'}".`, {
          icon: '✨',
          description: `Best on: ${recommendation.recommendedMaterial}`
        });
      }
    }
  }, [isOpen, activePreviewItem, lastSuggestedItemId]);

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
  // DYNAMIC DRAG-TO-MOVE & KEYBOARD NAVIGATION HANDLERS (MOUSE & TOUCH)
  // -------------------------------------------------------------
  const handleElementMouseDown = (e: React.MouseEvent | React.TouchEvent, elementId: string) => {
    e.stopPropagation();
    hapticMedium();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    let nextIds = [elementId];
    if ('shiftKey' in e && e.shiftKey) {
      if (selectedElementIds.includes(elementId)) {
        nextIds = selectedElementIds.filter(id => id !== elementId);
      } else {
        nextIds = [...selectedElementIds, elementId];
      }
    }
    setSelectedElementIds(nextIds);
    setSelectedElementId(nextIds.length > 0 ? nextIds[nextIds.length - 1] : null);

    const startX = clientX;
    const startY = clientY;

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

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = curX - startX;
      const deltaY = curY - startY;

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

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove as any);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove as any);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove as any);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove as any, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  };

  // Corner Touch Resize Handler for Elements
  const handleResizeMouseDown = (e: React.MouseEvent | React.TouchEvent, elementId: string, corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    e.stopPropagation();
    hapticMedium();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const el = canvasElements.find(item => item.id === elementId);
    if (!el) return;

    const initialX = el.x;
    const initialY = el.y;
    const initialW = el.width;
    const initialH = el.height;
    let hasMoved = false;

    const canvasEl = document.getElementById('studio-canvas-container');
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const canvasPxWidth = rect.width || 1;
    const canvasPxHeight = rect.height || 1;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = curX - clientX;
      const deltaY = curY - clientY;

      if (!hasMoved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        saveStateToUndo(canvasElements);
        hasMoved = true;
      }

      const deltaPctX = (deltaX / canvasPxWidth) * 100;
      const deltaPctY = (deltaY / canvasPxHeight) * 100;

      let newX = initialX;
      let newY = initialY;
      let newW = initialW;
      let newH = initialH;

      if (corner.includes('right')) {
        newW = Math.max(5, Math.min(100 - initialX, initialW + deltaPctX));
      }
      if (corner.includes('left')) {
        const maxDeltaX = initialW - 5;
        const actualDeltaX = Math.min(deltaPctX, maxDeltaX);
        newX = Math.max(0, initialX + actualDeltaX);
        newW = initialW - (newX - initialX);
      }
      if (corner.includes('bottom')) {
        newH = Math.max(5, Math.min(100 - initialY, initialH + deltaPctY));
      }
      if (corner.includes('top')) {
        const maxDeltaY = initialH - 5;
        const actualDeltaY = Math.min(deltaPctY, maxDeltaY);
        newY = Math.max(0, initialY + actualDeltaY);
        newH = initialH - (newY - initialY);
      }

      setCanvasElements(prev => prev.map(item => {
        if (item.id === elementId) {
          return {
            ...item,
            x: Number(newX.toFixed(2)),
            y: Number(newY.toFixed(2)),
            width: Number(newW.toFixed(2)),
            height: Number(newH.toFixed(2))
          };
        }
        return item;
      }));
    };

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove as any);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove as any);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove as any);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove as any, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  };

  // Auto-fit canvas to container width on mobile
  const handleAutoFitZoom = () => {
    const container = document.getElementById('design-editor-center-panel');
    const availableWidth = container ? (container.getBoundingClientRect().width - 48) : (typeof window !== 'undefined' ? window.innerWidth - 32 : 300);
    if (availableWidth > 0 && canvasWidth > 0) {
      const requiredPx = canvasWidth * 3.78;
      const fitZoom = Math.min(2.0, Math.max(0.25, Math.floor((availableWidth / requiredPx) * 100) / 100));
      setCanvasZoom(fitZoom);
      hapticLight();
    }
  };

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      const timer = setTimeout(() => {
        handleAutoFitZoom();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, canvasWidth, canvasHeight]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/select/textarea
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      // Global Keyboard Shortcuts for Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
          return;
        } else {
          e.preventDefault();
          handleUndo();
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      const targets = selectedElementIds.length > 0 ? selectedElementIds : (selectedElementId ? [selectedElementId] : []);
      if (targets.length === 0) return;

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
  }, [selectedElementId, selectedElementIds, canvasElements, snapToGrid, canvasWidth, canvasHeight, undoStack, redoStack]);

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
    parsed = parsed.replace(/\{\{asset\.ownerName\}\}/gi, asset.ownerName || 'N/A');
    parsed = parsed.replace(/\{\{asset\.ownerPhone\}\}/gi, asset.ownerPhone || 'N/A');
    parsed = parsed.replace(/\{\{asset\.ownerEmail\}\}/gi, asset.ownerEmail || 'N/A');
    parsed = parsed.replace(/\{\{asset\.ownerBio\}\}/gi, asset.ownerBio || 'N/A');
    return parsed;
  };

  // Resolve QR code content URL
  const getQrUrlValue = (element: CanvasElement, item: PrintableItem) => {
    const origin = window.location.origin;
    const ownerQuery = item.ownerId ? `&owner=${item.ownerId}` : '';
    const ownerQueryFirst = item.ownerId ? `?owner=${item.ownerId}` : '';
    switch (element.qrDest) {
      case 'bio':
        return `${origin}/#/gear/${item.id}?passport=true${ownerQuery}`;
      case 'asset':
        return `${origin}/#/library?search=${item.assetTag || item.id}`;
      case 'booking':
        return `${origin}/#/gear/${item.id}?book=true${ownerQuery}`;
      case 'maintenance':
        return `${origin}/#/gear/${item.id}?tab=maintenance${ownerQuery}`;
      case 'custom':
        return element.content.startsWith('http') ? element.content : `https://${element.content}`;
      default:
        return `${origin}/#/gear/${item.id}${ownerQueryFirst}`;
    }
  };

  // -------------------------------------------------------------
  // CANVAS DRAG & PROPERTY EDITS
  // -------------------------------------------------------------
  const updateSelectedElement = (updates: Partial<CanvasElement>) => {
    if (selectedElementIds.length === 0) return;
    saveStateToUndo(canvasElements);
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
      if (templateScope === 'global') {
        // Save to global collection
        const colRef = collection(db, 'marketplaceTemplates');
        const docData = {
          name: templateName,
          width: canvasWidth,
          height: canvasHeight,
          layout: canvasLayout,
          elements: canvasElements,
          category: 'Global Layouts',
          createdAt: new Date().toISOString(),
          ownerId: user.uid,
          ownerName: user.displayName || 'Admin'
        };
        const docRef = await addDoc(colRef, docData);
        const newTemplate: StudioTemplate = { id: docRef.id, ...docData };
        setGlobalTemplates(prev => [...prev, newTemplate]);
        toast.success("Successfully persisted global template to shared organizational library!");
      } else {
        // Save to user private collection
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
        toast.success("Successfully persisted personal template to your cloud storage!");
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not write template. Stored locally instead.");
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

  // Asset Navigator Drawer Filtered Items
  const drawerFilteredItems = useMemo(() => {
    return items.filter(item => {
      const q = drawerSearchQuery.toLowerCase();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.assetTag && item.assetTag.toLowerCase().includes(q)) ||
        (item.model && item.model.toLowerCase().includes(q)) ||
        (item.serial && item.serial.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q));

      const matchesCategory = drawerCategory === 'all' || item.category === drawerCategory;
      const matchesStatus = drawerStatusFilter === 'all' || 
        (drawerStatusFilter === 'available' && (item.status === 'Available' || item.status === 'in_use' || !item.status)) ||
        (drawerStatusFilter === 'maintenance' && item.status === 'Maintenance') ||
        (drawerStatusFilter === 'checked_out' && item.status === 'Checked Out');

      return matchesSearch && matchesCategory && matchesStatus;
    }).sort((a, b) => {
      if (drawerSortOrder === 'tag') return (a.assetTag || '').localeCompare(b.assetTag || '');
      if (drawerSortOrder === 'category') return (a.category || '').localeCompare(b.category || '');
      return a.name.localeCompare(b.name);
    });
  }, [items, drawerSearchQuery, drawerCategory, drawerStatusFilter, drawerSortOrder]);

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
    const rawSelected = items.filter(i => selectedIds.has(i.id));
    if (copiesPerItem <= 1) return rawSelected;
    const expanded: PrintableItem[] = [];
    for (const item of rawSelected) {
      for (let c = 0; c < copiesPerItem; c++) {
        expanded.push(item);
      }
    }
    return expanded;
  }, [items, selectedIds, copiesPerItem]);

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

    // Bulletproof isolated iframe print approach
    const printContent = document.getElementById('label-studio-workspace-print-root');
    if (!printContent) {
      window.print();
      return;
    }

    // Create a temporary hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      document.body.removeChild(iframe);
      return;
    }

    // Determine target page size from settings
    const targetPageSize = sheetMode 
      ? (AVERY_TEMPLATES.find(t => t.id === selectedAveryTemplateId)?.pageSize === 'a4' ? '210mm 297mm' : '8.5in 11in') 
      : `${canvasWidth}mm ${canvasHeight}mm`;

    // Construct the HTML document inside the iframe
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Print Labels</title>
          <!-- Import Inter and JetBrains Mono for proper font rendering -->
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700;900&family=Space+Grotesk:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            /* Reset and core print settings */
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              color: black !important;
              font-family: 'Inter', sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            * {
              box-sizing: border-box !important;
            }
            @page {
              margin: 0 !important;
              size: ${targetPageSize};
            }
            .page-break-after-always {
              page-break-after: always !important;
              break-after: page !important;
            }
            svg {
              display: block !important;
              width: 100% !important;
              height: 100% !important;
              max-width: 100% !important;
              max-height: 100% !important;
            }
            svg path {
              fill-opacity: 1 !important;
            }
            
            /* Utility helper styles inside the printed frame */
            .bg-white { background-color: #ffffff !important; }
            .text-black { color: #000000 !important; }
            .relative { position: relative !important; }
            .absolute { position: absolute !important; }
            .overflow-hidden { overflow: hidden !important; }
            .flex { display: flex !important; }
            .flex-col { flex-direction: column !important; }
            .justify-stretch { justify-content: stretch !important; }
            .items-center { align-items: center !important; }
            .justify-center { justify-content: center !important; }
            .shrink-0 { flex-shrink: 0 !important; }
            .leading-none { line-height: 1 !important; }
            .uppercase { text-transform: uppercase !important; }
            .w-full { width: 100% !important; }
            .h-full { height: 100% !important; }
            .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
            .border { border-style: solid !important; }
            .border-2 { border-width: 2px !important; }
            .border-dashed { border-style: dashed !important; }
            .border-neutral-100 { border-color: #f5f5f5 !important; }
            .border-neutral-400 { border-color: #a3a3a3 !important; }
            .border-neutral-500 { border-color: #737373 !important; }
            .rounded { border-radius: 4px !important; }
            .text-\[6px\] { font-size: 6px !important; }
            .font-black { font-weight: 900 !important; }
            .tracking-wider { letter-spacing: 0.05em !important; }
            .top-1\.5 { top: 0.375rem !important; }
            .left-1\.5 { left: 0.375rem !important; }
            .px-1\.5 { padding-left: 0.375rem !important; padding-right: 0.375rem !important; }
            .py-0\.5 { padding-top: 0.125rem !important; padding-bottom: 0.125rem !important; }
            .z-10 { z-index: 10 !important; }
            .bg-neutral-100 { background-color: #f5f5f5 !important; }
            .text-neutral-500 { color: #737373 !important; }
            .p-0.5 { padding: 0.125rem !important; }
            p { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <div id="print-wrapper">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Trigger print from parent window to guarantee iframe focus & print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn("Parent iframe print fallback triggered:", e);
      }
    }, 500);

    // Remove the iframe after the print dialog is completed/closed
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 6000);
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-1 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto font-sans"
      id="label-studio-workspace"
    >
      {/* Perfect Print Isolation styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Force physical document boundaries with zero margins and hidden default overflows */
          html, body {
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          /* Hide all other direct children of body to reclaim layout space completely */
          body > *:not(#label-studio-workspace) {
            display: none !important;
          }
          
          /* Unfold the modal background and framing panels completely so only the printable elements remain */
          #label-studio-workspace {
            display: block !important;
            position: relative !important;
            visibility: visible !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Force label print container and all its subelements to be visible */
          #label-studio-workspace-print-root, #label-studio-workspace-print-root * {
            visibility: visible !important;
          }
          
          /* Prime isolated container for natural stream layout flows */
          #label-studio-workspace-print-root {
            display: block !important;
            position: relative !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            width: auto !important;
            height: auto !important;
          }
          
          .page-break-after-always {
            page-break-after: always !important;
            break-after: page !important;
          }
          
          @page {
            margin: 0 !important;
            size: ${sheetMode 
              ? (AVERY_TEMPLATES.find(t => t.id === selectedAveryTemplateId)?.pageSize === 'a4' ? '210mm 297mm' : '8.5in 11in') 
              : `${canvasWidth}mm ${canvasHeight}mm`
            };
          }
        }
      `}} />

      <div className="bg-[#121214] text-neutral-100 w-full max-w-7xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[98vh] sm:max-h-[95vh] border border-neutral-800 print:hidden">
        
        {/* =========================================================
            HEADER & ACTIONS PANEL
            ========================================================= */}
        <div className="p-2.5 sm:p-5 bg-[#1a1a1e] border-b border-neutral-800 flex flex-row items-center justify-between gap-2 sm:gap-4 print:hidden select-none shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="bg-[#0066cc] p-2 sm:p-2.5 rounded-xl text-white shrink-0">
              <QrCode size={18} className="animate-pulse sm:w-[22px] sm:h-[22px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-xs sm:text-lg font-black tracking-tight uppercase font-sans truncate text-white">
                  Label Studio
                </h2>
                <span className="text-[8px] sm:text-[9px] uppercase font-black tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 sm:px-2 py-0.5 rounded shrink-0 hidden sm:inline-block">
                  v5.21.0
                </span>
              </div>
              <p className="text-xs text-neutral-400 hidden sm:block truncate">
                Professional Visual Editor & Adhesive Logistics Management for Packer.Tools
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 justify-end">
            <div className="flex bg-neutral-800 p-0.5 rounded-lg border border-neutral-700 text-xs shrink-0">
              <button 
                onClick={() => setSheetMode(false)}
                className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-bold transition flex items-center gap-1 text-[10px] sm:text-xs ${!sheetMode ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                <Tv size={11} className="sm:w-[13px] sm:h-[13px]" />
                <span><span className="hidden sm:inline">Continuous </span>Roll</span>
              </button>
              <button 
                onClick={() => setSheetMode(true)}
                className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-md font-bold transition flex items-center gap-1 text-[10px] sm:text-xs ${sheetMode ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                <Layout size={11} className="sm:w-[13px] sm:h-[13px]" />
                <span><span className="hidden sm:inline">Avery </span>Sheets</span>
              </button>
            </div>

            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700/80 text-white rounded-xl text-[10px] sm:text-xs font-black uppercase transition cursor-pointer shadow-md shrink-0"
              type="button"
              title="Download Label (PNG, JPG, PDF, SVG)"
            >
              <Download size={13} className="sm:w-[15px] sm:h-[15px] text-emerald-400" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={handleSystemPrint}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-5 py-1.5 sm:py-2.5 bg-[#0066cc] text-white rounded-xl text-[10px] sm:text-xs font-black uppercase hover:bg-opacity-95 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#0066cc]/20 shrink-0"
              type="button"
            >
              <Printer size={13} className="sm:w-[15px] sm:h-[15px]" />
              <span className="hidden sm:inline">Print {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Labels</span>
              <span className="inline sm:hidden">Print ({selectedIds.size})</span>
            </button>
            
            <button 
              onClick={onClose} 
              className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-xl transition text-neutral-400 hover:text-white cursor-pointer shrink-0"
              type="button"
            >
              <X size={18} className="sm:w-[20px] sm:h-[20px]" />
            </button>
          </div>
        </div>

        {/* =========================================================
            MOBILE VIEW SWITCHER (Visible on < lg screens)
            ========================================================= */}
        <div className="lg:hidden flex bg-[#131316] border-b border-neutral-800 p-1.5 gap-1 shrink-0 select-none z-30">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setMobilePanel('canvas');
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition ${
              mobilePanel === 'canvas'
                ? 'bg-[#0066cc] text-white shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <QrCode size={12} />
            <span>Canvas View</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setMobilePanel(mobilePanel === 'tools' ? 'canvas' : 'tools');
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition ${
              mobilePanel === 'tools'
                ? 'bg-[#ff4f3a] text-white shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Paintbrush size={12} />
            <span>Studio Tools</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setMobilePanel(mobilePanel === 'inspector' ? 'canvas' : 'inspector');
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition relative ${
              mobilePanel === 'inspector'
                ? 'bg-[#0066cc] text-white shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <SlidersHorizontal size={12} />
            <span>Inspector</span>
            {selectedElementId && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* =========================================================
            MAIN WORKSPACE: SPLIT PANEL LAYOUT
            ========================================================= */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row print:block relative">
          
          {/* 1. LEFT PANEL: TOOLBOX (Width: Resizable on desktop / Slide-up Sheet on Mobile) */}
          <div 
            className={`w-full border-r border-neutral-800 flex-col shrink-0 bg-[#16161a] overflow-hidden print:hidden select-none transition-all duration-200 ${
              mobilePanel === 'tools' 
                ? 'absolute inset-x-0 bottom-0 z-40 h-[65vh] rounded-t-3xl border-t-2 border-[#ff4f3a] shadow-2xl flex lg:relative lg:inset-auto lg:h-auto lg:rounded-none lg:border-t-0 lg:shadow-none lg:flex' 
                : 'hidden lg:flex'
            }`}
            style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${leftPanelWidth}px` : undefined }}
          >
            {/* Mobile Bottom Sheet Header */}
            <div className="lg:hidden p-2.5 bg-[#111114] border-b border-neutral-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-1 bg-neutral-600 rounded-full mx-auto" />
                <span className="text-xs font-black uppercase text-white tracking-wider">Studio Tools</span>
              </div>
              <button
                type="button"
                onClick={() => setMobilePanel('canvas')}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold transition"
              >
                Done
              </button>
            </div>
            {/* HORIZONTAL TAB BAR FOR MOBILE */}
            <div className="lg:hidden flex bg-[#101012] border-b border-neutral-800 p-2 gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {[
                { id: 'designs', icon: Paintbrush, label: 'Design' },
                { id: 'templates', icon: Layout, label: 'Presets' },
                { id: 'print', icon: Printer, label: 'Print' },
                { id: 'nfc', icon: Smartphone, label: 'NFC' },
                { id: 'rfid', icon: Cpu, label: 'RFID' },
                { id: 'batch', icon: Layers, label: 'Batch' },
                { id: 'devices', icon: Tv, label: 'Device' },
                { id: 'tag_inventory', icon: Grid, label: 'Stock' },
                { id: 'history', icon: HistoryIcon, label: 'Logs' },
                { id: 'settings', icon: Settings2, label: 'Specs' }
              ].map((tab) => {
                const IconComp = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 transition text-xs font-bold ${
                      isActive
                        ? 'bg-[#ff4f3a] text-white shadow-sm'
                        : 'bg-neutral-800/60 text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <IconComp size={13} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* DESKTOP VERTICAL ICON RAIL */}
              <div className="hidden lg:flex w-[58px] bg-[#101012] border-r border-neutral-800 flex-col items-center py-3.5 space-y-2.5 shrink-0 overflow-y-auto no-scrollbar">
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
                  {userTemplates.length === 0 && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-200 text-xs space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider">
                        <Sparkles size={14} className="text-amber-400 animate-pulse shrink-0" />
                        <span>Save Custom Template</span>
                      </div>
                      <p className="text-[10px] text-neutral-300 leading-relaxed">
                        No custom label layout is set up yet. Use the canvas to customize your layout. When ready, enter a template name in the publisher below and click <strong>Save to Studio Cloud</strong> to make it a reusable template for future printings!
                      </p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Dynamic Fields</h3>
                    <p className="text-[10px] text-neutral-500 leading-relaxed mt-0.5">
                      Inserts custom variables which replace dynamically based on the active preview asset parameters.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 pt-2">
                      {['brand', 'name', 'assetTag', 'serial', 'model', 'category', 'status', 'condition', 'ownerName', 'ownerPhone', 'ownerEmail', 'ownerBio'].map((f) => {
                        const labels: Record<string, string> = {
                          assetTag: 'Asset Tag',
                          ownerName: 'Custodian Name',
                          ownerPhone: 'Custodian Phone',
                          ownerEmail: 'Custodian Email',
                          ownerBio: 'Custodian Bio'
                        };
                        return (
                          <button
                            key={f}
                            type="button"
                            onClick={() => addDynamicField(f)}
                            className="py-1.5 px-2 bg-[#1e1e24] hover:bg-[#25252d] border border-neutral-800 text-neutral-300 rounded-lg text-left text-[11px] font-bold transition flex items-center gap-1"
                          >
                            <Type size={10} className="text-[#ff4f3a]" />
                            <span className="truncate">{labels[f] || f}</span>
                          </button>
                        );
                      })}
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
                  {currentRecommendation && activePreviewItem && (
                    <div className="p-3 bg-gradient-to-br from-amber-500/10 to-[#ff4f3a]/10 border border-amber-500/30 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <Sparkles size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Smart Label Recommendation</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-neutral-400">Target Item:</span>
                          <span className="text-white font-semibold truncate max-w-[140px]">{activePreviewItem.name}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-neutral-400">Category:</span>
                          <span className="text-amber-300 font-semibold">{activePreviewItem.category || 'Other'}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-neutral-400">Label Type:</span>
                          <span className="text-neutral-200">
                            {PRESET_STUDIO_TEMPLATES.find(t => t.id === currentRecommendation.suggestedTemplateId)?.name || 'Standard'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-neutral-400 font-bold">Dimensions:</span>
                          <span className="text-neutral-200 font-mono text-[10px]">{currentRecommendation.labelDimensions.width}x{currentRecommendation.labelDimensions.height}mm</span>
                        </div>
                        <div className="pt-1.5 border-t border-neutral-800/80 space-y-1">
                          <div>
                            <span className="text-[8px] font-black uppercase tracking-wider text-neutral-500 block">Recommended Printer Tech</span>
                            <span className="text-[10px] text-neutral-300 font-semibold">{currentRecommendation.recommendedPrinterType}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black uppercase tracking-wider text-neutral-500 block">Recommended Material</span>
                            <span className="text-[10px] text-neutral-300 font-semibold">{currentRecommendation.recommendedMaterial}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black uppercase tracking-wider text-neutral-500 block">Print Settings Specs</span>
                            <div className="grid grid-cols-2 gap-1 text-[9px] text-neutral-400 font-mono mt-0.5">
                              <div>Method: <span className="text-neutral-200">{currentRecommendation.printSettings.printMethod}</span></div>
                              <div>Resolution: <span className="text-neutral-200">{currentRecommendation.printSettings.resolution}</span></div>
                              <div>Speed: <span className="text-neutral-200">{currentRecommendation.printSettings.speed} IPS</span></div>
                              <div>Darkness: <span className="text-neutral-200">{currentRecommendation.printSettings.darkness}</span></div>
                            </div>
                          </div>
                          <div className="text-[10px] text-neutral-400 italic leading-relaxed pt-1 border-t border-neutral-800/40">
                            "{currentRecommendation.justification}"
                          </div>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          const suggestedTpl = PRESET_STUDIO_TEMPLATES.find(t => t.id === currentRecommendation.suggestedTemplateId);
                          if (suggestedTpl) {
                            setCanvasWidth(suggestedTpl.width);
                            setCanvasHeight(suggestedTpl.height);
                            setCanvasLayout(suggestedTpl.layout);
                            setCanvasElements(JSON.parse(JSON.stringify(suggestedTpl.elements)));
                            setSelectedElementId(null);
                            setSelectedElementIds([]);
                            toast.success(`Applied ${suggestedTpl.name} layout!`);
                          }
                        }}
                        className="w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white font-bold text-[9px] uppercase rounded-lg border border-amber-500/30 transition flex items-center justify-center gap-1"
                      >
                        <Sparkles size={11} />
                        Apply Optimal Preset Layout
                      </button>
                    </div>
                  )}

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

                  {globalTemplates.length > 0 && (
                    <div className="pt-3 border-t border-neutral-800/60 space-y-2">
                      <div className="flex items-center gap-1">
                        <Share2 size={12} className="text-emerald-400" />
                        <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Global Shared Templates</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {globalTemplates.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => loadPresetTemplate(tmpl)}
                            className="p-3 bg-emerald-950/20 hover:bg-emerald-950/40 rounded-xl border border-dashed border-emerald-800/60 text-left transition flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-xs text-emerald-200">{tmpl.name}</p>
                              <p className="text-[10px] text-emerald-500 mt-0.5">{tmpl.width}x{tmpl.height}mm • Shared Global</p>
                            </div>
                            <Share2 size={13} className="text-emerald-500" />
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

                  {/* Crop Marks & Offsets Calibration block */}
                  <div className="pt-4 border-t border-neutral-800/60 space-y-3">
                    <h4 className="text-xs font-black uppercase text-neutral-300 tracking-wider">Calibration & Overlay</h4>
                    
                    <label className="flex items-center gap-3 p-2.5 bg-[#1e1e24]/40 border border-neutral-800 rounded-xl hover:bg-[#1e1e24]/70 transition cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={showCropMarks}
                        onChange={(e) => setShowCropMarks(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-800 text-[#ff4f3a] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-white tracking-widest">Show Crop & Trim Marks</p>
                        <p className="text-[9px] text-neutral-500">Renders alignment corner indicators for manual cutting</p>
                      </div>
                    </label>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Alignment Offsets (Calibration)</span>
                        <button 
                          onClick={() => { setPrintOffsetX(0); setPrintOffsetY(0); }}
                          className="text-[9px] text-neutral-500 hover:text-white underline font-bold"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#1e1e24] border border-neutral-800 p-2 rounded-xl">
                          <label className="text-[8px] font-black uppercase tracking-wider text-neutral-500 block mb-1">X-Offset (Horizontal)</label>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              step="0.5"
                              value={printOffsetX}
                              onChange={(e) => setPrintOffsetX(parseFloat(e.target.value) || 0)}
                              className="bg-transparent text-white font-mono text-xs w-full focus:outline-none border-none p-0"
                            />
                            <span className="text-[9px] text-neutral-500 font-bold">mm</span>
                          </div>
                        </div>
                        <div className="bg-[#1e1e24] border border-neutral-800 p-2 rounded-xl">
                          <label className="text-[8px] font-black uppercase tracking-wider text-neutral-500 block mb-1">Y-Offset (Vertical)</label>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              step="0.5"
                              value={printOffsetY}
                              onChange={(e) => setPrintOffsetY(parseFloat(e.target.value) || 0)}
                              className="bg-transparent text-white font-mono text-xs w-full focus:outline-none border-none p-0"
                            />
                            <span className="text-[9px] text-neutral-500 font-bold">mm</span>
                          </div>
                        </div>
                      </div>
                    </div>
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

              {/* TAB CONTENT: BATCH SELECTION & MULTI-PAGE PDF */}
              {activeTab === 'batch' && (
                <div className="space-y-4">
                  {/* Top Stats & Summary Card */}
                  <div className="p-3 bg-[#131316] border border-neutral-800 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers size={14} className="text-[#ff4f3a]" />
                        <h3 className="text-xs font-black uppercase text-white tracking-wider">Batch Print Queue</h3>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        {selectedIds.size} Assets Selected
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-[#1c1c22] p-2 rounded-xl border border-neutral-800">
                        <span className="text-[8px] font-black uppercase tracking-wider text-neutral-500 block">Queue Assets</span>
                        <span className="text-sm font-black text-white font-mono">{selectedIds.size}</span>
                      </div>
                      <div className="bg-[#1c1c22] p-2 rounded-xl border border-neutral-800">
                        <span className="text-[8px] font-black uppercase tracking-wider text-neutral-500 block">Copies / Item</span>
                        <span className="text-sm font-black text-amber-400 font-mono">{copiesPerItem}x</span>
                      </div>
                      <div className="bg-[#1c1c22] p-2 rounded-xl border border-neutral-800">
                        <span className="text-[8px] font-black uppercase tracking-wider text-neutral-500 block">Total Labels</span>
                        <span className="text-sm font-black text-emerald-400 font-mono">{selectedItemsToPrint.length}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/60 font-semibold">
                      <span>Layout Mode:</span>
                      <span className="text-neutral-200 font-bold">
                        {sheetMode 
                          ? `Avery Sheet (${AVERY_TEMPLATES.find(t => t.id === selectedAveryTemplateId)?.name || 'Sheet'}, ${sheetPages.length} Page${sheetPages.length > 1 ? 's' : ''})` 
                          : `Continuous Roll (${selectedItemsToPrint.length} Page${selectedItemsToPrint.length > 1 ? 's' : ''})`}
                      </span>
                    </div>
                  </div>

                  {/* Layout & Stock Optimization Panel */}
                  <div className="p-3 bg-[#131316] border border-neutral-800 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Stock & Output Optimization</h4>

                    {/* Stock Mode Toggle */}
                    <div className="grid grid-cols-2 gap-1 bg-[#1a1a1f] p-1 rounded-xl border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setSheetMode(false)}
                        className={`py-1.5 text-[10px] font-extrabold uppercase rounded-lg transition ${!sheetMode ? 'bg-[#ff4f3a] text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                      >
                        Continuous Roll
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetMode(true)}
                        className={`py-1.5 text-[10px] font-extrabold uppercase rounded-lg transition ${sheetMode ? 'bg-[#ff4f3a] text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                      >
                        Avery Sheet Stock
                      </button>
                    </div>

                    {sheetMode && (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="text-[9px] text-neutral-500 font-black uppercase tracking-wider block mb-1">Standard Avery Template Stock</label>
                          <select
                            value={selectedAveryTemplateId}
                            onChange={(e) => setSelectedAveryTemplateId(e.target.value)}
                            className="w-full bg-[#1e1e24] border border-neutral-800 rounded-xl p-2 text-xs font-semibold text-white focus:outline-none focus:border-neutral-700"
                          >
                            {AVERY_TEMPLATES.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.columns * t.rows} / sheet, {t.pageSize.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] text-neutral-500 font-black uppercase tracking-wider block mb-1">Sheet #1 Start Slot Offset (Avoid waste)</label>
                          <select
                            value={sheetStartIndex}
                            onChange={(e) => setSheetStartIndex(parseInt(e.target.value) || 1)}
                            className="w-full bg-[#1e1e24] border border-neutral-800 rounded-xl p-2 text-xs font-semibold text-white focus:outline-none focus:border-neutral-700 font-mono"
                          >
                            {Array.from({ length: (AVERY_TEMPLATES.find(t => t.id === selectedAveryTemplateId)?.columns || 3) * (AVERY_TEMPLATES.find(t => t.id === selectedAveryTemplateId)?.rows || 10) }, (_, i) => i + 1).map(slot => (
                              <option key={slot} value={slot}>
                                Slot #{slot} {slot === 1 ? '(Top Left / First Slot)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Copies Multiplier & Resolution */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[9px] text-neutral-500 font-black uppercase tracking-wider block mb-1">Copies Per Asset</label>
                        <select
                          value={copiesPerItem}
                          onChange={(e) => setCopiesPerItem(parseInt(e.target.value) || 1)}
                          className="w-full bg-[#1e1e24] border border-neutral-800 rounded-xl p-2 text-xs font-semibold text-white focus:outline-none focus:border-neutral-700"
                        >
                          <option value={1}>1 Copy Each</option>
                          <option value={2}>2 Copies Each</option>
                          <option value={3}>3 Copies Each</option>
                          <option value={5}>5 Copies Each</option>
                          <option value={10}>10 Copies Each</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] text-neutral-500 font-black uppercase tracking-wider block mb-1">DPI Resolution</label>
                        <select
                          value={downloadScale}
                          onChange={(e) => setDownloadScale(parseInt(e.target.value) || 3)}
                          className="w-full bg-[#1e1e24] border border-neutral-800 rounded-xl p-2 text-xs font-semibold text-white focus:outline-none focus:border-neutral-700"
                        >
                          <option value={1.5}>150 DPI (Fast)</option>
                          <option value={3}>300 DPI (Standard Thermal)</option>
                          <option value={6}>600 DPI (Ultra Crisp Vector)</option>
                        </select>
                      </div>
                    </div>

                    {/* Primary Batch Export Buttons */}
                    <div className="space-y-2 pt-2">
                      <button
                        type="button"
                        disabled={isExporting || selectedIds.size === 0}
                        onClick={handleBatchPdfDownload}
                        className="w-full py-2.5 bg-gradient-to-r from-[#ff4f3a] to-amber-600 hover:from-[#ff3a21] hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isExporting ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>
                              {batchPdfProgress 
                                ? `Rendering Page ${batchPdfProgress.current} / ${batchPdfProgress.total}...` 
                                : 'Compiling Multi-Page PDF...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            <span>Generate Batch PDF ({selectedItemsToPrint.length} Labels)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={selectedIds.size === 0}
                        onClick={handleSystemPrint}
                        className="w-full py-2 bg-[#1e1e24] hover:bg-[#25252d] border border-neutral-800 text-neutral-300 hover:text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Printer size={13} />
                        <span>System Print / AirPrint Queue</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleClearPrinterCache}
                        title="Resets printer dynamic CSS cache, purges orphan print stylesheets and forces a DOM layout reflow if print layout renders incorrectly"
                        className="w-full py-1.5 bg-[#18181c] hover:bg-[#202028] border border-neutral-800/80 text-neutral-400 hover:text-amber-400 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw size={12} className="text-amber-500" />
                        <span>Clear Printer CSS Cache & Reflow Layout</span>
                      </button>
                    </div>
                  </div>

                  {/* Asset Selection Queue */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Select Assets For Printing</h4>
                      <button
                        type="button"
                        onClick={() => setIsAssetDrawerOpen(true)}
                        className="text-[9px] font-bold text-[#ff4f3a] hover:underline flex items-center gap-1"
                      >
                        <FolderOpen size={10} />
                        <span>Full Library Drawer</span>
                      </button>
                    </div>

                    {/* Search Field */}
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input
                        type="text"
                        placeholder="Search assets by tag, name, brand..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#1e1e24] border border-neutral-800 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold focus:outline-none focus:border-neutral-700 placeholder-neutral-500"
                      />
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex gap-1 overflow-x-auto pb-1 text-[9px] font-bold no-scrollbar">
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

                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl text-[9px] font-black uppercase tracking-wider transition mb-1"
                      >
                        {selectedIds.size === printableItemsList.length ? 'Deselect All' : 'Select All Filtered'}
                      </button>
                    </div>

                    {/* Printable list items */}
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                      {printableItemsList.map((item, idx) => {
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <div
                            key={`${item.id}-${idx}`}
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
        </div>

          {/* =========================================================
              DRAG RESIZE HANDLE: LEFT COLUMN
              ========================================================= */}
          <div
            onMouseDown={handleStartResizeLeft}
            onTouchStart={handleStartResizeLeft}
            onDoubleClick={() => setLeftPanelWidth(320)}
            title="Drag to resize column width (Double-click to reset)"
            className={`hidden lg:flex w-2.5 bg-[#101014] hover:bg-[#0066cc] border-x border-neutral-800/80 cursor-col-resize shrink-0 transition-colors items-center justify-center group z-20 select-none ${
              isResizingLeft ? 'bg-[#0066cc]' : ''
            }`}
          >
            <div className="w-0.5 h-10 bg-neutral-600 group-hover:bg-white rounded-full transition-colors" />
          </div>

          {/* =========================================================
              2. CENTER PANEL: LIVE DESIGN CANVAS (Width: Dynamic / Flexible)
              ========================================================= */}
          <div className="flex-1 bg-[#1a1a1e] flex flex-col overflow-hidden relative min-h-[300px]" id="design-editor-center-panel">
            
            {/* Visual Editor Action Toolbar */}
            <div className="p-2 sm:p-3 bg-[#131316] border-b border-neutral-800 flex items-center justify-between text-neutral-400 text-xs select-none shrink-0 print:hidden overflow-x-auto no-scrollbar gap-2">
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="font-black text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-widest hidden sm:inline">Workspace tools</span>
                
                <div className="h-4 w-px bg-neutral-800 hidden sm:block" />

                {/* Mobile Element Quick Inspector Indicator */}
                {selectedElementId && (
                  <button
                    type="button"
                    onClick={() => setMobilePanel('inspector')}
                    className="lg:hidden flex items-center gap-1 px-2 py-1 bg-[#0066cc]/20 border border-[#0066cc]/40 text-[#0066cc] rounded-lg text-[10px] font-bold"
                  >
                    <span>Selected</span>
                    <SlidersHorizontal size={11} />
                  </button>
                )}
                
                {/* Undo / Redo */}
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="p-1.5 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-25 flex items-center gap-1.5"
                  title="Undo Visual Change (Cmd+Z / Ctrl+Z)"
                >
                  <Undo2 size={14} />
                  <span className="text-[10px] font-extrabold hidden sm:inline">Undo</span>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-1.5 hover:bg-neutral-800 rounded text-neutral-300 hover:text-white transition disabled:opacity-25 flex items-center gap-1.5"
                  title="Redo Visual Change (Cmd+Shift+Z / Ctrl+Y)"
                >
                  <Redo2 size={14} />
                  <span className="text-[10px] font-extrabold hidden sm:inline">Redo</span>
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
                  type="button"
                  onClick={handleAutoFitZoom}
                  className="px-2 py-0.5 bg-[#0066cc]/20 border border-[#0066cc]/40 text-[#0066cc] hover:bg-[#0066cc]/30 rounded text-[10px] font-black uppercase transition shrink-0"
                  title="Auto-Fit Canvas to Screen Width"
                >
                  Fit
                </button>
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
                                className={`bg-white text-black relative overflow-hidden flex flex-col justify-stretch ${
                                  template.isPlainPaper 
                                    ? 'border-2 border-dashed border-neutral-400 print:border-2 print:border-dashed print:border-neutral-500' 
                                    : 'border border-neutral-200 print:border-transparent'
                                }`}
                                style={{
                                  width: `${template.labelWidth}mm`,
                                  height: `${template.labelHeight}mm`,
                                  boxSizing: 'border-box'
                                }}
                              >
                                {template.isPlainPaper && (
                                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-neutral-100 rounded text-[6px] font-black uppercase text-neutral-500 tracking-wider flex items-center gap-1 z-10 print:bg-neutral-100">
                                    <span>✂️ CUT GUIDE</span>
                                  </div>
                                 )}
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
                                          <QRCodeSVG
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
                      onContextMenu={(e) => handleContextMenu(e, null)}
                      onTouchStart={(e) => handleTouchStartContext(e, null)}
                      onTouchMove={handleTouchMoveContext}
                      onTouchEnd={handleTouchEndContext}
                      className="bg-white text-black shadow-2xl relative transition-all overflow-hidden border border-neutral-200 select-none print:shadow-none print:border-none shrink-0"
                      style={{
                        width: `${canvasWidth * 3.78 * canvasZoom}px`,
                        height: `${canvasHeight * 3.78 * canvasZoom}px`,
                        boxSizing: 'border-box',
                        borderRadius: canvasLayout === 'cable' ? '0' : '4px'
                      }}
                    >
                      {/* Dynamic Visual sub-grid overlays (Editor-Only) */}
                      {showGrid && (
                        <div 
                          className="editor-grid-overlay studio-editor-only absolute inset-0 pointer-events-none"
                          data-editor-only="true"
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

                      {/* Guides Layer (Editor-Only) */}
                      {showGuides && (
                        <div 
                          className="editor-guides-overlay studio-editor-only absolute inset-2 border border-dashed border-[#0066cc]/10 pointer-events-none"
                          data-editor-only="true"
                        >
                          <span className="absolute top-1 left-1 text-[5px] text-[#0066cc]/40 uppercase font-bold tracking-wider">Safe Area (2mm)</span>
                        </div>
                      )}

                      {/* Crop & Trim Marks Layer (Preserved during label export) */}
                      {showCropMarks && (
                        <div className="crop-marks-layer pointer-events-none select-none z-20 absolute inset-0">
                          <div className="crop-mark absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-neutral-500 pointer-events-none" style={{ marginTop: '-0.5px', marginLeft: '-0.5px' }} />
                          <div className="crop-mark absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-neutral-500 pointer-events-none" style={{ marginTop: '-0.5px', marginRight: '-0.5px' }} />
                          <div className="crop-mark absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-neutral-500 pointer-events-none" style={{ marginBottom: '-0.5px', marginLeft: '-0.5px' }} />
                          <div className="crop-mark absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-neutral-500 pointer-events-none" style={{ marginBottom: '-0.5px', marginRight: '-0.5px' }} />
                        </div>
                      )}

                      {/* Elements Loop on Live Canvas */}
                      {canvasElements.map((el) => {
                        const resolvedText = el.type === 'text' ? parseDynamicVariables(el.content, activePreviewItem) : '';
                        const isSelected = selectedElementIds.includes(el.id);

                        return (
                          <div
                            key={el.id}
                            onContextMenu={(e) => handleContextMenu(e, el.id)}
                            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                            onTouchStart={(e) => {
                              handleElementMouseDown(e, el.id);
                              handleTouchStartContext(e, el.id);
                            }}
                            onTouchMove={handleTouchMoveContext}
                            onTouchEnd={handleTouchEndContext}
                            className="absolute flex flex-col justify-center cursor-move select-none transition-shadow"
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
                                <QRCodeSVG
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

                            {/* Editor-Only Selection Box & Resize Corner Handles (Filtered out from exports) */}
                            {isSelected && (
                              <div 
                                className="selection-overlay selection-handle studio-editor-only absolute inset-0 ring-1 ring-[#0066cc] bg-[#0066cc]/5 border border-[#0066cc] pointer-events-none z-30"
                                data-editor-only="true"
                              >
                                <div
                                  onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'top-left')}
                                  onTouchStart={(e) => handleResizeMouseDown(e, el.id, 'top-left')}
                                  className="selection-handle studio-editor-only absolute -top-3 -left-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize z-30 touch-none pointer-events-auto"
                                  data-editor-only="true"
                                >
                                  <span className="w-2.5 h-2.5 bg-[#0066cc] border-2 border-white rounded-full shadow-md pointer-events-none" />
                                </div>
                                <div
                                  onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'top-right')}
                                  onTouchStart={(e) => handleResizeMouseDown(e, el.id, 'top-right')}
                                  className="selection-handle studio-editor-only absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nesw-resize z-30 touch-none pointer-events-auto"
                                  data-editor-only="true"
                                >
                                  <span className="w-2.5 h-2.5 bg-[#0066cc] border-2 border-white rounded-full shadow-md pointer-events-none" />
                                </div>
                                <div
                                  onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'bottom-left')}
                                  onTouchStart={(e) => handleResizeMouseDown(e, el.id, 'bottom-left')}
                                  className="selection-handle studio-editor-only absolute -bottom-3 -left-3 w-6 h-6 flex items-center justify-center cursor-nesw-resize z-30 touch-none pointer-events-auto"
                                  data-editor-only="true"
                                >
                                  <span className="w-2.5 h-2.5 bg-[#0066cc] border-2 border-white rounded-full shadow-md pointer-events-none" />
                                </div>
                                <div
                                  onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'bottom-right')}
                                  onTouchStart={(e) => handleResizeMouseDown(e, el.id, 'bottom-right')}
                                  className="selection-handle studio-editor-only absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize z-30 touch-none pointer-events-auto"
                                  data-editor-only="true"
                                >
                                  <span className="w-2.5 h-2.5 bg-[#0066cc] border-2 border-white rounded-full shadow-md pointer-events-none" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile Floating Quick Action Toolbar for Selected Element */}
              <AnimatePresence>
                {selectedElementId && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="lg:hidden absolute bottom-3 left-3 right-3 bg-[#111115]/95 backdrop-blur-md border border-neutral-700/80 p-2 rounded-2xl shadow-2xl flex items-center justify-around gap-1 z-30 select-none"
                  >
                    {/* Quick Edit */}
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setMobilePanel('inspector');
                      }}
                      className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 text-[9px] font-bold gap-0.5 active:scale-95 transition"
                    >
                      <Edit3 size={15} className="text-[#0066cc]" />
                      <span>Edit</span>
                    </button>

                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        if (selectedElementId) duplicateElement(selectedElementId);
                      }}
                      className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 text-[9px] font-bold gap-0.5 active:scale-95 transition"
                    >
                      <Copy size={15} className="text-emerald-400" />
                      <span>Duplicate</span>
                    </button>

                    {/* Center */}
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        handleCanvasAlign('center');
                        handleCanvasAlign('middle');
                      }}
                      className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 text-[9px] font-bold gap-0.5 active:scale-95 transition"
                    >
                      <AlignCenterHorizontal size={15} className="text-amber-400" />
                      <span>Center</span>
                    </button>

                    {/* Front */}
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        handleLayerOrder('front');
                      }}
                      className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 text-[9px] font-bold gap-0.5 active:scale-95 transition"
                    >
                      <Layers size={15} className="text-purple-400" />
                      <span>Front</span>
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => {
                        hapticMedium();
                        if (selectedElementId) deleteElement(selectedElementId);
                      }}
                      className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 text-[9px] font-bold gap-0.5 active:scale-95 transition"
                    >
                      <Trash2 size={15} />
                      <span>Delete</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* =========================================================
                3. BOTTOM PANEL: LIVE PREVIEW SWITCHER & ASSET DOCK
                ========================================================= */}
            <div className={`border-t border-neutral-800 bg-[#16161a] p-2.5 sm:p-3.5 flex flex-col shrink-0 print:hidden select-none transition-all duration-300 ${
              isDockExpanded ? 'h-64 sm:h-72' : 'h-32 sm:h-36'
            }`}>
              {/* Dock Header */}
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0066cc] animate-ping" />
                  <span className="text-[10px] font-black uppercase text-white tracking-wider">Live Preview Context & Asset Dock</span>
                  {(() => {
                    const activeItem = items.find(i => i.id === previewItemId);
                    if (!activeItem) return null;
                    return (
                      <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0066cc]/15 border border-[#0066cc]/30 text-[#0066cc] text-[9px] font-bold">
                        <Check size={10} /> Active Context: {activeItem.name} [{activeItem.assetTag || 'TAG-PENDING'}]
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setIsAssetDrawerOpen(true);
                    }}
                    className="px-3 py-1 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-[#0066cc]/20"
                  >
                    <Search size={12} />
                    <span>Search & Asset Navigator</span>
                    <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[9px] font-mono">
                      {selectedIds.size} Queued
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setIsDockExpanded(!isDockExpanded);
                    }}
                    className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-700 rounded-lg transition"
                    title={isDockExpanded ? 'Collapse Asset Dock' : 'Expand Asset Dock'}
                  >
                    {isDockExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                </div>
              </div>

              {/* Dock Body: Assets Carousel or Expanded Grid */}
              <div className="flex-1 overflow-hidden pt-2">
                {!isDockExpanded ? (
                  /* Horizontal Scroll Carousel */
                  <div className="h-full overflow-x-auto flex items-center gap-2.5 pb-1 no-scrollbar">
                    {/* Active Asset Featured Card */}
                    {(() => {
                      const activeItem = items.find(i => i.id === previewItemId);
                      if (!activeItem) return null;
                      return (
                        <div className="px-3 py-2 rounded-xl bg-[#0066cc]/15 border-2 border-[#0066cc] text-white shrink-0 flex items-center gap-2.5 shadow-lg shadow-[#0066cc]/10 max-w-[200px]">
                          <div className="p-2 rounded-lg bg-[#0066cc] text-white shrink-0">
                            <Tag size={14} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[8px] font-black uppercase tracking-widest text-[#0066cc] block">Active Preview</span>
                            <p className="font-extrabold text-[11px] truncate text-white">{activeItem.name}</p>
                            <p className="text-[9px] text-neutral-300 font-mono truncate">{activeItem.assetTag || 'TAG-PENDING'}</p>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="h-8 w-px bg-neutral-800 shrink-0 my-auto" />

                    {/* Fast Switcher Cards */}
                    {items.map((item, idx) => {
                      const isCurrent = previewItemId === item.id;
                      const isQueued = selectedIds.has(item.id);
                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          className={`px-3 py-2 rounded-xl border transition duration-150 shrink-0 flex items-center gap-2.5 ${
                            isCurrent 
                              ? 'bg-[#0066cc]/10 border-[#0066cc] text-white' 
                              : 'bg-[#1e1e24] border-neutral-800/80 text-neutral-400 hover:bg-[#25252d] hover:border-neutral-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              setPreviewItemId(item.id);
                            }}
                            className="flex items-center gap-2 text-left min-w-0"
                          >
                            <div className={`p-1.5 rounded-lg shrink-0 ${isCurrent ? 'bg-[#0066cc] text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                              <Box size={12} />
                            </div>
                            <div className="min-w-0 w-28">
                              <p className={`font-extrabold text-[11px] truncate ${isCurrent ? 'text-white' : 'text-neutral-200'}`}>{item.name}</p>
                              <p className="text-[9px] font-mono text-neutral-400 truncate mt-0.5">{item.brand || 'General'} • {item.assetTag || 'TAG-PENDING'}</p>
                            </div>
                          </button>

                          {/* Quick Queue Toggle Checkbox */}
                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              toggleSelectId(item.id);
                            }}
                            className={`p-1.5 rounded-lg border transition shrink-0 ${
                              isQueued ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-neutral-700 bg-neutral-900 text-neutral-500 hover:text-white'
                            }`}
                            title={isQueued ? 'In Batch Print Queue' : 'Add to Batch Print Queue'}
                          >
                            {isQueued ? <CheckSquare size={12} /> : <Square size={12} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Expanded Fast Grid View */
                  <div className="h-full overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {items.map((item, idx) => {
                      const isCurrent = previewItemId === item.id;
                      const isQueued = selectedIds.has(item.id);
                      return (
                        <div
                          key={`expanded-${item.id}-${idx}`}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                            isCurrent
                              ? 'bg-[#0066cc]/15 border-[#0066cc] text-white'
                              : 'bg-[#1e1e24] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-extrabold text-[11px] truncate text-white">{item.name}</p>
                            <p className="text-[9px] text-neutral-400 truncate mt-0.5">{item.brand || 'General'} • {item.assetTag || 'NO-TAG'}</p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                hapticLight();
                                setPreviewItemId(item.id);
                              }}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition ${
                                isCurrent ? 'bg-[#0066cc] text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                              }`}
                            >
                              {isCurrent ? 'Active' : 'Preview'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                hapticLight();
                                toggleSelectId(item.id);
                              }}
                              className={`p-1 rounded-lg border transition ${
                                isQueued ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-neutral-700 bg-neutral-900 text-neutral-500'
                              }`}
                            >
                              {isQueued ? <CheckSquare size={12} /> : <Square size={12} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* =========================================================
              DRAG RESIZE HANDLE: RIGHT COLUMN
              ========================================================= */}
          <div
            onMouseDown={handleStartResizeRight}
            onTouchStart={handleStartResizeRight}
            onDoubleClick={() => setRightPanelWidth(320)}
            title="Drag to resize column width (Double-click to reset)"
            className={`hidden lg:flex w-2.5 bg-[#101014] hover:bg-[#0066cc] border-x border-neutral-800/80 cursor-col-resize shrink-0 transition-colors items-center justify-center group z-20 select-none ${
              isResizingRight ? 'bg-[#0066cc]' : ''
            }`}
          >
            <div className="w-0.5 h-10 bg-neutral-600 group-hover:bg-white rounded-full transition-colors" />
          </div>

          {/* =========================================================
              4. RIGHT PANEL: PROPERTIES INSPECTOR (Width: Resizable on desktop / Slide-up Sheet on Mobile)
              ========================================================= */}
          <div 
            className={`w-full border-l border-neutral-800 flex-col shrink-0 bg-[#16161a] overflow-hidden print:hidden select-none transition-all duration-200 ${
              mobilePanel === 'inspector' 
                ? 'absolute inset-x-0 bottom-0 z-40 h-[65vh] rounded-t-3xl border-t-2 border-[#0066cc] shadow-2xl flex lg:relative lg:inset-auto lg:h-auto lg:rounded-none lg:border-t-0 lg:shadow-none lg:flex' 
                : 'hidden lg:flex'
            }`}
            style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${rightPanelWidth}px` : undefined }}
          >
            {/* Mobile Bottom Sheet Header */}
            <div className="lg:hidden p-2.5 bg-[#111114] border-b border-neutral-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-1 bg-neutral-600 rounded-full mx-auto" />
                <span className="text-xs font-black uppercase text-white tracking-wider">Properties Inspector</span>
              </div>
              <button
                type="button"
                onClick={() => setMobilePanel('canvas')}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold transition"
              >
                Done
              </button>
            </div>
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
                    
                    <div className="flex gap-2 p-1 bg-[#141416] border border-neutral-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setTemplateScope('user')}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                          templateScope === 'user' 
                            ? 'bg-[#1e1e24] border border-neutral-800 text-white shadow-sm' 
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        Personal (User)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplateScope('global')}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1 ${
                          templateScope === 'global' 
                            ? 'bg-emerald-600 text-white shadow-sm' 
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        <Share2 size={10} />
                        Global (Org)
                      </button>
                    </div>

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

      {/* Floating Right-Click & Long-Press Context Menu */}
      {contextMenu && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[99999] bg-[#18181c] border border-neutral-700/80 rounded-xl shadow-2xl p-1.5 min-w-[220px] text-xs text-neutral-200 select-none backdrop-blur-xl"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.elementId ? (
              <>
                <div className="px-2.5 py-1.5 text-[10px] font-black uppercase text-neutral-400 tracking-wider border-b border-neutral-800/80 flex items-center justify-between">
                  <span>Selected Element</span>
                  <span className="text-[#0066cc] font-mono text-[9px]">{contextMenu.elementId.slice(0, 8)}</span>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setMobilePanel('inspector');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#0066cc]/20 hover:text-[#0066cc] rounded-md flex items-center justify-between transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Edit3 size={13} /> Edit Properties
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      if (contextMenu.elementId) duplicateElement(contextMenu.elementId);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 rounded-md flex items-center justify-between transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Copy size={13} /> Duplicate Element
                    </span>
                    <span className="text-[9px] font-mono text-neutral-500">Ctrl+D</span>
                  </button>

                  <div className="h-px bg-neutral-800/80 my-1" />

                  <button
                    onClick={() => {
                      handleLayerOrder('front');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 rounded-md flex items-center justify-between transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Layers size={13} /> Bring to Front
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      handleLayerOrder('back');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 rounded-md flex items-center justify-between transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Layers size={13} className="rotate-180" /> Send to Back
                    </span>
                  </button>

                  <div className="h-px bg-neutral-800/80 my-1" />

                  <button
                    onClick={() => {
                      handleCanvasAlign('center');
                      handleCanvasAlign('middle');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 rounded-md flex items-center justify-between transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <AlignCenterHorizontal size={13} /> Center on Canvas
                    </span>
                  </button>

                  <div className="h-px bg-neutral-800/80 my-1" />

                  <button
                    onClick={() => {
                      handleExecuteDownload('png');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-500/15 hover:text-emerald-400 rounded-md flex items-center justify-between transition font-medium text-emerald-300"
                  >
                    <span className="flex items-center gap-2">
                      <Download size={13} /> Download Label (PNG)
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      handleExecuteDownload('pdf');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-500/15 hover:text-emerald-400 rounded-md flex items-center justify-between transition font-medium text-emerald-300"
                  >
                    <span className="flex items-center gap-2">
                      <Printer size={13} /> Download Label (PDF)
                    </span>
                  </button>

                  <div className="h-px bg-neutral-800/80 my-1" />

                  <button
                    onClick={() => {
                      if (contextMenu.elementId) deleteElement(contextMenu.elementId);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-400 rounded-md flex items-center justify-between transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 size={13} /> Delete Element
                    </span>
                    <span className="text-[9px] font-mono text-rose-400/60">Del</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-2.5 py-1.5 text-[10px] font-black uppercase text-neutral-400 tracking-wider border-b border-neutral-800/80">
                  Canvas Actions
                </div>
                <div className="py-1 space-y-0.5">
                  <button
                    onClick={() => {
                      addTextElement();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 rounded-md flex items-center justify-between transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Type size={13} /> Add Text Box
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      addQrElement();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 rounded-md flex items-center justify-between transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <QrCode size={13} /> Add QR Code
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      addShapeElement('rectangle');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 rounded-md flex items-center justify-between transition font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Layout size={13} /> Add Shape
                    </span>
                  </button>

                  <div className="h-px bg-neutral-800/80 my-1" />

                  <button
                    onClick={() => {
                      handleUndo();
                      setContextMenu(null);
                    }}
                    disabled={undoStack.length === 0}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 rounded-md flex items-center justify-between transition font-medium disabled:opacity-30"
                  >
                    <span className="flex items-center gap-2">
                      <Undo2 size={13} /> Undo
                    </span>
                    <span className="text-[9px] font-mono text-neutral-500">Ctrl+Z</span>
                  </button>

                  <button
                    onClick={() => {
                      handleRedo();
                      setContextMenu(null);
                    }}
                    disabled={redoStack.length === 0}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 rounded-md flex items-center justify-between transition font-medium disabled:opacity-30"
                  >
                    <span className="flex items-center gap-2">
                      <Redo2 size={13} /> Redo
                    </span>
                    <span className="text-[9px] font-mono text-neutral-500">Ctrl+Y</span>
                  </button>

                  <div className="h-px bg-neutral-800/80 my-1" />

                  {/* QUICK DOWNLOAD DIRECT CONTEXT MENU ITEMS */}
                  <div className="px-2.5 py-1 text-[9px] font-black uppercase text-emerald-400 tracking-wider">
                    Download Label
                  </div>

                  <button
                    onClick={() => {
                      handleExecuteDownload('png');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-500/15 hover:text-emerald-400 rounded-md flex items-center justify-between transition font-medium text-neutral-200"
                  >
                    <span className="flex items-center gap-2">
                      <Download size={13} className="text-emerald-400" /> Save as PNG Image
                    </span>
                    <span className="text-[9px] font-mono text-neutral-500">.png</span>
                  </button>

                  <button
                    onClick={() => {
                      handleExecuteDownload('jpg');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-500/15 hover:text-emerald-400 rounded-md flex items-center justify-between transition font-medium text-neutral-200"
                  >
                    <span className="flex items-center gap-2">
                      <Download size={13} className="text-emerald-400" /> Save as JPG Image
                    </span>
                    <span className="text-[9px] font-mono text-neutral-500">.jpg</span>
                  </button>

                  <button
                    onClick={() => {
                      handleExecuteDownload('pdf');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-500/15 hover:text-emerald-400 rounded-md flex items-center justify-between transition font-medium text-neutral-200"
                  >
                    <span className="flex items-center gap-2">
                      <Printer size={13} className="text-emerald-400" /> Save as Printable PDF
                    </span>
                    <span className="text-[9px] font-mono text-neutral-500">.pdf</span>
                  </button>

                  <button
                    onClick={() => {
                      handleExecuteDownload('svg');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-500/15 hover:text-emerald-400 rounded-md flex items-center justify-between transition font-medium text-neutral-200"
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={13} className="text-emerald-400" /> Save as Vector SVG
                    </span>
                    <span className="text-[9px] font-mono text-neutral-500">.svg</span>
                  </button>

                  <div className="h-px bg-neutral-800/80 my-1" />

                  <button
                    onClick={() => {
                      setIsDownloadModalOpen(true);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#0066cc]/20 hover:text-[#0066cc] rounded-md flex items-center justify-between transition font-medium text-white"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal size={13} className="text-[#0066cc]" /> Download Options & Batch...
                    </span>
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Sleek Download & Export Options Modal */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-[999999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-[#18181c] border border-neutral-700/80 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-neutral-200"
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#131316] border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl">
                  <Download size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Download Label Design</h3>
                  <p className="text-[10px] text-neutral-400">Export high-resolution assets for printing & sharing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Specification Banner */}
              <div className="p-3 bg-neutral-900/80 rounded-xl border border-neutral-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-black text-neutral-500 tracking-wider block">Physical Size</span>
                  <span className="font-mono font-bold text-white text-sm">{canvasWidth}mm × {canvasHeight}mm</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-black text-neutral-500 tracking-wider block">Target Resolution</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{downloadScale * 100} DPI</span>
                </div>
              </div>

              {/* Format Selection Tabs */}
              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-2">
                  1. Select File Format
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'png', name: 'PNG', desc: 'High-Res Raster' },
                    { id: 'jpg', name: 'JPG', desc: 'Compressed' },
                    { id: 'pdf', name: 'PDF', desc: 'Ready to Print' },
                    { id: 'svg', name: 'SVG', desc: 'Pure Vector' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setDownloadFormat(fmt.id as LabelExportFormat)}
                      className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        downloadFormat === fmt.id
                          ? 'bg-[#0066cc]/20 border-[#0066cc] text-white shadow-md'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-xs font-black uppercase">{fmt.name}</span>
                      <span className="text-[8px] text-neutral-400 font-medium">{fmt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality & Scale Selection */}
              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-2">
                  2. Resolution Quality
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { scale: 1, label: '1x (72 DPI)', badge: 'Screen' },
                    { scale: 2, label: '2x (150 DPI)', badge: 'Standard' },
                    { scale: 3, label: '3x (300 DPI)', badge: 'Pro Print' },
                    { scale: 4, label: '4x (600 DPI)', badge: 'Ultra HD' },
                  ].map((item) => (
                    <button
                      key={item.scale}
                      type="button"
                      onClick={() => setDownloadScale(item.scale)}
                      className={`p-2 rounded-xl border text-center transition ${
                        downloadScale === item.scale
                          ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <div className="text-[11px] font-black">{item.scale}x</div>
                      <div className="text-[8px] text-neutral-400">{item.badge}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Color Options (For PNG & SVG) */}
              {(downloadFormat === 'png' || downloadFormat === 'svg') && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-2">
                    3. Background Canvas
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDownloadBg('white')}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                        downloadBg === 'white'
                          ? 'bg-neutral-800 border-white text-white'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full bg-white border border-neutral-400" />
                      <span>Solid White</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDownloadBg('transparent')}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                        downloadBg === 'transparent'
                          ? 'bg-neutral-800 border-emerald-400 text-white'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full bg-neutral-800 border border-neutral-600" />
                      <span>Transparent PNG</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Target Selection Range */}
              {selectedIds.size > 1 && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-2">
                    4. Export Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDownloadTarget('current')}
                      className={`p-2 rounded-xl border text-xs font-bold transition ${
                        downloadTarget === 'current'
                          ? 'bg-[#0066cc]/20 border-[#0066cc] text-white'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      Current Active Design
                    </button>

                    <button
                      type="button"
                      onClick={() => setDownloadTarget('selected')}
                      className={`p-2 rounded-xl border text-xs font-bold transition ${
                        downloadTarget === 'selected'
                          ? 'bg-[#0066cc]/20 border-[#0066cc] text-white'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      All Selected ({selectedIds.size} Items)
                    </button>
                  </div>
                </div>
              )}

              {/* Clean Export & Crop Marks Options */}
              <div>
                <label className="block text-[10px] font-black uppercase text-neutral-400 tracking-wider mb-2">
                  {selectedIds.size > 1 ? '5.' : '4.'} Print & Trim Guides
                </label>
                <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <div className="flex flex-col pr-3">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>✂️ Corner Crop Marks</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">Trim Lines</span>
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-0.5">
                      Exports clean design with precise corner trim lines (editor handles and background grids are always excluded)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCropMarks(!showCropMarks)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                      showCropMarks
                        ? 'bg-emerald-500 text-neutral-950 shadow-sm'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {showCropMarks ? 'Included' : 'Off'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#131316] border-t border-neutral-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleExecuteDownload()}
                disabled={isExporting}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Compiling File...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Download {downloadFormat.toUpperCase()}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* =========================================================
          ASSET NAVIGATOR & QR LABEL LIBRARY DRAWER MODAL
          ========================================================= */}
      {isAssetDrawerOpen && (
        <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            className="bg-[#141417] border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-neutral-200"
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-[#18181c] border-b border-neutral-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#0066cc] text-white rounded-2xl shadow-lg shadow-[#0066cc]/20 shrink-0">
                  <Package size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white uppercase tracking-tight">Asset Navigator & QR Label Library</h3>
                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      {drawerFilteredItems.length} Available
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 hidden sm:block">
                    Search and select inventory equipment records to bind live QR label canvases or assemble print queues.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-extrabold transition hidden sm:inline-flex items-center gap-1.5"
                >
                  <CheckSquare size={13} />
                  <span>{selectedIds.size === printableItemsList.length ? 'Deselect All' : 'Select All Filtered'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAssetDrawerOpen(false)}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="p-3 sm:p-4 bg-[#111114] border-b border-neutral-800/80 space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search by asset name, tag number, brand, model, or serial..."
                    value={drawerSearchQuery}
                    onChange={(e) => setDrawerSearchQuery(e.target.value)}
                    className="w-full bg-[#1c1c22] border border-neutral-800 rounded-2xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#0066cc] transition shadow-inner"
                  />
                  {drawerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDrawerSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 bg-[#1c1c22] border border-neutral-800 p-1 rounded-2xl text-xs">
                  {[
                    { id: 'all', label: 'All Status' },
                    { id: 'available', label: 'Available' },
                    { id: 'checked_out', label: 'Out' },
                    { id: 'maintenance', label: 'Repair' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setDrawerStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition ${
                        drawerStatusFilter === st.id
                          ? 'bg-[#0066cc] text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* View Switcher */}
                <div className="hidden sm:flex items-center gap-1 bg-[#1c1c22] border border-neutral-800 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setDrawerLayoutView('grid')}
                    className={`p-1.5 rounded-xl transition ${drawerLayoutView === 'grid' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
                    title="Grid View"
                  >
                    <Grid size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerLayoutView('list')}
                    className={`p-1.5 rounded-xl transition ${drawerLayoutView === 'list' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
                    title="Compact List View"
                  >
                    <List size={14} />
                  </button>
                </div>
              </div>

              {/* Category Pills Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-extrabold no-scrollbar">
                <button
                  type="button"
                  onClick={() => setDrawerCategory('all')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
                    drawerCategory === 'all'
                      ? 'bg-neutral-200 text-black shadow-sm'
                      : 'bg-[#1c1c22] text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  All Categories ({items.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDrawerCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
                      drawerCategory === cat
                        ? 'bg-neutral-200 text-black shadow-sm'
                        : 'bg-[#1c1c22] text-neutral-400 hover:bg-neutral-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Asset Items Display Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {drawerFilteredItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-4 bg-neutral-900 rounded-full border border-neutral-800 text-neutral-500">
                    <Search size={28} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">No Assets Match Your Search</h4>
                    <p className="text-xs text-neutral-500 mt-1">Try adjusting search keywords or clearing filter categories.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerSearchQuery('');
                      setDrawerCategory('all');
                      setDrawerStatusFilter('all');
                    }}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl transition"
                  >
                    Reset Search Filters
                  </button>
                </div>
              ) : drawerLayoutView === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {drawerFilteredItems.map((item) => {
                    const isPreview = previewItemId === item.id;
                    const isQueued = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition duration-200 flex flex-col justify-between space-y-3 relative overflow-hidden group ${
                          isPreview 
                            ? 'bg-[#0066cc]/15 border-[#0066cc] shadow-lg shadow-[#0066cc]/10' 
                            : isQueued 
                              ? 'bg-emerald-500/10 border-emerald-500/40' 
                              : 'bg-[#18181c] border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        {/* Top Badges */}
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300">
                            {item.category || 'Gear Asset'}
                          </span>
                          
                          <div className="flex items-center gap-1">
                            {isPreview && (
                              <span className="text-[8px] font-black uppercase tracking-wider bg-[#0066cc] text-white px-2 py-0.5 rounded-md">
                                Live Preview
                              </span>
                            )}
                            {item.status === 'Maintenance' ? (
                              <span className="text-[8px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-md">
                                Repair
                              </span>
                            ) : item.status === 'Checked Out' ? (
                              <span className="text-[8px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
                                Out
                              </span>
                            ) : (
                              <span className="text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                                Ready
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Body Details */}
                        <div>
                          <h4 className="font-black text-xs text-white truncate leading-snug">{item.name}</h4>
                          <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                            {item.brand || 'General'} {item.model ? `• ${item.model}` : ''}
                          </p>
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[9px] font-mono text-neutral-300">
                            <Tag size={10} className="text-[#0066cc]" />
                            <span>{item.assetTag || 'TAG-PENDING'}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-neutral-800/80 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              setPreviewItemId(item.id);
                              toast.success(`Active live preview bound to: ${item.name}`);
                            }}
                            className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1 ${
                              isPreview 
                                ? 'bg-[#0066cc] text-white' 
                                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                            }`}
                          >
                            <Eye size={12} />
                            <span>{isPreview ? 'Active' : 'Preview'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              toggleSelectId(item.id);
                            }}
                            className={`p-1.5 rounded-xl border transition flex items-center justify-center ${
                              isQueued 
                                ? 'bg-emerald-500 text-neutral-950 border-emerald-500' 
                                : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white'
                            }`}
                            title={isQueued ? 'Remove from Print Queue' : 'Queue for Printing'}
                          >
                            <CheckSquare size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Compact List View */
                <div className="space-y-1.5">
                  {drawerFilteredItems.map((item) => {
                    const isPreview = previewItemId === item.id;
                    const isQueued = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between ${
                          isPreview
                            ? 'bg-[#0066cc]/15 border-[#0066cc] text-white'
                            : isQueued
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                              : 'bg-[#18181c] border-neutral-800 hover:border-neutral-700 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-3">
                          <div className={`p-2 rounded-xl shrink-0 ${isPreview ? 'bg-[#0066cc] text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                            <Box size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-xs text-white truncate">{item.name}</p>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                                {item.assetTag || 'NO-TAG'}
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                              {item.brand || 'General'} • {item.category || 'Gear'} {item.serial ? `• S/N: ${item.serial}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              setPreviewItemId(item.id);
                              toast.success(`Live preview updated: ${item.name}`);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                              isPreview ? 'bg-[#0066cc] text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                            }`}
                          >
                            {isPreview ? 'Active Context' : 'Preview'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              toggleSelectId(item.id);
                            }}
                            className={`p-2 rounded-xl border transition ${
                              isQueued ? 'bg-emerald-500 text-neutral-950 border-emerald-500' : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                            }`}
                          >
                            {isQueued ? <CheckSquare size={14} /> : <Square size={14} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-[#18181c] border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="font-bold text-white">{selectedIds.size}</span> Assets Queued for Printing
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsAssetDrawerOpen(false)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Return to Canvas
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAssetDrawerOpen(false);
                    setActiveTab('batch');
                    toast.info(`Proceeding to batch print ${selectedIds.size} queued asset labels`);
                  }}
                  disabled={selectedIds.size === 0}
                  className="flex-1 sm:flex-none px-6 py-2 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-[#0066cc]/20 disabled:opacity-40"
                >
                  <Printer size={14} />
                  <span>Print {selectedIds.size} Queued Labels</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Perfect, Isolated Print Root Container */}
      <div 
        id="label-studio-workspace-print-root" 
        className="hidden print:block bg-white text-black p-0 m-0"
        style={{
          transform: `translate(${printOffsetX}mm, ${printOffsetY}mm)`,
          transformOrigin: 'top left'
        }}
      >
        {sheetMode ? (
          /* ======================== 📄 AVERY SHEETS PRINTING ======================== */
          <div className="flex flex-col items-center gap-0 p-0 m-0">
            {sheetPages.map((pageLabels, pageIdx) => {
              const template = AVERY_TEMPLATES.find(t => t.id === selectedAveryTemplateId) || AVERY_TEMPLATES[0];
              return (
                <div
                  key={`print-avery-page-${pageIdx}`}
                  id={`print-avery-page-${pageIdx}`}
                  className="bg-white print:m-0 print:border-none relative flex flex-col justify-start page-break-after-always overflow-hidden shrink-0"
                  style={{
                    width: template.pageSize === 'letter' ? '215.9mm' : '210mm',
                    height: template.pageSize === 'letter' ? '279.4mm' : '297mm',
                    paddingLeft: `${template.marginLeft}mm`,
                    paddingTop: `${template.marginTop}mm`,
                    boxSizing: 'border-box'
                  }}
                >
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
                            key={`print-empty-${pageIdx}-${slotIdx}`}
                            style={{
                              width: `${template.labelWidth}mm`,
                              height: `${template.labelHeight}mm`,
                              boxSizing: 'border-box'
                            }}
                          />
                        );
                      }

                      return (
                        <div
                          key={`print-label-${pageIdx}-${slotIdx}-${item.id}`}
                          className={`bg-white text-black relative overflow-hidden flex flex-col justify-stretch ${
                            template.isPlainPaper 
                              ? 'border-2 border-dashed border-neutral-500' 
                              : ''
                          }`}
                          style={{
                            width: `${template.labelWidth}mm`,
                            height: `${template.labelHeight}mm`,
                            boxSizing: 'border-box'
                          }}
                        >
                          {template.isPlainPaper && (
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-neutral-100 rounded text-[6px] font-black uppercase text-neutral-500 tracking-wider flex items-center gap-1 z-10">
                              <span>✂️ CUT GUIDE</span>
                            </div>
                          )}
                          {showCropMarks && (
                            <div className="absolute inset-0 pointer-events-none select-none z-50 print:block">
                              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-neutral-400 pointer-events-none" style={{ marginTop: '-0.5px', marginLeft: '-0.5px' }} />
                              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-neutral-400 pointer-events-none" style={{ marginTop: '-0.5px', marginRight: '-0.5px' }} />
                              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-neutral-400 pointer-events-none" style={{ marginBottom: '-0.5px', marginLeft: '-0.5px' }} />
                              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-neutral-400 pointer-events-none" style={{ marginBottom: '-0.5px', marginRight: '-0.5px' }} />
                            </div>
                          )}

                          {/* Core Elements Rendering in Avery Loop */}
                          {canvasElements.map((el) => {
                            const resolvedText = el.type === 'text' ? parseDynamicVariables(el.content, item) : '';
                            return (
                              <div
                                key={`print-el-${el.id}`}
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
                                    className="w-full overflow-hidden truncate leading-none uppercase text-black"
                                    style={{
                                      fontFamily: el.font === 'JetBrains Mono' ? 'monospace' : 'sans-serif',
                                      fontSize: `${el.fontSize || 8}pt`,
                                      fontWeight: el.fontWeight === 'black' ? 900 : (el.fontWeight === 'bold' ? 700 : 400),
                                      textAlign: el.align || 'left',
                                      color: el.color || '#000000',
                                      margin: 0,
                                      padding: 0
                                    }}
                                  >
                                    {resolvedText}
                                  </p>
                                )}
                                {el.type === 'qr' && (
                                  <div className="w-full h-full flex items-center justify-center p-0.5 bg-white border border-neutral-100">
                                    <QRCodeSVG
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
          /* ======================== 🖨️ CONTINUOUS THERMAL ROLL PRINTING ======================== */
          <div className="flex flex-col items-start gap-0 p-0 m-0">
            {selectedItemsToPrint.map((item, idx) => {
              return (
                <div
                  key={`print-roll-label-${item.id}-${idx}`}
                  id={`print-roll-label-${item.id}-${idx}`}
                  className="bg-white text-black relative overflow-hidden flex flex-col justify-stretch page-break-after-always shrink-0"
                  style={{
                    width: `${canvasWidth}mm`,
                    height: `${canvasHeight}mm`,
                    boxSizing: 'border-box'
                  }}
                >
                  {showCropMarks && (
                    <div className="absolute inset-0 pointer-events-none select-none z-50 print:block">
                      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-neutral-400 pointer-events-none" style={{ marginTop: '-0.5px', marginLeft: '-0.5px' }} />
                      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-neutral-400 pointer-events-none" style={{ marginTop: '-0.5px', marginRight: '-0.5px' }} />
                      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-neutral-400 pointer-events-none" style={{ marginBottom: '-0.5px', marginLeft: '-0.5px' }} />
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-neutral-400 pointer-events-none" style={{ marginBottom: '-0.5px', marginRight: '-0.5px' }} />
                    </div>
                  )}

                  {/* Elements Loop on Live Canvas */}
                  {canvasElements.map((el) => {
                    const resolvedText = el.type === 'text' ? parseDynamicVariables(el.content, item) : '';
                    return (
                      <div
                        key={`print-roll-el-${el.id}`}
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
                            className="w-full overflow-hidden truncate leading-none uppercase text-black"
                            style={{
                              fontFamily: el.font === 'JetBrains Mono' ? 'monospace' : 'sans-serif',
                              fontSize: `${el.fontSize || 8}pt`,
                              fontWeight: el.fontWeight === 'black' ? 900 : (el.fontWeight === 'bold' ? 700 : 400),
                              textAlign: el.align || 'left',
                              color: el.color || '#000000',
                              margin: 0,
                              padding: 0
                            }}
                          >
                            {resolvedText}
                          </p>
                        )}
                        {el.type === 'qr' && (
                          <div className="w-full h-full flex flex-col items-center justify-center p-0.5 bg-white border border-neutral-100 relative pointer-events-none">
                            <QRCodeSVG
                              value={getQrUrlValue(el, item)}
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
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
