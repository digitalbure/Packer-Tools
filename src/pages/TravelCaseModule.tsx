import React, { useState, useEffect } from 'react';
import { Box, Search, Plus, ExternalLink, Ruler, Weight as WeightIcon, Info, Globe } from 'lucide-react';
import { CaseModel, AdminSettings, UserProfile } from '../types';
import { toast } from 'sonner';
import { extractCaseDimensions } from '../services/geminiService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { canUseAI, trackAIUsage } from '../lib/limitUtils';

const PRELOADED_CASES: CaseModel[] = [
  {
    id: 'p-1510',
    brand: 'Pelican',
    model: '1510 Protector Carry-On Case',
    interiorDimensions: { length: 50.2, width: 27.9, height: 19.3, unit: 'cm' },
    exteriorDimensions: { length: 55.9, width: 35.1, height: 22.9, unit: 'cm' },
    weight: 6.2,
    weightUnit: 'kg',
    url: 'https://www.pelican.com/us/en/product/cases/protector/1510'
  },
  {
    id: 'p-1650',
    brand: 'Pelican',
    model: '1650 Protector Case',
    interiorDimensions: { length: 72.5, width: 44.5, height: 27.1, unit: 'cm' },
    exteriorDimensions: { length: 80.2, width: 52, height: 31.6, unit: 'cm' },
    weight: 12.7,
    weightUnit: 'kg',
    url: 'https://www.pelican.com/us/en/product/cases/protector/1650'
  },
  {
    id: 'n-935',
    brand: 'Nanuk',
    model: '935 Carry-On',
    interiorDimensions: { length: 52.1, width: 28.7, height: 19.1, unit: 'cm' },
    exteriorDimensions: { length: 55.9, width: 35.6, height: 22.9, unit: 'cm' },
    weight: 5.2,
    weightUnit: 'kg',
    url: 'https://nanuk.com/products/nanuk-935'
  },
  {
    id: 'n-960',
    brand: 'Nanuk',
    model: '960 Large Case',
    interiorDimensions: { length: 55.9, width: 43.2, height: 32.8, unit: 'cm' },
    exteriorDimensions: { length: 64.5, width: 50.8, height: 36.8, unit: 'cm' },
    weight: 8.7,
    weightUnit: 'kg',
    url: 'https://nanuk.com/products/nanuk-960'
  }
];

export default function TravelCaseModule({ user, adminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const smartPackerName = adminSettings?.aiConfig?.smartPackerName || 'Smart Packer';

  const filteredCases = PRELOADED_CASES.filter(c => 
    c.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUrlExtract = async () => {
    const aiCheck = await canUseAI(user, adminSettings);
    if (!aiCheck.allowed) {
      toast.error(aiCheck.reason);
      return;
    }

    if (!urlInput) return;
    setIsExtracting(true);
    try {
      const data = await extractCaseDimensions(urlInput);
      await trackAIUsage(user.uid);
      // In a real app, we would add this to the list or a separate state
      toast.success(`${smartPackerName} extracted: ${data.brand} ${data.name}`);
      console.log("Extracted Case Data:", data);
      setUrlInput('');
    } catch (error) {
      toast.error(`${smartPackerName} failed to extract case data from URL`);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Box className="text-primary" size={40} />
            <span>{smartPackerName} Case Finder</span>
          </h1>
          <p className="text-neutral-500">Find the perfect protective case for your gear library.</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Search Pelican or Nanuk cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-primary transition shadow-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {filteredCases.map((caseModel) => (
              <div key={caseModel.id} className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm hover:shadow-xl transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      caseModel.brand === 'Pelican' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {caseModel.brand}
                    </span>
                    <h3 className="text-xl font-bold mt-2 group-hover:text-primary transition">{caseModel.model}</h3>
                  </div>
                  {caseModel.url && (
                    <a href={caseModel.url} target="_blank" rel="noopener noreferrer" className="p-2 text-neutral-400 hover:text-primary transition">
                      <ExternalLink size={18} />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Interior</p>
                    <p className="text-sm font-mono">
                      {caseModel.interiorDimensions.length} x {caseModel.interiorDimensions.width} x {caseModel.interiorDimensions.height} {caseModel.interiorDimensions.unit}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Weight</p>
                    <p className="text-sm font-mono">{caseModel.weight} {caseModel.weightUnit}</p>
                  </div>
                </div>

                <button className="w-full mt-6 py-3 bg-neutral-50 text-neutral-600 rounded-xl font-bold text-sm hover:bg-primary hover:text-white transition">
                  Select Case
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <Globe size={20} />
              </div>
              <h3 className="text-xl font-bold">{smartPackerName} URL Extractor</h3>
            </div>
            <p className="text-sm text-neutral-500">
              Paste a link to a case on Pelican, Nanuk, or any retailer website to automatically pull dimensions using {smartPackerName}.
            </p>
            <div className="space-y-4">
              <input
                type="url"
                placeholder="https://www.pelican.com/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
              />
              <button 
                onClick={handleUrlExtract}
                disabled={isExtracting || !urlInput}
                className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition shadow-lg disabled:opacity-50"
              >
                {isExtracting ? 'Extracting...' : `Extract with ${smartPackerName}`}
              </button>
            </div>
          </div>

          <div className="bg-neutral-900 p-8 rounded-[2.5rem] text-white space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center">
                <Ruler size={20} />
              </div>
              <h3 className="text-xl font-bold">Custom Case</h3>
            </div>
            <p className="text-sm text-neutral-400">
              Manually input your case dimensions if it's a custom build or not in our database.
            </p>
            <button className="w-full py-4 bg-white text-neutral-900 rounded-2xl font-bold hover:bg-neutral-100 transition shadow-lg">
              Input Dimensions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
