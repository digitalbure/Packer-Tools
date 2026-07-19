import express from "express";
import { authenticateUser } from "../middleware/auth";

const router = express.Router();

// Mock database storage in memory for backup, while we also support Firestore saves on client
interface LabelTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: any[];
  layout: string;
  category: string;
  isPublic?: boolean;
  isFavorite?: boolean;
  version: string;
  createdAt: string;
}

const MEMORY_TEMPLATES: LabelTemplate[] = [
  {
    id: "tpl_asset_standard",
    name: "Industrial Asset Label",
    width: 54,
    height: 25,
    layout: "standard",
    category: "Warehouse",
    elements: [
      { id: "e1", type: "text", content: "{{asset.brand}}", x: 2, y: 2, font: "Inter", size: 8, weight: "bold" },
      { id: "e2", type: "text", content: "{{asset.name}}", x: 2, y: 16, font: "Inter", size: 9, weight: "black" },
      { id: "e3", type: "qr", content: "equipment-bio", x: 34, y: 2, size: 18 }
    ],
    version: "v1.0.0",
    createdAt: new Date().toISOString()
  },
  {
    id: "tpl_cable_wrap",
    name: "Broadcast Cable Wrap",
    width: 75,
    height: 12,
    layout: "cable",
    category: "Broadcast",
    elements: [
      { id: "e1", type: "text", content: "{{asset.name}}", x: 15, y: 2, font: "JetBrains Mono", size: 8, weight: "bold" },
      { id: "e2", type: "qr", content: "equipment-bio", x: 2, y: 1, size: 10 }
    ],
    version: "v1.2.0",
    createdAt: new Date().toISOString()
  }
];

const MEMORY_MARKETPLACE: LabelTemplate[] = [
  {
    id: "market_film_lens",
    name: "Cinema Lens Capsule Tag",
    width: 40,
    height: 40,
    layout: "standard",
    category: "Film",
    elements: [
      { id: "e1", type: "text", content: "{{asset.brand}}", x: 4, y: 4, font: "Inter", size: 10, weight: "bold" },
      { id: "e2", type: "text", content: "LENS: {{asset.name}}", x: 4, y: 32, font: "Inter", size: 8, weight: "bold" },
      { id: "e3", type: "qr", content: "equipment-bio", x: 10, y: 10, size: 20 }
    ],
    version: "v1.0.0",
    createdAt: new Date().toISOString()
  },
  {
    id: "market_road_case",
    name: "Heavy Pelican Case Sticker",
    width: 100,
    height: 50,
    layout: "standard",
    category: "Grip",
    elements: [
      { id: "e1", type: "text", content: "PACKER HEAVY UNIT", x: 5, y: 5, font: "Space Grotesk", size: 14, weight: "black" },
      { id: "e2", type: "text", content: "TAG: {{asset.assetTag}}", x: 5, y: 40, font: "JetBrains Mono", size: 10, weight: "bold" },
      { id: "e3", type: "qr", content: "equipment-bio", x: 65, y: 5, size: 40 }
    ],
    version: "v2.0.1",
    createdAt: new Date().toISOString()
  },
  {
    id: "market_network_rack",
    name: "1U Rack ID Strips",
    width: 100,
    height: 10,
    layout: "standard",
    category: "IT",
    elements: [
      { id: "e1", type: "text", content: "{{asset.name}}", x: 20, y: 2, font: "JetBrains Mono", size: 8, weight: "bold" },
      { id: "e2", type: "qr", content: "equipment-bio", x: 2, y: 1, size: 8 }
    ],
    version: "v1.0.0",
    createdAt: new Date().toISOString()
  }
];

const PRINT_HISTORY: any[] = [];

// 1. GET User custom templates
router.get("/api/labels/templates", (req, res) => {
  res.json({
    status: "success",
    templates: MEMORY_TEMPLATES
  });
});

// 2. POST Save user custom template
router.post("/api/labels/templates", (req, res) => {
  const { name, width, height, elements, layout, category } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Template name is required" });
  }

  const newTemplate: LabelTemplate = {
    id: `tpl_${Date.now()}`,
    name,
    width: width || 54,
    height: height || 25,
    elements: elements || [],
    layout: layout || "standard",
    category: category || "General",
    version: "v1.0.0",
    createdAt: new Date().toISOString()
  };

  MEMORY_TEMPLATES.push(newTemplate);
  res.status(201).json({
    status: "success",
    message: "Template successfully recorded in Label Studio index",
    template: newTemplate
  });
});

// 3. DELETE User custom template
router.delete("/api/labels/templates/:id", (req, res) => {
  const { id } = req.params;
  const idx = MEMORY_TEMPLATES.findIndex(t => t.id === id);
  if (idx > -1) {
    MEMORY_TEMPLATES.splice(idx, 1);
  }
  res.json({
    status: "success",
    message: `Template ${id} removed`
  });
});

