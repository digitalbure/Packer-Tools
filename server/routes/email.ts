import express from "express";
import axios from "axios";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { dbAdmin } from "../firebaseAdmin";
import { authenticateUser } from "../middleware/auth";

const router = express.Router();

export type EmailLocale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'fj';

const EMAIL_TRANSLATIONS: Record<EmailLocale, any> = {
  en: {
    verification: {
      subject: "Your Verification Security Code: {code}",
      greeting: "Hello, {name}",
      body: "Use the following secure, temporary verification token to verify your workspace identity:",
      expireNotice: "This security code expires in 15 minutes. If you did not request this, please disregard this email."
    },
    welcome: {
      subject: "Welcome to {companyName}!",
      greeting: "Welcome aboard, {name}! 👋",
      body: "Your account has been successfully initialized on our cloud logistics infrastructure. You now have full access to visual asset tracking, equipment management, and team collaboration.",
      cta: "Launch Workspace Portal"
    },
    checkout: {
      subject: "Gear Transfer Confirmation - {orderNumber}",
      title: "Equipment Handover Receipt",
      greeting: "Hello, {name}",
      body: "You have successfully processed an equipment logistical handover. Below are the items assigned to your profile record:",
      returnNotice: "Please return all listed gear on or before the designated return date."
    },
    overdue: {
      subject: "🚨 [URGENT] Overdue Gear Return Notice",
      title: "Overdue Equipment Notice",
      greeting: "Dear {name},",
      body: "The following equipment items assigned to you are currently overdue for return. Please return them to the inventory dock immediately or contact your administrator.",
      returnNotice: "Outstanding equipment flags audit compliance protocols. Immediate action required.",
      cta: "View Assigned Equipment"
    },
    lowStock: {
      subject: "⚠️ [ALERT] Low Stock Inventory Warning",
      title: "Low Inventory Stock Alert",
      body: "The following inventory items have dropped below their designated minimum threshold quantity:",
      cta: "Restock Inventory Items"
    },
    newsletter: {
      defaultSubject: "Monthly Gear & Operations Newsletter",
      unsubscribeText: "You received this newsletter because you are subscribed to updates. Click here to unsubscribe."
    },
    adminAlert: {
      subject: "Admin Alert: {title}",
      warning: "Automated administrative system notification. Action may be required at the admin console."
    }
  },
  es: {
    verification: {
      subject: "Su código de verificación de seguridad: {code}",
      greeting: "Hola, {name}",
      body: "Utilice el siguiente código de verificación temporal y seguro para validar su identidad:",
      expireNotice: "Este código expira en 15 minutos. Si no solicitó este código, ignore este correo."
    },
    welcome: {
      subject: "¡Bienvenido a {companyName}!",
      greeting: "¡Bienvenido a bordo, {name}! 👋",
      body: "Su cuenta ha sido inicializada con éxito en nuestra infraestructura logística en la nube.",
      cta: "Iniciar Portal de Trabajo"
    },
    checkout: {
      subject: "Confirmación de Entrega de Equipo - {orderNumber}",
      title: "Recibo de Entrega de Equipo",
      greeting: "Hola, {name}",
      body: "Ha procesado con éxito la entrega logística de equipos. A continuación se muestran los elementos asignados a su perfil:",
      returnNotice: "Por favor devuelva todos los equipos en o antes de la fecha de devolución designada."
    },
    overdue: {
      subject: "🚨 [URGENTE] Aviso de Equipo Vencido",
      title: "Aviso de Devolución Vencida",
      greeting: "Estimado/a {name},",
      body: "Los siguientes equipos asignados a su cuenta están actualmente vencidos. Por favor devuélvalos al muelle de inventario de inmediato.",
      returnNotice: "Los equipos no devueltos activan protocolos de auditoría de seguridad.",
      cta: "Ver Equipos Asignados"
    },
    lowStock: {
      subject: "⚠️ [ALERTA] Advertencia de Stock Bajo",
      title: "Alerta de Inventario Bajo",
      body: "Los siguientes artículos de inventario han caído por debajo del umbral mínimo designado:",
      cta: "Reabastecer Inventario"
    },
    newsletter: {
      defaultSubject: "Boletín Mensual de Equipos y Logística",
      unsubscribeText: "Recibió este boletín porque está suscrito a las actualizaciones. Haga clic aquí para cancelar la suscripción."
    },
    adminAlert: {
      subject: "Alerta de Administración: {title}",
      warning: "Notificación automatizada del sistema administrativo."
    }
  },
  fr: {
    verification: {
      subject: "Votre code de vérification de sécurité: {code}",
      greeting: "Bonjour, {name}",
      body: "Utilisez le jeton de vérification temporaire suivant pour valider votre identité d'espace de travail:",
      expireNotice: "Ce code expire dans 15 minutes. Si vous n'avez pas demandé ce code, ignorez cet e-mail."
    },
    welcome: {
      subject: "Bienvenue sur {companyName}!",
      greeting: "Bienvenue à bord, {name}! 👋",
      body: "Votre compte a été initialisé avec succès sur notre infrastructure logistique cloud.",
      cta: "Lancer le Portail"
    },
    checkout: {
      subject: "Confirmation de Remise d'Équipement - {orderNumber}",
      title: "Reçu de Remise d'Équipement",
      greeting: "Bonjour, {name}",
      body: "Vous avez effectué avec succès une remise logistique d'équipement. Voici la liste des matériels assignés à votre profil:",
      returnNotice: "Veuillez retourner tous les équipements listés au plus tard à la date de retour prévue."
    },
    overdue: {
      subject: "🚨 [URGENT] Avis d'Équipement en Retard",
      title: "Avis de Retard de Restitution",
      greeting: "Cher(e) {name},",
      body: "Les équipements suivants qui vous ont été attribués sont en retard de restitution. Veuillez les ramener immédiatement au dépôt.",
      returnNotice: "Les équipements non restitués déclenchent des audits de conformité.",
      cta: "Voir les Équipements Attribués"
    },
    lowStock: {
      subject: "⚠️ [ALERTE] Avertissement de Stock Bas",
      title: "Alerte de Stock Insuffisant",
      body: "Les articles d'inventaire suivants sont tombés en dessous du seuil minimal désigné:",
      cta: "Réapprovisionner le Stock"
    },
    newsletter: {
      defaultSubject: "Bulletin Mensuel Matériel & Logistique",
      unsubscribeText: "Vous recevez ce bulletin car vous êtes abonné aux mises à jour. Cliquez ici pour vous désabonner."
    },
    adminAlert: {
      subject: "Alerte Administrateur: {title}",
      warning: "Notification système automatisée. Une action peut être requise sur la console d'administration."
    }
  },
  de: {
    verification: {
      subject: "Ihr Sicherheits-Verifizierungscode: {code}",
      greeting: "Hallo, {name}",
      body: "Verwenden Sie den folgenden temporären Sicherheitscode, um Ihre Identität zu verifizieren:",
      expireNotice: "Dieser Sicherheitscode läuft in 15 Minuten ab."
    },
    welcome: {
      subject: "Willkommen bei {companyName}!",
      greeting: "Willkommen an Board, {name}! 👋",
      body: "Ihr Konto wurde erfolgreich in unserer Cloud-Logistikinfrastruktur eingerichtet.",
      cta: "Workspace Portal Öffnen"
    },
    checkout: {
      subject: "Ausrüstungs-Übergabebestätigung - {orderNumber}",
      title: "Ausrüstungs-Übergabeschein",
      greeting: "Hallo, {name}",
      body: "Sie haben eine Ausrüstungsübergabe erfolgreich durchgeführt. Folgende Artikel wurden Ihrem Profil zugewiesen:",
      returnNotice: "Bitte geben Sie alle aufgeführten Geräte spätestens am vorgesehenen Rückgabedatum zurück."
    },
    overdue: {
      subject: "🚨 [DRINGEND] Überfällige Rückgabe-Benachrichtigung",
      title: "Mahnung: Überfällige Ausrüstung",
      greeting: "Sehr geehrte(r) {name},",
      body: "Die folgenden Ihnen zugewiesenen Ausrüstungsgegenstände sind überfällig. Bitte bringen Sie diese umgehend zurück.",
      returnNotice: "Nicht zurückgegebene Geräte lösen eine Sicherheitsüberprüfung aus.",
      cta: "Zugewiesene Ausrüstung Anzeigen"
    },
    lowStock: {
      subject: "⚠️ [WARNUNG] Niedriger Lagerbestand",
      title: "Lagerbestand-Warnung",
      body: "Die folgenden Inventarartikel haben die festgelegte Mindestmenge unterschritten:",
      cta: "Inventar Nachbestellen"
    },
    newsletter: {
      defaultSubject: "Monatlicher Logistik- & Ausrüstungs-Newsletter",
      unsubscribeText: "Sie erhalten diesen Newsletter, weil Sie Abonnent sind. Hier klicken zum Abbestellen."
    },
    adminAlert: {
      subject: "Administrator-Warnung: {title}",
      warning: "Automatische Systembenachrichtigung."
    }
  },
  ja: {
    verification: {
      subject: "セキュリティ認証コード: {code}",
      greeting: "こんにちは、{name} 様",
      body: "ワークスペースの本人確認のために、以下のセキュリティ認証コードをご使用ください:",
      expireNotice: "この認証コードは15分後に有効期限が切れます。"
    },
    welcome: {
      subject: "{companyName}へようこそ！",
      greeting: "{name} 様、歓迎いたします！ 👋",
      body: "クラウド物流インフラ上にアカウントが正常に初期化されました。",
      cta: "ワークスペースを開く"
    },
    checkout: {
      subject: "機材貸出・受渡確認書 - {orderNumber}",
      title: "機材受渡受領書",
      greeting: "こんにちは、{name} 様",
      body: "機材の貸出手続きが正常に完了しました。お客様のプロフィールに割り当てられた機材一覧は以下の通りです:",
      returnNotice: "指定の返却日までに、すべての貸出機材をご返却ください。"
    },
    overdue: {
      subject: "🚨【至急】機材返却期限超過のお知らせ",
      title: "返却期限超過のご連絡",
      greeting: "{name} 様",
      body: "担当されている以下の機材の返却期限が過ぎております。速やかに機材ドックへご返却ください。",
      returnNotice: "未返却の機材は監査プロトコルの対象となります。",
      cta: "割り当て機材を確認"
    },
    lowStock: {
      subject: "⚠️【警告】在庫不足アラート",
      title: "在庫少額警告通知",
      body: "以下のインベントリ品目が設定された最小在庫数を下回りました:",
      cta: "在庫を補充する"
    },
    newsletter: {
      defaultSubject: "月刊 機材＆ロジスティクス ニュースレター",
      unsubscribeText: "このメールはニュースレター購読者にお送りしています。配信停止はこちら。"
    },
    adminAlert: {
      subject: "管理者アラート: {title}",
      warning: "自動システム通知です。"
    }
  },
  fj: {
    verification: {
      subject: "Noni taucoko ni taro vakadinadina: {code}",
      greeting: "Bula Vinaka, {name}",
      body: "Yagataka na naba ni taro vakadinadina oqo mo curu kina kina nomu valenivolavola ni Packer Tools:",
      expireNotice: "Na naba oqo e cava ena 15 na miniti."
    },
    welcome: {
      subject: "Bula Vinaka mai na {companyName}!",
      greeting: "Bula Vinaka kei na marau, {name}! 👋",
      body: "Sa ciqomi vakadodonu na nomu akaunti ena neitou yaya ni valenivolavola e Viti kei na vuravura.",
      cta: "Dolava na Valenivolavola"
    },
    checkout: {
      subject: "Vakadadinataki ni Iyaya soli - {orderNumber}",
      title: "Soli ni Iyaya volai",
      greeting: "Bula Vinaka, {name}",
      body: "Sa vakadonuya vakavinaka na kena saumi ka soli yani na iyaya oqo. Ni raica na veiyaya e tiko oqo:",
      returnNotice: "Kerekere vakasuka tale mai na veiyaya kece oqo ni bera na siga e lavaki."
    },
    overdue: {
      subject: "🚨 [VAKATOTOLO] Sivia na Siga ni Vakasuka Iyaya",
      title: "Tukutuku ni Vakasuka Iyaya",
      greeting: "Bula Vinaka {name},",
      body: "Na veiyaya oqo sa sivia na siga me vakasuki mai kina. Kerekere vakasuka vakatotolo mai kina vanua ni maroroi iyaya.",
      returnNotice: "Na veiyaya sega ni vakasuki e taro tiko ena vakatulewa ni timi.",
      cta: "Raica na Nomu Iyaya"
    },
    lowStock: {
      subject: "⚠️ [LEQA] Lailai na Iyaya ena Sitoa",
      title: "Tukutuku ni Lailai na Iyaya",
      body: "Na veiyaya oqo ena sitoa sa somidi tiko mai na naba e lavaki:",
      cta: "Vakaikuritaka na Sitoa"
    },
    newsletter: {
      defaultSubject: "Tukutuku ni Vula me baleta na Iyaya kei na Veiqaravi",
      unsubscribeText: "O ciqoma na meli oqo baleta ni o vakadonuya na tukutuku."
    },
    adminAlert: {
      subject: "Tukutuku mai na Admin: {title}",
      warning: "Tukutuku mai na kompyuta."
    }
  }
};

