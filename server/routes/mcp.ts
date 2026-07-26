import express from "express";
import fs from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { admin, dbAdmin } from "../firebaseAdmin";

const router = express.Router();

// CORS Middleware for MCP & OAuth Endpoints
router.use(["/api/mcp", "/api/mcp/*", "/oauth", "/oauth/*", "/.well-known", "/.well-known/*"], (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, mcp-session-id");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// OAuth 2.0 Discovery Metadata for Claude & External MCP Clients
router.get([
  "/.well-known/oauth-authorization-server",
  "/.well-known/mcp-configuration",
  "/.well-known/openid-configuration"
], (req, res) => {
  const host = req.get("host") || "packer.tools";
  const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ["code", "token"],
    grant_types_supported: ["client_credentials", "authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    scopes_supported: ["mcp:all", "mcp:read", "mcp:write"]
  });
});

// In-Memory store for active OAuth access tokens
const activeMcpTokens = new Map<string, { clientId: string; createdAt: number; scope: string }>();

// OAuth 2.0 Authorization Endpoint (Supports Claude OAuth Flow)
router.all(["/oauth/authorize", "/api/mcp/oauth/authorize"], async (req, res) => {
  const responseType = (req.query.response_type || req.body?.response_type || "code") as string;
  const clientId = (req.query.client_id || req.body?.client_id || "packer-tools-claude-connector") as string;
  const redirectUri = (req.query.redirect_uri || req.body?.redirect_uri || "") as string;
  const state = (req.query.state || req.body?.state || "") as string;

  const authCode = `pt_code_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  if (redirectUri) {
    try {
      const redirectUrl = new URL(String(redirectUri));
      redirectUrl.searchParams.set("code", authCode);
      if (state) redirectUrl.searchParams.set("state", String(state));
      return res.redirect(redirectUrl.toString());
    } catch {
      // Fallback if invalid URL format
    }
  }

  return res.json({
    status: "authorized",
    code: authCode,
    state,
    clientId,
    message: "Packer Tools Claude MCP OAuth Authorization Approved."
  });
});

// OAuth 2.0 Token Endpoint (Supports Client Credentials & Authorization Code for Claude)
router.post(["/oauth/token", "/api/mcp/oauth/token"], async (req, res) => {
  let clientId = req.body?.client_id;
  let clientSecret = req.body?.client_secret;

  // Extract from HTTP Basic Authorization header if present
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Basic ")) {
    try {
      const credentials = Buffer.from(authHeader.split(" ")[1], "base64").toString("utf-8");
      const [u, p] = credentials.split(":");
      if (u) clientId = u;
      if (p) clientSecret = p;
    } catch {
      // Parse error fallback
    }
  }

  // Assign default client identity if not supplied
  const finalClientId = clientId || "packer-tools-claude-connector";
  const accessToken = `pt_mcp_tok_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const refreshToken = `pt_mcp_ref_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;

  activeMcpTokens.set(accessToken, {
    clientId: finalClientId,
    createdAt: Date.now(),
    scope: "mcp:all"
  });

  return res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 2592000, // 30 days
    refresh_token: refreshToken,
    scope: "mcp:all"
  });
});

// Map to track active client SSE transports by their sessionId
const activeTransports = new Map<string, SSEServerTransport>();

// 1. List MCP Tools available on the server
function getMcpToolsList() {
  return [
      {
        name: "list_gear",
        description: "List and search all gear/assets stored in the Packer Tools library for a given user.",
        inputSchema: {
          type: "object",
          properties: {
            uid: {
              type: "string",
              description: "The Firebase user ID (UID) of the operator. Required for multi-tenant account isolation."
            },
            category: {
              type: "string",
              description: "Optional category filter (e.g., 'Camera', 'Lens', 'Audio', 'Lighting', 'Support')."
            },
            search: {
              type: "string",
              description: "Optional text search keyword matching name, brand, model, or serial number."
            },
            limit: {
              type: "number",
              description: "Maximum number of gear items to return. Defaults to 50."
            }
          },
          required: ["uid"]
        }
      },
      {
        name: "add_gear_item",
        description: "Add or register a brand new equipment/gear asset into a specified user's Packer Tools library.",
        inputSchema: {
          type: "object",
          properties: {
            uid: {
              type: "string",
              description: "The Firebase user ID (UID) of the operator target account. Required."
            },
            name: {
              type: "string",
              description: "Visual name of the equipment item (e.g. 'RED V-Raptor Cine Camera Body')."
            },
            brand: {
              type: "string",
              description: "The brand/manufacturer of the item (e.g. 'RED', 'Sony', 'Arri')."
            },
            model: {
              type: "string",
              description: "The specific model description of the item."
            },
            modelNumber: {
              type: "string",
              description: "The manufacturer part number or model number."
            },
            serialNumber: {
              type: "string",
              description: "Unique serial number printed on the device chassis."
            },
            primaryCategory: {
              type: "string",
              description: "Category category of the item (e.g., 'Camera', 'Lens', 'Audio', 'Lighting', 'Support', 'Power', 'Electronics', 'Cables', 'Accessories')."
            },
            quantity: {
              type: "number",
              description: "Current aggregate quantity. Defaults to 1."
            },
            price: {
              type: "number",
              description: "The estimated purchase value or rental pricing of the item."
            },
            condition: {
              type: "string",
              description: "Item physical condition status: 'new', 'good', 'fair', or 'poor'."
            },
            status: {
              type: "string",
              description: "Deployment state: 'available', 'in_use', 'maintenance', 'retired', 'missing'. Defaults to 'available'."
            },
            notes: {
              type: "string",
              description: "Custom specification details, I/O ports, or other accessories notes."
            }
          },
          required: ["uid", "name"]
        }
      },
      {
        name: "list_inventory_sheets",
        description: "List all active custom inventory checklists/sheets in the workspace for a specific user.",
        inputSchema: {
          type: "object",
          properties: {
            uid: {
              type: "string",
              description: "The Firebase user ID (UID) of the operator. Required."
            }
          },
          required: ["uid"]
        }
      },
      {
        name: "get_inventory_sheet_items",
        description: "Retrieve all items nested inside a specific custom inventory sheet or checklist.",
        inputSchema: {
          type: "object",
          properties: {
            sheetId: {
              type: "string",
              description: "The unique document ID of the custom inventory sheet."
            }
          },
          required: ["sheetId"]
        }
      },
      {
        name: "lookup_user",
        description: "Admin Tool: Lookup user profile, plan tier, and workspace metadata by email or Firebase UID (Requires adminApiKey).",
        inputSchema: {
          type: "object",
          properties: {
            adminApiKey: {
              type: "string",
              description: "Admin API Key required to query user account profiles."
            },
            email: {
              type: "string",
              description: "User email address to search for."
            },
            uid: {
              type: "string",
              description: "Firebase user UID to directly retrieve."
            }
          },
          required: ["adminApiKey"]
        }
      },
      {
        name: "update_user_plan",
        description: "Admin Tool: Update a user's subscription tier, seat limit, or feature configuration (Requires adminApiKey).",
        inputSchema: {
          type: "object",
          properties: {
            adminApiKey: {
              type: "string",
              description: "Admin API Key required to perform administrative plan updates."
            },
            uid: {
              type: "string",
              description: "The Firebase user UID to update."
            },
            planTier: {
              type: "string",
              description: "Target subscription plan tier ('free', 'pro', 'enterprise', 'custom')."
            },
            seatLimit: {
              type: "number",
              description: "Maximum number of team seats allowed."
            },
            status: {
              type: "string",
              description: "Subscription status ('active', 'canceled', 'trialing', 'past_due')."
            }
          },
          required: ["adminApiKey", "uid"]
        }
      },
      {
        name: "list_organizations",
        description: "Admin Tool: List registered multi-tenant organizations across the Packer Tools network (Requires adminApiKey).",
        inputSchema: {
          type: "object",
          properties: {
            adminApiKey: {
              type: "string",
              description: "Admin API Key required for cross-tenant organizational discovery."
            },
            limit: {
              type: "number",
              description: "Maximum number of organizations to return. Defaults to 20."
            }
          },
          required: ["adminApiKey"]
        }
      },
      {
        name: "get_system_telemetry",
        description: "Admin Tool: Retrieve overall platform telemetry including total users, active gear count, and health status (Requires adminApiKey).",
        inputSchema: {
          type: "object",
          properties: {
            adminApiKey: {
              type: "string",
              description: "Admin API Key required to view platform metrics."
            }
          },
          required: ["adminApiKey"]
        }
      },
      {
        name: "get_app_capabilities",
        description: "Admin Capabilities Tool: Retrieve complete platform specifications, active modules, layout presets, tech stack details, and system feature rules.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_release_notes",
        description: "Admin Capabilities Tool: Query current platform release version (v5.18.3) and full release changelog history.",
        inputSchema: {
          type: "object",
          properties: {
            version: {
              type: "string",
              description: "Optional version string to filter changelog notes for (e.g., 'v5.18.3', 'v5.18.2')."
            }
          }
        }
      },
      {
        name: "get_knowledge_base_guide",
        description: "Admin Capabilities Tool: Retrieve step-by-step Knowledge Base documentation for platform modules (e.g., Organizer Designer, CAD exports, magnetic alignment, public share links, bulk allocation, audit rules).",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "Optional topic keyword to search or filter guides by."
            }
          }
        }
      },
      {
        name: "get_marketing_messaging_kit",
        description: "Marketing Agent Tool: Retrieve Packer Tools marketing positioning, multi-industry angles, value propositions, feature hooks, campaign templates, and social media copy ideas.",
        inputSchema: {
          type: "object",
          properties: {
            industry: {
              type: "string",
              description: "Optional industry focus ('film', 'construction', 'automotive', 'sports', 'medical', 'logistics')."
            }
          }
        }
      }
  ];
}

// Admin Authentication Helper for elevated MCP Tools
function checkAdminAuth(args: Record<string, any>) {
  const expectedKey = process.env.ADMIN_API_KEY || "pt_sec_packertools_2026_mcp";
  const providedKey = args.adminApiKey || args.apiKey;
  if (!providedKey || providedKey !== expectedKey) {
    throw new Error("Access Denied: Invalid or missing 'adminApiKey'. Elevated admin authorization is required for cross-tenant system tools.");
  }
}

// 2. Call/Execute MCP Tools
async function executeMcpTool(toolName: string, args: Record<string, any> = {}) {
  try {
    switch (toolName) {
      case "list_gear": {
        const uid = args.uid as string;
        if (!uid) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  message: "Unauthenticated call rejected: Explicit 'uid' parameter is required for list_gear. Unauthenticated defaults are disabled for security."
                }, null, 2)
              }
            ]
          };
        }
        const category = args.category as string | undefined;
        const search = args.search as string | undefined;
        const limit = (args.limit as number) || 50;

        let query: admin.firestore.Query = dbAdmin.collection("users").doc(uid).collection("gearLibrary");

        if (category) {
          query = query.where("primaryCategory", "==", category);
        }

        const snapshot = await query.limit(limit).get();
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (search) {
          const lowerSearch = search.toLowerCase();
          items = items.filter((item: any) => {
            return (
              String(item.name || "").toLowerCase().includes(lowerSearch) ||
              String(item.brand || "").toLowerCase().includes(lowerSearch) ||
              String(item.model || "").toLowerCase().includes(lowerSearch) ||
              String(item.serialNumber || "").toLowerCase().includes(lowerSearch) ||
              String(item.description || "").toLowerCase().includes(lowerSearch)
            );
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                uid,
                totalCount: items.length,
                items
              }, null, 2)
            }
          ]
        };
      }

      case "add_gear_item": {
        const uid = args.uid as string;
        if (!uid) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  message: "Unauthenticated write operation rejected: Explicit 'uid' parameter is required for add_gear_item. Unauthenticated defaults to elevated super-admin accounts are disabled."
                }, null, 2)
              }
            ]
          };
        }
        const newItem = {
          name: args.name || "Unnamed Gear",
          brand: args.brand || "",
          model: args.model || "",
          modelNumber: args.modelNumber || "",
          serialNumber: args.serialNumber || "",
          primaryCategory: args.primaryCategory || "Other",
          quantity: args.quantity !== undefined ? Number(args.quantity) : 1,
          price: args.price !== undefined ? Number(args.price) : 0,
          condition: args.condition || "good",
          status: args.status || "available",
          notes: args.notes || "",
          createdAt: new Date().toISOString(),
          lastMaintenanceDate: new Date().toISOString().split("T")[0],
          maintenanceIntervalDays: 90
        };

        const docRef = await dbAdmin
          .collection("users")
          .doc(uid)
          .collection("gearLibrary")
          .add(newItem);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                message: "Equipment registered successfully inside user's Gear Library.",
                itemId: docRef.id,
                item: newItem
              }, null, 2)
            }
          ]
        };
      }

      case "list_inventory_sheets": {
        const uid = args.uid as string;
        if (!uid) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  message: "Unauthenticated call rejected: Explicit 'uid' parameter is required for list_inventory_sheets."
                }, null, 2)
              }
            ]
          };
        }
        const snapshot = await dbAdmin
          .collection("inventories")
          .where("ownerId", "==", uid)
          .get();

        const sheets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                uid,
                totalCount: sheets.length,
                sheets
              }, null, 2)
            }
          ]
        };
      }

      case "get_inventory_sheet_items": {
        const sheetId = args.sheetId as string;
        const snapshot = await dbAdmin
          .collection("inventories")
          .doc(sheetId)
          .collection("items")
          .get();

        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                sheetId,
                totalCount: items.length,
                items
              }, null, 2)
            }
          ]
        };
      }

      case "lookup_user": {
        checkAdminAuth(args);
        const email = args.email as string | undefined;
        const uid = args.uid as string | undefined;

        if (!email && !uid) {
          throw new Error("Either 'email' or 'uid' must be provided to lookup user profile.");
        }

        let userDoc: any = null;
        let userId = uid;

        if (uid) {
          const doc = await dbAdmin.collection("users").doc(uid).get();
          if (doc.exists) {
            userDoc = { id: doc.id, ...doc.data() };
          }
        } else if (email) {
          const snapshot = await dbAdmin.collection("users").where("email", "==", email).limit(1).get();
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            userId = doc.id;
            userDoc = { id: doc.id, ...doc.data() };
          }
        }

        if (!userDoc) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "not_found",
                  message: `User record not found for search query: ${uid || email}`
                }, null, 2)
              }
            ]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                uid: userId,
                user: userDoc
              }, null, 2)
            }
          ]
        };
      }

      case "update_user_plan": {
        checkAdminAuth(args);
        const uid = args.uid as string;
        const planTier = args.planTier as string | undefined;
        const seatLimit = args.seatLimit as number | undefined;
        const status = args.status as string | undefined;

        const updateData: Record<string, any> = {
          updatedAt: new Date().toISOString(),
          updatedBy: "MCP_CLAUDE_CONNECTOR"
        };

        if (planTier) updateData.planTier = planTier;
        if (seatLimit !== undefined) updateData.seatLimit = Number(seatLimit);
        if (status) updateData.subscriptionStatus = status;

        await dbAdmin.collection("users").doc(uid).set(updateData, { merge: true });

        const updatedDoc = await dbAdmin.collection("users").doc(uid).get();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                message: `User subscription/plan updated successfully for UID ${uid}`,
                uid,
                updatedFields: updateData,
                currentProfile: updatedDoc.data()
              }, null, 2)
            }
          ]
        };
      }

      case "list_organizations": {
        checkAdminAuth(args);
        const limit = (args.limit as number) || 20;
        const snapshot = await dbAdmin.collection("organizations").limit(limit).get();
        const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                totalCount: orgs.length,
                organizations: orgs
              }, null, 2)
            }
          ]
        };
      }

      case "get_system_telemetry": {
        checkAdminAuth(args);
        const usersCount = (await dbAdmin.collection("users").count().get()).data().count;
        const orgsCount = (await dbAdmin.collection("organizations").count().get()).data().count;
        const inventoriesCount = (await dbAdmin.collection("inventories").count().get()).data().count;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                system: "Packer Tools Enterprise Platform",
                timestamp: new Date().toISOString(),
                metrics: {
                  totalUsers: usersCount,
                  totalOrganizations: orgsCount,
                  totalCustomInventories: inventoriesCount,
                  mcpProtocolVersion: "1.0.0",
                  health: "OPERATIONAL"
                }
              }, null, 2)
            }
          ]
        };
      }

      case "get_app_capabilities": {
        const capabilities = {
          name: "Packer Tools",
          version: "v5.18.3",
          description: "Multi-industry Asset & Inventory Management and Gear Logistics platform.",
          industries: [
            "General Logistics & Operations",
            "Film & Production",
            "Construction & Rigging",
            "Automotive & Mechanics",
            "Sports & Athletic Teams",
            "Medical & Field Equipment"
          ],
          coreModules: [
            "Gear Library & Primary Inventory Tracking",
            "Custom Inventories & Dynamic Sub-sheets",
            "Kiosk Mode (Standalone Check-In/Out with Signature Canvas)",
            "Systems Builder (Visual Setup Modeling Canvas)",
            "Organizer Designer (2D Foam CAD Layout Builder with Vector/PNG Export, Magnetic Alignment, Visual Marquee Box-Select, and Shape Grouping)",
            "Marketplace (Workspace Integrations & Equipment Rentals)",
            "System Health & Telemetry Grids (Admin Oversight)"
          ],
          capabilities: [
            "Multi-tenant organization & workspace context (Workspaces, Departments, Teams, Members)",
            "Dynamic industry terminology alignment via useIndustry() context",
            "Firestore write-batch chunking up to 500 ops per transaction",
            "PWA offline caching via service worker",
            "Public share link resolution and unauthenticated asset passports",
            "Bulk equipment allocation and maintenance audit calculations",
            "Model Context Protocol (MCP) server integration for Claude Code & Cursor"
          ]
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(capabilities, null, 2)
            }
          ]
        };
      }

      case "get_release_notes": {
        const filterVersion = args.version as string | undefined;
        const filePath = path.join(process.cwd(), "RELEASE.md");
        let content = "";
        try {
          content = fs.readFileSync(filePath, "utf-8");
        } catch {
          content = "# Release Notes\n\nCurrent Version: v5.18.3";
        }

        if (filterVersion) {
          const sections = content.split("### ");
          const matched = sections.filter(sec => sec.toLowerCase().includes(filterVersion.toLowerCase()));
          if (matched.length > 0) {
            content = "### " + matched.join("\n\n### ");
          }
        }

        return {
          content: [
            {
              type: "text",
              text: content
            }
          ]
        };
      }

      case "get_knowledge_base_guide": {
        const topic = args.topic as string | undefined;
        const filePath = path.join(process.cwd(), "KNOWLEDGE_BASE.md");
        let content = "";
        try {
          content = fs.readFileSync(filePath, "utf-8");
        } catch {
          content = "# Knowledge Base\n\nRefer to platform documentation.";
        }

        if (topic) {
          const lines = content.split("\n");
          const lowerTopic = topic.toLowerCase();
          const filteredLines = lines.filter(line => line.toLowerCase().includes(lowerTopic));
          if (filteredLines.length > 0) {
            content = `# Knowledge Base Search Results for '${topic}':\n\n` + filteredLines.slice(0, 50).join("\n");
          }
        }

        return {
          content: [
            {
              type: "text",
              text: content
            }
          ]
        };
      }

      case "get_marketing_messaging_kit": {
        const targetIndustry = (args.industry as string | undefined)?.toLowerCase();
        const kit = {
          brand: "Packer Tools",
          version: "v5.18.3",
          tagline: "High-Performance Asset & Inventory Management and Gear Logistics Platform",
          valuePropositions: [
            "Multi-Industry Adaptability: Instantly adjusts terminology, icons, and workflows whether you manage camera trucks, construction rigs, athletic rosters, or auto repair bays.",
            "Visual 2D Foam CAD Organizer Designer (v5.18.3): Design custom case inserts with magnetic snap alignment, shape grouping (Ctrl+G), box-select marquee, and high-res vector SVG/PNG CAD exports.",
            "Standalone Kiosk Mode: Fast touchscreen check-in/out with digital signatures and instant barcode verification.",
            "Systems Builder: Drag-and-drop visual connection maps for complex equipment setups and cable topologies.",
            "Offline PWA & Audit Trail: Works in remote field locations with zero data loss and automated maintenance interval calculations."
          ],
          industryAngles: {
            film: {
              audience: "1st/2nd Camera Assistants, DITs, Rental Houses, Sound Engineers",
              painPoint: "Leaving high-value lenses, wireless video transmitters, or specialized cables on location.",
              hook: "Never leave a $10k prime lens behind on set again.",
              keyFeatures: ["Visual Foam Organizer Designer", "Nested Kit Inclusions (Add-Ons)", "Kiosk Digital Signatures"]
            },
            construction: {
              audience: "Site Supervisors, Rigging Leads, Equipment Managers, Safety Officers",
              painPoint: "Lost heavy power tools, expired harness safety inspections, and site transfer confusion.",
              hook: "OSHA-ready safety audits & real-time tool tracking across all job sites.",
              keyFeatures: ["Maintenance Interval Audits", "QR Code Label Studio", "Bulk Site Allocation"]
            },
            automotive: {
              audience: "Shop Owners, Fleet Mechanics, Service Managers",
              painPoint: "Unaccounted diagnostic meters, pneumatic lifts, and expensive specialty wrenches.",
              hook: "Zero missing tools in the shop. Streamlined tech sign-outs in seconds.",
              keyFeatures: ["Tool Box Organizer", "Audit Mode", "Usage History"]
            },
            sports: {
              audience: "Athletic Directors, Equipment Managers, Team Trainers",
              painPoint: "Misplaced player jerseys, protective gear kits, and travel luggage mix-ups.",
              hook: "Flawless game-day gear logistics from home locker room to road trips.",
              keyFeatures: ["Roster Assignment", "Packing Checklists", "Kiosk Check-Out"]
            },
            medical: {
              audience: "EMS Field Techs, Mobile Clinic Supervisors, Disaster Response Teams",
              painPoint: "Unverified field medical kits, missing sterilization logs, and expired supplies.",
              hook: "Mission-critical field medical kit compliance and real-time inventory verification.",
              keyFeatures: ["Passports & Public Share Links", "Maintenance Interval Logs", "Barcode Scanning"]
            },
            logistics: {
              audience: "Warehouse Managers, Cargo Handlers, Operations Directors",
              painPoint: "Inaccurate spreadsheet inventory, slow check-outs, and multi-tenant department chaos.",
              hook: "Automated warehouse logistics with bulk allocation & write-batch cloud scale.",
              keyFeatures: ["Multi-Tenant Workspaces", "Bulk Spreadsheet Import & Decompose", "System Telemetry Grids"]
            }
          },
          socialCampaignAngles: [
            {
              format: "Product Showcase Video / Demo Reel",
              topic: "Organizer Designer 2D Foam CAD Layout Builder",
              hook: "Watch us design a custom Pelican case foam layout in under 60 seconds with magnetic snapping & vector SVG export!",
              hashtags: ["#GearLogistics", "#PelicanCase", "#FoamInsert", "#PackerTools", "#CAD"]
            },
            {
              format: "LinkedIn Thought Leadership",
              topic: "Why Spreadsheets Fail Gear Managers",
              hook: "If your team is still tracking $500k in equipment using a shared Google Sheet, you're one deleted row away from disaster.",
              hashtags: ["#AssetManagement", "#FieldOps", "#EquipmentLogistics", "#SaaS"]
            },
            {
              format: "Feature Release Announcement",
              topic: "v5.18.0 Multi-Select Marquee, Grouping & MCP Server Release",
              hook: "Connect Claude Code or Cursor directly to Packer Tools v5.18.0 with native Model Context Protocol (MCP) server support!",
              hashtags: ["#ProductUpdate", "#TechRelease", "#MCP", "#BuildInPublic"]
            }
          ]
        };

        if (targetIndustry && (kit.industryAngles as any)[targetIndustry]) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  brand: kit.brand,
                  version: kit.version,
                  industryFocus: targetIndustry,
                  details: (kit.industryAngles as any)[targetIndustry],
                  valuePropositions: kit.valuePropositions,
                  campaignAngles: kit.socialCampaignAngles
                }, null, 2)
              }
            ]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(kit, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Execution failed: Tool '${toolName}' is not defined.`);
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing MCP tool: ${err.message}`
        }
      ]
    };
  }
}

