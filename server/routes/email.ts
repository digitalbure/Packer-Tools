import express from "express";
import axios from "axios";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { dbAdmin } from "../firebaseAdmin";
import { authenticateUser } from "../middleware/auth";

const router = express.Router();

router.post("/api/emails/send", authenticateUser, async (req, res) => {
  const { to, type, data, branding, fromType } = req.body;

  if (!to) {
    return res.status(400).json({ error: "Recipient is required" });
  }

  const companyName = branding?.companyName || "Packer Tools";
  const logo = branding?.logo || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop";
  const primaryColor = branding?.primaryColor || "#FF5500";
  const contactEmail = branding?.contactEmail || "hi@packer.tools";

  let fromAddress = "Packer Tools <no-reply@packer.tools>";
  if (fromType === "hi") {
    fromAddress = `Packer Tools <hi@packer.tools>`;
  } else if (fromType === "team") {
    fromAddress = `Packer Tools <team@packer.tools>`;
  }

  const footerLinksArr = branding?.footerLinks || [];
  const footerLinksHtml = footerLinksArr.length > 0
    ? `<div style="margin-top: 14px; margin-bottom: 12px; font-weight: 600;">
        ${footerLinksArr.map((link: any) => `<a href="${link.href}" style="color: ${primaryColor}; text-decoration: none; margin: 0 8px; font-size: 11px;">${link.label}</a>`).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}
       </div>`
    : '';
  const footerCustomTextHtml = branding?.footerText
    ? `<p style="margin: 8px 0 0 0; line-height: 1.5; font-size: 11.5px; color: #94a3b8;">${branding.footerText}</p>`
    : '';

  let subject = `[${companyName}] Notification`;
  let htmlContent = "";

  if (type === 'verification') {
    subject = `[${companyName}] Your Verification Security Code: ${data?.code || ''}`;
    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
          <div style="background-color: ${primaryColor}; padding: 30px; text-align: center; color: #ffffff;">
            <img src="${logo}" alt="${companyName} Logo" style="max-height: 48px; max-width: 140px; border-radius: 8px; margin-bottom: 12px; height: auto;" />
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Verification Bureau</h2>
          </div>
          <div style="padding: 35px 24px; text-align: center;">
            <p style="font-size: 15px; color: #475569; margin: 0 0 24px 0;">Bula Vinaka, <strong>${data?.userName || 'Operator'}</strong>,</p>
            <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0;">
              Use the following secure, temporary access validation token block to verify your workspace identity for ${companyName}:
            </p>
            <div style="font-family: monospace; font-size: 32px; font-weight: 900; color: ${primaryColor}; letter-spacing: 4px; background-color: #faf5f0; display: inline-block; padding: 16px 32px; border-radius: 16px; border: 1px solid #ffedd5; margin-bottom: 24px;">
              ${data?.code || '------'}
            </div>
            <p style="font-size: 11px; color: #94a3b8; line-height: 1.6; margin: 0;">
              This code will expire shortly. If you did not request this login credentials set, disregard this email.
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
            © ${new Date().getFullYear()} ${companyName}. Supported in registry domain proxying.
            ${footerLinksHtml}
            ${footerCustomTextHtml}
          </div>
        </div>
      </body>
      </html>
    `;
  } else if (type === 'admin_notification') {
    subject = `[${companyName}] Admin Alert: ${data?.title || 'System Notification'}`;
    const detailsHtml = data?.details 
      ? Object.entries(data.details).map(([k, v]) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 6px; font-weight: bold; color: #475569; width: 35%; font-size: 12px; text-transform: uppercase;">${k}:</td>
          <td style="padding: 10px 6px; color: #0f172a; font-family: monospace; font-size: 13px;">${v}</td>
        </tr>
      `).join('')
      : '';

    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #0f172a;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 24px; color: #ffffff; display: flex; align-items: center; justify-content: space-between;">
            <div style="font-weight: 900; font-size: 14px; letter-spacing: -0.5px; text-transform: uppercase;">
              🚨 ${companyName} Admin Console
            </div>
            <img src="${logo}" alt="${companyName} Logo" style="max-height: 28px; max-width: 100px; border-radius: 4px;" />
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">
              ${data?.title || 'System Event Alert'}
            </h2>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
              An administrative event or notification was raised by the workspace platform operations:
            </p>
            ${detailsHtml ? `
              <div style="background-color: #fafbfc; border-radius: 12px; border: 1px solid #f1f5f9; padding: 16px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tbody>
                    ${detailsHtml}
                   </tbody>
                </table>
              </div>
            ` : ''}
            <p style="font-size: 11px; color: #475569; line-height: 1.6; background-color: #fef08a; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0; font-weight: 500;">
              ⚠️ This is an webmaster automated notification email dispatch. Action may be required at the main panel of your secure Packer Tools deployment.
            </p>
          </div>
          <div style="background-color: #0f172a; padding: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            © ${new Date().getFullYear()} ${companyName} • Admin Notifications Router
            ${footerLinksHtml}
            ${footerCustomTextHtml}
          </div>
        </div>
      </body>
      </html>
    `;
  } else {
    subject = data?.subject || `[${companyName}] Operational Notice`;
    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 28px; box-shadow: 0 15px 35px -10px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
          <div style="background-color: #1e293b; padding: 40px 30px; text-align: center; color: #ffffff;">
            <img src="${logo}" alt="${companyName} Logo" style="max-height: 50px; max-width: 140px; border-radius: 8px; margin-bottom: 16px; height: auto;" />
            <h1 style="margin: 0; font-size: 24px; font-weight: 950; letter-spacing: -0.5px; text-transform: uppercase;">${data?.title || 'Operational Notice'}</h1>
          </div>
          <div style="padding: 40px 30px;">
            <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 28px 0;">
              ${data?.message || ''}
            </p>
            ${data?.actionUrl ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${data.actionUrl}" style="background-color: ${primaryColor}; color: #ffffff; font-weight: bold; padding: 14px 28px; border-radius: 12px; text-decoration: none; display: inline-block; font-size: 14px; text-transform: uppercase; tracking-wider shadow-md">
                  ${data?.actionText || 'Review Action'}
                </a>
              </div>
            ` : ''}
          </div>
          <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
            For dynamic assistance, drop a line to <a href="mailto:${contactEmail}" style="color: ${primaryColor}; text-decoration: none; font-weight: bold;">${contactEmail}</a>.<br />
            © ${new Date().getFullYear()} ${companyName} Team logistics.
            ${footerLinksHtml}
            ${footerCustomTextHtml}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  let smtpConfig = null;
  try {
    const adminSettingsDoc = await dbAdmin.collection('adminSettings').doc('global').get();
    if (adminSettingsDoc.exists) {
      smtpConfig = adminSettingsDoc.data()?.smtp;
    }
  } catch (dbErr: any) {
    console.warn("Could not retrieve global SMTP settings from Firestore db:", dbErr.message);
  }

  if (smtpConfig && smtpConfig.enabled && smtpConfig.host) {
    try {
      console.info(`[SMTP Gateway] Transmitting email to ${to} via SMTP Server: ${smtpConfig.host}:${smtpConfig.port}`);
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: Number(smtpConfig.port) || 587,
        secure: Number(smtpConfig.port) === 465,
        auth: {
          user: smtpConfig.user || '',
          pass: smtpConfig.pass || ''
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      let senderEmail = smtpConfig.user;
      let displayName = companyName;
      let customFromAddress = `"${displayName}" <${senderEmail}>`;

      const response = await transporter.sendMail({
        from: customFromAddress,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html: htmlContent
      });

      console.info("[SMTP Gateway] Email dispatched successfully:", response.messageId);
      return res.json({
        success: true,
        simulated: false,
        smtpMessageId: response.messageId,
        recipient: to,
        from: customFromAddress,
        gateway: 'SMTP'
      });
    } catch (smtpErr: any) {
      console.error("[SMTP Gateway] Transmission failed, returning SMTP error:", smtpErr.message);
      return res.status(500).json({ 
        error: `SMTP server dispatch failed: ${smtpErr.message || smtpErr}` 
      });
    }
  }

  const key = process.env.RESEND_API_KEY;
  if (!key || key === "YOUR_RESEND_API_KEY") {
    console.info("Resend API key missing or default. Simulated email transaction:", subject);
    return res.json({
      success: true,
      simulated: true,
      recipient: to,
      subject,
      html: htmlContent,
      fromAddress,
      notice: "Resend key is unconfigured. Transactional email successfully simulated in sandbox mode!"
    });
  }

  try {
    const resendClient = new Resend(key);
    const emailRecipients = Array.isArray(to) ? to : [to];

    let senderEmail = fromAddress;
    try {
      const response = await resendClient.emails.send({
        from: senderEmail,
        to: emailRecipients,
        subject,
        html: htmlContent
      });

      return res.json({
        success: true,
        simulated: false,
        resendId: response.data?.id,
        recipient: to,
        from: senderEmail
      });
    } catch (sendErr: any) {
      console.warn("Retrying with onboarding@resend.dev due to custom domain constraints:", sendErr.message);
      senderEmail = `Packer Tools <onboarding@resend.dev>`;
      const response = await resendClient.emails.send({
        from: senderEmail,
        to: emailRecipients,
        subject,
        html: htmlContent
      });

      return res.json({
        success: true,
        simulated: false,
        resendId: response.data?.id,
        recipient: to,
        from: senderEmail,
        notice: "Custom domain validation pending. Branded sandbox routing routed via onboarding@resend.dev!"
      });
    }
  } catch (err: any) {
    console.error("Critical Resend SDK execution failure, falling back to Simulation state:", err.message);
    return res.json({
      success: true,
      simulated: true,
      error: err.message,
      html: htmlContent,
      notice: `Transactional dispatch fallback loaded correctly. Error context: ${err.message}`
    });
  }
});