function getT(locale: string = 'en') {
  const loc = (locale in EMAIL_TRANSLATIONS) ? (locale as EmailLocale) : 'en';
  return EMAIL_TRANSLATIONS[loc];
}

async function dispatchEmailPayload(to: string | string[], subject: string, htmlContent: string, fromAddress: string, companyName: string) {
  let smtpConfig = null;
  try {
    const adminSettingsDoc = await dbAdmin.collection('adminSettings').doc('global').get();
    if (adminSettingsDoc.exists) {
      smtpConfig = adminSettingsDoc.data()?.smtp;
    }
  } catch (dbErr: any) {
    console.warn("Could not retrieve global SMTP settings from Firestore db:", dbErr.message);
  }

  // 1. SMTP Dispatch if configured
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
        tls: { rejectUnauthorized: false }
      });

      let senderEmail = smtpConfig.user;
      let customFromAddress = `"${companyName}" <${senderEmail}>`;

      const response = await transporter.sendMail({
        from: customFromAddress,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html: htmlContent
      });

      return {
        success: true,
        simulated: false,
        smtpMessageId: response.messageId,
        recipient: to,
        from: customFromAddress,
        gateway: 'SMTP'
      };
    } catch (smtpErr: any) {
      console.error("[SMTP Gateway] Transmission failed:", smtpErr.message);
    }
  }

  // 2. Resend API Dispatch if key provided
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "YOUR_RESEND_API_KEY") {
    console.info("Resend API key missing or default. Simulated email transaction:", subject);
    return {
      success: true,
      simulated: true,
      recipient: to,
      subject,
      html: htmlContent,
      fromAddress,
      notice: "Resend key is unconfigured. Transactional email simulated in sandbox mode!"
    };
  }

  try {
    const resendClient = new Resend(key);
    const emailRecipients = Array.isArray(to) ? to : [to];

    try {
      const response = await resendClient.emails.send({
        from: fromAddress,
        to: emailRecipients,
        subject,
        html: htmlContent
      });

      return {
        success: true,
        simulated: false,
        resendId: response.data?.id,
        recipient: to,
        from: fromAddress
      };
    } catch (sendErr: any) {
      const fallbackFrom = `Packer Tools <onboarding@resend.dev>`;
      const response = await resendClient.emails.send({
        from: fallbackFrom,
        to: emailRecipients,
        subject,
        html: htmlContent
      });

      return {
        success: true,
        simulated: false,
        resendId: response.data?.id,
        recipient: to,
        from: fallbackFrom,
        notice: "Routed via onboarding@resend.dev sandbox domain!"
      };
    }
  } catch (err: any) {
    return {
      success: true,
      simulated: true,
      error: err.message,
      html: htmlContent,
      notice: `Transactional dispatch fallback loaded: ${err.message}`
    };
  }
}