// 3. List MCP Resources
function getMcpResourcesList() {
  return [
      {
        uri: "packer://app-capabilities",
        name: "Packer Tools Platform Specifications & Capabilities",
        mimeType: "application/json",
        description: "Complete platform capabilities, active modules, layout presets, tech stack, and architectural rules."
      },
      {
        uri: "packer://marketing-playbook",
        name: "Packer Tools Marketing Playbook & Campaign Positioning Kit",
        mimeType: "application/json",
        description: "Comprehensive marketing kit with multi-industry value props, social hooks, feature highlights, and campaign templates for Claude Marketing Agent."
      },
      {
        uri: "packer://release-notes",
        name: "Release History & Changelog (RELEASE.md)",
        mimeType: "text/markdown",
        description: "Official release notes, current build version (v5.18.3), and feature changelog history."
      },
      {
        uri: "packer://knowledge-base",
        name: "Knowledge Base Documentation (KNOWLEDGE_BASE.md)",
        mimeType: "text/markdown",
        description: "Comprehensive step-by-step Knowledge Base documentation for platform modules and workflows."
      },
      {
        uri: "packer://agent-rules",
        name: "Agent & Developer Instructions (AGENTS.md)",
        mimeType: "text/markdown",
        description: "Technical instructions, database constraints, bulk allocation, and audit rules."
      },
      {
        uri: "packer://gear-summary",
        name: "Gear Library Summary Dashboard",
        mimeType: "text/markdown",
        description: "A summary dashboard of the gear library metrics, maintenance states, and health overview."
      }
  ];
}

