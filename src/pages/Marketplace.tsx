import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, AdminSettings } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  Search, 
  MapPin, 
  SlidersHorizontal, 
  X, 
  ChevronRight, 
  Star, 
  Calendar, 
  Check, 
  UserCheck, 
  DollarSign, 
  ShoppingBag, 
  Flame, 
  HelpCircle, 
  Info, 
  Play, 
  Tv, 
  ArrowRight, 
  CheckCircle2, 
  Heart,
  ShieldAlert,
  ChevronLeft,
  Mail,
  Camera,
  Map,
  Filter,
  Globe,
  Hammer,
  Wrench,
  Package,
  LayoutGrid,
  List,
  ArrowUpDown,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';

// High-quality mock data mimicking a professional gear marketplace layout
interface CategoryItem {
  id: string;
  name: string;
  count: number;
  image: string;
}

interface ProductItem {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  ownerName?: string;
  ownerRating?: number;
  instantBook?: boolean;
  shippingDays?: number;
  isShipped?: boolean;
  isSale?: boolean;
  industry?: string;
  sponsored?: boolean;
  featured?: boolean;
  featuredPriority?: number;
  isUserListing?: boolean;
  addOns?: Array<{
    itemId?: string;
    name: string;
    price: number;
    useDefaultPrice?: boolean;
  }>;
}