// -------------------------------------------------------------
// Core Multilingual Transactional Email Router
// -------------------------------------------------------------
router.post("/api/emails/send", authenticateUser, async (req, res) => {
  const { to, type, data, branding, fromType, locale = 'en' } = req.body;

  if (!to) {
    return res.status(400).json({ error: "Recipient is required" });
  }

  const t = getT(locale);
  const companyName = branding?.companyName || "Packer Tools";
  const logo = branding?.logo || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop";
  const primaryColor = branding?.primaryColor || "#FF5500";
  const contactEmail = branding?.contactEmail || "hi@packer.tools";

  let fromAddress = `"${companyName}" <no-reply@packer.tools>`;
  if (fromType === "hi") {
    fromAddress = `"${companyName}" <hi@packer.tools>`;
  } else if (fromType === "team") {
    fromAddress = `"${companyName}" <team@packer.tools>`;
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

  let subject = `[${companyName}] Operational Notice`;
  let htmlContent = "";

  if (type === 'verification') {
    const code = data?.code || '------';
    const userName = data?.userName || 'Operator';
    subject = `[${companyName}] ${t.verification.subject.replace('{code}', code)}`;

    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
          <div style="background-color: ${primaryColor}; padding: 30px; text-align: center; color: #ffffff;">
            <img src="${logo}" alt="${companyName} Logo" style="max-height: 48px; max-width: 140px; border-radius: 8px; margin-bottom: 12px; height: auto;" />
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Security Bureau</h2>
          </div>
          <div style="padding: 35px 24px; text-align: center;">
            <p style="font-size: 15px; color: #475569; margin: 0 0 24px 0;">${t.verification.greeting.replace('{name}', userName)}</p>
            <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0;">${t.verification.body}</p>
            <div style="font-family: monospace; font-size: 32px; font-weight: 900; color: ${primaryColor}; letter-spacing: 4px; background-color: #faf5f0; display: inline-block; padding: 16px 32px; border-radius: 16px; border: 1px solid #ffedd5; margin-bottom: 24px;">
              ${code}
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
  } else if (type === 'welcome') {
    const name = data?.displayName || 'Explorer';
    subject = t.welcome.subject.replace('{companyName}', companyName);

    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 28px; box-shadow: 0 15px 35px -10px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 40px 30px; text-align: center; color: #ffffff;">
            <img src="${logo}" alt="${companyName} Logo" style="max-height: 48px; max-width: 140px; border-radius: 8px; margin-bottom: 16px;" />
            <h1 style="margin: 0; font-size: 26px; font-weight: 900;">${t.welcome.greeting.replace('{name}', name)}</h1>
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
  } else if (type === 'checkout') {
    const orderNumber = data?.orderNumber || 'ORD-0000';
    const userName = data?.userName || 'Operator';
    const items = data?.items || [];
    subject = `[${companyName}] ${t.checkout.subject.replace('{orderNumber}', orderNumber)}`;

    const itemsHtml = items.map((it: any) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 8px; font-weight: bold; color: #0f172a;">${it.name || 'Equipment'}</td>
        <td style="padding: 10px 8px; font-family: monospace; color: #64748b;">${it.serial || it.assetTag || 'N/A'}</td>
        <td style="padding: 10px 8px; color: #64748b;">${it.category || 'Gear'}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #0f172a;">${it.qty || 1}</td>
      </tr>
    `).join('');

    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
          <div style="background-color: ${primaryColor}; padding: 28px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase;">${t.checkout.title}</h2>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 15px; color: #0f172a; font-weight: bold; margin: 0 0 12px 0;">${t.checkout.greeting.replace('{name}', userName)}</p>
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
              <tbody>${itemsHtml}</tbody>
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
  } else if (type === 'overdue') {
    const userName = data?.userName || 'Team Member';
    const items = data?.items || [];
    subject = `[${companyName}] ${t.overdue.subject}`;

    const rowsHtml = items.map((it: any) => `
      <tr style="border-bottom: 1px solid #fee2e2;">
        <td style="padding: 10px 8px; font-weight: bold; color: #991b1b;">${it.name || 'Equipment'}</td>
        <td style="padding: 10px 8px; font-family: monospace; color: #7f1d1d;">${it.serial || 'N/A'}</td>
        <td style="padding: 10px 8px; text-align: right; color: #dc2626; font-weight: bold;">${it.returnDate || 'Overdue'}</td>
      </tr>
    `).join('');

    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fef2f2; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px -5px rgba(220,38,38,0.1); border: 1px solid #fecaca; overflow: hidden;">
          <div style="background-color: #dc2626; padding: 28px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase;">${t.overdue.title}</h2>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 15px; color: #0f172a; font-weight: bold; margin: 0 0 12px 0;">${t.overdue.greeting.replace('{name}', userName)}</p>
            <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">${t.overdue.body}</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
              <thead>
                <tr style="border-bottom: 2px solid #fecaca; font-size: 11px; text-transform: uppercase; color: #991b1b;">
                  <th style="padding-bottom: 8px; text-align: left;">Overdue Item</th>
                  <th style="padding-bottom: 8px; text-align: left;">Serial ID</th>
                  <th style="padding-bottom: 8px; text-align: right;">Target Return</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
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
  } else if (type === 'low_stock') {
    const items = data?.items || [];
    subject = `[${companyName}] ${t.lowStock.subject}`;

    const rowsHtml = items.map((it: any) => `
      <tr style="border-bottom: 1px solid #fef3c7;">
        <td style="padding: 10px 8px; font-weight: bold; color: #92400e;">${it.name}</td>
        <td style="padding: 10px 8px; font-family: monospace; color: #78350f;">${it.sku || 'N/A'}</td>
        <td style="padding: 10px 8px; text-align: center; color: #b45309; font-weight: bold;">${it.quantity}</td>
        <td style="padding: 10px 8px; text-align: right; color: #92400e; font-weight: bold;">${it.threshold}</td>
      </tr>
    `).join('');

    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fffbeb; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px -5px rgba(217,119,6,0.1); border: 1px solid #fde68a; overflow: hidden;">
          <div style="background-color: #d97706; padding: 28px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase;">${t.lowStock.title}</h2>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">${t.lowStock.body}</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
              <thead>
                <tr style="border-bottom: 2px solid #fde68a; font-size: 11px; text-transform: uppercase; color: #92400e;">
                  <th style="padding-bottom: 8px; text-align: left;">Item</th>
                  <th style="padding-bottom: 8px; text-align: left;">SKU</th>
                  <th style="padding-bottom: 8px; text-align: center;">Current Qty</th>
                  <th style="padding-bottom: 8px; text-align: right;">Min Threshold</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
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
  } else if (type === 'admin_notification') {
    const title = data?.title || 'System Alert';
    subject = `[${companyName}] ${t.adminAlert.subject.replace('{title}', title)}`;
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
      <head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #0f172a;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 24px; color: #ffffff;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">🚨 ${companyName} Admin Console</h3>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">${title}</h2>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">${data?.message || ''}</p>
            ${detailsHtml ? `<div style="background-color: #fafbfc; border-radius: 12px; border: 1px solid #f1f5f9; padding: 16px; margin-bottom: 24px;"><table style="width: 100%; border-collapse: collapse;"><tbody>${detailsHtml}</tbody></table></div>` : ''}
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
    subject = data?.subject || `[${companyName}] Operational Notice`;
    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 28px; box-shadow: 0 15px 35px -10px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; overflow: hidden;">
          <div style="background-color: #1e293b; padding: 40px 30px; text-align: center; color: #ffffff;">
            <img src="${logo}" alt="${companyName} Logo" style="max-height: 50px; max-width: 140px; border-radius: 8px; margin-bottom: 16px; height: auto;" />
            <h1 style="margin: 0; font-size: 24px; font-weight: 950; text-transform: uppercase;">${data?.title || 'Operational Notice'}</h1>
          </div>
          <div style="padding: 40px 30px;">
            <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 28px 0;">${data?.message || ''}</p>
            ${data?.actionUrl ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${data.actionUrl}" style="background-color: ${primaryColor}; color: #ffffff; font-weight: bold; padding: 14px 28px; border-radius: 12px; text-decoration: none; display: inline-block; font-size: 14px; text-transform: uppercase;">
                  ${data?.actionText || 'Review Action'}
                </a>
              </div>
            ` : ''}
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
  }

  const result = await dispatchEmailPayload(to, subject, htmlContent, fromAddress, companyName);
  return res.json(result);
});

// -------------------------------------------------------------
// Newsletter Broadcast Campaign Endpoint
// -------------------------------------------------------------
router.post("/api/emails/newsletter/broadcast", authenticateUser, async (req, res) => {
  const { recipients, subject, title, bodyHtml, ctaText, ctaUrl, bannerUrl, locale = 'en', branding } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: "Recipients array is required for newsletter broadcast" });
  }

  const t = getT(locale);
  const companyName = branding?.companyName || "Packer Tools";
  const logo = branding?.logo || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop";
  const primaryColor = branding?.primaryColor || "#FF5500";
  const fromAddress = `"${companyName} Newsletter" <hi@packer.tools>`;
  const campaignSubject = subject || t.newsletter.defaultSubject;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>${campaignSubject}</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #0f172a;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 28px; box-shadow: 0 15px 35px -10px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 36px 30px; text-align: center; color: #ffffff;">
          <img src="${logo}" alt="${companyName}" style="max-height: 48px; max-width: 140px; border-radius: 8px; margin-bottom: 12px;" />
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${title || campaignSubject}</h1>
        </div>
        ${bannerUrl ? `<div style="width: 100%; overflow: hidden;"><img src="${bannerUrl}" alt="Newsletter Banner" style="width: 100%; max-height: 240px; object-fit: cover;" /></div>` : ''}
        <div style="padding: 36px 30px; font-size: 15px; color: #334155; line-height: 1.7;">
          ${bodyHtml || '<p>Welcome to our latest newsletter update!</p>'}
          ${ctaUrl ? `
            <div style="text-align: center; margin: 32px 0 16px 0;">
              <a href="${ctaUrl}" style="background-color: ${primaryColor}; color: #ffffff; font-weight: bold; padding: 14px 32px; border-radius: 12px; text-decoration: none; display: inline-block; font-size: 14px; text-transform: uppercase;">
                ${ctaText || 'Read More'}
              </a>
            </div>
          ` : ''}
        </div>
        <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          <p style="margin: 0;"><a href="https://packer.tools/unsubscribe" style="color: ${primaryColor}; text-decoration: underline;">${t.newsletter.unsubscribeText}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const results = [];
  for (const recipient of recipients) {
    const resPayload = await dispatchEmailPayload(recipient, campaignSubject, htmlContent, fromAddress, companyName);
    results.push(resPayload);
  }

  return res.json({
    success: true,
    recipientsCount: recipients.length,
    subject: campaignSubject,
    dispatches: results
  });
});