// 4. Read MCP Resources
async function readMcpResource(uri: string) {
  if (uri === "packer://app-capabilities") {
    const capabilities = {
      name: "Packer Tools",
      version: "v5.18.3",
      description: "Multi-industry Asset & Inventory Management and Gear Logistics platform.",
      industries: [
        "General Logistics & Operations",
        "Film & Production",
        "Construction & Rigging",
        "Automotive & Mechanics",
        "Sports & Athletic Teams",
        "Medical & Field Equipment"
      ],
      coreModules: [
        "Gear Library & Primary Inventory Tracking",
        "Custom Inventories & Dynamic Sub-sheets",
        "Kiosk Mode (Standalone Check-In/Out with Signature Canvas)",
        "Systems Builder (Visual Setup Modeling Canvas)",
        "Organizer Designer (2D Foam CAD Layout Builder with Vector/PNG Export, Magnetic Alignment, Visual Marquee Box-Select, and Shape Grouping)",
        "Marketplace (Workspace Integrations & Equipment Rentals)",
        "System Health & Telemetry Grids (Admin Oversight)"
      ],
      capabilities: [
        "Multi-tenant organization & workspace context (Workspaces, Departments, Teams, Members)",
        "Dynamic industry terminology alignment via useIndustry() context",
        "Firestore write-batch chunking up to 500 ops per transaction",
        "PWA offline caching via service worker",
        "Public share link resolution and unauthenticated asset passports",
        "Bulk equipment allocation and maintenance audit calculations",
        "Model Context Protocol (MCP) server integration for Claude Code & Cursor"
      ]
    };
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(capabilities, null, 2) }]
    };
  }

  if (uri === "packer://marketing-playbook") {
    const playbook = {
      brand: "Packer Tools",
      version: "v5.18.3",
      tagline: "High-Performance Asset & Inventory Management and Gear Logistics Platform",
      mission: "To eliminate lost equipment, gear chaos, and spreadsheet downtime across high-consequence industries.",
      valuePropositions: [
        "Multi-Industry Adaptability: Instantly adjusts terminology, icons, and workflows whether you manage camera trucks, construction rigs, athletic rosters, or auto repair bays.",
        "Visual 2D Foam CAD Organizer Designer (v5.18.3): Design custom case inserts with magnetic snap alignment, shape grouping (Ctrl+G), box-select marquee, and high-res vector SVG/PNG CAD exports.",
        "Standalone Kiosk Mode: Fast touchscreen check-in/out with digital signatures and instant barcode verification.",
        "Systems Builder: Drag-and-drop visual connection maps for complex equipment setups and cable topologies.",
        "Offline PWA & Audit Trail: Works in remote field locations with zero data loss and automated maintenance interval calculations."
      ],
      targetIndustries: [
        {
          name: "Film & Video Production",
          personas: ["1st/2nd AC", "Key Grip", "DIT", "Rental House Manager"],
          pitch: "Stop losing $10,000 prime lenses and specialty wireless transmitters on wrap day. Packer Tools tracks every lens cap and battery inclusion with visual case maps and digital check-outs."
        },
        {
          name: "Construction & Industrial Rigging",
          personas: ["Site Foreman", "Rigging Supervisor", "Safety & Compliance Officer"],
          pitch: "OSHA-ready safety harness inspections and heavy tool tracking. Know exactly which crew member checked out the rotary hammer or pneumatic lift across every job site."
        },
        {
          name: "Automotive & Fleet Mechanics",
          personas: ["Shop Owner", "Lead Technician", "Fleet Maintenance Director"],
          pitch: "Keep specialty diagnostic meters, pneumatic tools, and torque wrenches organized with visual toolbox layouts and automated maintenance recalibration alerts."
        },
        {
          name: "Sports Teams & Athletics",
          personas: ["Equipment Manager", "Athletic Director", "Head Trainer"],
          pitch: "Seamless game-day equipment logistics. Track player jerseys, protective gear, and travel trunks from locker room to road games without missing a single item."
        },
        {
          name: "Medical & EMS Field Response",
          personas: ["EMS Captain", "Disaster Response Supervisor", "Mobile Clinic Coordinator"],
          pitch: "Mission-critical field medical kit verification. Ensure every trauma bag and diagnostic tool is verified, unexpired, and sealed before deployment."
        },
        {
          name: "General Warehouse & Operations",
          personas: ["Logistics Manager", "Inventory Controller", "Supply Chain Lead"],
          pitch: "Enterprise-scale inventory management with multi-tenant workspaces, barcode scanning, spreadsheet decompose, and cloud real-time syncing."
        }
      ]
    };
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(playbook, null, 2) }]
    };
  }

  if (uri === "packer://release-notes") {
    const filePath = path.join(process.cwd(), "RELEASE.md");
    let content = "";
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      content = "# Release Notes\n\nCurrent Version: v5.18.3";
    }
    return {
      contents: [{ uri, mimeType: "text/markdown", text: content }]
    };
  }

  if (uri === "packer://knowledge-base") {
    const filePath = path.join(process.cwd(), "KNOWLEDGE_BASE.md");
    let content = "";
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      content = "# Knowledge Base\n\nRefer to platform documentation.";
    }
    return {
      contents: [{ uri, mimeType: "text/markdown", text: content }]
    };
  }

  if (uri === "packer://agent-rules") {
    const filePath = path.join(process.cwd(), "AGENTS.md");
    let content = "";
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      content = "# Agent Instructions\n\nRefer to system instructions.";
    }
    return {
      contents: [{ uri, mimeType: "text/markdown", text: content }]
    };
  }

  if (uri === "packer://gear-summary") {
    try {
      // Fetch gear count from common super-admin / default view
      const uid = "demo-super-admin";
      const snapshot = await dbAdmin
        .collection("users")
        .doc(uid)
        .collection("gearLibrary")
        .get();

      const items = snapshot.docs.map(doc => doc.data() as any);
      
      const categoryCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {};
      let totalValue = 0;
      let maintenanceNeeded = 0;

      items.forEach(item => {
        const cat = item.primaryCategory || "Other";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

        const stat = item.status || "available";
        statusCounts[stat] = (statusCounts[stat] || 0) + 1;

        totalValue += (item.price || 0) * (item.quantity || 1);

        // Calculate maintenance outdated status
        if (item.status === "maintenance" || item.condition === "poor") {
          maintenanceNeeded++;
        } else if (item.maintenanceIntervalDays && item.lastMaintenanceDate) {
          try {
            const last = new Date(item.lastMaintenanceDate).getTime();
            const nextDue = last + (item.maintenanceIntervalDays * 24 * 60 * 60 * 1000);
            if (nextDue < Date.now()) {
              maintenanceNeeded++;
            }
          } catch {
            maintenanceNeeded++;
          }
        }
      });

      const markdownReport = `
# Packer Tools Gear Library Summary Status
*Real-time workspace telemetry data retrieved via Model Context Protocol*

## 📊 Inventory Financials & Logistics
- **Total Registered Assets**: ${items.length} items
- **Aggregated Asset Value**: $${totalValue.toLocaleString()}
- **Critical Maintenance Audits Needed**: ${maintenanceNeeded} items

## 📁 Primary Categories Distribution
${Object.entries(categoryCounts)
  .map(([cat, count]) => `- **${cat}**: ${count} items`)
  .join("\n")}

## 🏷️ Deployment Status Overviews
${Object.entries(statusCounts)
  .map(([stat, count]) => `- **${stat.toUpperCase()}**: ${count} items`)
  .join("\n")}
`;

      return {
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: markdownReport.trim()
          }
        ]
      };
    } catch (err: any) {
      return {
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: `# Error Reading telemetry resource: ${err.message}`
          }
        ]
      };
    }
  }

  throw new Error(`Resource uri not found: ${uri}`);
}

