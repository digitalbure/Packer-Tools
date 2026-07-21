import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, getDocs, addDoc, doc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, GearItem, PackingList } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { authenticatedFetch } from '../lib/api';
import { 
  X, Plus, Camera, Sparkles, Wand2, QrCode, ClipboardCheck, 
  Search, ShieldCheck, DollarSign, Wrench, Package, ListPlus, 
  HelpCircle, RefreshCw, Layers, CheckCircle2, Ticket, ArrowRight, Printer, Upload
} from 'lucide-react';
import { identifyItem } from '../services/geminiService';
import { compressImage } from '../lib/imageUtils';
import AddPhotoWidget from './AddPhotoWidget';
import { useAuth } from '../providers/AuthProvider';

interface AddGearModalProps {
  user: UserProfile | null;
  adminSettings: any;
}

// Preset contextual accessories
const ACC_PRESETS: Record<string, string[]> = {
  Camera: ["Extra Battery (NP-FZ100)", "Memory Card (SD UHS-II 128GB)", "Camera Leather Strap", "Protective Cage / Rig"],
  Lens: ["UV Filter 82mm", "Lens Hood", "Front Protection Cap", "Lens Cleaning Cloth/Kit"],
  Audio: ["XLR Cable 5m", "Standard Windscreen", "Rechargeable AA Batteries", "Lavalier Mic Clip"],
  Lighting: ["Light Stand", "Softbox Studio Umbrella", "Extension Power Cord 15m", "Sandbag Utility Weight"],
  Drone: ["Propeller Guard Set", "Premium ND Filters Pack", "Remote Controller Harness", "High-capacity Flight Battery"],
  Electronics: ["USB-C Charge Cable 2m", "Travel Charging Plug", "Velcro Cord Ties", "Protective Hard Sleeve"],
  Other: ["Hard Premium Case", "Velcro Wire Organizers", "Gaffer Tape Heavy-duty", "Zip Tie Ties"]
};

// Base64 premium stock gear images to simulate scanning if no user camera is uploaded
const STOCK_GEAR_SAMPLES = [
  {
    name: "Sony FX3 Cinema Camera",
    category: "Camera",
    img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    desc: "Compact cinema line full-frame camera with phenomenal high ISO performance and cinematic color science."
  },
  {
    name: "DJI Mavic 3 Pro Drone",
    category: "Drone",
    img: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    desc: "Triple-camera system drone mapping incredible aerial details and smooth obstacle sensing."
  },
  {
    name: "Sennheiser MKH416 Shotgun Mic",
    category: "Audio",
    img: "https://images.unsplash.com/photo-1590608897129-79da98d15969?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    desc: "Industry-standard interference tube shotgun microphone with exceptional directivity and rugged style."
  }
];

