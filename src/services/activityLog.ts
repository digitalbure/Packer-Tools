import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ActivityLog {
  id?: string;
  userId: string;
  userName: string;
  actionType: string; // 'gear_add' | 'gear_status_change' | 'list_add' | 'list_delete' | 'list_status_change' | 'item_add' | 'item_toggle'
  description: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export async function logActivity(
  userId: string,
  userName: string,
  actionType: string,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!userId) return;
  try {
    const colRef = collection(db, 'activityLogs');
    await addDoc(colRef, {
      userId,
      userName: userName || 'Platform User',
      actionType,
      description,
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    });
  } catch (err) {
    console.warn("Failed to save activity log:", err);
  }
}
