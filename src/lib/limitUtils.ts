import { collection, query, where, getDocs, doc, updateDoc, increment, runTransaction, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, AdminSettings, Plan } from '../types';

export async function canUseAI(
  user: UserProfile,
  adminSettings: AdminSettings | null
): Promise<{ allowed: boolean; reason?: string }> {
  if (!adminSettings) return { allowed: true };
  if (!adminSettings.aiConfig.enabled) return { allowed: false, reason: 'AI features are currently disabled by administrator.' };

  // Check global limit
  if (adminSettings.aiConfig.currentMonthlyUsage >= adminSettings.aiConfig.monthlyGlobalLimit) {
    return { allowed: false, reason: 'Global AI usage limit reached for this month.' };
  }

  // Check user limit
  const plan = adminSettings.plans?.find(p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase()) || adminSettings.plans?.[0];
  if (!plan) return { allowed: true }; // Fallback if no plans defined
  
  const userUsage = user.aiTokenUsage || 0;
  if (userUsage >= plan.aiTokenLimit) {
    return { allowed: false, reason: `You have reached your monthly AI token limit for the ${user.plan} plan.` };
  }

  return { allowed: true };
}

export async function trackAIUsage(
  userId: string,
  tokens: number = 1 // For now we count requests as tokens for simplicity
) {
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const settingsRef = doc(db, 'adminSettings', 'global');

      transaction.update(userRef, {
        aiTokenUsage: increment(tokens)
      });

      transaction.update(settingsRef, {
        'aiConfig.currentMonthlyUsage': increment(tokens)
      });
    });
  } catch (error) {
    console.error("Error tracking AI usage:", error);
  }
}

export async function checkLimit(
  user: UserProfile,
  adminSettings: AdminSettings | null,
  resourceType: 'packingLists' | 'gearItems' | 'racks' | 'movingProjects' | 'projects' | 'distributions' | 'contacts'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  if (!adminSettings) return { allowed: true, current: 0, limit: Infinity };

  const plan = adminSettings.plans?.find(p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase()) || adminSettings.plans?.[0];
  if (!plan) return { allowed: true, current: 0, limit: Infinity };

  let limit = Infinity;
  let current = 0;

  switch (resourceType) {
    case 'packingLists':
      limit = plan.maxPackingLists;
      {
        const qLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
        const snap = await getCountFromServer(qLists);
        current = snap.data().count;
      }
      break;
    case 'gearItems':
      limit = plan.maxGearItems;
      {
        const qGear = query(collection(db, 'users', user.uid, 'gearLibrary'));
        const snap = await getCountFromServer(qGear);
        current = snap.data().count;
      }
      break;
    case 'racks':
      limit = plan.maxRacks;
      {
        const qRacks = query(collection(db, 'racks'), where('ownerId', '==', user.uid));
        const snap = await getCountFromServer(qRacks);
        current = snap.data().count;
      }
      break;
    case 'movingProjects':
    case 'projects':
      limit = plan.maxProjects;
      {
        const qProjects = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
        const snap = await getCountFromServer(qProjects);
        current = snap.data().count;
      }
      break;
    case 'contacts':
      limit = plan.maxContacts || 0;
      {
        const qContacts = query(collection(db, 'contacts'), where('ownerId', '==', user.uid));
        const snap = await getCountFromServer(qContacts);
        current = snap.data().count;
      }
      break;
    case 'distributions':
      limit = user.plan === 'pro' ? Infinity : 10;
      {
        const qDist = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid), where('recipientId', '!=', ''));
        const snap = await getCountFromServer(qDist);
        current = snap.data().count;
      }
      break;
  }

  return {
    allowed: current < limit,
    current,
    limit
  };
}

export async function getUsage(
  user: UserProfile,
  adminSettings: AdminSettings | null
): Promise<{
  packingLists: { current: number; limit: number };
  gearItems: { current: number; limit: number };
  racks: { current: number; limit: number };
  movingProjects: { current: number; limit: number };
  projects: { current: number; limit: number };
  contacts: { current: number; limit: number };
  aiTokens: { current: number; limit: number };
}> {
  const plan = adminSettings?.plans?.find(p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase()) || adminSettings?.plans?.[0];
  
  const [snapLists, snapGear, snapRacks, snapProjects, snapContacts] = await Promise.all([
    getCountFromServer(query(collection(db, 'packingLists'), where('ownerId', '==', user.uid))),
    getCountFromServer(query(collection(db, 'users', user.uid, 'gearLibrary'))),
    getCountFromServer(query(collection(db, 'racks'), where('ownerId', '==', user.uid))),
    getCountFromServer(query(collection(db, 'projects'), where('ownerId', '==', user.uid))),
    getCountFromServer(query(collection(db, 'contacts'), where('ownerId', '==', user.uid)))
  ]);

  return {
    packingLists: { current: snapLists.data().count, limit: plan?.maxPackingLists || 0 },
    gearItems: { current: snapGear.data().count, limit: plan?.maxGearItems || 0 },
    racks: { current: snapRacks.data().count, limit: plan?.maxRacks || 0 },
    movingProjects: { current: snapProjects.data().count, limit: plan?.maxProjects || 0 },
    projects: { current: snapProjects.data().count, limit: plan?.maxProjects || 0 },
    contacts: { current: snapContacts.data().count, limit: plan?.maxContacts || 0 },
    aiTokens: { current: user.aiTokenUsage || 0, limit: plan?.aiTokenLimit || 0 }
  };
}
