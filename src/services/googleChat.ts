import { getAccessToken, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface ChatSpace {
  name: string;
  displayName: string;
  type: string;
}

export interface GoogleChatConfig {
  spaceName?: string;
  spaceDisplayName?: string;
  alertsEnabled?: {
    gear_added?: boolean;
    gear_maintenance?: boolean;
    low_stock?: boolean;
    checkout?: boolean;
    checkin?: boolean;
    payment_cleared?: boolean;
  };
}

export const fetchGoogleChatSpaces = async (token: string): Promise<ChatSpace[]> => {
  try {
    const response = await fetch('/api/googlechat/spaces', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch Chat spaces: ${errData.error || response.statusText}`);
    }
    const data = await response.json();
    return data.spaces || [];
  } catch (error) {
    console.warn('Status notice - Fetching Google Chat spaces:', error);
    throw error;
  }
};

export const sendGoogleChatMessage = async (token: string, spaceName: string, text: string): Promise<any> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/googlechat/message', {
      method: 'POST',
      headers,
      body: JSON.stringify({ spaceName, text }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || response.statusText);
    }
    return await response.json();
  } catch (error) {
    console.warn('Status notice - Sending Google Chat message:', error);
    throw error;
  }
};

export const triggerGoogleChatAlert = async (orgId: string, alertType: string, messageText: string): Promise<boolean> => {
  try {
    const orgDoc = await getDoc(doc(db, 'organizations', orgId));
    if (!orgDoc.exists()) return false;

    const config: GoogleChatConfig = orgDoc.data().googleChatConfig;
    if (!config || !config.spaceName) {
      console.log(`[Google Chat Alert] Google Chat is not linked to any space for org ${orgId}`);
      return false;
    }

    const spaceName = config.spaceName;
    const isWebhook = spaceName.trim().startsWith("https://chat.googleapis.com/");

    const token = getAccessToken();
    if (!token && !isWebhook) {
      console.log(`[Google Chat Alert] No active user session token cached to dispatch: "${messageText}"`);
      return false;
    }

    const isEnabled = config.alertsEnabled?.[alertType as keyof typeof config.alertsEnabled] !== false;
    if (!isEnabled) {
      console.log(`[Google Chat Alert] Alert type "${alertType}" is disabled by config.`);
      return false;
    }

    const fullMessage = `🚨 *[Packer Tools Alert]* \n${messageText}`;
    await sendGoogleChatMessage(token || '', spaceName, fullMessage);
    console.log(`[Google Chat Alert] Dispatched alert successfully to ${config.spaceDisplayName}`);
    return true;
  } catch (error) {
    console.warn('[Google Chat Alert] Failed to dispatch alert:', error);
    return false;
  }
};
