import React, { useState, useEffect } from 'react';
import { 
  Mail, Laptop, Smartphone, Send, Eye, Code, RefreshCw, 
  CheckCircle2, Trash2, Plus, ExternalLink, ShieldCheck, 
  AlertTriangle, CreditCard, ShoppingBag, List, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminSettings } from '../types';
import { emailService } from '../services/emailService';

interface EmailTemplatesProps {
  settings: AdminSettings | null;
  onUpdateSettings?: (updated: AdminSettings) => void;
}

export default function EmailTemplates({ settings, onUpdateSettings }: EmailTemplatesProps) {
  // Current templates list
  const templates = [
    { id: 'verification', name: '🔑 Security Token Verification', category: 'Transactional' },
    { id: 'checkout', name: '📦 Dynamic Logistics Checkout Receipt', category: 'Operational' },
    { id: 'admin_notification', name: '🚨 System Infrastructure Telemetry Alert', category: 'System Alert' },
    { id: 'listing_approved', name: '🌍 Fiji Marketplace Listing Published', category: 'Marketing & Comm' },
    { id: 'invoice', name: '💳 Subscription Invoice & Deposit Receipt', category: 'Billing' }
  ];

  const [selectedTemplate, setSelectedTemplate] = useState<string>('verification');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeSubTab, setActiveSubTab] = useState<'preview' | 'html'>('preview');

  // Shared Brand Controls - Local override state
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FF5500');
  const [footerText, setFooterText] = useState('');
  const [footerLinks, setFooterLinks] = useState<Array<{ label: string; href: string }>>([]);

  // Local state helper inputs for WYSIWYG parameters
  const [recipientName, setRecipientName] = useState('John Operator');
  const [recipientEmail, setRecipientEmail] = useState('recipient@example.com');
  const [customSubject, setCustomSubject] = useState('');

  // 1. Verification OTP Preset States
  const [otpCode, setOtpCode] = useState('524389');
  
  // 2. Logistics Checkout Preset States
  const [checkoutItems, setCheckoutItems] = useState([
    { id: '1', name: 'Subaru Dual-Band RF Walkie-Talkie', serial: 'SN-RF-9923', condition: 'Excellent', returnDate: '2026-06-30' },
    { id: '2', name: 'Sony Alpha FX3 Cinema Camera Frame', serial: 'SN-CAM-1004', condition: 'Good', returnDate: '2026-06-25' },
    { id: '3', name: 'Rigid Heavy Transit Water Case 2L', serial: 'SN-CS-4830', condition: 'Fair', returnDate: '2026-07-15' }
  ]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemSerial, setNewItemSerial] = useState('');
  const [newItemCondition, setNewItemCondition] = useState('Excellent');
  const [newItemReturnDate, setNewItemReturnDate] = useState('2026-06-30');

  // 3. Technical System Alerts States
  const [alertTitle, setAlertTitle] = useState('Cluster Node CPU Threshold Violation');
  const [alertMessage, setAlertMessage] = useState('Express instance container (Port 3000) generated rapid telemetry alerts resulting in automated heap garbage dump.');
  const [alertDetails, setAlertDetails] = useState<Array<{ key: string; value: string }>>([
    { key: 'Cluster Host', value: 'asia-east1-docker-run-pod' },
    { key: 'Resource Overhead', value: '94.8% CPU (Threshold 85%)' },
    { key: 'Process ID', value: 'PID_994032_VITE' },
    { key: 'Deployment Ingress', value: 'nginx-ingress-rev-proxy' }
  ]);
  const [newDetailKey, setNewDetailKey] = useState('');
  const [newDetailValue, setNewDetailValue] = useState('');

  // 4. Marketplace Published Announcement States
  const [listingTitle, setListingTitle] = useState('Husqvarna heavy duty petrol generator');
  const [listingPrice, setListingPrice] = useState('$1,250 FJD');
  const [listingLocation, setListingLocation] = useState('Nadi Town, Ba');
  const [listingCtaText, setListingCtaText] = useState('Explore Listing Now');

  // 5. Subscription Invoice Statement States
  const [invoiceNumber, setInvoiceNumber] = useState('PT-2026-88301');
  const [invoicePlan, setInvoicePlan] = useState('Enterprise Tier Hub');
  const [invoiceSubtotal, setInvoiceSubtotal] = useState('$189.00 USD');
  const [invoiceVat, setInvoiceVat] = useState('$28.35 FJD (VAT 15%)');
  const [invoiceTotal, setInvoiceTotal] = useState('$217.35 USD');

  // Test send state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testSubjectLine, setTestSubjectLine] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Sync settings whenever global settings reload
  useEffect(() => {
    const brand = settings?.emailBranding;
    const globalBrand = settings?.branding;
    setCompanyName(brand?.companyName || globalBrand?.companyName || 'Packer Tools');
    setLogoUrl(brand?.logoUrl || globalBrand?.logo || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop');
    setPrimaryColor(brand?.primaryColor || globalBrand?.primaryColor || '#FF5500');
    setFooterText(brand?.footerText || 'You received this notification because you are a registered manager of the Packer Tools workspace network.');
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
    toast.success('Branded specs saved securely inside temporary configuration registers. Click "Save System Settings" in Settings tab to persist forever.');
  };

  // Helper template layouts for WYSIWYG Previews
  const getSubject = () => {
    if (customSubject) return customSubject;
    switch (selectedTemplate) {
      case 'verification':
        return `🔑 ${otpCode} is your Packer Tools login token`;
      case 'checkout':
        return `📦 Gear Transfer Confirmation List - Checked Out Items`;
      case 'admin_notification':
        return `⚠️ [CRITICAL] Cloud Run Alert: ${alertTitle}`;
      case 'listing_approved':
        return `🎉 Fiji Regional Listing Approved: "${listingTitle}"`;
      case 'invoice':
        return `💳 Invoice Statement #${invoiceNumber} from ${companyName}`;
      default:
        return 'System Alert Dispatch Notice';
    }
  };

  // Generate Email HTML string
  const generateEmailHTML = () => {
    const styles = {
      primaryColor,
      companyName,
      logoUrl,
      footerText,
      footerLinks
    };

    let contentHTML = '';

    if (selectedTemplate === 'verification') {
      contentHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; text-align: center;">
          <p style="font-size: 15px; color: #4b5563; font-weight: 600; margin-top: 0;">Bula Vinaka, <strong>${recipientName}</strong>,</p>
          <p style="font-size: 13px; color: #6b7280; line-height: 20px; max-width: 400px; margin: 12px auto 24px auto;">
            Use the following temporary security verification sequence token to access your secure device login panel:
          </p>
          <div style="font-family: monospace; font-size: 28px; font-weight: 900; letter-spacing: 6px; padding: 18px 24px; border-radius: 12px; background-color: #fcf8f5; border: 1px dashed ${primaryColor}40; display: inline-block; color: ${primaryColor}; margin-bottom: 24px;">
            ${otpCode}
          </div>
          <p style="font-size: 11px; color: #a3a3a3; font-style: italic; max-width: 360px; margin: 0 auto;">
            This security code sequence decays inside 15 minutes. Log in attempt initiated from external secure telemetry console. If you did not command this, please ignore.
          </p>
        </div>
      `;
    } else if (selectedTemplate === 'checkout') {
      const rows = checkoutItems.map(item => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 8px; font-size: 12px; color: #1f2937; font-weight: 700;">${item.name}</td>
          <td style="padding: 10px 8px; font-size: 11px; font-family: monospace; color: #6b7280;">${item.serial}</td>
          <td style="padding: 10px 8px; font-size: 11px; color: #374151; text-align: center;">
            <span style="padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; background-color: ${item.condition === 'Excellent' ? '#ecfdf5' : item.condition === 'Good' ? '#f0f9ff' : '#fffbeb'}; color: ${item.condition === 'Excellent' ? '#047857' : item.condition === 'Good' ? '#0369a1' : '#b45309'}; text-transform: uppercase;">
              ${item.condition}
            </span>
          </td>
          <td style="padding: 10px 8px; font-size: 11px; color: #ef4444; font-weight: 700; text-align: right;">${item.returnDate}</td>
        </tr>
      `).join('');

      contentHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px;">
          <h4 style="margin: 0 0 4px 0; color: #111827; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px;">Bula Vinaka, ${recipientName}</h4>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px 0; line-height: 18px;">
            You have successfully processed an automated equipment logistical handover on this device. Below are the registered items assigned to your profile record:
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #f3f4f6;">
            <thead>
              <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #4b5563; text-align: left;">Equipment Name</th>
                <th style="padding: 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #4b5563; text-align: left;">Serial ID</th>
                <th style="padding: 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #4b5563; text-align: center;">Condition</th>
                <th style="padding: 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #4b5563; text-align: right;">Return Date</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 12px; margin-top: 16px;">
            <p style="font-size: 11px; font-weight: 700; color: #991b1b; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px;">
              ⚠️ RETROACTIVE MAINTENANCE TERM
            </p>
            <p style="font-size: 10.5px; color: #7f1d1d; margin: 0; line-height: 15px; font-weight: 500;">
              Please return all listed gear immediately prior on or before the designated Return Date. Outstanding items will automatically flag audits under structural team protocols.
            </p>
          </div>
        </div>
      `;
    } else if (selectedTemplate === 'admin_notification') {
      const rows = alertDetails.map(detail => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 6px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #9ca3af; width: 120px;">${detail.key}:</td>
          <td style="padding: 6px; font-size: 11px; font-family: monospace; color: #f3f4f6; font-weight: bold;">${detail.value}</td>
        </tr>
      `).join('');

      contentHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; background-color: #171d2b; color: #f3f4f6;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 900; color: #ef4444; border-bottom: 1px solid #1e293b; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            🚨 ${alertTitle}
          </h4>
          <p style="font-size: 11.5px; color: #9ca3af; margin: 0 0 16px 0; line-height: 17px;">
            An automated administrative anomaly detector alert was triggered in the logistics cluster infrastructure. Check metrics specs below:
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background-color: #0f172a; border-radius: 8px;">
            <tbody>
              ${rows}
            </tbody>
          </table>

          <p style="font-size: 11px; color: #ffedd5; background-color: #7c2d12; border: 1px solid #9a3412; border-radius: 8px; padding: 10px; margin: 12px 0 0 0; line-height: 15px;">
            <strong>System Summary Message:</strong> ${alertMessage}
          </p>
        </div>
      `;
    } else if (selectedTemplate === 'listing_approved') {
      contentHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; text-align: center;">
          <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 900; tracking: -0.5px; text-transform: uppercase;">YOUR LISTING IS LIVE! 🎉</h3>
          <p style="font-size: 13.5px; color: #4b5563; font-weight: bold; margin-bottom: 16px;">Bula Vinaka, ${recipientName}</p>
          
          <p style="font-size: 13px; color: #6b7280; line-height: 20px; max-width: 420px; margin: 12px auto;">
            Our Fiji regional moderation board has successfully verified and published your marketplace listing! Users can now explore, rent, or purchase this gear.
          </p>

          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; max-width: 320px; margin: 18px auto; text-align: left;">
            <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 2px;">Listing Item</div>
            <div style="font-size: 13px; font-weight: 900; color: #111827; line-height: 16px;">${listingTitle}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-t: 1px solid #f3f4f6; padding-top: 8px;">
              <div>
                <span style="font-size: 9px; uppercase; color: #9ca3af; block; font-weight: bold;">Price Spec</span>
                <span style="font-size: 12px; font-weight: 900; color: ${primaryColor}; block;">${listingPrice}</span>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 9px; uppercase; color: #9ca3af; block; font-weight: bold;">Municipality</span>
                <span style="font-size: 11px; font-weight: 700; color: #4b5563; block;">${listingLocation}</span>
              </div>
            </div>
          </div>

          <div style="margin: 24px 0 12px 0;">
            <a href="#" style="background-color: ${primaryColor}; color: #ffffff; padding: 10px 24px; border-radius: 12px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; text-decoration: none; display: inline-block;">
              ${listingCtaText}
            </a>
          </div>
        </div>
      `;
    } else {
      contentHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; border-bottom: 1px solid #f3f4f6; padding-bottom: 12px;">
            <div>
              <span style="font-size: 10px; uppercase; color: #9cb3af; font-weight: bold; display: block;">INVOICE BILL SENT</span>
              <span style="font-size: 14px; font-weight: 900; color: #111827;">Num: #${invoiceNumber}</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 10px; uppercase; color: #9cb3af; font-weight: bold; display: block;">DATE ISSUED</span>
              <span style="font-size: 11px; font-weight: 700; color: #4b5563;">${new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <p style="font-size: 13.5px; color: #4b5563; font-weight: bold; margin: 0 0 12px 0;">Hi ${recipientName},</p>
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 16px 0; line-height: 18px;">
            A safe digital deposit receipt statement was created automatically following subscription upgrades on your secure organization profile:
          </p>

          <div style="background-color: #f9fafb; border-radius: 12px; padding: 12px; border: 1px solid #e5e7eb;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
              <tbody>
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 6px 0; color: #4b5563; font-weight: 600;">Service Plan:</td>
                  <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #111827;">${invoicePlan}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 6px 0; color: #4b5563;">Net Subtotal:</td>
                  <td style="padding: 6px 0; text-align: right; color: #4b5563;">${invoiceSubtotal}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 6px 0; color: #8b5cf6;">Fiji VAT Surcharges:</td>
                  <td style="padding: 6px 0; text-align: right; color: #8b5cf6; font-weight: 650;">${invoiceVat}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0 0 0; color: #111827; font-weight: 900; font-size: 13px;">Total Charged:</td>
                  <td style="padding: 8px 0 0 0; text-align: right; font-weight: 900; color: ${primaryColor}; font-size: 13px;">${invoiceTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p style="font-size: 10px; color: #a3a3a3; text-align: center; margin-top: 18px;">
            Thank you for building alongside us. Secure charges will reflect under standard terms of service.
          </p>
        </div>
      `;
    }

    const previewHeaderHTML = selectedTemplate === 'verification' 
      ? `
        <div style="padding: 24px; text-align: center; color: #ffffff; background-color: ${primaryColor};">
          <div style="width: 48px; height: 48px; background-color: rgba(255,255,255,0.1); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
            <img src="${logoUrl}" alt="Corporate Logo" style="max-height: 32px; max-width: 100%; object-fit: contain; border-radius: 4px;" />
          </div>
          <h2 style="margin: 0; font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">Verification Bureau</h2>
        </div>
      `
      : selectedTemplate === 'admin_notification'
      ? `
        <div style="background-color: #0d131f; padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1e293b;">
          <span style="font-weight: 900; font-size: 10px; text-transform: uppercase; color: #ef4444; letter-spacing: 1px;">🚨 ${companyName} Node Monitor</span>
          <img src="${logoUrl}" alt="Branded Logo" style="max-height: 20px; max-width: 80px; object-fit: contain;" />
        </div>
      `
      : `
        <div style="padding: 32px; text-align: center; background-color: #1e293b; color: #ffffff;">
          <img src="${logoUrl}" alt="Branded Logo" style="max-height: 44px; max-width: 140px; object-fit: contain; display: block; margin: 0 auto 12px auto; border-radius: 6px;" />
          <h1 style="margin: 0; font-size: 17px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #f9fafb;">${companyName} LOGISTICS</h1>
        </div>
      `;

    // Dynamic Footer layout
    const footerAnchors = footerLinks.map((link, idx) => `
      ${idx > 0 ? `<span style="color: #e5e7eb;"> | </span>` : ''}
      <a href="${link.href}" style="color: ${primaryColor}; font-weight: bold; text-decoration: none;">${link.label}</a>
    `).join('');

    const templateHTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${getSubject()}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f3f4f6; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 32px 10px 48px 10px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e5e7eb;">
            <!-- Live Branded Header -->
            <tr>
              <td>
                ${previewHeaderHTML}
              </td>
            </tr>
            <!-- Dynamic Content -->
            <tr>
              <td style="background-color: #ffffff;">
                ${contentHTML}
              </td>
            </tr>
            <!-- Live Footer Configuration Map -->
            <tr>
              <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center; font-size: 10px; color: #9ca3af; line-height: 1.6;">
                <p style="margin: 0 0 6px 0; font-size: 9.5px; font-weight: 600; color: #4b5563;">© ${new Date().getFullYear()} ${companyName} Workspace Registry System.</p>
                
                ${footerLinks.length > 0 ? `
                  <div style="margin-bottom: 8px;">
                    ${footerAnchors}
                  </div>
                ` : ''}

                ${footerText ? `
                  <p style="margin: 8px 0 0 0; font-size: 9px; line-height: 14px; font-style: italic; max-width: 400px; margin-left: auto; margin-right: auto; padding-top: 8px; border-top: 1px dashed #e5e7eb;">
                    ${footerText}
                  </p>
                ` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim();

    return templateHTML;
  };

  // Dispatch live transactional email preview using API route
  const handleSendLiveTest = async () => {
    if (!testEmailAddress.trim() || !testEmailAddress.includes('@')) {
      toast.error('Please enter a valid target email address.');
      return;
    }

    setIsSendingTest(true);
    try {
      let res;
      if (selectedTemplate === 'verification') {
        res = await emailService.sendVerificationEmail(
          testEmailAddress.trim(),
          otpCode,
          recipientName,
          settings
        );
      } else if (selectedTemplate === 'admin_notification') {
        const detailsMap: Record<string, string> = {};
        alertDetails.forEach(d => {
          if (d.key && d.value) detailsMap[d.key] = d.value;
        });

        res = await emailService.sendAdminNotification(
          testEmailAddress.trim(),
          alertTitle,
          alertMessage,
          detailsMap,
          settings
        );
      } else {
        // Compose generalized notice including table items or listings description
        let dynamicMsg = '';
        if (selectedTemplate === 'checkout') {
          dynamicMsg = `Equipment Check-out validation finalized. Handed over key assets: ${checkoutItems.map(i => `${i.name} (${i.serial})`).join(', ')}. Outstanding return date is set.`;
        } else if (selectedTemplate === 'listing_approved') {
          dynamicMsg = `Your marketplace item named "${listingTitle}" has been verified under structural Fijian policies for price tier ${listingPrice}. Use controls instantly to preview details.`;
        } else {
          dynamicMsg = `Billing statement issued successfully. Statement ID #${invoiceNumber}. Service Tier selected corresponds to "${invoicePlan}". Total amount cleared: ${invoiceTotal}.`;
        }

        res = await emailService.sendNotification(
          testEmailAddress.trim(),
          getSubject(),
          `Branded Notice Alert`,
          dynamicMsg,
          window.location.origin + "/admin",
          "Check Admin Settings Panel",
          settings
        );
      }

      if (res && res.simulated) {
        toast.info(`Sandbox simulator dispatch success (unconfigured SMTP block). Simulation targets: ${testEmailAddress}`);
      } else {
        toast.success(`Active email dispatch cleared successfully to ${testEmailAddress}!`);
      }
    } catch (err: any) {
      toast.error(`Email dispatch execution error: ${err.message || err}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Live item lists modifiers handlers
  const handleAddCheckoutItem = () => {
    if (!newItemName.trim() || !newItemSerial.trim()) {
      toast.error('Add both equipment label and corresponding SKU/serial code.');
      return;
    }
    const newlyAdded = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      serial: newItemSerial.trim(),
      condition: newItemCondition,
      returnDate: newItemReturnDate
    };
    setCheckoutItems([...checkoutItems, newlyAdded]);
    setNewItemName('');
    setNewItemSerial('');
    toast.success('Appended gear item row to checkout preview receipts.');
  };

  const handleRemoveCheckoutItem = (pId: string) => {
    setCheckoutItems(checkoutItems.filter(i => i.id !== pId));
    toast.success('Removed item row from invoice database preview table.');
  };

  // Live admin parameters modifiers handlers
  const handleAddDetail = () => {
    if (!newDetailKey.trim() || !newDetailValue.trim()) {
      toast.error('Keys and Values are required.');
      return;
    }
    setAlertDetails([...alertDetails, { key: newDetailKey.trim(), value: newDetailValue.trim() }]);
    setNewDetailKey('');
    setNewDetailValue('');
    toast.success('Appended telemetry alert key pair.');
  };

  const handleRemoveDetail = (idx: number) => {
    setAlertDetails(alertDetails.filter((_, i) => i !== idx));
    toast.success('Removed telemetry detail.');
  };

  const computedHTML = generateEmailHTML();

  return (
    <div className="space-y-6">
      
      {/* Visual Header Block */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-150/80 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-primary/10 text-primary rounded-xl">
                <Mail size={20} className="animate-bounce" />
              </span>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-neutral-900">Branded Email Template Hub</h2>
            </div>
            <p className="text-neutral-500 text-xs font-semibold">
              Live design previewer & transactional compiler for custom organizational alerts, equipment checklists, and verification codes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedTemplate('verification');
                toast.success('Reset dynamic preview triggers.');
              }}
              className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition duration-200"
              title="Reset configuration defaults"
            >
              <RefreshCw size={15} />
            </button>

            <button
              onClick={handleApplyBrandingChanges}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow active:scale-95 duration-200"
            >
              Push Brand Specs
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Options Controller Panel (5 cols) */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Section 1: Template selector card */}
          <div className="bg-white p-5 rounded-[2rem] border border-neutral-150/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="font-extrabold uppercase text-[11px] tracking-wider text-neutral-600">Select Interactive Template</h3>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className={`w-full p-3 rounded-xl text-left border transition text-xs flex flex-col gap-1 ${
                    selectedTemplate === tpl.id 
                      ? 'border-neutral-900 bg-neutral-950 text-white shadow' 
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/80 text-neutral-700'
                  }`}
                >
                  <span className="font-extrabold">{tpl.name}</span>
                  <span className={`text-[9px] font-bold ${selectedTemplate === tpl.id ? 'text-primary' : 'text-neutral-400'}`}>
                    Category: {tpl.category}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Custom variables editor depending on currently selected template */}
          <div className="bg-white p-5 rounded-[2rem] border border-neutral-150/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
              <span className="w-2 h-2 rounded-full bg-neutral-500" />
              <h3 className="font-extrabold uppercase text-[11px] tracking-wider text-neutral-600">WYSIWYG Variable Overrides</h3>
            </div>

            <div className="space-y-4">
              {/* Recipient custom state */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">Recipient Display Name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              {/* Subject custom state */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">Custom Subject Line (Optional)</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="Defaults to layout dynamic headers..."
                  className="w-full px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              {/* DYNAMIC FIELD GENERATORS */}

              {/* Template: OTP Verification code */}
              {selectedTemplate === 'verification' && (
                <div className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-150">
                  <span className="text-[9px] font-black uppercase text-[#FF5500] tracking-wider block font-mono">🔑 OTP Secure Token Editor</span>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase">Verification Code (6-digits)</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-200 text-xs font-black font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Template: Logistics Equipment Checkout Receipt */}
              {selectedTemplate === 'checkout' && (
                <div className="space-y-3 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-150 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider block font-mono">📦 Log Table items ({checkoutItems.length})</span>
                  </div>
                  
                  {checkoutItems.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {checkoutItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-neutral-200 text-[10px]">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="font-extrabold text-neutral-800 truncate leading-none mb-1">{item.name}</p>
                            <span className="font-mono text-[8px] text-neutral-400 block">{item.serial} • Returns {item.returnDate}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveCheckoutItem(item.id)}
                            className="text-red-600 hover:text-red-700 font-extrabold uppercase text-[9px] shrink-0"
                          >
                            Del
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9px] text-neutral-400 italic block text-center uppercase font-bold py-2">All equipment tables empty</p>
                  )}

                  <div className="bg-white p-2 text-[10px] rounded-xl border border-neutral-200/60 space-y-1.5">
                    <input
                      type="text"
                      placeholder="Asset name (e.g. Sony FX3)"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 outline-none text-[10px] font-semibold"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="Serial/SKU"
                        value={newItemSerial}
                        onChange={(e) => setNewItemSerial(e.target.value)}
                        className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1 outline-none text-[10px] font-mono"
                      />
                      <select
                        value={newItemCondition}
                        onChange={(e) => setNewItemCondition(e.target.value)}
                        className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-[10px] font-semibold"
                      >
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                      </select>
                    </div>
                    <input
                      type="date"
                      value={newItemReturnDate}
                      onChange={(e) => setNewItemReturnDate(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 outline-none text-[10px] font-semibold"
                    />
                    <button
                      type="button"
                      onClick={handleAddCheckoutItem}
                      className="w-full py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-black text-white text-[9px] font-black uppercase rounded tracking-wider"
                    >
                      + Add New Item Entry
                    </button>
                  </div>
                </div>
              )}

              {/* Template: System Alerts */}
              {selectedTemplate === 'admin_notification' && (
                <div className="space-y-3 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-150 text-left">
                  <span className="text-[9px] font-black uppercase text-red-600 tracking-wider block font-mono">🚨 Telemetry Alert Controls</span>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase">Alert Sub-Header</label>
                    <input
                      type="text"
                      value={alertTitle}
                      onChange={(e) => setAlertTitle(e.target.value)}
                      className="w-full px-2 py-1 bg-white rounded border border-neutral-200 text-[11px] font-extrabold text-neutral-800 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase">Alert Description Text</label>
                    <textarea
                      rows={2}
                      value={alertMessage}
                      onChange={(e) => setAlertMessage(e.target.value)}
                      className="w-full px-2 py-1 bg-white rounded border border-neutral-200 text-[10px] outline-none resize-none font-semibold text-neutral-600"
                    />
                  </div>
                  
                  {/* Metadata fields list */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-neutral-450 block font-mono mt-2">Dynamic Key-Pair Labels</label>
                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-neutral-200/60">
                      {alertDetails.map((detail, dIdx) => (
                        <div key={dIdx} className="flex justify-between items-center text-[9.5px] border-b border-neutral-50 py-0.5">
                          <span className="font-extrabold text-neutral-400">{detail.key}:</span>
                          <span className="font-mono text-neutral-800 truncate pr-2">{detail.value}</span>
                          <button onClick={() => handleRemoveDetail(dIdx)} className="text-red-500 hover:text-red-600 font-bold shrink-0">✕</button>
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        <input
                          type="text"
                          placeholder="Label (e.g. CPU)"
                          value={newDetailKey}
                          onChange={(e) => setNewDetailKey(e.target.value)}
                          className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-[9px] outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Val (e.g. 98%)"
                          value={newDetailValue}
                          onChange={(e) => setNewDetailValue(e.target.value)}
                          className="bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-[9px] outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddDetail}
                        className="w-full mt-1.5 py-1 bg-neutral-900 text-white text-[8px] font-black uppercase rounded tracking-wider"
                      >
                        + Insert Row Parameters
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Template: Listing Approved */}
              {selectedTemplate === 'listing_approved' && (
                <div className="space-y-3 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-150 text-left">
                  <span className="text-[9px] font-black uppercase text-blue-600 tracking-wider block font-mono">🎉 Moderation Board Controls</span>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase">Item Listing Title</label>
                    <input
                      type="text"
                      value={listingTitle}
                      onChange={(e) => setListingTitle(e.target.value)}
                      className="w-full px-2 py-1 bg-white rounded border border-neutral-200 text-[11px] font-extrabold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase">Price Tag</label>
                      <input
                        type="text"
                        value={listingPrice}
                        onChange={(e) => setInvoiceTotal(e.target.value)}
                        className="w-full px-2 py-1 bg-white rounded border border-neutral-200 text-[11px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase">Municipality</label>
                      <input
                        type="text"
                        value={listingLocation}
                        onChange={(e) => setListingLocation(e.target.value)}
                        className="w-full px-2 py-1 bg-white rounded border border-neutral-200 text-[11px]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase">CTA Button Call Out text</label>
                    <input
                      type="text"
                      value={listingCtaText}
                      onChange={(e) => setListingCtaText(e.target.value)}
                      className="w-full px-2 py-1 bg-white rounded border border-neutral-200 text-[11px]"
                    />
                  </div>
                </div>
              )}

              {/* Template: Billing Invoice Receipt */}
              {selectedTemplate === 'invoice' && (
                <div className="space-y-3 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-150 text-left">
                  <span className="text-[9px] font-black uppercase text-purple-600 tracking-wider block font-mono">💳 Statement Invoice Parameters</span>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase">Invoice Statement ID</label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-2 py-1 bg-white rounded border border-neutral-200 text-[11px] font-mono tracking-wider font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase">Corporate Service Tier</label>
                    <input
                      type="text"
                      value={invoicePlan}
                      onChange={(e) => setInvoicePlan(e.target.value)}
                      className="w-full px-2 py-1 bg-white rounded border border-neutral-200 text-[11px] font-extrabold"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-neutral-500 uppercase">Subtotal</label>
                      <input
                        type="text"
                        value={invoiceSubtotal}
                        onChange={(e) => setInvoiceSubtotal(e.target.value)}
                        className="w-full px-1.5 py-1 bg-white rounded border border-neutral-200 text-[10px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-neutral-500 uppercase">Tax Value</label>
                      <input
                        type="text"
                        value={invoiceVat}
                        onChange={(e) => setInvoiceVat(e.target.value)}
                        className="w-full px-1.5 py-1 bg-white rounded border border-neutral-200 text-[10px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-neutral-500 uppercase">Total Net</label>
                      <input
                        type="text"
                        value={invoiceTotal}
                        onChange={(e) => setInvoiceTotal(e.target.value)}
                        className="w-full px-1.5 py-1 bg-white rounded border border-neutral-200 text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Preview Generator Frame Sandbox (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-neutral-900 rounded-[2.5rem] p-6 border border-neutral-850 shadow-2xl relative text-left text-white">
            
            {/* Upper preview dashboard toolbar controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4 mb-6">
              
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest block font-mono">💻 Live Sandbox Previewer</span>
                <h3 className="text-white text-lg font-black uppercase tracking-tight">WYSIWYG Email Simulator</h3>
              </div>

              {/* Toggle tabs and devices format selectors */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Mode Selector preview vs code */}
                <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-[10px] font-bold">
                  <button
                    onClick={() => setActiveSubTab('preview')}
                    className={`px-3 py-1.5 rounded-lg transition-all text-xs flex items-center gap-1.5 ${activeSubTab === 'preview' ? 'bg-primary text-white font-black' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    <Eye size={12} />
                    <span>Visual Simulator</span>
                  </button>
                  <button
                    onClick={() => setActiveSubTab('html')}
                    className={`px-3 py-1.5 rounded-lg transition-all text-xs flex items-center gap-1.5 ${activeSubTab === 'html' ? 'bg-primary text-white font-black' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    <Code size={12} />
                    <span>Markup HTML Code</span>
                  </button>
                </div>

                {/* Device Selector */}
                <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-[10px] font-bold">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={`p-1.5 rounded-lg transition-all ${previewMode === 'desktop' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                    title="Desktop Preview Range"
                  >
                    <Laptop size={15} />
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className={`p-1.5 rounded-lg transition-all ${previewMode === 'mobile' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                    title="Mobile Core Canvas Width"
                  >
                    <Smartphone size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Simulated Email Browser Header Specs Frame */}
            <div className="bg-neutral-950 rounded-2xl border border-neutral-800/60 p-4 mb-4 font-mono text-[10.5px] text-neutral-400 space-y-1.5 select-none">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-neutral-500 w-16 uppercase">From:</span>
                <span className="text-neutral-300 font-bold">
                  {companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}-notifications@{selectedTemplate === 'admin_notification' ? 'alerts' : 'logistics'}.packer.tools
                </span>
                <span className="px-1.5 py-0.5 bg-[#FF5500]/10 text-primary rounded text-[8px] font-black uppercase tracking-wider ml-2">VERIFIED RESEND SPF</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-neutral-500 w-16 uppercase">To:</span>
                <span className="text-neutral-300 font-bold">"{recipientName}" &lt;{recipientEmail}&gt;</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="font-extrabold text-neutral-500 w-16 uppercase pb-1">Subject:</span>
                <span className="text-emerald-400 font-extrabold leading-normal select-text break-all">{getSubject()}</span>
              </div>
            </div>

            {/* Main Interactive Canvas iframe-like rendering viewport wrapper */}
            {activeSubTab === 'preview' ? (
              <div className="bg-neutral-100 rounded-[2.5rem] p-4 md:p-8 border border-neutral-200 overflow-hidden flex justify-center text-[#1e293b]">
                <div 
                  className="transition-all duration-300 shadow-xl overflow-hidden rounded-3xl"
                  style={{ width: previewMode === 'mobile' ? '375px' : '100%', maxWidth: '520px' }}
                >
                  <div className="bg-white border border-neutral-200/60 overflow-hidden">
                    
                    {/* Dynamic Styled Header */}
                    {selectedTemplate === 'verification' ? (
                      <div className="p-6 text-center text-white flex flex-col items-center justify-center select-none" style={{ backgroundColor: primaryColor }}>
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                          <img src={logoUrl} referrerPolicy="no-referrer" alt="Branding header" className="object-contain max-h-8 max-w-[120px]" />
                        </div>
                        <h2 className="margin-0 text-[10px] font-mono tracking-widest font-black uppercase text-white/90">Identity Verification Gateway</h2>
                      </div>
                    ) : selectedTemplate === 'admin_notification' ? (
                      <div className="p-4 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between select-none">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="font-extrabold text-[10px] uppercase tracking-wider">🚨 {companyName} Cluster Overseer</span>
                        </div>
                        <img src={logoUrl} referrerPolicy="no-referrer" alt="Custom logo preview" className="object-contain max-h-5 max-w-[80px]" />
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-800 text-white flex flex-col items-center justify-center select-none">
                        <img src={logoUrl} referrerPolicy="no-referrer" alt="Branded Logo" className="object-contain max-h-12 max-w-[140px] mb-3 rounded" />
                        <h1 className="margin-0 text-md font-black uppercase tracking-widest text-[#FF5500]">SYSTEM DISPATCH DISCLOSURE</h1>
                      </div>
                    )}

                    {/* Email Card Body Content Injector Block Container */}
                    <div className="p-6 md:p-8">
                      {selectedTemplate === 'verification' && (
                        <div className="space-y-4 text-center">
                          <p className="text-xs text-neutral-600 font-bold mt-0">Bula Vinaka, <strong>{recipientName}</strong>,</p>
                          <p className="text-[11.5px] text-neutral-500 leading-relaxed font-sans mt-0">
                            Use the following temporary security verification sequence token to access your secure device login panel for {companyName}:
                          </p>
                          <div className="font-mono text-2xl font-black tracking-widest p-4 rounded-xl border inline-block bg-orange-50/20 select-all" style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>
                            {otpCode}
                          </div>
                          <p className="text-[9.5px] text-neutral-400 italic font-medium leading-relaxed max-w-[360px] mx-auto">
                            This security code sequence decays inside 15 minutes. Log in attempt initiated from external secure telemetry console.
                          </p>
                        </div>
                      )}

                      {selectedTemplate === 'checkout' && (
                        <div className="space-y-4">
                          <p className="text-xs text-neutral-600 font-bold mt-0">Bula Vinaka, <strong>{recipientName}</strong>,</p>
                          <p className="text-[11px] text-neutral-500 leading-normal font-sans">
                            You have successfully processed an automated equipment logistical handover on this device. Below are the registered items assigned to your profile record:
                          </p>
                          
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b-2 border-neutral-100 bg-neutral-50 text-[10px] text-neutral-400 font-extrabold uppercase select-none">
                                <th className="p-2">Equipment</th>
                                <th className="p-2">Serial ID</th>
                                <th className="p-2 text-center">Grade</th>
                                <th className="p-2 text-right">Return Due</th>
                              </tr>
                            </thead>
                            <tbody>
                              {checkoutItems.map((item) => (
                                <tr key={item.id} className="border-b border-neutral-100 font-sans font-medium text-[11px]">
                                  <td className="p-2 font-extrabold text-neutral-800 leading-snug">{item.name}</td>
                                  <td className="p-2 font-mono text-[10px] text-neutral-400 font-semibold">{item.serial}</td>
                                  <td className="p-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                      item.condition === 'Excellent' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                      item.condition === 'Good' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                                      'bg-amber-50 text-amber-700 border border-amber-100'
                                    }`}>
                                      {item.condition}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right text-red-600 font-bold font-mono">{item.returnDate}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-[10.5px]">
                            <div className="font-extrabold text-red-700 uppercase tracking-widest font-mono text-[9px] mb-1">
                              ⚠️ RETROACTIVE MAINTENANCE TERM
                            </div>
                            <p className="text-red-800 leading-relaxed font-sans m-0">
                              Please return all listed gear immediately prior on or before the designated Return Date. Outstanding items will automatically flag audits under structural team protocols.
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedTemplate === 'admin_notification' && (
                        <div className="space-y-4">
                          <h4 className="font-extrabold text-red-600 text-[12.5px] border-b border-neutral-100 pb-2 flex items-center gap-1.5 uppercase font-mono tracking-wide">
                            <AlertTriangle size={15} />
                            <span>{alertTitle}</span>
                          </h4>
                          <p className="text-[11.5px] text-neutral-500 font-semibold leading-relaxed font-sans">
                            An automated administrative anomaly detector alert was triggered in the logistics cluster infrastructure. Check metrics specs below:
                          </p>

                          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                            <table className="w-full text-left text-[11px] font-sans font-semibold">
                              <tbody>
                                {alertDetails.map((detail, dIdx) => (
                                  <tr key={dIdx} className="border-b border-neutral-100/60 font-semibold">
                                    <td className="py-1 text-neutral-400 font-bold uppercase text-[9.5px]">{detail.key}:</td>
                                    <td className="py-1 text-neutral-800 font-mono text-[10.5px] font-extrabold text-right">{detail.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <p className="text-[11px] text-neutral-600 leading-relaxed bg-[#FF5500]/5 border border-[#FF5500]/10 p-3 rounded-xl font-sans m-0">
                            <strong>System Summary Message:</strong> {alertMessage}
                          </p>
                        </div>
                      )}

                      {selectedTemplate === 'listing_approved' && (
                        <div className="space-y-4 text-center">
                          <h3 className="font-black text-neutral-800 text-base uppercase tracking-tight">Your Listing is Active! 🎉</h3>
                          <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
                            Bula Vinaka, <strong>{recipientName}</strong>, our Fijian logistics verification team approved and synced your listing on the public board platform instantly:
                          </p>

                          <div className="bg-neutral-50 p-4 border rounded-2xl max-w-[310px] mx-auto text-left space-y-2 select-none border-neutral-200 shadow-sm font-sans">
                            <span className="text-[9px] font-mono text-neutral-400 block font-bold uppercase tracking-wider">MODERATED REGISTRY ITEM</span>
                            <p className="font-black text-xs text-neutral-800 truncate leading-none">{listingTitle}</p>
                            
                            <div className="flex justify-between items-center pt-2.5 border-t border-neutral-200/60">
                              <div>
                                <span className="text-[8px] text-neutral-400 font-mono block font-bold uppercase">Price Index</span>
                                <span className="text-xs font-black text-neutral-800" style={{ color: primaryColor }}>{listingPrice}</span>
                              </div>
                              <div className="text-all-right">
                                <span className="text-[8px] text-neutral-400 font-mono block font-bold uppercase text-right">Location</span>
                                <span className="text-[11px] font-bold text-neutral-600 block text-right">{listingLocation}</span>
                              </div>
                            </div>
                          </div>

                          <div className="py-2 inline-block">
                            <span 
                              className="px-6 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition shadow-sm hover:opacity-90 block" 
                              style={{ backgroundColor: primaryColor }}
                            >
                              {listingCtaText}
                            </span>
                          </div>
                        </div>
                      )}

                      {selectedTemplate === 'invoice' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center border-b border-neutral-100 pb-3 select-none">
                            <div className="text-left font-sans">
                              <span className="text-[9px] text-neutral-400 font-mono block font-bold uppercase leading-none">Invoice Clearance</span>
                              <span className="text-xs font-black text-neutral-800 tracking-tight font-mono">ID: #{invoiceNumber}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] text-neutral-400 font-mono block font-bold uppercase leading-none">クリア日</span>
                              <span className="text-[10px] font-bold text-neutral-600 block font-mono">{new Date().toLocaleDateString()}</span>
                            </div>
                          </div>

                          <p className="text-xs text-neutral-600 font-bold mt-0">Hi {recipientName},</p>
                          <p className="text-[11.5px] text-neutral-500 leading-normal font-sans">
                            A digital bill statement confirmation and VAT clearance has been finalized as scheduled under your organizational record options:
                          </p>

                          <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-150 font-sans text-xs">
                            <table className="w-full text-neutral-700 font-semibold font-sans">
                              <tbody>
                                <tr className="border-b border-neutral-100 font-semibold">
                                  <td className="py-1 text-neutral-500">Service Plan Subscribed:</td>
                                  <td className="py-1 text-neutral-900 font-black text-right">{invoicePlan}</td>
                                </tr>
                                <tr className="border-b border-neutral-100 font-semibold">
                                  <td className="py-1 text-neutral-500 font-semibold">Subtotal (Net):</td>
                                  <td className="py-1 text-neutral-600 text-right">{invoiceSubtotal}</td>
                                </tr>
                                <tr className="border-b border-neutral-100 font-semibold">
                                  <td className="py-1 text-purple-600 font-bold uppercase text-[9.5px]">VAT Surcharge:</td>
                                  <td className="py-1 text-purple-600 font-extrabold text-right">{invoiceVat}</td>
                                </tr>
                                <tr>
                                  <td className="pt-2 text-neutral-900 font-extrabold text-sm">Amount Clear:</td>
                                  <td className="pt-2 text-right font-black text-sm" style={{ color: primaryColor }}>{invoiceTotal}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <p className="text-[10px] text-neutral-400 italic text-center w-full block m-0 pt-2 font-medium">
                            Premium receipts are compiled in offline digital sandbox configurations. Thank you.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Integrated dynamic styled Layout footer */}
                    <div className="p-6 bg-neutral-100 border-t border-neutral-200 text-center text-[10px] text-neutral-400 font-sans leading-relaxed select-none">
                      <p className="text-[9px] font-semibold text-neutral-400 m-0">© {new Date().getFullYear()} {companyName} Registry logistics.</p>
                      
                      {footerLinks.length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5">
                          {footerLinks.map((link, lIdx) => (
                            <React.Fragment key={lIdx}>
                              {lIdx > 0 && <span className="text-neutral-300"> | </span>}
                              <span className="font-extrabold" style={{ color: primaryColor }}>{link.label}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      {footerText && (
                        <p className="text-[8.5px] text-neutral-400 leading-normal max-w-[360px] mx-auto mt-2 italic font-medium font-sans border-t border-neutral-200/60 pt-2">
                          {footerText}
                        </p>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-950 rounded-2xl border border-neutral-800 p-4 font-mono text-[11px] text-neutral-300 space-y-2 relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-neutral-800 pb-2 mb-3 select-none">
                  <span className="text-neutral-400 font-black uppercase text-[10px] tracking-wider block font-mono">Raw Fluid Compilation HTML</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(computedHTML);
                      toast.success('Markup copied to system clipboard!');
                    }}
                    className="p-1 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-bold tracking-widest uppercase text-white rounded transition"
                  >
                    Copy HTML
                  </button>
                </div>
                <pre className="max-h-[36rem] overflow-auto select-all p-3 text-neutral-400 bg-neutral-950/80 rounded border border-neutral-900 leading-relaxed max-w-full block">
                  <code>{computedHTML}</code>
                </pre>
              </div>
            )}

            {/* Test Trigger Sender Widget Dashboard */}
            <div className="bg-neutral-950/40 p-5 mt-6 border border-neutral-800 rounded-3xl space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h4 className="font-black text-xs text-white uppercase tracking-tight block">Send Production-Fidelity Test Dispatch</h4>
              </div>

              <div className="grid sm:grid-cols-4 gap-3 items-end">
                <div className="sm:col-span-2 space-y-1">
                  <span className="text-[9px] font-black uppercase text-neutral-400 block tracking-widest font-mono">Recipient target Email Address</span>
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>

                <div className="sm:col-span-1 space-y-1">
                  <span className="text-[9px] font-black uppercase text-neutral-400 block tracking-widest font-mono">Template Selected</span>
                  <div className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-xl px-3 py-2 text-xs font-semibold capitalize truncate h-[38px] flex items-center select-none font-sans font-extrabold max-w-full">
                    {selectedTemplate.replace('_', ' ')}
                  </div>
                </div>

                <div className="sm:col-span-1">
                  <button
                    onClick={handleSendLiveTest}
                    disabled={isSendingTest}
                    className="w-full h-[38px] bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase rounded-xl tracking-wider transition-all shadow duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send size={12} />
                    <span>{isSendingTest ? 'Sending...' : 'Dispatch'}</span>
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 leading-normal font-sans">
                Sends a high- fidelity HTML transactional notification email incorporating current branding logos, brand primary colors codes, and customized footer disclaimers directly to your designated target mailbox using automated server routing.
              </p>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