// -------------------------------------------------------------
// Automated Email Trigger Endpoint
// -------------------------------------------------------------
router.post("/api/emails/auto/trigger", authenticateUser, async (req, res) => {
  const { eventType, payload, locale = 'en', branding } = req.body;

  if (!eventType) {
    return res.status(400).json({ error: "eventType is required for automated email triggers" });
  }

  const companyName = branding?.companyName || "Packer Tools";

  if (eventType === 'overdue_checkouts') {
    const { to, userName, items } = payload || {};
    if (!to || !items) return res.status(400).json({ error: "Missing recipient or items for overdue_checkouts" });
    
    const sendRes = await dispatchEmailPayload(
      to,
      `[${companyName}] 🚨 Overdue Gear Return Notice`,
      `<h3>Overdue Gear Alert</h3><p>Dear ${userName || 'Operator'}, you have ${items.length} overdue item(s).</p>`,
      `"${companyName}" <no-reply@packer.tools>`,
      companyName
    );
    return res.json({ success: true, trigger: 'overdue_checkouts', result: sendRes });
  }

  if (eventType === 'low_stock_inventory') {
    const { to, items } = payload || {};
    if (!to || !items) return res.status(400).json({ error: "Missing recipient or items for low_stock_inventory" });

    const sendRes = await dispatchEmailPayload(
      to,
      `[${companyName}] ⚠️ Low Stock Inventory Alert`,
      `<h3>Low Stock Inventory Alert</h3><p>${items.length} item(s) are below threshold.</p>`,
      `"${companyName}" <no-reply@packer.tools>`,
      companyName
    );
    return res.json({ success: true, trigger: 'low_stock_inventory', result: sendRes });
  }

  return res.status(400).json({ error: `Unknown trigger eventType: ${eventType}` });
});

