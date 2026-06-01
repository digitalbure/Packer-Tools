import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, addDoc, deleteDoc, updateDoc, writeBatch, where, getDoc, getDocs } from 'firebase/firestore';
import { ChevronLeft, Plus, Trash2, Camera, Tag, Layout, Server, Settings2, Info, Save, X, Briefcase, Link2, ChevronRight, Zap } from 'lucide-react';
import { db } from '../firebase';
import { UserProfile, Rack, RackItem, Project } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { DndContext, useDraggable, useDroppable, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';

interface DraggableRackItemProps {
  item: RackItem;
  onContextMenu: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

function DraggableRackItem({ 
  item, 
  onContextMenu, 
  style: customStyle,
  className,
  children
}: DraggableRackItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });
  
  const style: React.CSSProperties = {
    ...customStyle,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.35 : 1,
    cursor: 'grab',
    zIndex: isDragging ? 9999 : undefined,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onContextMenu={onContextMenu}
      className={`${className} hover:scale-[1.01] transition-transform duration-75`}
    >
      {children}
    </div>
  );
}

interface DroppableRackSlotProps {
  uPosition: number;
  side: 'left' | 'right' | 'full';
  children: React.ReactNode;
  className?: string;
}

function DroppableRackSlot({
  uPosition,
  side,
  children,
  className
}: DroppableRackSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `droppable-${uPosition}-${side}`,
    data: { uPosition, side }
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} transition-all duration-150 ${
        isOver 
          ? 'bg-primary/20 border-primary border-2 border-solid ring-4 ring-primary/10 shadow-lg scale-[1.02] z-40 rounded-xl' 
          : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function RackDetail({ user }: { user: UserProfile | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rack, setRack] = useState<Rack | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: RackItem;
  } | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);
  const [items, setItems] = useState<RackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<RackItem | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    uPosition: 1,
    uHeight: 1,
    assetTag: '',
    serialNumber: '',
    purchaseDate: '',
    notes: '',
    photoUrls: [] as string[],
    width: 'full' as 'full' | 'half',
    orientation: 'left' as 'left' | 'right',
  });
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [projectTab, setProjectTab] = useState<'link' | 'new'>('link');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [linkedProject, setLinkedProject] = useState<Project | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const match = overId.match(/^droppable-(\d+)-(.+)$/);
    if (!match) return;

    const targetUPosition = parseInt(match[1], 10);
    const targetSide = match[2] as 'left' | 'right' | 'full';

    const draggedItem = items.find(it => it.id === activeId);
    if (!draggedItem) return;

    const targetHeight = draggedItem.uHeight || 1;
    const targetWidth = draggedItem.width || 'full';
    const actualSide = targetWidth === 'full' ? 'left' : (targetSide === 'full' ? 'left' : targetSide);

    if (!rack) return;

    // Bound check
    if (targetUPosition + targetHeight - 1 > rack.totalUnits) {
      toast.error("Dropped position exceeds rack boundaries.");
      return;
    }

    // Check for collisions
    const collision = items.find(item => {
      if (item.id === activeId) return false;

      const itemEnd = item.uPosition + item.uHeight - 1;
      const dropEnd = targetUPosition + targetHeight - 1;

      const verticalOverlap = (
        (targetUPosition >= item.uPosition && targetUPosition <= itemEnd) ||
        (dropEnd >= item.uPosition && dropEnd <= itemEnd) ||
        (item.uPosition >= targetUPosition && item.uPosition <= dropEnd)
      );

      if (!verticalOverlap) return false;

      // Check horizontal overlap
      const w1 = targetWidth;
      const w2 = item.width || 'full';
      if (w1 === 'full' || w2 === 'full') return true;

      const o1 = actualSide;
      const o2 = item.orientation || 'left';
      return o1 === o2;
    });

    if (collision) {
      toast.error(`Collision with item "${collision.name}"`);
      return;
    }

    try {
      const itemRef = doc(db, 'racks', id!, 'items', activeId);
      await updateDoc(itemRef, {
        uPosition: targetUPosition,
        orientation: targetWidth === 'half' ? actualSide : 'left',
      });
      toast.success(`Relocated "${draggedItem.name}" to position ${targetUPosition}U`);
    } catch (error) {
      console.error("Error updates drag-and-drop position:", error);
      toast.error("Failed to relocate component.");
    }
  };

  useEffect(() => {
    if (!id) return;

    const unsubscribeRack = onSnapshot(doc(db, 'racks', id), (docSnap) => {
      if (docSnap.exists()) {
        setRack({ id: docSnap.id, ...docSnap.data() } as Rack);
      } else {
        toast.error("Rack not found");
        navigate('/racks');
      }
    });

    const qItems = query(collection(db, 'racks', id, 'items'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RackItem[];
      setItems(fetchedItems);
      setLoading(false);
    });

    return () => {
      unsubscribeRack();
      unsubscribeItems();
    };
  }, [id, navigate]);

  useEffect(() => {
    if (rack?.projectId) {
      const unsubProject = onSnapshot(doc(db, 'projects', rack.projectId), (snap) => {
        if (snap.exists()) {
          setLinkedProject({ id: snap.id, ...snap.data() } as Project);
        } else {
          setLinkedProject(null);
        }
      });
      return () => unsubProject();
    } else {
      setLinkedProject(null);
    }
  }, [rack?.projectId]);

  useEffect(() => {
    if (!user || !showProjectModal) return;
    const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUserProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    });
    return () => unsubscribe();
  }, [user, showProjectModal]);

  const handleUnlinkProject = async () => {
    if (!id || !rack?.projectId || !window.confirm("Unlink this project?")) return;
    try {
      const batch = writeBatch(db);
      
      batch.update(doc(db, 'racks', id), { 
        projectId: null,
        updatedAt: new Date().toISOString()
      });

      const projectRef = doc(db, 'projects', rack.projectId);
      const projectSnap = await getDoc(projectRef);
      if (projectSnap.exists()) {
        const projectData = projectSnap.data() as Project;
        const newRackIds = (projectData.rackIds || []).filter(rid => rid !== id);
        batch.update(projectRef, { rackIds: newRackIds });
      }

      await batch.commit();
      toast.success("Project unlinked");
    } catch (error) {
      console.error("Error unlinking project:", error);
      toast.error("Failed to unlink project");
    }
  };

  const handleLinkProject = async (projectId: string) => {
    if (!id || !projectId) return;
    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'racks', id), { 
        projectId,
        updatedAt: new Date().toISOString()
      });

      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      if (projectSnap.exists()) {
        const projectData = projectSnap.data() as Project;
        const currentRackIds = projectData.rackIds || [];
        if (!currentRackIds.includes(id)) {
          batch.update(projectRef, { rackIds: [...currentRackIds, id] });
        }
      }

      await batch.commit();
      setShowProjectModal(false);
      toast.success("Project linked successfully");
    } catch (error) {
      console.error("Error linking project:", error);
      toast.error("Failed to link project");
    }
  };

  const handleCreateAndLinkProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user || !newProjectName.trim()) return;

    try {
      const projectRef = await addDoc(collection(db, 'projects'), {
        ownerId: user.uid,
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
        status: 'planning',
        priority: 'medium',
        category: 'technical',
        rackIds: [id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'racks', id), {
        projectId: projectRef.id,
        updatedAt: new Date().toISOString()
      });

      setShowProjectModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      toast.success("Project created and linked!");
    } catch (error) {
      console.error("Error creating and linking project:", error);
      toast.error("Failed to create project");
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newItem.name.trim()) return;

    if (newItem.uPosition + newItem.uHeight - 1 > (rack?.totalUnits || 0)) {
      toast.error("Item exceeds rack height");
      return;
    }

    // Check for collisions
    const collision = items.find(item => {
      const itemEnd = item.uPosition + item.uHeight - 1;
      const newItemEnd = newItem.uPosition + newItem.uHeight - 1;
      
      const verticalOverlap = (
        (newItem.uPosition >= item.uPosition && newItem.uPosition <= itemEnd) ||
        (newItemEnd >= item.uPosition && newItemEnd <= itemEnd) ||
        (item.uPosition >= newItem.uPosition && item.uPosition <= newItemEnd)
      );

      if (!verticalOverlap) return false;

      // Horizontal overlap occurs if either is full width, or both are half width and same orientation/side
      const w1 = newItem.width || 'full';
      const w2 = item.width || 'full';
      if (w1 === 'full' || w2 === 'full') return true;
      const o1 = newItem.orientation || 'left';
      const o2 = item.orientation || 'left';
      return o1 === o2;
    });

    if (collision) {
      toast.error(`Collision detected with "${collision.name}"`);
      return;
    }

    try {
      await addDoc(collection(db, 'racks', id, 'items'), {
        ...newItem,
        rackId: id,
        status: 'installed',
        createdAt: new Date().toISOString(),
      });
      setNewItem({ name: '', uPosition: 1, uHeight: 1, assetTag: '', serialNumber: '', purchaseDate: '', notes: '', photoUrls: [], width: 'full', orientation: 'left' });
      setIsAddingItem(false);
      toast.success("Item added to rack");
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Failed to add item");
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editingItem) return;

    if (editingItem.uPosition + editingItem.uHeight - 1 > (rack?.totalUnits || 0)) {
      toast.error("Item exceeds rack height");
      return;
    }

    // Check for collisions with other items
    const collisionOnUpdate = items.find(item => {
      if (item.id === editingItem.id) return false;

      const itemEnd = item.uPosition + item.uHeight - 1;
      const editEnd = editingItem.uPosition + editingItem.uHeight - 1;

      const verticalOverlap = (
        (editingItem.uPosition >= item.uPosition && editingItem.uPosition <= itemEnd) ||
        (editEnd >= item.uPosition && editEnd <= itemEnd) ||
        (item.uPosition >= editingItem.uPosition && item.uPosition <= editEnd)
      );

      if (!verticalOverlap) return false;

      // Check horizontal overlap
      const w1 = editingItem.width || 'full';
      const w2 = item.width || 'full';
      if (w1 === 'full' || w2 === 'full') return true;
      const o1 = editingItem.orientation || 'left';
      const o2 = item.orientation || 'left';
      return o1 === o2;
    });

    if (collisionOnUpdate) {
      toast.error(`Collision detected with "${collisionOnUpdate.name}"`);
      return;
    }
    
    const updateData: Partial<RackItem> = {};
    const originalItem = items.find(it => it.id === editingItem.id);
    
    if (!originalItem) return;

    if (editingItem.name.trim()) updateData.name = editingItem.name.trim();
    
    updateData.uPosition = editingItem.uPosition;
    updateData.uHeight = editingItem.uHeight;
    updateData.width = editingItem.width || 'full';
    updateData.orientation = editingItem.orientation || 'left';
    
    if (editingItem.assetTag.trim()) updateData.assetTag = editingItem.assetTag.trim();
    else updateData.assetTag = originalItem.assetTag;

    if (editingItem.serialNumber?.trim()) updateData.serialNumber = editingItem.serialNumber.trim();
    else if (originalItem.serialNumber) updateData.serialNumber = originalItem.serialNumber;

    if (editingItem.purchaseDate?.trim()) updateData.purchaseDate = editingItem.purchaseDate.trim();
    else if (originalItem.purchaseDate) updateData.purchaseDate = originalItem.purchaseDate;

    if (editingItem.notes?.trim()) updateData.notes = editingItem.notes.trim();
    else if (originalItem.notes) updateData.notes = originalItem.notes;

    updateData.photoUrls = editingItem.photoUrls;

    try {
      await updateDoc(doc(db, 'racks', id, 'items', editingItem.id), updateData);
      setEditingItem(null);
      setIsEditingItem(false);
      toast.success("Item updated");
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Failed to update item");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'racks', id, 'items', itemId));
      toast.success("Item removed");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to remove item");
    }
  };

  const handleQuickDetach = async (itemAtPos: RackItem) => {
    if (!id || !user) return;
    const toastId = toast.loading(`Performing Quick Detach on "${itemAtPos.name}"...`);
    try {
      // 1. Find matching item in inventory system (gearLibrary)
      let matchedInInventory = false;
      const gearRef = collection(db, 'users', user.uid, 'gearLibrary');
      
      // Query by assetTag first if it's non-empty
      if (itemAtPos.assetTag && itemAtPos.assetTag.trim()) {
        const qAsset = query(gearRef, where('assetTag', '==', itemAtPos.assetTag.trim()));
        const snapAsset = await getDocs(qAsset);
        if (!snapAsset.empty) {
          const docToUpdate = snapAsset.docs[0];
          await updateDoc(docToUpdate.ref, {
            status: 'available',
            updatedAt: new Date().toISOString()
          });
          matchedInInventory = true;
        }
      }
      
      // Fallback: Query by Name if assetTag query didn't match or was blank
      if (!matchedInInventory && itemAtPos.name) {
        const qName = query(gearRef, where('name', '==', itemAtPos.name.trim()));
        const snapName = await getDocs(qName);
        if (!snapName.empty) {
          // If multiple, update the first one
          const docToUpdate = snapName.docs[0];
          await updateDoc(docToUpdate.ref, {
            status: 'available',
            updatedAt: new Date().toISOString()
          });
          matchedInInventory = true;
        }
      }

      // 2. Remove client rack item
      await deleteDoc(doc(db, 'racks', id, 'items', itemAtPos.id));
      
      if (matchedInInventory) {
        toast.success(`Quick Detach successful! "${itemAtPos.name}" is now "Available" in inventory and unassigned from this rack.`, { id: toastId });
      } else {
        toast.success(`Removed "${itemAtPos.name}" from rack assignment. (Note: Matching asset wasn't found in inventory to flag design).`, { id: toastId });
      }
    } catch (error) {
      console.error("Error during Quick Detach:", error);
      toast.error("Quick Detach operation failed", { id: toastId });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: RackItem) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!rack) return null;

  const getItemAt = (u: number, side: 'left' | 'right') => {
    return items.find(item => {
      const matchesHeight = u >= item.uPosition && u < item.uPosition + item.uHeight;
      if (!matchesHeight) return false;
      const w = item.width || 'full';
      if (w === 'full') return true;
      return item.orientation === side;
    });
  };

  // Render the rack units
  const renderRack = () => {
    const units = [];
    for (let i = rack.totalUnits; i >= 1; i--) {
      const leftItem = getItemAt(i, 'left');
      const rightItem = getItemAt(i, 'right');

      const isLeftTop = leftItem && (i === leftItem.uPosition + leftItem.uHeight - 1);
      const isRightTop = rightItem && (i === rightItem.uPosition + rightItem.uHeight - 1);

      units.push(
        <div 
          key={i} 
          className="relative border-b border-neutral-200/60 h-12 flex items-center overflow-visible group"
        >
          {/* Unit Number */}
          <div className="w-12 h-full flex items-center justify-center bg-neutral-100 border-r border-neutral-200 text-[10px] font-black text-neutral-400 select-none">
            {i}U
          </div>

          {/* Slots Container */}
          <div className="flex-1 h-full relative flex overflow-visible">
            {/* LEFT SLOT */}
            {leftItem ? (
              isLeftTop && (
                <DraggableRackItem
                  item={leftItem}
                  onContextMenu={(e) => handleContextMenu(e, leftItem)}
                  style={{ height: `${leftItem.uHeight * 3}rem` }}
                  className={`absolute top-0 left-0 p-1 z-10 ${leftItem.width === 'half' ? 'w-1/2 pr-1' : 'w-full'}`}
                >
                  <div 
                    title="Relocate by dragging / Right-click for options"
                    className="h-full bg-neutral-900 rounded-lg border-2 border-neutral-700 shadow-inner flex items-center px-4 justify-between group/item cursor-grab transition duration-250 hover:border-primary"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-neutral-800 rounded flex items-center justify-center text-neutral-500 shrink-0 select-none">
                        <Server size={16} />
                      </div>
                      <div className="min-w-0 select-none text-left">
                        <h4 className="text-white font-bold text-sm truncate flex items-center gap-1.5">
                          {leftItem.name}
                          {leftItem.width === 'half' && (
                            <span className="text-[8px] bg-neutral-800 border border-neutral-700 px-1 py-0.5 rounded text-neutral-300 font-extrabold uppercase">Half</span>
                          )}
                        </h4>
                        <p className="text-[10px] text-neutral-500 font-mono uppercase truncate">{leftItem.assetTag || 'No Tag'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity ml-2 shrink-0">
                      <button 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickDetach(leftItem);
                        }}
                        title="Quick Detach (Flag 'Available' & Remove)"
                        className="p-1.5 text-amber-500 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition"
                      >
                        <Zap size={14} className="fill-amber-500/20" />
                      </button>
                      <button 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem({ ...leftItem });
                          setIsEditingItem(true);
                        }}
                        title="Edit Specs"
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition"
                      >
                        <Settings2 size={14} />
                      </button>
                      <button 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(leftItem.id);
                        }}
                        title="Remove from Rack"
                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-neutral-800 rounded-lg transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </DraggableRackItem>
              )
            ) : (
              <DroppableRackSlot
                uPosition={i}
                side="left"
                className="absolute left-0 w-1/2 h-full p-1 border-r border-dashed border-neutral-200/40"
              >
                <button 
                  onClick={() => {
                    setNewItem(prev => ({ ...prev, uPosition: i, width: 'half', orientation: 'left' }));
                    setIsAddingItem(true);
                  }}
                  className="w-full h-full border border-dashed border-neutral-200 hover:border-primary/50 hover:bg-white rounded-lg text-[9px] text-neutral-400 font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                >
                  <Plus size={10} />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">Mount Left (Half)</span>
                </button>
              </DroppableRackSlot>
            )}

            {/* RIGHT SLOT */}
            {leftItem && leftItem.width !== 'half' ? null : (
              rightItem ? (
                isRightTop && (
                  <DraggableRackItem
                    item={rightItem}
                    onContextMenu={(e) => handleContextMenu(e, rightItem)}
                    style={{ height: `${rightItem.uHeight * 3}rem` }}
                    className="absolute top-0 right-0 w-1/2 p-1 pl-1 z-10"
                  >
                    <div 
                      title="Relocate by dragging / Right-click for options"
                      className="h-full bg-neutral-900 rounded-lg border-2 border-neutral-700 shadow-inner flex items-center px-4 justify-between group/item cursor-grab transition duration-250 hover:border-primary"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-neutral-800 rounded flex items-center justify-center text-neutral-500 shrink-0 select-none">
                          <Server size={16} />
                        </div>
                        <div className="min-w-0 select-none text-left">
                          <h4 className="text-white font-bold text-sm truncate flex items-center gap-1.5">
                            {rightItem.name}
                            <span className="text-[8px] bg-neutral-800 border border-neutral-700 px-1 py-0.5 rounded text-neutral-300 font-extrabold uppercase">Half</span>
                          </h4>
                          <p className="text-[10px] text-neutral-500 font-mono uppercase truncate">{rightItem.assetTag || 'No Tag'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity ml-2 shrink-0">
                        <button 
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickDetach(rightItem);
                          }}
                          title="Quick Detach (Flag 'Available' & Remove)"
                          className="p-1.5 text-amber-500 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition"
                        >
                          <Zap size={14} className="fill-amber-500/20" />
                        </button>
                        <button 
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem({ ...rightItem });
                            setIsEditingItem(true);
                          }}
                          title="Edit Specs"
                          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition"
                        >
                          <Settings2 size={14} />
                        </button>
                        <button 
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(rightItem.id);
                          }}
                          title="Remove from Rack"
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-neutral-800 rounded-lg transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </DraggableRackItem>
                )
              ) : (
                <DroppableRackSlot
                  uPosition={i}
                  side="right"
                  className="absolute right-0 w-1/2 h-full p-1"
                >
                  <button 
                    onClick={() => {
                      setNewItem(prev => ({ ...prev, uPosition: i, width: 'half', orientation: 'right' }));
                      setIsAddingItem(true);
                    }}
                    className="w-full h-full border border-dashed border-neutral-200 hover:border-primary/50 hover:bg-white rounded-lg text-[9px] text-neutral-400 font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                  >
                    <Plus size={10} />
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">Mount Right (Half)</span>
                  </button>
                </DroppableRackSlot>
              )
            )}
          </div>
        </div>
      );
    }
    return units;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/racks" className="p-2 hover:bg-neutral-100 rounded-xl transition">
            <ChevronLeft size={24} />
          </Link>
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight">{rack.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
              <span className="flex items-center gap-1"><Layout size={14} /> {rack.totalUnits}U Total</span>
              <span className="flex items-center gap-1"><Server size={14} /> {items.length} Components</span>
              {linkedProject ? (
                <div className="flex items-center gap-2">
                  <Link 
                    to={`/project/${linkedProject.id}`}
                    className="inline-flex items-center gap-2 bg-primary/5 text-primary px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition"
                  >
                    <Briefcase size={10} />
                    <span>Project: {linkedProject.name}</span>
                  </Link>
                  <button 
                    onClick={handleUnlinkProject}
                    className="text-neutral-300 hover:text-red-500 transition-colors"
                    title="Unlink Project"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowProjectModal(true)}
                  className="inline-flex items-center gap-2 bg-neutral-100 text-neutral-400 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 hover:text-neutral-600 transition"
                >
                  <Link2 size={10} />
                  <span>Link to Project</span>
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingItem(true)}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition"
          >
            <Plus size={20} />
            <span>Add Component</span>
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Rack Visualization */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-[2.5rem] border-8 border-neutral-200 shadow-2xl overflow-hidden">
            {/* Rack Rails */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="bg-neutral-50 min-h-[600px]">
                {renderRack()}
              </div>
            </DndContext>
          </div>
        </div>

        {/* Info & Stats */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-neutral-400">
              <Info size={20} />
              <h3 className="font-bold text-neutral-900">Rack Details</h3>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-neutral-50 rounded-2xl space-y-1">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Total Weight</p>
                <p className="font-bold text-lg">-- kg</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-2xl space-y-1">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Power Consumption</p>
                <p className="font-bold text-lg">-- W</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-2xl space-y-1">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Space Utilization</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${(items.reduce((acc, curr) => acc + curr.uHeight, 0) / rack.totalUnits) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold">{Math.round((items.reduce((acc, curr) => acc + curr.uHeight, 0) / rack.totalUnits) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 p-8 rounded-[2rem] text-white space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Camera size={18} className="text-primary" />
              Visual Identification
            </h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Use the AI scanner to identify gear in your rack and automatically determine its U-height and specifications.
            </p>
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition text-sm">
              Scan Rack Front
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsAddingItem(false)}
                className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-600 transition"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-6">Mount New Gear</h2>
              <form onSubmit={handleAddItem} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Component Name</label>
                  <input
                    type="text"
                    autoFocus
                    required
                    value={newItem.name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Power Amplifier"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Position (U)</label>
                    <input
                      type="number"
                      min="1"
                      max={rack.totalUnits}
                      value={newItem.uPosition}
                      onChange={(e) => setNewItem(prev => ({ ...prev, uPosition: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Height (U)</label>
                    <input
                      type="number"
                      min="1"
                      max={rack.totalUnits}
                      value={newItem.uHeight}
                      onChange={(e) => setNewItem(prev => ({ ...prev, uHeight: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-500 uppercase tracking-wider block">Width Scale</label>
                    <select
                      value={newItem.width || 'full'}
                      onChange={(e) => setNewItem(prev => ({ ...prev, width: e.target.value as 'full' | 'half' }))}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-xs font-semibold"
                    >
                      <option value="full">Standard (19")</option>
                      <option value="half">Half Rack</option>
                    </select>
                  </div>
                  {(newItem.width || 'full') === 'half' ? (
                    <div className="space-y-1">
                      <label className="text-xs font-black text-neutral-500 uppercase tracking-wider block">Horizontal Side</label>
                      <select
                        value={newItem.orientation || 'left'}
                        onChange={(e) => setNewItem(prev => ({ ...prev, orientation: e.target.value as 'left' | 'right' }))}
                        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-xs font-semibold"
                      >
                        <option value="left">Left Slot</option>
                        <option value="right">Right Slot</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center text-[10px] text-neutral-450 font-bold leading-normal pl-1 pt-2">
                      Occupies full width across current U height slots.
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Asset Tag (Optional)</label>
                  <input
                    type="text"
                    value={newItem.assetTag}
                    onChange={(e) => setNewItem(prev => ({ ...prev, assetTag: e.target.value }))}
                    placeholder="e.g. RACK-001"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Serial Number</label>
                    <input
                      type="text"
                      value={newItem.serialNumber}
                      onChange={(e) => setNewItem(prev => ({ ...prev, serialNumber: e.target.value }))}
                      placeholder="S/N..."
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Purchase Date</label>
                    <input
                      type="date"
                      value={newItem.purchaseDate}
                      onChange={(e) => setNewItem(prev => ({ ...prev, purchaseDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Photos</label>
                  <div className="grid grid-cols-4 gap-2">
                    {newItem.photoUrls.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setNewItem(prev => ({ ...prev, photoUrls: prev.photoUrls.filter((_, idx) => idx !== i) }))}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const url = prompt("Enter Image URL");
                        if (url) setNewItem(prev => ({ ...prev, photoUrls: [...prev.photoUrls, url] }));
                      }}
                      className="aspect-square rounded-lg border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-400 hover:text-primary hover:border-primary transition"
                    >
                      <Camera size={16} />
                      <span className="text-[8px] font-bold uppercase mt-1">Add</span>
                    </button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingItem(false)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg"
                  >
                    Mount Gear
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingItem && editingItem && (
          <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsEditingItem(false);
                }}
                className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-600 transition"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-6">Edit Gear Details</h2>
              <form onSubmit={handleUpdateItem} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Component Name</label>
                  <input
                    type="text"
                    required
                    value={editingItem.name}
                    onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    placeholder="Leave empty to preserve original"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  />
                  <p className="text-[10px] text-neutral-400 italic">Preserves original if left empty</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Position (U)</label>
                    <input
                      type="number"
                      min="1"
                      max={rack.totalUnits}
                      value={editingItem.uPosition}
                      onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, uPosition: Number(e.target.value) }) : null)}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Height (U)</label>
                    <input
                      type="number"
                      min="1"
                      max={rack.totalUnits}
                      value={editingItem.uHeight}
                      onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, uHeight: Number(e.target.value) }) : null)}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-500 uppercase tracking-wider block">Width Scale</label>
                    <select
                      value={editingItem.width || 'full'}
                      onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, width: e.target.value as 'full' | 'half' }) : null)}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-xs font-semibold"
                    >
                      <option value="full">Standard (19")</option>
                      <option value="half">Half Rack</option>
                    </select>
                  </div>
                  {(editingItem.width || 'full') === 'half' ? (
                    <div className="space-y-1">
                      <label className="text-xs font-black text-neutral-500 uppercase tracking-wider block">Horizontal Side</label>
                      <select
                        value={editingItem.orientation || 'left'}
                        onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, orientation: e.target.value as 'left' | 'right' }) : null)}
                        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-xs font-semibold"
                      >
                        <option value="left">Left Slot</option>
                        <option value="right">Right Slot</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center text-[10px] text-neutral-450 font-bold leading-normal pl-1 pt-2">
                      Occupies full width.
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Asset Tag</label>
                  <input
                    type="text"
                    value={editingItem.assetTag}
                    onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, assetTag: e.target.value }) : null)}
                    placeholder="e.g. RACK-001"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  />
                  <p className="text-[10px] text-neutral-400 italic">Preserves original if left empty</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Serial Number</label>
                    <input
                      type="text"
                      value={editingItem.serialNumber || ''}
                      onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, serialNumber: e.target.value }) : null)}
                      placeholder="S/N..."
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                    />
                    <p className="text-[10px] text-neutral-400 italic">Preserves original if left empty</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Purchase Date</label>
                    <input
                      type="date"
                      value={editingItem.purchaseDate || ''}
                      onChange={(e) => setEditingItem(prev => prev ? ({ ...prev, purchaseDate: e.target.value }) : null)}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                    />
                    <p className="text-[10px] text-neutral-400 italic">Preserves original if left empty</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Photos</label>
                  <div className="grid grid-cols-4 gap-2">
                    {editingItem.photoUrls.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setEditingItem(prev => prev ? ({ ...prev, photoUrls: prev.photoUrls.filter((_, idx) => idx !== i) }) : null)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const url = prompt("Enter Image URL");
                        if (url) setEditingItem(prev => prev ? ({ ...prev, photoUrls: [...prev.photoUrls, url] }) : null);
                      }}
                      className="aspect-square rounded-lg border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-400 hover:text-primary hover:border-primary transition"
                    >
                      <Camera size={16} />
                      <span className="text-[8px] font-bold uppercase mt-1">Add</span>
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setIsEditingItem(false);
                    }}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProjectModal && (
          <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowProjectModal(false)}
                className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-600 transition"
              >
                <X size={20} />
              </button>
              
              <div className="space-y-1 mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-primary">Link Project</h2>
                <p className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Connect this rack to a production</p>
              </div>

              <div className="flex bg-neutral-50 p-1 rounded-2xl mb-8">
                <button
                  onClick={() => setProjectTab('link')}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition ${projectTab === 'link' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                >
                  Existing
                </button>
                <button
                  onClick={() => setProjectTab('new')}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition ${projectTab === 'new' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                >
                  New Project
                </button>
              </div>

              {projectTab === 'link' ? (
                <div className="space-y-4">
                  {userProjects.length === 0 ? (
                    <div className="text-center py-8 space-y-4">
                      <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                        <Briefcase size={24} />
                      </div>
                      <p className="text-xs text-neutral-500 font-medium italic">No projects found. Create one first!</p>
                      <button 
                        onClick={() => setProjectTab('new')}
                        className="text-primary font-black uppercase tracking-widest text-[10px] hover:underline"
                      >
                        Create New Project
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto no-scrollbar space-y-2">
                       {userProjects.map(proj => (
                         <button
                           key={proj.id}
                           onClick={() => handleLinkProject(proj.id)}
                           className="w-full flex items-center justify-between p-4 bg-neutral-50 hover:bg-primary/5 rounded-2xl group transition-all"
                         >
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-neutral-400 group-hover:text-primary transition-colors shadow-sm">
                               <Briefcase size={18} />
                             </div>
                             <div className="text-left">
                               <p className="text-sm font-bold text-neutral-900 group-hover:text-primary transition-colors">{proj.name}</p>
                               <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">{proj.category}</p>
                             </div>
                           </div>
                           <ChevronRight size={16} className="text-neutral-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                         </button>
                       ))}
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleCreateAndLinkProject} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Project Name</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="e.g. SUMMER TOUR 2024"
                      className="w-full px-6 py-4 bg-neutral-50 border-none rounded-2xl focus:ring-2 focus:ring-primary outline-none transition font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Description</label>
                    <textarea
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      placeholder="Operation goals..."
                      className="w-full px-6 py-4 bg-neutral-50 border-none rounded-2xl focus:ring-2 focus:ring-primary outline-none transition h-24 resize-none text-sm font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-3"
                  >
                    <Plus size={18} />
                    <span>Create & Link Project</span>
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {contextMenu && (
        <div 
          className="fixed bg-white border border-neutral-200 rounded-2xl shadow-2xl py-2 z-[9999] min-w-[220px] divide-y divide-neutral-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 font-mono text-[9px] font-black uppercase text-neutral-400 tracking-wider">
            {contextMenu.item.name}
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                handleQuickDetach(contextMenu.item);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2.5 text-left text-xs font-bold text-amber-600 hover:bg-neutral-50 flex items-center gap-2.5 transition"
            >
              <Zap size={14} className="text-amber-500 fill-amber-500/20" />
              <span>Quick Detach</span>
            </button>
            <button
              onClick={() => {
                setEditingItem({ ...contextMenu.item });
                setIsEditingItem(true);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2.5 text-left text-xs font-bold text-neutral-700 hover:bg-neutral-50 flex items-center gap-2.5 transition"
            >
              <Settings2 size={14} className="text-neutral-500" />
              <span>Settings / Edit Specs</span>
            </button>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                handleDeleteItem(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition"
            >
              <Trash2 size={14} className="text-red-500" />
              <span>Remove from Rack</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
