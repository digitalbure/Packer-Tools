import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Search, 
  Plus, 
  ExternalLink, 
  Ruler, 
  Weight as WeightIcon, 
  Info, 
  Globe,
  Copy,
  Check,
  Trash2,
  Edit3,
  Shield,
  Maximize2,
  Layers,
  Plane,
  CheckCircle2,
  Sparkles,
  X,
  Grid,
  List,
  SlidersHorizontal,
  ArrowRight,
  Package
} from 'lucide-react';
import { CaseModel, AdminSettings, UserProfile, Container } from '../types';
import { toast } from 'sonner';
import { extractCaseDimensions, ExtractedCaseDetails } from '../services/geminiService';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { canUseAI, trackAIUsage } from '../lib/limitUtils';
import { motion, AnimatePresence } from 'motion/react';

const PRELOADED_CASES: CaseModel[] = [
  {
    id: 'p-1510',
    brand: 'Pelican',
    model: '1510 Protector Carry-On Case',
    formFactor: 'Carry-On',
    foamType: 'Padded Dividers',
    interiorDimensions: { length: 50.2, width: 27.9, height: 19.3, unit: 'cm' },
    exteriorDimensions: { length: 55.9, width: 35.1, height: 22.9, unit: 'cm' },
    lidDepth: 4.5,
    baseDepth: 14.8,
    weight: 6.2,
    weightUnit: 'kg',
    hasWheels: true,
    hasTsaLock: false,
    isCarryOnCompliant: true,
    url: 'https://www.pelican.com/us/en/product/cases/protector/1510',
    description: 'The industry-standard flight carry-on hard case with double-throw latches and quiet wheels.',
    photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p-1535',
    brand: 'Pelican',
    model: '1535 Air Carry-On Case',
    formFactor: 'Carry-On',
    foamType: 'TrekPak',
    interiorDimensions: { length: 51.8, width: 28.4, height: 18.3, unit: 'cm' },
    exteriorDimensions: { length: 55.8, width: 35.5, height: 22.8, unit: 'cm' },
    lidDepth: 5.1,
    baseDepth: 13.2,
    weight: 3.9,
    weightUnit: 'kg',
    hasWheels: true,
    hasTsaLock: false,
    isCarryOnCompliant: true,
    url: 'https://www.pelican.com/us/en/product/cases/air/1535',
    description: 'Up to 40% lighter than standard Pelican protector cases using proprietary HPX2 super-light resin.',
    photoUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'pd-45l',
    brand: 'Peak Design',
    model: 'Travel Backpack 45L',
    formFactor: 'Backpack',
    foamType: 'Padded Packing Cubes',
    interiorDimensions: { length: 51.0, width: 33.0, height: 24.0, unit: 'cm' },
    exteriorDimensions: { length: 56.0, width: 34.0, height: 29.0, unit: 'cm' },
    lidDepth: 4.0,
    baseDepth: 20.0,
    weight: 2.05,
    weightUnit: 'kg',
    hasWheels: false,
    hasTsaLock: false,
    isCarryOnCompliant: true,
    url: 'https://www.peakdesign.com/products/travel-backpack',
    description: 'Rugged 100% recycled 900D nylon weather-proof camera and gear transport backpack with rear access.',
    photoUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'lp-450',
    brand: 'Lowepro',
    model: 'ProTactic BP 450 AW II',
    formFactor: 'Backpack',
    foamType: 'FormShell / SlipLock',
    interiorDimensions: { length: 44.0, width: 30.0, height: 16.0, unit: 'cm' },
    exteriorDimensions: { length: 52.0, width: 36.0, height: 22.0, unit: 'cm' },
    lidDepth: 3.0,
    baseDepth: 13.0,
    weight: 2.84,
    weightUnit: 'kg',
    hasWheels: false,
    hasTsaLock: false,
    isCarryOnCompliant: true,
    url: 'https://www.lowepro.com',
    description: 'Pro-grade high-capacity camera backpack with 4-point access, armored top shell, and modular utility loops.',
    photoUrl: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'gat-4u',
    brand: 'Gator',
    model: 'GR-4L 4U Rack Case',
    formFactor: 'Rack Case',
    foamType: 'Threaded Steel Rack Rails',
    interiorDimensions: { length: 48.3, width: 41.9, height: 17.8, unit: 'cm' },
    exteriorDimensions: { length: 57.8, width: 54.6, height: 24.1, unit: 'cm' },
    lidDepth: 6.0,
    baseDepth: 11.8,
    weight: 5.4,
    weightUnit: 'kg',
    hasWheels: false,
    hasTsaLock: false,
    isCarryOnCompliant: false,
    url: 'https://gatorco.com',
    description: 'High-density polyethylene 4U rack enclosure for audio processors, radio receivers, and server equipment.',
    photoUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'skb-6u',
    brand: 'SKB',
    model: '19" 6U Shockmount Rack',
    formFactor: 'Rack Case',
    foamType: 'Elastomer Shock Isolators',
    interiorDimensions: { length: 48.3, width: 50.8, height: 26.7, unit: 'cm' },
    exteriorDimensions: { length: 72.0, width: 61.0, height: 38.0, unit: 'cm' },
    lidDepth: 8.0,
    baseDepth: 18.7,
    weight: 16.8,
    weightUnit: 'kg',
    hasWheels: true,
    hasTsaLock: false,
    isCarryOnCompliant: false,
    url: 'https://www.skbcases.com',
    description: 'Heavy tour-duty military specification 6U rack enclosure with internal shock-isolated steel frame.',
    photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p-1650',
    brand: 'Pelican',
    model: '1650 Protector Case',
    formFactor: 'Large Wheeled',
    foamType: 'Padded Dividers',
    interiorDimensions: { length: 72.5, width: 44.5, height: 27.1, unit: 'cm' },
    exteriorDimensions: { length: 80.2, width: 52.0, height: 31.6, unit: 'cm' },
    lidDepth: 4.7,
    baseDepth: 22.4,
    weight: 12.7,
    weightUnit: 'kg',
    hasWheels: true,
    hasTsaLock: false,
    isCarryOnCompliant: false,
    url: 'https://www.pelican.com/us/en/product/cases/protector/1650',
    description: 'Heavy-duty large transport case featuring 4 strong polyurethane wheels with stainless steel bearings.',
    photoUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'n-935',
    brand: 'Nanuk',
    model: '935 Wheeled Carry-On',
    formFactor: 'Carry-On',
    foamType: 'Padded Dividers',
    interiorDimensions: { length: 52.1, width: 28.7, height: 19.1, unit: 'cm' },
    exteriorDimensions: { length: 55.9, width: 35.6, height: 22.9, unit: 'cm' },
    lidDepth: 5.3,
    baseDepth: 13.8,
    weight: 5.2,
    weightUnit: 'kg',
    hasWheels: true,
    hasTsaLock: true,
    isCarryOnCompliant: true,
    url: 'https://nanuk.com/products/nanuk-935',
    description: 'Impact-resistant NK-7 resin body with PowerClaw triple action locking system.',
    photoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'n-960',
    brand: 'Nanuk',
    model: '960 Deep Trunk Case',
    formFactor: 'Trunk',
    foamType: 'Pick N Pluck',
    interiorDimensions: { length: 55.9, width: 43.2, height: 32.8, unit: 'cm' },
    exteriorDimensions: { length: 64.5, width: 50.8, height: 36.8, unit: 'cm' },
    lidDepth: 5.3,
    baseDepth: 27.5,
    weight: 8.7,
    weightUnit: 'kg',
    hasWheels: true,
    hasTsaLock: true,
    isCarryOnCompliant: false,
    url: 'https://nanuk.com/products/nanuk-960',
    description: 'Extra deep protective trunk designed for camera bodies, lighting heads, and heavy instruments.',
    photoUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'ap-4800',
    brand: 'Apache',
    model: '4800 Weatherproof Case',
    formFactor: 'Medium Utility',
    foamType: 'Pick N Pluck',
    interiorDimensions: { length: 45.4, width: 32.7, height: 17.5, unit: 'cm' },
    exteriorDimensions: { length: 48.8, width: 38.6, height: 20.1, unit: 'cm' },
    lidDepth: 4.2,
    baseDepth: 13.3,
    weight: 4.3,
    weightUnit: 'kg',
    hasWheels: false,
    hasTsaLock: false,
    isCarryOnCompliant: true,
    url: 'https://www.harborfreight.com/4800-weatherproof-protective-case-x-large-64250.html',
    description: 'IP65 rated water-resistant protective utility case with dual locking latches.',
    photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'skb-2011',
    brand: 'SKB',
    model: 'iSeries 2011-7 Carry-On Case',
    formFactor: 'Carry-On',
    foamType: 'Think Tank Designed Dividers',
    interiorDimensions: { length: 51.8, width: 28.9, height: 19.1, unit: 'cm' },
    exteriorDimensions: { length: 56.1, width: 35.5, height: 22.8, unit: 'cm' },
    lidDepth: 5.1,
    baseDepth: 14.0,
    weight: 5.1,
    weightUnit: 'kg',
    hasWheels: true,
    hasTsaLock: true,
    isCarryOnCompliant: true,
    url: 'https://www.skbcases.com',
    description: 'Injection molded waterproof case featuring high-density foam and Think Tank photo divider inserts.',
    photoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
  }
];

