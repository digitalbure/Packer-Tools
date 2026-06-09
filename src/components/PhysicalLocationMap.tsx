import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  Box, 
  Database, 
  MapPin, 
  Layers, 
  Cpu, 
  Server, 
  Plus, 
  Trash2, 
  Settings, 
  Search, 
  Building2, 
  Tag, 
  HelpCircle, 
  Check, 
  FolderOpen, 
  Workflow, 
  Sliders, 
  X, 
  Info, 
  Sparkles, 
  RefreshCw,
  LayoutGrid,
  Filter,
  Move,
  ArrowRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, Rack, RackItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// Custom Inventory Item interface matching InventoryModule.tsx
export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  brand?: string;
  model?: string;
  modelNumber?: string;
  serialNumber?: string;
  primaryCategory: string;
  weight?: number;
  weightUnit?: string;
  price?: number;
  condition: 'new' | 'good' | 'fair' | 'poor';
  quantity: number;
  status: 'available' | 'in_use' | 'maintenance' | 'retired' | 'missing';
  assetTag: string;
  photoUrls?: string[];
  lastMaintenanceDate?: string;
  maintenanceIntervalDays?: number;
  orgId?: string;
  deptId?: string;
  teamId?: string;
  assignedTo?: string;
  visibility?: 'public' | 'private' | 'team' | 'dept' | 'org';
  createdAt: string;
  updatedAt: string;
  // Location specific fields added dynamically
  storageUnit?: string;
  containerName?: string;
  rackId?: string;
}

interface PhysicalLocationMapProps {
  user: UserProfile | null;
  adminSettings: any;
  inventoryItems: InventoryItem[];
  selectedInventory: any | null;
  organizations: any[];
  departments: any[];
  teams: any[];
}

// Node type definitions for D3 network graph
interface MapNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'hub' | 'rack' | 'cabinet' | 'container' | 'item' | 'rackmount_device';
  status?: string;
  itemDetails?: any;
  rackId?: string;
  uPosition?: number;
  uHeight?: number;
  quantity?: number;
  price?: number;
  category?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface MapLink extends d3.SimulationLinkDatum<MapNode> {
  source: string | MapNode;
  target: string | MapNode;
}