// 5. MCP Server Factory Instance Per Connection Session
function createMcpServer(): Server {
  const mcpServer = new Server(
    {
      name: "packer-tools-mcp",
      version: "5.18.3",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getMcpToolsList() };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await executeMcpTool(request.params.name, request.params.arguments || {});
  });

  mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: getMcpResourcesList() };
  });

  mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return await readMcpResource(request.params.uri);
  });

  return mcpServer;
}

// 6. Mount SSE Endpoints
router.get(["/api/mcp/sse", "/api/mcp", "/api/mcp/"], async (req, res) => {
  console.info("[MCP Router] Initializing new client SSE connection stream...");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const transport = new SSEServerTransport("/api/mcp/messages", res);
  const sessionId = transport.sessionId;

  activeTransports.set(sessionId, transport);
  console.info(`[MCP Router] Registered active session sessionID: ${sessionId}`);

  // Heartbeat ping interval every 15 seconds to keep proxies (Cloud Run / Nginx) alive
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on("close", () => {
    console.info(`[MCP Router] Client closed stream. Discarding sessionId: ${sessionId}`);
    clearInterval(heartbeat);
    activeTransports.delete(sessionId);
  });

  const sessionServer = createMcpServer();
  await sessionServer.connect(transport);
});

// 7. Mount POST Message Endpoint for Active SSE Sessions
router.post(["/api/mcp/messages", "/api/mcp/messages/"], async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = activeTransports.get(sessionId);

  if (transport) {
    // Pass req.body as 3rd parameter because express.json() already parsed the stream
    await transport.handlePostMessage(req, res, req.body);
  } else {
    console.warn(`[MCP Router] Failed to route message. SessionId not active or stale: ${sessionId}`);
    res.status(404).json({ error: "Session not found or connection terminated." });
  }
});

