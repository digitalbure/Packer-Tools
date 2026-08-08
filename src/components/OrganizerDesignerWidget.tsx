import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Square,
  Circle,
  Move,
  RotateCw,
  Trash2,
  Lock,
  Unlock,
  Copy,
  Tag,
  Palette,
  Sparkles,
  Save,
  Download,
  Grid,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  X,
  Package,
  Layers,
  Check,
  ChevronRight,
  ArrowUpRight,
  Info,
  RefreshCw,
  FolderOpen,
  Briefcase,
  Sliders,
  SlidersHorizontal,
  ChevronDown,
  Eye,
  List,
  Ruler,
  Crosshair,
  MousePointer,
  Maximize,
  Magnet,
  Group,
  Ungroup,
  BoxSelect
} from 'lucide-react';
import { Container, GearItem, PackingList, DesignerShape, DesignerSketch } from '../types';
import { generateOrganizerLayout } from '../services/geminiService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface OrganizerDesignerWidgetProps {
  container: Container;
  allGear: GearItem[];
  allPackingLists?: PackingList[];
  onSaveSuccess?: () => void;
  onClose?: () => void;
}

interface ContainerPresetInfo {
  id: string;
  name: string;
  dims: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  ratio: number;
}

const PRESET_CONTAINERS: ContainerPresetInfo[] = [
  { id: 'pelican_1510', name: 'Pelican 1510 Carry-On', dims: '559 x 351 x 229 mm', widthMm: 559, heightMm: 351, depthMm: 229, ratio: 1.59 },
  { id: 'pelican_1560', name: 'Pelican 1560 Medium Case', dims: '517 x 392 x 229 mm', widthMm: 517, heightMm: 392, depthMm: 229, ratio: 1.32 },
  { id: 'pelican_1650', name: 'Pelican 1650 Large Trunk', dims: '725 x 445 x 271 mm', widthMm: 725, heightMm: 445, depthMm: 271, ratio: 1.63 },
  { id: 'nanuk_935', name: 'Nanuk 935 Carry-On', dims: '521 x 287 x 191 mm', widthMm: 521, heightMm: 287, depthMm: 191, ratio: 1.81 },
  { id: 'trekpak_insert', name: 'TrekPak Padded Insert Grid', dims: '500 x 350 x 200 mm', widthMm: 500, heightMm: 350, depthMm: 200, ratio: 1.5 },
  { id: 'studio_drawer', name: 'Studio Equipment Drawer', dims: '600 x 450 x 180 mm', widthMm: 600, heightMm: 450, depthMm: 180, ratio: 1.33 },
  { id: 'backpack', name: 'Camera & Rig Backpack', dims: '320 x 480 x 200 mm', widthMm: 320, heightMm: 480, depthMm: 200, ratio: 0.67 },
  { id: 'custom', name: 'Custom Container Boundary', dims: '500 x 350 x 200 mm', widthMm: 500, heightMm: 350, depthMm: 200, ratio: 1.5 }
];

