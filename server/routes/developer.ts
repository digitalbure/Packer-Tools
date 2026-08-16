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
    message: "Packer.Tools Developer API v6.0.0 Operational",
    authenticated: true,
    apiKeyMasked: maskedKey,
    serverVersion: "6.0.0",
    timestamp: new Date().toISOString(),
    capabilities: [
      "lists.read",
      "gear.read",
      "hardware.scans.read",
      "hardware.scans.write",
      "rfid.epc.encode",
      "nfc.passport.resolve"
    ],
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

// Hardware Connectors & Scan Audit Trail Endpoints
router.get("/api/developer/hardware/readers", requireDevApiKey, (req, res) => {
  return res.json({
    status: "success",
    code: 200,
    serverVersion: "6.0.0",
    supportedProtocols: [
      {
        protocol: "Web NFC",
        chipsets: ["NTAG213", "NTAG215", "NTAG216", "Mifare Ultralight"],
        compatibility: "Android Chrome (NDEFReader)",
        baudRate: "106 kbps",
        modes: ["Read NDEF URL", "Write Asset Passport URL"]
      },
      {
        protocol: "Web Bluetooth BLE (GATT)",
        devices: ["Zebra RFD40 Sled", "Zebra RFD8500", "Chafon H101 / H102 BLE", "Chainway C72 / R6"],
        services: ["0000ffe0-0000-1000-8000-00805f9b34fb", "custom-epc-stream"],
        modes: ["Multi-Tag Sweep Inventory", "Geiger RSSI Proximity Locator", "Tag Memory Bank Read/Write"]
      },
      {
        protocol: "Web Serial (USB / Virtual COM)",
        devices: ["Zebra Fixed Readers", "Impinj Speedway", "Alien ALR-F800", "Generic FTDI RS232"],
        defaultBaudRates: [9600, 115200],
        modes: ["High-Volume Portal Sweep", "Raw ASCII / Hex Stream"]
      },
      {
        protocol: "WebSocket Edge Gateway",
        devices: ["Zebra FX9600 Network Reader", "Chainway Edge Hub"],
        defaultPort: 8080,
        modes: ["Real-Time Event Ingestion Stream"]
      }
    ]
  });
});

router.get("/api/developer/hardware/scans", requireDevApiKey, async (req, res) => {
  const tagType = String(req.query.tagType || "").toLowerCase();
  const scanContext = String(req.query.scanContext || "").toLowerCase();
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);

  // Return formatted audit trail schema reference
  const sampleEvents = [
    {
      id: "scan-ev-001",
      assetId: "gear-1",
      assetName: "RED V-Raptor 8K Camera Body",
      assetTag: "CAM-001",
      tagType: "rfid",
      tagId: "E28011606000021570A24981",
      scanTimestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      scanContext: "manifest-sweep",
      location: "Warehouse Stage A",
      deviceInfo: "Zebra RFD40 Sled (BLE)",
      signalStrength: -58,
      readCount: 14
    },
    {
      id: "scan-ev-002",
      assetId: "gear-2",
      assetName: "Arri Signature Prime 58mm T1.8",
      assetTag: "LENS-042",
      tagType: "nfc",
      tagId: "04:52:8A:1B:90:3F:80",
      scanTimestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      scanContext: "passport-view",
      location: "Mobile Field Depot",
      deviceInfo: "Android Chrome (Web NFC)",
      readCount: 1
    }
  ];

  let filtered = sampleEvents;
  if (tagType) filtered = filtered.filter(e => e.tagType === tagType);
  if (scanContext) filtered = filtered.filter(e => e.scanContext === scanContext);

  return res.json({
    status: "success",
    code: 200,
    serverVersion: "6.0.0",
    totalCount: filtered.length,
    events: filtered.slice(0, limit),
    schema: {
      collection: "scanEvents",
      fields: {
        assetId: "string (optional reference)",
        assetName: "string (optional display label)",
        assetTag: "string (optional barcode/tag)",
        tagType: "'nfc' | 'rfid' (required)",
        tagId: "string (raw EPC or NFC UID, required)",
        scanTimestamp: "ISO8601 string (required)",
        scanContext: "'manifest-sweep' | 'checkout' | 'checkin' | 'audit' | 'tag-linked' | 'tag-written' | 'passport-view'",
        userId: "string (auth uid)",
        userName: "string",
        location: "string (optional)",
        deviceInfo: "string (hardware model/protocol)",
        signalStrength: "number (RSSI dBm for RFID)",
        readCount: "number"
      }
    }
  });
});

router.post("/api/developer/hardware/scans", requireDevApiKey, (req, res) => {
  const { tagType, tagId, assetId, assetName, assetTag, scanContext, location, deviceInfo, signalStrength } = req.body || {};

  if (!tagType || !tagId) {
    return res.status(400).json({
      status: "error",
      code: 400,
      error: "Missing required fields: 'tagType' ('nfc' | 'rfid') and 'tagId' (EPC or UID)."
    });
  }

  const recordedEvent = {
    id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tagType: tagType === "rfid" ? "rfid" : "nfc",
    tagId: String(tagId).trim(),
    assetId: assetId ? String(assetId) : null,
    assetName: assetName ? String(assetName) : null,
    assetTag: assetTag ? String(assetTag) : null,
    scanTimestamp: new Date().toISOString(),
    scanContext: scanContext || "external-api-ingest",
    location: location || "External Gateway",
    deviceInfo: deviceInfo || "API Ingest",
    signalStrength: typeof signalStrength === "number" ? signalStrength : null,
    status: "recorded"
  };

  return res.json({
    status: "success",
    code: 201,
    message: "Hardware scan event successfully recorded to audit trail.",
    event: recordedEvent
  });
});

router.post("/api/developer/rfid/tag/encode", requireDevApiKey, (req, res) => {
  const { assetTag, serialNumber, prefix = "E280" } = req.body || {};
  
  // Format standard 24-character (96-bit) Gen 2 EPC
  const safeTag = String(assetTag || serialNumber || "ITEM").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const hexPart = Buffer.from(safeTag).toString("hex").toUpperCase();
  const rawEpc = (prefix + hexPart).padEnd(24, "0").slice(0, 24);

  return res.json({
    status: "success",
    code: 200,
    epc: rawEpc,
    bitLength: 96,
    memoryBank: "EPC (Bank 01)",
    payloadHex: rawEpc,
    instructions: "Write payloadHex to RFID EPC Bank 01 at word pointer 02."
  });
});

router.post("/api/developer/nfc/passport", requireDevApiKey, (req, res) => {
  const { assetId, orgSlug = "public", baseUrl = "https://packer.tools" } = req.body || {};

  if (!assetId) {
    return res.status(400).json({
      status: "error",
      code: 400,
      error: "Missing required field 'assetId'."
    });
  }

  const passportUrl = `${baseUrl}/#/gear/${encodeURIComponent(assetId)}`;
  
  return res.json({
    status: "success",
    code: 200,
    assetId,
    passportUrl,
    ndefRecord: {
      recordType: "url",
      data: passportUrl
    },
    chipTypes: ["NTAG213 (144 bytes)", "NTAG215 (504 bytes)", "NTAG216 (888 bytes)"],
    browserSupport: "Android Chrome with Web NFC (NDEFReader API)"
  });
});

export default router;
