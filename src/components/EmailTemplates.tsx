import React, { useState, useEffect } from 'react';
import { 
  Mail, Laptop, Smartphone, Send, Eye, Code, RefreshCw, 
  CheckCircle2, Trash2, Plus, ExternalLink, ShieldCheck, 
  AlertTriangle, CreditCard, ShoppingBag, List, Check,
  Globe, Megaphone, Bell, Sparkles, Sliders, Users, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminSettings, UserProfile } from '../types';
import { emailService } from '../services/emailService';
import { EMAIL_TRANSLATIONS, EmailLocale, getEmailTranslation } from '../lib/emailTranslations';

interface EmailTemplatesProps {
  settings: AdminSettings | null;
  onUpdateSettings?: (updated: AdminSettings) => void;
  user?: UserProfile;
}

export default function EmailTemplates({ settings, onUpdateSettings, user }: EmailTemplatesProps) {
  // Navigation Tabs
  const [activeMainTab, setActiveMainTab] = useState<'templates' | 'newsletter' | 'autotriggers' | 'branding'>('templates');

  // Available Templates
  const templates = [
    { id: 'verification', name: '🔑 Security Token Verification', category: 'Transactional' },
    { id: 'welcome', name: '👋 Onboarding Welcome Email', category: 'Transactional' },
    { id: 'checkout', name: '📦 Dynamic Logistics Checkout Receipt', category: 'Operational' },
    { id: 'overdue', name: '🚨 Overdue Gear Return Notice', category: 'Auto Trigger' },
    { id: 'low_stock', name: '⚠️ Low Stock Inventory Alert', category: 'Auto Trigger' },
    { id: 'admin_notification', name: '🚨 System Infrastructure Telemetry Alert', category: 'System Alert' },
    { id: 'invoice', name: '💳 Subscription Invoice Statement', category: 'Billing' }
  ];

  const [selectedTemplate, setSelectedTemplate] = useState<string>('verification');
  const [selectedLocale, setSelectedLocale] = useState<EmailLocale>('en');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeSubTab, setActiveSubTab] = useState<'preview' | 'html'>('preview');

  // Shared Brand Controls
  const [companyName, setCompanyName] = useState('Packer Tools');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FF5500');
  const [footerText, setFooterText] = useState('');
  const [footerLinks, setFooterLinks] = useState<Array<{ label: string; href: string }>>([]);

  // Local state helper inputs for WYSIWYG parameters
  const [recipientName, setRecipientName] = useState('John Operator');
  const [recipientEmail, setRecipientEmail] = useState('operator@packer.tools');
  const [otpCode, setOtpCode] = useState('524389');

  // Logistics Checkout Preset States
  const [checkoutItems, setCheckoutItems] = useState([
    { id: '1', name: 'Subaru Dual-Band RF Walkie-Talkie', serial: 'SN-RF-9923', category: 'Communications', qty: 2 },
    { id: '2', name: 'Sony Alpha FX3 Cinema Camera Frame', serial: 'SN-CAM-1004', category: 'Camera Kits', qty: 1 },
    { id: '3', name: 'Rigid Heavy Transit Water Case 2L', serial: 'SN-CS-4830', category: 'Containers', qty: 1 }
  ]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemSerial, setNewItemSerial] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Gear');

  // Technical System Alerts States
  const [alertTitle, setAlertTitle] = useState('Cluster Node CPU Threshold Violation');
  const [alertMessage, setAlertMessage] = useState('Express instance container (Port 3000) generated rapid telemetry alerts resulting in automated heap garbage dump.');
  const [alertDetails, setAlertDetails] = useState<Array<{ key: string; value: string }>>([
    { key: 'Cluster Host', value: 'asia-east1-docker-run-pod' },
    { key: 'Resource Overhead', value: '94.8% CPU (Threshold 85%)' },
    { key: 'Process ID', value: 'PID_994032_VITE' }
  ]);

  // Newsletter Broadcast States
  const [newsletterSubject, setNewsletterSubject] = useState('🚀 Packer Tools Monthly Equipment & Operations Briefing');
  const [newsletterTitle, setNewsletterTitle] = useState('Logistics Engine v4.2 Release & Equipment Updates');
  const [newsletterBodyHtml, setNewsletterBodyHtml] = useState(`
    <p style="margin-bottom: 16px;">Hello Operations Team,</p>
    <p style="margin-bottom: 16px;">We are excited to announce major performance updates to the Packer Tools platform! You can now track asset maintenance cycles, trigger localized handover receipts, and manage multi-tenant workspaces with sub-second synchronization.</p>
    <h3 style="color: #0f172a; margin-top: 24px; margin-bottom: 12px; font-size: 16px;">Key Highlights This Month:</h3>
    <ul style="padding-left: 20px; margin-bottom: 24px; line-height: 1.8;">
      <li><strong>Multilingual Email System:</strong> Full translation support across 6 regional languages.</li>
      <li><strong>Label Studio Printing Engine:</strong> Crisp vector barcode and QR tag generation.</li>
      <li><strong>Enterprise Asset Transfer:</strong> Secure PIN-authorized ownership transfers.</li>
    </ul>
    <p>Thank you for keeping your operations running smoothly with Packer Tools.</p>
  `);
  const [newsletterCtaText, setNewsletterCtaText] = useState('Launch Operations Portal');
  const [newsletterCtaUrl, setNewsletterCtaUrl] = useState('https://packer.tools');
  const [newsletterBannerUrl, setNewsletterBannerUrl] = useState('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1200&auto=format&fit=crop');
  const [newsletterRecipientsText, setNewsletterRecipientsText] = useState('jnakasamai@gmail.com, team@packer.tools');
  const [isBroadcastingNewsletter, setIsBroadcastingNewsletter] = useState(false);

  // Automated Email Triggers States
  const [overdueTriggerEnabled, setOverdueTriggerEnabled] = useState(true);
  const [lowStockTriggerEnabled, setLowStockTriggerEnabled] = useState(true);
  const [overdueThresholdDays, setOverdueThresholdDays] = useState(1);
  const [lowStockMinQty, setLowStockMinQty] = useState(2);

  // Test send state
  const [testEmailAddress, setTestEmailAddress] = useState(user?.email || 'jnakasamai@gmail.com');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Sync test email address if user loads
  useEffect(() => {
    if (user?.email && (!testEmailAddress || testEmailAddress === 'jnakasamai@gmail.com')) {
      setTestEmailAddress(user.email);
    }
  }, [user]);

  // Test Gateway Connection directly
  const handleTestGatewayConnection = async () => {
    const target = (testEmailAddress || user?.email || 'admin@packer.tools').trim();
    if (!target || !target.includes('@')) {
      toast.error('Please specify a valid target test email address.');
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await emailService.testConnection(target, settings?.smtp, settings);
      if (res && res.success !== false) {
        if (res.simulated) {
          toast.info(`Sandbox Active: Email Gateway verified (${target}).`);
        } else {
          toast.success(`✅ Connection Verified! Test email delivered to ${target}`);
        }
      } else {
        toast.error(`❌ Connection Test Failed: ${res?.error || 'Gateway error'}`);
      }
    } catch (err: any) {
      toast.error(`❌ Connection Test Error: ${err.message || String(err)}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Sync settings whenever global settings reload
  useEffect(() => {
    const brand = settings?.emailBranding;
    const globalBrand = settings?.branding;
    setCompanyName(brand?.companyName || globalBrand?.companyName || 'Packer Tools');
    setLogoUrl(brand?.logoUrl || globalBrand?.logo || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop');
    setPrimaryColor(brand?.primaryColor || globalBrand?.primaryColor || '#FF5500');
    setFooterText(brand?.footerText || 'You received this notification because you are a registered user of the Packer Tools workspace network.');
    setFooterLinks(brand?.footerLinks || [
      { label: 'Security Center', href: '/help' },
      { label: 'Platform Portal', href: '/admin' }
    ]);
  }, [settings]);

  // Handle live overrides write-back to global configurations
  const handleApplyBrandingChanges = () => {
    if (!settings || !onUpdateSettings) {
      toast.error('Global configurations not editable in current context.');
      return;
    }
    const updated: AdminSettings = {
      ...settings,
      emailBranding: {
        ...(settings.emailBranding || {}),
        companyName,
        logoUrl,
        primaryColor,
        footerText,
        footerLinks
      }
    };
    onUpdateSettings(updated);
    toast.success('Branded specs saved securely in admin settings!');
  };

  // Dispatch Test Email
  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      toast.error('Please specify a target test recipient email address.');
      return;
    }
    setIsSendingTest(true);
    try {
      let res;
      if (selectedTemplate === 'verification') {
        res = await emailService.sendVerificationEmail(testEmailAddress, otpCode, recipientName, selectedLocale, settings);
      } else if (selectedTemplate === 'welcome') {
        res = await emailService.sendWelcomeEmail(testEmailAddress, recipientName, 'Enterprise Tier', selectedLocale, settings);
      } else if (selectedTemplate === 'checkout') {
        res = await emailService.sendHandoverReceipt(testEmailAddress, 'ORD-2026-99', 'checkout', recipientName, checkoutItems, selectedLocale, settings);
      } else if (selectedTemplate === 'overdue') {
        res = await emailService.sendOverdueReminder(testEmailAddress, recipientName, [
          { name: 'Sony FX3 Cinema Camera', serial: 'SN-CAM-1004', returnDate: '2026-08-10', daysOverdue: 2 }
        ], selectedLocale, settings);
      } else if (selectedTemplate === 'low_stock') {
        res = await emailService.sendLowStockWarning(testEmailAddress, [
          { name: 'Dual-Band RF Walkie-Talkies', sku: 'RF-9923', quantity: 1, threshold: 5 }
        ], selectedLocale, settings);
      } else if (selectedTemplate === 'admin_notification') {
        res = await emailService.sendAdminNotification(testEmailAddress, alertTitle, alertMessage, {
          'Cluster Host': 'asia-east1-docker-run-pod',
          'Resource Overhead': '94.8% CPU'
        }, selectedLocale, settings);
      } else {
        res = await emailService.sendNotification(
          testEmailAddress,
          'Test Notification Statement',
          'System Operational Notice',
          'This is a localized test email from the Packer Tools Email Management Studio.',
          'https://packer.tools',
          'Review Workspace',
          selectedLocale,
          settings
        );
      }

      if (res?.simulated) {
        toast.info(`Test Email Simulated (${selectedLocale.toUpperCase()}): ${res.notice || 'Dispatched in sandbox mode'}`);
      } else {
        toast.success(`Localized Test Email (${selectedLocale.toUpperCase()}) dispatched to ${testEmailAddress}!`);
      }
    } catch (err: any) {
      toast.error(`Test dispatch failed: ${err.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Broadcast Newsletter Campaign
  const handleBroadcastNewsletter = async () => {
    const recipientsList = newsletterRecipientsText
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 3 && e.includes('@'));

    if (recipientsList.length === 0) {
      toast.error('Please enter at least one valid recipient email address for the newsletter broadcast.');
      return;
    }

    setIsBroadcastingNewsletter(true);
    try {
      const res = await emailService.sendNewsletterBroadcast(
        recipientsList,
        newsletterSubject,
        newsletterTitle,
        newsletterBodyHtml,
        newsletterCtaText,
        newsletterCtaUrl,
        newsletterBannerUrl,
        selectedLocale,
        settings
      );

      toast.success(`Newsletter broadcast dispatched to ${res.recipientsCount} recipient(s) in ${selectedLocale.toUpperCase()}!`);
    } catch (err: any) {
      toast.error(`Newsletter broadcast failed: ${err.message}`);
    } finally {
      setIsBroadcastingNewsletter(false);
    }
  };

  // Generate Rendered HTML string for Live Preview
  const renderTemplateHtml = () => {
    const t = getEmailTranslation(selectedLocale);
    const footerLinksHtml = footerLinks.length > 0
      ? `<div style="margin-top: 14px; margin-bottom: 12px; font-weight: 600;">
          ${footerLinks.map(link => `<a href="${link.href}" style="color: ${primaryColor}; text-decoration: none; margin: 0 8px; font-size: 11px;">${link.label}</a>`).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}
         </div>`
      : '';
    const footerCustomTextHtml = footerText
      ? `<p style="margin: 8px 0 0 0; line-height: 1.5; font-size: 11.5px; color: #94a3b8;">${footerText}</p>`
      : '';

    if (selectedTemplate === 'verification') {
      return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Verification Token</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
            <div style="background-color: ${primaryColor}; padding: 30px; text-align: center; color: #ffffff;">
              <img src="${logoUrl}" alt="${companyName}" style="max-height: 48px; max-width: 140px; border-radius: 8px; margin-bottom: 12px;" />
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase;">Security Bureau</h2>
            </div>
            <div style="padding: 35px 24px; text-align: center;">
              <p style="font-size: 15px; color: #475569; margin: 0 0 24px 0;">${t.verification.greeting.replace('{name}', recipientName)}</p>
              <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0;">${t.verification.body}</p>
              <div style="font-family: monospace; font-size: 32px; font-weight: 900; color: ${primaryColor}; letter-spacing: 4px; background-color: #faf5f0; display: inline-block; padding: 16px 32px; border-radius: 16px; border: 1px solid #ffedd5; margin-bottom: 24px;">
                ${otpCode}
              </div>
              <p style="font-size: 11px; color: #94a3b8; line-height: 1.6; margin: 0;">${t.verification.expireNotice}</p>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
              © ${new Date().getFullYear()} ${companyName}
              ${footerLinksHtml}
              ${footerCustomTextHtml}
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (selectedTemplate === 'welcome') {
      return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Welcome to ${companyName}</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 28px; box-shadow: 0 15px 35px -10px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 40px 30px; text-align: center; color: #ffffff;">
              <img src="${logoUrl}" alt="${companyName}" style="max-height: 48px; max-width: 140px; border-radius: 8px; margin-bottom: 16px;" />
              <h1 style="margin: 0; font-size: 26px; font-weight: 900;">${t.welcome.greeting.replace('{name}', recipientName)}</h1>
            </div>
            <div style="padding: 35px 30px;">
              <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 24px 0;">${t.welcome.body}</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://packer.tools" style="background-color: ${primaryColor}; color: #ffffff; font-weight: bold; padding: 14px 28px; border-radius: 12px; text-decoration: none; display: inline-block; font-size: 14px; text-transform: uppercase;">
                  ${t.welcome.cta}
                </a>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
              © ${new Date().getFullYear()} ${companyName}
              ${footerLinksHtml}
              ${footerCustomTextHtml}
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (selectedTemplate === 'checkout') {
      const rowsHtml = checkoutItems.map(it => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 8px; font-weight: bold; color: #0f172a;">${it.name}</td>
          <td style="padding: 10px 8px; font-family: monospace; color: #64748b;">${it.serial}</td>
          <td style="padding: 10px 8px; color: #64748b;">${it.category}</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #0f172a;">${it.qty}</td>
        </tr>
      `).join('');

      return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Handover Slip</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
            <div style="background-color: ${primaryColor}; padding: 28px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase;">${t.checkout.title}</h2>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 15px; color: #0f172a; font-weight: bold; margin: 0 0 12px 0;">${t.checkout.greeting.replace('{name}', recipientName)}</p>
              <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">${t.checkout.body}</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
                <thead>
                  <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #94a3b8;">
                    <th style="padding-bottom: 8px; text-align: left;">Item</th>
                    <th style="padding-bottom: 8px; text-align: left;">Serial/Tag</th>
                    <th style="padding-bottom: 8px; text-align: left;">Category</th>
                    <th style="padding-bottom: 8px; text-align: right;">Qty</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
              <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 14px;">
                <p style="font-size: 11.5px; color: #991b1b; font-weight: bold; margin: 0;">⚠️ ${t.checkout.returnNotice}</p>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
              © ${new Date().getFullYear()} ${companyName}
              ${footerLinksHtml}
              ${footerCustomTextHtml}
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (selectedTemplate === 'overdue') {
      return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Overdue Gear Notice</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fef2f2; padding: 40px 10px; margin: 0; color: #1e293b;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px -5px rgba(220,38,38,0.1); border: 1px solid #fecaca; overflow: hidden;">
            <div style="background-color: #dc2626; padding: 28px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase;">${t.overdue.title}</h2>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 15px; color: #0f172a; font-weight: bold; margin: 0 0 12px 0;">${t.overdue.greeting.replace('{name}', recipientName)}</p>
              <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">${t.overdue.body}</p>
              <div style="text-align: center; margin-top: 24px;">
                <a href="https://packer.tools/gear" style="background-color: #dc2626; color: #ffffff; font-weight: bold; padding: 12px 24px; border-radius: 10px; text-decoration: none; display: inline-block; font-size: 13px; text-transform: uppercase;">
                  ${t.overdue.cta}
                </a>
              </div>
            </div>
            <div style="background-color: #fff5f5; padding: 20px; text-align: center; border-top: 1px solid #fecaca; font-size: 11px; color: #991b1b;">
              © ${new Date().getFullYear()} ${companyName}
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (selectedTemplate === 'low_stock') {
      return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Low Stock Warning</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fffbeb; padding: 40px 10px; margin: 0; color: #1e293b;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px -5px rgba(217,119,6,0.1); border: 1px solid #fde68a; overflow: hidden;">
            <div style="background-color: #d97706; padding: 28px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase;">${t.lowStock.title}</h2>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">${t.lowStock.body}</p>
              <div style="text-align: center; margin-top: 24px;">
                <a href="https://packer.tools/inventory" style="background-color: #d97706; color: #ffffff; font-weight: bold; padding: 12px 24px; border-radius: 10px; text-decoration: none; display: inline-block; font-size: 13px; text-transform: uppercase;">
                  ${t.lowStock.cta}
                </a>
              </div>
            </div>
            <div style="background-color: #fffbeb; padding: 20px; text-align: center; border-top: 1px solid #fde68a; font-size: 11px; color: #92400e;">
              © ${new Date().getFullYear()} ${companyName}
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (selectedTemplate === 'admin_notification') {
      const detailsHtml = alertDetails.map(d => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 6px; font-weight: bold; color: #475569; width: 35%; font-size: 11px; text-transform: uppercase;">${d.key}:</td>
          <td style="padding: 8px 6px; color: #0f172a; font-family: monospace; font-size: 12px;">${d.value}</td>
        </tr>
      `).join('');

      return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Admin Alert</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #0f172a;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 24px; color: #ffffff;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">🚨 ${companyName} Admin Console</h3>
            </div>
            <div style="padding: 32px 24px;">
              <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">${alertTitle}</h2>
              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">${alertMessage}</p>
              <div style="background-color: #fafbfc; border-radius: 12px; border: 1px solid #f1f5f9; padding: 16px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;"><tbody>${detailsHtml}</tbody></table>
              </div>
              <p style="font-size: 11px; color: #475569; background-color: #fef08a; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0;">
                ⚠️ ${t.adminAlert.warning}
              </p>
            </div>
            <div style="background-color: #0f172a; padding: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
              © ${new Date().getFullYear()} ${companyName}
              ${footerLinksHtml}
              ${footerCustomTextHtml}
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Invoice Statement</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 28px; box-shadow: 0 15px 35px -10px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 36px 30px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 900;">💳 Subscription Invoice</h1>
            </div>
            <div style="padding: 36px 30px;">
              <p style="font-size: 15px; color: #334155;">Invoice Reference: <strong>PT-2026-9901</strong></p>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
              © ${new Date().getFullYear()} ${companyName}
            </div>
          </div>
        </body>
        </html>
      `;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold uppercase tracking-wider mb-3">
              <Mail className="w-3.5 h-3.5" />
              Multilingual Email Studio & Dispatch
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Email System & Communications
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Design, translate, preview, and broadcast operational, marketing, and automated emails across 6 regional languages.
            </p>
          </div>

          {/* Quick Language Selector */}
          <div className="bg-slate-800/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700/60 flex items-center gap-3">
            <Globe className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="text-xs font-bold text-slate-300">Target Locale:</span>
            <select
              value={selectedLocale}
              onChange={(e) => setSelectedLocale(e.target.value as EmailLocale)}
              className="bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="en">English (en)</option>
              <option value="es">Español (es)</option>
              <option value="fr">Français (fr)</option>
              <option value="de">Deutsch (de)</option>
              <option value="ja">日本語 (ja)</option>
              <option value="fj">Fijian (fj) 🇫🇯</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveMainTab('templates')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all whitespace-nowrap ${
            activeMainTab === 'templates'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Transactional & Service Templates
        </button>

        <button
          onClick={() => setActiveMainTab('newsletter')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all whitespace-nowrap ${
            activeMainTab === 'newsletter'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Newsletter Broadcast Campaign
        </button>

        <button
          onClick={() => setActiveMainTab('autotriggers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all whitespace-nowrap ${
            activeMainTab === 'autotriggers'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          Automated Triggers
        </button>

        <button
          onClick={() => setActiveMainTab('branding')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all whitespace-nowrap ${
            activeMainTab === 'branding'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Shared Branding & Delivery
        </button>
      </div>

      {/* TAB 1: TRANSACTIONAL & SERVICE TEMPLATES */}
      {activeMainTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Template Selector & Parameters */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <List className="w-4 h-4 text-orange-500" />
                Select Template
              </h3>
              <div className="space-y-1.5">
                {templates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                      selectedTemplate === tmpl.id
                        ? 'bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400'
                        : 'border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{tmpl.name}</span>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {tmpl.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Parameter Editors */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                Live Preview Variables
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Recipient Display Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-medium"
                  />
                </div>

                {selectedTemplate === 'verification' && (
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Verification OTP Token</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-mono font-bold"
                    />
                  </div>
                )}

                {selectedTemplate === 'admin_notification' && (
                  <>
                    <div>
                      <label className="block text-slate-500 font-medium mb-1">Alert Headline</label>
                      <input
                        type="text"
                        value={alertTitle}
                        onChange={(e) => setAlertTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-medium mb-1">Alert Message</label>
                      <textarea
                        rows={3}
                        value={alertMessage}
                        onChange={(e) => setAlertMessage(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-medium"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Test Send Dispatcher */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Dispatch Test Email
              </h3>
              <p className="text-xs text-slate-400">
                Transmit a live test of the <strong className="text-white">{selectedTemplate}</strong> template in <strong className="text-orange-400 uppercase">{selectedLocale}</strong>.
              </p>
              <input
                type="email"
                placeholder="target@example.com"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-orange-500"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSendingTest ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Template ({selectedLocale.toUpperCase()})
                </button>
                <button
                  onClick={handleTestGatewayConnection}
                  disabled={isSendingTest}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Test Connection
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Responsive WYSIWYG Frame */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSubTab('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeSubTab === 'preview'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  WYSIWYG Render
                </button>
                <button
                  onClick={() => setActiveSubTab('html')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeSubTab === 'html'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  HTML Source
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setPreviewMode('desktop')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                    previewMode === 'desktop' ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-500' : 'text-slate-500'
                  }`}
                  title="Desktop 600px Frame"
                >
                  <Laptop className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewMode('mobile')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                    previewMode === 'mobile' ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-500' : 'text-slate-500'
                  }`}
                  title="Mobile 360px Frame"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Preview Frame */}
            <div className="bg-slate-200 dark:bg-slate-950 rounded-2xl p-6 min-h-[550px] flex items-center justify-center border border-slate-300 dark:border-slate-800 overflow-x-auto">
              {activeSubTab === 'preview' ? (
                <div
                  className={`transition-all duration-300 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 ${
                    previewMode === 'mobile' ? 'w-[360px]' : 'w-[620px]'
                  }`}
                >
                  <iframe
                    title="Email Preview"
                    srcDoc={renderTemplateHtml()}
                    className="w-full h-[600px] border-none"
                  />
                </div>
              ) : (
                <pre className="w-full max-h-[600px] overflow-auto p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800">
                  {renderTemplateHtml()}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NEWSLETTER BROADCAST CAMPAIGN */}
      {activeMainTab === 'newsletter' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-orange-500" />
                Newsletter Broadcast Campaign
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Compose, preview, and transmit rich newsletter updates to workspace members in <strong className="text-orange-500 uppercase">{selectedLocale}</strong>.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Active Broadcast Engine
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Email Subject Line</label>
                <input
                  type="text"
                  value={newsletterSubject}
                  onChange={(e) => setNewsletterSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Header Banner Title</label>
                <input
                  type="text"
                  value={newsletterTitle}
                  onChange={(e) => setNewsletterTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Header Image Banner URL</label>
                <input
                  type="text"
                  value={newsletterBannerUrl}
                  onChange={(e) => setNewsletterBannerUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Newsletter HTML / Body Copy</label>
                <textarea
                  rows={8}
                  value={newsletterBodyHtml}
                  onChange={(e) => setNewsletterBodyHtml(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={newsletterCtaText}
                    onChange={(e) => setNewsletterCtaText(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">CTA Destination URL</label>
                  <input
                    type="text"
                    value={newsletterCtaUrl}
                    onChange={(e) => setNewsletterCtaUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Recipients Email List (comma separated)</label>
                <textarea
                  rows={2}
                  value={newsletterRecipientsText}
                  onChange={(e) => setNewsletterRecipientsText(e.target.value)}
                  placeholder="user1@example.com, user2@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <button
                onClick={handleBroadcastNewsletter}
                disabled={isBroadcastingNewsletter}
                className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-orange-500/25 disabled:opacity-50"
              >
                {isBroadcastingNewsletter ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                Broadcast Newsletter Campaign ({selectedLocale.toUpperCase()})
              </button>
            </div>

            {/* Newsletter Live Preview */}
            <div className="lg:col-span-6 bg-slate-100 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center">
              <div className="w-[500px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                <iframe
                  title="Newsletter Preview"
                  srcDoc={`
                    <!DOCTYPE html>
                    <html>
                    <head><meta charset="utf-8"></head>
                    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
                      <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 900;">${newsletterTitle}</h2>
                      </div>
                      ${newsletterBannerUrl ? `<img src="${newsletterBannerUrl}" style="width: 100%; max-height: 180px; object-fit: cover;" />` : ''}
                      <div style="padding: 24px; font-size: 13px; color: #334155; line-height: 1.6;">
                        ${newsletterBodyHtml}
                        ${newsletterCtaUrl ? `<div style="text-align: center; margin-top: 24px;"><a href="${newsletterCtaUrl}" style="background-color: ${primaryColor}; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-bold: true; font-size: 12px; font-weight: bold;">${newsletterCtaText}</a></div>` : ''}
                      </div>
                    </body>
                    </html>
                  `}
                  className="w-full h-[550px] border-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATED TRIGGERS */}
      {activeMainTab === 'autotriggers' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              Automated Email Trigger Settings
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure background rule conditions that trigger automatic email dispatches when inventory status or gear return dates change.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trigger 1: Overdue Equipment Reminders */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Overdue Gear Reminders</h3>
                    <p className="text-xs text-slate-500">Auto email users holding overdue equipment</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={overdueTriggerEnabled}
                  onChange={(e) => setOverdueTriggerEnabled(e.target.checked)}
                  className="w-5 h-5 accent-orange-500 rounded cursor-pointer"
                />
              </div>

              <div className="text-xs space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-slate-600 dark:text-slate-400 font-medium">Trigger Grace Period (Days Overdue)</label>
                <input
                  type="number"
                  value={overdueThresholdDays}
                  onChange={(e) => setOverdueThresholdDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white font-bold"
                />
              </div>

              <button
                onClick={() => toast.success("Automated Overdue Trigger Rule updated!")}
                className="w-full py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold"
              >
                Save Overdue Rule Specs
              </button>
            </div>

            {/* Trigger 2: Low Stock Warning Alerts */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Low Stock Level Warnings</h3>
                    <p className="text-xs text-slate-500">Alert managers when stock drops below threshold</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={lowStockTriggerEnabled}
                  onChange={(e) => setLowStockTriggerEnabled(e.target.checked)}
                  className="w-5 h-5 accent-orange-500 rounded cursor-pointer"
                />
              </div>

              <div className="text-xs space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-slate-600 dark:text-slate-400 font-medium">Global Minimum Threshold Quantity</label>
                <input
                  type="number"
                  value={lowStockMinQty}
                  onChange={(e) => setLowStockMinQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white font-bold"
                />
              </div>

              <button
                onClick={() => toast.success("Automated Low Stock Trigger Rule updated!")}
                className="w-full py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold"
              >
                Save Low Stock Rule Specs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SHARED BRANDING & DELIVERY */}
      {activeMainTab === 'branding' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-orange-500" />
              Shared Email Branding & Footer Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Customize company name, logo graphics, primary accent color, and compliance footer text applied across all email types.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Company Display Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Logo URL</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Primary Accent Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Compliance Footer Text</label>
              <textarea
                rows={3}
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 dark:text-white font-medium"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleApplyBrandingChanges}
              className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all shadow-lg shadow-orange-500/20"
            >
              Apply Email Branding Specs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
