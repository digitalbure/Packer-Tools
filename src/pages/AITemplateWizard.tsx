import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, writeBatch, doc } from 'firebase/firestore';
import { Zap, ChevronRight, ChevronLeft, Loader2, Package, Check, Sparkles, Info } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { db } from '../firebase';
import { UserProfile, PackingList, GearItem, AdminSettings } from '../types';
import { toast } from 'sonner';
import { canUseAI, trackAIUsage } from '../lib/limitUtils';

export default function AITemplateWizard({ user, adminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<PackingList[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PackingList | null>(null);
  const [jobSpecifics, setJobSpecifics] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedItems, setSuggestedItems] = useState<any[]>([]);
  const [gearLibrary, setGearLibrary] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTemplates = async () => {
      const q = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid), where('isTemplate', '==', true));
      const snap = await getDocs(q);
      setTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackingList)));
      
      const gearSnap = await getDocs(collection(db, 'users', user.uid, 'gearLibrary'));
      setGearLibrary(gearSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem)));
      
      setLoading(false);
    };
    fetchTemplates();
  }, [user.uid]);

  const handleGenerate = async () => {
    if (!selectedTemplate || !jobSpecifics.trim()) return;

    const aiCheck = await canUseAI(user, adminSettings);
    if (!aiCheck.allowed) {
      toast.error(aiCheck.reason);
      return;
    }

    setIsGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = adminSettings?.aiConfig?.model || "gemini-3.5-flash";

      const prompt = `
        You are an expert gear manager. 
        User is planning a job: "${selectedTemplate.jobType || selectedTemplate.name}".
        Template Teaching Notes: "${selectedTemplate.teachingNotes || 'None'}".
        Job Specifics: "${jobSpecifics}".
        
        Available Gear in User's Library:
        ${gearLibrary.map(item => `- ${item.name} (ID: ${item.id}, Tags: ${item.tags?.join(', ') || 'None'})`).join('\n')}
        
        Based on the teaching notes and job specifics, suggest a packing list from the available gear.
        Also provide a "Reasoning" for each item.
        If an item is missing from the library but essential for the job, suggest it as a "Missing Recommendation".
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              selectedGearIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of Gear IDs from the library to include."
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  }
                },
                description: "Items not in library but recommended."
              }
            },
            required: ["selectedGearIds", "recommendations"]
          }
        }
      });

      const result = JSON.parse(response.text);
      await trackAIUsage(user.uid);
      setSuggestedItems(result.selectedGearIds.map((id: string) => gearLibrary.find(g => g.id === id)).filter(Boolean));
      setStep(3);
    } catch (error) {
      console.error("AI Generation failed:", error);
      toast.error("AI failed to generate list. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateList = async () => {
    try {
      const newListRef = await addDoc(collection(db, 'packingLists'), {
        ownerId: user.uid,
        name: `${selectedTemplate?.name} - ${new Date().toLocaleDateString()}`,
        description: `Generated from AI Template: ${selectedTemplate?.name}. Specifics: ${jobSpecifics}`,
        isTemplate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const batch = writeBatch(db);
      suggestedItems.forEach((item, index) => {
        const itemRef = doc(collection(db, 'packingLists', newListRef.id, 'items'));
        batch.set(itemRef, {
          listId: newListRef.id,
          name: item.name,
          photoUrls: item.photoUrls || [],
          assetTag: item.assetTag || 'N/A',
          status: 'pending',
          aiLabel: item.aiLabel || 'Uncategorized',
          description: item.description || '',
          tags: item.tags || [],
          order: index,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      toast.success("Packing list created successfully!");
      navigate(`/list/${newListRef.id}`);
    } catch (error) {
      console.error("Failed to create list:", error);
      toast.error("Failed to create list");
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="mb-12 text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
          <Zap size={32} />
        </div>
        <h1 className="text-4xl font-black tracking-tight">AI Template Wizard</h1>
        <p className="text-neutral-500">Generate a perfect pack based on your job requirements and gear library.</p>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-center gap-4 mb-12">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
              step === i ? 'bg-primary text-white' : step > i ? 'bg-green-500 text-white' : 'bg-neutral-100 text-neutral-400'
            }`}>
              {step > i ? <Check size={16} /> : i}
            </div>
            {i < 3 && <div className={`w-12 h-1 bg-neutral-100 rounded-full overflow-hidden`}>
              <div className={`h-full bg-primary transition-all duration-500 ${step > i ? 'w-full' : 'w-0'}`} />
            </div>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-neutral-100 shadow-xl p-8 md:p-12">
        {step === 1 && (
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Select a Template</h2>
              <p className="text-neutral-500">Choose the job profile you want to pack for.</p>
            </div>
            <div className="grid gap-4">
              {templates.length > 0 ? templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className={`flex items-center justify-between p-6 rounded-2xl border-2 transition-all text-left ${
                    selectedTemplate?.id === t.id ? 'border-primary bg-primary/5' : 'border-neutral-100 hover:border-neutral-200'
                  }`}
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">{t.name}</h3>
                    <p className="text-sm text-neutral-500">{t.jobType || 'General Job'}</p>
                  </div>
                  <ChevronRight className={selectedTemplate?.id === t.id ? 'text-primary' : 'text-neutral-300'} />
                </button>
              )) : (
                <div className="text-center py-12 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
                  <Package className="mx-auto text-neutral-300 mb-4" size={48} />
                  <p className="text-neutral-500">No templates found. Save a packing list as a template first.</p>
                </div>
              )}
            </div>
            <button
              disabled={!selectedTemplate}
              onClick={() => setStep(2)}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition disabled:opacity-50 disabled:translate-y-0"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 text-neutral-400 hover:text-neutral-600 transition font-bold text-sm uppercase tracking-widest">
              <ChevronLeft size={16} />
              Back
            </button>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Job Specifics</h2>
              <p className="text-neutral-500">Tell the AI about this specific production.</p>
            </div>
            <div className="space-y-6">
              <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Info size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Template Logic</span>
                </div>
                <p className="text-sm text-neutral-600 italic">"{selectedTemplate?.teachingNotes || 'No specific teaching notes for this template.'}"</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">What's the scope?</label>
                <textarea
                  value={jobSpecifics}
                  onChange={(e) => setJobSpecifics(e.target.value)}
                  placeholder="e.g. 3 camera setup, live stream to YouTube, 4 hours duration, outdoor location..."
                  rows={6}
                  className="w-full px-6 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition resize-none"
                />
              </div>
            </div>
            <button
              disabled={!jobSpecifics.trim() || isGenerating}
              onClick={handleGenerate}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>AI is thinking...</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>Generate Packing List</span>
                </>
              )}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">AI Recommendations</h2>
              <p className="text-neutral-500">Review the suggested gear for this job.</p>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Suggested from Library ({suggestedItems.length})</h3>
              <div className="grid gap-3">
                {suggestedItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <div className="w-12 h-12 bg-white rounded-xl overflow-hidden border border-neutral-200">
                      <img src={item.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-bold">{item.name}</h4>
                      <p className="text-xs text-neutral-400 uppercase tracking-widest font-bold">{item.assetTag}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition"
              >
                Refine
              </button>
              <button
                onClick={handleCreateList}
                className="flex-[2] py-4 bg-primary text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition"
              >
                Create Packing List
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
