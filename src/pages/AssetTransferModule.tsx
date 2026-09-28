import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  ArrowRightLeft,
  ShieldCheck,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Search,
  Package,
  Layers,
  FileText,
  Clock,
  ChevronRight,
  Trash2,
  Download,
  User,
  RefreshCw,
  Zap,
  X,
  Crown,
  Check,
  DollarSign,
  Database,
  Boxes,
} from 'lucide-react';
import { db } from '../firebase';
import { UserProfile, GearItem, PackingList, GearLibraryEntity, AdminSettings, AssetTransferRecord } from '../types';
import { useAuth } from '../providers/AuthProvider';
import { authenticatedFetch } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { hapticMedium, hapticLight } from '../utils/haptics';
import jsPDF from 'jspdf';

interface AssetTransferModuleProps {
  user: UserProfile;
  adminSettings: AdminSettings | null;
}

interface InventorySummary {
  id: string;
  name: string;
}

interface SelectedItem {
  id: string;
  name: string;
  category?: string;
  assetTag?: string;
  serialNumber?: string;
  type: 'gear' | 'kit' | 'list' | 'inventory' | 'gearLibrary';
  price?: number;
  weight?: number;
  quantity?: number;
}

export default function AssetTransferModule({ user, adminSettings }: AssetTransferModuleProps) {
  const { formatCurrency } = useAuth();

  // Enterprise Mode Dev Override toggle for easy testing
  const [devSimulateEnterprise, setDevSimulateEnterprise] = useState<boolean>(false);
  const isEnterprise = user.plan === 'Enterprise' || devSimulateEnterprise;

  // Navigation State
  const [activeTab, setActiveTab] = useState<'new' | 'logs'>('new');

  // Step 1: Recipient Verification State
  const [recipientEmailInput, setRecipientEmailInput] = useState<string>('');
  const [isVerifyingRecipient, setIsVerifyingRecipient] = useState<boolean>(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [verifiedRecipient, setVerifiedRecipient] = useState<{
    uid: string;
    email: string;
    displayName: string;
    plan: string;
  } | null>(null);

  // Step 2: Asset Selection Payload State
  const [userGear, setUserGear] = useState<GearItem[]>([]);
  const [userLists, setUserLists] = useState<PackingList[]>([]);
  const [userGearLibraries, setUserGearLibraries] = useState<GearLibraryEntity[]>([]);
  const [userInventories, setUserInventories] = useState<InventorySummary[]>([]);
  const [assetSearchQuery, setAssetSearchQuery] = useState<string>('');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<'all' | 'gear' | 'kits' | 'lists' | 'libraries' | 'inventories'>('all');
  const [selectedItemsMap, setSelectedItemsMap] = useState<Map<string, SelectedItem>>(new Map());

  // Step 3: Confirmation State
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [confirmEmailInput, setConfirmEmailInput] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isExecutingTransfer, setIsExecutingTransfer] = useState<boolean>(false);

  // Step 4: Transfer Completion State
  const [completedTransferRecord, setCompletedTransferRecord] = useState<AssetTransferRecord | null>(null);

  // Audit Logs State
  const [transferLogs, setTransferLogs] = useState<AssetTransferRecord[]>([]);
  const [logsFilter, setLogsFilter] = useState<'all' | 'outgoing' | 'incoming'>('all');

  // Load User's Assets (Gear, Lists, Gear Libraries, Inventories)
  useEffect(() => {
    if (!user.uid) return;

    const unsubGear = onSnapshot(
      collection(db, 'users', user.uid, 'gearLibrary'),
      snap => setUserGear(snap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem))),
      err => console.warn('Gear snapshot error:', err)
    );

    const unsubLists = onSnapshot(
      query(collection(db, 'packingLists'), where('ownerId', '==', user.uid)),
      snap => setUserLists(snap.docs.map(d => ({ id: d.id, ...d.data() } as PackingList))),
      err => console.warn('Lists snapshot error:', err)
    );

    const unsubLibraries = onSnapshot(
      query(collection(db, 'gearLibraries'), where('ownerId', '==', user.uid)),
      snap => setUserGearLibraries(snap.docs.map(d => ({ id: d.id, ...d.data() } as GearLibraryEntity))),
      err => console.warn('Gear libraries snapshot error:', err)
    );

    const unsubInventories = onSnapshot(
      query(collection(db, 'inventories'), where('ownerId', '==', user.uid)),
      snap => setUserInventories(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || 'Untitled Inventory' }))),
      err => console.warn('Inventories snapshot error:', err)
    );

    return () => {
      unsubGear();
      unsubLists();
      unsubLibraries();
      unsubInventories();
    };
  }, [user.uid]);

  // Load Transfer Audit Logs
  useEffect(() => {
    if (!user.uid) return;

    const unsubOutgoing = onSnapshot(
      query(collection(db, 'assetTransfers'), where('senderUid', '==', user.uid)),
      snapOutgoing => {
        const outgoing: AssetTransferRecord[] = snapOutgoing.docs.map(d => ({ id: d.id, ...d.data() } as AssetTransferRecord));

        const unsubIncoming = onSnapshot(
          query(collection(db, 'assetTransfers'), where('recipientUid', '==', user.uid)),
          snapIncoming => {
            const incoming: AssetTransferRecord[] = snapIncoming.docs.map(d => ({ id: d.id, ...d.data() } as AssetTransferRecord));
            const merged = [...outgoing, ...incoming].filter((item, index, self) => index === self.findIndex(t => t.id === item.id));
            merged.sort((a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime());
            setTransferLogs(merged);
          }
        );

        return () => unsubIncoming();
      }
    );

    return () => unsubOutgoing();
  }, [user.uid]);

  // Handle Recipient Verification (server-side lookup — users/{uid} isn't client-readable
  // cross-account, and only the server can confirm the email belongs to a real account)
  const handleVerifyRecipient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRecipientError(null);
    setVerifiedRecipient(null);

    const targetEmail = recipientEmailInput.trim().toLowerCase();
    if (!targetEmail) {
      setRecipientError('Please enter a target account email address.');
      return;
    }

    setIsVerifyingRecipient(true);
    hapticMedium();

    try {
      const res = await authenticatedFetch('/api/transfers/lookup-recipient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        setRecipientError(data.error || 'Could not verify that account.');
        return;
      }

      setVerifiedRecipient({ uid: data.uid, email: targetEmail, displayName: data.displayName, plan: data.plan });
      toast.success(`Account verified: ${data.displayName}`);
    } catch (err) {
      console.error('Error verifying recipient:', err);
      setRecipientError('Failed to verify account. Please check your internet connection.');
    } finally {
      setIsVerifyingRecipient(false);
    }
  };

  // Toggle Item Selection
  const toggleItemSelection = (item: SelectedItem) => {
    hapticLight();
    setSelectedItemsMap(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };

  // Filtered Assets for selection
  const filteredGear = useMemo(() => {
    if (['lists', 'libraries', 'inventories'].includes(assetCategoryFilter)) return [];
    return userGear.filter(g => {
      if (assetCategoryFilter === 'kits' && !g.isKit) return false;
      if (assetCategoryFilter === 'gear' && g.isKit) return false;
      if (!assetSearchQuery.trim()) return true;
      const q = assetSearchQuery.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        (g.category && g.category.toLowerCase().includes(q)) ||
        (g.assetTag && g.assetTag.toLowerCase().includes(q)) ||
        (g.serialNumber && g.serialNumber.toLowerCase().includes(q))
      );
    });
  }, [userGear, assetCategoryFilter, assetSearchQuery]);

  const filteredLists = useMemo(() => {
    if (!['all', 'lists'].includes(assetCategoryFilter)) return [];
    return userLists.filter(l => {
      if (!assetSearchQuery.trim()) return true;
      return l.name.toLowerCase().includes(assetSearchQuery.toLowerCase());
    });
  }, [userLists, assetCategoryFilter, assetSearchQuery]);

  const filteredLibraries = useMemo(() => {
    if (!['all', 'libraries'].includes(assetCategoryFilter)) return [];
    return userGearLibraries.filter(l => !assetSearchQuery.trim() || l.name.toLowerCase().includes(assetSearchQuery.toLowerCase()));
  }, [userGearLibraries, assetCategoryFilter, assetSearchQuery]);

  const filteredInventories = useMemo(() => {
    if (!['all', 'inventories'].includes(assetCategoryFilter)) return [];
    return userInventories.filter(i => !assetSearchQuery.trim() || i.name.toLowerCase().includes(assetSearchQuery.toLowerCase()));
  }, [userInventories, assetCategoryFilter, assetSearchQuery]);

  // Payload Summary Stats
  const selectedItemsList = useMemo(() => Array.from(selectedItemsMap.values()), [selectedItemsMap]);
  const totalPayloadValue = useMemo(() => selectedItemsList.reduce((acc, curr) => acc + (curr.price || 0), 0), [selectedItemsList]);

  const handleOpenConfirm = () => {
    if (!verifiedRecipient) {
      toast.error('Please verify a recipient account first.');
      return;
    }
    if (selectedItemsList.length === 0) {
      toast.error('Please select at least one asset to transfer.');
      return;
    }
    hapticMedium();
    setConfirmEmailInput('');
    setConfirmError(null);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmAndExecuteTransfer = async () => {
    if (!verifiedRecipient) return;

    if (confirmEmailInput.trim().toLowerCase() !== verifiedRecipient.email.toLowerCase()) {
      setConfirmError("That doesn't match the recipient's email. Please type it exactly to confirm.");
      return;
    }

    setIsExecutingTransfer(true);
    setConfirmError(null);
    hapticMedium();

    try {
      const typeMap: Record<SelectedItem['type'], string> = {
        gear: 'gear',
        kit: 'gear',
        list: 'packingList',
        inventory: 'inventory',
        gearLibrary: 'gearLibrary',
      };

      const res = await authenticatedFetch('/api/transfers/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUid: verifiedRecipient.uid,
          notes: transferNotes,
          items: selectedItemsList.map(i => ({ type: typeMap[i.type], id: i.id })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setConfirmError(data.error || 'Transfer failed. Please try again.');
        return;
      }

      setCompletedTransferRecord(data as AssetTransferRecord);
      setIsConfirmModalOpen(false);
      setSelectedItemsMap(new Map());
      setVerifiedRecipient(null);
      setRecipientEmailInput('');
      setTransferNotes('');

      toast.success(`Asset Transfer ${data.transferReference} Executed Successfully!`, {
        description: `Ownership of ${data.items.length} item(s) transferred to ${data.recipientName}.`,
      });
    } catch (err) {
      console.error('Error executing asset transfer:', err);
      setConfirmError('System error during transfer execution. Please retry.');
    } finally {
      setIsExecutingTransfer(false);
    }
  };

  // Download PDF Receipt
  const handleDownloadReceipt = (record: AssetTransferRecord) => {
    hapticLight();
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, 210, 35, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('PACKER.TOOLS - ENTERPRISE ASSET TRANSFER', 15, 18);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Transfer Ref: ${record.transferReference}  |  Status: COMPLETED`, 15, 26);

    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TRANSFER HANDOVER DETAILS', 15, 48);
    pdf.setLineWidth(0.4);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(15, 51, 195, 51);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Date & Time: ${new Date(record.transferredAt).toLocaleString()}`, 15, 59);
    pdf.text(`Sender: ${record.senderName} (${record.senderEmail})`, 15, 66);
    pdf.text(`Recipient: ${record.recipientName} (${record.recipientEmail})`, 110, 66);

    if (record.notes) {
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Notes: ${record.notes}`, 15, 76);
    }

    const startY = record.notes ? 86 : 79;
    pdf.setFillColor(241, 245, 249);
    pdf.rect(15, startY, 180, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('ITEM NAME', 18, startY + 5.5);
    pdf.text('TYPE', 100, startY + 5.5);
    pdf.text('ASSET TAG / SERIAL', 130, startY + 5.5);
    pdf.text('VALUATION', 172, startY + 5.5);

    let currentY = startY + 14;
    record.items.forEach(item => {
      if (currentY > 270) {
        pdf.addPage();
        currentY = 20;
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text((item.name || '').slice(0, 40), 18, currentY);
      pdf.text((item.type || 'gear').toUpperCase(), 100, currentY);
      pdf.text(item.assetTag || item.serialNumber || 'N/A', 130, currentY);
      pdf.text(item.price ? formatCurrency(item.price, 'USD') : 'N/A', 172, currentY);
      currentY += 7;
    });

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 116, 139);
    pdf.text('This Asset Transfer Manifest was authorized and executed on Packer.Tools Enterprise.', 15, 285);

    pdf.save(`Asset_Transfer_Manifest_${record.transferReference}.pdf`);
    toast.success('Transfer Manifest PDF Downloaded!');
  };

  // --------------------------------------------------------------------------
  // RENDER: Non-Enterprise Paywall State
  // --------------------------------------------------------------------------
  if (!isEnterprise) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        <div className="relative overflow-hidden bg-neutral-900 border border-amber-500/30 rounded-3xl p-8 sm:p-12 text-white shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-6 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-black uppercase tracking-widest">
              <Crown size={14} />
              <span>Enterprise Exclusive Module</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase leading-none">
              Asset Transfer <span className="text-amber-400">Hub</span>
            </h1>
            <p className="text-sm text-neutral-300 leading-relaxed font-medium">
              Re-assign gear, gear libraries, inventories, and packing lists to any other registered packer.tools account.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
                  <ShieldCheck size={16} />
                  <span>Server-Verified Ownership</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal">
                  Every transfer is re-checked server-side against who actually owns the asset before it moves.
                </p>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
                  <Layers size={16} />
                  <span>Multi-Item Payloads</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal">
                  Bundle individual gear, gear libraries, inventories, and packing lists into a single handover.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <a
                href="#/pricing"
                className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <span>Upgrade to Enterprise Plan</span>
                <ChevronRight size={16} />
              </a>
              <button
                type="button"
                onClick={() => {
                  setDevSimulateEnterprise(true);
                  toast.info('Simulating Enterprise Mode for testing');
                }}
                className="px-4 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-extrabold text-xs uppercase tracking-wider rounded-xl border border-neutral-700 transition"
              >
                Dev: Unlock Module Preview
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: Enterprise Asset Transfer Dashboard
  // --------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 border border-amber-500/20">
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black uppercase tracking-tight text-neutral-900">Asset Transfer</h1>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-black text-[9px] uppercase tracking-wider rounded-md flex items-center gap-1 border border-amber-200">
                <Crown size={10} />
                <span>Enterprise</span>
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium">
              Re-assign gear, gear libraries, inventories, and packing lists to any other registered packer.tools account.
            </p>
          </div>
        </div>

        <div className="flex items-center p-1 bg-neutral-100 rounded-2xl border border-neutral-200/60 self-start md:self-auto">
          <button
            type="button"
            onClick={() => { hapticLight(); setActiveTab('new'); }}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${activeTab === 'new' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            <ArrowRightLeft size={14} />
            <span>New Transfer</span>
          </button>
          <button
            type="button"
            onClick={() => { hapticLight(); setActiveTab('logs'); }}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${activeTab === 'logs' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            <Clock size={14} />
            <span>Transfer Audit Logs ({transferLogs.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'new' && (
        <div className="space-y-8">
          {/* Step 1: Recipient Verification Panel */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">1</div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tight text-neutral-900">Recipient Account</h2>
                  <p className="text-xs text-neutral-500">Any registered packer.tools account can receive a transfer.</p>
                </div>
              </div>
              {verifiedRecipient && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-extrabold text-xs">
                  <ShieldCheck size={14} />
                  <span>Account Verified</span>
                </div>
              )}
            </div>

            <form onSubmit={handleVerifyRecipient} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-3.5 text-neutral-400" size={18} />
                  <input
                    type="email"
                    value={recipientEmailInput}
                    onChange={e => setRecipientEmailInput(e.target.value)}
                    placeholder="e.g. teammate@partner.com"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isVerifyingRecipient}
                  className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifyingRecipient ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>Verify Recipient Account</span>
                </button>
              </div>

              {recipientError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs font-semibold">
                  <AlertTriangle size={18} className="shrink-0 text-red-600 mt-0.5" />
                  <p>{recipientError}</p>
                </div>
              )}

              {verifiedRecipient && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-sm">
                      <User size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-neutral-900">{verifiedRecipient.displayName}</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider rounded-md border border-emerald-200">
                          {verifiedRecipient.plan} Plan
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 font-medium">{verifiedRecipient.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setVerifiedRecipient(null); setRecipientEmailInput(''); }}
                    className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-emerald-100 rounded-xl transition"
                    title="Change Recipient"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Step 2: Payload Selection Panel */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">2</div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tight text-neutral-900">
                    Select Transfer Payload ({selectedItemsList.length} selected)
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Choose individual gear, kits, gear libraries, inventories, or packing lists. Transferring a gear
                    library or inventory moves everything inside it automatically.
                  </p>
                </div>
              </div>
              {selectedItemsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedItemsMap(new Map())}
                  className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  <span>Clear Selection</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center p-1 bg-neutral-100 rounded-2xl border border-neutral-200/60 w-full sm:w-auto flex-wrap">
                {([
                  ['all', `All (${userGear.length + userLists.length + userGearLibraries.length + userInventories.length})`],
                  ['gear', 'Individual Gear'],
                  ['kits', 'Kits'],
                  ['lists', 'Lists'],
                  ['libraries', 'Gear Libraries'],
                  ['inventories', 'Inventories'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAssetCategoryFilter(key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition ${assetCategoryFilter === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 text-neutral-400" size={16} />
                <input
                  type="text"
                  value={assetSearchQuery}
                  onChange={e => setAssetSearchQuery(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1 scrollbar-hide">
              {filteredGear.map(gear => {
                const isSelected = selectedItemsMap.has(gear.id);
                const payloadItem: SelectedItem = {
                  id: gear.id,
                  name: gear.name,
                  category: gear.category,
                  assetTag: gear.assetTag,
                  serialNumber: gear.serialNumber,
                  type: gear.isKit ? 'kit' : 'gear',
                  price: gear.price,
                  weight: gear.weight,
                };
                return (
                  <button
                    type="button"
                    key={gear.id}
                    onClick={() => toggleItemSelection(payloadItem)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 text-left ${isSelected ? 'bg-amber-50/80 border-amber-500 shadow-sm' : 'bg-neutral-50 hover:bg-neutral-100/80 border-neutral-200/80'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${gear.isKit ? 'bg-purple-100 text-purple-700' : 'bg-neutral-200 text-neutral-700'}`}>
                        {gear.isKit ? <Zap size={18} /> : <Package size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-neutral-900 truncate">{gear.name}</span>
                          {gear.isKit && (
                            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 font-black text-[8px] uppercase tracking-wider rounded">KIT</span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 truncate font-medium">{gear.category || 'Gear'} • Tag: {gear.assetTag || 'N/A'}</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${isSelected ? 'bg-amber-500 text-neutral-950 border-amber-500' : 'border-neutral-300 bg-white'}`}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}

              {filteredLists.map(list => {
                const isSelected = selectedItemsMap.has(list.id);
                const payloadItem: SelectedItem = { id: list.id, name: list.name, category: 'Packing List', type: 'list' };
                return (
                  <button
                    type="button"
                    key={list.id}
                    onClick={() => toggleItemSelection(payloadItem)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 text-left ${isSelected ? 'bg-amber-50/80 border-amber-500 shadow-sm' : 'bg-neutral-50 hover:bg-neutral-100/80 border-neutral-200/80'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-neutral-900 truncate block">{list.name}</span>
                        <p className="text-[10px] text-neutral-500 truncate font-medium">Packing List Manifest</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${isSelected ? 'bg-amber-500 text-neutral-950 border-amber-500' : 'border-neutral-300 bg-white'}`}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}

              {filteredLibraries.map(lib => {
                const isSelected = selectedItemsMap.has(lib.id);
                const itemCount = userGear.filter(g => (g as any).libraryId === lib.id).length;
                const payloadItem: SelectedItem = { id: lib.id, name: lib.name, category: 'Gear Library', type: 'gearLibrary', quantity: itemCount };
                return (
                  <button
                    type="button"
                    key={lib.id}
                    onClick={() => toggleItemSelection(payloadItem)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 text-left ${isSelected ? 'bg-amber-50/80 border-amber-500 shadow-sm' : 'bg-neutral-50 hover:bg-neutral-100/80 border-neutral-200/80'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Database size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-neutral-900 truncate block">{lib.name}</span>
                        <p className="text-[10px] text-neutral-500 truncate font-medium">Gear Library • {itemCount} item(s) included</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${isSelected ? 'bg-amber-500 text-neutral-950 border-amber-500' : 'border-neutral-300 bg-white'}`}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}

              {filteredInventories.map(inv => {
                const isSelected = selectedItemsMap.has(inv.id);
                const payloadItem: SelectedItem = { id: inv.id, name: inv.name, category: 'Inventory', type: 'inventory' };
                return (
                  <button
                    type="button"
                    key={inv.id}
                    onClick={() => toggleItemSelection(payloadItem)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 text-left ${isSelected ? 'bg-amber-50/80 border-amber-500 shadow-sm' : 'bg-neutral-50 hover:bg-neutral-100/80 border-neutral-200/80'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                        <Boxes size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-neutral-900 truncate block">{inv.name}</span>
                        <p className="text-[10px] text-neutral-500 truncate font-medium">Full Inventory Manifest</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${isSelected ? 'bg-amber-500 text-neutral-950 border-amber-500' : 'border-neutral-300 bg-white'}`}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Confirmation Dock */}
          <div className="bg-neutral-900 text-white rounded-3xl p-6 space-y-6 shadow-xl border border-neutral-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-800 pb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Step 3: Review & Confirm</span>
                <h3 className="text-lg font-black uppercase tracking-tight text-white mt-1">Ready to Dispatch Transfer Payload</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-2">
                  <Package size={16} className="text-amber-400" />
                  <div>
                    <span className="text-[9px] uppercase font-black text-neutral-400 block">Items Count</span>
                    <span className="text-xs font-black text-white">{selectedItemsList.length} Selected</span>
                  </div>
                </div>
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-400" />
                  <div>
                    <span className="text-[9px] uppercase font-black text-neutral-400 block">Total Value</span>
                    <span className="text-xs font-black text-white">{formatCurrency(totalPayloadValue, 'USD')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-neutral-400 mb-2">Transfer Notes (Optional)</label>
              <input
                type="text"
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
                placeholder="e.g. Project Falcon equipment allocation to West Coast Depot"
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-bold text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={handleOpenConfirm}
              disabled={!verifiedRecipient || selectedItemsList.length === 0}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} />
              <span>Review & Confirm Transfer</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
            <div>
              <h2 className="text-base font-black uppercase tracking-tight text-neutral-900">Enterprise Transfer Logs & Receipts</h2>
              <p className="text-xs text-neutral-500 font-medium">Immutable record of incoming and outgoing asset transfers.</p>
            </div>
            <div className="flex items-center p-1 bg-neutral-100 rounded-2xl border border-neutral-200/60">
              {(['all', 'outgoing', 'incoming'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLogsFilter(f)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition ${logsFilter === f ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
                >
                  {f === 'all' ? `All (${transferLogs.length})` : f}
                </button>
              ))}
            </div>
          </div>

          {transferLogs.length === 0 ? (
            <div className="p-12 text-center bg-white border border-neutral-200 rounded-3xl space-y-3">
              <Clock className="mx-auto text-neutral-300" size={36} />
              <p className="text-xs font-bold uppercase text-neutral-500">No Asset Transfer Records Found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transferLogs
                .filter(log => {
                  if (logsFilter === 'outgoing') return log.senderUid === user.uid;
                  if (logsFilter === 'incoming') return log.recipientUid === user.uid;
                  return true;
                })
                .map(log => {
                  const isOutgoing = log.senderUid === user.uid;
                  return (
                    <div key={log.id} className="p-5 bg-white border border-neutral-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-neutral-300 transition">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isOutgoing ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          <ArrowRightLeft size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-neutral-900">{log.transferReference}</span>
                            <span className={`px-2 py-0.5 font-black text-[9px] uppercase tracking-wider rounded-md ${isOutgoing ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                              {isOutgoing ? 'OUTGOING' : 'INCOMING'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 font-medium truncate mt-0.5">
                            {isOutgoing ? `To: ${log.recipientName} (${log.recipientEmail})` : `From: ${log.senderName} (${log.senderEmail})`}
                          </p>
                          <p className="text-[10px] text-neutral-400 font-semibold mt-1">
                            {new Date(log.transferredAt).toLocaleString()} • {log.items.length} item(s) transferred
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(log)}
                        className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5"
                      >
                        <Download size={14} />
                        <span>Download Receipt</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {isConfirmModalOpen && verifiedRecipient && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white space-y-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="absolute right-4 top-4 p-2 text-neutral-400 hover:text-white rounded-xl transition"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">Confirm Ownership Transfer</h3>
                  <p className="text-xs text-neutral-400 font-medium">This immediately re-assigns ownership. It cannot be undone from this screen.</p>
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-neutral-400 font-bold">Items</span><span className="font-extrabold">{selectedItemsList.length} selected</span></div>
                <div className="flex justify-between"><span className="text-neutral-400 font-bold">Recipient</span><span className="font-extrabold">{verifiedRecipient.displayName}</span></div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-neutral-400 mb-2">
                  Type the recipient's email to confirm
                </label>
                <input
                  type="email"
                  value={confirmEmailInput}
                  onChange={e => setConfirmEmailInput(e.target.value)}
                  placeholder={verifiedRecipient.email}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm font-bold text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              {confirmError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400 flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{confirmError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmAndExecuteTransfer}
                disabled={isExecutingTransfer}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExecutingTransfer ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                <span>Execute Handover</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPLETED TRANSFER MANIFEST RECEIPT MODAL */}
      <AnimatePresence>
        {completedTransferRecord && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full text-neutral-900 space-y-6 shadow-2xl relative border border-neutral-200"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-neutral-900">Asset Transfer Dispatched & Handover Complete</h3>
                <p className="text-xs text-neutral-500 font-semibold">
                  Reference ID: <strong className="text-neutral-900">{completedTransferRecord.transferReference}</strong>
                </p>
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-bold">Recipient:</span>
                  <span className="font-extrabold text-neutral-900">{completedTransferRecord.recipientName} ({completedTransferRecord.recipientEmail})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-bold">Transferred Payload:</span>
                  <span className="font-extrabold text-neutral-900">{completedTransferRecord.items.length} item(s)</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleDownloadReceipt(completedTransferRecord)}
                  className="flex-1 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-md"
                >
                  <Download size={16} />
                  <span>Download Transfer Receipt PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setCompletedTransferRecord(null); setActiveTab('logs'); }}
                  className="px-6 py-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-extrabold text-xs uppercase tracking-wider rounded-xl transition"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