router.post("/api/send-email", authenticateUser, async (req, res) => {
  const { to, orderNumber, actionType, userName, items, timestamp } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: "Recipient email is required" });
  }

  const actionLabel = actionType === 'checkout' ? 'Check-Out' : actionType === 'checkin' ? 'Check-In' : 'Order Reservation';
  const actionColor = actionType === 'checkout' ? '#2563eb' : actionType === 'checkin' ? '#10b981' : '#1e293b';
  const subject = `[Packer Tools] Kiosk ${actionLabel} - ${orderNumber}`;

  const itemsHtml = Array.isArray(items) 
    ? items.map(it => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 6px; font-weight: bold; color: #1f2937;">${it.name || 'Equipment'}</td>
        <td style="padding: 12px 6px; font-family: monospace; color: #4b5563;">${it.assetTag || 'N/A'}</td>
        <td style="padding: 12px 6px; color: #6b7280;">${it.category || 'Gear'}</td>
        <td style="padding: 12px 6px; text-align: right; font-weight: bold; color: #111827;">${it.qty || 1}</td>
      </tr>
    `).join('')
    : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 40px 10px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="background-color: ${actionColor}; padding: 30px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px;">${actionLabel} Handover Slip</h2>
          <p style="margin: 8px 0 0 0; font-size: 11px; opacity: 0.85; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">Digital Bure 🇫🇯 Fiji Powering Packer Tools</p>
        </div>
        <div style="padding: 40px 30px;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px dashed #e5e7eb; padding-bottom: 30px;">
            <p style="text-transform: uppercase; font-size: 11px; color: #9ca3af; font-weight: 800; letter-spacing: 2px; margin: 0 0 8px 0;">INVENTORY TRANSFER BARCODE</p>
            <div style="font-family: monospace; font-size: 28px; font-weight: 900; color: #111827; letter-spacing: 4px; background-color: #f9fafb; display: inline-block; padding: 12px 24px; border-radius: 12px; border: 1px solid #f3f4f6; margin-bottom: 12px;">
              ${orderNumber}
            </div>
            <p style="font-size: 12px; color: #6b7280; font-weight: 500; margin: 0;">Logged at terminal at: <strong>${timestamp || new Date().toLocaleString()}</strong></p>
          </div>
          <div style="background-color: #f9fafb; border-radius: 16px; border: 1px solid #f3f4f6; padding: 20px; margin-bottom: 30px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #9ca3af; font-weight: bold; text-transform: uppercase; padding: 6px 0;">Operator:</td>
                <td style="color: #111827; font-weight: 800; text-align: right; padding: 6px 0;">${userName}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-weight: bold; text-transform: uppercase; padding: 6px 0;">Destination Email:</td>
                <td style="color: #111827; font-weight: 800; text-align: right; padding: 6px 0; font-family: monospace;">${to}</td>
              </tr>
            </table>
          </div>
          <div style="margin-bottom: 40px;">
            <p style="font-size: 11px; font-weight: bold; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px 0;">📦 Handed Over Equipment Checklist</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="border-bottom: 2px solid #e5e7eb; text-align: left; font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: bold;">
                  <th style="padding-bottom: 8px;">Asset / Name</th>
                  <th style="padding-bottom: 8px;">Asset Tag</th>
                  <th style="padding-bottom: 8px;">Category</th>
                  <th style="padding-bottom: 8px; text-align: right;">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          <div style="border-top: 1px solid #e5e7eb; pt-6; padding-top: 24px; text-align: center;">
            <p style="font-size: 12px; color: #6b7280; font-weight: 600; margin: 0 0 4px 0;">Fiji Headquarters Logistics Fulfillment Notice</p>
            <p style="font-size: 10px; color: #9ca3af; line-height: 1.6; margin: 0;">
              Bring this handover receipt slip to the inventory dock to proceed with physical checkouts or logging storage configurations. For support, reach out to the project administrator or email support.
            </p>
          </div>
        </div>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">
          Packer Tools by <a href="https://digitalbure.com" style="color: ${actionColor}; font-weight: bold; text-decoration: none;">Digital Bure 🇫🇯</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const key = process.env.RESEND_API_KEY;
  if (!key || key === "YOUR_RESEND_API_KEY") {
    console.info("Resend API key is missing. Simulation sandbox compiled successfully.");
    return res.json({
      success: true,
      simulated: true,
      recipient: to,
      subject,
      html: htmlContent,
      notice: "Resend API key is not fully configured. Transactional email simulated cleanly in sandbox!"
    });
  }

  try {
    const response = await axios.post("https://api.resend.com/emails", {
      from: "kiosk-no-reply@resend.dev",
      to: [to],
      subject,
      html: htmlContent
    }, {
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      }
    });

    return res.json({
      success: true,
      simulated: false,
      resendId: response.data.id,
      recipient: to
    });
  } catch (err: any) {
    console.warn("Failed executing Resend API route (using simulated backup instead):", err.response?.data || err.message);
    return res.json({
      success: true,
      simulated: true,
      error: err.response?.data?.message || err.message,
      html: htmlContent,
      notice: "Real email dispatch failed. Fallback sandbox payload loaded successfully!"
    });
  }
});

router.post("/api/send-welcome-email", authenticateUser, async (req, res) => {
  const { to, displayName, subPlan = "Free Starter" } = req.body;

  if (!to) {
    return res.status(400).json({ error: "Recipient email is required" });
  }

  const subject = `Welcome to Packer Tools! [v1.0.0-beta.1 Onboarding]`;
  const name = displayName || "Beta Explorer";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Packer Tools</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.06); border: 1px solid #f1f5f9; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 50px 40px; text-align: center; color: #ffffff; position: relative;">
          <div style="background-color: #f27d26; width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-bottom: 20px;"></div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 900; line-height: 1.2;">Unleash Visual Inventory.</h1>
          <p style="margin: 12px 0 0 0; font-size: 14px; opacity: 0.8; font-weight: 500; text-transform: uppercase; letter-spacing: 2px;">Welcome to Packer Tools v1.0.0-beta.1</p>
        </div>
        <div style="padding: 40px 30px;">
          <div style="margin-bottom: 35px; border-bottom: 1px solid #f1f5f9; padding-bottom: 30px;">
            <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">Bula Vinaka, ${name}! 👋</h2>
            <p style="font-size: 15px; color: #64748b; line-height: 1.7; margin: 0;">
              Your account has been successfully initialized on our cloud logistics infrastructure. Packer Tools provides the software layer for precision visual gear tagging, list validation, and real-time operations stress matrices.
            </p>
          </div>
          <p style="font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px 0;">🚀 ACTIVE BETA HIGHLIGHTS</p>
          <div style="margin-bottom: 30px; display: block;">
            <div style="background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 16px; font-size: 14px;">
              <strong style="color: #0f172a; font-weight: 800; display: block; margin-bottom: 4px;">🏷️ Multi-Size QR Sticker Templates</strong>
              <span style="color: #64748b; line-height: 1.6;">Print customized labels directly tuned for <strong>Dymo 30334 (2.25" x 1.25")</strong>, <strong>Brother TZe Ribbon/Tape</strong>, and <strong>Standard Avery A4</strong> sheets with dynamic responsive dimensions!</span>
            </div>
            <div style="background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 16px; font-size: 14px;">
              <strong style="color: #0f172a; font-weight: 800; display: block; margin-bottom: 4px;">⚡ GCP Managed Stress Tester</strong>
              <span style="color: #64748b; line-height: 1.6;">Track Cloud Run workloads, Firestore operations cost spikes, and active Gemini API usage models directly within your telemetry dashboard.</span>
            </div>
            <div style="background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; font-size: 14px;">
              <strong style="color: #0f172a; font-weight: 800; display: block; margin-bottom: 4px;">🤝 Real-Time Collaboration Hub</strong>
              <span style="color: #64748b; line-height: 1.6;">Synchronize physical rack mapping, storage box structures, and shipping registries with multiple logistics handlers simultaneously.</span>
            </div>
          </div>
          <div style="background-color: #1e293b; color: #ffffff; border-radius: 20px; padding: 24px; text-align: center; margin-bottom: 35px;">
            <span style="text-transform: uppercase; font-size: 9px; font-weight: 900; letter-spacing: 2px; color: #f27d26; display: block; margin-bottom: 6px;">Active Onboarding License</span>
            <span style="font-size: 18px; font-weight: 800; display: block; margin-bottom: 12px;">Plan Level: ${subPlan}</span>
            <a href="https://digitalbure.com" style="background-color: #f27d26; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; padding: 12px 24px; display: inline-block; border-radius: 10px;">Launch Workspace Portal</a>
          </div>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.7;">
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #64748b;">Powered by Digital Bure 🇫🇯</p>
            <p style="margin: 0;">You have received this letter because your email signed up for the active beta trials of Packer Tools.</p>
          </div>
        </div>
        <div style="background-color: #f8fafc; text-align: center; padding: 20px; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
          Packer Tools Beta Suite • Built in Fiji for Global Workloads
        </div>
      </div>
    </body>
    </html>
  `;

  const key = process.env.RESEND_API_KEY;
  if (!key || key === "YOUR_RESEND_API_KEY") {
    console.info("Resend API key missing. Welcome email simulation generated successfully.");
    return res.json({
      success: true,
      simulated: true,
      recipient: to,
      subject,
      html: htmlContent,
      notice: "No live Resend API key detected. Generated local simulation view payload!"
    });
  }

  try {
    const response = await axios.post("https://api.resend.com/emails", {
      from: "onboarding-welcome@resend.dev",
      to: [to],
      subject,
      html: htmlContent
    }, {
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      }
    });

    return res.json({
      success: true,
      simulated: false,
      resendId: response.data.id,
      recipient: to
    });
  } catch (err: any) {
    console.warn("Resend delivery failed. Falling back to welcome message sandbox:", err.message);
    return res.json({
      success: true,
      simulated: true,
      error: err.response?.data?.message || err.message,
      html: htmlContent,
      notice: "Real mail dispatch failed. Sandbox mockup returned."
    });
  }
});