export default function TravelCaseModule({ user, adminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('All');
  const [formFactorFilter, setFormFactorFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [customCases, setCustomCases] = useState<CaseModel[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  // Modals
  const [extractedPreview, setExtractedPreview] = useState<ExtractedCaseDetails | null>(null);
  const [selectedCaseModal, setSelectedCaseModal] = useState<CaseModel | null>(null);
  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);

  // Custom Case Form State
  const [customForm, setCustomForm] = useState({
    brand: 'Pelican',
    model: '',
    formFactor: 'Carry-On',
    foamType: 'Padded Dividers',
    intLength: 50,
    intWidth: 30,
    intHeight: 20,
    intUnit: 'cm' as 'cm' | 'in',
    extLength: 55,
    extWidth: 35,
    extHeight: 23,
    extUnit: 'cm' as 'cm' | 'in',
    weight: 5.0,
    weightUnit: 'kg' as 'kg' | 'lb',
    hasWheels: true,
    hasTsaLock: false,
    isCarryOnCompliant: true,
    url: '',
    description: '',
    photoUrl: ''
  });

  const smartPackerName = adminSettings?.aiConfig?.smartPackerName || 'Smart Packer';

  // Real-time Firestore sync for user custom cases
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'cases'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const casesData: CaseModel[] = [];
      snapshot.forEach((docSnap) => {
        casesData.push({ id: docSnap.id, ...docSnap.data() } as CaseModel);
      });
      setCustomCases(casesData);
    }, (err) => {
      console.warn('Firestore cases snapshot listener notice:', err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Combined All Cases
  const allCases = [...customCases, ...PRELOADED_CASES];

  // Filtering
  const filteredCases = allCases.filter(c => {
    const matchesSearch = 
      c.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.foamType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.formFactor || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBrand = brandFilter === 'All' || c.brand.toLowerCase() === brandFilter.toLowerCase();
    const matchesForm = formFactorFilter === 'All' || (c.formFactor || '').toLowerCase().includes(formFactorFilter.toLowerCase());

    return matchesSearch && matchesBrand && matchesForm;
  });

  // Calculate volume in liters L = (L * W * H) / 1000 for cm
  const calculateVolumeLiters = (intDims?: { length: number; width: number; height: number; unit: string }) => {
    if (!intDims || !intDims.length || !intDims.width || !intDims.height) return 0;
    let { length, width, height, unit } = intDims;
    if (unit === 'in') {
      // convert to cm first (1 in = 2.54 cm)
      length *= 2.54;
      width *= 2.54;
      height *= 2.54;
    }
    const cm3 = length * width * height;
    return Math.round((cm3 / 1000) * 10) / 10; // Liters
  };

  // Stats calculation
  const carryOnCount = allCases.filter(c => c.isCarryOnCompliant).length;
  const totalVolume = allCases.reduce((acc, c) => acc + calculateVolumeLiters(c.interiorDimensions), 0);
  const avgWeight = Math.round((allCases.reduce((acc, c) => acc + (c.weightUnit === 'lb' ? c.weight * 0.453592 : c.weight), 0) / (allCases.length || 1)) * 10) / 10;

  // URL Extract Trigger
  const handleUrlExtract = async (overrideUrl?: string) => {
    const targetUrl = overrideUrl || urlInput;
    if (!targetUrl) {
      toast.error('Please enter a case product URL or keyword');
      return;
    }

    const aiCheck = await canUseAI(user, adminSettings);
    if (!aiCheck.allowed) {
      toast.error(aiCheck.reason);
      return;
    }

    setIsExtracting(true);
    try {
      const data = await extractCaseDimensions(targetUrl);
      await trackAIUsage(user.uid);
      setExtractedPreview(data);
      toast.success(`${smartPackerName} extracted case specs! Review and save below.`);
    } catch (error) {
      console.error("URL extraction error:", error);
      toast.error(`${smartPackerName} failed to extract case data from URL.`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Save Extracted Case to Firestore
  const handleSaveExtracted = async (andCreateContainer = false) => {
    if (!extractedPreview) return;
    try {
      const intDims = {
        length: Number(extractedPreview.interiorDimensions.length || 0),
        width: Number(extractedPreview.interiorDimensions.width || 0),
        height: Number(extractedPreview.interiorDimensions.height || 0),
        unit: (extractedPreview.interiorDimensions.unit === 'in' ? 'in' : 'cm') as 'cm' | 'in'
      };

      const extDims = extractedPreview.exteriorDimensions ? {
        length: Number(extractedPreview.exteriorDimensions.length || 0),
        width: Number(extractedPreview.exteriorDimensions.width || 0),
        height: Number(extractedPreview.exteriorDimensions.height || 0),
        unit: (extractedPreview.exteriorDimensions.unit === 'in' ? 'in' : 'cm') as 'cm' | 'in'
      } : undefined;

      const newCase: Omit<CaseModel, 'id'> = {
        ownerId: user.uid,
        brand: extractedPreview.brand,
        model: extractedPreview.model,
        formFactor: extractedPreview.formFactor || 'Carry-On',
        foamType: extractedPreview.foamType || 'Padded Dividers',
        interiorDimensions: intDims,
        exteriorDimensions: extDims,
        lidDepth: extractedPreview.lidDepth,
        baseDepth: extractedPreview.baseDepth,
        weight: extractedPreview.weight,
        weightUnit: (extractedPreview.weightUnit === 'lb' ? 'lb' : 'kg') as 'kg' | 'lb',
        hasWheels: extractedPreview.hasWheels ?? true,
        hasTsaLock: extractedPreview.hasTsaLock ?? false,
        isCarryOnCompliant: extractedPreview.isCarryOnCompliant ?? true,
        url: urlInput || extractedPreview.photoUrl || '',
        description: extractedPreview.description,
        photoUrl: extractedPreview.photoUrl,
        createdAt: new Date().toISOString()
      };

      const caseRef = await addDoc(collection(db, 'cases'), newCase);

      if (andCreateContainer) {
        const brandLower = (extractedPreview.brand || '').toLowerCase();
        const formLower = (extractedPreview.formFactor || '').toLowerCase();
        const containerType: Container['type'] = 
          brandLower.includes('pelican') ? 'pelican' :
          brandLower.includes('nanuk') ? 'nanuk' :
          formLower.includes('backpack') || formLower.includes('bag') ? 'bag' :
          formLower.includes('rack') ? 'locker' :
          'case';

        await addDoc(collection(db, 'users', user.uid, 'containers'), {
          ownerId: user.uid,
          name: `${extractedPreview.brand} ${extractedPreview.model}`,
          type: containerType,
          qrCode: `CASE-${Date.now().toString().slice(-6)}`,
          location: 'Main Warehouse',
          weightLimit: 30,
          weightUnit: extractedPreview.weightUnit || 'kg',
          dimensions: intDims,
          notes: `Created from ${smartPackerName} case extractor.`,
          items: [],
          createdAt: new Date().toISOString()
        });
        toast.success(`Saved case & deployed new Container to your Packing workspace!`);
      } else {
        toast.success(`Successfully saved ${extractedPreview.brand} ${extractedPreview.model} to your cases!`);
      }

      setExtractedPreview(null);
      setUrlInput('');
    } catch (e: any) {
      toast.error(`Failed to save case: ${e.message}`);
    }
  };

  // Save Manual Custom Case
  const handleSaveCustomCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customForm.model) {
      toast.error('Please enter a case model name');
      return;
    }

    try {
      const newCase: Omit<CaseModel, 'id'> = {
        ownerId: user.uid,
        brand: customForm.brand,
        model: customForm.model,
        formFactor: customForm.formFactor,
        foamType: customForm.foamType,
        interiorDimensions: {
          length: Number(customForm.intLength),
          width: Number(customForm.intWidth),
          height: Number(customForm.intHeight),
          unit: customForm.intUnit
        },
        exteriorDimensions: {
          length: Number(customForm.extLength),
          width: Number(customForm.extWidth),
          height: Number(customForm.extHeight),
          unit: customForm.extUnit
        },
        weight: Number(customForm.weight),
        weightUnit: customForm.weightUnit,
        hasWheels: customForm.hasWheels,
        hasTsaLock: customForm.hasTsaLock,
        isCarryOnCompliant: customForm.isCarryOnCompliant,
        url: customForm.url,
        description: customForm.description,
        photoUrl: customForm.photoUrl,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'cases'), newCase);
      toast.success(`Added custom case: ${customForm.brand} ${customForm.model}`);
      setIsAddCustomModalOpen(false);
      // reset form
      setCustomForm({
        brand: 'Pelican',
        model: '',
        formFactor: 'Carry-On',
        foamType: 'Padded Dividers',
        intLength: 50,
        intWidth: 30,
        intHeight: 20,
        intUnit: 'cm',
        extLength: 55,
        extWidth: 35,
        extHeight: 23,
        extUnit: 'cm',
        weight: 5.0,
        weightUnit: 'kg',
        hasWheels: true,
        hasTsaLock: false,
        isCarryOnCompliant: true,
        url: '',
        description: '',
        photoUrl: ''
      });
    } catch (err: any) {
      toast.error(`Failed to add custom case: ${err.message}`);
    }
  };

  // Deploy Case as Container
  const handleDeployContainer = async (caseModel: CaseModel) => {
    try {
      const brandLower = caseModel.brand.toLowerCase();
      const formLower = (caseModel.formFactor || '').toLowerCase();
      const containerType: Container['type'] = 
        brandLower.includes('pelican') ? 'pelican' :
        brandLower.includes('nanuk') ? 'nanuk' :
        formLower.includes('backpack') || formLower.includes('bag') ? 'bag' :
        formLower.includes('rack') ? 'locker' :
        'case';

      const newContainer: Omit<Container, 'id'> = {
        ownerId: user.uid,
        name: `${caseModel.brand} ${caseModel.model}`,
        type: containerType,
        qrCode: `CASE-${Date.now().toString().slice(-6)}`,
        location: 'Gear Hub',
        weightLimit: 35,
        weightUnit: caseModel.weightUnit,
        dimensions: caseModel.interiorDimensions,
        notes: `Deployed from Travel Case Spec Sheet (${caseModel.brand}).`,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'users', user.uid, 'containers'), newContainer);
      toast.success(`Deployed ${caseModel.brand} ${caseModel.model} as an active Container in your workspace!`);
    } catch (e: any) {
      toast.error(`Container deployment failed: ${e.message}`);
    }
  };

  // Copy specs
  const handleCopySpecs = (c: CaseModel) => {
    const text = `${c.brand} ${c.model}\nInterior: ${c.interiorDimensions.length}x${c.interiorDimensions.width}x${c.interiorDimensions.height} ${c.interiorDimensions.unit}\nExterior: ${c.exteriorDimensions?.length || '-'}x${c.exteriorDimensions?.width || '-'}x${c.exteriorDimensions?.height || '-'} ${c.exteriorDimensions?.unit || c.interiorDimensions.unit}\nVolume: ${calculateVolumeLiters(c.interiorDimensions)}L\nTare Weight: ${c.weight} ${c.weightUnit}\nCarry-On: ${c.isCarryOnCompliant ? 'Yes' : 'No'}`;
    navigator.clipboard.writeText(text);
    toast.success('Case specification copied to clipboard!');
  };

  // Delete Custom Case
  const handleDeleteCase = async (caseId: string, modelName: string) => {
    if (!confirm(`Delete ${modelName} from your custom case library?`)) return;
    try {
      await deleteDoc(doc(db, 'cases', caseId));
      toast.success(`Deleted ${modelName}`);
      if (selectedCaseModal?.id === caseId) setSelectedCaseModal(null);
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-neutral-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider">
            <Sparkles size={14} />
            <span>AI-Powered Spec Logistics</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900 flex items-center gap-3">
            <Box className="text-primary" size={36} />
            <span>{smartPackerName} Travel Cases & Case Library</span>
          </h1>
          <p className="text-sm md:text-base text-neutral-500 max-w-2xl">
            Extract case dimensions instantly from web URLs, visualize volumetric blueprints, check airline carry-on limits, and deploy containers directly into your packing lists.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={() => setIsAddCustomModalOpen(true)}
            className="px-5 py-3.5 bg-neutral-900 text-white rounded-2xl font-bold text-sm hover:bg-neutral-800 transition shadow-lg flex items-center gap-2 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Add Custom Case</span>
          </button>
        </div>
      </header>

      {/* Analytics Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-100 text-neutral-800 rounded-xl flex items-center justify-center font-black">
            <Box size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Total Fleet Cases</p>
            <p className="text-2xl font-black text-neutral-900">{allCases.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black">
            <Plane size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Carry-On Approved</p>
            <p className="text-2xl font-black text-emerald-600">{carryOnCount} <span className="text-xs font-normal text-neutral-400">cases</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
            <Maximize2 size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Total Internal Volume</p>
            <p className="text-2xl font-black text-blue-600">{Math.round(totalVolume)} <span className="text-xs font-normal text-neutral-400">Liters</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-black">
            <WeightIcon size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Avg. Empty Tare Weight</p>
            <p className="text-2xl font-black text-amber-600">{avgWeight} <span className="text-xs font-normal text-neutral-400">kg</span></p>
          </div>
        </div>
      </div>

      {/* Smart Extractor Section */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 rounded-l-full blur-2xl pointer-events-none" />
        
        <div className="max-w-3xl space-y-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
              <Globe size={22} />
            </div>
            <div>
              <h3 className="text-2xl font-black">{smartPackerName} URL & Case Extractor</h3>
              <p className="text-xs text-neutral-400">Paste any retailer or brand product link (Pelican, Nanuk, SKB, Apache, B&H, etc.) to extract full specs automatically.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="https://www.pelican.com/us/en/product/cases/air/1535 or Pelican 1535 Air..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlExtract()}
                className="w-full bg-neutral-800/90 border border-neutral-700/80 text-white rounded-2xl pl-4 pr-10 py-4 outline-none focus:ring-2 focus:ring-primary transition text-sm"
              />
              {urlInput && (
                <button
                  onClick={() => setUrlInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              onClick={() => handleUrlExtract()}
              disabled={isExtracting || !urlInput.trim()}
              className="px-8 py-4 bg-primary text-neutral-950 font-black rounded-2xl hover:bg-primary/90 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm whitespace-nowrap shrink-0"
            >
              {isExtracting ? (
                <>
                  <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                  <span>Extracting Specs...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Extract Case Specs</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Examples */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">Try Quick Preset Links:</span>
            {[
              { label: 'Pelican 1535 Air', url: 'https://www.pelican.com/us/en/product/cases/air/1535' },
              { label: 'Nanuk 935', url: 'https://nanuk.com/products/nanuk-935' },
              { label: 'Pelican 1650', url: 'https://www.pelican.com/us/en/product/cases/protector/1650' },
              { label: 'Apache 4800', url: 'https://www.harborfreight.com/4800-weatherproof-protective-case-x-large-64250.html' }
            ].map((sample, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setUrlInput(sample.url);
                  handleUrlExtract(sample.url);
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition border border-neutral-700/50 flex items-center gap-1.5"
              >
                <span>{sample.label}</span>
                <ArrowRight size={12} className="text-neutral-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Case Gallery Filters & Controls */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Search cases by model, brand, foam, or form factor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-11 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-sm transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Brand Filter */}
            <div className="flex items-center gap-1.5 bg-neutral-50 p-1 rounded-xl border border-neutral-200 overflow-x-auto max-w-full">
              {['All', 'Pelican', 'Nanuk', 'SKB', 'Gator', 'Peak Design', 'Lowepro', 'Apache'].map((brand) => (
                <button
                  key={brand}
                  onClick={() => setBrandFilter(brand)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    brandFilter === brand ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-1 bg-neutral-50 p-1 rounded-xl border border-neutral-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition ${
                  viewMode === 'grid' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-900'
                }`}
                title="Grid View"
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition ${
                  viewMode === 'table' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-900'
                }`}
                title="Table View"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Form Factor Pill Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-2">Form Factor:</span>
          {['All', 'Carry-On', 'Backpack', 'Rack Case', 'Soft Bag', 'Large Wheeled', 'Medium Utility', 'Trunk'].map((form) => (
            <button
              key={form}
              onClick={() => setFormFactorFilter(form)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition border ${
                formFactorFilter === form 
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm' 
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
              }`}
            >
              {form}
            </button>
          ))}
        </div>

        {/* Grid View */}
        {viewMode === 'grid' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCases.map((caseModel, idx) => {
              const volumeL = calculateVolumeLiters(caseModel.interiorDimensions);
              const isCustom = Boolean(caseModel.ownerId);

              return (
                <div 
                  key={`case-grid-${caseModel.id || 'custom'}-${idx}`} 
                  className="bg-white rounded-[2rem] border border-neutral-200/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-6 space-y-4">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            caseModel.brand === 'Pelican' ? 'bg-amber-100 text-amber-800' :
                            caseModel.brand === 'Nanuk' ? 'bg-blue-100 text-blue-800' :
                            caseModel.brand === 'Apache' ? 'bg-red-100 text-red-800' :
                            caseModel.brand === 'SKB' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-neutral-100 text-neutral-800'
                          }`}>
                            {caseModel.brand}
                          </span>
                          {isCustom && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                              Custom Saved
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-neutral-900 group-hover:text-primary transition line-clamp-1">
                          {caseModel.model}
                        </h3>
                      </div>

                      {caseModel.url && (
                        <a 
                          href={caseModel.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="p-2 text-neutral-400 hover:text-primary transition shrink-0"
                          title="Open Product Link"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>

                    {/* Features badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {caseModel.isCarryOnCompliant && (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-1 border border-emerald-100">
                          <Plane size={12} />
                          <span>Carry-On</span>
                        </span>
                      )}
                      {caseModel.hasWheels && (
                        <span className="px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-bold">
                          Wheels
                        </span>
                      )}
                      {caseModel.foamType && (
                        <span className="px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-600 text-[10px] font-bold">
                          {caseModel.foamType}
                        </span>
                      )}
                    </div>

                    {/* Specs Grid */}
                    <div className="bg-neutral-50 p-4 rounded-xl space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2">
                        <span className="text-neutral-400 font-medium">Interior (L x W x H):</span>
                        <span className="font-mono font-bold text-neutral-800">
                          {caseModel.interiorDimensions.length} x {caseModel.interiorDimensions.width} x {caseModel.interiorDimensions.height} {caseModel.interiorDimensions.unit}
                        </span>
                      </div>

                      {caseModel.exteriorDimensions && (
                        <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2">
                          <span className="text-neutral-400 font-medium">Exterior:</span>
                          <span className="font-mono text-neutral-600">
                            {caseModel.exteriorDimensions.length} x {caseModel.exteriorDimensions.width} x {caseModel.exteriorDimensions.height} {caseModel.exteriorDimensions.unit}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 font-medium">Volume / Weight:</span>
                        <span className="font-bold text-neutral-900">
                          {volumeL}L <span className="text-neutral-400 font-normal">|</span> {caseModel.weight} {caseModel.weightUnit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-6 pt-0 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedCaseModal(caseModel)}
                        className="py-3 bg-neutral-900 text-white rounded-xl font-bold text-xs hover:bg-neutral-800 transition shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Maximize2 size={14} />
                        <span>2D Blueprint</span>
                      </button>

                      <button
                        onClick={() => handleDeployContainer(caseModel)}
                        className="py-3 bg-primary/10 text-primary hover:bg-primary hover:text-neutral-950 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5"
                      >
                        <Package size={14} />
                        <span>Deploy Case</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <button
                        onClick={() => handleCopySpecs(caseModel)}
                        className="text-neutral-400 hover:text-neutral-900 font-medium flex items-center gap-1 transition"
                      >
                        <Copy size={12} />
                        <span>Copy Specs</span>
                      </button>

                      {isCustom && (
                        <button
                          onClick={() => handleDeleteCase(caseModel.id, caseModel.model)}
                          className="text-red-400 hover:text-red-600 font-medium flex items-center gap-1 transition"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-400 uppercase font-bold tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="py-4 px-6">Brand & Model</th>
                  <th className="py-4 px-6">Form Factor</th>
                  <th className="py-4 px-6">Interior Specs</th>
                  <th className="py-4 px-6">Volume (L)</th>
                  <th className="py-4 px-6">Weight</th>
                  <th className="py-4 px-6">Carry-On</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {filteredCases.map((caseModel, idx) => {
                  const vol = calculateVolumeLiters(caseModel.interiorDimensions);
                  return (
                    <tr key={`case-tbl-${caseModel.id || 'custom'}-${idx}`} className="hover:bg-neutral-50/80 transition">
                      <td className="py-4 px-6">
                        <div className="font-bold text-neutral-900 text-sm">{caseModel.model}</div>
                        <div className="text-neutral-400 text-xs">{caseModel.brand}</div>
                      </td>
                      <td className="py-4 px-6 text-neutral-600">
                        {caseModel.formFactor || 'Standard'}
                      </td>
                      <td className="py-4 px-6 font-mono text-neutral-800">
                        {caseModel.interiorDimensions.length} x {caseModel.interiorDimensions.width} x {caseModel.interiorDimensions.height} {caseModel.interiorDimensions.unit}
                      </td>
                      <td className="py-4 px-6 font-bold text-neutral-900">
                        {vol} Liters
                      </td>
                      <td className="py-4 px-6 text-neutral-700">
                        {caseModel.weight} {caseModel.weightUnit}
                      </td>
                      <td className="py-4 px-6">
                        {caseModel.isCarryOnCompliant ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 size={12} /> Yes
                          </span>
                        ) : (
                          <span className="text-neutral-400">Check-In</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedCaseModal(caseModel)}
                            className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition"
                            title="2D Blueprint Specs"
                          >
                            <Maximize2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeployContainer(caseModel)}
                            className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-neutral-950 rounded-lg transition"
                            title="Deploy as Packing Container"
                          >
                            <Package size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Extracted Case Preview Modal */}
      <AnimatePresence>
        {extractedPreview && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] max-w-2xl w-full p-8 shadow-2xl border border-neutral-200 space-y-6 my-8"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider">
                    Extracted Case Verification
                  </span>
                  <h3 className="text-2xl font-black text-neutral-900">{extractedPreview.brand} {extractedPreview.model}</h3>
                  <p className="text-xs text-neutral-500">Review and tweak extracted specifications before adding to your case library.</p>
                </div>
                <button 
                  onClick={() => setExtractedPreview(null)}
                  className="p-2 text-neutral-400 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 bg-neutral-50 p-6 rounded-2xl border border-neutral-200/80">
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Brand</label>
                  <input
                    type="text"
                    value={extractedPreview.brand}
                    onChange={(e) => setExtractedPreview({ ...extractedPreview, brand: e.target.value })}
                    className="w-full mt-1 bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Model Name / Series</label>
                  <input
                    type="text"
                    value={extractedPreview.model}
                    onChange={(e) => setExtractedPreview({ ...extractedPreview, model: e.target.value })}
                    className="w-full mt-1 bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="sm:col-span-2 space-y-2 pt-2 border-t border-neutral-200/60">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Interior Dimensions (Length x Width x Height)</label>
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="number"
                      value={extractedPreview.interiorDimensions.length}
                      onChange={(e) => setExtractedPreview({
                        ...extractedPreview,
                        interiorDimensions: { ...extractedPreview.interiorDimensions, length: Number(e.target.value) }
                      })}
                      className="bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono text-sm font-bold"
                      placeholder="L"
                    />
                    <input
                      type="number"
                      value={extractedPreview.interiorDimensions.width}
                      onChange={(e) => setExtractedPreview({
                        ...extractedPreview,
                        interiorDimensions: { ...extractedPreview.interiorDimensions, width: Number(e.target.value) }
                      })}
                      className="bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono text-sm font-bold"
                      placeholder="W"
                    />
                    <input
                      type="number"
                      value={extractedPreview.interiorDimensions.height}
                      onChange={(e) => setExtractedPreview({
                        ...extractedPreview,
                        interiorDimensions: { ...extractedPreview.interiorDimensions, height: Number(e.target.value) }
                      })}
                      className="bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono text-sm font-bold"
                      placeholder="H"
                    />
                    <select
                      value={extractedPreview.interiorDimensions.unit}
                      onChange={(e) => setExtractedPreview({
                        ...extractedPreview,
                        interiorDimensions: { ...extractedPreview.interiorDimensions, unit: e.target.value as any }
                      })}
                      className="bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold text-sm"
                    >
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Tare Weight</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      step="0.1"
                      value={extractedPreview.weight}
                      onChange={(e) => setExtractedPreview({ ...extractedPreview, weight: Number(e.target.value) })}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono font-bold text-sm"
                    />
                    <select
                      value={extractedPreview.weightUnit}
                      onChange={(e) => setExtractedPreview({ ...extractedPreview, weightUnit: e.target.value })}
                      className="bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold text-sm"
                    >
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Form Factor</label>
                  <select
                    value={extractedPreview.formFactor}
                    onChange={(e) => setExtractedPreview({ ...extractedPreview, formFactor: e.target.value })}
                    className="w-full mt-1 bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold text-sm"
                  >
                    <option value="Carry-On">Carry-On</option>
                    <option value="Large Wheeled">Large Wheeled</option>
                    <option value="Medium Utility">Medium Utility</option>
                    <option value="Trunk">Trunk</option>
                    <option value="Backpack">Backpack</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <Plane size={18} />
                  <span>Calculated Internal Volume: {calculateVolumeLiters(extractedPreview.interiorDimensions)} Liters</span>
                </div>
                <span className="text-emerald-700 font-medium">
                  {extractedPreview.isCarryOnCompliant ? '✓ Airline Carry-On Compliant' : 'Check-In Transport'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => handleSaveExtracted(false)}
                  className="flex-1 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition shadow-lg text-sm"
                >
                  Save to Case Library
                </button>
                <button
                  onClick={() => handleSaveExtracted(true)}
                  className="flex-1 py-4 bg-primary text-neutral-950 rounded-2xl font-black hover:bg-primary/90 transition shadow-lg text-sm"
                >
                  Save & Deploy Container
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Case 2D Blueprint Visualizer Modal */}
      <AnimatePresence>
        {selectedCaseModal && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] max-w-3xl w-full p-8 shadow-2xl border border-neutral-200 space-y-6 my-8"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-black uppercase tracking-wider">
                    {selectedCaseModal.brand} Volumetric Spec Sheet
                  </span>
                  <h3 className="text-2xl font-black text-neutral-900 mt-1">{selectedCaseModal.model}</h3>
                </div>
                <button 
                  onClick={() => setSelectedCaseModal(null)}
                  className="p-2 text-neutral-400 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 2D Proportional Blueprint Diagram */}
              <div className="bg-neutral-950 p-8 rounded-3xl text-white space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-3">
                  <span className="font-bold uppercase tracking-wider text-primary">Interior Footprint Blueprint</span>
                  <span>Volume: {calculateVolumeLiters(selectedCaseModal.interiorDimensions)} Liters</span>
                </div>

                {/* 2D Box Visualization */}
                <div className="py-8 flex items-center justify-center">
                  <div 
                    className="border-2 border-primary/80 bg-primary/10 rounded-2xl p-4 flex flex-col justify-between items-center relative transition-all duration-500 shadow-[0_0_30px_rgba(234,179,8,0.15)]"
                    style={{
                      width: `${Math.min(Math.max(selectedCaseModal.interiorDimensions.length * 4.5, 180), 340)}px`,
                      height: `${Math.min(Math.max(selectedCaseModal.interiorDimensions.width * 4.5, 120), 220)}px`
                    }}
                  >
                    <div className="text-[10px] font-mono text-primary font-bold bg-neutral-900/90 px-2 py-0.5 rounded border border-primary/30">
                      Length: {selectedCaseModal.interiorDimensions.length} {selectedCaseModal.interiorDimensions.unit}
                    </div>

                    <div className="text-center my-auto">
                      <p className="text-xs font-black text-white">{selectedCaseModal.brand} {selectedCaseModal.model}</p>
                      <p className="text-[10px] font-mono text-neutral-400 mt-0.5">Depth/Height: {selectedCaseModal.interiorDimensions.height} {selectedCaseModal.interiorDimensions.unit}</p>
                    </div>

                    <div className="text-[10px] font-mono text-primary font-bold bg-neutral-900/90 px-2 py-0.5 rounded border border-primary/30">
                      Width: {selectedCaseModal.interiorDimensions.width} {selectedCaseModal.interiorDimensions.unit}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-neutral-800">
                  <div className="bg-neutral-900 p-2.5 rounded-xl">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold">Lid Depth</p>
                    <p className="font-mono font-bold text-white">{selectedCaseModal.lidDepth || Math.round(selectedCaseModal.interiorDimensions.height * 0.25)} {selectedCaseModal.interiorDimensions.unit}</p>
                  </div>
                  <div className="bg-neutral-900 p-2.5 rounded-xl">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold">Base Depth</p>
                    <p className="font-mono font-bold text-white">{selectedCaseModal.baseDepth || Math.round(selectedCaseModal.interiorDimensions.height * 0.75)} {selectedCaseModal.interiorDimensions.unit}</p>
                  </div>
                  <div className="bg-neutral-900 p-2.5 rounded-xl">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold">Tare Weight</p>
                    <p className="font-mono font-bold text-white">{selectedCaseModal.weight} {selectedCaseModal.weightUnit}</p>
                  </div>
                </div>
              </div>

              {/* Specs Breakdown */}
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-neutral-50 rounded-2xl space-y-2 border border-neutral-200/80">
                  <p className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">Interior Specs</p>
                  <p className="font-mono text-neutral-900 font-bold text-sm">
                    {selectedCaseModal.interiorDimensions.length} x {selectedCaseModal.interiorDimensions.width} x {selectedCaseModal.interiorDimensions.height} {selectedCaseModal.interiorDimensions.unit}
                  </p>
                  <p className="text-neutral-500">Foam Setup: {selectedCaseModal.foamType || 'Standard'}</p>
                </div>

                <div className="p-4 bg-neutral-50 rounded-2xl space-y-2 border border-neutral-200/80">
                  <p className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">Exterior Specs</p>
                  <p className="font-mono text-neutral-900 font-bold text-sm">
                    {selectedCaseModal.exteriorDimensions?.length || '-'} x {selectedCaseModal.exteriorDimensions?.width || '-'} x {selectedCaseModal.exteriorDimensions?.height || '-'} {selectedCaseModal.exteriorDimensions?.unit || selectedCaseModal.interiorDimensions.unit}
                  </p>
                  <p className="text-neutral-500">Form Factor: {selectedCaseModal.formFactor || 'Hard Shell'}</p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => {
                    handleDeployContainer(selectedCaseModal);
                    setSelectedCaseModal(null);
                  }}
                  className="flex-1 py-4 bg-primary text-neutral-950 font-black rounded-2xl hover:bg-primary/90 transition shadow-lg text-sm flex items-center justify-center gap-2"
                >
                  <Package size={18} />
                  <span>Deploy as Packing Container</span>
                </button>

                <button
                  onClick={() => handleCopySpecs(selectedCaseModal)}
                  className="px-6 py-4 bg-neutral-100 text-neutral-800 rounded-2xl font-bold hover:bg-neutral-200 transition text-sm flex items-center justify-center gap-2"
                >
                  <Copy size={18} />
                  <span>Copy Specs</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Custom Case Modal */}
      <AnimatePresence>
        {isAddCustomModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] max-w-2xl w-full p-8 shadow-2xl border border-neutral-200 space-y-6 my-8"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-black text-neutral-900">Add Custom Case Specification</h3>
                  <p className="text-xs text-neutral-500">Manually define dimensions for custom build cases, flight trunks, or unlisted models.</p>
                </div>
                <button 
                  onClick={() => setIsAddCustomModalOpen(false)}
                  className="p-2 text-neutral-400 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveCustomCase} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-neutral-700">Brand / Maker</label>
                    <input
                      type="text"
                      required
                      value={customForm.brand}
                      onChange={(e) => setCustomForm({ ...customForm, brand: e.target.value })}
                      placeholder="Pelican, Nanuk, Custom, Anvil..."
                      className="w-full mt-1 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-700">Model Name / ID</label>
                    <input
                      type="text"
                      required
                      value={customForm.model}
                      onChange={(e) => setCustomForm({ ...customForm, model: e.target.value })}
                      placeholder="e.g. Custom Flight Trunk #1"
                      className="w-full mt-1 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Interior Dims */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-neutral-700">Interior Dimensions (L x W x H)</label>
                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="number"
                        required
                        value={customForm.intLength}
                        onChange={(e) => setCustomForm({ ...customForm, intLength: Number(e.target.value) })}
                        placeholder="L"
                        className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-sm font-bold"
                      />
                      <input
                        type="number"
                        required
                        value={customForm.intWidth}
                        onChange={(e) => setCustomForm({ ...customForm, intWidth: Number(e.target.value) })}
                        placeholder="W"
                        className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-sm font-bold"
                      />
                      <input
                        type="number"
                        required
                        value={customForm.intHeight}
                        onChange={(e) => setCustomForm({ ...customForm, intHeight: Number(e.target.value) })}
                        placeholder="H"
                        className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-sm font-bold"
                      />
                      <select
                        value={customForm.intUnit}
                        onChange={(e) => setCustomForm({ ...customForm, intUnit: e.target.value as any })}
                        className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-sm"
                      >
                        <option value="cm">cm</option>
                        <option value="in">in</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-700">Tare Weight</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        step="0.1"
                        value={customForm.weight}
                        onChange={(e) => setCustomForm({ ...customForm, weight: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-sm font-bold"
                      />
                      <select
                        value={customForm.weightUnit}
                        onChange={(e) => setCustomForm({ ...customForm, weightUnit: e.target.value as any })}
                        className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-sm"
                      >
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-700">Form Factor</label>
                    <select
                      value={customForm.formFactor}
                      onChange={(e) => setCustomForm({ ...customForm, formFactor: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold"
                    >
                      <option value="Carry-On">Carry-On Hard Case</option>
                      <option value="Backpack">Camera / Tech Backpack</option>
                      <option value="Rack Case">Ready-Built Rack Case (Audio/IT)</option>
                      <option value="Soft Bag">Soft Padded Bag / Organizer</option>
                      <option value="Large Wheeled">Large Wheeled Trunk</option>
                      <option value="Medium Utility">Medium Utility Case</option>
                      <option value="Trunk">Road Trunk / Flight Case</option>
                      <option value="Custom">Custom Enclosure</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customForm.hasWheels}
                        onChange={(e) => setCustomForm({ ...customForm, hasWheels: e.target.checked })}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <span>Includes Wheels</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customForm.isCarryOnCompliant}
                        onChange={(e) => setCustomForm({ ...customForm, isCarryOnCompliant: e.target.checked })}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <span>Airline Carry-On Compliant</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddCustomModalOpen(false)}
                    className="flex-1 py-3.5 bg-neutral-100 text-neutral-700 font-bold rounded-xl text-sm hover:bg-neutral-200 transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-neutral-900 text-white font-bold rounded-xl text-sm hover:bg-neutral-800 transition shadow-lg"
                  >
                    Save Custom Case
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
