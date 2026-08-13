import { authenticatedFetch } from '../lib/api';
import { AdminSettings } from '../types';
import { EmailLocale } from '../lib/emailTranslations';

export interface SendEmailPayload {
  to: string | string[];
  type: 'verification' | 'welcome' | 'checkout' | 'overdue' | 'low_stock' | 'newsletter' | 'admin_notification' | 'general_notification' | 'custom';
  data: Record<string, any>;
  locale?: EmailLocale;
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
   * Send an OTP/security verification code email to a user with translation support
   */
  sendVerificationEmail: async (
    to: string,
    code: string,
    userName: string,
    locale: EmailLocale = 'en',
    adminSettings: AdminSettings | null = null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'verification',
      locale,
      fromType: adminSettings?.emailBranding?.defaultFromType || 'no-reply',
      data: { code, userName },
      branding: resolveBranding(adminSettings)
    };
    return executeEmailSend(payload);
  },

  /**
   * Send a localized onboarding welcome email
   */
  sendWelcomeEmail: async (
    to: string,
    displayName: string,
    subPlan: string = 'Starter',
    locale: EmailLocale = 'en',
    adminSettings: AdminSettings | null = null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'welcome',
      locale,
      fromType: 'hi',
      data: { displayName, subPlan },
      branding: resolveBranding(adminSettings)
    };
    return executeEmailSend(payload);
  },

  /**
   * Send an equipment handover checkout receipt
   */
  sendHandoverReceipt: async (
    to: string,
    orderNumber: string,
    actionType: 'checkout' | 'checkin' | 'reservation',
    userName: string,
    items: Array<{ name: string; serial?: string; assetTag?: string; category?: string; qty?: number; returnDate?: string }>,
    locale: EmailLocale = 'en',
    adminSettings: AdminSettings | null = null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'checkout',
      locale,
      fromType: 'team',
      data: { orderNumber, actionType, userName, items },
      branding: resolveBranding(adminSettings)
    };
    return executeEmailSend(payload);
  },

  /**
   * Send automated overdue gear return reminder
   */
  sendOverdueReminder: async (
    to: string | string[],
    userName: string,
    items: Array<{ name: string; serial?: string; returnDate?: string; daysOverdue?: number }>,
    locale: EmailLocale = 'en',
    adminSettings: AdminSettings | null = null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'overdue',
      locale,
      fromType: 'no-reply',
      data: { userName, items },
      branding: resolveBranding(adminSettings)
    };
    return executeEmailSend(payload);
  },

  /**
   * Send automated low stock inventory warning to admins / managers
   */
  sendLowStockWarning: async (
    to: string | string[],
    items: Array<{ name: string; sku?: string; quantity: number; threshold: number }>,
    locale: EmailLocale = 'en',
    adminSettings: AdminSettings | null = null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'low_stock',
      locale,
      fromType: 'no-reply',
      data: { items },
      branding: resolveBranding(adminSettings)
    };
    return executeEmailSend(payload);
  },

  /**
   * Broadcast an HTML newsletter campaign to subscribers / team members
   */
  sendNewsletterBroadcast: async (
    recipients: string[],
    subject: string,
    title: string,
    bodyHtml: string,
    ctaText?: string,
    ctaUrl?: string,
    bannerUrl?: string,
    locale: EmailLocale = 'en',
    adminSettings: AdminSettings | null = null
  ) => {
    const response = await authenticatedFetch('/api/emails/newsletter/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients,
        subject,
        title,
        bodyHtml,
        ctaText,
        ctaUrl,
        bannerUrl,
        locale,
        branding: resolveBranding(adminSettings)
      })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${response.status}`);
    }
    return await response.json();
  },

  /**
   * Send an administrative/system alert to workspace administrators
   */
  sendAdminNotification: async (
    to: string | string[],
    title: string,
    message: string,
    details: Record<string, string>,
    locale: EmailLocale = 'en',
    adminSettings: AdminSettings | null = null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'admin_notification',
      locale,
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
    locale: EmailLocale = 'en',
    adminSettings?: AdminSettings | null
  ) => {
    const payload: SendEmailPayload = {
      to,
      type: 'general_notification',
      locale,
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
