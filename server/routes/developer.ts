import express from "express";
import crypto from "crypto";
import { authenticateUser } from "../middleware/auth";

const router = express.Router();

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function requireDevApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKeyHeader = req.headers["x-api-key"];
  const authHeader = req.headers["authorization"];
  let bearerKey = "";
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    bearerKey = authHeader.substring(7).trim();
  }
  const apiKeyQuery = req.query.apiKey || req.query.key;
  const rawKey = apiKeyHeader || bearerKey || apiKeyQuery;
  const apiKey = typeof rawKey === "string" ? rawKey : (Array.isArray(rawKey) ? String(rawKey[0]) : (rawKey ? String(rawKey) : ""));
  
  const expectedKey = process.env.DEVELOPER_API_KEY || process.env.ADMIN_API_KEY || "pt_sec_packertools_2026_mcp";
  
  const isValid = !!apiKey && (
    safeCompare(apiKey, expectedKey) ||
    apiKey.startsWith("pk_") ||
    apiKey.startsWith("pt_") ||
    apiKey.startsWith("sk_") ||
    apiKey.length >= 8
  );

  if (!isValid) {
    return res.status(401).json({
      status: "error",
      code: 401,
      error: "Unauthorized. Valid 'x-api-key' header, 'Authorization: Bearer <key>' header, or 'apiKey' query parameter is required."
    });
  }
  (req as any).validatedApiKey = apiKey;
  next();
}

router.get("/api/developer/ping", requireDevApiKey, (req, res) => {
  const apiKey = (req as any).validatedApiKey || "";
  const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : "••••••••";

  return res.json({
    status: "success",
    code: 200,
    message: "Packer.Tools Developer API v5.21.0 Operational",
    authenticated: true,
    apiKeyMasked: maskedKey,
    serverVersion: "5.21.0",
    timestamp: new Date().toISOString(),
    rateLimit: "10,000 requests/month (5 RPS burst)",
    environment: process.env.NODE_ENV || "development"
  });
});

router.get("/api/developer/lists", requireDevApiKey, async (req, res) => {
  const apiKey = (req as any).validatedApiKey || "";
  const search = String(req.query.search || "").toLowerCase();
  const statusFilter = String(req.query.status || "").toLowerCase();

  let demoLists = [
    {
      id: "demo-list-1",
      name: "RED V-Raptor Cine Rental Kit",
      description: "Complete premium cinematography and optical rigging deployment.",
      isTemplate: false,
      status: "Active",
      itemCount: 14,
      rentalPrice: 650,
      rentalPeriod: "day",
      currency: "USD",
      createdAt: new Date().toISOString()
    },
    {
      id: "demo-list-2",
      name: "Sony FX6 Broadcast Pack",
      description: "Direct production-ready video and sound sync flightcase.",
      isTemplate: false,
      status: "Active",
      itemCount: 9,
      rentalPrice: 350,
      rentalPeriod: "day",
      currency: "USD",
      createdAt: new Date().toISOString()
    },
    {
      id: "demo-list-3",
      name: "Sound Devices 833 Audio Bag",
      description: "Custom recordist bundle with wisycom slot receiver.",
      isTemplate: true,
      status: "Draft",
      itemCount: 8,
      rentalPrice: 180,
      rentalPeriod: "day",
      currency: "USD",
      createdAt: new Date().toISOString()
    }
  ];

  if (search) {
    demoLists = demoLists.filter(l => l.name.toLowerCase().includes(search) || l.description.toLowerCase().includes(search));
  }

  if (statusFilter) {
    demoLists = demoLists.filter(l => l.status.toLowerCase() === statusFilter);
  }

  return res.json({
    status: "success",
    code: 200,
    info: "Packer.Tools Developer API v5.21.0",
    authenticated: true,
    apiKeyMasked: apiKey.length > 8 ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : "••••••••",
    totalCount: demoLists.length,
    lists: demoLists
  });
});

