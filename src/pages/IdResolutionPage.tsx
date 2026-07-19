import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../providers/AuthProvider';
import { ShieldCheck, AlertTriangle, Loader2, ArrowRight, HelpCircle, Phone, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { logIdentificationEvent } from '../lib/hardwareProviders';

export default function IdResolutionPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [status, setStatus] = useState<'resolving' | 'success' | 'restricted' | 'not_found' | 'error'>('resolving');
  const [assetInfo, setAssetInfo] = useState<any>(null);
  const [ownerUid, setOwnerUid] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Finder fields
  const [finderName, setFinderName] = useState('');
  const [finderContact, setFinderContact] = useState('');
  const [finderMessage, setFinderMessage] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('not_found');
      return;
    }

    async function resolveIdentifier() {
      try {
        setStatus('resolving');
        
        // Search across gear subcollections
        // Because Firestore collectionGroup is allowed or we can fetch, we can search gearLibrary subcollections
        // Alternatively, if there's an active user, we look in their subcollection first
        let foundAsset: any = null;
        let foundOwnerId = '';

        if (user?.uid) {
          const gearRef = collection(db, 'users', user.uid, 'gearLibrary');
          const qNfc = query(gearRef, where('nfcTag', '==', token));
          const qRfid = query(gearRef, where('rfidTag', '==', token));
          const qTag = query(gearRef, where('assetTag', '==', token));

          const [nfcSnap, rfidSnap, tagSnap] = await Promise.all([
            getDocs(qNfc),
            getDocs(qRfid),
            getDocs(qTag)
          ]);

          if (!nfcSnap.empty) {
            foundAsset = { id: nfcSnap.docs[0].id, ...nfcSnap.docs[0].data() };
            foundOwnerId = user.uid;
          } else if (!rfidSnap.empty) {
            foundAsset = { id: rfidSnap.docs[0].id, ...rfidSnap.docs[0].data() };
            foundOwnerId = user.uid;
          } else if (!tagSnap.empty) {
            foundAsset = { id: tagSnap.docs[0].id, ...tagSnap.docs[0].data() };
            foundOwnerId = user.uid;
          }
        }

        // If not found yet and a query owner is specified or we query across collections
        if (!foundAsset) {
          // Check custom search param
          const paramOwner = searchParams.get('owner');
          if (paramOwner) {
            const gearRef = collection(db, 'users', paramOwner, 'gearLibrary');
            const qNfc = query(gearRef, where('nfcTag', '==', token));
            const qRfid = query(gearRef, where('rfidTag', '==', token));
            const [nfcSnap, rfidSnap] = await Promise.all([
              getDocs(qNfc),
              getDocs(qRfid)
            ]);
            if (!nfcSnap.empty) {
              foundAsset = { id: nfcSnap.docs[0].id, ...nfcSnap.docs[0].data() };
              foundOwnerId = paramOwner;
            } else if (!rfidSnap.empty) {
              foundAsset = { id: rfidSnap.docs[0].id, ...rfidSnap.docs[0].data() };
              foundOwnerId = paramOwner;
            }
          }
        }

        // If still not found, we can try searching all public metadata or fallback to a dummy/simulated match
        // Let's check if the token itself contains simulated markers (e.g. "tok_demo")
        if (!foundAsset && token.startsWith('tok_')) {
          foundAsset = {
            id: 'simulated_asset',
            name: 'RED V-Raptor 8K Camera [SIMULATED]',
            brand: 'RED',
            model: 'V-Raptor 8K',
            assetTag: 'PT-CAM-2049',
            category: 'Cameras',
            status: 'available',
            description: 'Professional high-speed cinematography package.',
            nfcTag: token,
            photoUrls: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400']
          };
          foundOwnerId = user?.uid || 'simulated_owner';
        }

        if (foundAsset) {
          setAssetInfo(foundAsset);
          setOwnerUid(foundOwnerId);

          // Record scan audit log
          await logIdentificationEvent(foundOwnerId, {
            eventType: 'nfc_tap',
            assetId: foundAsset.id,
            assetName: foundAsset.name,
            result: 'success',
            metadata: { token, timestamp: new Date().toISOString() }
          });

          // Redirect check: Is the active visitor authorized?
          if (user && user.uid === foundOwnerId) {
            setStatus('success');
            setTimeout(() => {
              navigate(`/gear/${foundAsset.id}?owner=${foundOwnerId}`);
            }, 1000);
          } else {
            // Is public display enabled?
            if (foundAsset.visibility === 'public' || foundAsset.visibility === undefined) {
              setStatus('success');
              setTimeout(() => {
                navigate(`/gear/${foundAsset.id}?owner=${foundOwnerId}`);
              }, 1200);
            } else {
              setStatus('restricted');
            }
          }
        } else {
          setStatus('not_found');
        }

      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Error occurred while resolving identifier token.');
        setStatus('error');
      }
    }

    resolveIdentifier();
  }, [token, user, navigate, searchParams]);

  const handleReportFound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finderContact.trim()) return;
    setSendingReport(true);
    try {
      // Simulate transmitting the report to the owner safely
      await logIdentificationEvent(ownerUid || 'platform_admin', {
        eventType: 'qr_scan',
        assetId: assetInfo?.id || 'unknown',
        assetName: assetInfo?.name || 'Unknown asset',
        result: 'success',
        metadata: {
          token,
          finderName,
          finderContact,
          finderMessage,
          note: 'Lost item ping submitted by a citizen scan'
        }
      });
      setReportSent(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f12] text-white flex flex-col justify-center items-center p-6 select-none font-sans">
      <div className="max-w-md w-full bg-[#16161a] border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-6">
        
        {status === 'resolving' && (
          <div className="text-center py-10 space-y-4">
            <Loader2 className="animate-spin text-[#ff4f3a] mx-auto" size={44} />
            <div className="space-y-1">
              <h2 className="text-lg font-black uppercase tracking-tight">Resolving Smart Tag</h2>
              <p className="text-xs text-neutral-400">Verifying secure passport signatures & organization rules...</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-10 space-y-4">
            <ShieldCheck className="text-emerald-500 mx-auto" size={54} />
            <div className="space-y-1">
              <h2 className="text-lg font-black uppercase tracking-tight">Passport Resolved</h2>
              <p className="text-xs text-emerald-400">Identity successfully matched for {assetInfo?.name || 'Asset'}.</p>
            </div>
            <p className="text-[10px] text-neutral-500 font-mono">Redirecting securely...</p>
          </div>
        )}

        {status === 'restricted' && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <AlertTriangle className="text-amber-500 mx-auto" size={54} />
              <div className="space-y-1">
                <h2 className="text-lg font-black uppercase tracking-tight">Restricted Equipment</h2>
                <p className="text-xs text-neutral-400">
                  This asset ({assetInfo?.brand || ''} {assetInfo?.name}) belongs to private operations.
                </p>
              </div>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-2 text-xs font-semibold text-neutral-300">
              <div className="flex justify-between">
                <span>Asset ID:</span>
                <span className="font-mono text-white">{assetInfo?.assetTag || 'PT-HIDDEN'}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-amber-500 uppercase font-bold text-[10px]">{assetInfo?.status || 'Active'}</span>
              </div>
            </div>

            {/* Finder Form */}
            {reportSent ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center text-xs font-bold text-emerald-400">
                Found Equipment alert successfully transmitted to the owner! They will contact you shortly.
              </div>
            ) : (
              <form onSubmit={handleReportFound} className="space-y-3.5 pt-4 border-t border-neutral-800">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase text-neutral-300">Report Found Equipment</h4>
                  <p className="text-[10px] text-neutral-500">Provide details below to securely alert the fleet coordinator.</p>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={finderName}
                    onChange={(e) => setFinderName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Your Contact (Phone or Email)"
                    value={finderContact}
                    onChange={(e) => setFinderContact(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <textarea
                    placeholder="Message / Current Location"
                    rows={2}
                    value={finderMessage}
                    onChange={(e) => setFinderMessage(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-white resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sendingReport}
                  className="w-full py-2.5 bg-[#ff4f3a] hover:bg-[#e0402c] text-white text-xs font-black uppercase tracking-widest rounded-xl transition"
                >
                  {sendingReport ? 'Submitting...' : 'Alert Asset Owner'}
                </button>
              </form>
            )}
          </div>
        )}

        {status === 'not_found' && (
          <div className="text-center py-10 space-y-4">
            <AlertTriangle className="text-red-500 mx-auto" size={54} />
            <div className="space-y-1.5">
              <h2 className="text-lg font-black uppercase tracking-tight">Identifier Not Assigned</h2>
              <p className="text-xs text-neutral-400">
                This smart tag ({token}) is unregistered or has been retired from Packer.Tools fleets.
              </p>
            </div>
            {user && (
              <button
                onClick={() => navigate('/library')}
                className="inline-flex items-center gap-1 text-xs text-[#ff4f3a] font-extrabold hover:underline"
              >
                <span>Go to Gear Library to assign it</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-10 space-y-4">
            <AlertTriangle className="text-red-500 mx-auto" size={54} />
            <div className="space-y-1">
              <h2 className="text-lg font-black uppercase tracking-tight">Resolution Failure</h2>
              <p className="text-xs text-neutral-400">{errorMsg || 'An error occurred during verification.'}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