const COLOR_PALETTE = [
  { name: 'Coral Crimson', hex: '#ff4f3a', border: 'border-red-500', bg: 'bg-red-500/10' },
  { name: 'Sapphire Blue', hex: '#3b82f6', border: 'border-blue-500', bg: 'bg-blue-500/10' },
  { name: 'Emerald Green', hex: '#10b981', border: 'border-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'Amber Gold', hex: '#f59e0b', border: 'border-amber-500', bg: 'bg-amber-500/10' },
  { name: 'Amethyst Purple', hex: '#8b5cf6', border: 'border-purple-500', bg: 'bg-purple-500/10' },
  { name: 'Slate Gray', hex: '#64748b', border: 'border-slate-500', bg: 'bg-slate-500/10' },
  { name: 'Dark Charcoal', hex: '#1e293b', border: 'border-neutral-800', bg: 'bg-neutral-800/10' },
  { name: 'Teal Cyan', hex: '#14b8a6', border: 'border-teal-500', bg: 'bg-teal-500/10' }
];

interface DragState {
  type: 'move' | 'resize';
  shapeId: string;
  handle?: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
  startX: number; // percentage in canvas
  startY: number; // percentage in canvas
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  groupShapes?: {
    id: string;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  }[];
}

export const OrganizerDesignerWidget: React.FC<OrganizerDesignerWidgetProps> = ({
  container,
  allGear,
  allPackingLists = [],
  onSaveSuccess,
  onClose
}) => {
  // Canvas State
  const canvasRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<DesignerShape[]>(
    container.layoutSketch?.shapes || [
      { id: 'shape_1', label: 'Main Camera Bay', type: 'rectangle', x: 5, y: 5, width: 45, height: 50, color: '#ff4f3a' },
      { id: 'shape_2', label: 'Optics / Lens Well', type: 'circle', x: 55, y: 5, width: 40, height: 25, color: '#3b82f6' },
      { id: 'shape_3', label: 'Power Vault', type: 'rectangle', x: 55, y: 35, width: 40, height: 20, color: '#10b981' },
      { id: 'shape_4', label: 'Wireless Audio Compartment', type: 'rectangle', x: 5, y: 60, width: 90, height: 35, color: '#f59e0b' }
    ]
  );

  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set());

  // Primary selectedShapeId for single-selection compatibility
  const selectedShapeId = useMemo(() => {
    if (selectedShapeIds.size === 0) return null;
    return Array.from(selectedShapeIds)[0];
  }, [selectedShapeIds]);

  const setSelectedShapeId = (id: string | null) => {
    if (id === null) {
      setSelectedShapeIds(new Set());
    } else {
      const targetShape = shapes.find(s => s.id === id);
      if (targetShape?.groupId) {
        const groupShapeIds = shapes.filter(s => s.groupId === targetShape.groupId).map(s => s.id);
        setSelectedShapeIds(new Set(groupShapeIds));
      } else {
        setSelectedShapeIds(new Set([id]));
      }
    }
  };
  const [containerPreset, setContainerPreset] = useState<string>(
    container.layoutSketch?.containerType || 'pelican_1510'
  );

  // Marquee Selection Box State
  const [marqueeState, setMarqueeState] = useState<{
    startX: number;
    startY: number;
    currX: number;
    currY: number;
    isShift: boolean;
    initialSelectedIds: Set<string>;
  } | null>(null);

  // Grid & Snap Settings
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [gridType, setGridType] = useState<'dots' | 'lines' | 'mesh'>('dots');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(
    container.layoutSketch?.snapToGrid ?? true
  );
  const [magneticSnap, setMagneticSnap] = useState<boolean>(
    container.layoutSketch?.magneticSnap ?? true
  );
  const [gridSize, setGridSize] = useState<number>(5); // 5% snap increment
  const [activeGuides, setActiveGuides] = useState<{
    axis: 'x' | 'y';
    positionPct: number;
    label?: string;
    type?: 'edge' | 'center' | 'boundary';
    targetShapeId?: string;
  }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Measurements & Dimension Display Settings
  const [showMeasurements, setShowMeasurements] = useState<boolean>(true);
  const [measurementUnit, setMeasurementUnit] = useState<'mm' | 'in' | 'cm' | 'pct'>('mm');

  // Drawing & Drag Interaction State
  const [activeTool, setActiveTool] = useState<'select' | 'rectangle' | 'square' | 'circle' | 'divider-v' | 'divider-h' | 'foam-cutout'>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawRect, setCurrentDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    shapeId?: string;
  }>({ visible: false, x: 0, y: 0 });

  // AI Modal State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiSource, setAiSource] = useState<'gear' | 'packing_list'>('gear');
  const [selectedGearIdsForAI, setSelectedGearIdsForAI] = useState<Set<string>>(new Set(container.items || []));
  const [selectedListIdForAI, setSelectedListIdForAI] = useState<string>('');
  const [aiPriority, setAiPriority] = useState<'protection' | 'density' | 'workflow'>('protection');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiNotes, setAiNotes] = useState<string>('');

  // Export Menu State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Side Tray State
  const [trayTab, setTrayTab] = useState<'gear' | 'layers' | 'settings'>('gear');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnassigned, setFilterUnassigned] = useState(false);

  // Active Preset & Dimension Helpers
  const activePreset = useMemo(() => {
    return PRESET_CONTAINERS.find(p => p.id === containerPreset) || PRESET_CONTAINERS[0];
  }, [containerPreset]);

  const containerWidthMm = activePreset.widthMm;
  const containerHeightMm = activePreset.heightMm;

  // Measurement Formatters
  const formatDimensions = (pctW: number, pctH: number) => {
    const wMm = Math.round((pctW / 100) * containerWidthMm);
    const hMm = Math.round((pctH / 100) * containerHeightMm);

    if (measurementUnit === 'in') {
      const wIn = (wMm / 25.4).toFixed(1);
      const hIn = (hMm / 25.4).toFixed(1);
      return `${wIn}″ × ${hIn}″`;
    }
    if (measurementUnit === 'cm') {
      const wCm = (wMm / 10).toFixed(1);
      const hCm = (hMm / 10).toFixed(1);
      return `${wCm} × ${hCm} cm`;
    }
    if (measurementUnit === 'pct') {
      return `${Math.round(pctW)}% × ${Math.round(pctH)}%`;
    }
    return `${wMm} × ${hMm} mm`;
  };

  const formatSingleLength = (pctLength: number, axis: 'x' | 'y') => {
    const totalMm = axis === 'x' ? containerWidthMm : containerHeightMm;
    const mmVal = Math.round((pctLength / 100) * totalMm);

    if (measurementUnit === 'in') {
      return `${(mmVal / 25.4).toFixed(1)} in`;
    }
    if (measurementUnit === 'cm') {
      return `${(mmVal / 10).toFixed(1)} cm`;
    }
    if (measurementUnit === 'pct') {
      return `${Math.round(pctLength)}%`;
    }
    return `${mmVal} mm`;
  };

  // Active Selected Shape Helper
  const selectedShape = useMemo(() => {
    return shapes.find(s => s.id === selectedShapeId) || null;
  }, [shapes, selectedShapeId]);

  // Map assigned gear items across shapes
  const assignedGearMap = useMemo(() => {
    const map = new Map<string, string>(); // gearId -> shapeLabel
    shapes.forEach(s => {
      s.assignedGearIds?.forEach(gid => {
        map.set(gid, s.label);
      });
    });
    return map;
  }, [shapes]);

  // Grouping Helpers & Selected Shapes Memoization
  const selectedShapes = useMemo(() => {
    return shapes.filter(s => selectedShapeIds.has(s.id));
  }, [shapes, selectedShapeIds]);

  const canGroup = useMemo(() => {
    return selectedShapeIds.size >= 2;
  }, [selectedShapeIds]);

  const canUngroup = useMemo(() => {
    return selectedShapes.some(s => Boolean(s.groupId));
  }, [selectedShapes]);

  // Group Bounding Box Overlay
  const selectedGroupBoundingBox = useMemo(() => {
    if (selectedShapes.length <= 1) return null;
    const minX = Math.min(...selectedShapes.map(s => s.x));
    const minY = Math.min(...selectedShapes.map(s => s.y));
    const maxX = Math.max(...selectedShapes.map(s => s.x + s.width));
    const maxY = Math.max(...selectedShapes.map(s => s.y + s.height));
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, [selectedShapes]);

  // Group Selected Shapes Action
  const handleGroupSelectedShapes = () => {
    if (selectedShapeIds.size < 2) {
      toast.info("Select at least 2 shapes to group them together.");
      return;
    }
    const newGroupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setShapes(prev => prev.map(s => selectedShapeIds.has(s.id) ? { ...s, groupId: newGroupId } : s));
    toast.success(`Grouped ${selectedShapeIds.size} sections together`);
  };

  // Ungroup Selected Shapes Action
  const handleUngroupSelectedShapes = () => {
    const targetGroupIds = new Set(selectedShapes.map(s => s.groupId).filter(Boolean));

    if (targetGroupIds.size === 0) {
      toast.info("Selected items are not part of any group.");
      return;
    }

    setShapes(prev => prev.map(s => {
      if (s.groupId && targetGroupIds.has(s.groupId)) {
        return { ...s, groupId: undefined };
      }
      return s;
    }));
    toast.success("Ungrouped sections");
  };

  // Keyboard listener for Grouping (Ctrl+G) & Ungrouping (Ctrl+Shift+G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          handleUngroupSelectedShapes();
        } else {
          handleGroupSelectedShapes();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeIds, shapes, selectedShapes]);

  // Snap coordinate helper
  const snap = (val: number) => {
    if (!snapToGrid) return Math.max(0, Math.min(100, val));
    return Math.max(0, Math.min(100, Math.round(val / gridSize) * gridSize));
  };

  // Magnetic Edge & Boundary Snapping Calculator
  const calculateMagneticSnap = (
    shapeId: string,
    proposedX: number,
    proposedY: number,
    proposedW: number,
    proposedH: number,
    isResizing: boolean = false,
    resizeHandle: string = ''
  ): {
    x: number;
    y: number;
    w: number;
    h: number;
    guides: {
      axis: 'x' | 'y';
      positionPct: number;
      label?: string;
      type?: 'edge' | 'center' | 'boundary';
      targetShapeId?: string;
    }[];
  } => {
    if (!magneticSnap) {
      let finalX = proposedX;
      let finalY = proposedY;
      let finalW = proposedW;
      let finalH = proposedH;

      if (snapToGrid) {
        finalX = snap(finalX);
        finalY = snap(finalY);
        finalW = snap(finalW);
        finalH = snap(finalH);
      }
      return { x: finalX, y: finalY, w: finalW, h: finalH, guides: [] };
    }

    const MAGNETIC_THRESHOLD = 2.0; // 2% snap tolerance
    const guides: {
      axis: 'x' | 'y';
      positionPct: number;
      label?: string;
      type?: 'edge' | 'center' | 'boundary';
      targetShapeId?: string;
    }[] = [];

    let finalX = proposedX;
    let finalY = proposedY;
    let finalW = proposedW;
    let finalH = proposedH;

    interface Target {
      pos: number;
      label: string;
      type: 'edge' | 'center' | 'boundary';
      targetShapeId?: string;
    }

    const xTargets: Target[] = [
      { pos: 0, label: 'Container Left Edge', type: 'boundary' },
      { pos: 50, label: 'Container Center X', type: 'boundary' },
      { pos: 100, label: 'Container Right Edge', type: 'boundary' }
    ];

    const yTargets: Target[] = [
      { pos: 0, label: 'Container Top Edge', type: 'boundary' },
      { pos: 50, label: 'Container Center Y', type: 'boundary' },
      { pos: 100, label: 'Container Bottom Edge', type: 'boundary' }
    ];

    shapes.forEach(other => {
      if (other.id === shapeId) return;

      const otherLabel = other.label || 'Shape';
      xTargets.push({ pos: other.x, label: `Left Edge (${otherLabel})`, type: 'edge', targetShapeId: other.id });
      xTargets.push({ pos: other.x + other.width, label: `Right Edge (${otherLabel})`, type: 'edge', targetShapeId: other.id });
      xTargets.push({ pos: other.x + other.width / 2, label: `Center X (${otherLabel})`, type: 'center', targetShapeId: other.id });

      yTargets.push({ pos: other.y, label: `Top Edge (${otherLabel})`, type: 'edge', targetShapeId: other.id });
      yTargets.push({ pos: other.y + other.height, label: `Bottom Edge (${otherLabel})`, type: 'edge', targetShapeId: other.id });
      yTargets.push({ pos: other.y + other.height / 2, label: `Center Y (${otherLabel})`, type: 'center', targetShapeId: other.id });
    });

    if (!isResizing) {
      // MOVE MODE
      let snappedX = false;
      let snappedY = false;

      const currentLeft = proposedX;
      const currentRight = proposedX + proposedW;
      const currentCenterX = proposedX + proposedW / 2;

      for (const t of xTargets) {
        if (Math.abs(currentLeft - t.pos) <= MAGNETIC_THRESHOLD) {
          finalX = t.pos;
          snappedX = true;
          guides.push({ axis: 'x', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
          break;
        }
        if (Math.abs(currentRight - t.pos) <= MAGNETIC_THRESHOLD) {
          finalX = t.pos - proposedW;
          snappedX = true;
          guides.push({ axis: 'x', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
          break;
        }
        if (Math.abs(currentCenterX - t.pos) <= MAGNETIC_THRESHOLD) {
          finalX = t.pos - proposedW / 2;
          snappedX = true;
          guides.push({ axis: 'x', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
          break;
        }
      }

      if (!snappedX && snapToGrid) {
        finalX = snap(finalX);
      }

      const currentTop = proposedY;
      const currentBottom = proposedY + proposedH;
      const currentCenterY = proposedY + proposedH / 2;

      for (const t of yTargets) {
        if (Math.abs(currentTop - t.pos) <= MAGNETIC_THRESHOLD) {
          finalY = t.pos;
          snappedY = true;
          guides.push({ axis: 'y', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
          break;
        }
        if (Math.abs(currentBottom - t.pos) <= MAGNETIC_THRESHOLD) {
          finalY = t.pos - proposedH;
          snappedY = true;
          guides.push({ axis: 'y', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
          break;
        }
        if (Math.abs(currentCenterY - t.pos) <= MAGNETIC_THRESHOLD) {
          finalY = t.pos - proposedH / 2;
          snappedY = true;
          guides.push({ axis: 'y', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
          break;
        }
      }

      if (!snappedY && snapToGrid) {
        finalY = snap(finalY);
      }
    } else {
      // RESIZE MODE
      let snappedX = false;
      let snappedY = false;

      if (resizeHandle.includes('e')) {
        const rightEdge = proposedX + proposedW;
        for (const t of xTargets) {
          if (Math.abs(rightEdge - t.pos) <= MAGNETIC_THRESHOLD) {
            finalW = Math.max(3, t.pos - proposedX);
            snappedX = true;
            guides.push({ axis: 'x', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
            break;
          }
        }
      }

      if (resizeHandle.includes('w')) {
        const leftEdge = proposedX;
        for (const t of xTargets) {
          if (Math.abs(leftEdge - t.pos) <= MAGNETIC_THRESHOLD) {
            const fixedRight = proposedX + proposedW;
            finalX = t.pos;
            finalW = Math.max(3, fixedRight - t.pos);
            snappedX = true;
            guides.push({ axis: 'x', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
            break;
          }
        }
      }

      if (resizeHandle.includes('s')) {
        const bottomEdge = proposedY + proposedH;
        for (const t of yTargets) {
          if (Math.abs(bottomEdge - t.pos) <= MAGNETIC_THRESHOLD) {
            finalH = Math.max(3, t.pos - proposedY);
            snappedY = true;
            guides.push({ axis: 'y', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
            break;
          }
        }
      }

      if (resizeHandle.includes('n')) {
        const topEdge = proposedY;
        for (const t of yTargets) {
          if (Math.abs(topEdge - t.pos) <= MAGNETIC_THRESHOLD) {
            const fixedBottom = proposedY + proposedH;
            finalY = t.pos;
            finalH = Math.max(3, fixedBottom - t.pos);
            snappedY = true;
            guides.push({ axis: 'y', positionPct: t.pos, label: t.label, type: t.type, targetShapeId: t.targetShapeId });
            break;
          }
        }
      }

      if (!snappedX && snapToGrid) {
        finalX = snap(finalX);
        finalW = snap(finalW);
      }

      if (!snappedY && snapToGrid) {
        finalY = snap(finalY);
        finalH = snap(finalH);
      }
    }

    return { x: finalX, y: finalY, w: finalW, h: finalH, guides };
  };

  // Global mouse move and mouse up listeners for smooth Drag-to-Move and Drag-to-Resize
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const currX = ((e.clientX - rect.left) / rect.width) * 100;
      const currY = ((e.clientY - rect.top) / rect.height) * 100;

      const dx = currX - dragState.startX;
      const dy = currY - dragState.startY;

      if (dragState.type === 'move') {
        const shape = shapes.find(s => s.id === dragState.shapeId);
        if (!shape || shape.isLocked) return;

        let newX = dragState.origX + dx;
        let newY = dragState.origY + dy;

        // Clamp inside canvas boundary
        newX = Math.max(0, Math.min(100 - shape.width, newX));
        newY = Math.max(0, Math.min(100 - shape.height, newY));

        const snapRes = calculateMagneticSnap(shape.id, newX, newY, shape.width, shape.height, false);

        const deltaX = snapRes.x - dragState.origX;
        const deltaY = snapRes.y - dragState.origY;

        const groupShapes = dragState.groupShapes || [{ id: shape.id, origX: shape.x, origY: shape.y, origW: shape.width, origH: shape.height }];
        const groupIds = new Set(groupShapes.map(gs => gs.id));

        setShapes(prev => prev.map(s => {
          if (groupIds.has(s.id)) {
            const orig = groupShapes.find(gs => gs.id === s.id);
            if (!orig) return s;
            const targetX = Math.max(0, Math.min(100 - orig.origW, orig.origX + deltaX));
            const targetY = Math.max(0, Math.min(100 - orig.origH, orig.origY + deltaY));
            return { ...s, x: targetX, y: targetY };
          }
          return s;
        }));
        setActiveGuides(snapRes.guides);
      } else if (dragState.type === 'resize' && dragState.handle) {
        const shape = shapes.find(s => s.id === dragState.shapeId);
        if (!shape || shape.isLocked) return;

        const { origX, origY, origW, origH } = dragState;
        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;

        const handle = dragState.handle;

        if (handle.includes('e')) {
          newW = Math.max(3, origW + dx);
        }
        if (handle.includes('s')) {
          newH = Math.max(3, origH + dy);
        }
        if (handle.includes('w')) {
          const proposedW = Math.max(3, origW - dx);
          newX = origX + (origW - proposedW);
          newW = proposedW;
        }
        if (handle.includes('n')) {
          const proposedH = Math.max(3, origH - dy);
          newY = origY + (origH - proposedH);
          newH = proposedH;
        }

        // Clamp boundaries
        if (newX < 0) {
          newW = newW + newX;
          newX = 0;
        }
        if (newY < 0) {
          newH = newH + newY;
          newY = 0;
        }
        if (newX + newW > 100) {
          newW = 100 - newX;
        }
        if (newY + newH > 100) {
          newH = 100 - newY;
        }

        const snapRes = calculateMagneticSnap(shape.id, newX, newY, newW, newH, true, handle);

        const groupShapes = dragState.groupShapes;
        if (groupShapes && groupShapes.length > 1) {
          const scaleX = Math.max(0.1, snapRes.w / origW);
          const scaleY = Math.max(0.1, snapRes.h / origH);

          const groupIds = new Set(groupShapes.map(gs => gs.id));

          setShapes(prev => prev.map(s => {
            if (groupIds.has(s.id)) {
              const orig = groupShapes.find(gs => gs.id === s.id);
              if (!orig) return s;

              if (s.id === shape.id) {
                return {
                  ...s,
                  x: snapRes.x,
                  y: snapRes.y,
                  width: Math.max(3, snapRes.w),
                  height: Math.max(3, snapRes.h)
                };
              }

              const relX = (orig.origX - origX) * scaleX;
              const relY = (orig.origY - origY) * scaleY;

              return {
                ...s,
                x: Math.max(0, Math.min(97, snapRes.x + relX)),
                y: Math.max(0, Math.min(97, snapRes.y + relY)),
                width: Math.max(3, Math.min(100, orig.origW * scaleX)),
                height: Math.max(3, Math.min(100, orig.origH * scaleY))
              };
            }
            return s;
          }));
        } else {
          setShapes(prev => prev.map(s => s.id === dragState.shapeId ? {
            ...s,
            x: snapRes.x,
            y: snapRes.y,
            width: Math.max(3, snapRes.w),
            height: Math.max(3, snapRes.h)
          } : s));
        }
        setActiveGuides(snapRes.guides);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setActiveGuides([]);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, snapToGrid, magneticSnap, gridSize, shapes]);

  // Click Outside to Close Context Menu
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  // Global Listener for Marquee Selection Box Dragging
  useEffect(() => {
    if (!marqueeState) return;

    const handleMarqueeMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const currX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const currY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      setMarqueeState(prev => prev ? { ...prev, currX, currY } : null);

      const minX = Math.min(marqueeState.startX, currX);
      const maxX = Math.max(marqueeState.startX, currX);
      const minY = Math.min(marqueeState.startY, currY);
      const maxY = Math.max(marqueeState.startY, currY);

      if (maxX - minX > 0.5 || maxY - minY > 0.5) {
        const intersectedIds = new Set<string>(marqueeState.initialSelectedIds);

        shapes.forEach(s => {
          const shapeMaxX = s.x + s.width;
          const shapeMaxY = s.y + s.height;
          const intersects = s.x < maxX && shapeMaxX > minX && s.y < maxY && shapeMaxY > minY;

          if (intersects) {
            if (s.groupId) {
              shapes.filter(grpShape => grpShape.groupId === s.groupId).forEach(grpShape => intersectedIds.add(grpShape.id));
            } else {
              intersectedIds.add(s.id);
            }
          }
        });

        setSelectedShapeIds(intersectedIds);
      }
    };

    const handleMarqueeMouseUp = () => {
      setMarqueeState(null);
    };

    window.addEventListener('mousemove', handleMarqueeMouseMove);
    window.addEventListener('mouseup', handleMarqueeMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMarqueeMouseMove);
      window.removeEventListener('mouseup', handleMarqueeMouseUp);
    };
  }, [marqueeState, shapes]);

  // Canvas Mouse Down - Start Drawing or Deselect / Box Select Marquee
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const clickY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (activeTool !== 'select') {
      setIsDrawing(true);
      setDrawStart({ x: clickX, y: clickY });
      setCurrentDrawRect({ x: snap(clickX), y: snap(clickY), width: 5, height: 5 });
      setSelectedShapeId(null);
    } else {
      const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
      const initialIds = isMulti ? new Set(selectedShapeIds) : new Set<string>();

      if (!isMulti) {
        setSelectedShapeIds(new Set());
      }

      setMarqueeState({
        startX: clickX,
        startY: clickY,
        currX: clickX,
        currY: clickY,
        isShift: isMulti,
        initialSelectedIds: initialIds
      });
    }
  };

  // Canvas Mouse Move - Drawing Preview
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const currX = ((e.clientX - rect.left) / rect.width) * 100;
    const currY = ((e.clientY - rect.top) / rect.height) * 100;

    const startX = drawStart.x;
    const startY = drawStart.y;

    let x = Math.min(startX, currX);
    let y = Math.min(startY, currY);
    let w = Math.abs(currX - startX);
    let h = Math.abs(currY - startY);

    if (activeTool === 'square') {
      const maxDim = Math.max(w, h);
      w = maxDim;
      h = maxDim;
    } else if (activeTool === 'divider-v') {
      w = 3;
    } else if (activeTool === 'divider-h') {
      h = 3;
    }

    setCurrentDrawRect({
      x: snap(x),
      y: snap(y),
      width: Math.max(3, snap(w)),
      height: Math.max(3, snap(h))
    });
  };

  // Canvas Mouse Up - Finish Drawing Shape
  const handleCanvasMouseUp = () => {
    if (isDrawing && currentDrawRect) {
      if (currentDrawRect.width >= 3 && currentDrawRect.height >= 3) {
        const newShape: DesignerShape = {
          id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: activeTool === 'select' ? 'rectangle' : activeTool,
          x: currentDrawRect.x,
          y: currentDrawRect.y,
          width: currentDrawRect.width,
          height: currentDrawRect.height,
          label: `${activeTool.replace('-', ' ').toUpperCase()} #${shapes.length + 1}`,
          color: COLOR_PALETTE[shapes.length % COLOR_PALETTE.length].hex,
          assignedGearIds: []
        };
        setShapes(prev => [...prev, newShape]);
        setSelectedShapeId(newShape.id);
        toast.success(`Created section "${newShape.label}"`);
      }
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentDrawRect(null);
      setActiveTool('select');
    }
  };

  // Handle Drag Move Start on Shape
  const handleShapeMouseDown = (e: React.MouseEvent, shape: DesignerShape) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
    let targetIds = new Set(selectedShapeIds);

    if (isMulti) {
      const groupShapeIds = shape.groupId
        ? shapes.filter(s => s.groupId === shape.groupId).map(s => s.id)
        : [shape.id];

      if (groupShapeIds.every(id => targetIds.has(id))) {
        groupShapeIds.forEach(id => targetIds.delete(id));
      } else {
        groupShapeIds.forEach(id => targetIds.add(id));
      }
      setSelectedShapeIds(new Set(targetIds));
    } else {
      if (!targetIds.has(shape.id)) {
        if (shape.groupId) {
          targetIds = new Set(shapes.filter(s => s.groupId === shape.groupId).map(s => s.id));
        } else {
          targetIds = new Set([shape.id]);
        }
        setSelectedShapeIds(targetIds);
      }
    }

    if (shape.isLocked) {
      toast.info(`"${shape.label}" is locked. Unlock to move or resize.`, { id: `lock_${shape.id}` });
      return;
    }

    if (activeTool !== 'select') return;
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    const dragGroupShapes = shapes
      .filter(s => targetIds.has(s.id) && !s.isLocked)
      .map(s => ({
        id: s.id,
        origX: s.x,
        origY: s.y,
        origW: s.width,
        origH: s.height
      }));

    setDragState({
      type: 'move',
      shapeId: shape.id,
      startX,
      startY,
      origX: shape.x,
      origY: shape.y,
      origW: shape.width,
      origH: shape.height,
      groupShapes: dragGroupShapes
    });
  };

  // Handle Drag Resize Start on Handle
  const handleResizeHandleMouseDown = (
    e: React.MouseEvent,
    shape: DesignerShape,
    handle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (shape.isLocked) {
      toast.info(`"${shape.label}" is locked. Unlock to resize.`);
      return;
    }

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    const targetIds = shape.groupId
      ? new Set(shapes.filter(s => s.groupId === shape.groupId).map(s => s.id))
      : selectedShapeIds.has(shape.id) ? selectedShapeIds : new Set([shape.id]);

    setSelectedShapeIds(targetIds);

    const dragGroupShapes = shapes
      .filter(s => targetIds.has(s.id) && !s.isLocked)
      .map(s => ({
        id: s.id,
        origX: s.x,
        origY: s.y,
        origW: s.width,
        origH: s.height
      }));

    setDragState({
      type: 'resize',
      shapeId: shape.id,
      handle,
      startX,
      startY,
      origX: shape.x,
      origY: shape.y,
      origW: shape.width,
      origH: shape.height,
      groupShapes: dragGroupShapes
    });
  };

  // Context Menu Trigger (Right Click)
  const handleContextMenu = (e: React.MouseEvent, shapeId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (shapeId) {
      setSelectedShapeId(shapeId);
    }
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      shapeId: shapeId || selectedShapeId || undefined
    });
  };

  // Add Preset Shape
  const handleAddPresetShape = (type: DesignerShape['type']) => {
    const newShape: DesignerShape = {
      id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      x: snap(30 + (shapes.length % 5) * 5),
      y: snap(20 + (shapes.length % 5) * 5),
      width: type === 'divider-v' ? 4 : type === 'circle' ? 25 : 35,
      height: type === 'divider-h' ? 4 : type === 'circle' ? 25 : 25,
      label: `Section ${shapes.length + 1}`,
      color: COLOR_PALETTE[shapes.length % COLOR_PALETTE.length].hex,
      assignedGearIds: []
    };
    setShapes(prev => [...prev, newShape]);
    setSelectedShapeId(newShape.id);
  };

  // Modify Shape Field
  const updateShape = (id: string, updates: Partial<DesignerShape>) => {
    setShapes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Shape Actions
  const handleDuplicateShape = (id: string) => {
    const source = shapes.find(s => s.id === id);
    if (!source) return;
    const duplicated: DesignerShape = {
      ...source,
      id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      x: Math.min(85, source.x + 5),
      y: Math.min(85, source.y + 5),
      label: `${source.label} (Copy)`
    };
    setShapes(prev => [...prev, duplicated]);
    setSelectedShapeId(duplicated.id);
    toast.success(`Duplicated "${source.label}"`);
  };

  const handleDeleteShape = (id: string) => {
    const target = shapes.find(s => s.id === id);
    if (target?.isLocked) {
      toast.error(`"${target.label}" is locked. Unlock it first before deleting.`);
      return;
    }
    setShapes(prev => prev.filter(s => s.id !== id));
    if (selectedShapeId === id) setSelectedShapeId(null);
    toast.success("Section removed from layout");
  };

  const handleRotateShape = (id: string) => {
    const target = shapes.find(s => s.id === id);
    if (!target) return;
    if (target.isLocked) {
      toast.info(`"${target.label}" is locked in position.`);
      return;
    }
    updateShape(id, {
      width: target.height,
      height: target.width,
      rotation: ((target.rotation || 0) + 90) % 360
    });
  };

  const handleToggleLock = (id: string) => {
    const target = shapes.find(s => s.id === id);
    if (!target) return;
    const nextLockedState = !target.isLocked;
    updateShape(id, { isLocked: nextLockedState });
    toast.info(nextLockedState ? `🔒 "${target.label}" locked in position` : `🔓 "${target.label}" unlocked`);
  };

  // Assign or Unassign Gear to Shape
  const handleToggleGearAssignment = (shapeId: string, gearId: string) => {
    setShapes(prev => prev.map(s => {
      if (s.id === shapeId) {
        const current = s.assignedGearIds || [];
        const exists = current.includes(gearId);
        return {
          ...s,
          assignedGearIds: exists ? current.filter(id => id !== gearId) : [...current, gearId]
        };
      }
      return s;
    }));
  };

  // Run AI Layout Generator
  const handleRunAILayout = async () => {
    setIsGeneratingAI(true);
    setAiNotes('');
    try {
      let targetItems: Array<{ id: string; name: string; category?: string; brand?: string; model?: string }> = [];

      if (aiSource === 'gear') {
        const selectedGear = allGear.filter(g => selectedGearIdsForAI.has(g.id));
        targetItems = selectedGear.map(g => ({
          id: g.id,
          name: g.name,
          category: g.category,
          brand: g.brand,
          model: g.model
        }));
      } else if (aiSource === 'packing_list' && selectedListIdForAI) {
        const list = allPackingLists.find(l => l.id === selectedListIdForAI);
        if (list && Array.isArray(list.items)) {
          targetItems = list.items.map((item: any, idx: number) => ({
            id: item.id || item.gearId || `item_${idx}`,
            name: item.name || item.itemName || `Item ${idx + 1}`,
            category: item.category || 'General',
            brand: item.brand,
            model: item.model
          }));
        }
      }

      if (targetItems.length === 0) {
        targetItems = allGear.slice(0, 6).map(g => ({
          id: g.id,
          name: g.name,
          category: g.category,
          brand: g.brand,
          model: g.model
        }));
      }

      const layoutResult = await generateOrganizerLayout({
        containerType: activePreset.name || container.type || 'Pelican Case',
        containerDimensions: container.dimensions,
        items: targetItems,
        priority: aiPriority
      });

      if (layoutResult.shapes && layoutResult.shapes.length > 0) {
        const formattedShapes: DesignerShape[] = layoutResult.shapes.map((s, idx) => ({
          id: `ai_shape_${Date.now()}_${idx}`,
          type: s.type || 'rectangle',
          x: Math.max(2, Math.min(85, s.x)),
          y: Math.max(2, Math.min(85, s.y)),
          width: Math.max(8, Math.min(80, s.width)),
          height: Math.max(8, Math.min(80, s.height)),
          label: s.label || `AI Section ${idx + 1}`,
          color: s.color || COLOR_PALETTE[idx % COLOR_PALETTE.length].hex,
          assignedGearIds: s.assignedGearIds || []
        }));

        setShapes(formattedShapes);
        setAiNotes(layoutResult.layoutNotes || "Layout optimized successfully!");
        toast.success(`✨ AI generated ${formattedShapes.length} optimized foam sections!`);
        setIsAIModalOpen(false);
      }
    } catch (err) {
      toast.error("Failed to generate AI layout. Applied baseline TrekPak grid.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Save Layout to Firestore
  const handleSaveLayout = async () => {
    setIsSaving(true);
    try {
      const sketchData: DesignerSketch = {
        containerType: containerPreset,
        snapToGrid,
        magneticSnap,
        gridSize,
        gridSizePx: gridSize,
        version: 2,
        shapes,
        lastUpdated: new Date().toISOString()
      };

      const updatedSections = shapes.map(s => ({
        id: s.id,
        name: s.label,
        description: `Designer Section (${s.type}) - ${formatDimensions(s.width, s.height)}`,
        items: s.assignedGearIds || []
      }));

      await updateDoc(doc(db, 'users', container.ownerId || '', 'containers', container.id), {
        layoutSketch: sketchData,
        sections: updatedSections,
        updatedAt: new Date().toISOString()
      });

      toast.success("Organizer Designer Sketch & Measurements saved!");
      if (onSaveSuccess) onSaveSuccess();
    } catch (error) {
      toast.error("Failed to save layout sketch");
    } finally {
      setIsSaving(false);
    }
  };

  // Generate CAD SVG String for Exporting
  const generateLayoutSVGString = (): string => {
    const canvasW = 1000;
    const canvasH = 667;

    const shapesSvg = shapes.map(s => {
      const xPx = (s.x / 100) * canvasW;
      const yPx = (s.y / 100) * canvasH;
      const wPx = (s.width / 100) * canvasW;
      const hPx = (s.height / 100) * canvasH;
      const hex = s.color || '#3b82f6';
      const dimText = formatDimensions(s.width, s.height);
      const assignedCount = s.assignedGearIds?.length || 0;

      let shapeElement = '';
      if (s.type === 'circle') {
        const cx = xPx + wPx / 2;
        const cy = yPx + hPx / 2;
        const rx = wPx / 2;
        const ry = hPx / 2;
        shapeElement = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${hex}33" stroke="${hex}" stroke-width="3" />`;
      } else {
        shapeElement = `<rect x="${xPx}" y="${yPx}" width="${wPx}" height="${hPx}" rx="16" fill="${hex}33" stroke="${hex}" stroke-width="3" />`;
      }

      const safeLabel = (s.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeDims = dimText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      return `
        <g id="${s.id}">
          ${shapeElement}
          <rect x="${xPx + 8}" y="${yPx + 8}" width="${Math.max(60, safeLabel.length * 8 + 16)}" height="20" rx="4" fill="#000000" opacity="0.75" />
          <text x="${xPx + 16}" y="${yPx + 22}" font-family="sans-serif" font-size="11" font-weight="bold" fill="#ffffff">${safeLabel}</text>
          <text x="${xPx + wPx / 2}" y="${yPx + hPx / 2 + 4}" font-family="monospace" font-size="12" font-weight="bold" fill="#f5f5f5" text-anchor="middle">${safeDims}</text>
          ${assignedCount > 0 ? `<text x="${xPx + 12}" y="${yPx + hPx - 12}" font-family="sans-serif" font-size="10" font-weight="bold" fill="#34d399">${assignedCount} Items Assigned</text>` : ''}
        </g>
      `;
    }).join('\n');

    const safeTitle = (container.name || 'Container Layout').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safePreset = (activePreset.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeDims = (activePreset.dims || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}">
  <style>
    .bg { fill: #0f0f11; }
    .grid-dot { fill: rgba(255, 255, 255, 0.12); }
    .case-border { fill: #17171c; stroke: #26262d; stroke-width: 6; }
    .title { font-family: system-ui, -apple-system, sans-serif; font-size: 18px; font-weight: 900; fill: #ffffff; text-transform: uppercase; letter-spacing: 1px; }
    .subtitle { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 600; fill: #a3a3a3; }
    .brand { font-family: system-ui, -apple-system, sans-serif; font-size: 10px; font-weight: 900; fill: #ff4f3a; letter-spacing: 2px; }
  </style>

  <rect width="${canvasW}" height="${canvasH}" class="bg" />
  <rect x="20" y="20" width="${canvasW - 40}" height="${canvasH - 40}" rx="32" class="case-border" />

  ${showGrid ? `
    <pattern id="dot-grid" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="15" r="1.5" class="grid-dot" />
    </pattern>
    <rect x="20" y="20" width="${canvasW - 40}" height="${canvasH - 40}" rx="32" fill="url(#dot-grid)" />
  ` : ''}

  <g transform="translate(20, 20) scale(0.96)">
    ${shapesSvg}
  </g>

  <g transform="translate(40, 50)">
    <text x="0" y="0" class="brand">PACKER TOOLS • ORGANIZER DESIGNER</text>
    <text x="0" y="22" class="title">${safeTitle}</text>
    <text x="0" y="38" class="subtitle">Boundary: ${safePreset} (${safeDims}) • Generated ${new Date().toLocaleDateString()}</text>
  </g>
</svg>`;
  };

  const handleExportSVG = () => {
    try {
      setIsExporting(true);
      const svgStr = generateLayoutSVGString();
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `${container.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_organizer_layout.svg`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported layout as SVG vector file (${filename})`);
      setIsExportMenuOpen(false);
    } catch (err) {
      toast.error("Failed to export SVG file");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPNG = () => {
    try {
      setIsExporting(true);
      const svgStr = generateLayoutSVGString();
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 1067;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f0f11';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          const filename = `${container.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_organizer_layout.png`;
          link.href = pngUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success(`Exported layout as PNG image (${filename})`);
        }
        URL.revokeObjectURL(url);
        setIsExportMenuOpen(false);
        setIsExporting(false);
      };
      img.onerror = () => {
        toast.error("Failed to render PNG image from layout");
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };
      img.src = url;
    } catch (err) {
      toast.error("Failed to export PNG image");
      setIsExporting(false);
    }
  };

  // Filtered Gear Items for sidebar
  const filteredGear = useMemo(() => {
    return allGear.filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (g.category && g.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const isAssigned = assignedGearMap.has(g.id);
      if (filterUnassigned) return matchesSearch && !isAssigned;
      return matchesSearch;
    });
  }, [allGear, searchQuery, filterUnassigned, assignedGearMap]);

  // Background Grid CSS Style
  const gridBackgroundStyle = useMemo(() => {
    if (!showGrid) return 'none';
    if (gridType === 'lines') {
      return `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)`;
    }
    if (gridType === 'mesh') {
      return `linear-gradient(45deg, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(-45deg, rgba(255,255,255,0.04) 1px, transparent 1px)`;
    }
    // Default Dots
    return `radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)`;
  }, [showGrid, gridType]);

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl relative select-none">
      {/* Top Navigation & Action Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between gap-4 flex-wrap z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
            <Layers size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black uppercase tracking-tight text-white">{container.name}</h2>
              <span className="text-[9px] font-black uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30 flex items-center gap-1">
                <span>Organizer Designer</span>
                <span className="text-[8px] opacity-75">v5.19.2</span>
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-medium">
              Interactive 2D foam CAD, real measurements, magnetic alignment & grid controls
            </p>
          </div>
        </div>

        {/* Preset Selector & Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Container Selector */}
          <select
            value={containerPreset}
            onChange={e => setContainerPreset(e.target.value)}
            className="bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-primary"
            title="Container Boundary Preset"
          >
            {PRESET_CONTAINERS.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.dims})</option>
            ))}
          </select>

          {/* Grid Toggle Button */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
              showGrid ? 'bg-primary/20 border-primary text-primary' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
            }`}
            title="Toggle Grid Background Lines"
          >
            <Grid size={14} />
            <span>Grid {showGrid ? 'ON' : 'OFF'}</span>
          </button>

          {/* Snap to Grid Toggle Button */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
              snapToGrid ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
            }`}
            title="Toggle Grid Snapping"
          >
            <Crosshair size={14} />
            <span>Grid Snap ({gridSize}%)</span>
          </button>

          {/* Magnetic Alignment Snap Toggle Button */}
          <button
            onClick={() => setMagneticSnap(!magneticSnap)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
              magneticSnap ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
            }`}
            title="Toggle Magnetic Alignment to Shape Edges & Container Boundaries"
          >
            <Magnet size={14} className={magneticSnap ? "animate-pulse text-cyan-400" : ""} />
            <span>Magnet {magneticSnap ? 'ON' : 'OFF'}</span>
          </button>

          {/* Show Measurements Toggle */}
          <button
            onClick={() => setShowMeasurements(!showMeasurements)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
              showMeasurements ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
            }`}
            title="Toggle Measurements & Rulers"
          >
            <Ruler size={14} />
            <span>Rulers ({measurementUnit})</span>
          </button>

          {/* Lock Selected Shape Button */}
          {selectedShape && (
            <button
              onClick={() => handleToggleLock(selectedShape.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                selectedShape.isLocked ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
              }`}
              title={selectedShape.isLocked ? "Unlock Shape Position" : "Lock Shape Position"}
            >
              {selectedShape.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{selectedShape.isLocked ? "Locked" : "Lock"}</span>
            </button>
          )}

          {/* Group Button */}
          {canGroup && (
            <button
              onClick={handleGroupSelectedShapes}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border bg-purple-500/20 border-purple-500/50 text-purple-300 hover:bg-purple-500/30 shadow-xs"
              title="Group selected shapes together (Ctrl+G)"
            >
              <Group size={14} className="text-purple-400" />
              <span>Group ({selectedShapeIds.size})</span>
            </button>
          )}

          {/* Ungroup Button */}
          {canUngroup && (
            <button
              onClick={handleUngroupSelectedShapes}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border bg-neutral-800 border-purple-500/40 text-purple-300 hover:bg-neutral-700 shadow-xs"
              title="Ungroup shapes (Ctrl+Shift+G)"
            >
              <Ungroup size={14} className="text-purple-400" />
              <span>Ungroup</span>
            </button>
          )}

          {/* AI Generator Button */}
          <button
            onClick={() => setIsAIModalOpen(true)}
            className="px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl flex items-center gap-1.5 shadow-lg transition"
          >
            <Sparkles size={15} />
            <span>AI Layout</span>
          </button>

          {/* Export Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition"
              title="Export Layout Sketch as SVG or PNG"
            >
              <Download size={15} className="text-primary" />
              <span>Export</span>
              <ChevronDown size={14} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isExportMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1"
                >
                  <div className="px-2 py-1.5 border-b border-neutral-800">
                    <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Export CAD Sketch</p>
                    <p className="text-[10px] text-neutral-500 font-medium">Download vector or image file</p>
                  </div>

                  <button
                    onClick={handleExportSVG}
                    disabled={isExporting}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-neutral-200 hover:text-white hover:bg-neutral-800 flex items-center justify-between transition group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Download SVG Vector</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-neutral-500 group-hover:text-primary">.SVG</span>
                  </button>

                  <button
                    onClick={handleExportPNG}
                    disabled={isExporting}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-neutral-200 hover:text-white hover:bg-neutral-800 flex items-center justify-between transition group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Download High-Res PNG</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-neutral-500 group-hover:text-emerald-400">.PNG</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveLayout}
            disabled={isSaving}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-lg transition disabled:opacity-50"
          >
            <Save size={15} />
            <span>{isSaving ? "Saving..." : "Save Layout"}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Main Designer Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Toolbar - Shape Creation & Selection Tools */}
        <div className="w-full lg:w-16 bg-neutral-900 border-b lg:border-b-0 lg:border-r border-neutral-800 p-2 flex lg:flex-col items-center justify-around lg:justify-start gap-2 z-10 shrink-0">
          <p className="hidden lg:block text-[9px] font-black uppercase text-neutral-500 tracking-widest text-center my-1">Tools</p>
          
          <button
            onClick={() => setActiveTool('select')}
            className={`p-2.5 rounded-xl transition flex flex-col items-center text-[9px] font-bold ${
              activeTool === 'select' ? 'bg-primary text-white shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title="Select, Move & Box-Select Shapes (Drag rectangle)"
          >
            <Move size={18} />
          </button>

          <div className="w-full h-px bg-neutral-800 hidden lg:block my-1" />

          <button
            onClick={() => handleAddPresetShape('rectangle')}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition flex flex-col items-center text-[9px] font-bold"
            title="Add Rectangle Cutout"
          >
            <Square size={18} />
          </button>

          <button
            onClick={() => handleAddPresetShape('square')}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition flex flex-col items-center text-[9px] font-bold"
            title="Add Square Bay"
          >
            <div className="w-4 h-4 border-2 border-current rounded-sm" />
          </button>

          <button
            onClick={() => handleAddPresetShape('circle')}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition flex flex-col items-center text-[9px] font-bold"
            title="Add Circle / Lens Well"
          >
            <Circle size={18} />
          </button>

          <button
            onClick={() => handleAddPresetShape('divider-v')}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition flex flex-col items-center text-[9px] font-bold"
            title="Add Vertical Partition"
          >
            <Sliders size={18} />
          </button>

          <button
            onClick={() => handleAddPresetShape('divider-h')}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition flex flex-col items-center text-[9px] font-bold"
            title="Add Horizontal Partition"
          >
            <SlidersHorizontal size={18} />
          </button>

          <div className="w-full h-px bg-neutral-800 hidden lg:block my-1" />

          {/* Unit Switcher Button in Toolbar */}
          <button
            onClick={() => {
              const units: ('mm' | 'in' | 'cm' | 'pct')[] = ['mm', 'in', 'cm', 'pct'];
              const nextUnit = units[(units.indexOf(measurementUnit) + 1) % units.length];
              setMeasurementUnit(nextUnit);
              toast.info(`Measurement unit: ${nextUnit.toUpperCase()}`);
            }}
            className="p-2 rounded-xl bg-neutral-800 text-blue-400 hover:text-white transition text-[10px] font-black uppercase text-center w-full hidden lg:block"
            title="Cycle Measurement Unit"
          >
            {measurementUnit}
          </button>
        </div>

        {/* Center Canvas Viewport */}
        <div
          className="flex-1 bg-neutral-950 p-4 sm:p-6 flex flex-col items-center justify-center overflow-auto relative min-h-[420px]"
          onClick={() => {
            setSelectedShapeId(null);
            setContextMenu({ visible: false, x: 0, y: 0 });
          }}
        >
          {/* Top Measurement Ruler Bar */}
          {showMeasurements && (
            <div className="w-full max-w-4xl flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-1 px-4">
              <span className="text-primary font-bold">◄ 0</span>
              <div className="flex-1 mx-3 h-0.5 bg-neutral-800 relative flex items-center justify-center">
                <span className="bg-neutral-900 px-3 text-[9px] font-mono text-neutral-300 font-black border border-neutral-800 rounded-full flex items-center gap-1 shadow-sm">
                  <Ruler size={11} className="text-primary" />
                  <span>Interior Width: {formatSingleLength(100, 'x')} ({(containerWidthMm / 25.4).toFixed(1)} in)</span>
                </span>
              </div>
              <span className="text-primary font-bold">{formatSingleLength(100, 'x')} ►</span>
            </div>
          )}

          <div className="flex items-center w-full max-w-4xl">
            {/* Left Measurement Ruler Bar */}
            {showMeasurements && (
              <div className="hidden sm:flex flex-col items-center justify-between text-[10px] font-mono text-neutral-400 mr-2 py-4 h-full min-h-[250px] shrink-0">
                <span className="text-primary font-bold">▲ 0</span>
                <div className="flex-1 my-2 w-0.5 bg-neutral-800 relative flex items-center justify-center">
                  <span className="bg-neutral-900 px-1.5 py-2 text-[9px] font-mono text-neutral-300 font-black border border-neutral-800 rounded-full [writing-mode:vertical-lr] rotate-180 shadow-sm flex items-center gap-1">
                    <span>Height: {formatSingleLength(100, 'y')}</span>
                  </span>
                </div>
                <span className="text-primary font-bold">▼ {formatSingleLength(100, 'y')}</span>
              </div>
            )}

            {/* Canvas Outer Frame (Pelican Case Visual) */}
            <div
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onContextMenu={e => handleContextMenu(e)}
              className={`w-full aspect-[1.5] bg-neutral-900/90 rounded-[2.5rem] border-4 border-neutral-800 shadow-2xl relative overflow-hidden group ${
                activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'
              }`}
              style={{
                backgroundImage: gridBackgroundStyle,
                backgroundSize: `${gridSize * 2}% ${gridSize * 2}%`
              }}
            >
              {/* Corner Foam Latch Highlights */}
              <div className="absolute top-2 left-4 w-12 h-2 bg-neutral-800 rounded-full border border-neutral-700 pointer-events-none" />
              <div className="absolute top-2 right-4 w-12 h-2 bg-neutral-800 rounded-full border border-neutral-700 pointer-events-none" />
              <div className="absolute bottom-2 left-4 w-12 h-2 bg-neutral-800 rounded-full border border-neutral-700 pointer-events-none" />
              <div className="absolute bottom-2 right-4 w-12 h-2 bg-neutral-800 rounded-full border border-neutral-700 pointer-events-none" />

              {/* Drawing Preview Overlay */}
              {isDrawing && currentDrawRect && (
                <div
                  className="absolute border-2 border-dashed border-primary bg-primary/20 rounded-xl pointer-events-none z-30 flex items-center justify-center"
                  style={{
                    left: `${currentDrawRect.x}%`,
                    top: `${currentDrawRect.y}%`,
                    width: `${currentDrawRect.width}%`,
                    height: `${currentDrawRect.height}%`
                  }}
                >
                  <span className="px-2 py-0.5 bg-black/80 text-primary text-[9px] font-mono font-bold rounded">
                    {formatDimensions(currentDrawRect.width, currentDrawRect.height)}
                  </span>
                </div>
              )}

              {/* Visual Box Selection Marquee Overlay */}
              {marqueeState && (Math.abs(marqueeState.currX - marqueeState.startX) > 0.5 || Math.abs(marqueeState.currY - marqueeState.startY) > 0.5) && (
                <div
                  className="absolute border-2 border-dashed border-cyan-400 bg-cyan-500/15 shadow-[0_0_20px_rgba(34,211,238,0.4)] pointer-events-none z-40 rounded-xl transition-none"
                  style={{
                    left: `${Math.min(marqueeState.startX, marqueeState.currX)}%`,
                    top: `${Math.min(marqueeState.startY, marqueeState.currY)}%`,
                    width: `${Math.abs(marqueeState.currX - marqueeState.startX)}%`,
                    height: `${Math.abs(marqueeState.currY - marqueeState.startY)}%`
                  }}
                >
                  <div className="absolute -top-7 left-0 bg-neutral-950/95 text-cyan-300 border border-cyan-500/60 text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-xl flex items-center gap-1.5 whitespace-nowrap">
                    <BoxSelect size={11} className="text-cyan-400 animate-pulse shrink-0" />
                    <span>Box Select ({selectedShapeIds.size} selected)</span>
                  </div>
                </div>
              )}

              {/* Active Smart Alignment Guides Overlay */}
              {magneticSnap && activeGuides.map((g, idx) => {
                const isCenter = g.type === 'center';
                const isBoundary = g.type === 'boundary';

                const lineStyles = isCenter
                  ? 'border-fuchsia-400 bg-fuchsia-400/25 shadow-[0_0_15px_rgba(232,121,249,0.9)]'
                  : isBoundary
                  ? 'border-amber-400 bg-amber-400/25 shadow-[0_0_15px_rgba(251,191,36,0.9)]'
                  : 'border-cyan-400 bg-cyan-400/25 shadow-[0_0_15px_rgba(34,211,238,0.9)]';

                const badgeStyles = isCenter
                  ? 'bg-neutral-950/95 text-fuchsia-300 border-fuchsia-500/60'
                  : isBoundary
                  ? 'bg-neutral-950/95 text-amber-300 border-amber-500/60'
                  : 'bg-neutral-950/95 text-cyan-300 border-cyan-500/60';

                const IconComponent = isCenter ? Sparkles : isBoundary ? Maximize : Magnet;

                if (g.axis === 'x') {
                  return (
                    <div
                      key={`guide-x-${idx}-${g.positionPct}`}
                      className={`absolute top-0 bottom-0 border-r-2 border-dashed ${lineStyles} z-40 pointer-events-none flex flex-col items-center justify-start pt-2 transition-all`}
                      style={{ left: `${g.positionPct}%` }}
                    >
                      <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-full border shadow-xl whitespace-nowrap flex items-center gap-1 ${badgeStyles}`}>
                        <IconComponent size={9} className="shrink-0 animate-pulse" />
                        <span>{g.label || 'Aligned'}</span>
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={`guide-y-${idx}-${g.positionPct}`}
                    className={`absolute left-0 right-0 border-b-2 border-dashed ${lineStyles} z-40 pointer-events-none flex items-end justify-start pl-2 transition-all`}
                    style={{ top: `${g.positionPct}%` }}
                  >
                    <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-full border shadow-xl whitespace-nowrap -mb-2.5 flex items-center gap-1 ${badgeStyles}`}>
                      <IconComponent size={9} className="shrink-0 animate-pulse" />
                      <span>{g.label || 'Aligned'}</span>
                    </span>
                  </div>
                );
              })}

              {/* Rendered Shapes */}
              {shapes.map((s) => {
                const isSelected = selectedShapeId === s.id;
                const assignedCount = s.assignedGearIds?.length || 0;
                const isBeingDragged = dragState?.shapeId === s.id;

                const alignedGuide = activeGuides.find(g => g.targetShapeId === s.id);
                const isAlignedTarget = Boolean(alignedGuide);

                const targetHighlightRing = isAlignedTarget
                  ? alignedGuide?.type === 'center'
                    ? 'ring-4 ring-fuchsia-400 shadow-[0_0_20px_rgba(232,121,249,0.8)] z-30 animate-pulse'
                    : 'ring-4 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] z-30 animate-pulse'
                  : '';

                return (
                  <div
                    key={s.id}
                    onMouseDown={(e) => handleShapeMouseDown(e, s)}
                    onContextMenu={(e) => handleContextMenu(e, s.id)}
                    className={`absolute select-none cursor-grab active:cursor-grabbing flex flex-col justify-between p-2 rounded-2xl border-2 transition-all ${targetHighlightRing} ${
                      isSelected
                        ? s.isLocked
                          ? 'ring-4 ring-amber-500/40 border-amber-500 bg-amber-500/10 shadow-2xl z-20'
                          : 'ring-4 ring-primary/40 border-primary bg-primary/20 shadow-2xl z-20'
                        : isAlignedTarget
                        ? 'border-white bg-black/60'
                        : 'border-white/20 hover:border-white/50 bg-black/40 backdrop-blur-sm'
                    }`}
                    style={{
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      width: `${s.width}%`,
                      height: `${s.height}%`,
                      borderRadius: s.type === 'circle' ? '9999px' : '1.25rem',
                      backgroundColor: `${s.color}33`,
                      borderColor: s.color
                    }}
                  >
                    {/* Header: Label & Lock Status */}
                    <div className="flex items-center justify-between w-full min-w-0">
                      <span
                        className="text-[10px] font-black uppercase tracking-wider text-white truncate drop-shadow px-1.5 py-0.5 rounded bg-black/60"
                        style={{ color: '#ffffff' }}
                      >
                        {s.label}
                      </span>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {/* Lock / Unlock Toggle Button on Shape */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLock(s.id);
                          }}
                          className={`p-1 rounded-md transition ${
                            s.isLocked
                              ? 'bg-amber-500/30 text-amber-400 border border-amber-500/40'
                              : 'bg-black/40 text-neutral-400 hover:text-white'
                          }`}
                          title={s.isLocked ? "Locked - Click to unlock" : "Unlocked - Click to lock"}
                        >
                          {s.isLocked ? <Lock size={12} /> : <Unlock size={11} />}
                        </button>
                      </div>
                    </div>

                    {/* Middle: Real-time Measurement Badge */}
                    {showMeasurements && (
                      <div className="flex items-center justify-center my-auto">
                        <span className="text-[9px] font-mono font-bold text-white/90 bg-black/60 px-2 py-0.5 rounded-md border border-white/10 shadow-xs backdrop-blur-xs flex items-center gap-1">
                          <Ruler size={10} className="text-primary" />
                          <span>{formatDimensions(s.width, s.height)}</span>
                        </span>
                      </div>
                    )}

                    {/* Bottom: Assigned Items Badge */}
                    {assignedCount > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-auto">
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-black/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Package size={10} />
                          {assignedCount} {assignedCount === 1 ? 'Item' : 'Items'}
                        </span>
                      </div>
                    )}

                    {/* Floating Tooltip during Dragging / Resizing */}
                    {isBeingDragged && (
                      <div className="absolute -top-8 left-0 px-2.5 py-1 bg-neutral-950 text-primary border border-primary/50 rounded-lg text-[9px] font-mono font-black whitespace-nowrap shadow-xl z-40 flex items-center gap-1.5 animate-pulse">
                        <Crosshair size={11} />
                        <span>
                          {formatDimensions(s.width, s.height)} | X: {formatSingleLength(s.x, 'x')}, Y: {formatSingleLength(s.y, 'y')}
                        </span>
                      </div>
                    )}

                    {/* RESIZE HANDLES (Rendered when selected & unlocked) */}
                    {isSelected && !s.isLocked && (
                      <>
                        {/* Corner Handles */}
                        <div
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, s, 'nw')}
                          className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Resize Top-Left"
                        />
                        <div
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, s, 'ne')}
                          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white cursor-nesw-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Resize Top-Right"
                        />
                        <div
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, s, 'sw')}
                          className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white cursor-nesw-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Resize Bottom-Left"
                        />
                        <div
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, s, 'se')}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Resize Bottom-Right"
                        />

                        {/* Edge Handles */}
                        <div
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, s, 'n')}
                          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white cursor-ns-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Resize Height Top"
                        />
                        <div
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, s, 's')}
                          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white cursor-ns-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Resize Height Bottom"
                        />
                        <div
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, s, 'w')}
                          className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white cursor-ew-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Resize Width Left"
                        />
                        <div
                          onMouseDown={(e) => handleResizeHandleMouseDown(e, s, 'e')}
                          className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white cursor-ew-resize shadow-md hover:scale-125 transition-transform z-30"
                          title="Resize Width Right"
                        />
                      </>
                    )}
                  </div>
                );
              })}

              {/* Group Bounding Box Overlay */}
              {selectedGroupBoundingBox && (
                <div
                  className="absolute border-2 border-dashed border-purple-400 bg-purple-500/10 rounded-2xl pointer-events-none z-30 transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                  style={{
                    left: `${selectedGroupBoundingBox.x}%`,
                    top: `${selectedGroupBoundingBox.y}%`,
                    width: `${selectedGroupBoundingBox.width}%`,
                    height: `${selectedGroupBoundingBox.height}%`
                  }}
                >
                  <div className="absolute -top-7 left-0 pointer-events-auto flex items-center gap-1.5 bg-neutral-950/95 border border-purple-500/50 rounded-full px-2.5 py-0.5 shadow-xl text-[9px] font-mono font-black text-purple-300">
                    <Group size={11} className="text-purple-400 shrink-0" />
                    <span>Group ({selectedShapes.length} items)</span>
                    <div className="w-px h-3 bg-neutral-800 mx-0.5" />
                    {canGroup && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGroupSelectedShapes(); }}
                        className="hover:text-white transition flex items-center gap-1 bg-purple-500/20 px-1.5 py-0.5 rounded-md"
                        title="Group items together (Ctrl+G)"
                      >
                        <span>Lock Group</span>
                      </button>
                    )}
                    {canUngroup && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUngroupSelectedShapes(); }}
                        className="hover:text-white transition flex items-center gap-1 bg-neutral-800 px-1.5 py-0.5 rounded-md"
                        title="Ungroup items (Ctrl+Shift+G)"
                      >
                        <Ungroup size={10} />
                        <span>Ungroup</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Empty Canvas Placeholder */}
              {shapes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-neutral-500 pointer-events-none">
                  <Layers size={48} className="mb-2 opacity-50 text-neutral-400" />
                  <p className="font-black text-sm uppercase tracking-wider text-neutral-300">Empty Organizer Canvas</p>
                  <p className="text-xs text-neutral-500 max-w-xs mt-1">
                    Click a tool on the left to add shapes, or click <span className="text-amber-400 font-bold">AI Layout</span> to auto-generate a TrekPak foam sketch.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Properties, Measurements & Gear Assignment */}
        <div className="w-full lg:w-80 bg-neutral-900 border-t lg:border-t-0 lg:border-l border-neutral-800 flex flex-col z-10 shrink-0">
          {/* Sidebar Navigation Tabs */}
          <div className="p-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-around">
            <button
              onClick={() => setTrayTab('gear')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition flex items-center gap-1.5 ${
                trayTab === 'gear' ? 'bg-primary text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Package size={14} />
              <span>Gear Items</span>
            </button>
            <button
              onClick={() => setTrayTab('layers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition flex items-center gap-1.5 ${
                trayTab === 'layers' ? 'bg-primary text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Layers size={14} />
              <span>Sections ({shapes.length})</span>
            </button>
            <button
              onClick={() => setTrayTab('settings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition flex items-center gap-1.5 ${
                trayTab === 'settings' ? 'bg-primary text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Grid size={14} />
              <span>Grid & CAD</span>
            </button>
          </div>

          {/* Properties Panel for Selected Shape */}
          {selectedShape ? (
            <div className="p-4 bg-neutral-850 border-b border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                  Selected Section {selectedShape.isLocked && <Lock size={12} className="text-amber-400" />}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRotateShape(selectedShape.id)}
                    className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300"
                    title="Rotate 90"
                  >
                    <RotateCw size={14} />
                  </button>
                  <button
                    onClick={() => handleDuplicateShape(selectedShape.id)}
                    className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300"
                    title="Duplicate"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleLock(selectedShape.id)}
                    className={`p-1.5 rounded-lg transition ${
                      selectedShape.isLocked ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                    }`}
                    title={selectedShape.isLocked ? "Unlock Position" : "Lock Position"}
                  >
                    {selectedShape.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button
                    onClick={() => handleDeleteShape(selectedShape.id)}
                    className="p-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Label Edit */}
              <div>
                <label className="text-[9px] font-bold uppercase text-neutral-400">Section Label</label>
                <input
                  type="text"
                  value={selectedShape.label}
                  onChange={e => updateShape(selectedShape.id, { label: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 text-white font-bold text-xs p-2 rounded-xl focus:outline-none focus:border-primary mt-1"
                />
              </div>

              {/* Precise Dimensions Control */}
              <div className="p-3 bg-neutral-900/80 rounded-2xl border border-neutral-700/60 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-neutral-300">
                  <span className="flex items-center gap-1">
                    <Ruler size={12} className="text-primary" />
                    <span>Exact Measurements</span>
                  </span>
                  <span className="text-primary font-mono font-bold">
                    {formatDimensions(selectedShape.width, selectedShape.height)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-neutral-400">Width (%)</label>
                    <input
                      type="number"
                      min={3}
                      max={100}
                      disabled={selectedShape.isLocked}
                      value={Math.round(selectedShape.width)}
                      onChange={e => updateShape(selectedShape.id, { width: Math.max(3, Math.min(100, Number(e.target.value))) })}
                      className="w-full bg-neutral-950 border border-neutral-700 text-white font-mono font-bold text-xs p-1.5 rounded-lg mt-0.5 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-neutral-400">Height (%)</label>
                    <input
                      type="number"
                      min={3}
                      max={100}
                      disabled={selectedShape.isLocked}
                      value={Math.round(selectedShape.height)}
                      onChange={e => updateShape(selectedShape.id, { height: Math.max(3, Math.min(100, Number(e.target.value))) })}
                      className="w-full bg-neutral-950 border border-neutral-700 text-white font-mono font-bold text-xs p-1.5 rounded-lg mt-0.5 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-neutral-400">Pos X (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={97}
                      disabled={selectedShape.isLocked}
                      value={Math.round(selectedShape.x)}
                      onChange={e => updateShape(selectedShape.id, { x: Math.max(0, Math.min(97, Number(e.target.value))) })}
                      className="w-full bg-neutral-950 border border-neutral-700 text-white font-mono font-bold text-xs p-1.5 rounded-lg mt-0.5 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-neutral-400">Pos Y (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={97}
                      disabled={selectedShape.isLocked}
                      value={Math.round(selectedShape.y)}
                      onChange={e => updateShape(selectedShape.id, { y: Math.max(0, Math.min(97, Number(e.target.value))) })}
                      className="w-full bg-neutral-950 border border-neutral-700 text-white font-mono font-bold text-xs p-1.5 rounded-lg mt-0.5 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Color Selector */}
              <div>
                <label className="text-[9px] font-bold uppercase text-neutral-400 mb-1 block">Accent Color</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => updateShape(selectedShape.id, { color: c.hex })}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        selectedShape.color === c.hex ? 'scale-125 border-white ring-2 ring-primary' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-neutral-900 border-b border-neutral-800 text-[11px] text-neutral-400 text-center font-medium">
              Click any shape to view exact measurements, drag handles & lock status
            </div>
          )}

          {/* Tray Tab Contents */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {trayTab === 'gear' && (
              <>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search equipment..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 text-white font-medium text-xs p-2.5 rounded-xl focus:outline-none focus:border-primary"
                  />
                  <label className="flex items-center gap-2 text-xs font-bold text-neutral-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterUnassigned}
                      onChange={e => setFilterUnassigned(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>Show Unassigned Gear Only</span>
                  </label>
                </div>

                <div className="space-y-2">
                  {filteredGear.map(item => {
                    const assignedSectionLabel = assignedGearMap.get(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between gap-2 ${
                          assignedSectionLabel
                            ? 'bg-neutral-950/80 border-emerald-500/30 text-white'
                            : 'bg-neutral-800/50 border-neutral-700/50 hover:border-neutral-600 text-neutral-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs truncate">{item.name}</p>
                          <p className="text-[9px] uppercase font-black text-neutral-400">{item.category || 'General'}</p>
                          {assignedSectionLabel && (
                            <span className="inline-block text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded mt-1">
                              In: {assignedSectionLabel}
                            </span>
                          )}
                        </div>

                        {selectedShapeId && (
                          <button
                            onClick={() => handleToggleGearAssignment(selectedShapeId, item.id)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase transition ${
                              selectedShape?.assignedGearIds?.includes(item.id)
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white'
                                : 'bg-primary text-white hover:bg-primary/80'
                            }`}
                          >
                            {selectedShape?.assignedGearIds?.includes(item.id) ? 'Remove' : 'Assign'}
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {filteredGear.length === 0 && (
                    <p className="text-xs text-neutral-500 text-center py-6 italic">No matching gear found.</p>
                  )}
                </div>
              </>
            )}

            {trayTab === 'layers' && (
              <div className="space-y-2">
                {shapes.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedShapeId(s.id)}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                      selectedShapeId === s.id
                        ? 'bg-primary/20 border-primary text-white'
                        : 'bg-neutral-800/40 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="font-bold text-xs truncate">{s.label}</span>
                      {s.isLocked && <Lock size={12} className="text-amber-400 shrink-0" />}
                    </div>
                    <span className="text-[9px] font-mono text-neutral-400 font-bold">{formatDimensions(s.width, s.height)}</span>
                  </div>
                ))}

                {shapes.length === 0 && (
                  <p className="text-xs text-neutral-500 text-center py-6 italic">No sections created yet.</p>
                )}
              </div>
            )}

            {trayTab === 'settings' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-neutral-400 block">Measurement Unit</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['mm', 'in', 'cm', 'pct'] as const).map(u => (
                      <button
                        key={u}
                        onClick={() => setMeasurementUnit(u)}
                        className={`p-2 rounded-xl text-xs font-black uppercase transition ${
                          measurementUnit === u ? 'bg-blue-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-neutral-400 block">Grid Style</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['dots', 'lines', 'mesh'] as const).map(gt => (
                      <button
                        key={gt}
                        onClick={() => setGridType(gt)}
                        className={`p-2 rounded-xl text-xs font-black uppercase transition ${
                          gridType === gt ? 'bg-primary text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {gt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-neutral-400 block">Snap Step Increment</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[2.5, 5, 10, 20].map(sz => (
                      <button
                        key={sz}
                        onClick={() => setGridSize(sz)}
                        className={`p-2 rounded-xl text-xs font-black uppercase transition ${
                          gridSize === sz ? 'bg-emerald-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {sz}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-800 space-y-2 text-xs font-bold text-neutral-300">
                  <div className="flex items-center justify-between">
                    <span>Container Width:</span>
                    <span className="font-mono text-primary">{containerWidthMm} mm</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Container Height:</span>
                    <span className="font-mono text-primary">{containerHeightMm} mm</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Depth:</span>
                    <span className="font-mono text-primary">{activePreset.depthMm} mm</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu Floating Popup */}
      {contextMenu.visible && (
        <div
          className="fixed bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-2 z-50 min-w-[180px] space-y-1 text-xs text-white"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.shapeId ? (
            <>
              <button
                onClick={() => {
                  const newName = prompt("Rename Section:", selectedShape?.label);
                  if (newName) updateShape(contextMenu.shapeId!, { label: newName });
                  setContextMenu({ visible: false, x: 0, y: 0 });
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 rounded-xl font-bold flex items-center gap-2"
              >
                <Tag size={14} className="text-primary" />
                <span>Rename Label</span>
              </button>

              <button
                onClick={() => {
                  handleRotateShape(contextMenu.shapeId!);
                  setContextMenu({ visible: false, x: 0, y: 0 });
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 rounded-xl font-bold flex items-center gap-2"
              >
                <RotateCw size={14} className="text-blue-400" />
                <span>Rotate 90°</span>
              </button>

              <button
                onClick={() => {
                  handleDuplicateShape(contextMenu.shapeId!);
                  setContextMenu({ visible: false, x: 0, y: 0 });
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 rounded-xl font-bold flex items-center gap-2"
              >
                <Copy size={14} className="text-emerald-400" />
                <span>Duplicate Shape</span>
              </button>

              <button
                onClick={() => {
                  handleToggleLock(contextMenu.shapeId!);
                  setContextMenu({ visible: false, x: 0, y: 0 });
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 rounded-xl font-bold flex items-center gap-2"
              >
                <Lock size={14} className="text-amber-400" />
                <span>Toggle Lock Position</span>
              </button>

              {canGroup && (
                <button
                  onClick={() => {
                    handleGroupSelectedShapes();
                    setContextMenu({ visible: false, x: 0, y: 0 });
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-neutral-800 rounded-xl font-bold flex items-center gap-2 text-purple-300"
                >
                  <Group size={14} className="text-purple-400" />
                  <span>Group Shapes (Ctrl+G)</span>
                </button>
              )}

              {canUngroup && (
                <button
                  onClick={() => {
                    handleUngroupSelectedShapes();
                    setContextMenu({ visible: false, x: 0, y: 0 });
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-neutral-800 rounded-xl font-bold flex items-center gap-2 text-purple-300"
                >
                  <Ungroup size={14} className="text-purple-400" />
                  <span>Ungroup Shapes (Ctrl+Shift+G)</span>
                </button>
              )}

              <div className="h-px bg-neutral-800 my-1" />

              <button
                onClick={() => {
                  handleDeleteShape(contextMenu.shapeId!);
                  setContextMenu({ visible: false, x: 0, y: 0 });
                }}
                className="w-full text-left px-3 py-2 hover:bg-red-500/20 text-red-400 rounded-xl font-bold flex items-center gap-2"
              >
                <Trash2 size={14} />
                <span>Delete Section</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  handleAddPresetShape('rectangle');
                  setContextMenu({ visible: false, x: 0, y: 0 });
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 rounded-xl font-bold flex items-center gap-2"
              >
                <Plus size={14} className="text-primary" />
                <span>Add Rectangle Cutout</span>
              </button>
              <button
                onClick={() => {
                  handleAddPresetShape('circle');
                  setContextMenu({ visible: false, x: 0, y: 0 });
                }}
                className="w-full text-left px-3 py-2 hover:bg-neutral-800 rounded-xl font-bold flex items-center gap-2"
              >
                <Circle size={14} className="text-blue-400" />
                <span>Add Optics Lens Well</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {isAIModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-base uppercase">AI Foam Layout Optimizer</h3>
                    <p className="text-xs text-neutral-400">Automated 2D TrekPak / Foam sketch generation</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAIModalOpen(false)}
                  className="p-2 text-neutral-400 hover:text-white rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Source Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-neutral-300 uppercase block">1. Select Gear Source</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAiSource('gear')}
                    className={`p-3 rounded-2xl border text-xs font-black uppercase text-left transition ${
                      aiSource === 'gear' ? 'bg-primary/20 border-primary text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    From Gear Library ({allGear.length})
                  </button>
                  <button
                    onClick={() => setAiSource('packing_list')}
                    className={`p-3 rounded-2xl border text-xs font-black uppercase text-left transition ${
                      aiSource === 'packing_list' ? 'bg-primary/20 border-primary text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    From Premade Packing List
                  </button>
                </div>

                {aiSource === 'packing_list' && (
                  <select
                    value={selectedListIdForAI}
                    onChange={e => setSelectedListIdForAI(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 text-white font-bold text-xs p-3 rounded-2xl focus:outline-none focus:border-primary"
                  >
                    <option value="">Select a Packing List...</option>
                    {allPackingLists.map(list => (
                      <option key={list.id} value={list.id}>{list.name} ({list.items?.length || 0} items)</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Priority Preference */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300 uppercase block">2. Layout Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setAiPriority('protection')}
                    className={`p-2.5 rounded-2xl border text-[10px] font-black uppercase text-center transition ${
                      aiPriority === 'protection' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    Protection & Foam
                  </button>
                  <button
                    onClick={() => setAiPriority('density')}
                    className={`p-2.5 rounded-2xl border text-[10px] font-black uppercase text-center transition ${
                      aiPriority === 'density' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    Max Density
                  </button>
                  <button
                    onClick={() => setAiPriority('workflow')}
                    className={`p-2.5 rounded-2xl border text-[10px] font-black uppercase text-center transition ${
                      aiPriority === 'workflow' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    Workflow Order
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsAIModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRunAILayout}
                  disabled={isGeneratingAI}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs rounded-xl flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {isGeneratingAI ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Designing Foam Sketch...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Generate Layout Sketch</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrganizerDesignerWidget;