// 4. POST Log print session
router.post("/api/labels/print", (req, res) => {
  const { templateId, assetIds, printerProfile, copies } = req.body;
  if (!assetIds || !Array.isArray(assetIds)) {
    return res.status(400).json({ error: "Invalid assets array for printing queue" });
  }

  const printJob = {
    id: `prnt_${Date.now()}`,
    templateId: templateId || "tpl_asset_standard",
    assetIds,
    printerProfile: printerProfile || "Generic PDF",
    copies: copies || 1,
    timestamp: new Date().toISOString()
  };

  PRINT_HISTORY.push(printJob);
  res.json({
    status: "success",
    message: `Print command routed to ${printerProfile}`,
    job: printJob
  });
});

// 5. GET Print history logs
router.get("/api/labels/print/history", (req, res) => {
  res.json({
    status: "success",
    history: PRINT_HISTORY
  });
});

// 6. POST Generate live preview model
router.post("/api/labels/preview", (req, res) => {
  const { elements, assetData } = req.body;
  
  // Dynamic parsing logic on backend
  const resolvedElements = (elements || []).map((el: any) => {
    if (el.type === "text") {
      let text = el.content || "";
      // Replace variables
      text = text.replace(/\{\{asset\.brand\}\}/gi, assetData?.brand || "Generic");
      text = text.replace(/\{\{asset\.name\}\}/gi, assetData?.name || "Equipment Item");
      text = text.replace(/\{\{asset\.assetTag\}\}/gi, assetData?.assetTag || "TAG-PENDING");
      text = text.replace(/\{\{asset\.serial\}\}/gi, assetData?.serial || "S/N-NONE");
      text = text.replace(/\{\{asset\.model\}\}/gi, assetData?.model || "Model A");
      text = text.replace(/\{\{asset\.manufacturer\}\}/gi, assetData?.brand || "Manufacturer");
      return { ...el, resolvedContent: text };
    }
    return el;
  });

  res.json({
    status: "success",
    resolvedElements,
    renderingDpi: 300
  });
});

// 7. GET Smart QR Destination Specs
router.get("/api/labels/qr", (req, res) => {
  res.json({
    status: "success",
    destinations: [
      { id: "equipment-bio", label: "Equipment Bio Portal", desc: "Open the digital profile page of the asset" },
      { id: "asset-page", label: "Packer App Page", desc: "Interactive asset operations details inside Packer Tools client" },
      { id: "booking", label: "Lease/Booking Checkout Form", desc: "Direct rental calendar and signoff sheet" },
      { id: "maintenance", label: "Maintenance Checklist & Fault Report", desc: "Report damages or service requests immediately" },
      { id: "custom", label: "Custom Domain URL Redirect", desc: "Direct code scan to your own custom organizational domain" }
    ]
  });
});

// 8. GET Marketplace templates
router.get("/api/labels/marketplace", (req, res) => {
  res.json({
    status: "success",
    categories: ["Broadcast", "Film", "Audio", "Lighting", "Grip", "Warehouse", "IT"],
    templates: MEMORY_MARKETPLACE
  });
});

// 9. POST Publish custom template to Marketplace
router.post("/api/labels/marketplace/publish", (req, res) => {
  const { template, category } = req.body;
  if (!template || !template.name) {
    return res.status(400).json({ error: "A valid template with name is required" });
  }

  const published: LabelTemplate = {
    ...template,
    id: `market_${Date.now()}`,
    category: category || "General",
    isPublic: true,
    createdAt: new Date().toISOString()
  };

  MEMORY_MARKETPLACE.push(published);
  res.json({
    status: "success",
    message: `Template successfully published to Label Studio Marketplace under category ${category}`,
    template: published
  });
});

// 10. GET Equipment Bio portal
router.get("/api/labels/bio/:assetId", (req, res) => {
  const { assetId } = req.params;
  res.json({
    status: "success",
    assetId,
    equipmentBio: {
      id: assetId,
      name: "RED V-Raptor 8K VV Cinema Camera",
      brand: "RED",
      assetTag: `PT-RED-${assetId.substring(0, 5).toUpperCase()}`,
      status: "Available",
      condition: "Excellent",
      serialNumber: "VR-875021-X",
      manufactureDate: "2025-05-12",
      lastMaintenanceDate: "2026-06-01",
      notes: "Studio Camera package in Pelican 1510. Supplied with Canon RF mount adapters.",
      ownership: {
        company: "Packer Logistics Inc.",
        contactEmail: "logistics@packer.tools",
        insurancePolicy: "POL-991202-A"
      },
      auditHistory: [
        { date: "2026-06-01", action: "Completed maintenance inspection", user: "Tech Coordinator" },
        { date: "2026-05-20", action: "Returned to Pelican Locker B-3", user: "Lead Operator" }
      ]
    }
  });
});

export default router;