export default function AddGearModal({ user, adminSettings }: AddGearModalProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { formatCurrency } = useAuth();
  const isOpen = searchParams.get('addGear') === 'true';

  // Step 1: choosing onboarding method. ('choose' | 'ai_scan' | 'manual' | 'existing')
  const [method, setMethod] = useState<'choose' | 'ai_scan' | 'manual' | 'existing'>('choose');
  const [step, setStep] = useState(1); // 1 = details & accessories, 2 = rental & marketplace, 3 = QR success screen

  // Form states
  const [form, setForm] = useState<Partial<GearItem>>({
    name: '',
    brand: '',
    category: 'Other',
    primaryCategory: 'Other',
    model: '',
    modelNumber: '',
    serialNumber: '',
    releaseYear: '',
    price: 0,
    currency: '$',
    condition: 'good',
    weight: 0,
    weightUnit: 'g',
    photoUrls: ['https://picsum.photos/seed/gear/400/400'],
    secondaryCategories: [], // Use this to check 'Rentable'
    description: '',
    organizationTip: '',
    quantity: 1,
    isKit: false,
    visibility: 'public',
    childItemIds: []
  });

  // Tracking modes and sequential copy generators
  const [trackingMode, setTrackingMode] = useState<'bulk' | 'serialized'>('bulk');
  const [serialPrefix, setSerialPrefix] = useState('');
  const [serialStartNum, setSerialStartNum] = useState('');

  // Ancillaries checkbook
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);

  // Manual ancillary states
  const [tempAncillaryName, setTempAncillaryName] = useState('');
  const [tempAncillaryType, setTempAncillaryType] = useState<'Organizer' | 'Accessory' | 'Consumable' | 'Attachment' | 'Add On' | 'Software' | 'Mod' | 'Other'>('Accessory');
  const [tempAncillaryPrice, setTempAncillaryPrice] = useState<string>('0');
  const [tempAncillaryNotes, setTempAncillaryNotes] = useState('');

  // AI Scan states
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scannedResult, setScannedResult] = useState<any>(null);

  // Existing gear states
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);

  // Packing list selection states
  const [packingLists, setPackingLists] = useState<PackingList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

  // Success states
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [newlyCreatedTag, setNewlyCreatedTag] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [isManualPhotoPickerOpen, setIsManualPhotoPickerOpen] = useState(false);
  const [isAiPhotoPickerOpen, setIsAiPhotoPickerOpen] = useState(false);

  // Execute standard isolated system printing for individual tag passport
  const handlePrintIndividualTag = () => {
    const printContent = document.getElementById('onboarded-tag-print-container');
    if (!printContent) {
      window.print();
      return;
    }

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

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Print Label</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              color: black !important;
              font-family: 'Inter', sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              margin: 0 !important;
              size: 100mm 50mm;
            }
            .card-wrapper {
              width: 100mm;
              height: 50mm;
              padding: 6mm;
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              border: 1px solid #e5e5e5;
              border-radius: 8px;
              background: #ffffff;
              box-sizing: border-box;
            }
            .info-col {
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 2px;
              flex: 1;
              margin-right: 4mm;
              overflow: hidden;
            }
            .sub-text {
              font-size: 8px;
              font-weight: 950;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: #ff4f3a;
              margin-bottom: 2px;
            }
            .title-text {
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              color: #111111;
              margin: 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .id-text {
              font-size: 8px;
              color: #888888;
              margin: 0;
              margin-top: 2px;
            }
            .mono-bold {
              font-family: 'JetBrains Mono', monospace;
              font-weight: 700;
              color: #444444;
            }
            .qr-wrapper {
              padding: 4px;
              border: 1px solid #f0f0f0;
              border-radius: 8px;
              background: #ffffff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .qr-wrapper p {
              font-family: 'JetBrains Mono', monospace;
              font-size: 7px;
              font-weight: 700;
              margin: 4px 0 0 0;
              letter-spacing: 0.15em;
              color: #888888;
            }
          </style>
        </head>
        <body>
          <div class="card-wrapper">
            <div class="info-col">
              <span class="sub-text">QR Asset Tag Passport</span>
              <h4 class="title-text">${form.name || ''}</h4>
              <p class="id-text">Asset ID: <span class="mono-bold">${newlyCreatedTag}</span></p>
            </div>
            <div class="qr-wrapper">
              <img src="${printContent.querySelector('canvas')?.toDataURL('image/png') || ''}" style="width: 80px; height: 80px;" />
              <p>${newlyCreatedTag}</p>
            </div>
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

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 6000);
  };

  // Load user's gear list for Option C (Existing Gear selection)
  useEffect(() => {
    if (!isOpen || !user) return;
    const loadInventory = async () => {
      try {
        const qRef = collection(db, 'users', user.uid, 'gearLibrary');
        const snap = await getDocs(qRef);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GearItem);
        setAllGear(list);
      } catch (e) {
        console.error("Error loading gear list:", e);
      }
    };
    loadInventory();
  }, [isOpen, user]);

  // Load user's packing lists
  useEffect(() => {
    if (!isOpen || !user) return;
    const loadPackingLists = async () => {
      try {
        const qRef = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
        const snap = await getDocs(qRef);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PackingList);
        setPackingLists(list);
      } catch (e) {
        console.error("Error loading packing lists:", e);
      }
    };
    loadPackingLists();
  }, [isOpen, user]);

  const handleClose = () => {
    // Clear URL params
    const updated = new URLSearchParams(searchParams);
    updated.delete('addGear');
    setSearchParams(updated);

    // Reset workflow
    setMethod('choose');
    setStep(1);
    setScanImage(null);
    setScanSuccess(false);
    setSelectedAccessories([]);
    setSelectedExistingId(null);
    setNewlyCreatedId(null);
    setSelectedListIds([]);
    setForm({
      name: '',
      brand: '',
      category: 'Other',
      primaryCategory: 'Other',
      model: '',
      modelNumber: '',
      serialNumber: '',
      releaseYear: '',
      price: 0,
      currency: '$',
      condition: 'good',
      weight: 0,
      weightUnit: 'g',
      photoUrls: ['https://picsum.photos/seed/gear/400/400'],
      secondaryCategories: [],
      description: '',
      organizationTip: '',
      quantity: 1,
      isKit: false,
      childItemIds: []
    });
  };

  const processFileAndSetImage = async (file: File) => {
    try {
      const compressedBase64 = await compressImage(file);
      if (method === 'ai_scan') {
        setScanImage(compressedBase64);
        toast.success("Successfully loaded photo! You can now execute the AI Scan pipeline.");
      } else {
        setForm(prev => ({
          ...prev,
          photoUrls: [compressedBase64]
        }));
        toast.success("Photo successfully attached to equipment!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to process image file.");
    }
  };

  const handleClipboardPaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      let foundImage = false;
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const file = new File([blob], "clipboard-image.png", { type });
            await processFileAndSetImage(file);
            foundImage = true;
            break;
          }
        }
        if (foundImage) break;
      }
      if (!foundImage) {
        toast.error("No image found on clipboard. Try copying an image or press Ctrl+V / Command+V.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Could not access clipboard. Try pressing Ctrl+V / Command+V directly while this modal is open.");
    }
  };

  // Convert uploaded image to base64 for Gemini
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFileAndSetImage(file);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await processFileAndSetImage(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isOpen, method]);

  const handlePhotoUrlSubmit = async (url: string) => {
    if (!url.trim()) return;
    setScanning(true);
    const toastId = toast.loading("Fetching image from link...");
    try {
      const res = await authenticatedFetch("/api/url-to-base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.base64) {
        setScanImage(data.base64);
        toast.success("Successfully loaded image from link!", { id: toastId });
      } else {
        toast.error(data.error || "Could not fetch image from link.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Error loading image link: ${err.message}`, { id: toastId });
    } finally {
      setScanning(false);
    }
  };

  // Run AI Gear Scanner
  const runAIScan = async () => {
    if (!scanImage) {
      toast.error("Please provide or trigger an image to scan!");
      return;
    }
    setScanning(true);
    try {
      // Split off metadata if present
      const base64Data = scanImage.includes(',') ? scanImage.split(',')[1] : scanImage;
      const result = await identifyItem(base64Data);

      if (result) {
        setScannedResult(result);
        setForm(prev => ({
          ...prev,
          name: result.name,
          category: result.category,
          primaryCategory: result.category,
          description: `AI-Identified ${result.name} in category ${result.category}. Ready to deploy.`,
          organizationTip: result.organizationTip || "Suggested: Handle with love and check cables regularly."
        }));

        setScanSuccess(true);
        toast.success(`⚡ Recognized: "${result.name}"!`);
      }
    } catch (err) {
      console.error(err);
      toast.error("AI was unable to identify this object. Default manual parameters applied.");
      // Apply defaults so user can continue
      setForm(prev => ({
        ...prev,
        name: "Identified Equipment",
        category: "Other"
      }));
      setScanSuccess(true);
    } finally {
      setScanning(false);
    }
  };

  // Simulate scanning with prime stock pictures
  const simulateScan = (sampleIdx: number) => {
    const sample = STOCK_GEAR_SAMPLES[sampleIdx];
    // Convert a placeholder image or simply simulate scanning process
    setScanning(true);
    setTimeout(() => {
      setForm(prev => ({
        ...prev,
        name: sample.name,
        category: sample.category,
        primaryCategory: sample.category,
        description: sample.desc,
        organizationTip: "Smart Gear Recommendation: Store properly in waterproof cases and secure all lens covers.",
        photoUrls: [sample.img]
      }));
      setScanSuccess(true);
      setScanning(false);
      toast.success(`⚡ AI Recognized Sample: "${sample.name}"`);
    }, 1500);
  };

  // Contextual Accessories picker handler
  const toggleAccessory = (accName: string) => {
    setSelectedAccessories(prev => 
      prev.includes(accName)
        ? prev.filter(a => a !== accName)
        : [...prev, accName]
    );
  };

  const getRecommendedAccessoryList = () => {
    const cat = form.category || 'Other';
    return ACC_PRESETS[cat] || ACC_PRESETS['Other'];
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

  const addGearItemToSelectedLists = async (gearId: string, gearData: any, childGearItems: any[] = []) => {
    if (selectedListIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      
      for (const listId of selectedListIds) {
        // Query current items to find the next order index
        const itemsSnap = await getDocs(collection(db, 'packingLists', listId, 'items'));
        let orderIndex = itemsSnap.size;

        const prepareItemData = (id: string, name: string, data: any, groupLabel?: string) => {
          const sanitizedData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined && typeof v !== 'function')
          );
          return {
            ...sanitizedData,
            name,
            gearId: id,
            listId,
            aiLabel: groupLabel || data.aiLabel || data.category || 'Other',
            status: 'pending',
            order: orderIndex++,
            createdAt: new Date().toISOString()
          };
        };

        const kitGroupLabel = gearData.isKit ? gearData.name : undefined;
        
        // Main item
        const mainItemRef = doc(collection(db, 'packingLists', listId, 'items'));
        batch.set(mainItemRef, prepareItemData(gearId, gearData.name, gearData, kitGroupLabel));

        // Child/accessory items
        for (const child of childGearItems) {
          const childItemRef = doc(collection(db, 'packingLists', listId, 'items'));
          batch.set(childItemRef, prepareItemData(child.id, child.name, child, kitGroupLabel));
        }
      }
      
      await batch.commit();
      toast.success(`Successfully added onboarding gear directly to ${selectedListIds.length} checklist(s)!`);
    } catch (err) {
      console.error("Error adding gear item to selected packing lists:", err);
      toast.error("Failed to add equipment to some selected packing lists.");
    }
  };

  // Execute full save to Firestore!
  const saveGearItem = async () => {
    if (!user) return;
    if (!form.name?.trim()) {
      toast.error("An equipment name is required!");
      return;
    }

    setSaving(true);
    try {
      const pCategory = form.primaryCategory || form.category || 'Other';
      const isBatchAutogen = trackingMode === 'serialized' && (form.quantity || 1) > 1;

      if (isBatchAutogen) {
        const qtyToGen = form.quantity || 1;
        let finalMainId = '';
        let finalMainTag = '';

        for (let i = 1; i <= qtyToGen; i++) {
          const generatedTag = `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
          const createdChildIds: string[] = [];
          const childGearItems: any[] = [];

          if (selectedAccessories.length > 0) {
            // Create child accessory records in Firestore
            for (const acc of selectedAccessories) {
              const accTag = `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
              const accData = {
                name: `${form.name} [#${i}] - ${acc}`,
                brand: form.brand || '',
                category: 'Electronics',
                primaryCategory: 'Electronics',
                ownerId: user.uid,
                workspaceId: user.activeWorkspaceId || null,
                assetTag: accTag,
                quantity: 1,
                status: 'available',
                condition: 'new',
                photoUrls: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              const docRef = await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), cleanUndefinedFields(accData));
              createdChildIds.push(docRef.id);
              childGearItems.push({ id: docRef.id, ...accData });
            }
          }

          // Generate sequential / custom serial
          let computedSerial = form.serialNumber || '';
          if (serialPrefix.trim()) {
            const startNum = parseInt(serialStartNum) || 1;
            computedSerial = `${serialPrefix.trim()}${startNum + (i - 1)}`;
          } else if (form.serialNumber) {
            computedSerial = `${form.serialNumber}-${i}`;
          }

          const mainItemData = {
            ...form,
            name: `${form.name} [#${i}]`,
            category: pCategory,
            primaryCategory: pCategory,
            serialNumber: computedSerial,
            ownerId: user.uid,
            workspaceId: user.activeWorkspaceId || null,
            assetTag: generatedTag,
            quantity: 1, // Individual serialized representation
            isKit: createdChildIds.length > 0,
            childItemIds: createdChildIds,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const mainDocRef = await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), cleanUndefinedFields(mainItemData));
          
          if (selectedListIds.length > 0) {
            await addGearItemToSelectedLists(mainDocRef.id, mainItemData, childGearItems);
          }

          if (i === 1) {
            finalMainId = mainDocRef.id;
            finalMainTag = generatedTag;
          }
        }

        setNewlyCreatedId(finalMainId);
        setNewlyCreatedTag(finalMainTag);
        setStep(3); // Go to final QR code success screen
        toast.success(`Batch onboarded ${qtyToGen} serialized copies successfully!`);
      } else {
        const generatedTag = `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const createdChildIds: string[] = [];
        const childGearItems: any[] = [];
        
        if (selectedAccessories.length > 0) {
          // Create child accessory records in Firestore
          for (const acc of selectedAccessories) {
            const accTag = `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            const accData = {
              name: `${form.name} - ${acc}`,
              brand: form.brand || '',
              category: 'Electronics',
              primaryCategory: 'Electronics',
              ownerId: user.uid,
              workspaceId: user.activeWorkspaceId || null,
              assetTag: accTag,
              quantity: 1,
              status: 'available',
              condition: 'new',
              photoUrls: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), cleanUndefinedFields(accData));
            createdChildIds.push(docRef.id);
            childGearItems.push({ id: docRef.id, ...accData });
          }
        }

        // Insert main gear item
        const mainItemData = {
          ...form,
          category: pCategory,
          primaryCategory: pCategory,
          ownerId: user.uid,
          workspaceId: user.activeWorkspaceId || null,
          assetTag: generatedTag,
          isKit: createdChildIds.length > 0,
          childItemIds: createdChildIds,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const mainDocRef = await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), cleanUndefinedFields(mainItemData));
        
        if (selectedListIds.length > 0) {
          await addGearItemToSelectedLists(mainDocRef.id, mainItemData, childGearItems);
        }

        setNewlyCreatedId(mainDocRef.id);
        setNewlyCreatedTag(generatedTag);
        setStep(3); // Go to final QR code success screen
        toast.success("Equipment successfully onboarded into library!");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save gear info.");
    } finally {
      setSaving(false);
    }
  };

  // Update existing gear details (Option C)
  const saveExistingGearUpdate = async () => {
    if (!user || !selectedExistingId) return;
    setSaving(true);
    try {
      const itemRef = doc(db, 'users', user.uid, 'gearLibrary', selectedExistingId);
      const updatedData = {
        ...form,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(itemRef, cleanUndefinedFields(updatedData));
      
      let childGearItems: any[] = [];
      if (form.isKit && form.childItemIds && form.childItemIds.length > 0) {
        const childrenQuery = query(
          collection(db, 'users', user.uid, 'gearLibrary'),
          where('__name__', 'in', form.childItemIds.slice(0, 30))
        );
        const childrenSnap = await getDocs(childrenQuery);
        childGearItems = childrenSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      }

      if (selectedListIds.length > 0) {
        await addGearItemToSelectedLists(selectedExistingId, { ...form, id: selectedExistingId }, childGearItems);
      }

      setNewlyCreatedId(selectedExistingId);
      const matched = allGear.find(g => g.id === selectedExistingId);
      setNewlyCreatedTag(matched?.assetTag || 'GEAR-UPDATED');
      setStep(3); // Go to success
      toast.success("Existing gear item successfully updated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update existing gear item.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredExistingGear = allGear.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.assetTag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-full md:h-auto max-h-[95vh] md:max-h-[90vh]"
      >
        {/* Header Block */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 md:px-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div>
            <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-neutral-900">
              {method === 'choose' ? 'Gear Onboarding Terminal' :
               method === 'ai_scan' ? 'AI Shutter Scan Onboarding' :
               method === 'existing' ? 'Update Existing Equipment' : 'Manual Gear Registration'}
            </h2>
            <p className="text-[10px] uppercase font-black tracking-widest text-neutral-400 mt-1">
              {method === 'choose' ? 'Select onboarding channel' : `Onboarding step ${step} of 3 • Custom QR Config`}
            </p>
          </div>
          <button 
            type="button" 
            onClick={handleClose} 
            className="p-2.5 hover:bg-neutral-100 rounded-xl transition text-neutral-400 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          
          {/* METHOD SELECTION (CHOOSE) */}
          {method === 'choose' && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto space-y-2">
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Log hardware, tools, and custom accessories inside your gear library. Assign custom QR codes, configure rentability indexes, and create bio passport sheets automatically.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-4">
                {/* Method 1: AI Shutter Scan */}
                <button
                  type="button"
                  onClick={() => setMethod('ai_scan')}
                  className="flex flex-col items-center p-6 border border-neutral-100 bg-neutral-50 hover:bg-neutral-50 hover:border-primary/30 rounded-3xl text-center transition group relative overflow-hidden"
                >
                  <div className="absolute top-2 right-2 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                    AI Power
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition">
                    <Camera size={20} className="animate-pulse" />
                  </div>
                  <h3 className="font-bold text-xs uppercase tracking-tight text-neutral-800">AI Shutter Scan</h3>
                  <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
                    Capture or upload photo. Gemini scans, identifies models, attributes, and fills metadata.
                  </p>
                </button>

                {/* Method 2: Manual Boarding */}
                <button
                  type="button"
                  onClick={() => setMethod('manual')}
                  className="flex flex-col items-center p-6 border border-neutral-100 bg-neutral-50 hover:bg-neutral-50 hover:border-black/20 rounded-3xl text-center transition group"
                >
                  <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                    <ListPlus size={20} />
                  </div>
                  <h3 className="font-bold text-xs uppercase tracking-tight text-neutral-800">Manual Entry</h3>
                  <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
                    Register item specifications, brand numbers, weight, value, and rentable profiles manually.
                  </p>
                </button>

                {/* Method 3: Update Existing */}
                <button
                  type="button"
                  onClick={() => setMethod('existing')}
                  className="flex flex-col items-center p-6 border border-neutral-100 bg-neutral-50 hover:bg-neutral-50 hover:border-neutral-400/50 rounded-3xl text-center transition group"
                >
                  <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                    <Layers size={20} />
                  </div>
                  <h3 className="font-bold text-xs uppercase tracking-tight text-neutral-800">Update Existing</h3>
                  <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
                    Select an asset in the current inventory. Edit specifications or link accessories/ancillaries.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* METHOD A: AI SHUTTER SCAN TRIGGER & FEEDBACK */}
          {method === 'ai_scan' && !scanSuccess && (
            <div className="space-y-6">
              <div className="bg-neutral-900 rounded-[2rem] p-6 text-white text-center space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-primary">Gemini Lens Recognition Engine</h3>
                <p className="text-xs text-neutral-300 max-w-sm mx-auto leading-relaxed">
                  Upload an equipment photo or choose a sample pre-loaded hardware item to simulate the real-time AI scanning pipeline.
                </p>

                <div className="flex flex-col items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAiPhotoPickerOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest transition flex items-center gap-2 shadow-md"
                  >
                    <Camera size={14} />
                    <span>Upload or Take Photo to Scan</span>
                  </button>

                  {scanImage && (
                    <button
                      type="button"
                      onClick={runAIScan}
                      disabled={scanning}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-widest transition flex items-center gap-1.5 shadow-md animate-bounce"
                    >
                      {scanning ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>{scanning ? 'Analyzing Image...' : 'Execute Scan Pipeline'}</span>
                    </button>
                  )}

                  {user && (
                    <AddPhotoWidget
                      isOpen={isAiPhotoPickerOpen}
                      onClose={() => setIsAiPhotoPickerOpen(false)}
                      onPhotoAdded={(urls) => {
                        if (urls.length > 0) {
                          setScanImage(urls[0]);
                          toast.success("Successfully loaded photo! You can now execute the AI Scan pipeline.");
                        }
                      }}
                      user={user}
                      adminSettings={adminSettings}
                      targetName="gear to scan"
                    />
                  )}
                </div>

                {/* Upload Preview */}
                {scanImage && (
                  <div className="mt-4 aspect-square max-h-48 bg-neutral-950 rounded-xl overflow-hidden inline-block relative border border-neutral-800 shadow-xl">
                    <img src={scanImage} alt="Scanning source" className="object-cover w-full h-full" />
                    <button
                      type="button"
                      onClick={() => setScanImage(null)}
                      className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-black transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Sample Preloaded Gear Section */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-black tracking-widest text-neutral-400">Or Simulation Samples (Testing & Review)</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {STOCK_GEAR_SAMPLES.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => simulateScan(idx)}
                      disabled={scanning}
                      className="flex items-center gap-3 p-3 border border-neutral-100 rounded-2xl hover:bg-neutral-50 hover:border-neutral-200 text-left transition"
                    >
                      <div className="h-10 w-10 bg-neutral-100 rounded-lg overflow-hidden shrink-0">
                        <img src={sample.img} alt={sample.name} className="object-cover h-full w-full" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[11px] text-neutral-800 truncate">{sample.name}</p>
                        <p className="text-[9px] uppercase tracking-wider text-neutral-400 mt-0.5">{sample.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* METHOD C: SELECT EXISTING GEAR */}
          {method === 'existing' && step === 1 && !selectedExistingId && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-3 text-neutral-400" size={18} />
                <input
                  type="text"
                  placeholder="Review current inventory list..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary text-sm transition"
                />
              </div>

              <div className="border border-neutral-100 rounded-2xl max-h-60 md:max-h-[480px] overflow-y-auto divide-y divide-neutral-100">
                {filteredExistingGear.length === 0 ? (
                  <p className="p-4 text-xs text-neutral-400 italic text-center">No matching gear records found.</p>
                ) : (
                  filteredExistingGear.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedExistingId(g.id);
                        setForm(g); // Hydrate editing details
                      }}
                      className="w-full flex items-center justify-between p-3.5 hover:bg-neutral-50 text-left transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-neutral-100 overflow-hidden shrink-0 border border-neutral-200">
                          <img src={g.photoUrls?.[0] || 'https://picsum.photos/seed/gear/100/100'} alt={g.name} className="object-cover h-full w-full" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-bold text-xs text-neutral-800">{g.name}</p>
                          <p className="text-[9px] font-mono text-neutral-400 mt-0.5">Tag: {g.assetTag} • {g.brand || 'No brand'}</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-neutral-400" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 1 FORM: METADATA & CHOOSE OPTIONAL ANCILLARIES */}
          {((method === 'manual') || 
            (method === 'ai_scan' && scanSuccess) || 
            (method === 'existing' && selectedExistingId)) && step === 1 && (
            <div className="space-y-6">
              
              {/* Photo Attachment & Link block */}
              <div className="bg-neutral-50 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-neutral-100/80 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Camera size={16} className="text-primary" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800">
                      Equipment Photo
                    </h4>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#0066cc]">Optional URL, upload or paste</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsManualPhotoPickerOpen(true)}
                      className="bg-primary hover:bg-primary/95 text-white py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 shadow-sm shrink-0 flex-1 sm:flex-none"
                    >
                      <Camera size={12} />
                      <span>Pick / Upload Photo</span>
                    </button>
                    {(form.photoUrls?.[0]) && (
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-neutral-200 bg-neutral-100 shadow-md relative group">
                        <img src={form.photoUrls[0]} alt="Gear Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, photoUrls: [] })}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="url"
                    placeholder="Paste direct photo URL (e.g. Unsplash, Imgur)..."
                    value={form.photoUrls?.[0] || ''}
                    onChange={(e) => setForm({ ...form, photoUrls: e.target.value ? [e.target.value] : [] })}
                    className="w-full sm:flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary transition text-neutral-800 font-medium placeholder-neutral-400"
                  />
                </div>

                {user && (
                  <AddPhotoWidget
                    isOpen={isManualPhotoPickerOpen}
                    onClose={() => setIsManualPhotoPickerOpen(false)}
                    onPhotoAdded={(urls) => {
                      if (urls.length > 0) {
                        setForm({ ...form, photoUrls: [urls[0]] });
                      }
                    }}
                    user={user}
                    adminSettings={adminSettings}
                    targetName={form.name || "gear"}
                  />
                )}
              </div>

              {/* Form specs */}
              <div className="grid sm:grid-cols-2 gap-4">
                
                {/* Gear Name */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Equipment / Item Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matches = allGear.filter(g => g.name && g.name.trim().toLowerCase() === val.trim().toLowerCase());
                      if (matches.length > 0) {
                        const existing = matches[0];
                        setForm({
                          ...form,
                          name: val,
                          brand: form.brand || existing.brand || '',
                          model: form.model || existing.model || '',
                          modelNumber: form.modelNumber || existing.modelNumber || '',
                          serialNumber: form.serialNumber || existing.serialNumber || '',
                          releaseYear: form.releaseYear || existing.releaseYear || '',
                          weight: form.weight || existing.weight || 0,
                          weightUnit: form.weightUnit || existing.weightUnit || 'g',
                          price: form.price || existing.price || 0,
                          description: form.description || existing.description || '',
                          rentalPrice: form.rentalPrice || existing.rentalPrice || 0,
                          currency: form.currency || existing.currency || '$',
                          rentalPeriod: form.rentalPeriod || existing.rentalPeriod || 'day',
                          secondaryCategories: form.secondaryCategories && form.secondaryCategories.length > 0 ? form.secondaryCategories : existing.secondaryCategories || []
                        });
                      } else {
                        setForm({ ...form, name: val });
                      }
                    }}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-xs transition"
                    placeholder="e.g. Sony FX3 Cinema Camera"
                  />
                </div>

                {/* Brand */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Brand Manufacturer</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-xs transition"
                    placeholder="e.g. Sony"
                  />
                </div>

                {/* Primary Category */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Primary Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value, primaryCategory: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-xs transition"
                  >
                    <option value="Camera">Camera</option>
                    <option value="Lens">Lens</option>
                    <option value="Audio">Audio</option>
                    <option value="Lighting">Lighting</option>
                    <option value="Drone">Drone / Aerial</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Support">Support / Grip</option>
                    <option value="Other">Other Ancillary</option>
                  </select>
                </div>

                {/* Serial Number */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Serial Number (Optional)</label>
                  <input
                    type="text"
                    value={form.serialNumber || ''}
                    onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-xs transition"
                    placeholder="e.g. SN1805908"
                  />
                </div>

                {/* Worth Price */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Replacement Value</label>
                  <input
                    type="number"
                    value={form.price || 0}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-xs transition"
                    placeholder="e.g. 3500"
                  />
                </div>

                {/* Condition */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Condition State</label>
                  <select
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value as any })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-xs transition"
                  >
                    <option value="new">New / Pristine</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor / Damaged</option>
                  </select>
                </div>

                {/* Tracking Strategy & Quantity Section */}
                <div className="sm:col-span-2 bg-neutral-50 p-4 rounded-3xl border border-neutral-100/55 space-y-4">
                  <div className="space-y-1.5">
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">
                        {trackingMode === 'serialized' ? 'Quantity of Copies to Deploy' : 'Quantity Owned'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.quantity || 1}
                        onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-primary transition"
                      />
                    </div>
                  </div>

                  {trackingMode === 'serialized' && (form.quantity || 1) > 1 && (
                    <div className="p-4 bg-white border border-dashed border-neutral-200 rounded-2xl space-y-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#0066cc] block">⚙️ Autogenerate Sequential Serials & Labels</span>
                      <p className="text-[9px] text-neutral-400 leading-normal">
                        We will compile and save <strong>{form.quantity}</strong> separate database items (e.g. <em>{form.name} [#1]</em> to <em>{form.name} [#{form.quantity}]</em>) each tracking distinct health metrics and QR lines.
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Serial Number Prefix (Optional)</label>
                          <input
                            type="text"
                            value={serialPrefix}
                            onChange={(e) => setSerialPrefix(e.target.value)}
                            placeholder="e.g. SN-FX6-"
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#0066cc]"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Starting Serial Number (Optional)</label>
                          <input
                            type="text"
                            value={serialStartNum}
                            onChange={(e) => setSerialStartNum(e.target.value)}
                            placeholder="e.g. 1001"
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#0066cc]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visibility setting */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Visibility & Accessibility</label>
                  <select
                    value={form.visibility || 'public'}
                    onChange={(e) => setForm({ ...form, visibility: e.target.value as 'public' | 'private' })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-xs transition"
                  >
                    <option value="public">🌐 Public (Accessible via QR scan and shareable listings)</option>
                    <option value="private">🔒 Private (Only you, locks out external lookups & scans)</option>
                  </select>
                  <p className="text-[9px] text-neutral-400 mt-0.5 leading-normal">
                    Check Private if this kit was prepped for a specific project, client, or individual who is setting up/planning a specific kit.
                  </p>
                </div>

                {/* Add Directly to Packing Lists */}
                <div className="sm:col-span-2 bg-neutral-50 p-4 rounded-3xl border border-neutral-100/55 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">📋 Add directly to Packing List(s)</label>
                    <span className="text-[9px] font-bold text-neutral-400 bg-neutral-100 px-2.5 py-0.5 rounded-full">
                      {selectedListIds.length} Selected
                    </span>
                  </div>
                  <p className="text-[9px] text-neutral-400 leading-normal">
                    Select existing checklists or project manifest sheets to automatically insert this equipment into them during onboarding.
                  </p>
                  
                  {packingLists.length === 0 ? (
                    <div className="text-center py-4 bg-white rounded-2xl border border-dashed border-neutral-200">
                      <p className="text-[10px] text-neutral-400 font-medium">No existing packing lists found.</p>
                      <button
                        type="button"
                        onClick={() => {
                          handleClose();
                          navigate('/dashboard?createList=true');
                        }}
                        className="text-[9px] text-primary font-black uppercase tracking-wider mt-1 hover:underline cursor-pointer"
                      >
                        Create your first list
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto bg-white border border-neutral-200 rounded-2xl divide-y divide-neutral-100 p-1 space-y-1 scrollbar-thin">
                      {packingLists.map((list) => {
                        const isChecked = selectedListIds.includes(list.id);
                        return (
                          <label
                            key={list.id}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                              isChecked ? 'bg-neutral-50 font-bold' : 'hover:bg-neutral-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedListIds(prev =>
                                    prev.includes(list.id)
                                      ? prev.filter(id => id !== list.id)
                                      : [...prev, list.id]
                                  );
                                }}
                                className="h-4 w-4 text-primary border-neutral-300 rounded focus:ring-transparent cursor-pointer"
                              />
                              <div>
                                <span className="text-xs text-neutral-800 line-clamp-1">{list.name}</span>
                                {list.description && (
                                  <span className="text-[9px] text-neutral-400 line-clamp-1 font-normal mt-0.5">{list.description}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-[9px] text-neutral-400 font-mono">
                              {list.stage === 'proposed' ? 'Draft' : 'Active'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* CONTEXTUAL ACCESSORIES & ANCILLARIES ROW */}
              {method !== 'existing' && (
                <div className="bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100 space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                    <div className="flex items-center gap-2">
                      <ListPlus size={16} className="text-primary" />
                      <h4 className="text-xs font-black uppercase tracking-widest text-neutral-800">
                        Gear Optional Accessories & Ancillaries
                      </h4>
                    </div>
                    <span className="text-[9px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {(form.addOns || []).length} Added
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-normal">
                    Some gear items come bare. Select recommended presets below, or enter custom accessories, consumables, hardware attachments, or software add-ons manually!
                  </p>

                  {/* Preset Quick-Add buttons */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-black tracking-widest text-neutral-400 block">⚡ Tap Recommended Presets to Add:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {getRecommendedAccessoryList().map((accName) => {
                        const alreadyAdded = (form.addOns || []).some(a => a.name === accName);
                        return (
                          <button
                            key={accName}
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => {
                              const newAnc = {
                                name: accName,
                                type: 'Accessory' as const,
                                price: 0,
                                notes: 'Recommended Preset Option'
                              };
                              setForm(prev => ({
                                ...prev,
                                addOns: [...(prev.addOns || []), newAnc]
                              }));
                              toast.success(`Added preset: "${accName}"`);
                            }}
                            className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              alreadyAdded
                                ? 'bg-neutral-100 text-neutral-400 border-neutral-100 cursor-not-allowed'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:scale-[1.02]'
                            }`}
                          >
                            <span>+</span>
                            <span>{accName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Manual Ancillary Creator Form */}
                  <div className="bg-white p-4 rounded-2xl border border-neutral-200 space-y-3">
                    <span className="text-[9px] uppercase font-black text-neutral-700 tracking-widest block">➕ Add Ancillary Component Manually:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[8px] uppercase font-bold text-neutral-400 block mb-1">Ancillary Name</label>
                        <input
                          type="text"
                          value={tempAncillaryName}
                          onChange={(e) => setTempAncillaryName(e.target.value)}
                          placeholder="e.g. Cinema Rig / 128GB Card / software license"
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="text-[8px] uppercase font-bold text-neutral-400 block mb-1">Classification Type</label>
                        <select
                          value={tempAncillaryType}
                          onChange={(e) => setTempAncillaryType(e.target.value as any)}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="Organizer">🎒 Organizer (pouch, bag, rack, etc.)</option>
                          <option value="Accessory">🕶️ Accessory</option>
                          <option value="Consumable">🔋 Consumable (Battery, Cards, etc.)</option>
                          <option value="Attachment">⛓️ Attachment (Rig, mount, lens)</option>
                          <option value="Add On">🔌 Add On</option>
                          <option value="Software">💿 Software / License</option>
                          <option value="Mod">🔧 Custom Mod</option>
                          <option value="Other">📦 Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[8px] uppercase font-bold text-neutral-400 block mb-1">Rate / Value ({form.currency || '$'})</label>
                        <input
                          type="number"
                          value={tempAncillaryPrice}
                          onChange={(e) => setTempAncillaryPrice(e.target.value)}
                          placeholder="0 for free"
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="text-[8px] uppercase font-bold text-neutral-400 block mb-1">Ancillary Notes (Optional)</label>
                        <input
                          type="text"
                          value={tempAncillaryNotes}
                          onChange={(e) => setTempAncillaryNotes(e.target.value)}
                          placeholder="e.g. brand, speed, or version"
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!tempAncillaryName.trim()) {
                            toast.error("Please enter an ancillary name!");
                            return;
                          }
                          const priceVal = parseFloat(tempAncillaryPrice) || 0;
                          const newAnc = {
                            name: tempAncillaryName.trim(),
                            type: tempAncillaryType,
                            price: priceVal,
                            notes: tempAncillaryNotes.trim() || undefined
                          };
                          setForm(prev => ({
                            ...prev,
                            addOns: [...(prev.addOns || []), newAnc]
                          }));
                          setTempAncillaryName('');
                          setTempAncillaryNotes('');
                          setTempAncillaryPrice('0');
                          toast.success(`Added custom ${tempAncillaryType} ancillary!`);
                        }}
                        className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Add to List</span>
                      </button>
                    </div>
                  </div>

                  {/* Currently Active Ancillaries List */}
                  {form.addOns && form.addOns.length > 0 && (
                    <div className="border border-neutral-200 rounded-2xl bg-white divide-y divide-neutral-100 overflow-hidden">
                      {form.addOns.map((anc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-neutral-800">{anc.name}</span>
                              <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full">
                                {anc.type || 'Accessory'}
                              </span>
                            </div>
                            {anc.notes && (
                              <span className="text-[9px] text-neutral-400 italic">Notes: {anc.notes}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-emerald-600 text-[11px]">
                              {anc.price === 0 ? 'FREE' : formatCurrency(anc.price, form.currency || 'USD')}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const list = form.addOns || [];
                                setForm(prev => ({
                                  ...prev,
                                  addOns: list.filter((_, i) => i !== idx)
                                }));
                                toast.success("Ancillary removed");
                              }}
                              className="p-1 hover:bg-neutral-50 rounded-lg text-neutral-400 hover:text-red-500 transition"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Description bio and AI Tip */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Description Bio (Optional)</label>
                <textarea
                  rows={2}
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Enter custom specifications or description context..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary transition"
                />
              </div>

              {form.organizationTip && (
                <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex gap-2">
                  <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] italic text-amber-700 leading-normal">
                    <span className="font-bold font-sans not-italic">AI Advice: </span>
                    "{form.organizationTip}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: RENTABILITY & MARKETPLACE PILLARS */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center max-w-sm mx-auto space-y-1">
                <ShieldCheck className="text-emerald-500 mx-auto" size={32} />
                <h3 className="font-black uppercase text-sm tracking-widest text-neutral-800">Rentability & Marketplace Setup</h3>
                <p className="text-[10px] text-neutral-400">
                  Secure your hardware in the rental pool. List pricing structures and instantly render checkout agreements.
                </p>
              </div>

              <div className="bg-neutral-900 rounded-[2.5rem] p-6 text-white space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h4 className="font-black uppercase text-xs tracking-wider text-white">Enable Equipment Rental Profile</h4>
                    <p className="text-[9px] text-neutral-400">Allows other users to view and reserve this asset.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.secondaryCategories?.includes('Rentable') || false}
                    onChange={(e) => {
                      const list = form.secondaryCategories || [];
                      const updated = e.target.checked 
                        ? [...list, 'Rentable']
                        : list.filter(c => c !== 'Rentable');
                      setForm({ 
                        ...form, 
                        secondaryCategories: updated,
                        isAvailableForRent: e.target.checked
                      });
                    }}
                    className="h-5 w-5 text-primary border-neutral-700 rounded bg-neutral-800 focus:ring-transparent cursor-pointer"
                  />
                </div>

                {form.secondaryCategories?.includes('Rentable') ? (
                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Rental Price / Hour</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2 text-xs font-bold text-neutral-300">{form.currency || '$'}</span>
                        <input
                          type="number"
                          value={form.rentalHourlyPrice || ''}
                          onChange={(e) => setForm({ ...form, rentalHourlyPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-primary transition text-white"
                          placeholder="e.g. 10"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Rental Price / Day</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2 text-xs font-bold text-neutral-300">{form.currency || '$'}</span>
                        <input
                          type="number"
                          value={form.rentalPrice || ''}
                          onChange={(e) => setForm({ ...form, rentalPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-primary transition text-white"
                          placeholder="e.g. 45"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Booking Security Deposit</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2 text-xs font-bold text-neutral-300">{form.currency || '$'}</span>
                        <input
                          type="number"
                          value={form.rentalDeposit || ''}
                          onChange={(e) => setForm({ ...form, rentalDeposit: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-primary transition text-white"
                          placeholder="e.g. 150"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Currency Unit</label>
                      <select
                        value={form.currency || '$'}
                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary transition text-white"
                      >
                        <option value="$">USD ($)</option>
                        <option value="€">EUR (€)</option>
                        <option value="£">GBP (£)</option>
                        <option value="A$">AUD (A$)</option>
                        <option value="FJD">FJD (FJD)</option>
                      </select>
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-[9px] uppercase font-black tracking-widest text-neutral-400 text-neutral-400">Rental Policy</label>
                      <select
                        value={form.rentalPeriod || 'day'}
                        onChange={(e) => setForm({ ...form, rentalPeriod: e.target.value as any })}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary transition text-white"
                      >
                        <option value="day">Instant Booking (Auto-accept reservation contracts)</option>
                        <option value="week">Manual verification (Host verification and signature required)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-neutral-500 italic text-center py-2">
                    Enable the toggle checkbox above to configure rental and marketplace parameters.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS & CUSTOM QR CODE VIEW CARDS */}
          {step === 3 && newlyCreatedId && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <CheckCircle2 className="text-emerald-500 mx-auto" size={48} />
                <h3 className="font-black uppercase tracking-tighter text-lg text-neutral-800">
                  Equipment successfully onboarded!
                </h3>
                <p className="text-[10px] text-neutral-400 max-w-sm mx-auto leading-normal">
                  Custom identification passport created. Code is ready for print labels and live logs.
                </p>
              </div>

              {/* Visual Ticket Tag with QR Code */}
              <div id="onboarded-tag-print-container" className="border border-neutral-150 rounded-[2rem] p-6 bg-gradient-to-tr from-stone-50 via-white to-stone-50/50 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md border-neutral-100">
                <div className="space-y-2 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-1.5">
                    <QrCode size={16} className="text-primary animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-800">QR Asset Tag Passport</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-neutral-900 uppercase leading-none truncate max-w-xs">{form.name}</h4>
                  <p className="text-[9px] text-neutral-400 mt-0.5">Asset ID: <span className="font-mono font-bold select-all text-neutral-700">{newlyCreatedTag}</span></p>

                  <div className="pt-2 flex flex-wrap gap-2 justify-center md:justify-start print-hidden">
                    <button
                      onClick={handlePrintIndividualTag}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-800 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition"
                    >
                      <Printer size={10} />
                      <span>Print Label</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate(`/gear/${newlyCreatedId}`);
                        handleClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-neutral-800 transition"
                    >
                      <Ticket size={10} />
                      <span>View Bio Page</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-neutral-100 shadow-md">
                  <QRCodeCanvas 
                    value={`${window.location.origin}/gear/${newlyCreatedId}?owner=${user?.uid || ''}`}
                    size={100}
                    level="Q"
                  />
                  <p className="text-[8px] font-mono text-center font-bold text-neutral-400 mt-2 tracking-widest">
                    {newlyCreatedTag}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-4 sm:p-5 md:px-8 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div>
            {method !== 'choose' && step !== 3 && (
              <button 
                type="button"
                onClick={() => {
                  if (step === 2) {
                    setStep(1);
                  } else {
                    setMethod('choose');
                    setScanSuccess(false);
                  }
                }}
                className="text-neutral-500 hover:text-neutral-900 font-bold text-xs uppercase"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-neutral-600 hover:bg-neutral-100 transition"
            >
              {step === 3 ? 'Close' : 'Cancel'}
            </button>

            {method !== 'choose' && step === 1 && (
              <button
                type="button"
                disabled={method === 'existing' ? !selectedExistingId : !form.name?.trim()}
                onClick={() => setStep(2)}
                className="bg-black hover:bg-neutral-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition"
              >
                Next (Rental Setup)
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                disabled={saving}
                onClick={method === 'existing' ? saveExistingGearUpdate : saveGearItem}
                className="bg-primary hover:bg-primary/95 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-1"
              >
                {saving && <RefreshCw size={12} className="animate-spin" />}
                <span>{saving ? 'Onboarding...' : 'Onboard & Generate QR'}</span>
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
