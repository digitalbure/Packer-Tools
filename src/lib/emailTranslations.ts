export type EmailLocale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'fj';

export interface EmailTranslationDictionary {
  verification: {
    subject: string;
    greeting: string;
    body: string;
    expireNotice: string;
  };
  welcome: {
    subject: string;
    greeting: string;
    body: string;
    highlightsTitle: string;
    cta: string;
  };
  checkout: {
    subject: string;
    title: string;
    greeting: string;
    body: string;
    returnNotice: string;
  };
  overdue: {
    subject: string;
    title: string;
    greeting: string;
    body: string;
    returnNotice: string;
    cta: string;
  };
  lowStock: {
    subject: string;
    title: string;
    body: string;
    cta: string;
  };
  newsletter: {
    defaultSubject: string;
    unsubscribeText: string;
  };
  adminAlert: {
    subject: string;
    warning: string;
  };
}

export const EMAIL_TRANSLATIONS: Record<EmailLocale, EmailTranslationDictionary> = {
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
      highlightsTitle: "Getting Started Features",
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
      body: "Su cuenta ha sido inicializada con éxito en nuestra infraestructura logística en la nube. Ahora tiene acceso completo al seguimiento visual de activos y gestión de equipos.",
      highlightsTitle: "Características Principales",
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
      warning: "Notificación automatizada del sistema administrativo. Es posible que se requiera una acción en la consola."
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
      body: "Votre compte a été initialisé avec succès sur notre infrastructure logistique cloud. Vous avez désormais un accès complet au suivi des équipements.",
      highlightsTitle: "Fonctionnalités de Démarrage",
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
      expireNotice: "Dieser Sicherheitscode läuft in 15 Minuten ab. Falls Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail."
    },
    welcome: {
      subject: "Willkommen bei {companyName}!",
      greeting: "Willkommen an Board, {name}! 👋",
      body: "Ihr Konto wurde erfolgreich in unserer Cloud-Logistikinfrastruktur eingerichtet. Sie haben jetzt vollen Zugriff auf die digitale Ausrüstungsverfolgung.",
      highlightsTitle: "Erste Schritte",
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
      warning: "Automatische Systembenachrichtigung. Möglicherweise ist ein Eingreifen in der Konsole erforderlich."
    }
  },
  ja: {
    verification: {
      subject: "セキュリティ認証コード: {code}",
      greeting: "こんにちは、{name} 様",
      body: "ワークスペースの本人確認のために、以下のセキュリティ認証コードをご使用ください:",
      expireNotice: "この認証コードは15分後に有効期限が切れます。身に覚えがない場合はこのメールを破棄してください。"
    },
    welcome: {
      subject: "{companyName}へようこそ！",
      greeting: "{name} 様、歓迎いたします！ 👋",
      body: "クラウド物流インフラ上にアカウントが正常に初期化されました。機材管理やリアルタイム資産追跡をすぐにご利用いただけます。",
      highlightsTitle: "主な機能と使い方",
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
      warning: "自動システム通知です。管理コンソールでの対応が必要な場合があります。"
    }
  },
  fj: {
    verification: {
      subject: "Noni taucoko ni taro vakadinadina: {code}",
      greeting: "Bula Vinaka, {name}",
      body: "Yagataka na naba ni taro vakadinadina oqo mo curu kina kina nomu valenivolavola ni Packer Tools:",
      expireNotice: "Na naba oqo e cava ena 15 na miniti. Ke sega ni o kerea, hikitaka mada na meli oqo."
    },
    welcome: {
      subject: "Bula Vinaka mai na {companyName}!",
      greeting: "Bula Vinaka kei na marau, {name}! 👋",
      body: "Sa ciqomi vakadodonu na nomu akaunti ena neitou yaya ni valenivolavola e Viti kei na vuravura. Sa rawa mo qarava kece na iyaya kei na nomu timi.",
      highlightsTitle: "Veika e Tekivutaki",
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
      unsubscribeText: "O ciqoma na meli oqo baleta ni o vakadonuya na tukutuku. Tabaka eke mo kauta tani na yaca mu."
    },
    adminAlert: {
      subject: "Tukutuku mai na Admin: {title}",
      warning: "Tukutuku mai na kompyuta. De rairai gadrevi mo raica ena valenivolavola levu."
    }
  }
};

export function getEmailTranslation(locale: EmailLocale = 'en'): EmailTranslationDictionary {
  return EMAIL_TRANSLATIONS[locale] || EMAIL_TRANSLATIONS.en;
}
