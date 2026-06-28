import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, onSnapshot, deleteDoc, updateDoc, addDoc, getDocs, writeBatch, where, orderBy, arrayUnion } from 'firebase/firestore';
import { Plus, Printer, Camera, Share2, Trash2, CheckCircle2, Circle, ChevronLeft, QrCode, Copy, ExternalLink, Package, Tag, Info, Edit2, Library, Search, GripVertical, ChevronDown, ChevronRight, Layers, RotateCcw, History, LayoutList, LayoutGrid, Image as ImageIcon, Zap, Bell, Loader2, ArrowUpNarrowWide, Link2, ShoppingBag, Box, Briefcase, X, Hammer, RefreshCw, ArrowRightLeft, Shield, Download, AlertTriangle, Cpu } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Reorder, AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import * as PAPA from 'papaparse';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, PackingList, PackingItem, PackingListVersion, AdminSettings, Contact, GearItem, Project, RentalAgreement } from '../types';
import { authenticatedFetch } from '../lib/api';
import ReminderModal from '../components/ReminderModal';
import BulkScanModal from '../components/BulkScanModal';
import { identifyItem, suggestItemMetadata } from '../services/geminiService';
import { compressImage } from '../lib/imageUtils';
import QRPrintModal from '../components/QRPrintModal';
import ManualCheckoutModal from '../components/ManualCheckoutModal';
import { checkLimit } from '../lib/limitUtils';
import ShareModal from '../components/ShareModal';
import AddPhotoWidget from '../components/AddPhotoWidget';
import { logActivity } from '../services/activityLog';
import { isSuperAdmin } from '../lib/authHelpers';

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

const InteractiveSignaturePad = ({ onSave }: { onSave: (dataUrl: string) => void }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent | TouchEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (e.cancelable) e.preventDefault();
    
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas && hasDrawn) {
        onSave(canvas.toDataURL());
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onSave('');
      setHasDrawn(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center bg-neutral-900">
        <label className="text-[9px] uppercase tracking-widest font-black text-neutral-400 block font-sans">
          Sign to accept legal responsibilities *
        </label>
        <button
          type="button"
          onClick={clearCanvas}
          className="text-[8px] bg-neutral-800 text-neutral-400 py-1 px-2.5 rounded-lg hover:text-white transition uppercase font-black tracking-wider"
        >
          Reset Pad
        </button>
      </div>
      <div className="border-2 border-dashed border-neutral-850 bg-neutral-950 rounded-2xl relative overflow-hidden h-32 active:border-primary transition-colors">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-pointer touch-none"
          width={450}
          height={128}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-neutral-600 text-[10px] uppercase font-black tracking-widest font-mono">
            Draw Signature Here (Mouse / Touch)
          </div>
        )}
      </div>
    </div>
  );
};