interface CrewItem {
  id: string;
  name: string;
  title: string;
  rating: number;
  reviews: number;
  image: string;
  skills: string[];
  bio: string;
  videoUrl?: string;
  isVerified?: boolean;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'cinema-cameras', name: 'Cinema Cameras', count: 18960, image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=400' },
  { id: 'cinema-lenses', name: 'Cinema Lenses', count: 10646, image: 'https://images.unsplash.com/photo-1617005082133-5c8cdd97eadd?auto=format&fit=crop&q=80&w=400' },
  { id: 'photography-lenses', name: 'Photography Lenses', count: 6830, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400' },
  { id: 'still-hybrid', name: 'Still / Hybrid Cameras', count: 3055, image: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&q=80&w=400' },
  { id: 'lighting-electric', name: 'Lighting / Electric', count: 16502, image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400' },
  { id: 'audio', name: 'Audio Gear', count: 8620, image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=400' },
  { id: 'ge-packages', name: 'G&E Packages', count: 618, image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=400' },
];

const POPULAR_PRODUCTS: ProductItem[] = [
  { id: 'rent-1', name: 'Sony FX3 Full-Frame Cinema Camera', brand: 'Sony', model: 'FX3', category: 'cinema-cameras', price: 50, rating: 4.8, reviews: 92, image: 'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?auto=format&fit=crop&q=80&w=400', ownerName: 'Sum of Parts LLC', instantBook: true, addOns: [{ name: 'Sony CFexpress 80GB Type-A Card', price: 10 }, { name: 'Sachtler Flowtech 75 Tripod System', price: 25 }] },
  { id: 'rent-2', name: 'Sony FX6 Full-Frame Cinema Camera', brand: 'Sony', model: 'FX6', category: 'cinema-cameras', price: 75, rating: 4.9, reviews: 120, image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=400', ownerName: 'Bogdan Rental', instantBook: true, addOns: [{ name: 'Sony 160GB CFexpress Card Type-A', price: 15 }, { name: 'E-Image 2-Stage Carbon Fiber Tripod', price: 20 }] },
  { id: 'rent-3', name: 'Zeiss Super Speed Prime Lens Set 35/50/85', brand: 'Zeiss', model: 'Super Speed', category: 'cinema-lenses', price: 150, rating: 5.0, reviews: 11, image: 'https://images.unsplash.com/photo-1617005082133-5c8cdd97eadd?auto=format&fit=crop&q=80&w=400', ownerName: 'NirvanaMedia', instantBook: false, addOns: [{ name: 'Tiffen 77mm Variable ND Filter Set', price: 8 }] },
  { id: 'rent-4', name: 'ARRI Alexa Mini LF Package + Wireless Video', brand: 'ARRI', model: 'Alexa Mini LF', category: 'cinema-cameras', price: 250, rating: 4.9, reviews: 45, image: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&q=80&w=400', ownerName: 'Brentwood Sizzle', instantBook: true, addOns: [{ name: 'Teradek Bolt 4K LT 750 Receiver Module', price: 40 }] },
  { id: 'rent-5', name: 'Sony Alpha a7S III Mirrorless Camera', brand: 'Sony', model: 'a7S III', category: 'still-hybrid', price: 40, rating: 4.7, reviews: 74, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400', ownerName: 'Carson Zhu', instantBook: true, addOns: [{ name: 'Atomos Ninja V 5" Touchscreen Monitor', price: 12 }, { name: 'Zhiyun Crane 3S Handheld Stabilizer Gimbal', price: 18 }] },
  { id: 'rent-6', name: 'Cooke SP3 Full Frame cinema prime Lens', brand: 'Cooke', model: 'SP3', category: 'cinema-lenses', price: 245, rating: 4.9, reviews: 8, image: 'https://images.unsplash.com/photo-1617005082133-5c8cdd97eadd?auto=format&fit=crop&q=80&w=400', ownerName: 'Bogdan Rental', instantBook: false },
];

const SHIPPED_PRODUCTS: ProductItem[] = [
  { id: 'ship-1', name: 'Aputure NOVA P600c 1x1 Softbox Kit', brand: 'Aputure', model: 'NOVA P600c', category: 'lighting-electric', price: 90, rating: 4.9, reviews: 26, image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400', ownerName: 'Zac Zotic', instantBook: true, shippingDays: 3, isShipped: true },
  { id: 'ship-2', name: 'DJI Matrice 300 RTK Drone Visual Suite', brand: 'DJI', model: 'Matrice 300', category: 'still-hybrid', price: 450, rating: 5.0, reviews: 3, image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=400', ownerName: 'NirvanaMedia LLC', instantBook: false, shippingDays: 3, isShipped: true },
  { id: 'ship-3', name: 'DZOFILM Vespid Prime 4-Lens Kit (PL Mount)', brand: 'DZOFILM', model: 'Vespid Prime Set', category: 'cinema-lenses', price: 175, rating: 4.8, reviews: 67, image: 'https://images.unsplash.com/photo-1617005082133-5c8cdd97eadd?auto=format&fit=crop&q=80&w=400', ownerName: 'Baim', instantBook: true, shippingDays: 3, isShipped: true },
  { id: 'ship-4', name: 'Fujifilm X30 Classic Premium Compact Camera', brand: 'Fujifilm', model: 'X30', category: 'still-hybrid', price: 39, rating: 4.9, reviews: 42, image: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&q=80&w=400', ownerName: 'Sum of Parts LLC', instantBook: false, shippingDays: 3, isShipped: true },
  { id: 'ship-5', name: 'Sony FE 24-70mm f/2.8 GM Lens (Type I)', brand: 'Sony', model: 'FE 24-70mm', category: 'photography-lenses', price: 70, rating: 4.8, reviews: 14, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400', ownerName: 'Men\'s Bread Productions', instantBook: true, shippingDays: 4, isShipped: true },
];

const SALES_PRODUCTS: ProductItem[] = [
  { id: 'sale-1', name: 'Sigma FF High-Speed Prime Lens Series Set', brand: 'Sigma', model: 'FF High-Speed', category: 'cinema-lenses', price: 5000, rating: 4.9, reviews: 12, image: 'https://images.unsplash.com/photo-1617005082133-5c8cdd97eadd?auto=format&fit=crop&q=80&w=400', isSale: true, ownerName: 'Adam Griffin' },
  { id: 'sale-2', name: 'NiSi C5 Matte Box Cinema Star Kit', brand: 'NiSi', model: 'C5 Kit', category: 'cinema-lenses', price: 534, originalPrice: 749, rating: 4.8, reviews: 7, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400', isSale: true, ownerName: 'LOMISFILM' },
  { id: 'sale-3', name: 'Paul C. Buff, Inc Einstein E640 Flash Unit', brand: 'Paul C. Buff', model: 'Einstein E640', category: 'lighting-electric', price: 500, originalPrice: 575, rating: 4.5, reviews: 3, image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400', isSale: true, ownerName: '805 Studios LLC' },
  { id: 'sale-4', name: 'Pelican Air 1607 Custom Divider Case', brand: 'Pelican', model: 'Air 1607', category: 'ge-packages', price: 250, originalPrice: 420, rating: 4.9, reviews: 23, image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=400', isSale: true, ownerName: 'Ethan Sigmon' },
  { id: 'sale-5', name: 'Contax T2 Titan Black 35mm Point and Shoot', brand: 'Contax', model: 'T2', category: 'still-hybrid', price: 1750, originalPrice: 2000, rating: 5.0, reviews: 23, image: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&q=80&w=400', isSale: true, ownerName: 'Ethan Sigmon' },
];

const CREW_LIST: CrewItem[] = [
  { id: 'crew-1', name: 'Ecarum Sumpter', title: 'Photographer & Videographer', rating: 4.9, reviews: 1, image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400', skills: ['Editor', 'Visual Effects Editor', 'Event Videographer'], bio: 'Hi there! I specialize in high production music videos and commercial layouts across the state.', isVerified: true },
  { id: 'crew-2', name: 'Sean Chow', title: 'Cinematographer & Camera Op', rating: 5.0, reviews: 3, image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400', skills: ['Cinematographer', 'Steadicam Op', 'Colorist'], bio: 'NYU Alum & current AFI Cinematography Fellow. Experienced with 35mm, ARRI/RED workflows, and underwater rigs.', isVerified: true },
  { id: 'crew-3', name: 'Trent Mills', title: 'Producer & Technical Writer', rating: 4.8, reviews: 8, image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400', skills: ['Actor - Film & Television', 'Editor', 'Executive Producer'], bio: 'Bilingual actor and creative director based in Los Angeles. Built lines for HBO, Amazon Studios and more.', isVerified: true },
  { id: 'crew-4', name: 'Abel Garcia Rodriguez', title: 'Film & Commercial Producer', rating: 5.0, reviews: 12, image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400', skills: ['Film Producer', 'Line Producer', 'Logistics Op'], bio: 'Film Producer Los Angeles Yo Jay Media. Multi-genre expert with solid focus on budget optimization.', isVerified: true },
  { id: 'crew-5', name: 'Rhys Kroehler', title: 'Independent Film Director', rating: 5.0, reviews: 1, image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400', skills: ['Director', 'Director of Photography'], bio: 'USC Film Production BFA 2025: Executive Assistant at WME Agency 2026. Specializing in intimate dramatic features.', isVerified: true },
];

const STAFF_PICKS: ProductItem[] = [
  { id: 'pick-1', name: 'Aputure LS C300d II w/ softbox, fresnel, lantern and stand', brand: 'Aputure', model: 'LS C300d II', category: 'lighting-electric', price: 40, rating: 4.8, reviews: 49, image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400', ownerName: 'Zac Zotic', instantBook: true },
  { id: 'pick-2', name: 'Sony FX3 + FX3 Rig + Sigma Art 24-70 2.8 package', brand: 'Sony', model: 'FX3 Rig Combo', category: 'cinema-cameras', price: 138, rating: 5.0, reviews: 82, image: 'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?auto=format&fit=crop&q=80&w=400', ownerName: 'Bogdan Rental', instantBook: true },
  { id: 'pick-3', name: 'Aputure Nova P300c RGBWW LED Panel / Color LED Panel', brand: 'Aputure', model: 'Nova P300c', category: 'lighting-electric', price: 50, rating: 4.9, reviews: 31, image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400', ownerName: 'Sum of Parts LLC', instantBook: true },
  { id: 'pick-4', name: 'Sony Alpha a7 IV Camera w/Sigma 24-70mm f2.8 lens & Rode VideoMic Pro', brand: 'Sony', model: 'a7 IV Kit', category: 'still-hybrid', price: 70, rating: 4.7, reviews: 19, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400', ownerName: 'Bogdan Rental', instantBook: true },
];

const INDUSTRIES_MARKET = [
  { id: 'all', name: 'View All Industries', description: 'Explore items globally' },
  { id: 'production', name: 'Pro AV & Cinema', description: 'Cameras, Sound, and G&E Kits' },
  { id: 'construction', name: 'Heavy Construction', description: 'Excavators, Drills, and Hoists' },
  { id: 'automotive', name: 'Automotive & Garage', description: 'Lift Jacks, diagnostics, wrenches' },
  { id: 'medical', name: 'Medical Devices', description: 'ECG Monitors, Ultrasounds, and Lab kits' },
  { id: 'general_logistics', name: 'Warehouse Logistics', description: 'Forklifts, Hand Trucks, and Flight trunks' }
];

const EXTRA_CATEGORIES: CategoryItem[] = [
  // Construction
  { id: 'heavy-machinery', name: 'Heavy Machinery & Cranes', count: 320, image: 'https://images.unsplash.com/photo-1579684389781-71fa80d34154?auto=format&fit=crop&q=80&w=400' },
  { id: 'power-tools', name: 'Industrial Power Tools', count: 4501, image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=400' },
  { id: 'site-scaffolding', name: 'Hoists & Scaffold Systems', count: 1450, image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=400' },
  { id: 'welding-assemblies', name: 'Welding & Arc Outfits', count: 890, image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400' },

  // Automotive
  { id: 'diagnostics', name: 'Garages & Calibration Diagnostics', count: 1205, image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=400' },
  { id: 'lifting-jacks', name: 'Pneumatic Lifting Jacks & Ramps', count: 850, image: 'https://images.unsplash.com/photo-1530047625168-4b18df2df4f6?auto=format&fit=crop&q=80&w=400' },
  { id: 'power-air-tools', name: 'Air Compressors & Impact Tools', count: 2310, image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&q=80&w=400' },
  { id: 'mechanical-handtools', name: 'Heavy Wrench & Storage Cabinets', count: 4920, image: 'https://images.unsplash.com/photo-1534224039826-c7a0eda0e6b3?auto=format&fit=crop&q=80&w=400' },

  // Medical
  { id: 'imaging', name: 'Medical Ultrasound & Scopes', count: 412, image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=400' },
  { id: 'patient-monitors', name: 'Care Vitals & ECG Monitors', count: 980, image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=400' },
  { id: 'clinical-pipettes', name: 'Lab Clinical Micropipettes', count: 1540, image: 'https://images.unsplash.com/photo-1579154204601-01588f351167?auto=format&fit=crop&q=80&w=400' },
  { id: 'surgical-support', name: 'Minor Surgical Light & Otoscopes', count: 620, image: 'https://images.unsplash.com/photo-1584515901307-a5418eb66a8a?auto=format&fit=crop&q=80&w=400' },

  // General logistics
  { id: 'warehouse-logistics', name: 'Propane Forklifts & Shifters', count: 2430, image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=400' },
  { id: 'platform-carts', name: 'High Capacity Flatbed Dollies', count: 1105, image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=400' },
  { id: 'flight-cases', name: 'Flight Cases & G&E Pack Trunks', count: 3108, image: 'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?auto=format&fit=crop&q=80&w=400' }
];

const MULTI_INDUSTRY_PRODUCTS: ProductItem[] = [
  // Construction
  { id: 'const-1', name: 'Caterpillar 302.7 CR Mini Excavator - 2.7 Tons', brand: 'Caterpillar', model: '302.7 CR', category: 'heavy-machinery', price: 250, rating: 4.9, reviews: 34, image: 'https://images.unsplash.com/photo-1579684389781-71fa80d34154?auto=format&fit=crop&q=80&w=400', ownerName: 'Atlas Fleet Rentals', instantBook: true, industry: 'construction' },
  { id: 'const-2', name: 'Hilti TE 70-ATC SDS Max Rotary Hammer Drill Kit', brand: 'Hilti', model: 'TE 70-ATC', category: 'power-tools', price: 45, rating: 4.8, reviews: 112, image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=400', ownerName: 'Pacific Tool Shed', instantBook: true, industry: 'construction' },
  { id: 'const-3', name: 'Genie GS-1930 Electric Self-Propelled Scissor Lift', brand: 'Genie', model: 'GS-1930', category: 'site-scaffolding', price: 120, rating: 4.7, reviews: 29, image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=400', ownerName: 'Ascent Hoist & Rig', instantBook: false, industry: 'construction' },
  { id: 'const-4', name: 'Miller Bobcat 250 Engine Welder-Generator', brand: 'Miller', model: 'Bobcat 250', category: 'welding-assemblies', price: 75, rating: 4.9, reviews: 14, image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400', ownerName: 'MetalCraft Inc', instantBook: true, industry: 'construction' },
  { id: 'const-5', name: 'DeWalt 20V Cordless Max Combo 6-Tool Drill Kit', brand: 'DeWalt', model: 'DCK620D2', category: 'power-tools', price: 110, rating: 4.6, reviews: 220, image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=400', ownerName: 'DeWalt Central', isSale: true, industry: 'construction' },

  // Automotive
  { id: 'auto-1', name: 'Snap-on ZEUS+ Intelligent Diagnostic Scanner Tool', brand: 'Snap-on', model: 'EEMS348', category: 'diagnostics', price: 95, rating: 5.0, reviews: 18, image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=400', ownerName: 'Apex Diagnostic Station', instantBook: true, industry: 'automotive' },
  { id: 'auto-2', name: 'BendPak HD-9 Four-Post Car Parking Lift System', brand: 'BendPak', model: 'HD-9', category: 'lifting-jacks', price: 150, rating: 4.9, reviews: 41, image: 'https://images.unsplash.com/photo-1530047625168-4b18df2df4f6?auto=format&fit=crop&q=80&w=400', ownerName: 'Veloce R&D Garage', instantBook: false, industry: 'automotive' },
  { id: 'auto-3', name: 'Ingersoll Rand Air Impact 1/2" Heavy Duty Gun', brand: 'Ingersoll Rand', model: '2235TiMAX', category: 'power-air-tools', price: 30, rating: 4.8, reviews: 76, image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&q=80&w=400', ownerName: 'Pneumatic Outlet', instantBook: true, industry: 'automotive' },
  { id: 'auto-4', name: 'Mac Tools Professional Socket Wrench Master Chest', brand: 'Mac Tools', model: 'MB1300', category: 'mechanical-handtools', price: 1850, rating: 4.9, reviews: 15, image: 'https://images.unsplash.com/photo-1534224039826-c7a0eda0e6b3?auto=format&fit=crop&q=80&w=400', ownerName: 'Canyon Mechanics', isSale: true, industry: 'automotive' },

  // Medical
  { id: 'med-1', name: 'GE Vscan Air Handheld Wireless Ultrasound Scanner', brand: 'GE Healthcare', model: 'Vscan Air', category: 'imaging', price: 180, rating: 5.0, reviews: 9, image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=400', ownerName: 'Horizon Clinical Tech', instantBook: true, industry: 'medical' },
  { id: 'med-2', name: 'Philips Goldway G40 Multiparameter Vital Patient Monitor', brand: 'Philips', model: 'Goldway G40', category: 'patient-monitors', price: 65, rating: 4.7, reviews: 14, image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=400', ownerName: 'CarePlus Logistics', instantBook: true, industry: 'medical' },
  { id: 'med-3', name: 'Eppendorf Research Plus Master Adjustable Micropipette Set', brand: 'Eppendorf', model: 'Research Plus', category: 'clinical-pipettes', price: 35, rating: 4.9, reviews: 43, image: 'https://images.unsplash.com/photo-1579154204601-01588f351167?auto=format&fit=crop&q=80&w=400', ownerName: 'BioLab Research Group', instantBook: true, industry: 'medical' },
  { id: 'med-4', name: 'Welch Allyn Diagnostic MacroView LED Otoscope Kit', brand: 'Welch Allyn', model: 'MacroView LED', category: 'surgical-support', price: 450, rating: 4.8, reviews: 29, image: 'https://images.unsplash.com/photo-1584515901307-a5418eb66a8a?auto=format&fit=crop&q=80&w=400', ownerName: 'MedDirect Supplies', isSale: true, industry: 'medical' },

  // Logistics
  { id: 'log-1', name: 'Toyota 8FGU25 5000lb Cushion Tire Propane Forklift', brand: 'Toyota Heavy', model: '8FGU25', category: 'warehouse-logistics', price: 190, rating: 4.9, reviews: 52, image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=400', ownerName: 'Omni Logistic Fleet', instantBook: false, industry: 'general_logistics' },
  { id: 'log-2', name: 'Uline Heavy Duty Industrial Platform Hand Truck', brand: 'Uline', model: 'Platform Truck', category: 'platform-carts', price: 15, rating: 4.6, reviews: 108, image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=400', ownerName: 'Summit Packing Depot', instantBook: true, industry: 'general_logistics' },
  { id: 'log-3', name: 'Pelican Storm iM2875 Custom Transport Flight Trunk', brand: 'Pelican', model: 'iM2875', category: 'flight-cases', price: 180, originalPrice: 220, rating: 4.9, reviews: 215, image: 'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?auto=format&fit=crop&q=80&w=400', ownerName: 'CaseMasters LLC', isSale: true, industry: 'general_logistics' }
];

interface MarketplaceProps {
  user?: UserProfile | null;
  adminSettings?: AdminSettings | null;
}

export default function Marketplace({ user, adminSettings }: MarketplaceProps = {}) {
  const navigate = useNavigate();
  const [currentMode, setCurrentMode] = useState<'rent' | 'buy'>('rent');
  const [searchQuery, setSearchQuery] = useState('');
  const [userListings, setUserListings] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'packingLists'),
      where('marketplaceEnabled', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbListings = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Untitled List',
          brand: data.brand || 'Custom Bundle',
          model: data.model || 'Kit',
          category: data.category || 'cinema-cameras',
          price: Number(data.marketplacePrice || 0),
          originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
          rating: 5.0,
          reviews: 1,
          image: data.image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400',
          ownerName: data.ownerEmail ? data.ownerEmail.split('@')[0] : 'Owner',
          ownerRating: 5.0,
          instantBook: true,
          isUserListing: true,
          isSale: data.transactionType === 'sale',
          featured: data.featured || false,
          sponsored: data.sponsored || false,
          adHeadline: data.adHeadline || '',
          moderationStatus: data.moderationStatus || 'approved',
          description: data.marketplaceDetails || data.description || '',
          securityDeposit: data.securityDeposit || 0,
        };
      }).filter(item => item.moderationStatus !== 'suspended');
      setUserListings(dbListings);
    }, (error) => {
      console.error("Marketplace: Error loading custom listings:", error);
    });
    return () => unsubscribe();
  }, []);

  const launchCountry = adminSettings?.marketplaceRegionConfig?.launchCountry || 'Fiji';
  const availableCountries = adminSettings?.marketplaceRegionConfig?.availableCountries || ['Fiji', 'United States', 'Australia', 'New Zealand', 'United Kingdom', 'Canada'];
  const restrictToAvailableCountries = adminSettings?.marketplaceRegionConfig?.restrictToAvailableCountries || false;

  const landingConfig = adminSettings?.marketplaceLandingPageConfig || {};
  const heroTitle = landingConfig.heroTitle || 'The largest, most trusted camera sharing community';
  const heroSubtitle = landingConfig.heroSubtitle || 'Packer verified marketplace';
  const heroDescription = landingConfig.heroDescription || 'Professional visual equipment hire & purchase marketplace. Connecting production crews on Viti Levu and beyond.';
  const showPromotions = landingConfig.showPromotions !== false;
  const bannerATitle = landingConfig.bannerATitle || 'Packer Insights';
  const bannerASubtitle = landingConfig.bannerASubtitle || 'Get the latest data on which products rented & sold best across major organizations.';
  const bannerAButtonText = landingConfig.bannerAButtonText || 'View Report';
  const bannerAImage = landingConfig.bannerAImage || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400';
  const bannerBTitle = landingConfig.bannerBTitle || 'Exclusive Student Discounts';
  const bannerBSubtitle = landingConfig.bannerBSubtitle || 'Are you enrolled in film academy? Enjoy up to a 20% discount as a verified student operator.';
  const bannerBButtonText = landingConfig.bannerBButtonText || 'Claim Now';
  const bannerBImage = landingConfig.bannerBImage || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300';
  const showStaffPicks = landingConfig.showStaffPicks !== false;
  const showCategories = landingConfig.showCategories !== false;
  const showGuarantees = landingConfig.showGuarantees !== false;
  const requiresEduVerification = landingConfig.requiresEduVerification !== false;
  const partnerLogosText = landingConfig.partnerLogosText || 'Members of Packer Network';
  const partnerLogosList = landingConfig.partnerLogosList || ['facebook', 'amazon studios', 'HBO', 'Disney'];

  const activeCountry = user?.country || launchCountry || 'Fiji';
  const isFiji = activeCountry === 'Fiji';

  const isAuthorized = user?.country 
    ? availableCountries.includes(user.country)
    : true;

  const [locationQuery, setLocationQuery] = useState(isFiji ? 'Suva, Fiji' : 'Los Angeles, CA');

  useEffect(() => {
    if (isFiji) {
      setLocationQuery('Suva, Fiji');
    } else {
      setLocationQuery(user?.location || 'Los Angeles, CA');
    }
  }, [isFiji, user?.location]);

  const currencySymbol = isFiji ? 'FJ$' : '$';

  // Fiji-centric brand/owner mappings
  const mappedPopularProducts = POPULAR_PRODUCTS.map(p => {
    if (isFiji) {
      const fijiOwners: { [key: string]: string } = {
        'Sum of Parts LLC': 'Fiji Television Ltd',
        'Bogdan Rental': 'Pacific Film Services (Suva)',
        'NirvanaMedia': 'Mai TV Fiji',
        'Brentwood Sizzle': 'Viti Levu Broadcast Group',
        'Carson Zhu': 'Nadi Bay Rental Center'
      };
      return {
        ...p,
        ownerName: fijiOwners[p.ownerName || ''] || 'Fiji Media Services',
        price: Math.round(p.price * 2.2)
      };
    }
    return p;
  });

  const mappedShippedProducts = SHIPPED_PRODUCTS.map(p => {
    if (isFiji) {
      const fijiOwners: { [key: string]: string } = {
        'Zac Zotic': 'Coconut Media Co. (Suva)',
        'NirvanaMedia LLC': 'Pacific Film Services Ltd',
        'Baim': 'Viti West Production Equipment',
        'Sum of Parts LLC': 'Fiji Television Ltd',
        "Men's Bread Productions": 'South Pacific Broadcast Center'
      };
      return {
        ...p,
        ownerName: fijiOwners[p.ownerName || ''] || 'Malamala Film Hub',
        price: Math.round(p.price * 2.2)
      };
    }
    return p;
  });

  const mappedSalesProducts = SALES_PRODUCTS.map(p => {
    if (isFiji) {
      const fijiOwners: { [key: string]: string } = {
        'Adam Griffin': 'Elena Bulatiko (Suva)',
        'LOMISFILM': 'Suva Matte Box Sales',
        '805 Studios LLC': 'Nadi Event Services',
        'Ethan Sigmon': 'Viti Levu Spares'
      };
      return {
        ...p,
        ownerName: fijiOwners[p.ownerName || ''] || 'Tanoa Films Co',
        price: Math.round(p.price * 2.2),
        originalPrice: p.originalPrice ? Math.round(p.originalPrice * 2.2) : undefined
      };
    }
    return p;
  });

  const mappedStaffPicks = STAFF_PICKS.map(p => {
    if (isFiji) {
      const fijiOwners: { [key: string]: string } = {
        'Zac Zotic': 'South Pacific Rentals (Suva)',
        'Bogdan Rental': 'Fiji Film Equipment Hire',
        'Sum of Parts LLC': 'Fiji Television Ltd'
      };
      return {
        ...p,
        ownerName: fijiOwners[p.ownerName || ''] || 'Sandy Cay Camera Co',
        price: Math.round(p.price * 2.2)
      };
    }
    return p;
  });

  const mappedCrews = CREW_LIST.map(c => {
    if (isFiji) {
      const fijiCrews: { [key: string]: { name: string; title: string; skills: string[]; bio: string } } = {
        'Ecarum Sumpter': {
          name: 'Savenaca Ravula',
          title: 'Senior Coral Reef Videographer & Drone Pilot',
          skills: ['CAA Fiji Certified Drone Operator', 'Underwater Housing Specialist', 'Fiji Event Director'],
          bio: 'Bula Vinaka! Professional Director of Photography with 10+ years capturing deep oceans, marine sanctuaries, and local documentaries inside Viti Levu.'
        },
        'Sean Chow': {
          name: 'Jone Vakaloloma',
          title: 'Suva Broadcast Cinematographer',
          skills: ['Directing', 'Fiji TV Broadcast Operator', 'Steadicam Expert'],
          bio: 'Lead camera operator on major Pacific regional meetings, Fiji television news, and local cinema reels.'
        },
        'Trent Mills': {
          name: 'Elena Tagivakatini',
          title: 'Creative Director & South Pacific Producer',
          skills: ['Film Producer', 'Cultural Advisor', 'Sound Designer'],
          bio: 'Specializing in Fiji-local cultural clearances, production logistics, talent sourcing, and commercial storytelling.'
        },
        'Abel Garcia Rodriguez': {
          name: 'Amit Patel',
          title: 'Commercial Film and Wedding Producer',
          skills: ['Multi-day Event Coordination', 'Production Management', 'Lighting Arranger'],
          bio: 'Based in Lautoka. Expert coordinator for grand wedding videography, corporate events, and hotel advertising.'
        },
        'Rhys Kroehler': {
          name: 'Samuela Rokotakala',
          title: 'Ocean Documentary Filmmaker',
          skills: ['Underwater Cameraman', 'Water Safety Officer', 'Colorist'],
          bio: 'BFA recipient from USP. Specialized in marine preservation features, marine biology expedition logging, and island cinematography.'
        }
      };
      const mapped = fijiCrews[c.name] || { name: c.name, title: c.title, skills: c.skills, bio: c.bio };
      return {
        ...c,
        ...mapped
      };
    }
    return c;
  });

  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);
  
  // Filtering & Modal parameters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [selectedCrew, setSelectedCrew] = useState<CrewItem | null>(null);
  
  // Custom interactive flow state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingDays, setBookingDays] = useState(3);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<number>>(new Set());
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [crewMessageText, setCrewMessageText] = useState('');
  
  // Categories reference carousel scroll indices
  const [categoryScrollIndex, setCategoryScrollIndex] = useState(0);

  // Search suggestions that appear dynamically as user types
  const popularKeywords = ['fx6', 'fx3', 'camera', 'sony fx6 full-frame cinema camera', 'sony fx3 full-frame cinema camera'];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!isBookingModalOpen) {
      setSelectedAddOns(new Set());
    }
  }, [isBookingModalOpen]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newFavs = new Set(favoriteItems);
    if (newFavs.has(id)) {
      newFavs.delete(id);
      toast.info('Removed from saved wishlist');
    } else {
      newFavs.add(id);
      toast.success('Added to saved wishlist!');
    }
    setFavoriteItems(newFavs);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(`Booking request sent for ${selectedProduct?.name}! Total Estimated Rental: ${currencySymbol}${(selectedProduct?.price || 0) * bookingDays}.`);
    setIsBookingModalOpen(false);
    setSelectedProduct(null);
  };

  const handleMessageCrewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(`Inquiry dispatched to ${selectedCrew?.name}! They average response time under 1 hour.`);
    setIsMessageModalOpen(false);
    setCrewMessageText('');
    setSelectedCrew(null);
  };

  // Dynamic categories and industry filter logic
  const activeIndustryFilter = (item: any) => {
    if (selectedIndustry === 'all') return true;
    const itemInd = item.industry || 'production';
    return itemInd === selectedIndustry;
  };

  const allRentals = [
    ...userListings.filter(l => !l.isSale),
    ...mappedPopularProducts.map(p => ({ ...p, industry: 'production' })),
    ...mappedShippedProducts.map(p => ({ ...p, industry: 'production' })),
    ...mappedStaffPicks.map(p => ({ ...p, industry: 'production' })),
    ...MULTI_INDUSTRY_PRODUCTS.filter(p => !p.isSale)
  ].filter(activeIndustryFilter);

  const allSales = [
    ...userListings.filter(l => l.isSale),
    ...mappedSalesProducts.map(p => ({ ...p, industry: 'production' })),
    ...MULTI_INDUSTRY_PRODUCTS.filter(p => p.isSale)
  ].filter(activeIndustryFilter);

  const getCategoriesList = () => {
    if (selectedIndustry === 'all') {
      return [...CATEGORIES, ...EXTRA_CATEGORIES];
    } else if (selectedIndustry === 'production') {
      return CATEGORIES;
    } else {
      if (selectedIndustry === 'construction') {
        return EXTRA_CATEGORIES.slice(0, 4);
      } else if (selectedIndustry === 'automotive') {
        return EXTRA_CATEGORIES.slice(4, 8);
      } else if (selectedIndustry === 'medical') {
        return EXTRA_CATEGORIES.slice(8, 12);
      } else if (selectedIndustry === 'general_logistics') {
        return EXTRA_CATEGORIES.slice(12, 15);
      }
      return EXTRA_CATEGORIES;
    }
  };

  const activeCategories = getCategoriesList();

  const filteredProducts = (currentMode === 'rent' ? allRentals : allSales)
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.model.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? item.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'price-asc') {
        return a.price - b.price;
      } else if (sortBy === 'price-desc') {
        return b.price - a.price;
      } else if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      } else if (sortBy === 'reviews') {
        return (b.reviews || 0) - (a.reviews || 0);
      }
      
      // Prioritize Sponsored Ads first, then Featured items, then custom priority sorting
      if (a.sponsored && !b.sponsored) return -1;
      if (!a.sponsored && b.sponsored) return 1;
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      const weightA = a.featuredPriority || 0;
      const weightB = b.featuredPriority || 0;
      return weightB - weightA;
    });

  return (
    <div id="marketplace-landing-root" className="min-h-screen bg-white text-neutral-900 pb-20 font-sans selection:bg-neutral-900 selection:text-white">
      
      {isFiji && (
        <div id="fiji-soft-launch-ribbon" className="bg-[#101f18] text-emerald-400 border-b border-emerald-900/40 text-center py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-md">
          <Globe size={12} className="animate-pulse" />
          <span>🌴 Bula Vinaka! Welcome to Fiji's Dedicated Packer Tools Marketplace Hub</span>
          <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded text-[8px] font-black tracking-wider ml-1">FJD OPERATIONAL</span>
        </div>
      )}
      {!isAuthorized && (
        <div id="unauthorized-launch-ribbon" className="bg-neutral-950 text-amber-500 border-b border-amber-900/30 text-center py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-md">
          <Globe size={12} />
          <span>⚠️ Soft Launch Notice: Active marketplace services are prioritized in {launchCountry}. Some features may be restricted for {user?.country || 'your current region'}.</span>
        </div>
      )}
      
      {/* 1. TOP PREMIUM GRADIENT HERO BANNER */}
      <div 
        id="marketplace-hero-section"
        className="relative bg-[#2e1d2c] bg-radial-gradient text-white overflow-hidden py-24 px-6 md:px-12 text-center"
        style={{
          backgroundImage: `linear-gradient(rgba(46, 29, 44, 0.85), rgba(24, 15, 23, 0.95)), url('https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?auto=format&fit=crop&q=80&w=1600')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[150px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Brand Header */}
        <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto absolute top-6 left-6 right-6 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-lg">
              P
            </div>
            <span className="font-bold uppercase tracking-wider text-sm">Packer Marketplace</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-neutral-300">New around here?</span>
            <button 
              onClick={() => toast.success("Sign up simulation - enterprise access authorized.")}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white"
            >
              Start Earning
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto mt-6 space-y-6 relative z-10">
          <div className="space-y-4">
             <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-[#ff4f3a]">
               <Flame size={12} className="animate-pulse" />
               <span>{heroSubtitle}</span>
             </div>
             <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
               {heroTitle}
             </h1>
             {heroDescription && (
               <p className="text-sm md:text-base text-neutral-300 font-semibold max-w-2xl mx-auto leading-relaxed uppercase tracking-wide">
                 {heroDescription}
               </p>
             )}
          </div>

          {/* Mode Switcher Rent vs Buy */}
          <div className="flex justify-center">
            <div className="bg-neutral-900/60 p-1 rounded-xl flex items-center border border-white/10 backdrop-blur-md">
              <button
                onClick={() => {
                  setCurrentMode('rent');
                  toast.info("Switched to Rent mode");
                }}
                className={`px-5 py-2 rounded-lg text-xs font-bold uppercase transition-all duration-200 ${currentMode === 'rent' ? 'bg-[#ff4f3a] text-white shadow-xl' : 'text-neutral-300 hover:text-white'}`}
              >
                Rent
              </button>
              <button
                onClick={() => {
                  setCurrentMode('buy');
                  toast.info("Switched to Buy & Sell mode");
                }}
                className={`px-5 py-2 rounded-lg text-xs font-bold uppercase transition-all duration-200 ${currentMode === 'buy' ? 'bg-[#ff4f3a] text-white shadow-xl' : 'text-neutral-300 hover:text-white'}`}
              >
                Buy
              </button>
            </div>
          </div>

          {/* Integrated Search Box */}
          <div className="max-w-2xl mx-auto bg-neutral-900/90 border border-white/10 rounded-2xl p-2 md:p-3 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center gap-2">
            
            {/* Search Input Field */}
            <div className="w-full flex items-center gap-2 px-3 py-2 border-b md:border-b-0 md:border-r border-white/10">
              <Search size={16} className="text-neutral-400 shrink-0" />
              <input
                type="text"
                placeholder="Search gear (e.g. Sony FX6, RED, Alexa...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-white text-sm outline-none placeholder-neutral-500 font-semibold"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-white/10 rounded-full text-neutral-400">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Location Select (Aesthetic) */}
            <div className="w-full flex items-center gap-2 px-3 py-2 shrink-0 md:max-w-[200px]">
              <MapPin size={16} className="text-[#ff4f3a] shrink-0" />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                className="w-full bg-transparent text-white text-sm outline-none font-semibold"
              />
            </div>

            {/* Submit Dynamic search triggers drawer/filters */}
            <button
              onClick={() => {
                setIsSearchDrawerOpen(true);
                toast.success(`Refined filters loaded for "${searchQuery || 'All items'}"`);
              }}
              className="w-full md:w-auto bg-[#ff4f3a] hover:bg-[#e43f2a] active:scale-95 text-white font-bold uppercase tracking-wider text-xs px-6 py-3.5 rounded-xl transition duration-150 shrink-0 flex items-center justify-center gap-2 shadow-lg"
            >
              <Search size={14} />
              <span>Search</span>
            </button>
          </div>

          {/* Members section logos displaying high quality partners */}
          <div className="pt-6 space-y-3.5 opacity-60">
            <p className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">{partnerLogosText}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-xs font-black tracking-wider text-neutral-300">
              {partnerLogosList.map((logo, index) => (
                <span key={index} className="hover:text-white transition cursor-default uppercase">{logo}</span>
              ))}
            </div>
          </div>

        </div>

        {/* Dynamic drawer activation indicator trigger button floating on side */}
        <div className="absolute right-0 bottom-4 z-20">
          <button
            onClick={() => setIsSearchDrawerOpen(true)}
            className="flex items-center gap-2 bg-[#ff4f3a] text-white text-[10px] font-black uppercase tracking-widest py-2.5 px-4 rounded-l-xl opacity-90 hover:opacity-100 transition shadow-lg shrink-0"
          >
            <SlidersHorizontal size={12} />
            <span>Open Filters Drawer</span>
          </button>
        </div>
      </div>

      {/* SEARCH FILTERS DRAWER (INTEGRATED INTERACTIVE COMPONENT MATCHING SCREENSHOT 2) */}
      <AnimatePresence>
        {isSearchDrawerOpen && (
          <div className="fixed inset-0 z-[600] flex justify-start">
            
            {/* Dark blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchDrawerOpen(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Left Drawer Container body */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 200 }}
              className="relative w-full max-w-[340px] h-full bg-[#1b191c] text-white shadow-2xl border-r border-neutral-800 flex flex-col justify-between overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-[#ff4f3a]" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Search Filters</h3>
                </div>
                <button 
                  onClick={() => setIsSearchDrawerOpen(false)}
                  className="p-1 px-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Scrollable Body Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Mode selection */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Listing Type</p>
                  <div className="grid grid-cols-2 gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                    <button
                      onClick={() => setCurrentMode('rent')}
                      className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition ${currentMode === 'rent' ? 'bg-[#ff4f3a] text-white' : 'text-neutral-400 hover:text-white'}`}
                    >
                      Rent
                    </button>
                    <button
                      onClick={() => setCurrentMode('buy')}
                      className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition ${currentMode === 'buy' ? 'bg-[#ff4f3a] text-white' : 'text-neutral-400 hover:text-white'}`}
                    >
                      Buy
                    </button>
                  </div>
                </div>

                {/* 2. Location details chip select */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Pickup Preference</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button 
                      onClick={() => toast.success("Pickup selected")}
                      className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 text-[9px] font-extrabold uppercase rounded-lg text-[#ff4f3a]"
                    >
                      Pickup + Ship
                    </button>
                    <button 
                      onClick={() => {
                        setLocationQuery('Los Angeles, CA');
                        toast.success("Default Location set to LA.");
                      }}
                      className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 text-[9px] font-extrabold uppercase rounded-lg text-neutral-300"
                    >
                      LA Range
                    </button>
                    <button 
                      onClick={() => toast.success("Interactive date ranges enabled.")}
                      className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 text-[9px] font-extrabold uppercase rounded-lg text-neutral-300"
                    >
                      Select Dates
                    </button>
                  </div>
                </div>

                {/* 3. Text search within drawer */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Keyword Search</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. Cinema rig..."
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 pl-9 pr-4 text-xs font-semibold outline-none focus:border-neutral-700 text-white placeholder-neutral-600"
                    />
                    <Search size={14} className="absolute left-3 top-3.5 text-neutral-500" />
                  </div>
                </div>

                {/* 4. Popular Searches matches exact lists (From Screenshot 2) */}
                <div className="space-y-2.5">
                  <p className="text-[10px] font-black tracking-widest text-[#ff4f3a] uppercase">Popular Searches</p>
                  <div className="flex flex-wrap gap-2">
                    {popularKeywords.map((keyword, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSearchQuery(keyword);
                          toast.success(`Filtered list for: ${keyword}`);
                        }}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-[10px] text-neutral-300 transition shrink-0 uppercase tracking-wider text-left line-clamp-1 truncate max-w-full font-semibold"
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Clear filter button */}
                {(searchQuery || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                      toast.success("Surgical search filters wiped clean!");
                    }}
                    className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest rounded-xl transition text-center shrink-0 border border-neutral-800"
                  >
                    Clear All Filters
                  </button>
                )}

              </div>

              {/* Drawer Footer info details */}
              <div className="p-6 bg-neutral-900 border-t border-neutral-800/80 text-[9px] font-mono tracking-widest uppercase text-neutral-500 shrink-0">
                Active Listings Count: {filteredProducts.length}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* 2. EXPLORE LAYOUT PANEL (Rentals, Buy-Sell, Gigs, Locations - MATCHING SCREENSHOT 1) */}
      <div id="explore-cards-section" className="max-w-7xl mx-auto px-6 md:px-12 py-12 space-y-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 uppercase">Explore Packer Marketplace</h2>
          <p className="text-xs text-neutral-400 font-semibold uppercase mt-1 tracking-wider">On-demand production components & services</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Rentals */}
          <div 
            onClick={() => {
              setCurrentMode('rent');
              setSearchQuery('');
              setSelectedCategory(null);
              toast.info("Viewing local gear rentals.");
              const section = document.getElementById('marketplace-products-display');
              if (section) section.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group cursor-pointer border border-neutral-100 bg-neutral-50/40 hover:bg-white hover:border-neutral-200 p-5 rounded-2xl transition duration-200 flex items-start gap-4 shadow-xs"
          >
            <div className="w-10 h-10 bg-indigo-50 text-[#ff4f3a] rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <Camera size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-neutral-800 tracking-tight">Rentals</p>
              <p className="text-[10px] text-neutral-400 font-semibold uppercase mt-0.5">Local gear rentals</p>
            </div>
          </div>

          {/* Card 2: Buy & Sell */}
          <div 
            onClick={() => {
              setCurrentMode('buy');
              setSearchQuery('');
              setSelectedCategory(null);
              toast.info("Viewing buy & sell marketplace.");
              const section = document.getElementById('marketplace-products-display');
              if (section) section.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group cursor-pointer border border-neutral-100 bg-neutral-50/40 hover:bg-white hover:border-neutral-200 p-5 rounded-2xl transition duration-200 flex items-start gap-4 shadow-xs"
          >
            <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <ShoppingBag size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-neutral-800 tracking-tight">Buy & Sell</p>
              <p className="text-[10px] text-neutral-400 font-semibold uppercase mt-0.5">New & used gear</p>
            </div>
          </div>

          {/* Card 3: Gigs (Hiring) */}
          <div 
            onClick={() => {
              toast.info("Scrolling down to active Freelancers directory");
              const section = document.getElementById('marketplace-crew-display');
              if (section) section.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group cursor-pointer border border-neutral-100 bg-neutral-50/40 hover:bg-white hover:border-neutral-200 p-5 rounded-2xl transition duration-200 flex items-start gap-4 shadow-xs"
          >
            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <UserCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-neutral-800 tracking-tight">Gigs</p>
              <p className="text-[10px] text-neutral-400 font-semibold uppercase mt-0.5">Hire local creatives</p>
            </div>
          </div>

          {/* Card 4: Locations */}
          <div 
            onClick={() => {
              toast.info("Opening map visualization. Over 1,500 qualified studios catalogued");
            }}
            className="group cursor-pointer border border-neutral-100 bg-neutral-50/40 hover:bg-white hover:border-neutral-200 p-5 rounded-2xl transition duration-200 flex items-start gap-4 shadow-xs"
          >
            <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <MapPin size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-neutral-800 tracking-tight">Locations</p>
              <p className="text-[10px] text-neutral-400 font-semibold uppercase mt-0.5">For Film, Photo & Editing</p>
            </div>
          </div>

        </div>
      </div>


      {/* 3. DUAL ADVERTISING PROMOTION BANNERS (INSIGHTS AND STUDENT DISCOUNTS - MATCHING SCREENSHOT 1) */}
      {showPromotions && (
        <div id="marketplace-promotions" className="max-w-7xl mx-auto px-6 md:px-12 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Banner A */}
            <div className="bg-[#101524] text-white rounded-[2rem] overflow-hidden p-8 flex flex-col md:flex-row justify-between items-center gap-6 border border-neutral-850 shadow-xl relative">
              <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-sky-500/10 blur-[60px] pointer-events-none" />
              <div className="space-y-4 max-w-sm">
                <span className="inline-block bg-[#ff4f3a] text-white font-extrabold text-[8px] uppercase tracking-widest px-3 py-1 rounded-full">
                  ★ NEW FOR 2026
                </span>
                <h3 className="text-3xl font-black uppercase tracking-tight leading-tight">
                  {bannerATitle}
                </h3>
                <p className="text-neutral-400 text-xs font-medium leading-relaxed uppercase">
                  {bannerASubtitle}
                </p>
                <button 
                  onClick={() => toast.success("Feature action simulated inside this sandbox!")}
                  className="bg-white hover:bg-neutral-100 text-neutral-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition transform active:scale-95 text-center block md:inline-block"
                >
                  {bannerAButtonText}
                </button>
              </div>
              
              {/* Image visual object */}
              {bannerAImage && (
                <div className="w-48 h-40 relative rounded-2xl overflow-hidden shadow-2xl bg-neutral-900 border border-white/5">
                  <img 
                    src={bannerAImage} 
                    alt="Promo Banner object" 
                    className="w-full h-full object-cover object-center grayscale hover:grayscale-0 transition duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>

            {/* Banner B */}
            <div className="bg-[#1a1b35] text-white rounded-[2rem] overflow-hidden p-8 flex flex-col md:flex-row justify-between items-center gap-6 border border-neutral-850 shadow-xl relative">
              <div className="absolute bottom-0 left-0 w-[150px] h-[150px] bg-indigo-500/10 blur-[60px] pointer-events-none" />
              <div className="space-y-4 max-w-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black">∞</div>
                  <span className="font-extrabold text-[9px] uppercase tracking-widest text-[#ff4f3a]">
                    {requiresEduVerification ? "Verification Active" : "Special Rate Offer"}
                  </span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">
                  {bannerBTitle}
                </h3>
                <p className="text-neutral-400 text-xs font-medium leading-relaxed uppercase">
                  {bannerBSubtitle}
                </p>
                <button 
                  onClick={() => toast.success("Verification dialog activated in user workspace.")}
                  className="bg-[#ff4f3a] hover:bg-[#e43f2a] text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition transform active:scale-95 text-center block md:inline-block"
                >
                  {bannerBButtonText}
                </button>
              </div>

              {/* Image visual object */}
              {bannerBImage && (
                <div className="w-48 h-40 relative rounded-2xl overflow-hidden shadow-2xl bg-neutral-900 border border-white/5">
                  <img 
                    src={bannerBImage} 
                    alt="Promo Banner Operator" 
                    className="w-full h-full object-cover object-center transform hover:scale-105 transition duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      )}


      {/* Dynamic Industry Filter & Layout Selector Header */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 border-b border-neutral-150 bg-neutral-50/20 mb-4 rounded-3xl">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase text-[#ff4f3a] tracking-widest">Industry focus switcher</p>
              <h3 className="text-sm font-extrabold text-neutral-800 uppercase tracking-tight mt-0.5">Select Sector Ecosystem</h3>
            </div>
            
            {/* View Grid/List & Sorting selector */}
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* SortingDropdown */}
              <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-xl px-3 py-1.5 shadow-xs">
                <ArrowUpDown size={11} className="text-neutral-400" />
                <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    toast.success(`Sorting updated: ${e.target.value}`);
                  }}
                  className="bg-transparent text-[10px] font-bold text-neutral-700 outline-none cursor-pointer uppercase pr-1"
                >
                  <option value="default">Default Priority</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Rating (Highest first)</option>
                  <option value="reviews">Reviews count</option>
                </select>
              </div>

              {/* View Layout Toggle */}
              <div className="flex bg-neutral-100 p-0.5 rounded-xl border border-neutral-200">
                <button
                  onClick={() => setViewType('grid')}
                  className={`p-1.5 rounded-lg ${viewType === 'grid' ? 'bg-white text-primary shadow-xs' : 'text-neutral-400 hover:text-neutral-600'}`}
                  title="Grid Layout View"
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  onClick={() => setViewType('list')}
                  className={`p-1.5 rounded-lg ${viewType === 'list' ? 'bg-white text-primary shadow-xs' : 'text-neutral-400 hover:text-neutral-600'}`}
                  title="List Layout View"
                >
                  <List size={13} />
                </button>
              </div>

            </div>
          </div>

          {/* Industry Buttons Swiper with scrollbar-none */}
          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none snap-x whitespace-nowrap scroll-smooth">
            {INDUSTRIES_MARKET.map((ind) => {
              const isSelected = selectedIndustry === ind.id;
              return (
                <button
                  key={ind.id}
                  onClick={() => {
                    setSelectedIndustry(ind.id);
                    setSelectedCategory(null);
                    toast.success(`Active industry changed to: ${ind.name}`);
                  }}
                  className={`px-4 py-2 rounded-2xl border text-[10px] font-extrabold uppercase transition duration-200 tracking-wider shrink-0 snap-align-start ${
                    isSelected 
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-md' 
                      : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {ind.name}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* 4. DESIGN BROWSE CATEGORIES CAROUSEL (MATCHING SCREENSHOT 3) */}
      {showCategories && (
        <div id="marketplace-categories-section" className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-6">
          <div className="flex items-end justify-between border-b border-neutral-100 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-neutral-900 uppercase tracking-tight">Browse Categories</h2>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-1">Near {locationQuery}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  toast.success("Filters reset: showing all categories.");
                }}
                className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 hover:text-black transition"
              >
                View All Categories
              </button>
              <div className="flex gap-1">
                <button 
                  onClick={() => toast.info("Hold & drag to scroll categories horizontally.")}
                  className="w-7 h-7 bg-neutral-50 hover:bg-neutral-100 rounded-full flex items-center justify-center border border-neutral-200 text-neutral-600 transition"
                >
                  <ChevronLeft size={14} />
                </button>
                <button 
                  onClick={() => toast.info("Swipe panels to review more items.")}
                  className="w-7 h-7 bg-neutral-50 hover:bg-neutral-100 rounded-full flex items-center justify-center border border-neutral-200 text-neutral-600 transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Categories grid horizontal layout */}
          <div className="flex overflow-x-auto gap-4 py-2 pr-4 scrollbar-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {activeCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <div 
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(isSelected ? null : cat.id);
                    toast.success(isSelected ? "Cleared category filter" : `Showing ${cat.name} only`);
                  }}
                  className={`flex-none w-[170px] bg-neutral-50 hover:bg-white cursor-pointer rounded-2xl p-3 border hover:border-neutral-300 hover:shadow-md transition duration-200 space-y-3 shrink-0 ${isSelected ? 'border-[#ff4f3a] bg-rose-50/10' : 'border-neutral-100'}`}
                >
                  {/* Category block thumb */}
                  <div className="w-full h-24 overflow-hidden rounded-xl bg-neutral-100 relative">
                    <img 
                      src={cat.image} 
                      alt={cat.name} 
                      className="w-full h-full object-cover transform hover:scale-110 transition duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-1.5 right-1.5 bg-neutral-900/80 text-white font-mono text-[7.5px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
                      {cat.count.toLocaleString()} Listings
                    </div>
                  </div>
                  <div className="space-y-0.5 px-0.5">
                    <p className="text-[10px] font-black uppercase text-neutral-800 line-clamp-1 truncate">{cat.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* 5. INTERACTIVE PRODUCTS DISPLAY PANELS FOR SELECTION (RENTALS, SHIPPING & BUY COMPILATIONS) */}
      <div id="marketplace-products-display" className="max-w-7xl mx-auto px-6 md:px-12 py-6 space-y-12">
        
        {/* Dynamic header summary matching current mode toggles */}
        <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff4f3a]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">
                Viewing: {currentMode === 'rent' ? 'Popular Equipment for Rent' : 'Hot Equipment Listings for Sale'}
              </h3>
            </div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              Filtered to: <span className="text-black font-black">{selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : 'All Categories'}</span> 
              {searchQuery && ` containing query "${searchQuery}"`}
            </p>
          </div>

          <div className="flex gap-2">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-[9px] font-black uppercase tracking-wider hover:bg-neutral-100 transition"
              >
                Clear Category Filter
              </button>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-[9px] font-black uppercase tracking-wider hover:bg-neutral-100 transition"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>

        {/* 5A. CURRENT MODE FILTERED PRODUCTS GRID */}
        <div className="space-y-6">
          <div className="flex items-center justify-between uppercase">
            <h3 className="text-sm font-black tracking-widest text-[#ff4f3a]">
              {currentMode === 'rent' ? 'Popular Products for Rent' : 'Equipment Listed for Sale'}
            </h3>
            <span className="text-[9px] font-mono font-bold text-neutral-400">Total Items: {filteredProducts.length}</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-neutral-100 rounded-[2rem] space-y-4">
              <ShieldAlert size={32} className="mx-auto text-neutral-300 animate-pulse" />
              <p className="text-[10px] font-black tracking-widest uppercase">No exact matches in catalog database</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  toast.success("Filters cleared!");
                }}
                className="bg-neutral-900 text-white rounded-xl py-2 px-4 text-[9px] font-black tracking-widest uppercase"
              >
                Reset Searches
              </button>
            </div>
          ) : viewType === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredProducts.map((product) => {
                const isFav = favoriteItems.has(product.id);
                return (
                  <div 
                    key={product.id}
                    onClick={() => {
                      if (product.isUserListing) {
                        navigate('/marketplace/' + product.id);
                      } else {
                        setSelectedProduct(product);
                        setIsBookingModalOpen(true);
                      }
                    }}
                    className={`group cursor-pointer bg-white rounded-2xl overflow-hidden hover:shadow-xl transition duration-300 flex flex-col justify-between ${
                      product.sponsored ? 'border-2 border-indigo-600/30 bg-indigo-50/5' :
                      product.featured ? 'border-2 border-amber-500/30' : 'border border-neutral-100'
                    }`}
                  >
                    {/* Item Image with favorite trigger */}
                    <div className="h-44 w-full bg-neutral-50 relative overflow-hidden shrink-0">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Top elements */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                        {product.sponsored ? (
                          <span className="bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wide shadow-sm flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                            Sponsored Ad
                          </span>
                        ) : product.featured ? (
                          <span className="bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wide shadow-sm">
                            ★ Staff Pick
                          </span>
                        ) : product.isSale ? (
                          <span className="bg-[#ff4f3a] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wide shadow-sm">
                            For Sale
                          </span>
                        ) : product.instantBook ? (
                          <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wide shadow-sm">
                            Instant Book
                          </span>
                        ) : (
                          <span className="bg-neutral-900/60 text-white text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide backdrop-blur-md">
                            Daily Rent
                          </span>
                        )}

                        <button
                          onClick={(e) => toggleFavorite(product.id, e)}
                          className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-neutral-500 hover:text-[#ff4f3a] transition shadow shadow-neutral-350"
                        >
                          <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                        </button>
                      </div>

                      {/* Bottom shipping banner */}
                      {product.isShipped && (
                        <div className="absolute bottom-0 left-0 right-0 bg-blue-650/90 bg-indigo-900 text-white text-center py-1 text-[7.5px] uppercase tracking-widest font-black">
                          🚚 {product.shippingDays}-5 Days Shipped Delivery
                        </div>
                      )}
                    </div>

                    {/* Meta data */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <p className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
                          {product.brand}
                        </p>
                        <h4 className="text-[10.5px] font-black uppercase text-neutral-800 line-clamp-2 leading-snug group-hover:text-black" title={product.name}>
                          {product.name}
                        </h4>
                        {product.sponsored && product.adHeadline && (
                          <div className="mt-1.5 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[8px] font-extrabold text-indigo-700 select-none leading-normal">
                            📢 {product.adHeadline}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {/* Rating row */}
                        <div className="flex items-center gap-1">
                          <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                          <span className="text-[9.5px] font-black text-neutral-700">{product.rating}</span>
                          <span className="text-[8.5px] text-neutral-400 font-bold uppercase">({product.reviews} reviews)</span>
                        </div>

                        {/* Owner details */}
                        {product.ownerName && (
                          <div className="flex items-center gap-1 border-t border-neutral-100 pt-1.5 text-[8.5px] text-neutral-400 font-bold uppercase tracking-wider">
                            <span>Owner: </span>
                            <span className="text-neutral-600 truncate">{product.ownerName}</span>
                          </div>
                        )}

                        {/* Pricing details */}
                        <div className="flex items-baseline justify-between pt-1 border-t border-neutral-50">
                          <div>
                            <span className="text-sm font-black text-neutral-900">
                              {currencySymbol}{product.price ? product.price.toLocaleString() : 'Call'}
                            </span>
                            <span className="text-[8.5px] text-neutral-400 font-bold uppercase ml-0.5">
                              {product.isSale ? '' : '/day'}
                            </span>
                          </div>
                          
                          {product.originalPrice && (
                            <span className="text-[9px] text-neutral-400 line-through font-bold">
                              {currencySymbol}{product.originalPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Premium List View Row Layout */
            <div className="flex flex-col gap-4">
              {filteredProducts.map((product) => {
                const isFav = favoriteItems.has(product.id);
                return (
                  <div 
                    key={product.id}
                    onClick={() => {
                      if (product.isUserListing) {
                        navigate('/marketplace/' + product.id);
                      } else {
                        setSelectedProduct(product);
                        setIsBookingModalOpen(true);
                      }
                    }}
                    className={`group cursor-pointer bg-white rounded-2xl overflow-hidden hover:shadow-xl transition duration-300 border p-4 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center ${
                      product.sponsored ? 'border-indigo-600/30 bg-indigo-55/10 bg-indigo-50/5' :
                      product.featured ? 'border-amber-500/30' : 'border-neutral-100'
                    }`}
                  >
                    {/* List Left: Visual image frame */}
                    <div className="h-32 w-full sm:w-44 bg-neutral-50 relative overflow-hidden rounded-xl shrink-0">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                      
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {product.sponsored ? (
                          <span className="bg-indigo-600 text-white text-[6.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide font-mono">
                            Sponsored
                          </span>
                        ) : product.featured ? (
                          <span className="bg-amber-500 text-white text-[6.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide font-mono">
                            ★ Staff Pick
                          </span>
                        ) : product.isSale ? (
                          <span className="bg-[#ff4f3a] text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide font-mono">
                            For Sale
                          </span>
                        ) : null}
                      </div>

                      <button
                        onClick={(e) => toggleFavorite(product.id, e)}
                        className="absolute bottom-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-neutral-500 hover:text-[#ff4f3a] transition shadow"
                      >
                        <Heart size={12} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                      </button>
                    </div>

                    {/* List Middle: Descriptive items */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[8.5px] font-mono font-bold text-neutral-400 uppercase tracking-widest">{product.brand}</span>
                        {product.industry && (
                          <span className="text-[7.5px] bg-neutral-100 text-neutral-500 font-extrabold uppercase px-1.5 py-0.2 rounded tracking-wide font-mono">
                            {product.industry}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-black uppercase text-neutral-800 line-clamp-1 leading-snug group-hover:text-black">
                        {product.name}
                      </h4>
                      
                      {/* Rating details & Owner details in list format */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                          <span className="text-[9.5px] font-black text-neutral-700">{product.rating}</span>
                          <span className="text-[8.5px] text-neutral-400 font-bold uppercase">({product.reviews} reviews)</span>
                        </div>
                        {product.ownerName && (
                          <div className="hidden sm:block text-[8.5px] text-neutral-400 font-bold uppercase tracking-wider">
                            <span>Owner: </span>
                            <span className="text-neutral-600">{product.ownerName}</span>
                          </div>
                        )}
                        {product.isShipped && (
                          <span className="text-[7.5px] bg-indigo-50 text-indigo-750 text-indigo-650 font-black uppercase px-2 py-0.5 rounded">
                            🚚 Priority Shipping Available
                          </span>
                        )}
                      </div>

                      {product.sponsored && product.adHeadline && (
                        <p className="text-[9px] font-semibold text-indigo-600">📢 {product.adHeadline}</p>
                      )}
                    </div>

                    {/* List Right: Dynamic pricing and book button */}
                    <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-3 shrink-1 sm:shrink-0 w-full sm:w-auto border-t sm:border-t-0 border-neutral-150 pt-3 sm:pt-0">
                      <div className="text-right">
                        <p className="text-[8.5px] text-neutral-400 font-bold uppercase">Estimated rate</p>
                        <div className="flex items-baseline justify-end">
                          <span className="text-base font-black text-neutral-900 leading-none">
                            {currencySymbol}{product.price ? product.price.toLocaleString() : 'Call'}
                          </span>
                          <span className="text-[8.5px] text-neutral-400 font-bold uppercase ml-0.5">
                            {product.isSale ? '' : '/day'}
                          </span>
                        </div>
                      </div>

                      <button
                        className="bg-neutral-900 text-white rounded-xl py-1.5 px-4 text-[9px] font-black tracking-widest uppercase hover:bg-[#ff4f3a] transition duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(product);
                          setIsBookingModalOpen(true);
                        }}
                      >
                        {product.isSale ? 'Inquire' : 'Rent Now'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5B. RENTALS SHIPPED TO YOU (ONLY VISIBLE ON RENT MODE - MATCHING SCREENSHOT 3) */}
        {currentMode === 'rent' && (
          <div className="space-y-6 pt-6 border-t border-neutral-100">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[#ff4f3a]">Rentals Shipped to You</h3>
              <p className="text-[10px] text-neutral-400 font-bold uppercase mt-1 tracking-wider">Rentals shipped directly to your doorstep with damage protection</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {mappedShippedProducts.slice(0, 5).map((product) => {
                const isFav = favoriteItems.has(product.id);
                return (
                  <div 
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsBookingModalOpen(true);
                    }}
                    className="group cursor-pointer bg-white rounded-2xl border border-neutral-100 overflow-hidden hover:border-neutral-300 hover:shadow-xl transition duration-200 flex flex-col justify-between"
                  >
                    <div className="h-40 w-full bg-neutral-50 relative overflow-hidden shrink-0">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                        <span className="bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded">
                          Shipped
                        </span>
                        <button
                          onClick={(e) => toggleFavorite(product.id, e)}
                          className="w-6 h-6 bg-white/95 rounded-full flex items-center justify-center text-neutral-500 hover:text-[#ff4f3a]"
                        >
                          <Heart size={12} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-indigo-900 text-white text-center py-1 text-[7px] uppercase tracking-widest font-black">
                        3-5 Days Free Express
                      </div>
                    </div>

                    <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <p className="text-[8px] font-mono text-neutral-400 uppercase tracking-widest">{product.brand}</p>
                        <h4 className="text-[10px] font-black uppercase text-neutral-800 line-clamp-1">{product.name}</h4>
                      </div>

                      <div className="space-y-1 text-[8.5px] font-bold text-neutral-500 uppercase">
                        <div>Price: <span className="text-neutral-900 font-extrabold">{currencySymbol}{product.price}/day</span></div>
                        <div className="truncate">Source: {product.ownerName}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>


      {/* 6. NEW CREW AND FREELANCE MULTIMEDIA DIRECTORY (MATCHING SCREENSHOT 4 & 5) */}
      <div id="marketplace-crew-display" className="bg-neutral-50 py-16 border-y border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-10">
          
          <div className="flex items-end justify-between border-b border-neutral-200 pb-5">
            <div>
              <span className="bg-[#ff4f3a] text-white text-[8px] tracking-widest uppercase font-black py-1 px-2.5 rounded-full">
                Creative Marketplace
              </span>
              <h2 className="text-xl font-extrabold text-neutral-900 uppercase tracking-tight mt-3">
                New Crew in {locationQuery}
              </h2>
              <p className="text-xs text-neutral-400 font-semibold uppercase mt-1 tracking-wider">
                Hire local cinematographers, editors & production support instantly
              </p>
            </div>

            <button
              onClick={() => toast.info("Full roster loaded. Total of 98 certified operators available in Area range.")}
              className="text-[10px] font-black uppercase tracking-widest text-[#ff4f3a] hover:text-[#d33a28] transition"
            >
              View All Skills
            </button>
          </div>

          {/* Cards list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {mappedCrews.map((crew) => (
              <div 
                key={crew.id}
                className="bg-white rounded-[2rem] border border-neutral-205 p-6 flex flex-col justify-between gap-5 hover:shadow-xl transition-all hover:border-black"
              >
                <div className="space-y-4">
                  {/* Avatar and Info Header */}
                  <div className="relative">
                    <div className="w-16 h-16 bg-neutral-100 rounded-2xl overflow-hidden shadow-inner border border-neutral-150">
                      <img 
                        src={crew.image} 
                        alt={crew.name} 
                        className="w-full h-full object-cover object-center"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    
                    {/* Top status tag */}
                    <span className="absolute top-0 right-0 bg-[#ff4f3a] text-white font-black uppercase text-[7.5px] px-2 py-0.5 rounded tracking-widest">
                      FOR HIRE
                    </span>
                  </div>

                  {/* Rating or title detail */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black uppercase tracking-tight text-neutral-800">{crew.name}</h4>
                      {crew.isVerified && <span className="text-blue-500 font-black text-xs">✓</span>}
                    </div>
                    <p className="text-[10px] text-neutral-400 font-semibold uppercase">{crew.title}</p>
                    
                    <div className="flex items-center gap-1 text-[8.5px] font-bold text-neutral-400 uppercase">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      <span className="text-neutral-700 font-black">5.0</span>
                      <span>({crew.reviews} reviews)</span>
                    </div>
                  </div>

                  {/* Creative skills pills (Matching exact screenshots) */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {crew.skills.map((skill, sIdx) => (
                      <span 
                        key={sIdx}
                        className="bg-neutral-50 border border-neutral-200 text-neutral-600 font-medium text-[8px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Bio block extract */}
                  <p className="text-[10px] text-neutral-500 leading-relaxed font-medium">
                    {crew.bio}
                  </p>
                </div>

                {/* Direct Action trigger */}
                <button
                  onClick={() => {
                    setSelectedCrew(crew);
                    setIsMessageModalOpen(true);
                  }}
                  className="w-full bg-neutral-905 hover:bg-neutral-800 text-white bg-neutral-900 rounded-xl py-3 text-[9px] font-mono tracking-widest font-black uppercase transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Mail size={12} />
                  <span>View Profile / Msg</span>
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>


      {/* 7. STAFF RENTAL PICKS (MATCHING SCREENSHOT 5) */}
      {showStaffPicks && (
        <div id="staff-picks-section" className="max-w-7xl mx-auto px-6 md:px-12 py-16 space-y-8">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900 uppercase tracking-tight">Staff Rental Picks</h2>
            <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mt-1">Handpicked rigs verified for compatibility and output quality near {locationQuery}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {mappedStaffPicks.map((product) => {
              const isFav = favoriteItems.has(product.id);
              return (
                <div 
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsBookingModalOpen(true);
                  }}
                  className="group cursor-pointer bg-white rounded-3xl border border-neutral-105 overflow-hidden hover:shadow-2xl transition duration-200 flex flex-col justify-between shadow-xs"
                >
                  <div className="h-44 w-full bg-neutral-50 relative overflow-hidden shrink-0">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-550"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="bg-[#ff4f3a] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wider shadow">
                        ★ STAFF PICK
                      </span>
                      <button
                        onClick={(e) => toggleFavorite(product.id, e)}
                        className="w-7 h-7 bg-white/95 rounded-full flex items-center justify-center text-neutral-500 hover:text-red-500"
                      >
                        <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <p className="text-[8.5px] font-mono text-neutral-400 uppercase tracking-widest">{product.brand}</p>
                      <h4 className="text-[10.5px] font-black uppercase text-neutral-800 line-clamp-2 leading-relaxed" title={product.name}>
                        {product.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                      <div>
                        <span className="text-sm font-black text-[#ff4f3a]">{currencySymbol}{product.price}</span>
                        <span className="text-[8.5px] text-neutral-400 font-semibold uppercase">/day</span>
                      </div>
                      <span className="text-[8.5px] text-neutral-400 font-black uppercase tracking-wider">
                        ⚡ INSTANT BOOK
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* 8. LIST YOUR GEAR PANEL CTA (MATCHING SCREENSHOT 5) */}
      {showGuarantees && (
        <div id="list-your-gear-banner" className="max-w-7xl mx-auto px-6 md:px-12 py-10">
          <div className="bg-neutral-50 rounded-[3rem] p-10 md:p-14 text-center border border-neutral-150 space-y-8 max-w-5xl mx-auto shadow-xl relative overflow-hidden">
            {/* Top circle aesthetic decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-rose-500/5 blur-[50px] rounded-full pointer-events-none" />

            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight uppercase">
                Rent or Sell your Camera Gear
              </h2>
              <p className="text-neutral-550 text-xs font-semibold leading-relaxed max-w-2xl mx-auto uppercase tracking-wider text-neutral-400">
                Join thousands of gear owners who have listed over <span className="font-extrabold text-neutral-900">$1 billion</span> worth of professional gear catalogued.
              </p>
            </div>

            {/* Core values block columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left border-y border-neutral-200/60 py-10">
              {/* Sub column 1 */}
              <div className="space-y-2">
                <div className="w-10 h-10 bg-rose-50 text-[#ff4f3a] rounded-xl flex items-center justify-center">
                  <DollarSign size={18} />
                </div>
                <h4 className="text-[11px] font-black uppercase text-neutral-800 tracking-wider">Earn money renting your gear</h4>
                <p className="text-[10px] text-neutral-400 leading-relaxed font-semibold uppercase">
                  Put your gear to work while you aren\'t using it. Meet local creatives and make extra cash renting your scope to them. Soon, your gear will pay for itself!
                </p>
              </div>

              {/* Sub column 2 */}
              <div className="space-y-2">
                <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                  <ShoppingBag size={18} />
                </div>
                <h4 className="text-[11px] font-black uppercase text-neutral-800 tracking-wider">Sell your gear, keep more of your money</h4>
                <p className="text-[10px] text-[#ff4f3a] leading-relaxed font-black uppercase">
                  Promote your gear to a vibrant community of filmmakers and photographers nationwide, enjoy significant seller protections, and only pay a 5% fee - with a maximum cap of $500.
                </p>
              </div>

              {/* Sub column 3 */}
              <div className="space-y-2">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-505 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <h4 className="text-[11px] font-black uppercase text-neutral-800 tracking-wider">Renter & Seller Guarantees</h4>
                <p className="text-[10px] text-neutral-400 leading-relaxed font-semibold uppercase">
                  Integrate premium insurance coverages. Packer Tools offers an extensive selection of coverage options as well as renter and seller guarantees to ensure everyone feels safe and protected.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 pt-4">
              <button
                onClick={() => toast.success("Owner gear-onboarding wizard loaded! Ready to add new listing record.")}
                className="inline-flex bg-[#ff4f3a] hover:bg-[#e43f2a] hover:scale-[1.02] text-white font-black text-xs uppercase tracking-widest px-10 py-4 rounded-xl shadow-xl transition"
              >
                List your gear
              </button>
              <div className="flex justify-center gap-6 text-[9.5px] font-black uppercase tracking-wider text-neutral-450 text-neutral-500">
                <span onClick={() => toast.info("Opening informational handbook.")} className="cursor-pointer hover:text-black transition underline">Learn about renting</span>
                <span onClick={() => toast.info("Listing fee terms: 5% flat fee on finalized sales.")} className="cursor-pointer hover:text-black transition underline">Learn about selling</span>
              </div>
            </div>

          </div>
        </div>
      )}


      {/* 9. EXTENSIVE LANDING DIRECTORY FOOTER (MATCHING SCREENSHOT 5) */}
      <footer id="marketplace-custom-footer" className="bg-[#101010] text-neutral-400 border-t border-neutral-900 pt-16 pb-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-2 md:grid-cols-5 gap-8">
          
          {/* Col 1 */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white">How It Works</h4>
            <ul className="space-y-2.5 text-[9.5px] font-semibold uppercase tracking-wider">
              <li><span onClick={() => toast.info("How to list")} className="hover:text-white cursor-pointer transition">Listing For Rent ›</span></li>
              <li><span onClick={() => toast.info("How to rent")} className="hover:text-white cursor-pointer transition">Renting Gear ›</span></li>
              <li><span onClick={() => toast.info("Verification protocols")} className="hover:text-white cursor-pointer transition">Selling Gear ›</span></li>
              <li><span onClick={() => toast.info("Security rules")} className="hover:text-white cursor-pointer transition">Buying Gear ›</span></li>
              <li><span onClick={() => toast.info("Insurance specifications")} className="hover:text-white cursor-pointer transition">Insurance ›</span></li>
              <li><span onClick={() => toast.info("Support system hours")} className="hover:text-white cursor-pointer transition">Support Center ›</span></li>
              <li><span onClick={() => toast.info("Discount verification modal")} className="hover:text-white cursor-pointer transition">Student Discounts ›</span></li>
            </ul>
          </div>

          {/* Col 2 */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Top {isFiji ? 'Fiji Regions' : 'Cities'}</h4>
            <ul className="space-y-2.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#b3b3b3]">
              {isFiji ? (
                <>
                  <li><span onClick={() => { setLocationQuery('Suva, Fiji'); toast.success("Set range scope to Suva"); }} className="hover:text-white cursor-pointer transition">Suva Rentals ›</span></li>
                  <li><span onClick={() => { setLocationQuery('Nadi, Fiji'); toast.success("Set range scope to Nadi"); }} className="hover:text-white cursor-pointer transition">Nadi Film Hub ›</span></li>
                  <li><span onClick={() => { setLocationQuery('Lautoka, Fiji'); toast.success("Set range scope to Lautoka"); }} className="hover:text-white cursor-pointer transition">Lautoka Rentals ›</span></li>
                  <li><span onClick={() => { setLocationQuery('Savusavu, Fiji'); toast.success("Set range scope to Savusavu"); }} className="hover:text-white cursor-pointer transition">Savusavu Bay Center ›</span></li>
                  <li><span onClick={() => { setLocationQuery('Labasa, Fiji'); toast.success("Set range scope to Labasa"); }} className="hover:text-white cursor-pointer transition">Labasa Rentals ›</span></li>
                  <li><span onClick={() => { setLocationQuery('Taveuni, Fiji'); toast.success("Set range scope to Taveuni"); }} className="hover:text-white cursor-pointer transition">Taveuni Production Co ›</span></li>
                </>
              ) : (
                <>
                  <li><span onClick={() => { setLocationQuery('Los Angeles, CA'); toast.success("Set range scope to Los Angeles"); }} className="hover:text-white cursor-pointer transition">Los Angeles Rentals ›</span></li>
                  <li><span onClick={() => { setLocationQuery('New York, NY'); toast.success("Set range scope to New York"); }} className="hover:text-white cursor-pointer transition">New York Rentals ›</span></li>
                  <li><span onClick={() => { setLocationQuery('Atlanta, GA'); toast.success("Set range scope to Atlanta"); }} className="hover:text-white cursor-pointer transition">Atlanta Rentals ›</span></li>
                  <li><span onClick={() => { setLocationQuery('San Francisco, CA'); toast.success("Set range scope to San Francisco"); }} className="hover:text-white cursor-pointer transition">San Francisco Rentals ›</span></li>
                  <li><span onClick={() => { setLocationQuery('Seattle, WA'); toast.success("Set range scope to Seattle"); }} className="hover:text-white cursor-pointer transition">Seattle Rentals ›</span></li>
                  <li><span onClick={() => { setLocationQuery('Chicago, IL'); toast.success("Set range scope to Chicago"); }} className="hover:text-white cursor-pointer transition">Chicago Rentals ›</span></li>
                </>
              )}
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Join Us</h4>
            <ul className="space-y-2.5 text-[9.5px] font-semibold uppercase tracking-wider">
              <li><span onClick={() => toast.success("Opening Instagram feed")} className="hover:text-white cursor-pointer transition">Instagram ›</span></li>
              <li><span onClick={() => toast.success("Opening Facebook group")} className="hover:text-white cursor-pointer transition">Facebook ›</span></li>
              <li><span onClick={() => toast.success("Opening YouTube video reel")} className="hover:text-white cursor-pointer transition">Youtube ›</span></li>
              <li><span onClick={() => toast.success("Redirecting to apparel store")} className="hover:text-white cursor-pointer transition">Merch Store ›</span></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Contact Us</h4>
            <ul className="space-y-2.5 text-[9.5px] font-semibold uppercase tracking-wider">
              <li><span onClick={() => toast.info("Opening Chat console")} className="hover:text-white cursor-pointer transition">Contact Us ›</span></li>
              <li><span onClick={() => toast.info("Auth insurance policy summary")} className="hover:text-white cursor-pointer transition">About Athos Insurance ›</span></li>
            </ul>
          </div>

          {/* Col 5 */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Terms</h4>
            <ul className="space-y-2.5 text-[9.5px] font-semibold uppercase tracking-wider">
              <li><Link to="/terms" className="hover:text-white transition">Terms of Service ›</Link></li>
              <li><span onClick={() => toast.info("Premium terms of lease")} className="hover:text-white cursor-pointer transition">Packer Plus Terms ›</span></li>
              <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy ›</Link></li>
              <li><span onClick={() => toast.info("Standard code of community integrity")} className="hover:text-white cursor-pointer transition">Community Rules ›</span></li>
              <li><span onClick={() => toast.info("Standard trust guidelines")} className="hover:text-white cursor-pointer transition">Trust and Safety ›</span></li>
            </ul>
          </div>

        </div>

        {/* Closing details */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 mt-16 pt-8 border-t border-neutral-900 flex flex-col sm:flex-row justify-between items-center gap-4 text-[9px] uppercase tracking-widest font-mono text-neutral-600">
          <div>
            © 2026 Packer Tools Platforms, LLC or its affiliates. Logos provided by Clearbit.
          </div>
          <div>
            Made with ♥ in Seattle
          </div>
        </div>
      </footer>


      {/* DETAIL DIALOG / BOOKING MODAL FOR PRODUCTS */}
      <AnimatePresence>
        {isBookingModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsBookingModalOpen(false);
                setSelectedProduct(null);
              }}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#ff4f3a]">
                    {selectedProduct.brand} • {selectedProduct.model || 'GENERIC'}
                  </span>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-neutral-800 mt-1">
                    Book Placement: {selectedProduct.name}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsBookingModalOpen(false);
                    setSelectedProduct(null);
                  }}
                  className="bg-neutral-105 hover:bg-neutral-200 text-neutral-600 p-1 px-1.5 rounded-lg text-xs transition"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Product Preview box */}
              <div className="flex gap-4 border-y border-neutral-100 py-4">
                <div className="w-20 h-20 bg-neutral-50 rounded-xl overflow-hidden shrink-0">
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="space-y-1 my-auto">
                  <div className="flex items-center gap-1">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    <span className="text-[10px] font-black text-neutral-700">{selectedProduct.rating} ({selectedProduct.reviews} reviews)</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase mt-0.5 font-mono">Listed Price: {currencySymbol}{selectedProduct.price}{selectedProduct.isSale ? '' : '/day'}</p>
                  <p className="text-[9px] text-[#ff4f3a] font-extrabold uppercase">Owner Verified: {selectedProduct.ownerName || 'Verified Partner'}</p>
                </div>
              </div>

              {/* Form Input fields */}
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {!selectedProduct.isSale ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Rental duration (Days)</label>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[1, 3, 7, 14].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setBookingDays(days)}
                            className={`py-2 rounded-xl text-xs font-black transition-all ${bookingDays === days ? 'bg-[#ff4f3a] text-white shadow-md' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700'}`}
                          >
                            {days} {days === 1 ? 'Day' : 'Days'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Optional Rental Add-ons Checklist */}
                    {selectedProduct.addOns && selectedProduct.addOns.length > 0 && (
                      <div className="space-y-2 border-t border-neutral-100 pt-3 text-left">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#ff4f3a]">Optional Rental Add-Ons</label>
                        <p className="text-[10px] text-neutral-400 leading-normal">Rent these bundled accessories at heavily promotional rates:</p>
                        <div className="border border-neutral-100 rounded-2xl divide-y divide-neutral-100 overflow-hidden bg-neutral-50/50">
                          {selectedProduct.addOns.map((add, idx) => {
                            const isSelected = selectedAddOns.has(idx);
                            return (
                              <label key={idx} className="flex items-center justify-between p-2.5 hover:bg-neutral-50 cursor-pointer select-none transition">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      const updated = new Set(selectedAddOns);
                                      if (isSelected) {
                                        updated.delete(idx);
                                      } else {
                                        updated.add(idx);
                                      }
                                      setSelectedAddOns(updated);
                                    }}
                                    className="h-4 w-4 text-[#ff4f3a] border-neutral-300 rounded focus:ring-0 cursor-pointer"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-[11px] text-neutral-800">{add.name}</span>
                                    <span className="text-[9px] text-[#ff4f3a]/80 font-bold uppercase tracking-wide">Bundle Offer Acc.</span>
                                  </div>
                                </div>
                                <span className="font-extrabold text-xs text-emerald-600">
                                  {add.price === 0 ? 'FREE' : `+ ${currencySymbol}${add.price}/day`}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-rose-50/50 p-4 border border-rose-100/50 rounded-2xl text-[10px] text-neutral-500 leading-relaxed">
                    <span className="font-black uppercase text-[#ff4f3a]">Buy Out Option Selected</span><br/>
                    Standard seller security escorting is active. An invoice and escrow voucher will generate for you upon dispatch request.
                  </div>
                )}

                {/* Submitting booking checkout summary details */}
                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Estimate Pricing</p>
                  
                  <div className="flex justify-between items-center text-xs text-neutral-600">
                    <span className="font-semibold uppercase text-[9px]">{selectedProduct.isSale ? 'Outright purchase cost' : `Daily Rate x ${bookingDays} Days`}</span>
                    <span className="font-black text-neutral-900">{currencySymbol}{selectedProduct.isSale ? selectedProduct.price.toLocaleString() : (selectedProduct.price * bookingDays).toLocaleString()}</span>
                  </div>

                  {!selectedProduct.isSale && selectedAddOns.size > 0 && (
                    <div className="flex justify-between items-center text-xs text-neutral-600">
                      <span className="font-semibold uppercase text-[9px]">Add-Ons ({selectedAddOns.size} selected)</span>
                      <span className="font-black text-emerald-600">
                        + {currencySymbol}{(Array.from(selectedAddOns).reduce((sum, idx) => sum + (selectedProduct.addOns?.[idx]?.price || 0), 0) * bookingDays).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs text-neutral-600 border-b border-neutral-200/60 pb-1.5 font-sans">
                    <span className="font-semibold uppercase text-[9px]">Damage Waiver Coverage</span>
                    <span className="font-bold text-emerald-600">{currencySymbol}{selectedProduct.isSale ? '0' : isFiji ? '30' : '15'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-neutral-800 pt-1">
                    <span className="font-black uppercase text-[10px]">Total Quote</span>
                    <span className="font-black text-sm text-[#ff4f3a]">
                      {currencySymbol}
                      {selectedProduct.isSale 
                        ? selectedProduct.price.toLocaleString() 
                        : (
                            (selectedProduct.price + Array.from(selectedAddOns).reduce((sum, idx) => sum + (selectedProduct.addOns?.[idx]?.price || 0), 0)) * bookingDays + (isFiji ? 30 : 15)
                          ).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBookingModalOpen(false);
                      setSelectedProduct(null);
                    }}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!isAuthorized && restrictToAvailableCountries}
                    className={`flex-1 font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl transition shadow ${(!isAuthorized && restrictToAvailableCountries) ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-neutral-900 hover:bg-[#ff4f3a] text-white'}`}
                  >
                    {!isAuthorized && restrictToAvailableCountries 
                      ? 'Service Unavailable in Region' 
                      : (selectedProduct.isSale ? 'Send Purchase Request' : 'Send Booking Request')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* MESSAGE AND HIRE DIRECT PANEL MODAL FOR CREWS */}
      <AnimatePresence>
        {isMessageModalOpen && selectedCrew && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsMessageModalOpen(false);
                setSelectedCrew(null);
              }}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-2xl space-y-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">
                    Direct dispatcher
                  </span>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-neutral-800 mt-1">
                    Inquire Hire: {selectedCrew.name}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsMessageModalOpen(false);
                    setSelectedCrew(null);
                  }}
                  className="bg-neutral-105 hover:bg-neutral-200 text-neutral-600 p-1 px-1.5 rounded-lg text-xs transition"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Brief profile info card */}
              <div className="flex gap-4 border-y border-neutral-100 py-4">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl overflow-hidden shrink-0 border">
                  <img src={selectedCrew.image} alt={selectedCrew.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="space-y-1 my-auto">
                  <h4 className="text-xs font-black uppercase text-neutral-800">{selectedCrew.name}</h4>
                  <p className="text-[10px] text-neutral-400 font-semibold uppercase">{selectedCrew.title}</p>
                  <p className="text-[9px] text-[#ff4f3a] font-black uppercase">Response Time: Under 1 hour</p>
                </div>
              </div>

              {/* Message inputs form */}
              <form onSubmit={handleMessageCrewSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Inquiry message & dates</label>
                  <textarea
                    rows={4}
                    required
                    value={crewMessageText}
                    onChange={(e) => setCrewMessageText(e.target.value)}
                    placeholder={`Hi ${selectedCrew.name.split(' ')[0]}, I would like to inquire about your availability matching editorial shoot specs near ${locationQuery} on...`}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-xs font-semibold outline-none focus:bg-white leading-relaxed text-neutral-800 placeholder-neutral-400"
                  />
                </div>

                <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-100/50 flex gap-3 text-[10px] text-blue-800 leading-relaxed">
                  <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
                  <p>
                    All communication is logged for security protection. Packer Marketplace guarantees payment safety escrows and visual damage waivers for on-set accidents.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMessageModalOpen(false);
                      setSelectedCrew(null);
                    }}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-extrabold uppercase tracking-wider text-[10px] py-3.5 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#ff4f3a] hover:bg-[#e43f2a] text-white font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl transition shadow"
                  >
                    Dispatch Message
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