// Legacy Handover Receipt Route (Enhanced with locale support)
router.post("/api/send-email", authenticateUser, async (req, res) => {
  const { to, orderNumber, actionType, userName, items, timestamp, expectedReturnDate, locale = 'en' } = req.body;
  if (!to) return res.status(400).json({ error: "Recipient email is required" });

  const t = getT(locale);
  const actionLabel = actionType === 'checkout' ? 'Check-Out' : actionType === 'checkin' ? 'Check-In' : 'Reservation';
  const actionColor = actionType === 'checkout' ? '#2563eb' : actionType === 'checkin' ? '#10b981' : '#1e293b';
  const subject = `[Packer Tools] Kiosk ${actionLabel} - ${orderNumber}`;

  const itemsHtml = Array.isArray(items) 
    ? items.map(it => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 6px; font-weight: bold; color: #1f2937;">${it.name || 'Equipment'}</td>
        <td style="padding: 12px 6px; font-family: monospace; color: #4b5563;">${it.assetTag || it.serial || 'N/A'}</td>
        <td style="padding: 12px 6px; color: #6b7280;">${it.category || 'Gear'}</td>
        <td style="padding: 12px 6px; text-align: right; font-weight: bold; color: #111827;">${it.qty || 1}</td>
      </tr>
    `).join('')
    : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>${subject}</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 40px 10px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; overflow: hidden;">
        <div style="background-color: ${actionColor}; padding: 30px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase;">${t.checkout.title}</h2>
          <p style="margin: 8px 0 0 0; font-size: 11px; opacity: 0.85; font-weight: bold; text-transform: uppercase;">Packer Tools Digital Logistics</p>
        </div>
        <div style="padding: 40px 30px;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px dashed #e5e7eb; padding-bottom: 30px;">
            <p style="text-transform: uppercase; font-size: 11px; color: #9ca3af; font-weight: 800; letter-spacing: 2px; margin: 0 0 8px 0;">BARCODE REFERENCE</p>
            <div style="font-family: monospace; font-size: 28px; font-weight: 900; color: #111827; letter-spacing: 4px; background-color: #f9fafb; display: inline-block; padding: 12px 24px; border-radius: 12px; border: 1px solid #f3f4f6; margin-bottom: 12px;">
              ${orderNumber}
            </div>
            <p style="font-size: 12px; color: #6b7280; font-weight: 500; margin: 0;">Logged at: <strong>${timestamp || new Date().toLocaleString()}</strong></p>
          </div>
          <div style="background-color: #f9fafb; border-radius: 16px; border: 1px solid #f3f4f6; padding: 20px; margin-bottom: 30px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #9ca3af; font-weight: bold; text-transform: uppercase; padding: 6px 0;">Operator:</td>
                <td style="color: #111827; font-weight: 800; text-align: right; padding: 6px 0;">${userName}</td>
              </tr>
              <tr>
                <td style="color: #9ca3af; font-weight: bold; text-transform: uppercase; padding: 6px 0;">Email:</td>
                <td style="color: #111827; font-weight: 800; text-align: right; padding: 6px 0; font-family: monospace;">${to}</td>
              </tr>
              ${expectedReturnDate ? `
              <tr>
                <td style="color: #ef4444; font-weight: bold; text-transform: uppercase; padding: 6px 0;">Expected Return:</td>
                <td style="color: #ef4444; font-weight: 800; text-align: right; padding: 6px 0;">${expectedReturnDate}</td>
              </tr>
              ` : ""}
            </table>
          </div>
          <div style="margin-bottom: 40px;">
            <p style="font-size: 11px; font-weight: bold; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px 0;">📦 Equipment Manifest</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="border-bottom: 2px solid #e5e7eb; text-align: left; font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: bold;">
                  <th style="padding-bottom: 8px;">Asset / Name</th>
                  <th style="padding-bottom: 8px;">Tag</th>
                  <th style="padding-bottom: 8px;">Category</th>
                  <th style="padding-bottom: 8px; text-align: right;">Qty</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>
        </div>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">
          Packer Tools Logistics
        </div>
      </div>
    </body>
    </html>
  `;

  const result = await dispatchEmailPayload(to, subject, htmlContent, "kiosk-no-reply@packer.tools", "Packer Tools");
  return res.json(result);
});

// Legacy Welcome Email Route
router.post("/api/send-welcome-email", authenticateUser, async (req, res) => {
  const { to, displayName, subPlan = "Free Starter", locale = 'en' } = req.body;
  if (!to) return res.status(400).json({ error: "Recipient email is required" });

  const t = getT(locale);
  const subject = t.welcome.subject.replace('{companyName}', 'Packer Tools');
  const name = displayName || "Explorer";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>${subject}</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; padding: 40px 10px; margin: 0; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.06); border: 1px solid #f1f5f9; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 50px 40px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 900;">${t.welcome.greeting.replace('{name}', name)}</h1>
        </div>
        <div style="padding: 40px 30px;">
          <p style="font-size: 15px; color: #64748b; line-height: 1.7; margin: 0 0 24px 0;">${t.welcome.body}</p>
          <div style="background-color: #1e293b; color: #ffffff; border-radius: 20px; padding: 24px; text-align: center; margin-bottom: 35px;">
            <span style="font-size: 18px; font-weight: 800; display: block; margin-bottom: 12px;">Plan: ${subPlan}</span>
            <a href="https://packer.tools" style="background-color: #f27d26; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 12px; text-transform: uppercase; padding: 12px 24px; display: inline-block; border-radius: 10px;">
              ${t.welcome.cta}
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const result = await dispatchEmailPayload(to, subject, htmlContent, "onboarding-welcome@packer.tools", "Packer Tools");
  return res.json(result);
});

// Legacy Contact Email Route
router.post("/api/send-contact-email", authenticateUser, async (req, res) => {
  const { firstName, lastName, email, message, timestamp } = req.body;
  if (!email || !message) return res.status(400).json({ error: "Email and message are required" });

  const name = `${firstName || "Anonymous"} ${lastName || ""}`.trim();
  const subject = `[Packer Tools Contact Feed] Message from ${name}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Contact Inquiry</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #334155;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 30px 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">📬 Contact Inquiry</h2>
        </div>
        <div style="padding: 35px 24px;">
          <p style="font-size: 14px; color: #0f172a; font-weight: bold; margin: 0 0 12px 0;">From: ${name} (${email})</p>
          <div style="background-color: #fafbfc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 18px; font-size: 14px; line-height: 1.7;">
            "${message}"
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const result = await dispatchEmailPayload(email, subject, htmlContent, "contact-form@packer.tools", "Packer Tools");
  return res.json(result);
});

export default router;
