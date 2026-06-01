import React, { useState } from 'react';
import { initializeApp, getApp, deleteApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc,
  writeBatch
} from 'firebase/firestore';
import { db as currentDb } from '../firebase';
import { toast } from 'sonner';
import { 
  Database, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  Sparkles,
  ArrowRight,
  Shield,
  HelpCircle
} from 'lucide-react';

interface MigrationProgress {
  id: string;
  label: string;
  status: 'idle' | 'fetching' | 'writing' | 'success' | 'error';
  count: number;
  message?: string;
  subCount?: number;
}

export default function FirebaseMigrator() {
  const [configInput, setConfigInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [migrationActive, setMigrationActive] = useState(false);
  const [activeOldConfig, setActiveOldConfig] = useState<any>(null);

  const [steps, setSteps] = useState<MigrationProgress[]>([
    { id: 'organizations', label: 'Organizations & Teams Hierarchy', status: 'idle', count: 0 },
    { id: 'packingLists', label: 'Packing Lists & Sub-Items', status: 'idle', count: 0, subCount: 0 },
    { id: 'contacts', label: 'Assignees & Contacts Registry', status: 'idle', count: 0 },
    { id: 'racks', label: 'Server Racks & Mounted Equipment', status: 'idle', count: 0, subCount: 0 },
    { id: 'users', label: 'User Profiles & Gear Libraries', status: 'idle', count: 0, subCount: 0 },
    { id: 'checkouts', label: 'Equipment Checkout History & Signatures', status: 'idle', count: 0 },
    { id: 'terminals', label: 'Kiosk Tablets & Pairing Terminals', status: 'idle', count: 0 },
  ]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Basic JSON validation
      let parsedConfig: any;
      try {
        // Try cleaning standard JS object copy-paste to JSON
        let cleanInput = configInput.trim();
        if (cleanInput.startsWith('const') || cleanInput.startsWith('var') || cleanInput.startsWith('let')) {
          cleanInput = cleanInput.replace(/^(const|let|var)\s+\w+\s*=\s*/, '');
        }
        if (cleanInput.endsWith(';')) cleanInput = cleanInput.slice(0, -1);
        
        // Replace unquoted property names with quoted ones
        cleanInput = cleanInput.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        // Replace single quotes with double quotes
        cleanInput = cleanInput.replace(/'/g, '"');
        
        parsedConfig = JSON.parse(cleanInput);
      } catch (err) {
        // Fallback to direct parse
        parsedConfig = JSON.parse(configInput);
      }

      const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
      const missingKeys = requiredKeys.filter(k => !parsedConfig[k]);
      if (missingKeys.length > 0) {
        throw new Error(`Missing required properties in configuration: ${missingKeys.join(', ')}`);
      }

      // Try initializing a temporary secondary app
      let testApp;
      try {
        testApp = initializeApp(parsedConfig, 'migration_tester_app');
      } catch {
        // App might already exist
        try {
          testApp = getApp('migration_tester_app');
        } catch {
          testApp = initializeApp(parsedConfig, `migration_tester_${Date.now()}`);
        }
      }

      const oldDb = getFirestore(testApp);
      
      // Query a small set representing active check
      const querySnapshot = await getDocs(collection(oldDb, 'packingLists'));
      
      setTestResult({
        success: true,
        message: `Successfully connected! Found ${querySnapshot.size} packing lists in the source project: "${parsedConfig.projectId}".`
      });
      setActiveOldConfig(parsedConfig);
      toast.success('Firebase source project connection verified!');
    } catch (e: any) {
      console.error(e);
      setTestResult({
        success: false,
        message: e.message || String(e)
      });
      toast.error('Connection failed. Please verify your Firebase project settings and configuration format.');
    } finally {
      setIsTesting(false);
    }
  };

  const runMigration = async () => {
    if (!activeOldConfig) {
      toast.error('Verify connection first.');
      return;
    }

    if (!window.confirm('WARNING: This will copy all items from your old database into your current database. Shared keys and IDs will match perfectly. Proceed with migration?')) {
      return;
    }

    setMigrationActive(true);
    
    // Create connection to the validated old database
    let oldApp;
    try {
      oldApp = initializeApp(activeOldConfig, 'migration_source_active');
    } catch {
      try {
        oldApp = getApp('migration_source_active');
      } catch {
        oldApp = initializeApp(activeOldConfig, `migration_source_${Date.now()}`);
      }
    }
    const oldDb = getFirestore(oldApp);

    // Reset counts
    setSteps(prev => prev.map(s => ({ ...s, status: 'idle', count: 0, subCount: 0, message: undefined })));

    // Sequential Migration Handler
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'fetching' } : s));

      try {
        let count = 0;
        let subCount = 0;

        if (step.id === 'organizations') {
          // Migrating level 1: organizations, departments, teams
          const orgsSnap = await getDocs(collection(oldDb, 'organizations'));
          count += orgsSnap.size;
          for (const orgDoc of orgsSnap.docs) {
            await setDoc(doc(currentDb, 'organizations', orgDoc.id), orgDoc.data());
          }

          const deptsSnap = await getDocs(collection(oldDb, 'departments'));
          for (const deptDoc of deptsSnap.docs) {
            await setDoc(doc(currentDb, 'departments', deptDoc.id), deptDoc.data());
          }

          const teamsSnap = await getDocs(collection(oldDb, 'teams'));
          for (const teamDoc of teamsSnap.docs) {
            await setDoc(doc(currentDb, 'teams', teamDoc.id), teamDoc.data());
          }
        } 
        
        else if (step.id === 'packingLists') {
          // Packing lists & Sub-items
          const listSnap = await getDocs(collection(oldDb, 'packingLists'));
          count = listSnap.size;
          setSteps(prev => prev.map(s => s.id === step.id ? { ...s, count: listSnap.size, status: 'writing' } : s));

          for (const listDoc of listSnap.docs) {
            // Write packing list item
            await setDoc(doc(currentDb, 'packingLists', listDoc.id), listDoc.data());

            // Grab subcollection: items
            try {
              const itemsSnap = await getDocs(collection(oldDb, 'packingLists', listDoc.id, 'items'));
              subCount += itemsSnap.size;
              for (const itemDoc of itemsSnap.docs) {
                await setDoc(doc(currentDb, 'packingLists', listDoc.id, 'items', itemDoc.id), itemDoc.data());
              }
            } catch (err) {
              console.warn(`Could not read items for list ${listDoc.id}`, err);
            }

            // Grab subcollection: versions
            try {
              const versionsSnap = await getDocs(collection(oldDb, 'packingLists', listDoc.id, 'versions'));
              for (const verDoc of versionsSnap.docs) {
                await setDoc(doc(currentDb, 'packingLists', listDoc.id, 'versions', verDoc.id), verDoc.data());
              }
            } catch {}
          }
        }

        else if (step.id === 'contacts') {
          // Contacts
          const cntSnap = await getDocs(collection(oldDb, 'contacts'));
          count = cntSnap.size;
          for (const cDoc of cntSnap.docs) {
            await setDoc(doc(currentDb, 'contacts', cDoc.id), cDoc.data());
          }
        }

        else if (step.id === 'racks') {
          // Racks & items
          const rackSnap = await getDocs(collection(oldDb, 'racks'));
          count = rackSnap.size;
          setSteps(prev => prev.map(s => s.id === step.id ? { ...s, count: rackSnap.size, status: 'writing' } : s));

          for (const rDoc of rackSnap.docs) {
            await setDoc(doc(currentDb, 'racks', rDoc.id), rDoc.data());

            // Sub-collection items
            try {
              const itemsSnap = await getDocs(collection(oldDb, 'racks', rDoc.id, 'items'));
              subCount += itemsSnap.size;
              for (const itemDoc of itemsSnap.docs) {
                await setDoc(doc(currentDb, 'racks', rDoc.id, 'items', itemDoc.id), itemDoc.data());
              }
            } catch {}
          }
        }

        else if (step.id === 'users') {
          // User profile document + their entire gear libraries
          const usersSnap = await getDocs(collection(oldDb, 'users'));
          count = usersSnap.size;
          setSteps(prev => prev.map(s => s.id === step.id ? { ...s, count: usersSnap.size, status: 'writing' } : s));

          for (const uDoc of usersSnap.docs) {
            await setDoc(doc(currentDb, 'users', uDoc.id), uDoc.data());

            // Sub-collection gearLibrary
            try {
              const gearSnap = await getDocs(collection(oldDb, 'users', uDoc.id, 'gearLibrary'));
              subCount += gearSnap.size;
              for (const gDoc of gearSnap.docs) {
                await setDoc(doc(currentDb, 'users', uDoc.id, 'gearLibrary', gDoc.id), gDoc.data());
              }
            } catch {}
          }
        }

        else if (step.id === 'checkouts') {
          const chkSnap = await getDocs(collection(oldDb, 'checkouts'));
          count = chkSnap.size;
          for (const docSnap of chkSnap.docs) {
            await setDoc(doc(currentDb, 'checkouts', docSnap.id), docSnap.data());
          }
        }

        else if (step.id === 'terminals') {
          const tSnap = await getDocs(collection(oldDb, 'terminals'));
          count = tSnap.size;
          for (const docSnap of tSnap.docs) {
            await setDoc(doc(currentDb, 'terminals', docSnap.id), docSnap.data());
          }
        }

        // Complete step successfully
        setSteps(prev => prev.map(s => s.id === step.id ? { 
          ...s, 
          status: 'success', 
          count, 
          subCount: s.subCount !== undefined ? subCount : undefined 
        } : s));

      } catch (err: any) {
        console.error(`Migration error on step ${step.id}:`, err);
        setSteps(prev => prev.map(s => s.id === step.id ? { 
          ...s, 
          status: 'error', 
          message: err.message || String(err) 
        } : s));
      }
    }

    setMigrationActive(false);
    toast.success('Database migration attempt complete. Check detailed list for results.');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
          <Database size={22} />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-neutral-900">Firebase Data Migration Assistant</h2>
          <p className="text-xs text-neutral-500 font-medium font-sans">
            Secure client-to-client pipeline to copy items, lists, teams, and gear configurations to your new Firestore schema.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Input panel */}
        <div className="md:col-span-2 bg-neutral-50 border border-neutral-100 rounded-2rem p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">Source Project Credentials</h3>
          </div>
          
          <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
            Paste the Firebase settings configuration of your <strong>old project</strong> below. Make sure it is valid JSON or copied format:
          </p>

          <textarea
            value={configInput}
            onChange={(e) => setConfigInput(e.target.value)}
            placeholder={`{
  "apiKey": "AIzaSy...",
  "authDomain": "old-project.firebaseapp.com",
  "projectId": "old-project-id",
  "appId": "..."
}`}
            className="w-full h-48 bg-white border border-neutral-200 rounded-xl p-3 text-[10px] font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent"
          />

          <div className="pt-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !configInput.trim() || migrationActive}
              className="w-full py-2.5 bg-neutral-900 hover:bg-black text-white disabled:bg-neutral-200 disabled:text-neutral-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              {isTesting ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <RefreshCw size={12} />
                  Test & Verify Connection
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div className={`p-4 rounded-xl border text-[11px] font-medium leading-relaxed ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-100/80 text-emerald-800' 
                : 'bg-rose-50 border-rose-100/80 text-rose-800'
            }`}>
              <div className="flex gap-2">
                {testResult.success ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="font-bold">{testResult.success ? 'Success! ' : 'Error: '}</span>
                  {testResult.message}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pipelines & Execution Panel */}
        <div className="md:col-span-3 bg-white border border-neutral-100 rounded-2rem p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-neutral-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">Database Migration Pipeline</h3>
            </div>
            {activeOldConfig && !migrationActive && (
              <button
                onClick={runMigration}
                className="py-1.5 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-accent/10 transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Play size={10} fill="currentColor" />
                Start Safe Migration
              </button>
            )}
          </div>

          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.id} className="p-3 border border-neutral-50 bg-neutral-50/40 rounded-xl flex items-center justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-neutral-800">{step.label}</div>
                  <div className="text-[10px] font-mono text-neutral-400">
                    Collection: <span className="font-semibold text-neutral-500">/{step.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {step.status === 'success' && (
                    <div className="text-right">
                      <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                        {step.count} records {step.subCount !== undefined ? `(+ ${step.subCount} sub)` : ''}
                      </span>
                    </div>
                  )}

                  {step.status === 'idle' && (
                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Idle</span>
                  )}

                  {step.status === 'fetching' && (
                    <div className="flex items-center gap-1 text-[10px] text-accent font-bold uppercase tracking-widest animate-pulse">
                      <Loader2 size={10} className="animate-spin" />
                      Reading
                    </div>
                  )}

                  {step.status === 'writing' && (
                    <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold uppercase tracking-widest animate-pulse">
                      <Loader2 size={10} className="animate-spin" />
                      Writing
                    </div>
                  )}

                  {step.status === 'error' && (
                    <div className="text-right flex items-center gap-1 text-[10px] text-rose-600 font-bold uppercase tracking-widest" title={step.message}>
                      <AlertTriangle size={10} />
                      Failed
                    </div>
                  )}

                  <div className="w-5 h-5 flex items-center justify-center">
                    {step.status === 'success' ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-neutral-300" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl flex items-start gap-2 text-[10px] leading-relaxed text-amber-800">
            <HelpCircle size={14} className="mt-0.5 shrink-0" />
            <div className="font-medium space-y-1">
              <div className="font-black uppercase tracking-wider">How to enable browser connections:</div>
              <p>
                Because this migration tool executes inside your client web-browser, your old Firebase project must permit this dashboard's domain in its <strong>OAuth Authorized Domains</strong> settings (exactly like signing-in). If you experience resource-access warnings, please double-check your old Firebase Authorized Domains!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
