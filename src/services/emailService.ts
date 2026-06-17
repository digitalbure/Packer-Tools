import { authenticatedFetch } from '../lib/api';
import { AdminSettings } from '../types';

export interface SendEmailPayload {
  to: string | string[];
  type: 'verification' | 'admin_notification' | 'general_notification' | 'custom';
  data: Record<string, any>;
  branding?: {
    companyName?: string;
    logo?: string;
    primaryColor?: string;
    contactEmail?: string;
    footerText?: string;
    footerLinks?: Array<{ label: string; href: string }>;
  };
  fromType?: 'no-reply' | 'hi' | 'team';
}

function resolveBranding(adminSettings: AdminSettings | null) {
  const emailBrand = adminSettings?.emailBranding;
  return {
    companyName: emailBrand?.companyName || adminSettings?.branding?.companyName || 'Packer Tools',
    logo: emailBrand?.logoUrl || adminSettings?.branding?.logo || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop',
    primaryColor: emailBrand?.primaryColor || adminSettings?.branding?.primaryColor || '#FF5500',
    contactEmail: adminSettings?.contactEmail || 'hi@packer.tools',
    footerText: emailBrand?.footerText || '',
    footerLinks: emailBrand?.footerLinks || []
  };
}

export const emailService = {
  /**
   * Send an OTP/security verify access list code email to a user
   */
  sendVerificationEmail: async (
    to: string,
    code: string,
    userName: string,
    adminSettings: AdminSettings | null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'verification',
      fromType: adminSettings?.emailBranding?.defaultFromType || 'no-reply',
      data: { code, userName },
      branding: resolveBranding(adminSettings)
    };
    return executeEmailSend(payload);
  },

  /**
   * Send an administrative/system alert to workspace administrators
   */
  sendAdminNotification: async (
    to: string | string[],
    title: string,
    message: string,
    details: Record<string, string>,
    adminSettings: AdminSettings | null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'admin_notification',
      fromType: 'team',
      data: { title, message, details },
      branding: resolveBranding(adminSettings)
    };
    return executeEmailSend(payload);
  },

  /**
   * Send general notification emails to users/clients
   */
  sendNotification: async (
    to: string | string[],
    subject: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string,
    adminSettings?: AdminSettings | null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'general_notification',
      fromType: adminSettings?.emailBranding?.defaultFromType || 'hi',
      data: { subject, title, message, actionUrl, actionText },
      branding: resolveBranding(adminSettings || null)
    };
    return executeEmailSend(payload);
  }
};

async function executeEmailSend(payload: SendEmailPayload) {
  try {
    const response = await authenticatedFetch('/api/emails/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[EmailService] Failed to dispatch via secure api router proxy:', error);
    throw error;
  }
}