export default function PackingListDetail({ user, adminSettings }: { user: UserProfile | null, adminSettings: AdminSettings | null }) {
  const { id } = useParams<{ id: string }>();
  
  // Permissions Matrix Access Guard Check
  const isOrgAdmin = user?.role === 'owner' || user?.role === 'admin';
  const canViewList = !user || isOrgAdmin || !user.permissions || user.permissions.packingLists?.view !== false;
  const canEditList = !user || isOrgAdmin || !user.permissions || user.permissions.packingLists?.edit !== false;
  const canExportList = !user || isOrgAdmin || !user.permissions || user.permissions.packingLists?.export !== false;
  const canAuditList = !user || isOrgAdmin || !user.permissions || user.permissions.packingLists?.audit !== false;

  const [list, setList] = useState<PackingList | null>(null);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'gallery'>('list');
  const [isPrintView, setIsPrintView] = useState(false);
  const [printWithPhotos, setPrintWithPhotos] = useState(true);
  const [printCompact, setPrintCompact] = useState(false);
  const [printGrouping, setPrintGrouping] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [showMarketplaceModal, setShowMarketplaceModal] = useState(false);
  const [showBulkScanModal, setShowBulkScanModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryItems, setLibraryItems] = useState<GearItem[]>([]);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState('All');

  const filteredLibraryItems = useMemo(() => {
    return libraryItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(librarySearchQuery.toLowerCase()) ||
                          item.assetTag.toLowerCase().includes(librarySearchQuery.toLowerCase());
      const matchesCategory = libraryCategoryFilter === 'All' 
        ? true 
        : libraryCategoryFilter === 'Kits' 
          ? item.isKit 
          : item.category === libraryCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [libraryItems, librarySearchQuery, libraryCategoryFilter]);
  const [editingItem, setEditingItem] = useState<PackingItem | null>(null);
  const [editStep, setEditStep] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editRFIDTag, setEditRFIDTag] = useState('');
  const [editPhotoUrls, setEditPhotoUrls] = useState<string[]>([]);
  const [editPriority, setEditPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [editWeight, setEditWeight] = useState<number>(0);
  const [editWeightUnit, setEditWeightUnit] = useState<'g' | 'kg' | 'oz' | 'lb'>('g');
  const [editRelatedItemIds, setEditRelatedItemIds] = useState<string[]>([]);
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [isPullingDetails, setIsPullingDetails] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [isQuickAddPhotoPickerOpen, setIsQuickAddPhotoPickerOpen] = useState(false);
  const [isEditItemPhotoPickerOpen, setIsEditItemPhotoPickerOpen] = useState(false);
  const [pullError, setPullError] = useState('');

  // Lens taxonomy state fields
  const [editLensType, setEditLensType] = useState('');
  const [editLensMount, setEditLensMount] = useState('');
  const [editFocalLength, setEditFocalLength] = useState('');
  const [editMaxAperture, setEditMaxAperture] = useState('');
  const [editFormatCoverage, setEditFormatCoverage] = useState('');
  const [editFocusType, setEditFocusType] = useState('');

  // Pack item ancillaries states
  const [editAddOns, setEditAddOns] = useState<{
    itemId?: string;
    name: string;
    price: number;
    useDefaultPrice?: boolean;
    type?: 'Organizer' | 'Accessory' | 'Consumable' | 'Attachment' | 'Add On' | 'Software' | 'Mod' | 'Other';
    notes?: string;
  }[]>([]);
  const [packAncillaryName, setPackAncillaryName] = useState('');
  const [packAncillaryType, setPackAncillaryType] = useState<'Organizer' | 'Accessory' | 'Consumable' | 'Attachment' | 'Add On' | 'Software' | 'Mod' | 'Other'>('Accessory');
  const [packAncillaryPrice, setPackAncillaryPrice] = useState<string>('0');
  const [packAncillaryNotes, setPackAncillaryNotes] = useState('');

  const [packAncillaryEditIdx, setPackAncillaryEditIdx] = useState<number | null>(null);
  const [packAncillaryEditForm, setPackAncillaryEditForm] = useState<any | null>(null);

  const startTouchPress = (onLongPress: () => void) => {
    let pressTimer: any = null;
    const start = () => {
      pressTimer = setTimeout(() => {
        onLongPress();
      }, 500);
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

  const handleSavePackAncillaryEdit = () => {
    if (packAncillaryEditIdx === null || !packAncillaryEditForm) return;
    const list = [...editAddOns];
    list[packAncillaryEditIdx] = {
      ...list[packAncillaryEditIdx],
      name: packAncillaryEditForm.name.trim(),
      type: packAncillaryEditForm.type,
      price: packAncillaryEditForm.price,
      notes: packAncillaryEditForm.notes.trim() || undefined
    };
    setEditAddOns(list);
    setIsDirty(true);
    setPackAncillaryEditForm(null);
    setPackAncillaryEditIdx(null);
    toast.success("Ancillary updated locally. Click 'Save' to apply changes permanently!");
  };
  
  // Marketplace state
  const [editRecipientId, setEditRecipientId] = useState('');
  const [editTransactionType, setEditTransactionType] = useState<'Personal' | 'Sale' | 'Rental' | 'Gift'>('Personal');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editMarketplaceEnabled, setEditMarketplaceEnabled] = useState(false);
  const [editMarketplaceDetails, setEditMarketplaceDetails] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editGeneratedCaption, setEditGeneratedCaption] = useState('');
  const [editStatus, setEditStatus] = useState<'Draft' | 'Active' | 'Sent' | 'Received' | 'Completed'>('Draft');
  const [editBookingFeePercent, setEditBookingFeePercent] = useState<number>(10);
  const [editSecurityDeposit, setEditSecurityDeposit] = useState<number>(150);
  const [editCustomFields, setEditCustomFields] = useState<{ [key: string]: string }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Rental agreements state hooks
  const [agreements, setAgreements] = useState<RentalAgreement[]>([]);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementType, setAgreementType] = useState<'pickup' | 'dropoff'>('pickup');
  const [agreementSigneeName, setAgreementSigneeName] = useState('');
  const [agreementSigneeEmail, setAgreementSigneeEmail] = useState('');
  const [agreementSigneePhone, setAgreementSigneePhone] = useState('');
  const [agreementNotes, setAgreementNotes] = useState('');
  const [agreementSignature, setAgreementSignature] = useState('');
  const [isSubmittingAgreement, setIsSubmittingAgreement] = useState(false);
  const [isGroupingEnabled, setIsGroupingEnabled] = useState(true);
  const [showBulkGroupModal, setShowBulkGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'packed' | 'returned'>('all');
  const [sortBy, setSortBy] = useState<'order' | 'priority' | 'name'>('order');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [versions, setVersions] = useState<PackingListVersion[]>([]);
  const [showRevertConfirm, setShowRevertConfirm] = useState<PackingListVersion | null>(null);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [showSaveVersionModal, setShowSaveVersionModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateJobType, setTemplateJobType] = useState('');
  const [templateTeachingNotes, setTemplateTeachingNotes] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [isSavingCopyTemplate, setIsSavingCopyTemplate] = useState(false);
  const [viewingGalleryItem, setViewingGalleryItem] = useState<PackingItem | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [quickAddStep, setQuickAddStep] = useState(1);
  const [quickAddGroup, setQuickAddGroup] = useState('');
  const [quickAddPhotos, setQuickAddPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [showDuplicateConfirmation, setShowDuplicateConfirmation] = useState(false);
  const isAddingRef = useRef(false);
  const [bgGearItems, setBgGearItems] = useState<GearItem[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editListName, setEditListName] = useState('');
  const [isReidentifying, setIsReidentifying] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [isQRPrintModalOpen, setIsQRPrintModalOpen] = useState(false);
  useEffect(() => {
    const handleOpenQRPrint = () => {
      setIsQRPrintModalOpen(true);
    };
    window.addEventListener('open-qr-print-modal', handleOpenQRPrint);
    return () => window.removeEventListener('open-qr-print-modal', handleOpenQRPrint);
  }, []);
  const [showCreateKitModal, setShowCreateKitModal] = useState(false);
  const [allUserPackingLists, setAllUserPackingLists] = useState<PackingList[]>([]);
  const [showCopyMoveModal, setShowCopyMoveModal] = useState(false);
  const [copyMoveMode, setCopyMoveMode] = useState<'copy' | 'move'>('copy');
  const [targetListId, setTargetListId] = useState('');
  const [copyMoveSearchQuery, setCopyMoveSearchQuery] = useState('');
  const [isProcessingCopyMove, setIsProcessingCopyMove] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sourceInput, setSourceInput] = useState('');
  const [showAddByUrlModal, setShowAddByUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawledResult, setCrawledResult] = useState<any | null>(null);
  const [crawledCategory, setCrawledCategory] = useState('');
  const [crawledPriority, setCrawledPriority] = useState('Medium');
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [projectTab, setProjectTab] = useState<'link' | 'new'>('link');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [kitName, setKitName] = useState('');
  const [isCreatingKit, setIsCreatingKit] = useState(false);
  const [reminderItem, setReminderItem] = useState<PackingItem | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{
    name?: string;
    category?: string;
    tags?: string[];
  } | null>(null);
  const [linkedProject, setLinkedProject] = useState<Project | null>(null);
  const [showManualCheckout, setShowManualCheckout] = useState(false);
  const [projectLists, setProjectLists] = useState<PackingList[]>([]);
  const [newProjectListName, setNewProjectListName] = useState('');
  const [isCreatingNewListInProject, setIsCreatingNewListInProject] = useState(false);
  const [selectedInfoItem, setSelectedInfoItem] = useState<PackingItem | null>(null);
  const [showCheckboxInfoModal, setShowCheckboxInfoModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('packer_sidebar_collapsed') === 'true';
  });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'manifest';

  useEffect(() => {
    if (editingItem) {
      setAiSuggestions(null);
    }
  }, [editingItem]);

  useEffect(() => {
    if (!id) return;
    window.scrollTo({ top: 0, behavior: 'instant' });

    const listRef = doc(db, 'packingLists', id);
    const unsubscribeList = onSnapshot(listRef, (docSnap) => {
      if (docSnap.exists()) {
        setList({ id: docSnap.id, ...docSnap.data() } as PackingList);
      } else {
        navigate('/dashboard');
      }
    });

    const itemsRef = collection(db, 'packingLists', id, 'items');
    const q = query(itemsRef);
    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingItem[];
      setItems(fetchedItems.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setLoading(false);

      // Self-healing cover image assignment in background
      const firstImg = fetchedItems.find(item => item.photoUrls && item.photoUrls.length > 0)?.photoUrls?.[0] || '';
      if (firstImg && id) {
        getDoc(doc(db, 'packingLists', id)).then((listSnap) => {
          if (listSnap.exists() && !listSnap.data().image) {
            updateDoc(doc(db, 'packingLists', id), { image: firstImg }).catch(err => {
              console.warn("Background list image syncer:", err);
            });
          }
        });
      }
    });

    const versionsRef = collection(db, 'packingLists', id, 'versions');
    const unsubscribeVersions = onSnapshot(versionsRef, (snapshot) => {
      const fetchedVersions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingListVersion[];
      setVersions(fetchedVersions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    const agreementsRef = collection(db, 'packingLists', id, 'RentalAgreements');
    const unsubscribeAgreements = onSnapshot(agreementsRef, (snapshot) => {
      const fetchedAgreements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RentalAgreement[];
      setAgreements(fetchedAgreements.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime()));
    });

    // Fetch contacts
    let unsubscribeContacts = () => {};
    if (user) {
      const contactsRef = collection(db, 'contacts');
      const contactsQuery = query(contactsRef, where('ownerId', '==', user.uid));
      unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
        const fetchedContacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Contact[];
        setContacts(fetchedContacts);
      });
    }

    return () => {
      unsubscribeList();
      unsubscribeItems();
      unsubscribeVersions();
      unsubscribeAgreements();
      unsubscribeContacts();
    };
  }, [id, navigate, user]);

  useEffect(() => {
    if (!user || !showProjectModal) return;
    const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setUserProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    });
    return () => unsubscribe();
  }, [user, showProjectModal]);

  useEffect(() => {
    if (list?.projectId) {
      const unsubProject = onSnapshot(doc(db, 'projects', list.projectId), (snap) => {
        if (snap.exists()) {
          setLinkedProject({ id: snap.id, ...snap.data() } as Project);
        } else {
          setLinkedProject(null);
        }
      });

      const qLists = query(collection(db, 'packingLists'), where('projectId', '==', list.projectId));
      const unsubLists = onSnapshot(qLists, (snapshot) => {
        const fetchedLists = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as PackingList[];
        setProjectLists(fetchedLists);
      }, (error) => {
        console.error("Error fetching project lists:", error);
      });

      return () => {
        unsubProject();
        unsubLists();
      };
    } else {
      setLinkedProject(null);
      setProjectLists([]);
    }
  }, [list?.projectId]);

  useEffect(() => {
    if (user && list && list.id && !list.collaboratorIds?.includes(user.uid)) {
      if (list.collaboratorEmails?.includes(user.email.toLowerCase())) {
        const newIds = [...(list.collaboratorIds || []), user.uid];
        updateDoc(doc(db, 'packingLists', list.id), {
          collaboratorIds: newIds
        }).catch(console.error);
      }
    }
  }, [user, list]);

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query) ||
        item.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'priority') {
      const priorityMap = { 'High': 0, 'Medium': 1, 'Low': 2 };
      result.sort((a, b) => {
        const pA = priorityMap[a.priority || 'Medium'];
        const pB = priorityMap[b.priority || 'Medium'];
        return pA - pB;
      });
    } else {
      result.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return result;
  }, [items, statusFilter, searchQuery, sortBy]);

  const handleExportCSV = () => {
    if (!canExportList) {
      toast.error("Permission denied: You do not have 'Export' permissions to export data.");
      return;
    }
    if (filteredItems.length === 0) {
      toast.error("No items to export.");
      return;
    }

    const dataToExport = filteredItems.map(it => ({
      'Item Name': it.name || '',
      'Asset Tag': it.assetTag || '',
      'Status': it.status || 'pending',
      'Category': it.aiLabel || 'Uncategorized',
      'Priority': it.priority || 'Medium',
      'Weight': it.weight ? `${it.weight} ${it.weightUnit || 'kg'}` : '',
      'Dimensions': it.dimensions ? `${it.dimensions.length}x${it.dimensions.width}x${it.dimensions.height} ${it.dimensions.unit || 'cm'}` : '',
      'Tags': it.tags ? it.tags.join(', ') : '',
      'Notes': it.notes || '',
      'Description': it.description || ''
    }));

    try {
      const csv = PAPA.unparse(dataToExport);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${list?.name?.toLowerCase().replace(/\s+/g, '_')}_manifest.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Packing list exported to CSV successfully!");
    } catch (err) {
      console.error("CSV export error:", err);
      toast.error("Failed to export packing list to CSV.");
    }
  };

  const groupedItems = useMemo<{ [key: string]: PackingItem[] }>(() => {
    if (!isGroupingEnabled) return { "All Items": filteredItems };
    
    const groups: { [key: string]: PackingItem[] } = {};
    filteredItems.forEach(item => {
      const label = item.aiLabel || 'Uncategorized';
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });
    return groups;
  }, [filteredItems, isGroupingEnabled]);

  const uniqueAILabels = useMemo(() => {
    const labels = new Set<string>();
    items.forEach(item => {
      if (item.aiLabel) labels.add(item.aiLabel);
    });
    return Array.from(labels).sort();
  }, [items]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const collapseAll = () => {
    const allGroups = Object.keys(groupedItems);
    setCollapsedGroups(new Set(allGroups));
  };

  const expandAll = () => {
    setCollapsedGroups(new Set());
  };

  const handleBulkGroup = async () => {
    if (!id || selectedItems.size === 0 || !newGroupName.trim()) return;
    
    const batch = writeBatch(db);
    selectedItems.forEach(itemId => {
      batch.update(doc(db, 'packingLists', id, 'items', itemId), { aiLabel: newGroupName.trim() });
    });

    try {
      await batch.commit();
      setSelectedItems(new Set());
      setShowBulkGroupModal(false);
      setNewGroupName('');
    } catch (error) {
      console.error("Error bulk grouping items:", error);
    }
  };

  const saveVersion = async () => {
    if (!id || !list || !versionName.trim()) return;
    setIsSavingVersion(true);
    try {
      const versionData = {
        listId: id,
        name: versionName.trim(),
        description: versionDescription.trim(),
        items: items.map(({ id, ...rest }) => rest), // Store item data without IDs
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'packingLists', id, 'versions'), versionData);
      toast.success("Snapshot saved successfully!");
      setShowSaveVersionModal(false);
      setVersionName('');
      setVersionDescription('');
    } catch (error) {
      console.error("Error saving version:", error);
      toast.error("Failed to save snapshot");
    } finally {
      setIsSavingVersion(false);
    }
  };

  const handleDeleteList = async () => {
    if (!id || !window.confirm("Are you sure you want to delete this entire packing list? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'packingLists', id));
      toast.success("Packing list deleted successfully");
      navigate('/dashboard');
    } catch (error) {
      console.error("Error deleting list:", error);
      toast.error("Failed to delete packing list");
    }
  };

  const handleUpdateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await updateDoc(doc(db, 'packingLists', id), {
        brandName: brandName.trim(),
        brandLogo: brandLogo.trim(),
        updatedAt: new Date().toISOString()
      });
      setShowBrandModal(false);
    } catch (error) {
      console.error("Error updating brand info:", error);
    }
  };

  const revertToVersion = async (version: PackingListVersion) => {
    if (!id || !list) return;
    
    toast.loading("Reverting list...");
    
    try {
      // Create a "Pre-Revert" snapshot automatically so user can undo
      const preRevertData = {
        listId: id,
        name: `Pre-Revert: ${list.name}`,
        description: `Automatic backup created before reverting to "${version.name}"`,
        items: items.map(({ id, ...rest }) => rest),
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'packingLists', id, 'versions'), preRevertData);

      const batch = writeBatch(db);
      
      // 1. Delete all current items
      items.forEach(item => {
        batch.delete(doc(db, 'packingLists', id, 'items', item.id));
      });
      
      // 2. Add items from version
      version.items.forEach(itemData => {
        const newItemRef = doc(collection(db, 'packingLists', id, 'items'));
        batch.set(newItemRef, itemData);
      });
      
      // 3. Update list name/description if they changed
      batch.update(doc(db, 'packingLists', id), {
        name: version.name,
        description: version.description,
        updatedAt: new Date().toISOString()
      });
      
      await batch.commit();
      setShowHistoryModal(false);
      toast.dismiss();
      toast.success("List reverted successfully!");
    } catch (error) {
      console.error("Error reverting to version:", error);
      toast.dismiss();
      toast.error("Failed to revert list");
    }
  };

  const handleReorder = async (newItems: PackingItem[]) => {
    // Reordering is only allowed when grouping is disabled and no filter is applied to avoid confusion
    if (isGroupingEnabled || statusFilter !== 'all') return;
    
    // Optimistically update local state
    setItems(newItems);
    
    if (!id || !user || user.uid !== list?.ownerId) return;

    // Update orders in Firestore
    const batch = writeBatch(db);
    newItems.forEach((item, index) => {
      const itemRef = doc(db, 'packingLists', id, 'items', item.id);
      batch.update(itemRef, { order: index });
    });
    
    try {
      await batch.commit();
    } catch (error) {
      console.error("Error updating item orders:", error);
    }
  };

  const fetchLibrary = async () => {
    if (!user) return;
    // Allow if user is pro, enterprise, or admin
    const isProUser = user.plan === 'pro' || user.plan === 'enterprise' || user.role === 'admin' || isSuperAdmin(user);
    if (!isProUser) return;

    try {
      const q = query(collection(db, 'users', user.uid, 'gearLibrary'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setLibraryItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem)));
    } catch (error) {
      console.error("Error fetching library:", error);
      toast.error("Failed to load gear library.");
    }
  };

  const addFromLibrary = async (item: GearItem) => {
    if (!id || !user) return;
    try {
      const batch = writeBatch(db);
      let orderIndex = items.length;

      // Helper to prepare packing item data from gear item
      const prepareItemData = (gear: GearItem, groupLabel?: string) => {
        const { id: gearId, ...gearData } = gear;
        const sanitizedData = Object.fromEntries(
          Object.entries(gearData).filter(([_, v]) => v !== undefined && typeof v !== 'function')
        );
        return {
          ...sanitizedData,
          gearId: gearId,
          listId: id,
          aiLabel: groupLabel || gear.aiLabel || gear.category || 'Other',
          status: 'pending',
          order: orderIndex++,
          createdAt: new Date().toISOString()
        };
      };

      // Add the main item (or kit bundle itself)
      const kitGroupLabel = item.isKit ? item.name : undefined;
      const mainItemRef = doc(collection(db, 'packingLists', id, 'items'));
      batch.set(mainItemRef, prepareItemData(item, kitGroupLabel));

      // If it's a kit, add all its children
      if (item.isKit && item.childItemIds && item.childItemIds.length > 0) {
        // We need to fetch the child gear items to get their metadata
        // For performance in a batch, we'll do individual fetches or a 'where in' if possible
        // Firestore 'in' is limited to 10-30 IDs. Let's do it simply for now.
        const childrenQuery = query(
          collection(db, 'users', user.uid, 'gearLibrary'),
          where('__name__', 'in', item.childItemIds.slice(0, 30)) // Safety limit
        );
        const childrenSnap = await getDocs(childrenQuery);
        childrenSnap.docs.forEach(docSnap => {
          const childGear = { id: docSnap.id, ...docSnap.data() } as GearItem;
          const childItemRef = doc(collection(db, 'packingLists', id, 'items'));
          batch.set(childItemRef, prepareItemData(childGear, kitGroupLabel));
        });
      }

      await batch.commit();
      toast.success(`Deployed ${item.isKit ? 'Kit' : 'Item'}: ${item.name}`);
    } catch (error) {
      console.error("Error adding from library:", error);
      toast.error("Failed to add from library");
    }
  };

  const isListValid = useMemo(() => {
    if (items.length === 0) return true;
    return items.every(item => item.photoUrls && item.photoUrls.length > 0);
  }, [items]);

  const itemsMissingPhotos = useMemo(() => {
    return items.filter(item => !item.photoUrls || item.photoUrls.length === 0);
  }, [items]);

  const isOwner = user?.uid === list?.ownerId;
  const isCollaborator = user && list?.collaboratorIds?.includes(user.uid);
  const canEdit = isOwner || isCollaborator || user?.role === 'admin';
  const isPro = user?.plan === 'pro' || user?.plan === 'enterprise' || isSuperAdmin(user);
  const packedCount = items.filter(i => i.status === 'packed').length;
  const progress = items.length > 0 ? (packedCount / items.length) * 100 : 0;

  const totalWeight = useMemo(() => {
    return items.reduce((acc, item) => {
      if (!item.weight) return acc;
      // Convert all to kg for calculation
      let weightInKg = item.weight;
      if (item.weightUnit === 'g') weightInKg = item.weight / 1000;
      if (item.weightUnit === 'lb') weightInKg = item.weight * 0.453592;
      if (item.weightUnit === 'oz') weightInKg = item.weight * 0.0283495;
      return acc + weightInKg;
    }, 0);
  }, [items]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingPhoto(true);
      const { compressImage } = await import('../lib/imageUtils');
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const base64 = await compressImage(file);
          uploadedUrls.push(base64);
        } catch (singleErr) {
          console.error("Failed to compress single file:", file.name, singleErr);
        }
      }
      
      if (uploadedUrls.length > 0) {
        setQuickAddPhotos(prev => [...prev, ...uploadedUrls]);
        toast.success(`Attached ${uploadedUrls.length} photo${uploadedUrls.length > 1 ? 's' : ''}`);
      } else {
        toast.error("Failed to process photo uploads");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to process photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleUpdateListName = async () => {
    if (!id || !editListName.trim()) {
      setIsEditingName(false);
      return;
    }
    try {
      await updateDoc(doc(db, 'packingLists', id), { name: editListName.trim() });
      setList(prev => prev ? { ...prev, name: editListName.trim() } : null);
      setIsEditingName(false);
      toast.success("List renamed");
    } catch (error) {
      toast.error("Failed to rename list");
    }
  };

  const handleCreateListInProject = async () => {
    if (!newProjectListName.trim() || !list?.projectId) {
      toast.error("List name cannot be empty");
      return;
    }
    setIsCreatingNewListInProject(true);
    try {
      // 1. Create packing list document
      const newListRef = await addDoc(collection(db, 'packingLists'), {
        name: newProjectListName.trim(),
        description: `Created under project "${linkedProject?.name || 'Project'}"`,
        ownerId: user?.uid,
        projectId: list.projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stage: 'proposed',
        version: 1,
        collaboratorIds: [],
        collaboratorEmails: []
      });

      // 2. Add to project's listIds
      await updateDoc(doc(db, 'projects', list.projectId), {
        listIds: arrayUnion(newListRef.id),
        updatedAt: new Date().toISOString()
      });

      toast.success(`Packing list "${newProjectListName.trim()}" created successfully!`);
      setNewProjectListName('');
      navigate(`/list/${newListRef.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create packing list");
    } finally {
      setIsCreatingNewListInProject(false);
    }
  };

  const updateStage = async (stage: PackingList['stage']) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'packingLists', id), {
        stage,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Inventory stage updated to ${stage}`);
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  const iterateVersion = async () => {
    if (!id || !list) return;
    try {
      const nextVersion = (list.version || 1) + 1;
      await updateDoc(doc(db, 'packingLists', id), {
        version: nextVersion,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Inventory iteration v${nextVersion} created`);
    } catch (error) {
      console.error('Error iterating version:', error);
    }
  };

  // Load background gear items for autocomplete/photos in the background as soon as user is loaded
  useEffect(() => {
    if (user) {
      const loadBgGear = async () => {
        try {
          const q = query(collection(db, 'users', user.uid, 'gearLibrary'));
          const snap = await getDocs(q);
          const itemsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem));
          setBgGearItems(itemsList);
        } catch (err) {
          console.error("Error loading background gear items:", err);
        }
      };
      loadBgGear();
    }
  }, [user]);

  // Background photo/metadata matching logic
  useEffect(() => {
    if (!quickAddName.trim()) return;
    const trimmed = quickAddName.trim().toLowerCase();
    
    // Find matching gear item that has photoUrls
    const matched = bgGearItems.find(item => 
      item.name.toLowerCase() === trimmed && 
      item.photoUrls && 
      item.photoUrls.length > 0 && 
      item.photoUrls[0]
    ) || bgGearItems.find(item => 
      item.name.toLowerCase().includes(trimmed) && 
      item.photoUrls && 
      item.photoUrls.length > 0 && 
      item.photoUrls[0]
    );

    if (matched && matched.photoUrls) {
      setQuickAddPhotos(prev => {
        if (prev.length === 0) {
          return matched.photoUrls || [];
        }
        return prev;
      });
      if (matched.category && !quickAddGroup) {
        setQuickAddGroup(matched.category);
      }
    }
  }, [quickAddName, bgGearItems]);

  const proceedWithQuickAdd = async () => {
    if (isAddingItem || isAddingRef.current) return;
    try {
      setIsAddingItem(true);
      isAddingRef.current = true;
      await addDoc(collection(db, 'packingLists', id!, 'items'), {
        name: quickAddName.trim(),
        listId: id!,
        aiLabel: quickAddGroup.trim() || 'Other',
        status: 'pending',
        priority: 'Medium',
        photoUrls: quickAddPhotos,
        assetTag: `MANUAL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        order: items.length,
        createdAt: new Date().toISOString()
      });
      setQuickAddName('');
      setQuickAddGroup('');
      setQuickAddPhotos([]);
      setQuickAddStep(1);
      setShowQuickAddModal(false);
      setShowDuplicateConfirmation(false);
      toast.success(`Added ${quickAddName} to list.`);
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Failed to add item");
    } finally {
      setIsAddingItem(false);
      isAddingRef.current = false;
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !quickAddName.trim()) return;
    
    if (!canEditList) {
      toast.error("Permission denied: You do not have 'Editor' permissions inside this matrix.");
      return;
    }

    if (isAddingItem) return;

    // Check for existing duplicate item in the packing list
    const isDuplicate = items.some(
      item => item.name.trim().toLowerCase() === quickAddName.trim().toLowerCase()
    );

    if (isDuplicate && !showDuplicateConfirmation) {
      setShowDuplicateConfirmation(true);
      return;
    }

    await proceedWithQuickAdd();
  };

  const handleRescanWithAI = async (photos?: string[]) => {
    const photosToUse = photos || editPhotoUrls;
    if (photosToUse.length === 0) {
      toast.error("No photos available to scan.");
      return;
    }

    setIsReidentifying(true);
    setAiSuggestions(null);
    try {
      const base64 = photosToUse[0].split(',')[1];
      const result = await identifyItem(base64);
      
      setAiSuggestions({
        name: result.name,
        category: result.category,
        tags: result.tags
      });
      
      toast.success("AI identification complete! Review suggestions below.");
    } catch (error) {
      console.error("AI Rescan failed:", error);
      toast.error("Failed to re-identify item with AI.");
    } finally {
      setIsReidentifying(false);
    }
  };

  const handleMagicSuggest = async () => {
    if (!editName.trim()) {
      toast.error("Please enter an item name first.");
      return;
    }

    setIsReidentifying(true);
    try {
      const result = await suggestItemMetadata(editName, editLabel);
      setEditLabel(result.suggestedCategory);
      const currentTags = editTags.split(',').map(t => t.trim()).filter(t => t !== '');
      const combinedTags = [...new Set([...currentTags, ...result.suggestedTags])];
      setEditTags(combinedTags.join(', '));
      
      toast.success("AI suggestions applied!");
    } catch (error) {
      console.error("AI Magic Suggest failed:", error);
      toast.error("Failed to get AI suggestions.");
    } finally {
      setIsReidentifying(false);
    }
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !list || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const emails = list.collaboratorEmails || [];
      if (emails.includes(inviteEmail.trim().toLowerCase())) {
        toast.error("User is already a collaborator");
        return;
      }
      
      const newEmails = [...emails, inviteEmail.trim().toLowerCase()];
      await updateDoc(doc(db, 'packingLists', id), {
        collaboratorEmails: newEmails,
        updatedAt: new Date().toISOString()
      });
      
      setInviteEmail('');
      toast.success(`Invited ${inviteEmail} to collaborate!`);
    } catch (error) {
      console.error("Error inviting collaborator:", error);
      toast.error("Failed to invite collaborator");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    if (!id || !list || !window.confirm(`Remove ${email} from collaborators?`)) return;
    try {
      const newEmails = (list.collaboratorEmails || []).filter(e => e !== email);
      // Clean up IDs too if possible, but email is primary removal key
      await updateDoc(doc(db, 'packingLists', id), {
        collaboratorEmails: newEmails,
        updatedAt: new Date().toISOString()
      });
      toast.success("Collaborator removed");
    } catch (error) {
      toast.error("Failed to remove collaborator");
    }
  };

  const handleUnlinkProject = async () => {
    if (!id || !list?.projectId || !window.confirm("Unlink this project?")) return;
    try {
      const batch = writeBatch(db);
      
      // Update list
      batch.update(doc(db, 'packingLists', id), { 
        projectId: null,
        updatedAt: new Date().toISOString()
      });

      // Update project
      const projectRef = doc(db, 'projects', list.projectId);
      const projectSnap = await getDoc(projectRef);
      if (projectSnap.exists()) {
        const projectData = projectSnap.data() as Project;
        const newListIds = (projectData.listIds || []).filter(lid => lid !== id);
        batch.update(projectRef, { listIds: newListIds });
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

      // Update list
      batch.update(doc(db, 'packingLists', id), { 
        projectId,
        updatedAt: new Date().toISOString()
      });

      // Update project
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      if (projectSnap.exists()) {
        const projectData = projectSnap.data() as Project;
        const currentListIds = projectData.listIds || [];
        if (!currentListIds.includes(id)) {
          batch.update(projectRef, { listIds: [...currentListIds, id] });
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

  const handleAIOnboard = async () => {
    if (!sourceInput || !id) return;
    setIsAnalyzing(true);
    try {
      const res = await authenticatedFetch('/api/analyze-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: sourceInput.startsWith('http') ? '' : sourceInput,
          url: sourceInput.startsWith('http') ? sourceInput : ''
        })
      });
      const data = await res.json();
      
      const itemData = {
        name: data.name || (sourceInput.startsWith('http') ? 'Analyzed Item' : sourceInput),
        listId: id,
        aiLabel: data.category || 'Sandbox',
        status: 'pending',
        priority: 'Medium',
        photoUrls: [],
        assetTag: `AI-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        order: items.length,
        createdAt: new Date().toISOString(),
        notes: data.model ? `Brand: ${data.brand || ''}, Model: ${data.model}` : '',
        description: data.specs ? JSON.stringify(data.specs) : '',
        sourceUrl: sourceInput.startsWith('http') ? sourceInput : ''
      };

      await addDoc(collection(db, 'packingLists', id, 'items'), itemData);
      
      setSourceInput('');
      toast.success("Intelligence engine added item to list!");
    } catch (e) {
      toast.error("AI Analysis failed. Please use Quick Add.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCrawlUrl = async () => {
    if (!urlInput.trim()) {
      toast.error("Please enter a webpage URL to analyze.");
      return;
    }
    if (!urlInput.startsWith('http://') && !urlInput.startsWith('https://')) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setIsCrawling(true);
    setCrawledResult(null);
    try {
      const res = await authenticatedFetch('/api/analyze-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: '',
          url: urlInput.trim()
        })
      });
      if (!res.ok) {
        throw new Error("Server responded with error status");
      }
      const data = await res.json();
      setCrawledResult(data);
      setCrawledCategory(data.category || 'Sandbox');
      toast.success("Details extracted successfully! Please review and save.");
    } catch (e) {
      console.error(e);
      toast.error("AI scraping or analysis failed for this URL. Try another or add manually.");
    } finally {
      setIsCrawling(false);
    }
  };

  const handleSaveCrawledItem = async () => {
    if (!id || !crawledResult || !crawledResult.name?.trim()) {
      toast.error("Nothing to save. Please extract first.");
      return;
    }

    try {
      const descriptionString = crawledResult.specs ? JSON.stringify(crawledResult.specs) : '';
      
      await addDoc(collection(db, 'packingLists', id, 'items'), {
        name: crawledResult.name.trim(),
        brand: crawledResult.brand || '',
        model: crawledResult.model || '',
        listId: id,
        aiLabel: crawledCategory.trim() || 'Sandbox',
        status: 'pending',
        priority: crawledPriority,
        photoUrls: [],
        assetTag: `URL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        order: items.length,
        createdAt: new Date().toISOString(),
        notes: crawledResult.model ? `Brand: ${crawledResult.brand || ''}, Model: ${crawledResult.model}` : '',
        description: descriptionString,
        sourceUrl: urlInput.trim(),
        price: crawledResult.price || 0
      });

      setUrlInput('');
      setCrawledResult(null);
      setShowAddByUrlModal(false);
      toast.success(`Scraped item "${crawledResult.name}" added successfully!`);
    } catch (error) {
      console.error("Error saving scraped item:", error);
      toast.error("Failed to save crawled item");
    }
  };

  const toggleBuildMode = async () => {
    if (!linkedProject || !linkedProject.id) return;
    try {
      await updateDoc(doc(db, 'projects', linkedProject.id), {
        isBuildMode: !linkedProject.isBuildMode,
        updatedAt: new Date().toISOString()
      });
      toast.success(linkedProject.isBuildMode ? "Build Mode Disabled" : "Build Mode Activated");
    } catch (error) {
      toast.error("Failed to toggle Build Mode");
    }
  };

  const handleCreateAndLinkProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user || !newProjectName.trim()) return;

    try {
      // Create project
      const projectRef = await addDoc(collection(db, 'projects'), {
        ownerId: user.uid,
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
        status: 'planning',
        priority: 'medium',
        category: 'technical',
        listIds: [id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Update list
      await updateDoc(doc(db, 'packingLists', id), {
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

  const startEditingItem = (item: PackingItem) => {
    setEditingItem(item);
    setEditStep(1);
    setEditName(item.name || '');
    setEditLabel(item.aiLabel || '');
    setEditDescription(item.description || '');
    setEditNotes(item.notes || '');
    setEditPriority(item.priority || 'Medium');
    setEditWeight(item.weight || 0);
    setEditWeightUnit(item.weightUnit || 'g');
    setEditRelatedItemIds(item.relatedItemIds || []);
    setEditTags(item.tags?.join(', ') || '');
    setEditRFIDTag(item.rfidTag || '');
    setEditPhotoUrls(item.photoUrls || []);
    setEditSourceUrl(item.sourceUrl || '');
    setEditAddOns(item.addOns || []);
    setEditLensType(item.lensType || '');
    setEditLensMount(item.lensMount || '');
    setEditFocalLength(item.focalLength || '');
    setEditMaxAperture(item.maxAperture || '');
    setEditFormatCoverage(item.formatCoverage || '');
    setEditFocusType(item.focusType || '');
    setPullError('');
    setIsDirty(false);
  };

  const handlePullProductDetails = async () => {
    if (!editSourceUrl.trim()) return;
    setIsPullingDetails(true);
    setPullError('');
    try {
      const response = await authenticatedFetch('/api/analyze-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: editSourceUrl, productName: editName }),
      });
      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }
      const data = await response.json();
      if (data) {
        if (data.name) {
          setEditName(data.name);
        }
        if (data.category) {
          setEditLabel(data.category);
        }
        let desc = data.description || '';
        if (data.specs) {
          const specLines = Object.entries(data.specs)
            .filter(([_, value]) => value)
            .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1') || key}: ${value}`)
            .join('\n');
          if (specLines) {
            desc = desc ? `${desc}\n\nTechnical Specs:\n${specLines}` : `Technical Specs:\n${specLines}`;
          }
        }
        if (desc) {
          setEditDescription(desc);
        }
        if (data.price) {
          setEditNotes(prev => prev ? `${prev}\nPrice: $${data.price}` : `Price: $${data.price}`);
        }
        if (data.photoUrl) {
          setEditPhotoUrls(prev => {
            if (prev.includes(data.photoUrl)) return prev;
            return [...prev, data.photoUrl];
          });
        }
        setIsDirty(true);
        toast.success("Successfully pulled specifications & elements!");
      }
    } catch (e: any) {
      console.error(e);
      setPullError("Unable to extract specs. Check URL or try another link.");
      toast.error("Spec import failed");
    } finally {
      setIsPullingDetails(false);
    }
  };

  const handleUpdateItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEditList) {
      toast.error("Permission denied: You do not have 'Editor' permissions inside this matrix.");
      setEditingItem(null);
      return;
    }
    if (!id || !editingItem || !isDirty) {
      setEditingItem(null);
      return;
    }
    setIsSavingItem(true);
    try {
      // Small artificial delay for visual feedback of saving progress
      await new Promise(resolve => setTimeout(resolve, 800));
      await updateDoc(doc(db, 'packingLists', id, 'items', editingItem.id), cleanUndefinedFields({
        name: editName,
        aiLabel: editLabel,
        description: editDescription,
        notes: editNotes,
        priority: editPriority,
        weight: editWeight,
        weightUnit: editWeightUnit,
        tags: editTags.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
        photoUrls: editPhotoUrls,
        relatedItemIds: editRelatedItemIds,
        sourceUrl: editSourceUrl,
        addOns: editAddOns,
        lensType: editLensType,
        lensMount: editLensMount,
        focalLength: editFocalLength,
        maxAperture: editMaxAperture,
        formatCoverage: editFormatCoverage,
        focusType: editFocusType,
        rfidTag: editRFIDTag,
        updatedAt: new Date().toISOString()
      }));

      if (editingItem.gearId) {
        try {
          await updateDoc(doc(db, 'gear', editingItem.gearId), {
            rfidTag: editRFIDTag,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.warn("Could not update corresponding gear item RFID tag:", err);
        }
      }

      setEditingItem(null);
      setIsDirty(false);
      toast.success("Item updated");
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Failed to update item");
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleEditModalClose = async () => {
    if (isDirty) {
      await handleUpdateItem();
    } else {
      setEditingItem(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!id || !window.confirm("Delete this item?")) return;
    try {
      await deleteDoc(doc(db, 'packingLists', id, 'items', itemId));
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const handleBulkDelete = async () => {
    if (!id || selectedItems.size === 0 || !window.confirm(`Delete ${selectedItems.size} selected items?`)) return;
    
    const batch = writeBatch(db);
    selectedItems.forEach(itemId => {
      batch.delete(doc(db, 'packingLists', id, 'items', itemId));
    });

    try {
      await batch.commit();
      setSelectedItems(new Set());
    } catch (error) {
      console.error("Error bulk deleting items:", error);
    }
  };

  const handleCreateKit = async () => {
    if (!user || !kitName.trim() || selectedItems.size === 0) return;
    setIsCreatingKit(true);
    try {
      const selectedPackingItems = items.filter(item => selectedItems.has(item.id));
      const gearIds: string[] = [];

      for (const item of selectedPackingItems) {
        if (item.gearId) {
          gearIds.push(item.gearId);
        } else {
          // Add to Gear Library first
          const gearRef = await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), {
            ownerId: user.uid,
            name: item.name,
            description: item.description || '',
            aiLabel: item.aiLabel || '',
            category: item.aiLabel || 'Other',
            photoUrls: item.photoUrls || [],
            assetTag: item.assetTag || `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            tags: item.tags || [],
            organizationTip: item.organizationTip || '',
            weight: item.weight || 0,
            weightUnit: item.weightUnit || 'g',
            condition: 'good',
            usageCount: 1,
            quantity: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          
          // Update the packing item with the new gearId
          await updateDoc(doc(db, 'packingLists', id!, 'items', item.id), {
            gearId: gearRef.id
          });
          
          gearIds.push(gearRef.id);
        }
      }

      // Create the Kit GearItem
      await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), {
        ownerId: user.uid,
        name: kitName.trim(),
        isKit: true,
        childItemIds: gearIds,
        category: 'Kit',
        status: 'available',
        condition: 'good',
        assetTag: `KIT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        photoUrls: items.filter(i => selectedItems.has(i.id))[0]?.photoUrls || ['https://picsum.photos/seed/kit/400/400'],
        quantity: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      toast.success(`Kit "${kitName}" created successfully! Check your Gear Library.`);
      setShowCreateKitModal(false);
      setKitName('');
      setSelectedItems(new Set());
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/gearLibrary`);
    } finally {
      setIsCreatingKit(false);
    }
  };

  const handleOpenConvertListToKitModal = () => {
    if (!list || items.length === 0) {
      toast.error("Add some items to your list first!");
      return;
    }
    const allItemIds = new Set(items.map(item => item.id));
    setSelectedItems(allItemIds);
    setKitName(`${list.name} Kit`);
    setShowCreateKitModal(true);
  };

  useEffect(() => {
    if (!user) return;
    const qAllLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
    const unsubAllLists = onSnapshot(qAllLists, (snapshot) => {
      const lists = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as PackingList[];
      setAllUserPackingLists(lists);
    }, (err) => {
      console.error("Error fetching all user packing lists:", err);
    });
    return () => unsubAllLists();
  }, [user]);

  const handleCopyMoveItems = async () => {
    if (!id || !targetListId) {
      toast.error("Please select a target packing list.");
      return;
    }
    if (targetListId === id) {
      toast.error("Target list cannot be the same as the current list.");
      return;
    }

    const selectedIds = Array.from(selectedItems);
    if (selectedIds.length === 0) {
      toast.error("No items selected.");
      return;
    }

    const targetList = allUserPackingLists.find(l => l.id === targetListId);
    if (!targetList) {
      toast.error("Selected target list not found.");
      return;
    }

    setIsProcessingCopyMove(true);
    try {
      const itemsToProcess = items.filter(item => selectedItems.has(item.id));
      const batch = writeBatch(db);
      
      itemsToProcess.forEach(rawItem => {
        const item = rawItem as any;
        const clonedData = {
          name: item.name || '',
          category: item.category || 'Other',
          brand: item.brand || '',
          quantity: item.quantity !== undefined ? item.quantity : 1,
          status: 'pending',
          checked: false,
          aiLabel: item.aiLabel || '',
          description: item.description || '',
          weight: item.weight || 0,
          price: item.price || 0,
          notes: item.notes || '',
          isKit: item.isKit || false,
          childItemIds: item.childItemIds || [],
          photoUrls: item.photoUrls || [],
          sourceUrl: item.sourceUrl || '',
          addOns: item.addOns || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        const newItemRef = doc(collection(db, 'packingLists', targetListId, 'items'));
        batch.set(newItemRef, cleanUndefinedFields(clonedData));
        
        if (copyMoveMode === 'move') {
          batch.delete(doc(db, 'packingLists', id, 'items', item.id));
        }
      });
      
      await batch.commit();
      
      try {
        await logActivity(
          user?.uid || '',
          copyMoveMode === 'copy' ? 'copy_items' : 'move_items',
          `${copyMoveMode === 'copy' ? 'Copied' : 'Moved'} ${itemsToProcess.length} item(s) from "${list?.name || 'Packing List'}" to "${targetList.name}"`,
          JSON.stringify({
            srcListId: id,
            destListId: targetListId,
            itemCount: itemsToProcess.length
          })
        );
      } catch (err) {
        console.warn("Activity log failed:", err);
      }
      
      toast.success(`Successfully ${copyMoveMode === 'copy' ? 'copied' : 'moved'} ${itemsToProcess.length} item(s) to "${targetList.name}"!`);
      setSelectedItems(new Set());
      setTargetListId('');
      setShowCopyMoveModal(false);
    } catch (error) {
      console.error("Error copy/moving items:", error);
      toast.error(`Failed to ${copyMoveMode} items.`);
    } finally {
      setIsProcessingCopyMove(false);
    }
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  const toggleItemStatus = async (item: PackingItem) => {
    if (!id || !canEdit) return;
    
    if (!isListValid && item.status === 'pending') {
      toast.error("List is disabled. All items must have at least one photo to be packed.");
      return;
    }

    let newStatus: 'pending' | 'packed' | 'returned';
    if (item.status === 'pending') newStatus = 'packed';
    else if (item.status === 'packed') newStatus = 'returned';
    else newStatus = 'pending';

    try {
      await updateDoc(doc(db, 'packingLists', id, 'items', item.id), { status: newStatus });
      if (user) {
        await logActivity(
          user.uid,
          user.displayName || user.email || 'Platform User',
          'list_status_change',
          `Updated list item "${item.name}" status to "${newStatus}" in list "${list?.name || 'Untitled List'}"`,
          { listId: id, listName: list?.name, itemStatus: newStatus }
        );
      }
    } catch (error) {
      console.error("Error updating item status:", error);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !list) return;
    try {
      await updateDoc(doc(db, 'packingLists', id), {
        isTemplate: true,
        jobType: templateJobType,
        teachingNotes: templateTeachingNotes,
        updatedAt: new Date().toISOString()
      });
      setShowTemplateModal(false);
      toast.success("List saved as AI Template");
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    }
  };

  const handleSaveCopyAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !list) {
      toast.error("Login required to save a template.");
      return;
    }
    setIsSavingCopyTemplate(true);
    try {
      const finalTemplateName = templateName.trim() || `${list.name} Template`;
      const newListRef = await addDoc(collection(db, 'packingLists'), {
        ownerId: user.uid,
        ownerEmail: user.email,
        name: finalTemplateName,
        description: list.description || "No description provided.",
        isTemplate: true,
        isPublic: false,
        jobType: templateJobType,
        teachingNotes: templateTeachingNotes,
        brandName: list.brandName || '',
        brandLogo: list.brandLogo || '',
        transactionType: list.transactionType || 'Personal',
        price: list.price || 0,
        currency: list.currency || 'USD',
        status: 'Draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const batch = writeBatch(db);
      items.forEach((item, index) => {
        const newItemRef = doc(collection(db, 'packingLists', newListRef.id, 'items'));
        batch.set(newItemRef, {
          listId: newListRef.id,
          name: item.name || '',
          status: 'pending',
          photoUrls: item.photoUrls || [],
          description: item.description || '',
          notes: item.notes || '',
          assetTag: item.assetTag || 'N/A',
          tags: item.tags || [],
          aiLabel: item.aiLabel || '',
          weight: item.weight || 0,
          weightUnit: item.weightUnit || 'lb',
          dimensions: item.dimensions || null,
          organizationTip: item.organizationTip || '',
          priority: item.priority || 'Medium',
          order: typeof item.order === 'number' ? item.order : index,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      setShowTemplateModal(false);
      toast.success(`Saved copy as template: "${finalTemplateName}"!`);
      navigate(`/list/${newListRef.id}`);
    } catch (error) {
      console.error("Error saving template copy:", error);
      toast.error("Failed to save as template copy");
    } finally {
      setIsSavingCopyTemplate(false);
    }
  };

  const generateMarketplaceContent = () => {
    if (!list) return;
    const itemCount = items.length;
    const topItems = items.slice(0, 5).map(i => i.name).join('\n• ');
    const priceStr = editPrice > 0 ? `${editCurrency} ${editPrice}` : 'Contact for price';
    
    const caption = `📦 FOR SALE: ${list.name}\n\n` +
      `I'm listing this professionally inventoried kit! Includes ${itemCount} items, all visually verified and tracked.\n\n` +
      `🔥 Key items included:\n• ${topItems}${itemCount > 5 ? '\n• ...and more!' : ''}\n\n` +
      `💰 Price: ${priceStr}\n` +
      `📍 View full visual inventory, high-res photos & details here:\n${window.location.origin}/#/p/${id}\n\n` +
      `This list is managed via Smart Packer - ensuring every item is accounted for.\n\n` +
      `#Marketplace #GearForSale #PackingList #Inventory #SmartPacker #ProfessionalGear`;
      
    setEditGeneratedCaption(caption);
    
    // Also generate a more detailed description for the marketplace field itself if empty
    if (!editMarketplaceDetails) {
      const detailedDesc = `Complete ${list.name} kit for ${editTransactionType === 'Rental' ? 'rent' : 'sale'}.\n\n` +
        `This is a professionally managed inventory list. Every item has been scanned and verified.\n\n` +
        `Included in this package:\n` +
        items.map(i => `- ${i.name} (${i.aiLabel || 'General'})`).join('\n') +
        `\n\nTotal items: ${itemCount}\n` +
        `Condition: Professionally maintained\n` +
        `Visual verification link: ${window.location.origin}/#/p/${id}`;
      setEditMarketplaceDetails(detailedDesc);
    }
  };

  const getCommissionDetail = () => {
    if (!adminSettings?.commissionConfig) {
      return { total: 0, userPayout: list?.price || 0, strategy: 'percentage' };
    }
    const config = adminSettings.commissionConfig;
    const price = list?.price || 0;
    
    let percentage = config.defaultPercentage ?? 5;
    let amount = config.defaultAmount ?? 1.5;
    let strategy = config.strategy ?? 'percentage';

    // 1. List level Override
    if (list?.id && config.listOverrides?.[list.id]) {
      const o = config.listOverrides[list.id];
      percentage = o.percentage;
      amount = o.amount;
      strategy = o.strategy;
    } else {
      // 2. Element-level overrides
      let itemsTotalOverridesCount = 0;
      let percentSum = 0;
      let amountSum = 0;
      let overridden = false;
      
      const categoryOverridesMap = config.categoryOverrides || {};
      const itemOverridesMap = config.itemOverrides || {};
      
      for (const item of (items || [])) {
        if (item.id && itemOverridesMap[item.id]) {
          const o = itemOverridesMap[item.id];
          percentSum += o.percentage;
          amountSum += o.amount;
          itemsTotalOverridesCount++;
          overridden = true;
        } else if (item.aiLabel && categoryOverridesMap[item.aiLabel]) {
          const o = categoryOverridesMap[item.aiLabel];
          percentSum += o.percentage;
          amountSum += o.amount;
          itemsTotalOverridesCount++;
          overridden = true;
        }
      }

      if (overridden && itemsTotalOverridesCount > 0) {
        percentage = percentSum / itemsTotalOverridesCount;
        amount = amountSum;
      }
    }

    let total = 0;
    if (strategy === 'percentage') {
      total = (price * percentage) / 100;
    } else if (strategy === 'amount') {
      total = amount;
    } else if (strategy === 'both') {
      total = ((price * percentage) / 100) + amount;
    }
    
    total = Math.min(price, total);
    return {
      total,
      userPayout: Math.max(0, price - total),
      strategy
    };
  };

  const handleReleaseRental = () => {
    if (!id || !list) return;
    setAgreementType('pickup');
    setAgreementSigneeName(list.bookingClientName || list.recipientName || '');
    setAgreementSigneeEmail(list.bookingClientEmail || list.recipientEmail || '');
    setAgreementSigneePhone(list.customFields?.phone || '');
    setAgreementNotes('');
    setAgreementSignature('');
    setShowAgreementModal(true);
  };

  const handleReturnRental = () => {
    if (!id || !list) return;
    setAgreementType('dropoff');
    setAgreementSigneeName(list.bookingClientName || list.recipientName || '');
    setAgreementSigneeEmail(list.bookingClientEmail || list.recipientEmail || '');
    setAgreementSigneePhone(list.customFields?.phone || '');
    setAgreementNotes('');
    setAgreementSignature('');
    setShowAgreementModal(true);
  };

  const handleSubmitAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !list) return;
    if (!agreementSigneeName || !agreementSigneeEmail) {
      toast.error("Please provide the signee's name and email.");
      return;
    }
    if (!agreementSignature) {
      toast.error("Please draw your signature to authorize the agreement.");
      return;
    }

    setIsSubmittingAgreement(true);
    try {
      const agreementsColRef = collection(db, 'packingLists', id, 'RentalAgreements');
      const agreementPayload: RentalAgreement = {
        packingListId: id,
        type: agreementType,
        signeeName: agreementSigneeName,
        signeeEmail: agreementSigneeEmail,
        signeePhone: agreementSigneePhone || undefined,
        signatureUrl: agreementSignature,
        termsAccepted: agreementType === 'pickup' ? [
          "The equipment listed above has been visually verified & matches requested specifications",
          "I accept 100% custody and strict liability for loss, damage, theft, or production delays",
          "Return schedule must be completed prior to expiry due-dates without delays"
        ] : [
          "I certify that all checked-out payloads have been returned to stock or accounted for",
          "Outstanding battery cells, brackets, or minor cables are in proper packaging containers",
          "Returned units have been visually pre-inspected for physical defects & water intrusion"
        ],
        notes: agreementNotes || undefined,
        signedAt: new Date().toISOString(),
        agreementDate: new Date().toLocaleDateString(undefined, { dateStyle: 'medium' }),
        itemsCaptured: items.map(item => ({
          id: item.id,
          name: item.name,
          status: agreementType === 'pickup' ? 'packed' : 'returned',
          condition: (item as any).condition || 'good',
          assetTag: item.assetTag || ''
        })),
        witnessedByUid: user?.uid || undefined,
        witnessedByName: user?.displayName || user?.email || undefined,
        witnessedByEmail: user?.email || undefined
      };

      // 1. Add Agreement Document to RentalAgreements sub-collection
      await addDoc(agreementsColRef, agreementPayload);

      // 2. Set Packing List state
      const targetStatus = agreementType === 'pickup' ? 'released' : 'returned';
      await updateDoc(doc(db, 'packingLists', id), {
        rentalStatus: targetStatus,
        updatedAt: new Date().toISOString()
      });

      // 3. Batch update items
      const targetItemStatus = agreementType === 'pickup' ? 'packed' : 'returned';
      const batchRef = writeBatch(db);
      for (const item of items) {
        batchRef.update(doc(db, 'packingLists', id, 'items', item.id), { status: targetItemStatus });
      }
      await batchRef.commit();

      setShowAgreementModal(false);
      toast.success(
        agreementType === 'pickup'
          ? `Successfully checked out & released equipment in secure "RentalAgreements" collection to ${agreementSigneeName}!`
          : `Successfully checked in & resolved "RentalAgreements" return for ${agreementSigneeName}!`
      );
    } catch (err) {
      console.error(err);
      toast.error(`Failed to authorize and save rental agreement: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmittingAgreement(false);
    }
  };

  const generateShareCaption = () => {
    if (!list) return;
    const itemCount = items.length;
    const topItems = items.slice(0, 5).map(i => i.name).join('\n• ');
    
    const caption = `📋 Check out my packing list: ${list.name}\n\n` +
      `I'm using Packer Tools to manage my gear! This list includes ${itemCount} items, all visually verified.\n\n` +
      `🔥 Key items:\n• ${topItems}${itemCount > 5 ? '\n• ...and more!' : ''}\n\n` +
      `📍 View the full visual inventory here:\n${shareUrl}\n\n` +
      `#PackingList #GearManagement #SmartPacker #ProfessionalGear #Inventory`;
      
    setShareCaption(caption);
  };

  const handleSaveMarketplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !list || !user) return;

    // Check distribution limit for free users
    if (editRecipientId && editRecipientId !== list.recipientId) {
      const { allowed, current, limit } = await checkLimit(user, adminSettings, 'distributions');
      if (!allowed) {
        toast.error(`Distribution limit reached (${current}/${limit}). Upgrade to Pro for unlimited team logistics.`);
        return;
      }
    }

    const firstItemImage = items.find(item => item.photoUrls && item.photoUrls.length > 0)?.photoUrls?.[0] || '';
    const finalImage = editImage || firstItemImage;

    try {
      await updateDoc(doc(db, 'packingLists', id), {
        recipientId: editRecipientId,
        transactionType: editTransactionType,
        price: Number(editPrice),
        currency: editCurrency,
        marketplaceEnabled: editMarketplaceEnabled,
        marketplaceDetails: editMarketplaceDetails,
        image: finalImage,
        status: editStatus,
        bookingFeePercent: Number(editBookingFeePercent),
        securityDeposit: Number(editSecurityDeposit),
        customFields: editCustomFields,
        updatedAt: new Date().toISOString()
      });
      setShowMarketplaceModal(false);
      toast.success("Marketplace settings updated");
    } catch (error) {
      console.error("Error saving marketplace settings:", error);
      toast.error("Failed to update marketplace settings");
    }
  };

  const generateShareToken = async () => {
    if (!id || !list) return;
    const token = Math.random().toString(36).substring(2, 15);
    try {
      await updateDoc(doc(db, 'packingLists', id), { shareToken: token });
    } catch (error) {
      console.error("Error generating share token:", error);
    }
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `packing-list-qr-${id}.png`;
      link.href = url;
      link.click();
    }
  };

  const shareUrl = `${window.location.origin}/#/p/${id}${list?.shareToken ? `?token=${list.shareToken}` : ''}`;

  if (loading) return <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  if (!canViewList) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-24 h-24 bg-red-50 rounded-[2.5rem] flex items-center justify-center text-red-500 shadow-inner">
          <Shield size={48} />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-neutral-900">Access Denied</h2>
          <p className="text-neutral-500 font-medium italic text-sm">
            You do not have permission to view this packing list. Please contact your organization administrator to update your <span className="font-bold text-[#2563eb]">Permissions Matrix</span>.
          </p>
        </div>
        <Link to="/organizer" className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition uppercase tracking-widest text-xs btn">
          Go back to Organizer
        </Link>
      </div>
    );
  }

  if (!list) return null;

  if (isPrintView) {
    const activeItems = filteredItems;
    const totalWeightInKg = totalWeight;
    const statsTotal = activeItems.length;
    const statsPacked = activeItems.filter(i => i.status === 'packed').length;
    const statsPercent = statsTotal > 0 ? Math.round((statsPacked / statsTotal) * 100) : 0;
    
    const printGroups = (printGrouping 
      ? Object.entries(
          activeItems.reduce<{ [key: string]: PackingItem[] }>((acc, item) => {
            const grp = item.aiLabel || 'Uncategorized';
            if (!acc[grp]) acc[grp] = [];
            acc[grp].push(item);
            return acc;
          }, {})
        )
      : [['All Items', activeItems]]) as [string, PackingItem[]][];

    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col font-sans">
        <style>{`
          @media print {
            body {
              background: white !important;
              color: text-neutral-900 !important;
            }
            nav, .navbar, .sidebar, footer, .no-print, button, aside, header, #hubspot-messages-iframe-container {
              display: none !important;
            }
            body * {
              visibility: hidden;
            }
            #print-area, #print-area * {
              visibility: visible;
            }
            #print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              color: black !important;
            }
            tr {
              page-break-inside: avoid !important;
            }
            .text-print-black {
              color: #000000 !important;
            }
            .border-print-gray {
              border-color: #d1d5db !important;
            }
          }
        `}</style>
        
        <div className="no-print bg-neutral-950 border-b border-neutral-800 p-4 sticky top-0 z-50 shadow-xl flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPrintView(false)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition duration-200 cursor-pointer"
            >
              <ChevronLeft size={16} />
              <span>Back to Editor</span>
            </button>
            <div className="h-4 w-px bg-neutral-800" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-neutral-300">
              Print Manifest Preview
            </h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={printWithPhotos}
                onChange={(e) => setPrintWithPhotos(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <span>Include Photos</span>
            </label>
            
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={printCompact}
                onChange={(e) => setPrintCompact(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <span>Compact Row Spacing</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={printGrouping}
                onChange={(e) => setPrintGrouping(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <span>Group by Category</span>
            </label>

            <div className="h-4 w-px bg-neutral-800" />

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2 bg-[#F27D26] hover:bg-[#F27D26]/90 text-white rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 shadow-md shadow-primary/20 cursor-pointer"
            >
              <Printer size={16} />
              <span>Print Manifest</span>
            </button>
          </div>
        </div>

        <div className="flex-1 bg-neutral-900 overflow-y-auto py-8 px-4 no-print flex justify-center">
          <div
            id="print-area"
            className="w-full max-w-4xl bg-white text-neutral-900 p-10 shadow-2xl rounded-2xl border border-neutral-200 font-sans print:shadow-none print:border-none"
          >
            <div className="space-y-6 text-print-black">
              <div className="flex justify-between items-start border-b-2 border-neutral-900 pb-5">
                <div className="space-y-1">
                  {list.brandName ? (
                    <div className="flex items-center gap-2 mb-2">
                      {list.brandLogo && (
                        <img 
                          src={list.brandLogo} 
                          alt="Logo" 
                          className="h-8 max-w-[120px] object-contain" 
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <h3 className="text-sm font-black uppercase tracking-wider text-neutral-800">{list.brandName}</h3>
                    </div>
                  ) : (
                    <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 font-black">Packer Tools Manifest</h3>
                  )}
                  <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-950">
                    {list.name}
                  </h1>
                  {list.description && (
                    <p className="text-xs text-neutral-600 font-medium font-sans leading-relaxed max-w-xl">
                      {list.description}
                    </p>
                  )}
                </div>
                
                <div className="text-right space-y-1.5 font-mono text-[10px] text-neutral-500">
                  <div><strong>REF ID:</strong> {list.id}</div>
                  <div><strong>GENERATED:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  {list.jobType && (
                    <div><strong>STAGE/JOB TYPE:</strong> <span className="uppercase text-neutral-900 font-bold">{list.jobType}</span></div>
                  )}
                  {list.stage && (
                    <div><strong>STATUS LEVEL:</strong> <span className="uppercase text-neutral-900 font-black">{list.stage}</span></div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase tracking-wider font-extrabold text-neutral-400 font-mono">Progress Summary</div>
                  <div className="text-lg font-black font-mono text-neutral-800">{statsPacked} / {statsTotal} Items</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase tracking-wider font-extrabold text-neutral-400 font-mono">Ready Ratio</div>
                  <div className="text-lg font-black font-mono text-neutral-800">{statsPercent}% Wrapped</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase tracking-wider font-extrabold text-neutral-400 font-mono">Total Estimated Weight</div>
                  <div className="text-lg font-black font-mono text-neutral-800">
                    {totalWeightInKg > 0 ? `${totalWeightInKg.toFixed(2)} kg` : 'N/A'}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase tracking-wider font-extrabold text-neutral-400 font-mono font-bold">Category Count</div>
                  <div className="text-lg font-black font-mono text-neutral-800">{Object.keys(groupedItems).length} Pools</div>
                </div>
              </div>

              <div className="space-y-8 pt-2">
                {printGroups.map(([groupName, groupItems]) => {
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={groupName} className="space-y-3">
                      <h2 className="text-sm font-black uppercase tracking-widest text-neutral-900 border-b border-neutral-300 pb-1 flex justify-between items-center bg-neutral-50 px-2.5 py-1.5 rounded-lg border-l-4 border-l-[#F27D26]/60">
                        <span>{groupName}</span>
                        <span className="text-[10px] font-mono text-neutral-500 font-bold">({groupItems.length} items)</span>
                      </h2>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-neutral-700 min-w-full">
                          <thead>
                            <tr className="border-b border-neutral-300 text-neutral-500 text-[10px] uppercase font-mono font-bold tracking-wider">
                              <th className="py-2 w-10 text-center">Chk</th>
                              {printWithPhotos && <th className="py-2 w-16">Visual</th>}
                              <th className="py-2 px-3">Item Details</th>
                              <th className="py-2 px-3 w-32">Asset Tag</th>
                              <th className="py-2 px-3 w-20 text-center">Priority</th>
                              <th className="py-2 px-3 w-20 text-right">Weight</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200">
                            {groupItems.map((item) => {
                              const isPacked = item.status === 'packed';
                              return (
                                <tr key={item.id} className="hover:bg-neutral-50/50 transition tr-print">
                                  <td className={`text-center align-middle ${printCompact ? 'py-1.5' : 'py-3'}`}>
                                    <div className="flex justify-center">
                                      {isPacked ? (
                                        <div className="w-5 h-5 rounded-md border-2 border-neutral-900 bg-neutral-950 flex items-center justify-center text-white print:-webkit-print-color-adjust">
                                          <span className="text-[10px] font-black">✓</span>
                                        </div>
                                      ) : (
                                        <div className="w-5 h-5 rounded-md border-2 border-neutral-400 bg-white" />
                                      )}
                                    </div>
                                  </td>
                                  
                                  {printWithPhotos && (
                                    <td className={`align-middle ${printCompact ? 'py-1.5' : 'py-3'}`}>
                                      {item.photoUrls && item.photoUrls.length > 0 ? (
                                        <div className="w-12 h-12 bg-neutral-100 rounded-lg overflow-hidden border border-neutral-200">
                                          <img
                                            src={item.photoUrls[0]}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                          />
                                        </div>
                                      ) : (
                                        <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[8px] font-mono text-neutral-400 uppercase">
                                          No Pic
                                        </div>
                                      )}
                                    </td>
                                  )}

                                  <td className={`px-3 align-middle space-y-0.5 ${printCompact ? 'py-1.5' : 'py-3'}`}>
                                    <div className="font-extrabold text-neutral-900 text-sm tracking-tight">{item.name}</div>
                                    {(item.description || item.notes) && (
                                      <div className="text-[11px] text-neutral-500 font-medium font-sans max-w-md line-clamp-2">
                                        {[item.description, item.notes].filter(Boolean).join(' - ')}
                                      </div>
                                    )}
                                    {(item as any).status === 'in_use' && (
                                      <div className="text-[10px] font-bold text-amber-600 uppercase font-mono tracking-wider">
                                        OUT (Holder: {(item as any).currentHolder || 'Assigned'})
                                      </div>
                                    )}
                                  </td>

                                  <td className={`px-3 align-middle ${printCompact ? 'py-1.5' : 'py-3'}`}>
                                    <div className="flex flex-col gap-1 items-start">
                                      <code className="bg-neutral-100 px-1.5 py-1 rounded text-[10px] font-mono font-black text-neutral-700 tracking-wider">
                                        {item.assetTag || 'NO-TAG'}
                                      </code>
                                      {item.rfidTag && (
                                        <span className="flex items-center gap-1 text-[8px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded-md font-mono uppercase" title={`RFID: ${item.rfidTag}`}>
                                          <span>RFID:</span>
                                          <span className="truncate max-w-[85px]">{item.rfidTag}</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className={`px-3 align-middle text-center ${printCompact ? 'py-1.5' : 'py-3'}`}>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                      item.priority === 'High' 
                                        ? 'bg-red-50 text-red-700 border border-red-200' 
                                        : item.priority === 'Low'
                                          ? 'bg-neutral-50 text-neutral-500 border border-neutral-200'
                                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}>
                                      {item.priority || 'Medium'}
                                    </span>
                                  </td>

                                  <td className={`px-3 align-middle text-right font-mono text-[11px] text-neutral-600 ${printCompact ? 'py-1.5' : 'py-3'}`}>
                                    {item.weight ? `${item.weight} ${item.weightUnit || 'g'}` : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t-2 border-neutral-900 pt-8 mt-12 space-y-6">
                <div className="flex justify-between items-start gap-8">
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">Visual Manifest & Handover Verification</h3>
                    <p className="text-[10px] text-neutral-500 leading-relaxed font-sans mt-1">
                      All equipment items detailed above have been verified visually and packed according to requirements. By signing below, the reviewer accepts custody and accuracy of the inventory sheet.
                    </p>
                  </div>
                  
                  {agreements && agreements.length > 0 ? (
                    <div className="space-y-2 text-xs border border-neutral-200 bg-neutral-50 p-3 rounded-xl max-w-sm">
                      <div className="text-[8px] font-black uppercase tracking-widest text-[#2563eb] font-mono">Latest Verification Records</div>
                      {agreements.slice(0, 1).map((agr) => (
                        <div key={agr.id} className="space-y-1.5">
                          <div className="font-mono text-[10px]"><strong>Signee:</strong> {agr.signeeName} ({agr.signeeEmail})</div>
                          <div className="font-mono text-[10px]"><strong>Date Locked:</strong> {new Date(agr.signedAt).toLocaleString()}</div>
                          {agr.signatureUrl && (
                            <div className="pt-1.5 border-t border-neutral-200 flex flex-col gap-1">
                              <img src={agr.signatureUrl} alt="Sign" className="h-[40px] max-w-[150px] object-contain invert" referrerPolicy="no-referrer" />
                              <span className="text-[8px] font-mono text-neutral-400">Electronic Hash Auth Logged</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6 w-full max-w-md">
                      <div className="space-y-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-neutral-400 font-extrabold font-mono">Packer / Custodian Signature</div>
                        <div className="h-10 border-b-2 border-neutral-300" />
                        <div className="text-[10px] text-neutral-600 font-medium">Date: ________________________</div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-neutral-400 font-extrabold font-mono">Receiver / Client Reviewer Signature</div>
                        <div className="h-10 border-b-2 border-neutral-300" />
                        <div className="text-[10px] text-neutral-600 font-medium">Print Name: _________________</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center text-[9px] text-neutral-400 pt-4 border-t border-neutral-100 font-mono">
                  <span>Manifest Generated via Packer Tools Service</span>
                  <span>Document Hash: {list.id.substring(0, 8).toUpperCase()}-{(totalWeightInKg || 0).toFixed().padStart(5, '0')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-24">
      <div className="pt-4 transition-all duration-300">
        {/* Main Workspace Column */}
        <div className="space-y-8 min-w-0">
          <header className="space-y-6">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-neutral-500 hover:text-primary transition font-medium">
              <ChevronLeft size={20} />
              <span>Back to Dashboard</span>
            </Link>
        
        {linkedProject?.isBuildMode && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden mb-12"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -mr-32 -mt-32" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500">
                  <Hammer size={20} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Build Mode Active</span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter">URL & Search Scraping</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Intelligent Onboarding Engine</p>
              </div>
              <div className="flex-1 w-full max-w-xl flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                  <input 
                    value={sourceInput}
                    onChange={e => setSourceInput(e.target.value)}
                    placeholder="PASTE URL OR PRODUCT NAME..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-[10px] font-black uppercase tracking-widest focus:bg-white/10 focus:ring-1 focus:ring-primary transition-all outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAIOnboard()}
                  />
                </div>
                <button 
                  onClick={handleAIOnboard}
                  disabled={isAnalyzing || !sourceInput}
                  className="px-8 bg-primary text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 transition shadow-xl"
                >
                  {isAnalyzing ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            {isEditingName ? (
              <div className="flex flex-col gap-4">
                <input
                  autoFocus
                  type="text"
                  value={editListName}
                  onChange={(e) => setEditListName(e.target.value)}
                  className="bg-white border-2 border-primary text-3xl font-black uppercase tracking-tighter px-4 py-2 rounded-2xl outline-none w-full"
                  placeholder="List Name"
                />
                <textarea
                  value={list.description}
                  onChange={(e) => setList(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="bg-white border-2 border-neutral-200 text-sm font-medium px-4 py-3 rounded-2xl outline-none w-full h-24 resize-none"
                  placeholder="Description..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateListName}
                    className="px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="px-6 py-2 bg-neutral-100 text-neutral-600 rounded-xl font-bold text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight flex flex-wrap items-center gap-2 md:gap-3 break-words">
                  {list.name}
                  {isOwner && (
                    <button 
                      onClick={() => {
                        setEditListName(list.name || '');
                        setIsEditingName(true);
                      }}
                      className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-300 hover:text-primary"
                    >
                      <Edit2 size={20} />
                    </button>
                  )}
                </h1>
                <p className="text-neutral-500 text-sm md:text-base">{list.description || "No description provided."}</p>
                <div className="flex flex-col gap-4 pt-2">
                  <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <div className="flex bg-neutral-100 p-1 rounded-xl shrink-0">
                      <button 
                        onClick={() => updateStage('proposed')}
                        className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                          (list.stage || 'proposed') === 'proposed' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                        }`}
                      >
                        Proposed
                      </button>
                      <button 
                        onClick={() => updateStage('actual')}
                        className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                          list.stage === 'actual' ? 'bg-primary text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                        }`}
                      >
                        Actual
                      </button>
                    </div>
                    <div className="h-6 w-px bg-neutral-100" />
                    <button 
                      onClick={iterateVersion}
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition text-neutral-600 font-black text-[8px] uppercase tracking-widest"
                    >
                      <span>Iteration v{list.version || 1}</span>
                      <RotateCcw size={10} className="text-neutral-400" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {list.stage !== 'actual' && (
                      <button 
                        onClick={() => {
                          updateStage('actual');
                          iterateVersion();
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black uppercase text-[8px] tracking-widest shadow-lg shadow-green-500/10 transition-all w-fit animate-pulse"
                      >
                        <Zap size={10} />
                        <span>Release as Actual</span>
                      </button>
                    )}
                    {linkedProject && (
                      <button 
                        onClick={toggleBuildMode}
                        className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition font-black text-[8px] uppercase tracking-widest border w-fit ${
                          linkedProject.isBuildMode 
                            ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-sm' 
                            : 'bg-neutral-50 border-transparent text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
                        }`}
                      >
                        <Hammer size={10} />
                        <span>Build Mode {linkedProject.isBuildMode ? 'ON' : 'OFF'}</span>
                      </button>
                    )}
                  </div>
                </div>
                {linkedProject ? (
                  <div className="flex items-center gap-2">
                    <Link 
                      to={`/project/${linkedProject.id}`}
                      className="inline-flex items-center gap-2 bg-primary/5 text-primary px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition mt-2"
                    >
                      <Briefcase size={12} />
                      <span>Project: {linkedProject.name}</span>
                    </Link>
                    <button 
                      onClick={handleUnlinkProject}
                      className="mt-2 text-neutral-300 hover:text-red-500 transition-colors p-1"
                      title="Unlink Project"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowProjectModal(true)}
                    className="inline-flex items-center gap-2 bg-neutral-100 text-neutral-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 hover:text-neutral-600 transition mt-2"
                  >
                    <Link2 size={12} />
                    <span>Link to Project</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 md:gap-3">
            {/* If logged in but not the owner, let them save a copy as a template directly */}
            {user && !isOwner && list && (
              <button
                onClick={() => {
                  setTemplateJobType(list.jobType || '');
                  setTemplateTeachingNotes(list.teachingNotes || '');
                  setTemplateName(`${list.name} Template`);
                  setShowTemplateModal(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl font-bold transition shadow-sm shrink-0"
                title="Save this list as a reusable template in your workspace"
              >
                <Zap size={16} className="text-amber-500 fill-amber-500 animate-pulse" />
                <span className="text-xs uppercase tracking-wider">Save as Template</span>
              </button>
            )}

            {isOwner && (
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <div className="flex-1 md:flex-none flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                  {list && (
                    <button
                      onClick={() => {
                        setTemplateJobType(list.jobType || '');
                        setTemplateTeachingNotes(list.teachingNotes || '');
                        setTemplateName(`${list.name} Template`);
                        setShowTemplateModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl font-bold transition shadow-sm shrink-0 mr-1"
                      title="Save or Configure as AI Template"
                    >
                      <Zap size={16} className="text-amber-500 fill-amber-500" />
                      <span className="text-xs uppercase tracking-wider font-extrabold">Save as Template</span>
                    </button>
                  )}
                  {list && (
                    <button
                      onClick={handleOpenConvertListToKitModal}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 rounded-xl font-bold transition shadow-sm shrink-0 mr-1"
                      title="Convert List to a Physical Kit in Library"
                    >
                      <Package size={16} className="text-primary" />
                      <span className="text-xs uppercase tracking-wider font-extrabold">Convert to Kit</span>
                    </button>
                  )}
                  {isPro && (
                    <button
                      onClick={() => {
                        setBrandName(list.brandName || '');
                        setBrandLogo(list.brandLogo || '');
                        setShowBrandModal(true);
                      }}
                      className="p-2.5 bg-white border border-neutral-200 rounded-xl font-bold hover:bg-neutral-50 transition shadow-sm text-neutral-400 hover:text-primary shrink-0"
                      title="Brand Settings"
                    >
                      <Package size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setReminderItem(null);
                      setShowReminderModal(true);
                    }}
                    className="p-2.5 bg-white border border-neutral-200 rounded-xl font-bold hover:bg-neutral-50 transition shadow-sm text-neutral-400 hover:text-primary shrink-0"
                    title="Set List Reminder"
                  >
                    <Bell size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (!canExportList) {
                        toast.error("Permission denied: You do not have 'Export' permissions to print QR tags or generate PDFs.");
                        return;
                      }
                      setIsQRPrintModalOpen(true);
                    }}
                    className="p-2.5 bg-white border border-neutral-200 rounded-xl font-bold hover:bg-neutral-50 transition shadow-sm text-neutral-400 hover:text-primary shrink-0"
                    title="Print Asset Tags"
                  >
                    <Tag size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (!canExportList) {
                        toast.error("Permission denied: You do not have 'Export' permissions to generate print layouts or PDFs.");
                        return;
                      }
                      setIsPrintView(true);
                    }}
                    className="p-2.5 bg-white border border-neutral-200 rounded-xl font-bold hover:bg-neutral-50 transition shadow-sm text-neutral-400 hover:text-primary shrink-0 animate-pulse bg-primary/5 hover:bg-primary/10 border-primary/20 hover:text-primary"
                    title="Print List / PDF View"
                  >
                    <Printer size={18} className="text-[#F27D26]" />
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="p-2.5 bg-white border border-neutral-200 rounded-xl font-bold hover:bg-neutral-50 transition shadow-sm text-neutral-400 hover:text-primary shrink-0 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600"
                    title="Export Manifest to CSV"
                  >
                    <Download size={18} className="text-emerald-500" />
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="p-2.5 bg-white border border-neutral-200 rounded-xl font-bold hover:bg-neutral-50 transition shadow-sm text-neutral-400 hover:text-primary shrink-0"
                    title="Version History"
                  >
                    <History size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setEditRecipientId(list?.recipientId || '');
                      setEditTransactionType(list?.transactionType || 'Personal');
                      setEditPrice(list?.price || 0);
                      setEditCurrency(list?.currency || 'USD');
                      setEditMarketplaceEnabled(list?.marketplaceEnabled || false);
                      setEditMarketplaceDetails(list?.marketplaceDetails || '');
                      setEditImage(list?.image || '');
                      setEditStatus(list?.status || 'Draft');
                      setEditBookingFeePercent(list?.bookingFeePercent ?? (user?.defaultBookingFee ?? 10));
                      setEditSecurityDeposit(list?.securityDeposit ?? (user?.defaultSecurityDeposit ?? 150));
                      setEditCustomFields(list?.customFields || {});
                      setShowMarketplaceModal(true);
                    }}
                    className="p-2.5 bg-white border border-neutral-200 rounded-xl font-bold hover:bg-neutral-50 transition shadow-sm text-neutral-400 hover:text-primary shrink-0"
                    title="Marketplace & Recipient"
                  >
                    <ShoppingBag size={18} />
                  </button>
                  <button
                    onClick={() => setShowCollaboratorsModal(true)}
                    className="p-2.5 bg-white border border-neutral-200 rounded-xl font-bold hover:bg-neutral-50 transition shadow-sm text-neutral-400 hover:text-primary shrink-0"
                    title="Collaborators"
                  >
                    <Share2 size={18} />
                  </button>
                  <button
                    onClick={handleDeleteList}
                    className="p-2.5 bg-white border border-red-100 rounded-xl font-bold hover:bg-red-50 transition shadow-sm text-red-300 hover:text-red-600 shrink-0"
                    title="Delete Packing List"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}


        {/* --- START OF WORKSPACE --- */}
                {isGroupingEnabled && (
                  <>
                    <div className="w-px h-4 bg-neutral-200 mx-1"></div>
                    <button
                      onClick={collapsedGroups.size === Object.keys(groupedItems).length ? expandAll : collapseAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-neutral-400 hover:text-neutral-600 transition-all"
                    >
                      {collapsedGroups.size === Object.keys(groupedItems).length ? (
                        <>
                          <ChevronDown size={12} />
                          <span>Expand All</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight size={12} />
                          <span>Collapse All</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
              {!isGroupingEnabled && statusFilter === 'all' && isOwner && (
                <span className="text-[10px] text-neutral-400 animate-pulse">Drag items to reorder</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <ArrowUpNarrowWide size={16} className="text-neutral-400" />
                <span className="text-primary font-bold">{totalWeight.toFixed(2)} kg</span>
              </div>
              <span className="text-primary font-bold">{packedCount} / {items.length} Items</span>
            </div>
          
          <div className="h-4 bg-neutral-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-primary"
              transition={{ duration: 0.8, ease: "easeOut" }}
            ></motion.div>
          </div>

          {(list.stage === 'actual' || list.price) && (
            <div className="pt-4 border-t border-neutral-50 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-neutral-50 rounded-2xl">
                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Asset Value</p>
                <p className="text-sm font-black text-primary">{list.currency || '$'} {list.price?.toLocaleString() || '0'}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-2xl">
                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Total Payload</p>
                <p className="text-sm font-black text-primary">{totalWeight.toFixed(2)} kg</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-2xl">
                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">Items Confirmed</p>
                <p className="text-sm font-black text-primary">{items.length}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-2xl">
                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1">BOM Status</p>
                <p className="text-sm font-black text-primary uppercase">{list.stage === 'actual' ? 'Verified' : 'Draft'}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-neutral-50 pt-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {(['all', 'pending', 'packed', 'returned'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    statusFilter === status
                      ? 'bg-accent text-white shadow-lg shadow-accent/20'
                      : 'bg-neutral-50 text-neutral-400 border border-neutral-100 hover:bg-white hover:border-neutral-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-neutral-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}
                title="List View"
              >
                <LayoutList size={18} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'gallery' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}
                title="Gallery View"
              >
                <ImageIcon size={18} />
              </button>
            </div>

            <div className="flex items-center bg-neutral-100 p-1 rounded-xl">
              <button
                onClick={() => setSortBy('order')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                  sortBy === 'order' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Default
              </button>
              <button
                onClick={() => setSortBy('priority')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                  sortBy === 'priority' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Priority
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                  sortBy === 'name' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Name
              </button>
            </div>
          </div>
        </header>

      {/* Bulk Actions Bar */}
      {isOwner && selectedItems.size > 0 && (
        <div className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-1/2 md:-translate-x-1/2 bg-neutral-900 text-white px-4 md:px-8 py-3 md:py-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center gap-4 md:gap-8 z-40 animate-in slide-in-from-bottom-8 duration-300">
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <span className="text-[10px] md:text-sm font-bold uppercase tracking-widest text-neutral-400">{selectedItems.size} Selected</span>
            <button 
              onClick={toggleSelectAll}
              className="text-[10px] md:text-xs font-bold uppercase tracking-widest hover:text-primary transition"
            >
              {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="hidden md:block h-6 w-px bg-neutral-800"></div>
          <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <button
              onClick={() => setSelectedItems(new Set())}
              className="px-3 md:px-4 py-2 text-xs md:text-sm font-bold hover:bg-neutral-800 rounded-xl transition whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const batch = writeBatch(db);
                selectedItems.forEach(itemId => {
                  batch.update(doc(db, 'packingLists', id, 'items', itemId), { status: 'packed' });
                });
                await batch.commit();
                setSelectedItems(new Set());
              }}
              className="px-3 md:px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs md:text-sm hover:bg-primary/90 transition shadow-md whitespace-nowrap"
            >
              Packed
            </button>
            <button
              onClick={async () => {
                const batch = writeBatch(db);
                selectedItems.forEach(itemId => {
                  batch.update(doc(db, 'packingLists', id, 'items', itemId), { status: 'returned' });
                });
                await batch.commit();
                setSelectedItems(new Set());
              }}
              className="px-3 md:px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-xs md:text-sm hover:bg-green-700 transition shadow-md whitespace-nowrap"
            >
              Returned
            </button>
            <button
              onClick={() => setShowBulkGroupModal(true)}
              className="px-3 md:px-4 py-2 bg-neutral-800 text-white rounded-xl font-bold text-xs md:text-sm hover:bg-neutral-700 transition shadow-md flex items-center gap-2 whitespace-nowrap"
            >
              <Tag size={14} />
              <span>Group</span>
            </button>
            <button
              onClick={() => setShowCreateKitModal(true)}
              className="px-3 md:px-4 py-2 bg-primary/20 text-primary border border-primary/20 rounded-xl font-bold text-xs md:text-sm hover:bg-primary/30 transition shadow-md flex items-center gap-2 whitespace-nowrap"
            >
              <Package size={14} />
              <span>Create Kit</span>
            </button>
            <button
              onClick={() => {
                setCopyMoveMode('copy');
                setTargetListId('');
                setShowCopyMoveModal(true);
              }}
              className="px-3 md:px-4 py-2 bg-neutral-800 text-white border border-neutral-700/50 rounded-xl font-bold text-xs md:text-sm hover:bg-neutral-700 transition shadow-md flex items-center gap-2 whitespace-nowrap"
            >
              <ArrowRightLeft size={14} />
              <span>Copy / Move</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 md:px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-lg whitespace-nowrap text-xs md:text-sm"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {filteredItems.length > 0 ? (
          (Object.entries(groupedItems) as [string, PackingItem[]][]).map(([groupName, groupItems], groupIdx) => (
            <motion.div 
              id={`group-${encodeURIComponent(groupName)}`}
              key={groupName} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIdx * 0.1 }}
              className="space-y-4 scroll-mt-24"
            >
              {isGroupingEnabled && (
                <div
                  className="flex items-center gap-2.5 sm:gap-3 w-full text-left group outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl px-2 py-1"
                >
                  <div 
                    onClick={() => toggleGroup(groupName)}
                    className="flex-shrink-0 w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-500 group-hover:bg-neutral-200 transition cursor-pointer shrink-0"
                  >
                    {collapsedGroups.has(groupName) ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </div>
                  <h2 
                    onClick={() => toggleGroup(groupName)}
                    className="text-xs sm:text-lg font-black uppercase tracking-widest text-neutral-900 flex items-center gap-1.5 sm:gap-3 flex-1 cursor-pointer min-w-0 break-words leading-tight"
                  >
                    {groupName}
                    <span className="text-[10px] sm:text-xs font-bold bg-neutral-100 text-neutral-400 px-2 py-0.5 rounded-full shrink-0">
                      {groupItems.length}
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setKitName(groupName);
                        // Filter selected items to just this group
                        const groupItemIds = new Set(groupItems.map(i => i.id));
                        setSelectedItems(groupItemIds);
                        setShowCreateKitModal(true);
                      }}
                      className="p-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-xl transition flex items-center gap-1"
                    >
                      <Box size={14} />
                      <span>Convert to Kit</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewGroupName(groupName);
                        // Filter to just this group (though it's already in this group, maybe they want to move items into it?)
                        // User said "add items to groups after a group has been created"
                        // If they click here, they want to add *selected* items from other groups TO this group.
                        handleBulkGroup(); // This might need adjustment to take a target group name
                      }}
                      className="p-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition hidden md:flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>Add Selected Here</span>
                    </button>
                  </div>
                  <div className="flex-1 h-px bg-neutral-100"></div>
                </div>
              )}
              
              <AnimatePresence initial={false}>
                {!collapsedGroups.has(groupName) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <Reorder.Group 
                      axis={viewMode === 'list' ? "y" : undefined}
                      values={groupItems} 
                      onReorder={handleReorder} 
                      className={`pt-2 ${
                        viewMode === 'list' ? 'space-y-4' : 
                        viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' :
                        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                      }`}
                    >
                      {groupItems.map((item, itemIdx) => (
                        <Reorder.Item
                          key={item.id}
                          id={`item-${item.id}`}
                          value={item}
                          dragListener={viewMode === 'list' && isOwner && !isGroupingEnabled && statusFilter === 'all'}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: itemIdx * 0.05 }}
                          className={`group bg-white rounded-2xl md:rounded-3xl border transition-all duration-300 flex ${
                            viewMode === 'list' ? 'p-4 md:p-6 items-center gap-3 md:gap-6' : 
                            'flex-col p-4 gap-4'
                          } ${
                            item.status === 'packed' ? 'border-primary/20 bg-primary/5 opacity-80' : 'border-neutral-100 hover:shadow-lg'
                          } ${selectedItems.has(item.id) ? 'ring-2 ring-primary border-primary/50' : ''} ${
                            viewMode === 'list' && isOwner && !isGroupingEnabled && statusFilter === 'all' ? 'cursor-grab active:cursor-grabbing' : ''
                          }`}
                        >
                          <div className={`flex items-center shrink-0 gap-1.5 md:gap-3 ${viewMode === 'list' ? 'self-center' : 'w-full order-1 justify-between mb-2 border-b border-neutral-100 pb-2'}`}>
                            <div className="flex items-center gap-1.5 md:gap-2">
                              {isOwner && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelectItem(item.id);
                                  }}
                                  className={`w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl border-2 flex items-center justify-center transition-all shrink-0 aspect-square self-center ${
                                    selectedItems.has(item.id) 
                                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/25' 
                                      : 'border-indigo-200 bg-indigo-50/10 hover:bg-indigo-100/50 hover:border-indigo-400'
                                  }`}
                                  title="Bulk Selection Checkbox (Indigo)"
                                >
                                  {selectedItems.has(item.id) && <CheckCircle2 size={13} strokeWidth={3.5} />}
                                </button>
                              )}
                              {viewMode === 'list' && isOwner && !isGroupingEnabled && statusFilter === 'all' && (
                                <div className="text-neutral-300 hover:text-neutral-500 transition flex-shrink-0 hidden sm:block self-center">
                                  <GripVertical size={20} />
                                </div>
                              )}
                            </div>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemStatus(item);
                              }}
                              className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center transition-all shrink-0 aspect-square self-center border-2 ${
                                item.status === 'packed' 
                                  ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/10 hover:bg-orange-600' 
                                  : item.status === 'returned'
                                  ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-600/10 hover:bg-green-700'
                                  : 'bg-amber-50/50 border-amber-500/20 text-amber-500 hover:bg-amber-100 hover:border-amber-500/50'
                              }`}
                              title={`Logistics Status: ${item.status || 'pending'}`}
                            >
                              {item.status === 'packed' && (
                                <div className="w-5 h-5 md:w-6 md:h-6 rounded-lg bg-white text-orange-500 flex items-center justify-center animate-in zoom-in-50 duration-250">
                                  <svg className="w-3.5 h-3.5 stroke-[4] stroke-orange-500" fill="none" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                              {item.status === 'returned' && <RotateCcw size={15} className="md:size-5" />}
                              {item.status === 'pending' && (
                                <div className="w-5 h-5 md:w-6 md:h-6 rounded-lg border-2 border-amber-300 group-hover:border-amber-500/50 transition-all bg-white" />
                              )}
                            </button>

                            {/* Info Button for Checkbox Support (i) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInfoItem(item);
                                setShowCheckboxInfoModal(true);
                              }}
                              className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 transition shrink-0 self-center border border-neutral-200/50"
                              title="Help: Checkbox Functions"
                            >
                              <Info size={11} className="md:size-3.5" />
                            </button>
                          </div>

                          <div className={`bg-neutral-100 rounded-xl md:rounded-2xl overflow-hidden flex-shrink-0 border border-neutral-200 relative group/photo ${
                            viewMode === 'list' ? 'w-14 h-14 md:w-20 md:h-20' : 
                            viewMode === 'grid' ? 'w-full aspect-square' :
                            'w-full aspect-video'
                          }`}>
                            {item.photoUrls && item.photoUrls.length > 0 ? (
                              viewMode === 'gallery' && item.photoUrls.length > 1 ? (
                                <div className="w-full h-full overflow-x-auto flex snap-x snap-mandatory no-scrollbar">
                                  {item.photoUrls.map((url, idx) => (
                                    <div 
                                      key={idx} 
                                      className="w-full h-full flex-shrink-0 snap-center cursor-pointer"
                                      onClick={() => {
                                        setViewingGalleryItem(item);
                                        setActivePhotoIndex(idx);
                                      }}
                                    >
                                      <img src={url} alt={`${item.name} ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    </div>
                                  ))}
                                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[8px] md:text-[10px] px-2 py-1 rounded-md font-bold backdrop-blur-sm pointer-events-none">
                                    {item.photoUrls.length} Photos • Swipe
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setViewingGalleryItem(item);
                                    setActivePhotoIndex(0);
                                  }}
                                  className="w-full h-full"
                                >
                                  <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover group-hover/photo:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                                  {item.photoUrls.length > 1 && (
                                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[8px] md:text-[10px] px-2 py-1 rounded-md font-bold backdrop-blur-sm">
                                      +{item.photoUrls.length - 1}
                                    </div>
                                  )}
                                </button>
                              )
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingItem(item);
                                }}
                                className="w-full h-full flex flex-col items-center justify-center text-amber-500 bg-amber-50 hover:bg-amber-100 transition-colors group/addphoto"
                                title="Add missing photo"
                              >
                                <Camera size={viewMode === 'list' ? 24 : 32} className="animate-pulse" />
                                <span className="text-[8px] font-black uppercase mt-1">Add Photo</span>
                              </button>
                            )}
                          </div>

                          <div className={`flex-1 min-w-0 ${viewMode === 'list' ? 'space-y-0.5 md:space-y-1' : 'space-y-2'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className={`font-bold truncate text-neutral-800 ${
                                viewMode === 'list' ? 'text-xs sm:text-base md:text-lg' : 'text-[11px] sm:text-sm md:text-base'
                              } ${
                                item.status === 'packed' ? 'line-through text-neutral-400' : 
                                item.status === 'returned' ? 'text-green-600 font-extrabold' : ''
                              }`} style={{ paddingLeft: '4px' }}>
                                <ReactMarkdown components={{ p: 'span' }}>{item.name}</ReactMarkdown>
                              </h3>
                              {isOwner && viewMode !== 'list' && (
                                <div className="flex gap-1">
                                  {isPro && item.photoUrls && item.photoUrls.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditingItem(item);
                                        handleRescanWithAI(item.photoUrls);
                                      }}
                                      className="p-1 text-primary/40 hover:text-primary transition"
                                      title="AI Identify Item"
                                    >
                                      <Zap size={14} className="fill-primary/10" />
                                    </button>
                                  )}
                                  {isPro && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditingItem(item);
                                      }}
                                      className="p-1 text-neutral-300 hover:text-primary transition"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteItem(item.id);
                                    }}
                                    className="p-1 text-neutral-300 hover:text-red-500 transition"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            {viewMode !== 'grid' && (
                              <>
                                {item.description && (
                                  <p className={`text-xs md:text-sm text-neutral-500 line-clamp-1 md:line-clamp-2 ${
                                    item.status === 'packed' ? 'line-through opacity-50' : ''
                                  }`}>
                                    {item.description}
                                  </p>
                                )}
                                {item.notes && (
                                  <p className={`text-[10px] md:text-xs text-neutral-400 italic ${
                                    item.status === 'packed' ? 'line-through opacity-50' : ''
                                  }`}>
                                    Notes: {item.notes}
                                  </p>
                                )}
                              </>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[9px] md:text-xs font-bold uppercase tracking-widest text-neutral-400">
                              <div className="flex items-center gap-1">
                                <Tag size={10} />
                                <span>{item.assetTag}</span>
                              </div>
                              {item.rfidTag && (
                                <div className="flex items-center gap-1 text-indigo-600 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded-md font-mono text-[8px] md:text-[10px]">
                                  <Cpu size={10} />
                                  <span>RFID: {item.rfidTag.substring(0, 8)}...</span>
                                </div>
                              )}
                              {item.priority && (
                                <span className={`px-2 py-0.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest ${
                                  item.priority === 'High' ? 'bg-red-100 text-red-600' :
                                  item.priority === 'Medium' ? 'bg-amber-100 text-amber-600' :
                                  'bg-blue-100 text-blue-600'
                                }`}>
                                  {item.priority}
                                </span>
                              )}
                              {item.aiLabel && viewMode === 'list' && (
                                <div className="flex items-center gap-1 text-primary">
                                  <Info size={10} />
                                  <span>{item.aiLabel}</span>
                                </div>
                              )}
                              {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {item.tags.map((tag, idx) => (
                                    <span key={idx} className="bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded text-[8px] md:text-[10px] lowercase">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {item.relatedItemIds && item.relatedItemIds.length > 0 && (
                                <div className="flex flex-wrap gap-1 items-center">
                                  <Link2 size={10} className="text-primary" />
                                  {item.relatedItemIds.map(relatedId => {
                                    const relatedItem = items.find(i => i.id === relatedId);
                                    if (!relatedItem) return null;
                                    return (
                                      <button
                                        key={relatedId}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Scroll to the related item or just highlight it
                                          const element = document.getElementById(`item-${relatedId}`);
                                          if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            element.classList.add('ring-4', 'ring-primary', 'ring-offset-2');
                                            setTimeout(() => {
                                              element.classList.remove('ring-4', 'ring-primary', 'ring-offset-2');
                                            }, 2000);
                                          }
                                        }}
                                        className="bg-primary/5 text-primary px-1.5 py-0.5 rounded text-[8px] md:text-[10px] hover:bg-primary/10 transition-colors border border-primary/10"
                                      >
                                        {relatedItem.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Mobile action buttons toolbar inside content column to avoid horizontal overflow */}
                            {isOwner && viewMode === 'list' && (
                              <div className="flex md:hidden flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-neutral-100 w-full" onClick={(e) => e.stopPropagation()}>
                                {(!item.photoUrls || item.photoUrls.length === 0) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingItem(item);
                                    }}
                                    className="p-1 px-2.5 bg-amber-50 rounded-lg text-amber-500 hover:bg-amber-100/50 hover:text-amber-600 transition flex items-center gap-1 text-[9px] font-black uppercase tracking-wider shrink-0"
                                    title="Add missing photo"
                                  >
                                    <Camera size={12} />
                                    <span>Photo</span>
                                  </button>
                                )}
                                {isPro && item.photoUrls && item.photoUrls.length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingItem(item);
                                    }}
                                    className="p-1 px-2.5 bg-neutral-100 rounded-lg text-primary/60 hover:bg-neutral-200 hover:text-primary transition flex items-center gap-1 text-[9px] font-black uppercase tracking-wider shrink-0"
                                    title="AI Identify Item"
                                  >
                                    <Zap size={12} className="fill-primary/10" />
                                    <span>AI Scan</span>
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReminderItem(item);
                                    setShowReminderModal(true);
                                  }}
                                  className="p-1 px-2.5 bg-neutral-100 rounded-lg text-neutral-500 hover:bg-neutral-200 hover:text-primary transition flex items-center gap-1 text-[9px] font-black uppercase tracking-wider shrink-0"
                                  title="Set Return/Item Reminder"
                                >
                                  <Bell size={12} />
                                  <span>Remind</span>
                                </button>
                                {isPro && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingItem(item);
                                    }}
                                    className="p-1 px-2.5 bg-neutral-100 rounded-lg text-neutral-500 hover:bg-neutral-200 hover:text-primary transition flex items-center gap-1 text-[9px] font-black uppercase tracking-wider shrink-0"
                                  >
                                    <Edit2 size={12} />
                                    <span>Edit</span>
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItem(item.id);
                                  }}
                                  className="p-1 px-2.5 bg-red-50 rounded-lg text-red-500 hover:bg-red-100 hover:text-red-600 transition flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ml-auto shrink-0"
                                >
                                  <Trash2 size={12} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {isOwner && viewMode === 'list' && (
                            <div className="hidden md:flex gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {(!item.photoUrls || item.photoUrls.length === 0) && (
                                <button
                                  onClick={() => {
                                    startEditingItem(item);
                                  }}
                                  className="p-2 md:p-3 text-amber-500 hover:text-amber-600 transition animate-pulse"
                                  title="Add missing photo"
                                >
                                  <Camera size={18} />
                                </button>
                              )}
                              {isPro && item.photoUrls && item.photoUrls.length > 0 && (
                                <button
                                  onClick={() => {
                                    startEditingItem(item);
                                  }}
                                  className="p-2 md:p-3 text-primary/40 hover:text-primary transition"
                                  title="AI Identify Item"
                                >
                                  <Zap size={18} className="fill-primary/10" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setReminderItem(item);
                                  setShowReminderModal(true);
                                }}
                                className="p-2 md:p-3 text-neutral-300 hover:text-primary transition"
                                title="Set Return/Item Reminder"
                              >
                                <Bell size={18} />
                              </button>
                              {isPro && (
                                <button
                                  onClick={() => {
                                    startEditingItem(item);
                                  }}
                                  className="p-2 md:p-3 text-neutral-300 hover:text-primary transition"
                                >
                                  <Edit2 size={18} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-2 md:p-3 text-neutral-300 hover:text-red-500 transition"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-10 px-4 sm:py-24 bg-white rounded-2xl sm:rounded-[3rem] border border-dashed border-neutral-200">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-300 mx-auto mb-6">
              {statusFilter === 'all' ? <Plus size={40} /> : <Search size={40} />}
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              {statusFilter === 'all' ? 'No items yet' : `No ${statusFilter} items`}
            </h2>
            <p className="text-neutral-500 mb-8">
              {statusFilter === 'all' 
                ? 'Start adding items to your list using the camera scanner.' 
                : `Try changing your filter to see other items.`}
            </p>
            {isOwner && statusFilter === 'all' && (
              <Link
                to={`/scan/${id}`}
                className="px-8 py-4 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition shadow-lg"
              >
                Open Scanner
              </Link>
            )}
        {/* --- END OF WORKSPACE --- */}
          </div>
        )}
      </div>

      {/* Add by URL Modal */}
      {showAddByUrlModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-xl shadow-2xl relative overflow-hidden my-8"
          >
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/5 rounded-bl-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-tr-full pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-500 shrink-0">
                  <Link2 size={22} className="animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-neutral-900">Add Item by Web URL</h2>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-extrabold font-mono">Instant AI Onboarding Gate</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowAddByUrlModal(false);
                  setUrlInput('');
                  setCrawledResult(null);
                }}
                className="p-2.5 hover:bg-neutral-100 rounded-full transition text-neutral-400 hover:text-neutral-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="space-y-6">
              {!crawledResult ? (
                /* Phase 1: Input URL */
                <div className="space-y-6">
                  <p className="text-xs text-neutral-500 leading-relaxed font-medium">
                    Paste a manufacturer, retail, or product detail link (Amazon, B&H, manufacturer sites, etc.) and let our intelligent engine crawl specifications, model number, brand, weight, price, and category suggestions in real-time.
                  </p>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Paste Product URL</label>
                    <div className="relative">
                      <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                      <input
                        autoFocus
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/product-specs-page"
                        className="w-full bg-neutral-50 border border-neutral-200/80 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-primary outline-none transition"
                        onKeyDown={(e) => e.key === 'Enter' && !isCrawling && handleCrawlUrl()}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleCrawlUrl}
                      disabled={isCrawling || !urlInput.trim()}
                      className="w-full py-4 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 rounded-2xl font-black uppercase tracking-widest text-xs transition flex items-center justify-center gap-2 shadow-lg"
                    >
                      {isCrawling ? (
                        <>
                          <Loader2 className="animate-spin text-amber-500" size={16} />
                          <span>AI IS CRAWLING SPECIFICATIONS...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={16} className="text-amber-400" />
                          <span>Extract Details & Parse Item</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isCrawling && (
                    <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex gap-3 animate-pulse">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping mt-1.5 shrink-0" />
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-600">Deep search crawling</h4>
                        <p className="text-[11px] text-neutral-600 font-medium">Please wait. Gemini is querying official web sources to read, extract, and structure technical specifications for this product.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Phase 2: Review Extraction & Save */
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-3">
                    <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Details Retrieved Successfully</h4>
                      <p className="text-[11px] text-neutral-600 font-medium">Please review and customize the structured data before linking it to your active checklist.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Item Name */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Structured Product Name</label>
                      <input
                        type="text"
                        value={crawledResult.name || ''}
                        onChange={(e) => setCrawledResult({ ...crawledResult, name: e.target.value })}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-1 focus:ring-primary focus:bg-white outline-none transition text-xs font-bold"
                      />
                    </div>

                    {/* Brand & Model */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Brand</label>
                        <input
                          type="text"
                          value={crawledResult.brand || ''}
                          onChange={(e) => setCrawledResult({ ...crawledResult, brand: e.target.value })}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-1 focus:ring-primary focus:bg-white outline-none transition text-xs font-bold"
                          placeholder="e.g. Sony"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Model</label>
                        <input
                          type="text"
                          value={crawledResult.model || ''}
                          onChange={(e) => setCrawledResult({ ...crawledResult, model: e.target.value })}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-1 focus:ring-primary focus:bg-white outline-none transition text-xs font-bold"
                          placeholder="e.g. FX3"
                        />
                      </div>
                    </div>

                    {/* Category Selection */}
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1 font-sans">Assign Group / Label</label>
                        <input
                          type="text"
                          value={crawledCategory}
                          onChange={(e) => setCrawledCategory(e.target.value)}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-1 focus:ring-primary focus:bg-white outline-none transition text-xs font-bold"
                          placeholder="Search or enter custom group name..."
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Existing Groups</label>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                          {uniqueAILabels.map(label => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setCrawledCategory(label)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                                crawledCategory === label
                                  ? 'bg-primary text-white border-primary shadow-md'
                                  : 'bg-neutral-50 text-neutral-500 border-neutral-100 hover:border-primary/30 hover:bg-white'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Priority Selector */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Setup Priority</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['High', 'Medium', 'Low'].map((pr) => (
                          <button
                            key={pr}
                            type="button"
                            onClick={() => setCrawledPriority(pr)}
                            className={`py-2 rounded-xl text-[10px] font-bold border transition ${
                              crawledPriority === pr
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            {pr}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Extracted Specifications Preview */}
                    {crawledResult.specs && Object.keys(crawledResult.specs).length > 0 && (
                      <div className="bg-neutral-50 rounded-2xl p-4 space-y-2 border border-neutral-100">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                          <Package size={12} />
                          <span>Extracted Specifications</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                          {Object.entries(crawledResult.specs).map(([key, val]) => {
                            if (!val) return null;
                            return (
                              <div key={key} className="flex justify-between border-b border-neutral-100 py-1 font-medium">
                                <span className="text-neutral-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                <span className="text-neutral-800 font-bold truncate max-w-40">{String(val)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setCrawledResult(null)}
                      className="flex-1 py-3.5 bg-neutral-100 text-neutral-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition font-sans"
                    >
                      Back / Crawl Again
                    </button>
                    <button
                      onClick={handleSaveCrawledItem}
                      className="flex-[2] py-3.5 bg-neutral-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-95 transition shadow-xl"
                    >
                      Import to Checklist
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Quick Add Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-neutral-100 relative text-left">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block">
                  Quick Add Item
                </span>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-neutral-900 mt-1">
                  Manifest Addition
                </h2>
                <div className="flex items-center gap-1 mt-1.5">
                  {[1, 2].map(i => (
                    <div key={i} className={`h-1 rounded-full transition-all duration-300 ${quickAddStep >= i ? 'w-5 bg-primary' : 'w-2 bg-neutral-200'}`}></div>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => { setShowQuickAddModal(false); setQuickAddStep(1); setShowDuplicateConfirmation(false); }}
                className="absolute top-0 right-0 sm:relative p-2 hover:bg-neutral-100 rounded-full transition bg-neutral-50 shadow-sm sm:shadow-none"
              >
                <Plus className="rotate-45 text-neutral-400" size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {quickAddStep === 1 ? (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Item Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={quickAddName}
                      onChange={(e) => setQuickAddName(e.target.value)}
                      placeholder="e.g. Sony A7IV Body"
                      className="w-full px-5 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition font-bold"
                      onKeyDown={(e) => e.key === 'Enter' && quickAddName.trim() && setQuickAddStep(2)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Photos (Optional)</label>
                    <div className="flex flex-wrap gap-2">
                      {quickAddPhotos.map((url, idx) => (
                        <div key={idx} className="relative w-20 h-20 group">
                          <img src={url} className="w-full h-full object-cover rounded-xl border-2 border-neutral-100" />
                          <button 
                            type="button"
                            onClick={() => setQuickAddPhotos(p => p.filter((_, i) => i !== idx))}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
                          >
                            <Plus className="rotate-45" size={12} />
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button"
                        onClick={() => setIsQuickAddPhotoPickerOpen(true)}
                        className="w-20 h-20 border-2 border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center text-neutral-400 hover:border-primary hover:text-primary transition bg-neutral-50"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="animate-spin text-primary" size={24} />
                        ) : (
                          <>
                            <Camera size={24} />
                            <span className="text-[8px] font-black uppercase mt-1">Add</span>
                          </>
                        )}
                      </button>

                      {user && (
                        <AddPhotoWidget
                          isOpen={isQuickAddPhotoPickerOpen}
                          onClose={() => setIsQuickAddPhotoPickerOpen(false)}
                          onPhotoAdded={(urls) => setQuickAddPhotos(prev => [...prev, ...urls])}
                          user={user}
                          adminSettings={adminSettings}
                          targetName={quickAddName || "new item"}
                        />
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setQuickAddStep(2)}
                    disabled={!quickAddName.trim()}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition shadow-lg disabled:opacity-50"
                  >
                    Next: Assignment
                  </button>
                </div>
              ) : showDuplicateConfirmation ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                      <p className="text-xs font-black text-amber-800 uppercase tracking-tight">Duplicate Detected</p>
                    </div>
                    <p className="text-xs text-amber-700 font-semibold leading-relaxed">
                      An item named <span className="font-extrabold">"{quickAddName.trim()}"</span> already exists in this packing list. 
                      Are you sure you want to add another entry of the same item?
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDuplicateConfirmation(false)}
                      className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={proceedWithQuickAdd}
                      disabled={isAddingItem}
                      className="flex-[2] py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition shadow-xl flex items-center justify-center gap-2"
                    >
                      {isAddingItem ? (
                        <>
                          <Loader2 className="animate-spin" size={14} />
                          Adding...
                        </>
                      ) : (
                        "Yes, Add Another"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Assign to Group (Optional)</label>
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input
                          type="text"
                          value={quickAddGroup}
                          onChange={(e) => setQuickAddGroup(e.target.value)}
                          placeholder="Search or enter group..."
                          className="w-full pl-12 pr-4 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Existing Groups</label>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2">
                        {uniqueAILabels.map(label => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setQuickAddGroup(label)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                              quickAddGroup === label
                                ? 'bg-primary text-white border-primary shadow-md'
                                : 'bg-neutral-50 text-neutral-500 border-neutral-100 hover:border-primary/30 hover:bg-white'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setQuickAddStep(1)}
                      className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleQuickAdd}
                      disabled={isAddingItem}
                      className="flex-[2] py-4 bg-neutral-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition shadow-xl flex items-center justify-center gap-2"
                    >
                      {isAddingItem ? (
                        <>
                          <Loader2 className="animate-spin" size={14} />
                          Adding...
                        </>
                      ) : (
                        "Add Item"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Photo Gallery Modal */}
      {user && (
        <BulkScanModal
          isOpen={showBulkScanModal}
          onClose={() => setShowBulkScanModal(false)}
          listId={id || ''}
          user={user}
        />
      )}

      <AnimatePresence>
        {viewingGalleryItem && (
          <div className="fixed inset-0 bg-neutral-950/95 backdrop-blur-xl z-[100] flex flex-col">
            <header className="p-6 flex items-center justify-between text-white">
              <div className="space-y-1">
                <h2 className="text-xl font-black uppercase tracking-tighter">{viewingGalleryItem.name}</h2>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">
                  Photo {activePhotoIndex + 1} of {viewingGalleryItem.photoUrls.length}
                </p>
              </div>
              <button 
                onClick={() => setViewingGalleryItem(null)}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-colors"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </header>

            <div className="flex-1 relative flex items-center justify-center p-4 md:p-12 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activePhotoIndex}
                  src={viewingGalleryItem.photoUrls[activePhotoIndex]}
                  alt={`${viewingGalleryItem.name} ${activePhotoIndex + 1}`}
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 1.1, x: -20 }}
                  className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              {viewingGalleryItem.photoUrls.length > 1 && (
                <>
                  <button 
                    onClick={() => setActivePhotoIndex(prev => (prev > 0 ? prev - 1 : viewingGalleryItem.photoUrls.length - 1))}
                    className="absolute left-4 md:left-8 w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-md"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  <button 
                    onClick={() => setActivePhotoIndex(prev => (prev < viewingGalleryItem.photoUrls.length - 1 ? prev + 1 : 0))}
                    className="absolute right-4 md:right-8 w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-md"
                  >
                    <ChevronRight size={32} />
                  </button>
                </>
              )}
            </div>

            <footer className="p-8 flex justify-center gap-3 overflow-x-auto no-scrollbar">
              {viewingGalleryItem.photoUrls.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    activePhotoIndex === idx ? 'border-primary scale-110 shadow-glow' : 'border-transparent opacity-40 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </footer>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Item Modal */}
      {editingItem && (
        <div 
          className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleEditModalClose();
          }}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 border-b border-neutral-100">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Edit Item</h2>
                <div className="flex items-center gap-2">
                  {editPhotoUrls.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRescanWithAI()}
                      disabled={isReidentifying}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition disabled:opacity-50"
                    >
                      {isReidentifying ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Zap size={14} className="fill-primary" />
                      )}
                      <span>AI Rescan</span>
                    </button>
                  )}
                  <button onClick={handleEditModalClose} className="p-2 hover:bg-neutral-100 rounded-xl transition">
                    <Plus className="rotate-45" size={20} />
                  </button>
                </div>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-1 w-8 rounded-full transition-colors ${editStep >= s ? 'bg-primary' : 'bg-neutral-100'}`} />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {aiSuggestions && (
                <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                      <Zap size={16} className="fill-primary" />
                      <span className="text-sm font-bold uppercase tracking-wider">AI Suggestions</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setAiSuggestions(null)}
                      className="text-neutral-400 hover:text-neutral-600 transition"
                    >
                      <Plus className="rotate-45" size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {aiSuggestions.name && aiSuggestions.name !== editName && (
                      <div className="flex items-center justify-between gap-3 p-2 bg-white rounded-xl border border-neutral-100">
                        <div className="min-w-0">
                          <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Suggested Name</p>
                          <p className="text-xs font-bold truncate">{aiSuggestions.name}</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            setEditName(aiSuggestions.name!);
                            setAiSuggestions(prev => prev ? { ...prev, name: undefined } : null);
                            setIsDirty(true);
                          }}
                          className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded-lg hover:bg-primary/90 transition"
                        >
                          Apply
                        </button>
                      </div>
                    )}

                    {aiSuggestions.category && aiSuggestions.category !== editLabel && (
                      <div className="flex items-center justify-between gap-3 p-2 bg-white rounded-xl border border-neutral-100">
                        <div className="min-w-0">
                          <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Suggested Category</p>
                          <p className="text-xs font-bold truncate">{aiSuggestions.category}</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            setEditLabel(aiSuggestions.category!);
                            setAiSuggestions(prev => prev ? { ...prev, category: undefined } : null);
                            setIsDirty(true);
                          }}
                          className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded-lg hover:bg-primary/90 transition"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleUpdateItem} className="space-y-6">
                {editStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <div className="space-y-2 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                          <Link2 size={12} className="text-primary" />
                          <span>Import details from Web Link</span>
                        </label>
                        {editSourceUrl && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Connected Link
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="url"
                            value={editSourceUrl}
                            onChange={(e) => {
                              setEditSourceUrl(e.target.value);
                              setIsDirty(true);
                            }}
                            placeholder="Paste product specs or retail URL..."
                            className="w-full pl-3 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary outline-none transition"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handlePullProductDetails}
                          disabled={isPullingDetails || !editSourceUrl.trim()}
                          className="px-4 py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-neutral-900 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shrink-0"
                        >
                          {isPullingDetails ? (
                            <>
                              <Loader2 className="animate-spin text-amber-500" size={14} />
                              <span>Pulling...</span>
                            </>
                          ) : (
                            <>
                              <Zap size={14} className="text-amber-400" />
                              <span>Pull Specs</span>
                            </>
                          )}
                        </button>
                      </div>
                      {pullError && (
                        <p className="text-[10px] font-bold text-red-500 mt-1">{pullError}</p>
                      )}
                      <p className="text-[9px] text-neutral-400 leading-normal">
                        Let Gemini fetch brand details, model specifications, descriptive overview, and photo dynamically.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Item Name</label>
                      </div>
                      <textarea
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          setIsDirty(true);
                        }}
                        rows={1}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition resize-none"
                        placeholder="e.g. Sony A7IV Body"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Category</label>
                        <button
                          type="button"
                          onClick={handleMagicSuggest}
                          disabled={isReidentifying}
                          className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 transition disabled:opacity-50"
                        >
                          <Zap size={10} className="fill-primary" />
                          <span>Magic Suggest</span>
                        </button>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => {
                            setEditLabel(e.target.value);
                            setIsDirty(true);
                          }}
                          placeholder="e.g. Camera, Audio, Lighting..."
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                        />
                        {uniqueAILabels.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Existing Categories</p>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                              {uniqueAILabels
                                .filter(l => !editLabel || l.toLowerCase().includes(editLabel.toLowerCase()))
                                .map(label => (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => {
                                      setEditLabel(label);
                                      setIsDirty(true);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                                      editLabel === label
                                        ? 'bg-primary text-white border-primary shadow-sm'
                                        : 'bg-white text-neutral-500 border-neutral-100 hover:border-primary/30'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Priority</label>
                      <div className="flex gap-2">
                        {(['High', 'Medium', 'Low'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setEditPriority(p);
                              setIsDirty(true);
                            }}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                              editPriority === p
                                ? p === 'High' ? 'bg-red-500 text-white shadow-lg shadow-red-200' :
                                  p === 'Medium' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' :
                                  'bg-blue-500 text-white shadow-lg shadow-blue-200'
                                : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Photos</label>
                      <div className="grid grid-cols-4 gap-2">
                        {editPhotoUrls.map((url, idx) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 group">
                            <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <button
                              type="button"
                              onClick={() => {
                                setEditPhotoUrls(prev => prev.filter((_, i) => i !== idx));
                                setIsDirty(true);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Plus className="rotate-45" size={12} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setIsEditItemPhotoPickerOpen(true)}
                          className="aspect-square rounded-lg border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-400 hover:border-primary hover:text-primary transition bg-neutral-50"
                        >
                          <Camera size={20} />
                        </button>

                        {user && (
                          <AddPhotoWidget
                            isOpen={isEditItemPhotoPickerOpen}
                            onClose={() => setIsEditItemPhotoPickerOpen(false)}
                            onPhotoAdded={(urls) => {
                              setEditPhotoUrls(prev => [...prev, ...urls]);
                              setIsDirty(true);
                            }}
                            user={user}
                            adminSettings={adminSettings}
                            targetName={editName || "item"}
                          />
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {editStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Description</label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => {
                          setEditDescription(e.target.value);
                          setIsDirty(true);
                        }}
                        rows={3}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Notes (Private)</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => {
                          setEditNotes(e.target.value);
                          setIsDirty(true);
                        }}
                        rows={2}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Weight</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={editWeight || ''}
                          onChange={(e) => {
                            setEditWeight(parseFloat(e.target.value));
                            setIsDirty(true);
                          }}
                          className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                        />
                        <select
                          value={editWeightUnit}
                          onChange={(e) => {
                            setEditWeightUnit(e.target.value as any);
                            setIsDirty(true);
                          }}
                          className="w-24 px-2 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-xs font-bold"
                        >
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="lb">lb</option>
                          <option value="oz">oz</option>
                        </select>
                      </div>
                    </div>

                    {/* UHF RFID Tag UID Section */}
                    <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-widest text-neutral-800 flex items-center gap-1">
                          <span>📡 UHF RFID Tag Association</span>
                        </label>
                        {editRFIDTag ? (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                            LINKED
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full font-mono">
                            UNLINKED
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-neutral-400 leading-normal">
                        Assign a unique 96-Bit RFID tag UID (EPC Hex) to associate this physical item with your digital manifest audits.
                      </p>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editRFIDTag}
                          maxLength={24}
                          onChange={(e) => {
                            setEditRFIDTag(e.target.value.toUpperCase().replace(/[^0-9A-FA-F]/g, ''));
                            setIsDirty(true);
                          }}
                          placeholder="E2801130200020B..."
                          className="flex-1 px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition font-mono text-xs font-bold uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const chars = '0123456789ABCDEF';
                            let hex = 'E2801';
                            for (let i = 0; i < 19; i++) {
                              hex += chars[Math.floor(Math.random() * chars.length)];
                            }
                            setEditRFIDTag(hex);
                            setIsDirty(true);
                          }}
                          className="px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition shrink-0 font-mono"
                        >
                          Gen Tag
                        </button>
                      </div>
                    </div>

                    {/* Smart Lens Taxonomy Section */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-200 mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-widest text-[#10b981] flex items-center gap-1">
                          <span>🔍 Smart Lens Taxonomy Specs</span>
                        </label>
                      </div>
                      <p className="text-[9px] text-neutral-400 leading-normal">
                        Configure professional optics properties to translate accurately to active marketplace lists and smart searches.
                      </p>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-neutral-400">Lens Type</label>
                          <select
                            value={editLensType}
                            onChange={(e) => {
                              setEditLensType(e.target.value);
                              setIsDirty(true);
                            }}
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-xs text-neutral-800"
                          >
                            <option value="">Select Type...</option>
                            <option value="Prime">Prime</option>
                            <option value="Zoom">Zoom</option>
                            <option value="Anamorphic">Anamorphic Prime</option>
                            <option value="Anamorphic Zoom">Anamorphic Zoom</option>
                            <option value="Macro">Macro</option>
                            <option value="Cine Prime">Cine Prime</option>
                            <option value="Cine Zoom">Cine Zoom</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-neutral-400">Lens Mount</label>
                          <select
                            value={editLensMount}
                            onChange={(e) => {
                              setEditLensMount(e.target.value);
                              setIsDirty(true);
                            }}
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-xs text-neutral-800"
                          >
                            <option value="">Select Mount...</option>
                            <option value="PL">Arri PL Mount</option>
                            <option value="EF">Canon EF Mount</option>
                            <option value="RF">Canon RF Mount</option>
                            <option value="E-Mount">Sony E Mount</option>
                            <option value="L-Mount">L-Mount (Leica/Panasonic/Sigma)</option>
                            <option value="F-Mount">Nikon F Mount</option>
                            <option value="Z-Mount">Nikon Z Mount</option>
                            <option value="X-Mount">Fujifilm X Mount</option>
                            <option value="MFT">Micro Four Thirds (MFT)</option>
                            <option value="M-Mount">Leica M Mount</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-neutral-400">Focal Length</label>
                          <input
                            type="text"
                            placeholder="e.g. 50mm, 24-70mm"
                            value={editFocalLength}
                            onChange={(e) => {
                              setEditFocalLength(e.target.value);
                              setIsDirty(true);
                            }}
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-xs text-neutral-900 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-neutral-400">Max Aperture</label>
                          <input
                            type="text"
                            placeholder="e.g. T1.5, f/2.8"
                            value={editMaxAperture}
                            onChange={(e) => {
                              setEditMaxAperture(e.target.value);
                              setIsDirty(true);
                            }}
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-xs text-neutral-900 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-neutral-400">Format Coverage</label>
                          <select
                            value={editFormatCoverage}
                            onChange={(e) => {
                              setEditFormatCoverage(e.target.value);
                              setIsDirty(true);
                            }}
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-xs text-neutral-800"
                          >
                            <option value="">Select Coverage...</option>
                            <option value="Full Frame">Full Frame (35mm)</option>
                            <option value="Super 35">Super 35 (APS-C)</option>
                            <option value="Large Format">Large Format / VistaVision</option>
                            <option value="Medium Format">Medium Format</option>
                            <option value="Micro Four Thirds">Micro Four Thirds (M4/3)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-neutral-400">Focus Type</label>
                          <select
                            value={editFocusType}
                            onChange={(e) => {
                              setEditFocusType(e.target.value);
                              setIsDirty(true);
                            }}
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none text-xs text-neutral-800"
                          >
                            <option value="">Select Focus...</option>
                            <option value="Manual Only">Manual Focus (MF)</option>
                            <option value="Autofocus">Autofocus (AF)</option>
                            <option value="Cine Focus">Cine Follow-Focus Geared</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Ancillaries & Optional Add-ons section */}
                    <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-widest text-[#0066cc] flex items-center gap-1">
                          <span>📦 Optional Accessories & Ancillaries</span>
                        </label>
                        <span className="text-[10px] bg-[#0066cc]/10 text-[#0066cc] px-2 py-0.5 rounded-full font-bold">
                          {editAddOns.length} Added
                        </span>
                      </div>
                      <p className="text-[9px] text-neutral-400 leading-normal">
                        Add mods, attachments, cables, software licenses, or battery plates to this specific item.
                      </p>

                      {/* Manual addition form row */}
                      <div className="bg-white p-3.5 rounded-xl border border-neutral-200 space-y-2.5 text-xs text-left">
                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block">➕ Quick-Add Component:</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] uppercase font-bold text-neutral-400 block mb-0.5">Ancillary Name</label>
                            <input
                              type="text"
                              value={packAncillaryName}
                              onChange={(e) => setPackAncillaryName(e.target.value)}
                              placeholder="e.g. Cinema Rig, software patch"
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#0066cc]"
                            />
                          </div>

                          <div>
                            <label className="text-[8px] uppercase font-bold text-neutral-400 block mb-0.5">Classification Type</label>
                            <select
                              value={packAncillaryType}
                              onChange={(e) => setPackAncillaryType(e.target.value as any)}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-[#0066cc]"
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

                          <div>
                            <label className="text-[8px] uppercase font-bold text-neutral-400 block mb-0.5">Estimated Value / Rate</label>
                            <input
                              type="number"
                              value={packAncillaryPrice}
                              onChange={(e) => setPackAncillaryPrice(e.target.value)}
                              placeholder="0"
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#0066cc]"
                            />
                          </div>

                          <div>
                            <label className="text-[8px] uppercase font-bold text-neutral-400 block mb-0.5">Ancillary Notes (Optional)</label>
                            <input
                              type="text"
                              value={packAncillaryNotes}
                              onChange={(e) => setPackAncillaryNotes(e.target.value)}
                              placeholder="Spec, length, brand etc"
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#0066cc]"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!packAncillaryName.trim()) {
                                toast.error("Ancillary name is required!");
                                return;
                              }
                              const val = parseFloat(packAncillaryPrice) || 0;
                              const newAncObj = {
                                name: packAncillaryName.trim(),
                                type: packAncillaryType,
                                price: val,
                                notes: packAncillaryNotes.trim() || undefined
                              };
                              setEditAddOns(prev => [...prev, newAncObj]);
                              setIsDirty(true);
                              
                              // Reset states
                              setPackAncillaryName('');
                              setPackAncillaryNotes('');
                              setPackAncillaryPrice('0');
                              toast.success("Added ancillary to item definition!");
                            }}
                            className="px-3 py-1.5 bg-neutral-900 text-white font-extrabold uppercase tracking-widest text-[9px] rounded-lg hover:bg-black transition-all cursor-pointer"
                          >
                            + Append Option
                          </button>
                        </div>
                      </div>

                      {/* Display current list of added items */}
                      <p className="text-[9px] text-neutral-400 italic text-left mb-1">💡 Tap edit pencil or long-press on an accessory to modify specs.</p>
                      {editAddOns.length > 0 ? (
                        <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden divide-y divide-neutral-100 text-xs text-left">
                          {editAddOns.map((anc, idx) => (
                            <div 
                              key={idx} 
                              className="flex justify-between items-center p-2.5 hover:bg-neutral-50 transition cursor-pointer select-none"
                              {...startTouchPress(() => {
                                setPackAncillaryEditIdx(idx);
                                setPackAncillaryEditForm({
                                  name: anc.name,
                                  type: anc.type || 'Accessory',
                                  price: anc.price || 0,
                                  notes: anc.notes || ''
                                });
                              })}
                            >
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-neutral-800">{anc.name}</span>
                                <div className="space-x-1.5 text-[9px] text-neutral-400">
                                  <span className="font-bold text-neutral-500 uppercase">{anc.type || 'Accessory'}</span>
                                  {anc.notes && <span>• {anc.notes}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-emerald-600 text-[10px] mr-1">
                                  {anc.price === 0 ? 'FREE' : `$${anc.price}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPackAncillaryEditIdx(idx);
                                    setPackAncillaryEditForm({
                                      name: anc.name,
                                      type: anc.type || 'Accessory',
                                      price: anc.price || 0,
                                      notes: anc.notes || ''
                                    });
                                  }}
                                  className="text-neutral-400 hover:text-primary p-1 rounded hover:bg-neutral-100 transition"
                                  title="Edit Accessory (or Long-Press on Mobile)"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditAddOns(prev => prev.filter((_, i) => i !== idx));
                                    setIsDirty(true);
                                    toast.success("Ancillary removed");
                                  }}
                                  className="text-neutral-400 hover:text-red-500 p-1 rounded hover:bg-neutral-100 transition"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-3.5 bg-white border border-dashed border-neutral-200 rounded-xl">
                          <p className="text-[10px] text-neutral-400 italic">No bare-gear ancillaries logged yet.</p>
                        </div>
                      )}

                      {/* Ancillary edit modal popup inline */}
                      {packAncillaryEditForm !== null && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-neutral-200/50 shadow-2xl space-y-4">
                            <div className="flex justify-between items-center border-b border-neutral-100 pb-2.5">
                              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                                <Edit2 size={14} className="text-primary" />
                                <span>Edit Accessory</span>
                              </h4>
                              <button 
                                type="button" 
                                onClick={() => setPackAncillaryEditForm(null)}
                                className="text-neutral-400 hover:text-neutral-600"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <div className="space-y-3 text-xs text-left">
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-neutral-400">Name</label>
                                <input
                                  type="text"
                                  value={packAncillaryEditForm.name}
                                  onChange={(e) => setPackAncillaryEditForm({ ...packAncillaryEditForm, name: e.target.value })}
                                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 outline-none font-bold text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-neutral-400">Classification Type</label>
                                <select
                                  value={packAncillaryEditForm.type}
                                  onChange={(e) => setPackAncillaryEditForm({ ...packAncillaryEditForm, type: e.target.value as any })}
                                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-1.5 text-xs outline-none"
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
                                <label className="text-[9px] uppercase font-bold text-neutral-400">Estimated value ({editCurrency || '$'})</label>
                                <input
                                  type="number"
                                  value={packAncillaryEditForm.price}
                                  onChange={(e) => setPackAncillaryEditForm({ ...packAncillaryEditForm, price: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 outline-none font-bold text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-neutral-400">Notes (Optional)</label>
                                <input
                                  type="text"
                                  value={packAncillaryEditForm.notes}
                                  onChange={(e) => setPackAncillaryEditForm({ ...packAncillaryEditForm, notes: e.target.value })}
                                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 outline-none text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-1.5">
                              <button
                                type="button"
                                onClick={() => setPackAncillaryEditForm(null)}
                                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-[9px] font-black uppercase tracking-wider text-neutral-600"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSavePackAncillaryEdit}
                                className="px-3 py-1.5 bg-[#0066cc] hover:bg-[#0055b3] text-white rounded-xl text-[9px] font-black uppercase tracking-wider"
                              >
                                Apply Changes
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {editStep === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Related Items</label>
                      <div className="max-h-40 overflow-y-auto p-2 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                        {items.filter(i => i.id !== editingItem.id).map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setEditRelatedItemIds(prev => 
                                prev.includes(item.id) 
                                  ? prev.filter(id => id !== item.id) 
                                  : [...prev, item.id]
                              );
                              setIsDirty(true);
                            }}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                              editRelatedItemIds.includes(item.id)
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : 'hover:bg-neutral-100 text-neutral-600 border border-transparent'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-neutral-200 overflow-hidden flex-shrink-0">
                              {item.photoUrls && item.photoUrls.length > 0 ? (
                                <img src={item.photoUrls[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                  <Camera size={12} />
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-bold truncate flex-1 text-left">{item.name}</span>
                            {editRelatedItemIds.includes(item.id) && <CheckCircle2 size={14} />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Tags (Comma separated)</label>
                      <input
                        type="text"
                        value={editTags}
                        onChange={(e) => {
                          setEditTags(e.target.value);
                          setIsDirty(true);
                        }}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                      />
                    </div>
                    <div className="pt-4 space-y-3">
                      <button
                        type="button"
                        onClick={() => setIsQRPrintModalOpen(true)}
                        className="w-full py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition flex items-center justify-center gap-2"
                      >
                        <QrCode size={18} />
                        <span>Print QR Tag</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItems(new Set([editingItem.id]));
                          setCopyMoveMode('copy');
                          setTargetListId('');
                          setEditingItem(null);
                          setShowCopyMoveModal(true);
                        }}
                        className="w-full py-3 bg-neutral-800 text-white rounded-xl font-bold hover:bg-neutral-700 transition flex items-center justify-center gap-2"
                      >
                        <ArrowRightLeft size={16} />
                        <span>Copy / Move Item</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </form>
            </div>

            <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex gap-3">
              {editStep > 1 && (
                <button
                  type="button"
                  disabled={isSavingItem}
                  onClick={() => setEditStep(prev => prev - 1)}
                  className="px-6 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition flex items-center justify-center text-center disabled:opacity-50"
                >
                  Back
                </button>
              )}
              {editStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setEditStep(prev => prev + 1)}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg flex items-center justify-center text-center"
                >
                  Next Step
                </button>
              ) : (
                <button
                  onClick={() => handleUpdateItem()}
                  disabled={!isDirty || isSavingItem}
                  className={`flex-1 py-4 rounded-2xl font-bold transition shadow-lg flex items-center justify-center gap-2 text-center ${
                    isDirty && !isSavingItem ? 'bg-primary text-white hover:bg-primary/90' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  {isSavingItem ? (
                    <>
                      <Loader2 className="animate-spin text-white" size={18} />
                      <span className="animate-pulse">Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Gear Library Modal */}
      {showLibraryModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">Gear Library</h2>
                <p className="text-sm text-neutral-500">Reuse your previously scanned items.</p>
              </div>
              <button onClick={() => setShowLibraryModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <div className="mb-6 space-y-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Search library..."
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {['All', 'Kits', 'Camera', 'Lens', 'Audio', 'Lighting', 'Support', 'Power', 'Cables', 'Other'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setLibraryCategoryFilter(cat)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      libraryCategoryFilter === cat
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {filteredLibraryItems.length > 0 ? (
                filteredLibraryItems.map((item) => {
                  const isAlreadyAdded = items.some(i => i.gearId === item.id);
                  return (
                    <button 
                      key={item.id} 
                      onClick={() => !isAlreadyAdded && addFromLibrary(item)}
                      disabled={isAlreadyAdded}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all group text-left ${
                        isAlreadyAdded 
                          ? 'bg-neutral-50 border-neutral-100 opacity-60 cursor-not-allowed' 
                          : 'bg-neutral-50 border-neutral-100 hover:border-primary/50 hover:bg-white'
                      }`}
                    >
                      <div className="w-16 h-16 bg-white rounded-xl overflow-hidden border border-neutral-200 flex-shrink-0 group-hover:scale-105 transition-transform">
                        {item.photoUrls && item.photoUrls.length > 0 ? (
                          <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-300">
                            <Package size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold truncate group-hover:text-primary transition-colors">{item.name}</h4>
                          {item.isKit && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-neutral-900 text-white text-[8px] font-black uppercase tracking-tighter rounded-md">
                              <Layers size={10} />
                              Kit
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black">{item.assetTag}</p>
                          <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full font-bold">{item.category}</span>
                        </div>
                      </div>
                      <div className={`${isAlreadyAdded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <div className={`px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 ${
                          isAlreadyAdded ? 'bg-green-500 text-white' : 'bg-primary text-white'
                        }`}>
                          {isAlreadyAdded ? (
                            <>
                              <CheckCircle2 size={14} />
                              Added
                            </>
                          ) : (
                            'Add'
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <p className="text-neutral-400">No matching items found in your library.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">Version History</h2>
                <p className="text-sm text-neutral-500">View and revert to previous states of this list.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSaveVersionModal(true)}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition shadow-md"
                >
                  Save Snapshot
                </button>
                <button onClick={() => setShowHistoryModal(false)} className="text-neutral-400 hover:text-neutral-600">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {versions.length > 0 ? (
                versions.map((v) => (
                  <div key={v.id} className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100 flex items-center justify-between group">
                    <div className="space-y-1">
                      <h4 className="font-bold text-lg">{v.name}</h4>
                      <p className="text-sm text-neutral-500">{v.items.length} items • {new Date(v.createdAt).toLocaleString()}</p>
                      {v.description && <p className="text-xs text-neutral-400 italic">"{v.description}"</p>}
                    </div>
                    <button
                      onClick={() => setShowRevertConfirm(v)}
                      className="px-6 py-2 bg-white text-neutral-900 rounded-xl font-bold text-sm border border-neutral-200 hover:bg-neutral-900 hover:text-white transition shadow-sm"
                    >
                      Revert
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                    <History size={32} />
                  </div>
                  <p className="text-neutral-400">No versions saved yet. Click "Save Snapshot" to create one.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                <Zap size={24} className="fill-amber-500 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold">Save as AI Template</h2>
            </div>
            <p className="text-sm text-neutral-500 mb-6">Create a reusable template from this list or customize AI logic for future similar builds.</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Cinema Camera Package Template"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Job Type</label>
                <input
                  type="text"
                  value={templateJobType}
                  onChange={(e) => setTemplateJobType(e.target.value)}
                  placeholder="e.g. Multi Camera Production"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Teaching Notes (AI Context)</label>
                <textarea
                  value={templateTeachingNotes}
                  onChange={(e) => setTemplateTeachingNotes(e.target.value)}
                  placeholder="Explain the logic for this pack. e.g. 'Always include 2 batteries per camera. If live, include a switcher and 100ft SDI cables...'"
                  rows={4}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition resize-none"
                />
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSaveCopyAsTemplate}
                  disabled={isSavingCopyTemplate}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingCopyTemplate ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving Template Copy...</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Save Copy as New Template</span>
                    </>
                  )}
                </button>

                {isOwner && (
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={16} />
                    <span>Convert Current List to Template</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="w-full py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brand Settings Modal */}
      {showBrandModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold mb-2">Brand Profile</h2>
            <p className="text-sm text-neutral-500 mb-6">Customize the public "Link in Bio" view for this list.</p>
            <form onSubmit={handleUpdateBrand} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. DJI"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Brand Logo URL</label>
                <input
                  type="text"
                  value={brandLogo}
                  onChange={(e) => setBrandLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBrandModal(false)}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Marketplace & Recipient Modal */}
      {showMarketplaceModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl sm:rounded-[3rem] p-5 sm:p-8 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter">Marketplace & Recipient</h2>
                <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Manage transactions and delivery</p>
              </div>
              <button onClick={() => setShowMarketplaceModal(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveMarketplace} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Recipient / Contact</label>
                    <select
                      value={editRecipientId}
                      onChange={(e) => setEditRecipientId(e.target.value)}
                      className="w-full px-5 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition appearance-none"
                    >
                      <option value="">Select a contact...</option>
                      {contacts.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                      ))}
                    </select>
                    <Link to="/contacts" className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline block mt-1">
                      + Manage Contacts
                    </Link>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Transaction Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Personal', 'Sale', 'Rental', 'Gift'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditTransactionType(t)}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            editTransactionType === t 
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                              : 'bg-white text-neutral-400 border-neutral-100 hover:border-neutral-200'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {editTransactionType === 'Rental' && (
                    <div className="grid grid-cols-2 gap-4 mt-2 p-4 bg-primary/5 rounded-2xl border border-primary/15">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400 block pb-1">Hire Booking Fee (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={user?.plan === 'free'}
                          value={editBookingFeePercent}
                          onChange={(e) => setEditBookingFeePercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                          className="w-full px-4 py-3 bg-white border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm font-black"
                          placeholder="e.g. 15"
                        />
                        {user?.plan === 'free' && <p className="text-[8px] text-[#FF5500] font-bold uppercase">Locked (10% standard)</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400 block pb-1">Security Deposit ($)</label>
                        <input
                          type="number"
                          min="0"
                          disabled={user?.plan === 'free'}
                          value={editSecurityDeposit}
                          onChange={(e) => setEditSecurityDeposit(Math.max(0, Number(e.target.value)))}
                          className="w-full px-4 py-3 bg-white border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm font-black"
                          placeholder="e.g. 250"
                        />
                        {user?.plan === 'free' && <p className="text-[8px] text-[#FF5500] font-bold uppercase">Locked ($150 standard)</p>}
                      </div>
                    </div>
                  )}

                  {(editTransactionType === 'Sale' || editTransactionType === 'Rental') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Price</label>
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(Number(e.target.value))}
                          className="w-full px-5 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Currency</label>
                        <select
                          value={editCurrency}
                          onChange={(e) => setEditCurrency(e.target.value)}
                          className="w-full px-5 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition appearance-none"
                        >
                          {(user?.activeMarketplaceCurrencies && user.activeMarketplaceCurrencies.length > 0 
                            ? user.activeMarketplaceCurrencies 
                            : ['USD']
                          ).map((cc) => {
                            const symbolMap: { [key: string]: string } = {
                              USD: '$',
                              EUR: '€',
                              GBP: '£',
                              AUD: 'A$',
                              FJD: 'FJ$',
                              CAD: 'C$',
                              NZD: 'NZ$'
                            };
                            const sym = symbolMap[cc] || '$';
                            return (
                              <option key={cc} value={cc}>{cc} ({sym})</option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Listing Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-5 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition appearance-none"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Active">Active</option>
                      <option value="Sent">Sent (In Transit)</option>
                      <option value="Received">Received</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  <div className="p-6 bg-neutral-50 rounded-[2rem] border border-neutral-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-black uppercase tracking-tighter text-sm">Marketplace Listing</h4>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Enable public view</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !editMarketplaceEnabled;
                          setEditMarketplaceEnabled(newValue);
                          if (newValue && !editGeneratedCaption) {
                            generateMarketplaceContent();
                          }
                        }}
                        className={`w-14 h-8 rounded-full transition-all relative ${editMarketplaceEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${editMarketplaceEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {editMarketplaceEnabled && (
                      <div className="pt-4 border-t border-neutral-200 space-y-4">
                        {/* Thumbnail Image Selector */}
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400 block pb-1">
                            Listing Cover Thumbnail Selector
                          </label>
                          <div className="p-4 bg-white border border-neutral-100 rounded-2xl space-y-3">
                            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wide block">
                              Select a primary image from your visual inventory items:
                            </span>
                            
                            {(() => {
                              const itemImages = Array.from(new Set(items.flatMap(item => item.photoUrls || []).filter(Boolean)));
                              if (itemImages.length === 0) {
                                return (
                                  <div className="py-4 text-center rounded-xl bg-neutral-50 border border-dashed border-neutral-150">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                      No item photos found in this list. Upload photos to packing list items to select a thumbnail.
                                    </p>
                                  </div>
                                );
                              }
                              return (
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                  {itemImages.map((imageUrl, idx) => {
                                    const isSelected = editImage === imageUrl || (!editImage && idx === 0);
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setEditImage(imageUrl)}
                                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                                          isSelected ? 'border-primary shadow-md scale-102 ring-2 ring-primary/20' : 'border-neutral-200 opacity-60 hover:opacity-100'
                                        }`}
                                      >
                                        <img src={imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        {isSelected && (
                                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                            <div className="bg-primary text-white p-0.5 rounded-full">
                                              <CheckCircle2 size={10} className="stroke-[3]" />
                                            </div>
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                            
                            <p className="text-[9px] text-neutral-400 leading-relaxed">
                              {editImage ? "✓ Selected item photo will serve as the cover image of the listing on the marketplace index and shared preview pages." : "ℹ️ No cover image custom-selected. The listing will automatically fall back to using the first available item image by default."}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Marketplace Details</label>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(editMarketplaceDetails);
                                toast.success("Description copied!");
                              }}
                              className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline flex items-center gap-1"
                            >
                              <Copy size={10} />
                              Copy Description
                            </button>
                          </div>
                          <textarea
                            value={editMarketplaceDetails}
                            onChange={(e) => setEditMarketplaceDetails(e.target.value)}
                            placeholder="Add shipping info, condition, or platform links (eBay/FB Marketplace)..."
                            className="w-full px-5 py-4 bg-white border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition h-32 resize-none text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Share Caption</label>
                            <button
                              type="button"
                              onClick={generateMarketplaceContent}
                              className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline flex items-center gap-1"
                            >
                              <Zap size={10} />
                              Generate Caption
                            </button>
                          </div>
                          {editGeneratedCaption ? (
                            <div className="space-y-3">
                              <textarea
                                readOnly
                                value={editGeneratedCaption}
                                className="w-full px-5 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-xs h-32 resize-none text-neutral-600 font-medium"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(editGeneratedCaption);
                                    toast.success("Caption copied!");
                                  }}
                                  className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 transition flex items-center gap-2"
                                >
                                  <Copy size={12} />
                                  Copy
                                </button>
                                <a
                                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/#/p/${id}`)}&quote=${encodeURIComponent(editGeneratedCaption)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition flex items-center gap-2"
                                >
                                  <Share2 size={12} />
                                  Facebook
                                </a>
                                <a
                                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(editGeneratedCaption)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition flex items-center gap-2"
                                >
                                  <Link2 size={12} />
                                  X (Twitter)
                                </a>
                                <a
                                  href={`https://wa.me/?text=${encodeURIComponent(editGeneratedCaption)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-[#25D366] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition flex items-center gap-2"
                                >
                                  <Bell size={12} />
                                  WhatsApp
                                </a>
                              </div>
                            </div>
                          ) : (
                            <div className="p-8 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 text-center">
                              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Click generate to create a social post</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-center p-4 bg-white rounded-2xl border border-neutral-100">
                          <QRCodeCanvas 
                            value={`${window.location.origin}/#/p/${id}`}
                            size={120}
                            level="H"
                            includeMargin={true}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/#/p/${id}`);
                              toast.success("Marketplace link copied!");
                            }}
                            className="flex-1 py-3 bg-white border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 transition flex items-center justify-center gap-2"
                          >
                            <Copy size={14} />
                            Copy Link
                          </button>
                          <a
                            href={`/#/p/${id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-3 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition flex items-center justify-center gap-2"
                          >
                            <ExternalLink size={14} />
                            Preview
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Logistics Fields (Pro Only) */}
                {isPro && (
                  <div className="col-span-full space-y-4 pt-6 border-t border-neutral-100">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black uppercase tracking-tighter text-sm">Custom Logistics Fields</h4>
                      <button
                        type="button"
                        onClick={() => {
                          const key = prompt("Enter field name (e.g. Serial Number, Team ID):");
                          if (key) {
                            setEditCustomFields(prev => ({ ...prev, [key]: '' }));
                          }
                        }}
                        className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline flex items-center gap-1"
                      >
                        <Plus size={10} />
                        Add Field
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(editCustomFields).map(([key, value]) => (
                        <div key={key} className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">{key}</label>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => setEditCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...editCustomFields };
                              delete next[key];
                              setEditCustomFields(next);
                            }}
                            className="p-3 text-neutral-300 hover:text-red-500 transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-8 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowMarketplaceModal(false)}
                  className="flex-1 py-5 bg-neutral-100 text-neutral-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-neutral-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-2 py-5 px-12 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition shadow-xl shadow-primary/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collaborators Modal */}
      {showCollaboratorsModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Collaborators</h2>
                <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Manage team access</p>
              </div>
              <button onClick={() => setShowCollaboratorsModal(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {isOwner && (
                <form onSubmit={handleInviteCollaborator} className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Invite by Email</label>
                  <div className="flex gap-2">
                    <input 
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm transition"
                    />
                    <button 
                      type="submit"
                      disabled={isInviting || !inviteEmail}
                      className="px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 active:scale-95 disabled:opacity-50 transition"
                    >
                      {isInviting ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Active Collaborators</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-neutral-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                        OW
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">Project Owner</span>
                        {list.ownerEmail && <span className="text-[10px] text-neutral-400">{list.ownerEmail} (You)</span>}
                      </div>
                    </div>
                  </div>
                  
                  {list.collaboratorEmails?.map((email) => (
                    <div key={email} className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-100 group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                          {email.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium">{email}</span>
                      </div>
                      {isOwner && (
                        <button 
                          onClick={() => handleRemoveCollaborator(email)}
                          className="p-2 text-neutral-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}

                  {(!list.collaboratorEmails || list.collaboratorEmails.length === 0) && (
                    <div className="text-center py-6 border-2 border-dashed border-neutral-100 rounded-2xl">
                      <p className="text-[10px] uppercase font-black tracking-widest text-neutral-300">No Collaborators yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && list && (
          <ShareModal
            type="list"
            data={list}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Manual Checkout Modal */}
      <AnimatePresence>
        {showManualCheckout && list && (
          <ManualCheckoutModal
            type="list"
            data={list}
            user={user}
            onClose={() => setShowManualCheckout(false)}
          />
        )}
      </AnimatePresence>

      {/* Revert Confirmation Modal */}
      {showRevertConfirm && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl space-y-8"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tighter uppercase">Revert List?</h2>
              <p className="text-neutral-500 font-medium">
                Are you sure you want to revert to <span className="text-neutral-900 font-bold">"{showRevertConfirm.name}"</span>? 
                This will replace all current items with the items from this snapshot.
              </p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100 text-sm text-yellow-800 leading-relaxed">
              <strong>Note:</strong> We'll automatically create a "Pre-Revert" snapshot of your current list so you can undo this if needed.
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowRevertConfirm(null)}
                className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  revertToVersion(showRevertConfirm);
                  setShowRevertConfirm(null);
                }}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg"
              >
                Confirm Revert
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Save Version Modal */}
      {showSaveVersionModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold mb-2">Save Snapshot</h2>
            <p className="text-sm text-neutral-500 mb-6">Give this version a name to easily identify it later.</p>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Version Name</label>
                <input
                  type="text"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="e.g. Pre-Departure, Final Check..."
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Description (Optional)</label>
                <textarea
                  value={versionDescription}
                  onChange={(e) => setVersionDescription(e.target.value)}
                  placeholder="What's special about this version?"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition h-24 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveVersionModal(false)}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveVersion}
                  disabled={!versionName.trim() || isSavingVersion}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg disabled:opacity-50"
                >
                  {isSavingVersion ? 'Saving...' : 'Save Version'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy or Move Items Modal */}
      <AnimatePresence>
        {showCopyMoveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 space-y-6 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black uppercase tracking-tight">Copy / Move Items</h2>
                    <p className="text-xs text-neutral-500">
                      Processing <strong>{selectedItems.size}</strong> selected item(s) from this list.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowCopyMoveModal(false)} 
                    className="p-2 hover:bg-neutral-100 rounded-full transition"
                  >
                    <Plus className="rotate-45 text-neutral-400" size={24} />
                  </button>
                </div>

                {/* Option Selector: Copy or Move */}
                <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setCopyMoveMode('copy')}
                    className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                      copyMoveMode === 'copy'
                        ? 'bg-accent text-white shadow-md shadow-accent/20'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    📂 Copy Items
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyMoveMode('move')}
                    className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                      copyMoveMode === 'move'
                        ? 'bg-accent text-white shadow-md shadow-accent/20'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    📦 Move Items
                  </button>
                </div>

                {/* Search Target Lists Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Search Destination Packing List
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <input
                      type="text"
                      value={copyMoveSearchQuery}
                      onChange={(e) => setCopyMoveSearchQuery(e.target.value)}
                      placeholder="Type name to filter lists..."
                      className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition text-xs"
                    />
                  </div>
                </div>

                {/* List of Target Lists */}
                <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] border border-neutral-100 p-2 rounded-2xl bg-neutral-50 custom-scrollbar">
                  {allUserPackingLists
                    .filter(l => l.id !== id)
                    .filter(l => l.name.toLowerCase().includes(copyMoveSearchQuery.toLowerCase()))
                    .map((targetList) => (
                      <button
                        key={targetList.id}
                        type="button"
                        onClick={() => setTargetListId(targetList.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1 ${
                          targetListId === targetList.id
                            ? 'bg-primary/10 border-primary shadow-sm text-primary-dark'
                            : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-extrabold text-sm">{targetList.name}</span>
                          <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black ${
                            targetListId === targetList.id ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-500'
                          }`}>
                            {targetListId === targetList.id ? 'Selected' : 'Select'}
                          </span>
                        </div>
                        {targetList.description && (
                          <p className="text-[10px] text-neutral-400 truncate w-full">{targetList.description}</p>
                        )}
                        <span className="text-[8px] uppercase tracking-wide font-bold text-neutral-400 font-mono">
                          ID: {targetList.id}
                        </span>
                      </button>
                    ))}
                  {allUserPackingLists.filter(l => l.id !== id).filter(l => l.name.toLowerCase().includes(copyMoveSearchQuery.toLowerCase())).length === 0 && (
                    <div className="text-center py-12 text-neutral-400">
                      <p className="text-xs font-bold">No packing lists found</p>
                      <p className="text-[10px]">Create another packing list to copy items there.</p>
                    </div>
                  )}
                </div>

                {/* Explanation text */}
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-1">
                  <div className="flex items-center gap-2 text-primary">
                    <Info size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Operation Detail</span>
                  </div>
                  <p className="text-[10px] text-neutral-600 leading-relaxed">
                    {copyMoveMode === 'copy' 
                      ? "Copy Mode will clone your selections to the target list. They will remain here." 
                      : "Move Mode will transfer your selections to the target list and safely delete them from the current list."
                    }
                  </p>
                </div>
              </div>

              <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                <button 
                  onClick={() => setShowCopyMoveModal(false)}
                  disabled={isProcessingCopyMove}
                  className="flex-1 py-3 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCopyMoveItems}
                  disabled={!targetListId || isProcessingCopyMove}
                  className="flex-1 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-850 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-wider"
                >
                  {isProcessingCopyMove ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Confirm {copyMoveMode === 'copy' ? 'Copy' : 'Move'}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Kit Modal */}
      <AnimatePresence>
        {showCreateKitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-5 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black">Create Kit</h2>
                    <p className="text-sm text-neutral-500">Save {selectedItems.size} items as a reusable package.</p>
                  </div>
                  <button onClick={() => setShowCreateKitModal(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                    <Trash2 size={24} className="text-neutral-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Kit Name</label>
                    <input
                      type="text"
                      value={kitName}
                      onChange={(e) => setKitName(e.target.value)}
                      placeholder="e.g., Camera A Kit, Audio Package"
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                    />
                  </div>

                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Info size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">How it works</span>
                    </div>
                    <p className="text-[10px] text-neutral-600 leading-relaxed">
                      This will create a new "Container" in your Organizer. Any items not already in your Gear Library will be automatically added.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowCreateKitModal(false)}
                    className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateKit}
                    disabled={!kitName.trim() || isCreatingKit}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCreatingKit ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={20} />
                        <span>Create Kit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkbox Info Modal */}
      <AnimatePresence>
        {showCheckboxInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-neutral-100"
            >
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Info size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-neutral-900">Checkbox Assistant</h2>
                      <p className="text-xs text-neutral-500 font-semibold">Action & Status Guide</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowCheckboxInfoModal(false);
                      setSelectedInfoItem(null);
                    }} 
                    className="p-1.5 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-700 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {selectedInfoItem && (
                  <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 text-xs text-neutral-600">
                    <span className="font-bold text-neutral-900 block mb-1">Selected Item:</span>
                    <span className="font-medium italic">"{selectedInfoItem.name}"</span>
                  </div>
                )}

                <div className="space-y-5">
                  {/* Bulk Select Explanation */}
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-lg border-2 border-indigo-600 bg-indigo-50/40 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/10">
                      <CheckCircle2 size={16} strokeWidth={3} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                        Bulk Selection Checkbox
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Indigo</span>
                      </h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Use this checkbox to select one or multiple items. Once selected, you can perform bulk actions like bulk deletion, status changes, or grouping using the action bar.
                      </p>
                    </div>
                  </div>

                  {/* Pending Explanation */}
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-lg border-2 border-amber-300 bg-amber-50/50 text-amber-500 flex items-center justify-center shrink-0">
                      <div className="w-3 h-3 rounded-md bg-white border border-amber-300" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                        Pending State Checkbox
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Amber</span>
                      </h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Indicates the item is pending action. Tap/click to change state to **Packed** once you've physically placed the gear in its container.
                      </p>
                    </div>
                  </div>

                  {/* Packed Explanation */}
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/20">
                      <svg className="w-4 h-4 stroke-[4.5] stroke-white" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                        Packed State Checkbox
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Orange</span>
                      </h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Indicates the item is successfully packed. Tap/click to transition state to **Returned** (when checked-in/unpacked).
                      </p>
                    </div>
                  </div>

                  {/* Returned Explanation */}
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-green-600/20">
                      <RotateCcw size={14} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                        Returned State Checkbox
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Green</span>
                      </h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Indicates the item has been returned safely from dispatch. Tap/click to cycle back to **Pending** if you need to redeploy it.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => {
                      setShowCheckboxInfoModal(false);
                      setSelectedInfoItem(null);
                    }}
                    className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl font-bold transition shadow-lg text-sm"
                  >
                    Got It!
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reminder Modal */}
      {showReminderModal && user && list && (
        <ReminderModal
          user={user}
          listId={list.id}
          listName={list.name}
          itemId={reminderItem?.id}
          itemName={reminderItem?.name}
          onClose={() => {
            setShowReminderModal(false);
            setReminderItem(null);
          }}
        />
      )}

      {/* Bulk Group Modal */}
      {showBulkGroupModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold mb-2">Group Items</h2>
            <p className="text-neutral-500 mb-6 text-sm">Move {selectedItems.size} items to a new or existing group.</p>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Group Name</label>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Search or enter group name..."
                      className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                      autoFocus
                    />
                  </div>
                </div>

                {uniqueAILabels.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Existing Groups</label>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2">
                      {uniqueAILabels
                        .filter(l => !newGroupName || l.toLowerCase().includes(newGroupName.toLowerCase()))
                        .map(label => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setNewGroupName(label)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                              newGroupName === label
                                ? 'bg-primary text-white border-primary shadow-md'
                                : 'bg-neutral-50 text-neutral-500 border-neutral-100 hover:border-primary/30 hover:bg-white'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBulkGroupModal(false);
                    setNewGroupName('');
                  }}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkGroup}
                  disabled={!newGroupName.trim()}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg disabled:opacity-50"
                >
                  Move Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
                <p className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Connect this list to a production</p>
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

      {/* NEW DIGITAL SIGNATURE & TERMS CAPTURE MODAL */}
      <AnimatePresence>
        {showAgreementModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-neutral-900 border border-neutral-800 text-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans"
            >
              {/* Header banner */}
              <div className="p-6 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border-b border-neutral-800 relative text-left">
                <button 
                  onClick={() => setShowAgreementModal(false)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
                
                <div className="flex items-center gap-2 p-1">
                  <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full ${
                    agreementType === 'pickup' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {agreementType === 'pickup' ? '🏁 Pickup Stage' : '🛑 Dropoff Stage'}
                  </span>
                </div>
                <h3 className="text-base font-black uppercase tracking-tight mt-1 text-white leading-none">
                  {agreementType === 'pickup' ? 'Rental Dispatch & Terms Signature' : 'Rental Check-In & Resolution Statement'}
                </h3>
                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-1.5 font-mono">
                  Sub-Collection: packingLists/{id || 'ID'}/RentalAgreements
                </p>
              </div>

              <form onSubmit={handleSubmitAgreement} className="p-6 space-y-4 overflow-y-auto max-h-[75vh] text-left">
                {/* Witness Details */}
                {user && (
                  <div className="bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800 flex items-center gap-2 justify-between text-[10px] font-mono">
                    <span className="text-neutral-400 font-bold uppercase">Authorized Witness:</span>
                    <span className="text-neutral-200 font-black truncate max-w-[200px]" title={user.email}>
                      {user.displayName || user.email}
                    </span>
                  </div>
                )}

                {/* Form fields */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block">Signee Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Recipient or Operator display name"
                      value={agreementSigneeName}
                      onChange={(e) => setAgreementSigneeName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary-light"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block">Signee Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="name@company.com"
                        value={agreementSigneeEmail}
                        onChange={(e) => setAgreementSigneeEmail(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary-light"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block">Signee Phone (Optional)</label>
                      <input
                        type="text"
                        placeholder="+679 / +1 contact number"
                        value={agreementSigneePhone}
                        onChange={(e) => setAgreementSigneePhone(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block">Official Dispatch Notes & Logs</label>
                    <textarea
                      placeholder="E.g. Batteries at 80% charge, custom flight case included, minor scratch on side."
                      value={agreementNotes}
                      onChange={(e) => setAgreementNotes(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white h-16 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Terms text checklists */}
                <div className="space-y-2 border-t border-b border-neutral-800 py-3 bg-neutral-950/25 px-2 rounded-xl text-left">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/90 block mb-1">Bound Terms and Warranties</span>
                  <div className="space-y-1.5 text-[10px] leading-relaxed text-neutral-400 text-left">
                    {agreementType === 'pickup' ? (
                      <>
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>I confirm receipt of all listed equipment in clean, fully functional condition.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>I agree to verify all payload contents and return items on or before the due date.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>I accept full financial responsibility for loss, damage, theft, or wear outside normal operations.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>I confirm return of all listed equipment back to designated warehouse.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>I agree to undergo detailed technician inspection for states, condition and missing items.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>Outstanding battery cells, brackets, or minor cables are accounted for or billed.</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  {/* Draw Signature Pad */}
                  <div className="bg-neutral-950 border border-neutral-850 rounded-2xl p-3">
                    <InteractiveSignaturePad onSave={setAgreementSignature} />
                  </div>
                </div>

                {/* Action Row */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowAgreementModal(false)}
                    className="py-2 px-4 bg-neutral-800 text-neutral-350 hover:text-white rounded-xl text-xs uppercase font-extrabold tracking-wider transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAgreement}
                    className={`py-2 px-5 bg-primary text-white hover:opacity-90 rounded-xl text-xs uppercase font-black tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-primary/20 cursor-pointer ${
                      isSubmittingAgreement ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmittingAgreement ? (
                      <>
                        <Loader2 className="animate-spin" size={12} />
                        Saving...
                      </>
                    ) : agreementType === 'pickup' ? (
                      'Fulfill & Release'
                    ) : (
                      'Fulfill & Return'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <QRPrintModal 
        isOpen={isQRPrintModalOpen}
        onClose={() => setIsQRPrintModalOpen(false)}
        items={items}
        user={user}
      />
        </div>
      </div>
    </div>
  );
}