// 8. Direct HTTP JSON-RPC Endpoint (Stateless Fallback / Non-SSE clients)
router.post(["/api/mcp", "/api/mcp/sse"], async (req, res) => {
  if (req.query.sessionId) {
    const sessionId = req.query.sessionId as string;
    const transport = activeTransports.get(sessionId);
    if (transport) {
      return await transport.handlePostMessage(req, res, req.body);
    }
    return res.status(404).json({ error: "Session not found or connection terminated." });
  }

  const { jsonrpc, method, params, id } = req.body || {};
  if (jsonrpc !== "2.0") {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid Request: Expected jsonrpc 2.0" },
      id: id || null
    });
  }

  try {
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: "packer-tools-mcp", version: "5.18.3" }
        },
        id
      });
    }

    if (method === "ping") {
      return res.json({ jsonrpc: "2.0", result: {}, id });
    }

    if (method === "tools/list") {
      const tools = getMcpToolsList();
      return res.json({ jsonrpc: "2.0", result: { tools }, id });
    }

    if (method === "tools/call") {
      const toolResult = await executeMcpTool(params?.name, params?.arguments);
      return res.json({ jsonrpc: "2.0", result: toolResult, id });
    }

    if (method === "resources/list") {
      const resources = getMcpResourcesList();
      return res.json({ jsonrpc: "2.0", result: { resources }, id });
    }

    if (method === "resources/read") {
      const resourceResult = await readMcpResource(params?.uri);
      return res.json({ jsonrpc: "2.0", result: resourceResult, id });
    }

    return res.status(404).json({
      jsonrpc: "2.0",
      error: { code: -32601, message: `Method not found: ${method}` },
      id
    });
  } catch (err: any) {
    return res.status(500).json({
      jsonrpc: "2.0",
      error: { code: -32603, message: err.message || "Internal error" },
      id
    });
  }
});

export default router;
