import express from "express";

const router = express.Router();

router.get("/api/developer/lists", async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  const demoLists = [
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

  return res.json({
    status: "success",
    info: "Packer Tools Developer API v1.0.2",
    authenticated: !!apiKey,
    totalCount: demoLists.length,
    lists: demoLists
  });
});

router.get("/api/developer/gear", async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  const demoGear = [
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

  return res.json({
    status: "success",
    info: "Packer Tools Developer API v1.0.2",
    authenticated: !!apiKey,
    totalCount: demoGear.length,
    gear: demoGear
  });
});

router.post("/api/developer/embed", (req, res) => {
  const { theme, layout, listId, primaryColor, companyName } = req.body;
  
  const iframeUrl = `https://packer.tools/embed/${listId || 'all'}?theme=${theme || 'dark'}&color=${encodeURIComponent(primaryColor || '#ff4f3a')}&company=${encodeURIComponent(companyName || 'Packer Partner')}`;
  const embedCode = `<iframe src="${iframeUrl}" width="100%" height="600" style="border: 1px solid #eaeaea; border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);" allow="payment; camera" title="Powered by Packer Tools Rental Shop"></iframe>`;

  return res.json({
    status: "success",
    iframeUrl,
    embedCode,
    scriptTag: `<script src="https://cdn.jsdelivr.net/npm/@packer-tools/embed-sdk@1/dist/embed.js" data-list-id="${listId || 'all'}" data-theme="${theme || 'dark'}" data-color="${primaryColor || '#ff4f3a'}"></script>`
  });
});

export default router;