router.post("/api/send-contact-email", authenticateUser, async (req, res) => {
  const { firstName, lastName, email, message, timestamp } = req.body;

  if (!email || !message) {
    return res.status(400).json({ error: "Email and message are strictly required values." });
  }

  const name = `${firstName || "Anonymous"} ${lastName || ""}`.trim();
  const subject = `[Packer Tools Contact Feed] Message from ${name}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Contact Enquiry Submission</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #334155;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 12px 30px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 30px 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">📬 Incoming Contact Feed Enquiry</h2>
          <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.7; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Beta Help desk Alert</p>
        </div>
        <div style="padding: 35px 24px;">
          <div style="margin-bottom: 25px; background-color: #f1f5f9; border-radius: 16px; padding: 20px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="color: #64748b; font-weight: bold; width: 35%; padding-bottom: 8px;">Sender Name:</td>
                <td style="color: #0f172a; font-weight: 800; padding-bottom: 8px;">${name}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: bold; width: 35%; padding-bottom: 8px;">Email Address:</td>
                <td style="color: #0f172a; font-weight: 800; font-family: monospace; padding-bottom: 8px;">${email}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: bold; width: 35%;">Submitted Time:</td>
                <td style="color: #0f172a; font-weight: 750;">${timestamp || new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 11px; font-weight: 950; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 8px 0;">📨 INQUIRY SPEECH BODY</p>
          <div style="background-color: #fafbfc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 18px; font-size: 14px; line-height: 1.7; color: #1e293b; font-style: italic; white-space: pre-wrap; margin-bottom: 30px;">
            "${message}"
          </div>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8;">
            <p style="margin: 0;">This contact feedback form email was dispatched proxying from Packer Tools platform.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const key = process.env.RESEND_API_KEY;
  if (!key || key === "YOUR_RESEND_API_KEY") {
    console.info("Resend API key missing. Contact email simulated successfully.");
    return res.json({
      success: true,
      simulated: true,
      recipient: email,
      subject,
      html: htmlContent,
      notice: "No live Resend API key configured. Simulation visual load dispatched successfully."
    });
  }

  try {
    const response = await axios.post("https://api.resend.com/emails", {
      from: "contact-form@resend.dev",
      to: [email],
      subject,
      html: htmlContent
    }, {
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      }
    });

    return res.json({
      success: true,
      simulated: false,
      resendId: response.data.id,
      recipient: email
    });
  } catch (err: any) {
    console.warn("Resend delivery for contact failed. Emulating callback drawer:", err.message);
    return res.json({
      success: true,
      simulated: true,
      error: err.response?.data?.message || err.message,
      html: htmlContent,
      notice: "Real email dispatch failed. Loaded sandbox simulation fallback."
    });
  }
});

export default router;
