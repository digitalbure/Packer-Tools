import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { 
  QrCode, Smartphone, Cpu, CheckCircle, AlertTriangle, Printer, Edit3, 
  Trash2, RefreshCw, Clock, History, HelpCircle, Shield, Plus, Info, Check, X
} from 'lucide-react';
import { GearItem, UserProfile } from '../types';
import { toast } from 'sonner';
import { generateSecureToken, generatePackerEpc, logIdentificationEvent } from '../lib/hardwareProviders';

interface AssetIdentificationPanelProps {
  asset: GearItem;
  user: UserProfile | null;
  onUpdate?: () => void;
}

export default function AssetIdentificationPanel({ asset, user, onUpdate }: AssetIdentificationPanelProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'history' | 'manage'>('status');
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isAssigningRfid, setIsAssigningRfid] = useState(false);
  const [newEpc, setNewEpc] = useState('');
  const [isAssigningNfc, setIsAssigningNfc] = useState(false);
  const [newNfcToken, setNewNfcToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load history from Firestore
  useEffect(() => {
    if (!asset.id || !user?.uid) return;
    async function loadEvents() {
      setLoadingHistory(true);
      try {
        const q = query(
          collection(db, `users/${user.uid}/identification_events`),
          where('assetId', '==', asset.id)
        );
        const snap = await getDocs(q);
        const events = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort newest first
        events.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setHistoryEvents(events);
      } catch (err) {
        console.warn('Failed to load history events', err);
      } finally {
        setLoadingHistory(false);
      }
    }
    if (activeTab === 'history') {
      loadEvents();
    }
  }, [asset.id, user?.uid, activeTab]);

  const handleUpdateAsset = async (fields: Partial<GearItem>) => {
    if (!user?.uid) {
      toast.error('Authentication required to perform this action.');
      return;
    }
    setIsSubmitting(true);
    try {
      const assetRef = doc(db, 'users', user.uid, 'gearLibrary', asset.id);
      await updateDoc(assetRef, fields);
      toast.success('Asset identification records synchronized successfully.');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error(err);
      toast.error(`Update failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAssignNfc = async () => {
    const token = generateSecureToken();
    await handleUpdateAsset({ nfcTag: token });
    setIsAssigningNfc(false);
    await logIdentificationEvent(user!.uid, {
      eventType: 'tag_assign',
      assetId: asset.id,
      assetName: asset.name,
      result: 'success',
      metadata: { nfcTag: token, type: 'nfc' }
    });
  };

  const handleQuickAssignRfid = async () => {
    const epc = generatePackerEpc(asset.assetTag);
    await handleUpdateAsset({ rfidTag: epc });
    setIsAssigningRfid(false);
    await logIdentificationEvent(user!.uid, {
      eventType: 'tag_assign',
      assetId: asset.id,
      assetName: asset.name,
      result: 'success',
      metadata: { rfidTag: epc, type: 'rfid' }
    });
  };

  const handleClearIdentifier = async (type: 'nfc' | 'rfid') => {
    const update = type === 'nfc' ? { nfcTag: '' } : { rfidTag: '' };
    await handleUpdateAsset(update);
    await logIdentificationEvent(user!.uid, {
      eventType: 'tag_retire',
      assetId: asset.id,
      assetName: asset.name,
      result: 'success',
      metadata: { type }
    });
  };

  const bioUrl = `${window.location.origin}/#/gear/${asset.id}?owner=${user?.uid || ''}`;
  const publicBioUrl = `${window.location.origin}/#/id/${asset.nfcTag || asset.id}?owner=${user?.uid || ''}`;

  return (
    <div id="asset-id-panel" className="bg-[#121215] border border-neutral-800 rounded-2xl p-5 text-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="text-[#ff4f3a] w-4 h-4" />
          <h3 className="text-xs font-black uppercase tracking-wider text-neutral-200">Asset Passport & Identifiers</h3>
        </div>
        <div className="flex gap-1.5 bg-neutral-900/60 p-0.5 border border-neutral-800 rounded-lg text-[9px] font-bold">
          <button 
            onClick={() => setActiveTab('status')}
            className={`px-2 py-1 rounded-md transition ${activeTab === 'status' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
          >
            Status
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-2 py-1 rounded-md transition ${activeTab === 'history' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
          >
            History
          </button>
          <button 
            onClick={() => setActiveTab('manage')}
            className={`px-2 py-1 rounded-md transition ${activeTab === 'manage' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
          >
            Manage
          </button>
        </div>
      </div>

      {/* Tabs */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {/* QR Status */}
            <div className="bg-[#1a1a20] p-3 rounded-xl border border-neutral-800">
              <QrCode className="mx-auto text-sky-400 mb-1" size={16} />
              <div className="text-[9px] uppercase font-black text-neutral-400">QR CODE</div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 block mt-1">Active</span>
            </div>
            {/* NFC Status */}
            <div className="bg-[#1a1a20] p-3 rounded-xl border border-neutral-800">
              <Smartphone className="mx-auto text-emerald-400 mb-1" size={16} />
              <div className="text-[9px] uppercase font-black text-neutral-400">NFC TAG</div>
              {asset.nfcTag ? (
                <span className="text-[10px] font-mono font-bold text-emerald-400 block mt-1 truncate" title={asset.nfcTag}>
                  Synced
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold text-neutral-500 block mt-1">Unassigned</span>
              )}
            </div>
            {/* RFID Status */}
            <div className="bg-[#1a1a20] p-3 rounded-xl border border-neutral-800">
              <Cpu className="mx-auto text-purple-400 mb-1" size={16} />
              <div className="text-[9px] uppercase font-black text-neutral-400">UHF RFID</div>
              {asset.rfidTag ? (
                <span className="text-[10px] font-mono font-bold text-emerald-400 block mt-1 truncate" title={asset.rfidTag}>
                  {asset.rfidTag.substring(0, 4)}...
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold text-neutral-500 block mt-1">Unassigned</span>
              )}
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
              <span>Passport UUID:</span>
              <span className="font-mono text-[10px] text-neutral-200">{asset.id}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
              <span>Equipment Bio:</span>
              <a 
                href={bioUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="text-sky-400 hover:underline truncate text-[10px] font-mono max-w-[200px]"
              >
                {bioUrl}
              </a>
            </div>
            {asset.nfcTag && (
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
                <span>Secure Token payload:</span>
                <span className="font-mono text-[10px] text-[#ff4f3a]">{asset.nfcTag}</span>
              </div>
            )}
            {asset.rfidTag && (
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
                <span>EPC identifier:</span>
                <span className="font-mono text-[10px] text-purple-300">{asset.rfidTag}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
              <span>Lifecycle Status:</span>
              <span className="font-mono text-[10px] uppercase font-bold text-emerald-400">Verified Health</span>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
          {loadingHistory ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="animate-spin text-neutral-500 w-4 h-4" />
            </div>
          ) : historyEvents.length === 0 ? (
            <div className="text-center py-6 text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
              No scan activity logs recorded yet.
            </div>
          ) : (
            historyEvents.map((ev, index) => (
              <div key={ev.id || index} className="p-2.5 bg-[#18181c] border border-neutral-800 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono font-black text-[#ff4f3a] uppercase">
                    {ev.eventType?.replace('_', ' ')}
                  </span>
                  <span className="text-neutral-500 font-bold">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-300 font-medium">
                  {ev.metadata?.note || `Asset referenced via secure link.`}
                </p>
                {ev.metadata?.token && (
                  <div className="text-[9px] font-mono text-neutral-500 truncate">
                    Payload: {ev.metadata.token}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Manage / Assignment Dialogs */}
      {activeTab === 'manage' && (
        <div className="space-y-3">
          {/* NFC controls */}
          <div className="p-3 bg-[#18181c] border border-neutral-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-neutral-200 uppercase">NFC Identifier</span>
              <span className="text-[10px] font-mono text-neutral-500">NTAG213 / Type 2</span>
            </div>
            {asset.nfcTag ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-[#ff4f3a] truncate flex-1">{asset.nfcTag}</span>
                <button 
                  onClick={() => handleClearIdentifier('nfc')}
                  className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500 hover:text-white transition cursor-pointer"
                  title="Unassign NFC Tag"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={handleQuickAssignNfc}
                  className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold uppercase tracking-wider rounded-lg transition text-center"
                >
                  Quick Assign Token
                </button>
              </div>
            )}
          </div>

          {/* RFID controls */}
          <div className="p-3 bg-[#18181c] border border-neutral-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-neutral-200 uppercase">UHF RFID EPC</span>
              <span className="text-[10px] font-mono text-neutral-500">EPC Gen2</span>
            </div>
            {asset.rfidTag ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-purple-400 truncate flex-1">{asset.rfidTag}</span>
                <button 
                  onClick={() => handleClearIdentifier('rfid')}
                  className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500 hover:text-white transition cursor-pointer"
                  title="Unassign RFID Tag"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={handleQuickAssignRfid}
                  className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold uppercase tracking-wider rounded-lg transition text-center"
                >
                  Quick Assign EPC
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