export default function PhysicalLocationMap({
  user,
  adminSettings,
  inventoryItems = [],
  selectedInventory,
  organizations = [],
  departments = [],
  teams = []
}: PhysicalLocationMapProps) {
  // DB states for Racking
  const [racks, setRacks] = useState<Rack[]>([]);
  const [rackItems, setRackItems] = useState<Record<string, RackItem[]>>({});
  const [loadingRacks, setLoadingRacks] = useState(true);

  // Filter and Interactive Selection states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [isAssigningModalOpen, setIsAssigningModalOpen] = useState(false);
  const [assigningItem, setAssigningItem] = useState<InventoryItem | null>(null);

  // New assignment target form
  const [targetType, setTargetType] = useState<'rack' | 'static'>('static');
  const [selectedTargetRackId, setSelectedTargetRackId] = useState('');
  const [selectedTargetStaticUnit, setSelectedTargetStaticUnit] = useState('cabinet_alpha');
  const [selectedTargetContainer, setSelectedTargetContainer] = useState('Shelf A1');

  // SVG references
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Preset virtual static storage units
  const STATIC_UNITS = [
    { id: 'cabinet_alpha', name: 'Cab Zone Alpha (Central Storage Shelf)' },
    { id: 'cabinet_beta', name: 'Mobile Flight Case (Field Kits Zone)' },
    { id: 'rack_depot', name: 'Audio Racks Depot (Staging Bay)' }
  ];

  const CONTAINERS = [
    { unitId: 'cabinet_alpha', name: 'Shelf A1' },
    { unitId: 'cabinet_alpha', name: 'Shelf A2' },
    { unitId: 'cabinet_alpha', name: 'Parts Organizer Drawer' },
    { unitId: 'cabinet_beta', name: 'Heavy Duty Bin #1' },
    { unitId: 'cabinet_beta', name: 'Accessory Case B' },
    { unitId: 'rack_depot', name: 'Stage Rack Unit Slot 1' },
    { unitId: 'rack_depot', name: 'Stage Rack Drawer C' }
  ];

  // Fetch real Racks and RackItems of the user
  useEffect(() => {
    if (!user) return;
    
    setLoadingRacks(true);
    const qRacks = query(collection(db, 'racks'), where('ownerId', '==', user.uid));
    
    const unsubRacks = onSnapshot(qRacks, (snapshot) => {
      const fetchedRacks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Rack[];
      setRacks(fetchedRacks);
      setLoadingRacks(false);
    }, (err) => {
      console.warn("LocationMap: Error listening to racks:", err);
      setLoadingRacks(false);
    });

    return () => unsubRacks();
  }, [user]);

  useEffect(() => {
    if (racks.length === 0) return;

    const unsubs = racks.map(rack => {
      return onSnapshot(query(collection(db, 'racks', rack.id, 'items')), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RackItem[];
        setRackItems(prev => ({
          ...prev,
          [rack.id]: items
        }));
      }, (err) => {
        console.warn("LocationMap: Error listening to rack items for:", rack.id, err);
      });
    });

    return () => unsubs.forEach(unsub => unsub());
  }, [racks]);

  // Handle re-assigning actual elements
  const handlePerformAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventory || !assigningItem) {
      toast.error("Please load a Departmental sheet to persist asset locations.");
      return;
    }

    try {
      const itemDocRef = doc(db, 'inventories', selectedInventory.id, 'items', assigningItem.id);
      
      const updateData: {
        rackId: string | null;
        storageUnit: string;
        containerName: string;
        updatedAt: string;
      } = {
        rackId: targetType === 'rack' ? selectedTargetRackId : null,
        storageUnit: targetType === 'rack' ? selectedTargetRackId : selectedTargetStaticUnit,
        containerName: selectedTargetContainer,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(itemDocRef, updateData);
      
      toast.success(`Successfully assigned "${assigningItem.name}" to ${
        targetType === 'rack' 
          ? racks.find(r => r.id === selectedTargetRackId)?.name || 'Rack'
          : STATIC_UNITS.find(u => u.id === selectedTargetStaticUnit)?.name || 'Storage Zone'
      } inside container "${selectedTargetContainer}"`);
      
      setIsAssigningModalOpen(false);
      setAssigningItem(null);
    } catch (err) {
      console.error("Assignment failure:", err);
      toast.error("Failed to persist location mapping in database.");
    }
  };

  // Compile nodes and links for D3 layout
  const { nodes, links } = useMemo(() => {
    const nodesList: MapNode[] = [];
    const linksList: MapLink[] = [];

    // 1. Root Central Hub Node
    nodesList.push({
      id: 'root_hub',
      name: selectedInventory ? `HUB: ${selectedInventory.name}` : 'Central Logistics Hub',
      type: 'hub'
    });

    // 2. Add Fixed Virtual Storage Units and containers
    STATIC_UNITS.forEach(unit => {
      nodesList.push({
        id: unit.id,
        name: unit.name,
        type: 'cabinet'
      });
      // Link to root hub
      linksList.push({ source: 'root_hub', target: unit.id });
    });

    CONTAINERS.forEach(cont => {
      const uniqueId = `cont_${cont.unitId}_${cont.name.replace(/\s+/g, '_')}`;
      nodesList.push({
        id: uniqueId,
        name: cont.name,
        type: 'container',
        rackId: cont.unitId
      });
      // Link container to its storage unit
      linksList.push({ source: cont.unitId, target: uniqueId });
    });

    // 3. Add User Racks (from user's racking setup)
    racks.forEach(rack => {
      nodesList.push({
        id: rack.id,
        name: `RACK: ${rack.name} (${rack.totalUnits}U)`,
        type: 'rack'
      });
      // Link rack to root hub
      linksList.push({ source: 'root_hub', target: rack.id });

      // Add rack slots/containers or group of units inside
      const uHeightGroupNum = 4; // Visual segmentation in rack
      const segmentsCount = Math.ceil(rack.totalUnits / uHeightGroupNum);
      for (let s = 0; s < segmentsCount; s++) {
        const startU = s * uHeightGroupNum + 1;
        const endU = Math.min((s + 1) * uHeightGroupNum, rack.totalUnits);
        const segmentId = `rack_segment_${rack.id}_u_${startU}_to_${endU}`;
        
        nodesList.push({
          id: segmentId,
          name: `U${startU} - U${endU} Space`,
          type: 'container',
          rackId: rack.id
        });
        linksList.push({ source: rack.id, target: segmentId });

        // Link rack items inside this range to the segment
        const items = rackItems[rack.id] || [];
        items.forEach(item => {
          if (item.uPosition >= startU && item.uPosition <= endU) {
            nodesList.push({
              id: item.id,
              name: item.name,
              type: 'rackmount_device',
              status: item.status,
              itemDetails: item,
              uPosition: item.uPosition,
              uHeight: item.uHeight
            });
            linksList.push({ source: segmentId, target: item.id });
          }
        });
      }
    });

    // 4. Add Inventory items with custom positions
    inventoryItems.forEach(item => {
      const matchSearch = searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.primaryCategory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.assetTag?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchFilter = filterType === 'all' || 
        (filterType === 'mapped' && (item.storageUnit || item.rackId)) ||
        (filterType === 'unmapped' && !(item.storageUnit || item.rackId)) ||
        (filterType === item.primaryCategory);

      if (!matchSearch || !matchFilter) return;

      nodesList.push({
        id: `item_${item.id}`,
        name: item.name,
        type: 'item',
        status: item.status,
        quantity: item.quantity,
        price: item.price,
        category: item.primaryCategory,
        itemDetails: item
      });

      // Bind node to its physical location
      if (item.rackId && racks.some(r => r.id === item.rackId)) {
        // Find segment linked to this
        const ri = rackItems[item.rackId]?.find(x => x.assetTag === item.assetTag);
        if (ri) {
          // If a rack item exists with the same asset code, link them!
          linksList.push({ source: ri.id, target: `item_${item.id}` });
        } else {
          // Link directly to the Rack node
          linksList.push({ source: item.rackId, target: `item_${item.id}` });
        }
      } else if (item.storageUnit && item.containerName) {
        const targetContainerUniqueId = `cont_${item.storageUnit}_${item.containerName.replace(/\s+/g, '_')}`;
        // If container node exists, connect to container, otherwise connect directly to storage unit
        if (nodesList.some(n => n.id === targetContainerUniqueId)) {
          linksList.push({ source: targetContainerUniqueId, target: `item_${item.id}` });
        } else if (nodesList.some(n => n.id === item.storageUnit)) {
          linksList.push({ source: item.storageUnit, target: `item_${item.id}` });
        } else {
          // Unassigned fallback unit path
          if (!nodesList.some(n => n.id === 'unassigned_fallback')) {
            nodesList.push({ id: 'unassigned_fallback', name: 'Undefined Compartment Pool', type: 'cabinet' });
            linksList.push({ source: 'root_hub', target: 'unassigned_fallback' });
          }
          linksList.push({ source: 'unassigned_fallback', target: `item_${item.id}` });
        }
      } else {
        // Place item in general "Unassigned Logistics Storage"
        if (!nodesList.some(n => n.id === 'general_unassigned')) {
          nodesList.push({
            id: 'general_unassigned',
            name: 'Unassigned Transit Bins',
            type: 'container'
          });
          linksList.push({ source: 'cabinet_alpha', target: 'general_unassigned' });
        }
        linksList.push({ source: 'general_unassigned', target: `item_${item.id}` });
      }
    });

    return { nodes: nodesList, links: linksList };
  }, [selectedInventory, inventoryItems, racks, rackItems, searchQuery, filterType]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCount = inventoryItems.length;
    let mapped = 0;
    let totalValue = 0;
    
    inventoryItems.forEach(item => {
      if (item.storageUnit || item.rackId) mapped++;
      totalValue += (item.price || 0) * (item.quantity || 1);
    });

    const rackFillMap: Record<string, number> = {};
    racks.forEach(r => {
      const items = rackItems[r.id] || [];
      const usedU = items.reduce((sum, item) => sum + (item.uHeight || 1), 0);
      rackFillMap[r.name] = Math.min((usedU / r.totalUnits) * 100, 100);
    });

    return {
      total: totalCount,
      mapped,
      unmapped: totalCount - mapped,
      value: totalValue,
      rackFillMap
    };
  }, [inventoryItems, racks, rackItems]);

  // Feed D3 simulation and draw layout
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = 550;

    const svg = d3.select(svgRef.current)
      .attr('width', '105%')
      .attr('height', height)
      .style('background', '#18181b') // neutral-900 backing
      .style('border-radius', '1.5rem')
      .style('cursor', 'grab');

    svg.selectAll('*').remove();

    // Zoom container
    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial transform - center the hub
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));

    // Force simulation setup
    const simulation = d3.forceSimulation<MapNode>(nodes)
      .force('link', d3.forceLink<MapNode, MapLink>(links)
        .id(d => d.id)
        .distance((n: any) => {
          if (n.source.id === 'root_hub' || n.target.id === 'root_hub') return 160;
          if (n.source.type === 'rack' || n.target.type === 'rack') return 110;
          if (n.source.type === 'container' || n.target.type === 'container') return 70;
          return 50;
        })
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force('collision', d3.forceCollide().radius(35))
      .force('center', d3.forceCenter(0, 0))
      .alphaDecay(0.04);

    // Draw lines/links
    const link = g.append('g')
      .attr('stroke', '#3f3f46') // zinc-700
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-dasharray', d => {
        if (d.source === 'root_hub' || d.target === 'root_hub') return 'none';
        return '4 4'; // dotted for sub-locations
      });

    // Draw Nodes groups
    const node = g.append('g')
      .selectAll<any, MapNode>('g')
      .data(nodes)
      .join('g')
      .call(drag(simulation))
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      });

    // Node circles / icons backings
    node.append('circle')
      .attr('r', d => {
        if (d.type === 'hub') return 24;
        if (d.type === 'rack') return 18;
        if (d.type === 'cabinet') return 16;
        if (d.type === 'container') return 13;
        return 9; // items and devices
      })
      .attr('fill', d => {
        if (d.type === 'hub') return '#f59e0b'; // amber-500 yellow glow
        if (d.type === 'rack') return '#0284c7'; // sky-600 blue deep
        if (d.type === 'cabinet') return '#8b5cf6'; // violet-500
        if (d.type === 'container') return '#ec4899'; // pink-500
        if (d.type === 'rackmount_device') return '#06b6d4'; // cyan-500
        
        // Custom items
        if (d.status === 'available') return '#10b981'; // emerald-500
        if (d.status === 'maintenance') return '#f97316'; // orange-500
        if (d.status === 'missing') return '#ef4444'; // red-500
        return '#71717a'; // neutral-500 for other status
      })
      .attr('stroke', '#18181b')
      .attr('stroke-width', 2)
      .attr('class', 'transition-all duration-200 hover:ring-8 hover:ring-white/20 cursor-pointer')
      .style('filter', d => {
        if (d.type === 'hub') return 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))';
        if (d.type === 'rack') return 'drop-shadow(0 0 6px rgba(2, 132, 199, 0.4))';
        if (d.type === 'rackmount_device') return 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.4))';
        return 'none';
      });

    // Add brief textual letters inside larger nodes
    node.filter(d => ['hub', 'rack', 'cabinet'].includes(d.type))
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', '#ffffff')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .text(d => {
        if (d.type === 'hub') return 'HUB';
        if (d.type === 'rack') return 'U';
        if (d.type === 'cabinet') return 'CAB';
        return '';
      })
      .attr('pointer-events', 'none');

    // Display Labels for Nodes
    node.append('text')
      .attr('dx', d => {
        if (d.type === 'hub') return 30;
        if (d.type === 'rack') return 24;
        if (d.type === 'cabinet') return 22;
        return 16;
      })
      .attr('dy', '.35em')
      .attr('font-size', d => {
        if (d.type === 'hub' || d.type === 'rack') return '11px';
        return '9px';
      })
      .attr('font-weight', d => (['hub', 'rack', 'cabinet'].includes(d.type) ? 'bold' : 'normal'))
      .attr('fill', d => {
        if (d.type === 'hub') return '#fbbf24';
        if (d.type === 'rack') return '#38bdf8';
        if (d.type === 'cabinet') return '#a78bfa';
        if (d.type === 'container') return '#f472b6';
        if (d.type === 'item') return '#e4e4e7'; // zinc-200
        return '#a1a1aa'; // zinc-400
      })
      .text(d => {
        if (d.name.length > 25) return d.name.slice(0, 22) + '...';
        return d.name;
      })
      .attr('pointer-events', 'none');

    // Simulation updates
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as MapNode).x || 0)
        .attr('y1', d => (d.source as MapNode).y || 0)
        .attr('x2', d => (d.target as MapNode).x || 0)
        .attr('y2', d => (d.target as MapNode).y || 0);

      node.attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    // Custom Drag handlers
    function drag(simulation: d3.Simulation<MapNode, MapLink>) {
      function dragstarted(event: d3.D3DragEvent<any, MapNode, MapNode>) {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
        svg.style('cursor', 'grabbing');
      }

      function dragged(event: d3.D3DragEvent<any, MapNode, MapNode>) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: d3.D3DragEvent<any, MapNode, MapNode>) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
        svg.style('cursor', 'grab');
      }

      return d3.drag<any, MapNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
  }, [nodes, links]);

  // Unique categories helper for filters
  const categoriesList = useMemo(() => {
    const list = new Set<string>();
    inventoryItems.forEach(item => {
      if (item.primaryCategory) list.add(item.primaryCategory);
    });
    return Array.from(list);
  }, [inventoryItems]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* LEFT PORT: MAP FILTERS & STOCK HISTORIES */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white border border-neutral-200 rounded-[2rem] p-6 space-y-6">
          <div className="space-y-1">
            <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
              <MapPin size={16} className="text-indigo-500" />
              Location Controls
            </h4>
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#0066cc]">
              {selectedInventory ? selectedInventory.name : 'All Allocations'}
            </p>
          </div>

          {/* Search bar input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search map details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-100 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-black font-semibold h-10"
            />
          </div>

          {/* Type filters */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">
              Filter Visual Nodes
            </label>
            <div className="space-y-1">
              <button
                onClick={() => setFilterType('all')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                  filterType === 'all' ? 'bg-black text-white' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>📦 Render All Assets</span>
                <span className="text-[9px] font-black opacity-80">{stats.total}</span>
              </button>

              <button
                onClick={() => setFilterType('mapped')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                  filterType === 'mapped' ? 'bg-black text-white' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>📍 Mapped Shelves & Racks</span>
                <span className="text-[9px] font-black opacity-80">{stats.mapped}</span>
              </button>

              <button
                onClick={() => setFilterType('unmapped')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                  filterType === 'unmapped' ? 'bg-black text-white' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>❓ Pending Setup Pool</span>
                <span className="text-[9px] font-black opacity-80">{stats.unmapped}</span>
              </button>
            </div>
          </div>

          {/* Category-wise Filter selector */}
          <div className="space-y-2 pt-2 border-t border-neutral-100">
            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">
              Category Overlays
            </label>
            <select
              value={filterType.startsWith('all') || filterType.startsWith('mapped') || filterType.startsWith('unmapped') ? 'all' : filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2 text-xs font-bold outline-none text-neutral-700"
            >
              <option value="all">-- Select Specific Category --</option>
              {categoriesList.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        {/* METRICS SUMMARY CARD */}
        <div className="bg-neutral-900 border border-neutral-800 text-white rounded-[2rem] p-6 space-y-5">
          <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
            <Workflow size={14} />
            Map Density Stats
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-neutral-850 bg-neutral-800/50 p-3 rounded-xl border border-neutral-800">
              <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Total Valuation</p>
              <p className="text-lg font-black tracking-tight text-neutral-200 mt-0.5">
                ${stats.value.toLocaleString()}
              </p>
            </div>
            <div className="bg-neutral-850 bg-neutral-800/50 p-3 rounded-xl border border-neutral-800">
              <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Mapping Ratio</p>
              <p className="text-lg font-black tracking-tight text-emerald-400 mt-0.5">
                {stats.total > 0 ? Math.round((stats.mapped / stats.total) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* User's Racks Live Fill Indicators */}
          <div className="space-y-3 pt-3 border-t border-neutral-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
              RACKS VOLUMETRICS FILL
            </p>
            {racks.length === 0 ? (
              <p className="text-[10px] text-neutral-500 italic pb-1">No active racks registered.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.rackFillMap).slice(0, 4).map(([name, pct]) => (
                  <div key={name} className="space-y-1">
                    <div className="flex justify-between text-[9px] font-semibold text-neutral-300">
                      <span className="truncate max-w-[110px] font-mono">{name}</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct >= 90 ? 'bg-rose-500' : pct >= 65 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CORE PORT: SVG CANVAS */}
      <div className="lg:col-span-2 space-y-4">
        <div ref={containerRef} className="relative w-full rounded-[2.5rem] overflow-hidden border border-neutral-200 shadow-xl bg-neutral-900 group">
          
          {/* Top floating control overlays labels */}
          <div className="absolute top-6 left-6 z-10 flex gap-2 pointer-events-none">
            <span className="bg-neutral-950/80 backdrop-blur-sm border border-neutral-800 text-[9px] font-black uppercase tracking-widest text-neutral-300 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Interactive D3 Force Canvas
            </span>
          </div>

          <div className="absolute top-6 right-6 z-10 flex gap-2">
            <button 
              onClick={() => {
                setSelectedNode(null);
                setSearchQuery('');
                setFilterType('all');
                toast.info("Visual focus map reset.");
              }} 
              className="p-2.5 bg-neutral-950/80 hover:bg-black backdrop-blur-sm border border-neutral-800 text-neutral-400 hover:text-white rounded-xl transition shadow-md"
              title="Reset View"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Explanatory Info Tag in background */}
          <div className="absolute bottom-6 left-6 z-10 bg-neutral-950/70 backdrop-blur-sm border border-neutral-800/60 text-[9px] text-neutral-400 p-3 rounded-2xl max-w-xs pointer-events-none space-y-1.5">
            <p className="font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1">
              <Info size={11} className="text-[#0066cc]" />
              Navigation tip
            </p>
            <p className="leading-relaxed">
              Drag nodes to customize placement manually. Use Scroll-Wheel/Pinch gestures to Zoom & Pan anywhere. Click any node to open properties.
            </p>
          </div>

          <svg ref={svgRef} className="w-full h-[550px]" />
          
          {/* Loading indicator Overlay */}
          {loadingRacks && (
            <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
              <RefreshCw className="animate-spin text-amber-500" size={32} />
              <p className="text-xs uppercase font-black text-neutral-400 tracking-widest">
                Compiling storage map graph...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PORT: PROPERTY INSPECTOR */}
      <div className="lg:col-span-1">
        <div className="bg-white border border-neutral-200 rounded-[2rem] p-6 h-full flex flex-col justify-between min-h-[480px]">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                <Sliders size={16} className="text-amber-500" />
                Asset Inspector
              </h4>
              <span className="text-[8px] font-black uppercase tracking-wider text-neutral-400 font-mono">
                Live details
              </span>
            </div>

            {selectedNode ? (
              <div className="space-y-6 pt-6">
                <div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    selectedNode.type === 'hub' ? 'bg-amber-100 text-amber-700' :
                    selectedNode.type === 'rack' ? 'bg-sky-100 text-sky-700' :
                    selectedNode.type === 'cabinet' ? 'bg-purple-100 text-purple-700' :
                    selectedNode.type === 'container' ? 'bg-pink-100 text-pink-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedNode.type} Node
                  </span>
                  <h3 className="text-md font-bold mt-2 text-neutral-900 leading-tight">
                    {selectedNode.name}
                  </h3>
                </div>

                {/* Container/Bay Occupancy detail if Node is Shelf/Rack */}
                {(selectedNode.type === 'rack' || selectedNode.type === 'cabinet' || selectedNode.type === 'container') && (
                  <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
                      Capacity Status
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-neutral-600">
                        <span>Connected nodes</span>
                        <span>
                          {links.filter(l => l.source === selectedNode.id || (typeof l.source === 'object' && l.source.id === selectedNode.id)).length} elements
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 pt-1 leading-snug">
                        All mapped gear connected to this sector responds dynamically to real-time syncs.
                      </p>
                    </div>
                  </div>
                )}

                {/* Sub Item Attributes if Node is custom Gear or Rack mount Item */}
                {(selectedNode.type === 'item' || selectedNode.type === 'rackmount_device') && selectedNode.itemDetails && (
                  <div className="space-y-4">
                    {selectedNode.itemDetails.photoUrls && selectedNode.itemDetails.photoUrls[0] && (
                      <div className="w-full h-28 rounded-2xl overflow-hidden border border-neutral-100 bg-neutral-50 shadow-sm">
                        <img 
                          src={selectedNode.itemDetails.photoUrls[0]} 
                          alt="Asset info" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                      <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                        <span className="text-[8px] font-black uppercase text-neutral-400 block tracking-wider">Asset Code</span>
                        <span className="font-bold text-neutral-800 text-xs">
                          {selectedNode.itemDetails.assetTag || 'N/A'}
                        </span>
                      </div>
                      <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                        <span className="text-[8px] font-black uppercase text-neutral-400 block tracking-wider">Operational</span>
                        <span className={`font-black text-xs uppercase tracking-wider ${
                          selectedNode.itemDetails.status === 'available' ? 'text-emerald-600' : 'text-neutral-500'
                        }`}>
                          {selectedNode.itemDetails.status || 'Active'}
                        </span>
                      </div>
                      <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                        <span className="text-[8px] font-black uppercase text-neutral-400 block tracking-wider">Category</span>
                        <span className="font-bold text-neutral-700 text-xs truncate block">
                          {selectedNode.category || selectedNode.itemDetails.primaryCategory || 'Broadcasting'}
                        </span>
                      </div>
                      <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                        <span className="text-[8px] font-black uppercase text-neutral-400 block tracking-wider">Price / Value</span>
                        <span className="font-bold text-neutral-800 text-xs">
                          ${selectedNode.price !== undefined ? selectedNode.price : (selectedNode.itemDetails.price || 0)}
                        </span>
                      </div>
                    </div>

                    {selectedNode.itemDetails.description && (
                      <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                        <span className="text-[8px] font-black uppercase text-neutral-400 block tracking-widest mb-1">Position / Notes</span>
                        <p className="text-xs text-neutral-600 leading-snug">
                          {selectedNode.itemDetails.description}
                        </p>
                      </div>
                    )}

                    {/* Enable relocation of selected Inventory items map */}
                    {selectedNode.type === 'item' && selectedInventory && (
                      <button
                        onClick={() => {
                          setAssigningItem(selectedNode.itemDetails);
                          // Default target set
                          setSelectedTargetRackId(racks[0]?.id || '');
                          setIsAssigningModalOpen(true);
                        }}
                        className="w-full py-3 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-md flex items-center justify-center gap-1.5"
                      >
                        <Move size={14} />
                        Relocate Asset
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-400 h-64">
                <Box size={36} className="text-neutral-300 stroke-[1.5] mb-2 scale-110" />
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Select Node on Canvas
                </p>
                <p className="text-[10px] text-neutral-400 mt-1 max-w-[140px] leading-relaxed">
                  Pinpoint a storage node cluster or individual layout item.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-neutral-100 mt-6 flex flex-col gap-2 bg-neutral-50 p-4 rounded-2xl text-[10px] text-neutral-500 leading-normal">
            <span className="font-bold uppercase tracking-widest text-[#0066cc] flex items-center gap-1 text-[9px]">
              <Sparkles size={11} />
              Unified Map Schema
            </span>
            Our D3 canvas integrates with the **Rack Module** dynamically. Ensure new hardware allocations maintain verified serial codes for automatic bridging.
          </div>
        </div>
      </div>

      {/* RELOCATION / STORAGE ASSIGNMENT MODAL OVERLAY */}
      <AnimatePresence>
        {isAssigningModalOpen && assigningItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssigningModalOpen(false)}
              className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Move size={18} />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-tight">
                        Relocate Physical Asset
                      </h3>
                      <p className="text-[10px] uppercase font-black tracking-widest text-[#0066cc]">
                        {assigningItem.name}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAssigningModalOpen(false)} 
                    className="p-1.5 hover:bg-neutral-100 text-neutral-400 hover:text-black rounded-lg transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handlePerformAssignment} className="space-y-4">
                  
                  {/* Select Rack vs Static Shelf Target */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">
                      Destiny Racking Category
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setTargetType('static')}
                        className={`py-2 px-3 rounded-xl border transition ${
                          targetType === 'static' ? 'bg-black text-white border-black' : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                        }`}
                      >
                        Cabinet / Shelving
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetType('rack')}
                        className={`py-2 px-3 rounded-xl border transition ${
                          targetType === 'rack' ? 'bg-black text-white border-black' : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                        }`}
                      >
                        Hardware Rack Hub
                      </button>
                    </div>
                  </div>

                  {targetType === 'static' ? (
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">
                        Select Storage Sector
                      </label>
                      <select
                        value={selectedTargetStaticUnit}
                        onChange={(e) => {
                          setSelectedTargetStaticUnit(e.target.value);
                          // select first matching container
                          const matched = CONTAINERS.find(c => c.unitId === e.target.value);
                          setSelectedTargetContainer(matched ? matched.name : 'Default Shelf');
                        }}
                        className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-12"
                      >
                        {STATIC_UNITS.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">
                        Select Target Hardware Rack
                      </label>
                      {racks.length === 0 ? (
                        <p className="text-xs text-rose-500 font-bold bg-rose-50 p-3 rounded-xl italic">
                          No active racks registered! Go create a rack in your Racks dashboard first.
                        </p>
                      ) : (
                        <select
                          value={selectedTargetRackId}
                          onChange={(e) => {
                            setSelectedTargetRackId(e.target.value);
                            setSelectedTargetContainer('Rack Drawer A');
                          }}
                          className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-12"
                        >
                          {racks.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.totalUnits}U)</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Container Bin specification inputs */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">
                      Compartment Designation
                    </label>
                    {targetType === 'static' ? (
                      <select
                        value={selectedTargetContainer}
                        onChange={(e) => setSelectedTargetContainer(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-12"
                      >
                        {CONTAINERS.filter(c => c.unitId === selectedTargetStaticUnit).map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. U5-U6 Drawer, Tray 2B..."
                        required
                        value={selectedTargetContainer}
                        onChange={(e) => setSelectedTargetContainer(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-12 font-semibold"
                      />
                    )}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-neutral-100 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsAssigningModalOpen(false)}
                      className="flex-1 px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-bold uppercase tracking-wider text-[10px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={targetType === 'rack' && racks.length === 0}
                      className="flex-[2] px-4 py-3 bg-black hover:bg-neutral-800 text-white rounded-xl font-black uppercase tracking-wider text-[10px] disabled:opacity-50"
                    >
                      Save Layout Position
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
