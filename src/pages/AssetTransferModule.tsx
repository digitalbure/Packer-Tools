import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, onSnapshot, doc, writeBatch, addDoc, orderBy } from 'firebase/firestore';
import { 
  ArrowRightLeft, 
  ShieldCheck, 
  Lock, 
  Mail, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Package, 
  Layers, 
  FileText, 
  Clock, 
  Sparkles, 
  ChevronRight, 
  Trash2, 
  Download, 
  Building2, 
  User, 
  RefreshCw, 
  Zap, 
  X, 
  Shield, 
  Crown, 
  Check,
  Briefcase,
  Weight,
  DollarSign,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { db } from '../firebase';
import { UserProfile, GearItem, PackingList, AdminSettings, AssetTransferRecord } from '../types';
import { useAuth } from '../providers/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { hapticMedium, hapticLight } from '../utils/haptics';
import jsPDF from 'jspdf';

interface AssetTransferModuleProps {
  user: UserProfile;
  adminSettings: AdminSettings | null;
}

interface SelectedItem {
  id: string;
  name: string;
  category?: string;
  assetTag?: string;
  serialNumber?: string;
  type: 'gear' | 'kit' | 'list' | 'inventory';
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
    company?: string;
    plan: string;
  } | null>(null);

  // Step 2: Asset Selection Payload State
  const [userGear, setUserGear] = useState<GearItem[]>([]);
  const [userLists, setUserLists] = useState<PackingList[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(true);
  const [assetSearchQuery, setAssetSearchQuery] = useState<string>('');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<'all' | 'gear' | 'kits' | 'lists'>('all');
  const [selectedItemsMap, setSelectedItemsMap] = useState<Map<string, SelectedItem>>(new Map());

  // Step 3: PIN Authorization State
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [generatedPin, setGeneratedPin] = useState<string>('');
  const [pinInput, setPinInput] = useState<string[]>(['', '', '', '', '', '']);
  const [pinTimerSeconds, setPinTimerSeconds] = useState<number>(900); // 15 mins
  const [pinVerificationError, setPinVerificationError] = useState<string | null>(null);
  const [isExecutingTransfer, setIsExecutingTransfer] = useState<boolean>(false);

  // Step 4: Transfer Completion State
  const [completedTransferRecord, setCompletedTransferRecord] = useState<AssetTransferRecord | null>(null);

  // Audit Logs State
  const [transferLogs, setTransferLogs] = useState<AssetTransferRecord[]>([]);
  const [logsFilter, setLogsFilter] = useState<'all' | 'outgoing' | 'incoming'>('all');
  const [selectedLogRecord, setSelectedLogRecord] = useState<AssetTransferRecord | null>(null);

  // Load User's Assets (Gear & Packing Lists)
  useEffect(() => {
    if (!user.uid) return;
    setIsLoadingAssets(true);

    const unsubGear = onSnapshot(
      query(collection(db, 'gear'), where('ownerId', '==', user.uid)),
      (snap) => {
        const gearArr: GearItem[] = [];
        snap.forEach(d => gearArr.push({ id: d.id, ...d.data() } as GearItem));
        setUserGear(gearArr);
        setIsLoadingAssets(false);
      },
      (err) => {
        console.warn('Gear snapshot error:', err);
        setIsLoadingAssets(false);
      }
    );

    const unsubLists = onSnapshot(
      query(collection(db, 'packingLists'), where('ownerId', '==', user.uid)),
      (snap) => {
        const listArr: PackingList[] = [];
        snap.forEach(d => listArr.push({ id: d.id, ...d.data() } as PackingList));
        setUserLists(listArr);
      },
      (err) => {
        console.warn('Lists snapshot error:', err);
      }
    );

    return () => {
      unsubGear();
      unsubLists();
    };
  }, [user.uid]);

  // Load Transfer Audit Logs
  useEffect(() => {
    if (!user.uid) return;

    // Fetch outgoing
    const unsubOutgoing = onSnapshot(
      query(collection(db, 'assetTransfers'), where('senderUid', '==', user.uid)),
      (snapOutgoing) => {
        const outgoing: AssetTransferRecord[] = [];
        snapOutgoing.forEach(doc => outgoing.push({ id: doc.id, ...doc.data() } as AssetTransferRecord));

        // Fetch incoming
        const unsubIncoming = onSnapshot(
          query(collection(db, 'assetTransfers'), where('recipientUid', '==', user.uid)),
          (snapIncoming) => {
            const incoming: AssetTransferRecord[] = [];
            snapIncoming.forEach(doc => incoming.push({ id: doc.id, ...doc.data() } as AssetTransferRecord));

            // Merge and sort desc by date
            const merged = [...outgoing, ...incoming].filter((item, index, self) => 
              index === self.findIndex((t) => t.id === item.id)
            );
            merged.sort((a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime());
            setTransferLogs(merged);
          }
        );

        return () => unsubIncoming();
      }
    );

    return () => unsubOutgoing();
  }, [user.uid]);

  // PIN Countdown Timer
  useEffect(() => {
    let interval: any = null;
    if (isPinModalOpen && pinTimerSeconds > 0) {
      interval = setInterval(() => {
        setPinTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (pinTimerSeconds === 0) {
      setPinVerificationError('PIN expired. Please generate a new authorization PIN code.');
    }
    return () => clearInterval(interval);
  }, [isPinModalOpen, pinTimerSeconds]);

  // Handle Recipient Verification
  const handleVerifyRecipient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRecipientError(null);
    setVerifiedRecipient(null);

    const targetEmail = recipientEmailInput.trim().toLowerCase();
    if (!targetEmail) {
      setRecipientError('Please enter a target account email address.');
      return;
    }

    if (targetEmail === user.email?.toLowerCase()) {
      setRecipientError('You cannot transfer assets to your own account email.');
      return;
    }

    setIsVerifyingRecipient(true);
    hapticMedium();

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', targetEmail));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        setRecipientError(`No registered packer.tools user found for email "${targetEmail}".`);
        setIsVerifyingRecipient(false);
        return;
      }

      const recipientDoc = querySnap.docs[0];
      const recipientData = recipientDoc.data();

      const recipientPlan = recipientData.plan || 'Free';
      const recipientIsEnterprise = recipientPlan === 'Enterprise' || devSimulateEnterprise;

      if (!recipientIsEnterprise) {
        setRecipientError(
          `Recipient account (${recipientData.displayName || targetEmail}) is currently on the "${recipientPlan}" plan. Asset Transfer is restricted strictly between Enterprise accounts.`
        );
        setIsVerifyingRecipient(false);
        return;
      }

      // Account verified successfully
      setVerifiedRecipient({
        uid: recipientDoc.id,
        email: recipientData.email,
        displayName: recipientData.displayName || recipientData.company || 'Enterprise Member',
        company: recipientData.company || recipientData.storeName || 'Enterprise Organization',
        plan: recipientPlan,
      });

      toast.success(`Enterprise Account Verified: ${recipientData.displayName || targetEmail}`);
    } catch (err: any) {
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
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, item);
      }
      return next;
    });
  };

  // Filtered Assets for selection
  const filteredGear = useMemo(() => {
    return userGear.filter(g => {
      if (assetCategoryFilter === 'kits' && !g.isKit) return false;
      if (assetCategoryFilter === 'gear' && g.isKit) return false;
      if (assetCategoryFilter === 'lists') return false;

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
    if (assetCategoryFilter === 'gear') return [];
    return userLists.filter(l => {
      if (assetCategoryFilter === 'kits' && !l.isKit) return false;
      if (!assetSearchQuery.trim()) return true;
      const q = assetSearchQuery.toLowerCase();
      return l.name.toLowerCase().includes(q) || (l.description && l.description.toLowerCase().includes(q));
    });
  }, [userLists, assetCategoryFilter, assetSearchQuery]);

  // Payload Summary Stats
  const selectedItemsList = useMemo(() => Array.from(selectedItemsMap.values()), [selectedItemsMap]);
  const totalPayloadValue = useMemo(() => selectedItemsList.reduce((acc, curr) => acc + (curr.price || 0), 0), [selectedItemsList]);
  const totalPayloadWeight = useMemo(() => selectedItemsList.reduce((acc, curr) => acc + (curr.weight || 0), 0), [selectedItemsList]);

  // Generate PIN and Open Security Modal
  const handleInitiatePinAuthorization = () => {
    if (!verifiedRecipient) {
      toast.error('Please verify an Enterprise recipient account first.');
      return;
    }

    if (selectedItemsList.length === 0) {
      toast.error('Please select at least one gear item, kit, or list to transfer.');
      return;
    }

    hapticMedium();

    // Generate random 6-digit PIN
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedPin(randomPin);
    setPinInput(['', '', '', '', '', '']);
    setPinTimerSeconds(900); // 15 minutes
    setPinVerificationError(null);
    setIsPinModalOpen(true);

    toast.info(`Time-Sensitive PIN sent to ${user.email}`, {
      description: 'Check your email inbox for the 6-digit authorization code.',
    });
  };

  // Handle PIN input change
  const handlePinDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const nextPin = [...pinInput];
    nextPin[index] = value.slice(-1);
    setPinInput(nextPin);

    // Auto advance focus
    if (value && index < 5) {
      const nextInputNode = document.getElementById(`pin-digit-input-${index + 1}`);
      if (nextInputNode) nextInputNode.focus();
    }
  };

  // Handle PIN Keydown for Backspace
  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinInput[index] && index > 0) {
      const prevInputNode = document.getElementById(`pin-digit-input-${index - 1}`);
      if (prevInputNode) prevInputNode.focus();
    }
  };

  // Handle PIN Verification & Execution
  const handleVerifyAndExecuteTransfer = async () => {
    const enteredPin = pinInput.join('');
    if (enteredPin.length < 6) {
      setPinVerificationError('Please enter all 6 digits of the authorization PIN.');
      return;
    }

    if (enteredPin !== generatedPin) {
      setPinVerificationError('Incorrect authorization PIN code. Please double-check and try again.');
      hapticMedium();
      return;
    }

    if (pinTimerSeconds <= 0) {
      setPinVerificationError('Authorization PIN code has expired. Please resend code.');
      return;
    }

    if (!verifiedRecipient) return;

    setIsExecutingTransfer(true);
    setPinVerificationError(null);
    hapticMedium();

    try {
      const refId = `TRF-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      // Execute Firestore batch transfer updates
      const gearItemsToTransfer = selectedItemsList.filter(i => i.type === 'gear' || i.type === 'kit');
      const listsToTransfer = selectedItemsList.filter(i => i.type === 'list' || i.type === 'inventory');

      // Firestore Batch write limit is 500 items per chunk
      const allTransferOps = [
        ...gearItemsToTransfer.map(g => ({ type: 'gear', id: g.id })),
        ...listsToTransfer.map(l => ({ type: 'list', id: l.id }))
      ];

      for (let i = 0; i < allTransferOps.length; i += 400) {
        const chunk = allTransferOps.slice(i, i + 400);
        const batch = writeBatch(db);

        chunk.forEach(op => {
          if (op.type === 'gear') {
            const gearRef = doc(db, 'gear', op.id);
            batch.update(gearRef, {
              ownerId: verifiedRecipient.uid,
              ownerEmail: verifiedRecipient.email,
              assignedTo: '',
              status: 'available',
              updatedAt: new Date().toISOString(),
            });
          } else if (op.type === 'list') {
            const listRef = doc(db, 'packingLists', op.id);
            batch.update(listRef, {
              ownerId: verifiedRecipient.uid,
              ownerEmail: verifiedRecipient.email,
              updatedAt: new Date().toISOString(),
            });
          }
        });

        await batch.commit();
      }

      // Save Transfer Record to Firestore
      const newRecord: Omit<AssetTransferRecord, 'id'> = {
        transferReference: refId,
        senderUid: user.uid,
        senderEmail: user.email || '',
        senderName: user.displayName || 'Enterprise User',
        senderOrgName: user.company || 'Enterprise Org',
        recipientUid: verifiedRecipient.uid,
        recipientEmail: verifiedRecipient.email,
        recipientName: verifiedRecipient.displayName,
        recipientOrgName: verifiedRecipient.company,
        items: selectedItemsList,
        transferredAt: new Date().toISOString(),
        status: 'completed',
        pinVerified: true,
        notes: transferNotes || '',
      };

      const docRef = await addDoc(collection(db, 'assetTransfers'), newRecord);
      const fullRecord: AssetTransferRecord = { id: docRef.id, ...newRecord };

      setCompletedTransferRecord(fullRecord);
      setIsPinModalOpen(false);
      setSelectedItemsMap(new Map());
      setVerifiedRecipient(null);
      setRecipientEmailInput('');
      setTransferNotes('');

      toast.success(`Asset Transfer ${refId} Executed Successfully!`, {
        description: `Ownership of ${selectedItemsList.length} item(s) transferred to ${verifiedRecipient.displayName}.`,
      });
    } catch (err: any) {
      console.error('Error executing asset transfer:', err);
      toast.error('Asset Transfer failed. Please try again.');
      setPinVerificationError('System error during transfer execution. Please retry.');
    } finally {
      setIsExecutingTransfer(false);
    }
  };

  // Download PDF Receipt
  const handleDownloadReceipt = (record: AssetTransferRecord) => {
    hapticLight();
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // Header
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, 210, 35, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('PACKER.TOOLS - ENTERPRISE ASSET TRANSFER', 15, 18);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Transfer Ref: ${record.transferReference}  |  Status: VERIFIED & COMPLETED`, 15, 26);

    // Meta details
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
    pdf.text(`Sender Org: ${record.senderOrgName || 'N/A'}`, 15, 73);

    pdf.text(`Recipient: ${record.recipientName} (${record.recipientEmail})`, 110, 66);
    pdf.text(`Recipient Org: ${record.recipientOrgName || 'N/A'}`, 110, 73);

    if (record.notes) {
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Notes: ${record.notes}`, 15, 82);
    }

    // Items Table Header
    const startY = record.notes ? 92 : 85;
    pdf.setFillColor(241, 245, 249);
    pdf.rect(15, startY, 180, 8, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('ITEM NAME', 18, startY + 5.5);
    pdf.text('TYPE', 90, startY + 5.5);
    pdf.text('ASSET TAG / SERIAL', 125, startY + 5.5);
    pdf.text('VALUATION', 170, startY + 5.5);

    let currentY = startY + 14;
    record.items.forEach((item, idx) => {
      if (currentY > 270) {
        pdf.addPage();
        currentY = 20;
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(item.name.slice(0, 38), 18, currentY);
      pdf.text((item.type || 'gear').toUpperCase(), 90, currentY);
      pdf.text(item.assetTag || item.serialNumber || 'N/A', 125, currentY);
      pdf.text(item.price ? formatCurrency(item.price, 'USD') : 'N/A', 170, currentY);

      currentY += 7;
    });

    // Security Footer
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      'This official Asset Transfer Manifest was cryptographically authorized via Time-Sensitive Email PIN code on Packer.Tools Enterprise.',
      15,
      285
    );

    pdf.save(`Asset_Transfer_Manifest_${record.transferReference}.pdf`);
    toast.success('Transfer Manifest PDF Downloaded!');
  };

  // --------------------------------------------------------------------------
  // RENDER: Non-Enterprise Paywall State
  // --------------------------------------------------------------------------
  if (!isEnterprise) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        {/* Enterprise Upgrade Hero Card */}
        <div className="relative overflow-hidden bg-neutral-900 border border-amber-500/30 rounded-3xl p-8 sm:p-12 text-white shadow-2xl">
          {/* Subtle gold gradient accent */}
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
              Directly re-assign and hand over high-value gear assets, customized equipment kits, and complete inventory manifests to other verified Enterprise accounts on packer.tools.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
                  <ShieldCheck size={16} />
                  <span>Enterprise Security</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal">
                  Transfers are secured with time-sensitive 6-digit email PIN keys and cross-account validation.
                </p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
                  <Layers size={16} />
                  <span>Multi-Item Payloads</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal">
                  Bundle individual gear, complete camera rigs, and packing checklists into single transfer dispatches.
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

              {/* Dev Simulation Toggle */}
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
      {/* Top Banner Header */}
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
              Securely re-assign gear, kits, and checklists to other verified Enterprise packer.tools accounts with PIN authentication.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-neutral-100 rounded-2xl border border-neutral-200/60 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setActiveTab('new');
            }}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === 'new'
                ? 'bg-neutral-900 text-white shadow-md'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <ArrowRightLeft size={14} />
            <span>New Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setActiveTab('logs');
            }}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-neutral-900 text-white shadow-md'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Clock size={14} />
            <span>Transfer Audit Logs ({transferLogs.length})</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TAB 1: NEW TRANSFER WORKFLOW */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'new' && (
        <div className="space-y-8">
          {/* Step 1: Recipient Verification Panel */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
                  1
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tight text-neutral-900">
                    Target Enterprise Account Verification
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Specify the registered email of the destination Enterprise packer.tools account.
                  </p>
                </div>
              </div>

              {verifiedRecipient && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-extrabold text-xs">
                  <ShieldCheck size={14} />
                  <span>Account Verified</span>
                </div>
              )}
            </div>

            {/* Recipient Form */}
            <form onSubmit={handleVerifyRecipient} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-3.5 text-neutral-400" size={18} />
                  <input
                    type="email"
                    value={recipientEmailInput}
                    onChange={e => setRecipientEmailInput(e.target.value)}
                    placeholder="e.g. enterprise.admin@partner.com"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingRecipient}
                  className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifyingRecipient ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  <span>Verify Recipient Account</span>
                </button>
              </div>

              {/* Error Message */}
              {recipientError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs font-semibold">
                  <AlertTriangle size={18} className="shrink-0 text-red-600 mt-0.5" />
                  <p>{recipientError}</p>
                </div>
              )}

              {/* Verified Recipient Card */}
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
                          Enterprise Verified
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 font-medium">{verifiedRecipient.email} • {verifiedRecipient.company}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setVerifiedRecipient(null);
                      setRecipientEmailInput('');
                    }}
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
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
                  2
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tight text-neutral-900">
                    Select Transfer Payload Items ({selectedItemsList.length} selected)
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Choose individual equipment items, kits, or packing lists to include in this handover.
                  </p>
                </div>
              </div>

              {/* Batch Actions */}
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

            {/* Category Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center p-1 bg-neutral-100 rounded-2xl border border-neutral-200/60 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setAssetCategoryFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition ${
                    assetCategoryFilter === 'all' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  All ({userGear.length + userLists.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAssetCategoryFilter('gear')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition ${
                    assetCategoryFilter === 'gear' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  Individual Gear
                </button>
                <button
                  type="button"
                  onClick={() => setAssetCategoryFilter('kits')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition ${
                    assetCategoryFilter === 'kits' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  Kits
                </button>
                <button
                  type="button"
                  onClick={() => setAssetCategoryFilter('lists')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition ${
                    assetCategoryFilter === 'lists' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  Lists
                </button>
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

            {/* Asset Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-1 scrollbar-hide">
              {/* Render Gear Items */}
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
                  <div
                    key={gear.id}
                    onClick={() => toggleItemSelection(payloadItem)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-50/80 border-amber-500 shadow-sm'
                        : 'bg-neutral-50 hover:bg-neutral-100/80 border-neutral-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        gear.isKit ? 'bg-purple-100 text-purple-700' : 'bg-neutral-200 text-neutral-700'
                      }`}>
                        {gear.isKit ? <Zap size={18} /> : <Package size={18} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-neutral-900 truncate">{gear.name}</span>
                          {gear.isKit && (
                            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 font-black text-[8px] uppercase tracking-wider rounded">
                              KIT
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 truncate font-medium">
                          {gear.category || 'Gear'} • Tag: {gear.assetTag || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-amber-500 text-neutral-950 border-amber-500' : 'border-neutral-300 bg-white'
                    }`}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}

              {/* Render Packing Lists */}
              {filteredLists.map(list => {
                const isSelected = selectedItemsMap.has(list.id);
                const payloadItem: SelectedItem = {
                  id: list.id,
                  name: list.name,
                  category: 'Packing List',
                  type: 'list',
                };

                return (
                  <div
                    key={list.id}
                    onClick={() => toggleItemSelection(payloadItem)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-50/80 border-amber-500 shadow-sm'
                        : 'bg-neutral-50 hover:bg-neutral-100/80 border-neutral-200/80'
                    }`}
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

                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-amber-500 text-neutral-950 border-amber-500' : 'border-neutral-300 bg-white'
                    }`}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 3: Payload Authorization Dock & Action */}
          <div className="bg-neutral-900 text-white rounded-3xl p-6 space-y-6 shadow-xl border border-neutral-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-800 pb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Step 3: Security & Handover Authorization
                </span>
                <h3 className="text-lg font-black uppercase tracking-tight text-white mt-1">
                  Ready to Dispatch Transfer Payload
                </h3>
              </div>

              {/* Payload Summary Pills */}
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

            {/* Transfer Notes Input */}
            <div>
              <label className="block text-xs font-extrabold uppercase text-neutral-400 mb-2">
                Transfer Authorization Notes (Optional)
              </label>
              <input
                type="text"
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
                placeholder="e.g. Project Falcon equipment allocation to West Coast Depot"
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-bold text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Submit Authorization Button */}
            <button
              type="button"
              onClick={handleInitiatePinAuthorization}
              disabled={!verifiedRecipient || selectedItemsList.length === 0}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <Key size={18} />
              <span>Generate & Send Authorization PIN to {user.email}</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: TRANSFER AUDIT LOGS */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
            <div>
              <h2 className="text-base font-black uppercase tracking-tight text-neutral-900">
                Enterprise Transfer Logs & Receipts
              </h2>
              <p className="text-xs text-neutral-500 font-medium">
                Immutable record of incoming and outgoing asset transfers.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center p-1 bg-neutral-100 rounded-2xl border border-neutral-200/60">
              <button
                type="button"
                onClick={() => setLogsFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition ${
                  logsFilter === 'all' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                }`}
              >
                All ({transferLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setLogsFilter('outgoing')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition ${
                  logsFilter === 'outgoing' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                }`}
              >
                Outgoing
              </button>
              <button
                type="button"
                onClick={() => setLogsFilter('incoming')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase transition ${
                  logsFilter === 'incoming' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                }`}
              >
                Incoming
              </button>
            </div>
          </div>

          {/* Logs List */}
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
                    <div
                      key={log.id}
                      className="p-5 bg-white border border-neutral-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-neutral-300 transition"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isOutgoing ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          <ArrowRightLeft size={20} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-neutral-900">{log.transferReference}</span>
                            <span className={`px-2 py-0.5 font-black text-[9px] uppercase tracking-wider rounded-md ${
                              isOutgoing ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}>
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

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(log)}
                          className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5"
                        >
                          <Download size={14} />
                          <span>Download Receipt</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* PIN AUTHORIZATION SECURITY MODAL */}
      {/* -------------------------------------------------------------------- */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white space-y-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="absolute right-4 top-4 p-2 text-neutral-400 hover:text-white rounded-xl transition"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
                  <Key size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">
                    Enter Time-Sensitive PIN
                  </h3>
                  <p className="text-xs text-neutral-400 font-medium">
                    6-digit authorization code dispatched to <strong className="text-white">{user.email}</strong>
                  </p>
                </div>
              </div>

              {/* Dev Simulation PIN Hint */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Dev Email Authorization Key Hint:</span>
                </span>
                <span className="font-mono text-base tracking-widest text-white">{generatedPin}</span>
              </div>

              {/* 6 Digit Input Fields */}
              <div className="flex justify-between gap-2 my-4">
                {pinInput.map((digit, index) => (
                  <input
                    key={`pin-input-${index}`}
                    id={`pin-digit-input-${index}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={e => handlePinDigitChange(index, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(index, e)}
                    className="w-12 h-14 bg-neutral-800 border border-neutral-700 text-center font-mono font-black text-2xl text-amber-400 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ))}
              </div>

              {/* Error Alert */}
              {pinVerificationError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-semibold text-red-400 flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{pinVerificationError}</span>
                </div>
              )}

              {/* Timer & Resend */}
              <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-800">
                <span className="flex items-center gap-1">
                  <Clock size={14} className="text-amber-400" />
                  <span>
                    Expires in: {Math.floor(pinTimerSeconds / 60)}:
                    {(pinTimerSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
                    setGeneratedPin(randomPin);
                    setPinTimerSeconds(900);
                    toast.info(`New PIN code generated: ${randomPin}`);
                  }}
                  className="text-amber-400 hover:underline font-bold text-xs"
                >
                  Resend PIN
                </button>
              </div>

              {/* Execute Action */}
              <button
                type="button"
                onClick={handleVerifyAndExecuteTransfer}
                disabled={isExecutingTransfer}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                {isExecutingTransfer ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <ShieldCheck size={18} />
                )}
                <span>Verify Code & Execute Handover</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------------- */}
      {/* COMPLETED TRANSFER MANIFEST RECEIPT MODAL */}
      {/* -------------------------------------------------------------------- */}
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
                <h3 className="text-xl font-black uppercase tracking-tight text-neutral-900">
                  Asset Transfer Dispatched & Handover Complete
                </h3>
                <p className="text-xs text-neutral-500 font-semibold">
                  Reference ID: <strong className="text-neutral-900">{completedTransferRecord.transferReference}</strong>
                </p>
              </div>

              {/* Manifest Summary */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-bold">Recipient:</span>
                  <span className="font-extrabold text-neutral-900">{completedTransferRecord.recipientName} ({completedTransferRecord.recipientEmail})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-bold">Transferred Payload:</span>
                  <span className="font-extrabold text-neutral-900">{completedTransferRecord.items.length} item(s) / kit(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-bold">Authorization:</span>
                  <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={12} />
                    Verified PIN
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
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
                  onClick={() => {
                    setCompletedTransferRecord(null);
                    setActiveTab('logs');
                  }}
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