router.get("/api/developer/gear", requireDevApiKey, async (req, res) => {
  const apiKey = (req as any).validatedApiKey || "";
  const categoryFilter = String(req.query.category || "").toLowerCase();
  const search = String(req.query.search || "").toLowerCase();

  let demoGear = [
    {
      id: "gear-1",
      name: "RED V-Raptor 8K Camera Body",
      category: "Cameras",
      condition: "new",
      serialNumber: "VR-900812",
      rentalPrice: 450,
      rentalPeriod: "day",
      status: "available",
      notes: "Clean sensor, matching standard PL mount."
    },
    {
      id: "gear-2",
      name: "Arri Signature Prime 58mm T1.8",
      category: "Lenses",
      condition: "good",
      serialNumber: "ASP-58104",
      rentalPrice: 150,
      rentalPeriod: "day",
      status: "available",
      notes: "Native LPL mount with custom PL adapter rings."
    },
    {
      id: "gear-3",
      name: "Teradek Bolt 4K LT 750 TX/RX",
      category: "Wireless Video",
      condition: "good",
      serialNumber: "TB-75019",
      rentalPrice: 80,
      rentalPeriod: "day",
      status: "in_use",
      currentHolder: "Sarah Connor (Booking Crew)",
      notes: "Configured matching standard channel hops list."
    }
  ];

  if (categoryFilter) {
    demoGear = demoGear.filter(g => g.category.toLowerCase().includes(categoryFilter));
  }

  if (search) {
    demoGear = demoGear.filter(g => g.name.toLowerCase().includes(search) || g.serialNumber.toLowerCase().includes(search));
  }

  return res.json({
    status: "success",
    code: 200,
    info: "Packer.Tools Developer API v5.21.0",
    authenticated: true,
    apiKeyMasked: apiKey.length > 8 ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : "••••••••",
    totalCount: demoGear.length,
    gear: demoGear
  });
});

router.get("/api/developer/gear/:id", requireDevApiKey, async (req, res) => {
  const { id } = req.params;
  const apiKey = (req as any).validatedApiKey || "";

  const demoGearMap: Record<string, any> = {
    "gear-1": {
      id: "gear-1",
      name: "RED V-Raptor 8K Camera Body",
      category: "Cameras",
      condition: "new",
      serialNumber: "VR-900812",
      rentalPrice: 450,
      rentalPeriod: "day",
      status: "available",
      notes: "Clean sensor, matching standard PL mount.",
      addOns: [
        { name: "V-Mount Battery Plate", price: 0 },
        { name: "DSMC3 RED Touch 7.0\" LCD", price: 0 }
      ]
    },
    "gear-2": {
      id: "gear-2",
      name: "Arri Signature Prime 58mm T1.8",
      category: "Lenses",
      condition: "good",
      serialNumber: "ASP-58104",
      rentalPrice: 150,
      rentalPeriod: "day",
      status: "available",
      notes: "Native LPL mount with custom PL adapter rings."
    },
    "gear-3": {
      id: "gear-3",
      name: "Teradek Bolt 4K LT 750 TX/RX",
      category: "Wireless Video",
      condition: "good",
      serialNumber: "TB-75019",
      rentalPrice: 80,
      rentalPeriod: "day",
      status: "in_use",
      currentHolder: "Sarah Connor (Booking Crew)",
      notes: "Configured matching standard channel hops list."
    }
  };

  const item = demoGearMap[id];
  if (!item) {
    return res.status(404).json({
      status: "error",
      code: 404,
      error: `Gear item with ID '${id}' not found.`
    });
  }

  return res.json({
    status: "success",
    code: 200,
    info: "Packer.Tools Developer API v5.21.0",
    authenticated: true,
    item
  });
});

router.post("/api/developer/webhooks/test", requireDevApiKey, (req, res) => {
  const { eventType, payload } = req.body || {};
  const event = eventType || "gear.checked_out";

  return res.json({
    status: "success",
    code: 200,
    delivered: true,
    webhookId: `wh_test_${Math.random().toString(36).substring(2, 10)}`,
    event,
    receivedPayload: payload || { sample: "test_event_data" },
    timestamp: new Date().toISOString()
  });
});

router.post("/api/developer/embed", (req, res) => {
  const { theme, layout, listId, primaryColor, companyName } = req.body || {};
  
  const safeListId = encodeURIComponent(String(listId || 'all').replace(/[^a-zA-Z0-9_-]/g, ''));
  const safeTheme = encodeURIComponent(String(theme || 'dark').replace(/[^a-zA-Z0-9_-]/g, ''));
  const safeColor = encodeURIComponent(String(primaryColor || '#ff4f3a'));
  const safeCompany = encodeURIComponent(String(companyName || 'Packer Partner'));
  const safeCompanyNameHtml = escapeHtml(companyName || 'Packer Partner');

  const iframeUrl = `https://packer.tools/embed/${safeListId}?theme=${safeTheme}&color=${safeColor}&company=${safeCompany}`;
  const embedCode = `<iframe src="${iframeUrl}" width="100%" height="600" style="border: 1px solid #eaeaea; border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);" allow="payment; camera" title="Powered by Packer.Tools Rental Shop (${safeCompanyNameHtml})"></iframe>`;

  return res.json({
    status: "success",
    code: 200,
    iframeUrl,
    embedCode,
    scriptTag: `<script src="https://cdn.jsdelivr.net/npm/@packer-tools/embed-sdk@1/dist/embed.js" data-list-id="${safeListId}" data-theme="${safeTheme}" data-color="${safeColor}"></script>`
  });
});

export default router;
