import express from "express";
import fs from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { admin, dbAdmin } from "../firebaseAdmin";
import { rateLimit } from "../middleware/security";
import { getClient, registerClient, createAuthCode, consumeAuthCode, consumeRefreshToken, issueTokens, verifyAccessToken, verifyFirebaseUser, pkceMatches } from "../mcp/oauthStore";
import { renderConsentPage, renderErrorPage, consentCsp } from "../mcp/consentPage";
import { userToolSchemas, adminToolSchemas, SCOPED_USER_TOOLS, SCOPED_ADMIN_TOOLS, executeScopedTool, getRoleLevel, McpContext } from "../mcp/tools";

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

// ---------------------------------------------------------------------------------------------
// OAuth 2.1 (authorization code + PKCE S256, dynamic client registration, rotating refresh tokens).
// Each MCP connection is bound to ONE Packer Tools user, who signs in and approves on the consent page.
// ---------------------------------------------------------------------------------------------
function baseUrlOf(req: express.Request): string {
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "packer.tools";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return `${local ? "http" : "https"}://${host.split(",")[0].trim()}`;
}

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname); // native/CLI clients
    if (u.protocol !== "https:") return false;
    const extra = (process.env.MCP_ALLOWED_REDIRECT_HOSTS || "").split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
    const host = u.hostname.toLowerCase();
    return ["claude.ai", "claude.com", ...extra].some(h => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

function oauthError(res: express.Response, status: number, error: string, description?: string) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ error, ...(description ? { error_description: description } : {}) });
}

router.get("/.well-known/oauth-protected-resource*", (req, res) => {
  const base = baseUrlOf(req);
  res.json({ resource: `${base}/api/mcp`, authorization_servers: [base], bearer_methods_supported: ["header"], scopes_supported: ["mcp:all"] });
});

router.get(["/.well-known/oauth-authorization-server*", "/.well-known/mcp-configuration", "/.well-known/openid-configuration"], (req, res) => {
  const base = baseUrlOf(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp:all"],
  });
});

// Dynamic Client Registration (RFC 7591). Public clients only; redirect URIs must be allow-listed.
router.post("/oauth/register", rateLimit("mcp-register", 20, 60 * 60 * 1000, req => req.ip || "unknown"), async (req, res) => {
  const uris = req.body?.redirect_uris;
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 5 || !uris.every((u: any) => typeof u === "string" && u.length < 500 && isAllowedRedirectUri(u))) {
    return oauthError(res, 400, "invalid_redirect_uri", "redirect_uris must be 1-5 allowed https (claude.ai / claude.com) or loopback URLs.");
  }
  const name = String(req.body?.client_name || "MCP client").replace(/[^\w .\-()]/g, "").slice(0, 60) || "MCP client";
  const client = await registerClient(name, uris);
  res.setHeader("Cache-Control", "no-store");
  return res.status(201).json({
    client_id: client.clientId, client_name: client.name, redirect_uris: client.redirectUris,
    token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
  });
});

// Consent page: user signs in with their Packer Tools account and explicitly approves.
router.get("/oauth/authorize", rateLimit("mcp-authorize", 60, 60 * 1000, req => req.ip || "unknown"), async (req, res) => {
  res.setHeader("Content-Security-Policy", consentCsp);
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  const q = req.query as Record<string, string>;
  const client = await getClient(q.client_id);
  // Never redirect to an unverified redirect_uri: show an error page instead.
  if (!client || !client.redirectUris.includes(q.redirect_uri)) {
    return res.status(400).send(renderErrorPage("Unknown application or redirect address. Reconnect the connector from Claude."));
  }
  const back = (error: string) => {
    const u = new URL(q.redirect_uri);
    u.searchParams.set("error", error);
    if (q.state) u.searchParams.set("state", q.state);
    return res.redirect(u.toString());
  };
  if (q.response_type !== "code") return back("unsupported_response_type");
  if (q.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(q.code_challenge || "")) return back("invalid_request");
  return res.send(renderConsentPage({
    clientName: client.name, clientId: client.clientId, redirectUri: q.redirect_uri,
    codeChallenge: q.code_challenge, state: String(q.state || "").slice(0, 500), scope: "mcp:all",
  }));
});

// Called by the consent page after the user clicks Allow.
router.post("/oauth/authorize/complete", rateLimit("mcp-complete", 30, 60 * 1000, req => req.ip || "unknown"), async (req, res) => {
  const origin = req.headers.origin;
  if (!origin || origin !== baseUrlOf(req)) return oauthError(res, 403, "invalid_request", "Cross-origin request rejected.");
  const b = req.body || {};
  const client = await getClient(b.client_id);
  if (!client || !client.redirectUris.includes(b.redirect_uri)) return oauthError(res, 400, "invalid_client");
  if (!/^[A-Za-z0-9_-]{43}$/.test(b.code_challenge || "")) return oauthError(res, 400, "invalid_request", "PKCE challenge required.");
  let user;
  try {
    user = await verifyFirebaseUser(String(b.idToken || ""));
  } catch {
    return oauthError(res, 401, "access_denied", "Sign-in could not be verified. Please try again.");
  }
  const code = await createAuthCode({ uid: user.uid, clientId: client.clientId, redirectUri: b.redirect_uri, codeChallenge: b.code_challenge, scope: "mcp:all" });
  console.info(`[MCP OAuth] user ${user.uid} authorized client ${client.clientId}`);
  const u = new URL(b.redirect_uri);
  u.searchParams.set("code", code);
  if (b.state) u.searchParams.set("state", String(b.state).slice(0, 500));
  return res.json({ redirect: u.toString() });
});

router.post("/oauth/token", rateLimit("mcp-token", 60, 60 * 1000, req => req.ip || "unknown"), async (req, res) => {
  const b = req.body || {};
  try {
    if (b.grant_type === "authorization_code") {
      const rec = await consumeAuthCode(String(b.code || ""));
      if (!rec || rec.clientId !== b.client_id || rec.redirectUri !== b.redirect_uri || !pkceMatches(String(b.code_verifier || ""), rec.codeChallenge)) {
        return oauthError(res, 400, "invalid_grant");
      }
      return res.set("Cache-Control", "no-store").json(await issueTokens(rec.uid, rec.clientId, rec.scope));
    }
    if (b.grant_type === "refresh_token") {
      const rec = await consumeRefreshToken(String(b.refresh_token || ""), String(b.client_id || ""));
      if (!rec) return oauthError(res, 400, "invalid_grant");
      try {
        await verifyFirebaseUserStillActive(rec.uid);
      } catch {
        return oauthError(res, 400, "invalid_grant", "Account unavailable.");
      }
      return res.set("Cache-Control", "no-store").json(await issueTokens(rec.uid, rec.clientId, rec.scope));
    }
    return oauthError(res, 400, "unsupported_grant_type");
  } catch (e: any) {
    console.error("[MCP OAuth] token error:", e.message);
    return oauthError(res, 500, "server_error");
  }
});

async function verifyFirebaseUserStillActive(uid: string) {
  const u = await admin.auth().getUser(uid);
  if (u.disabled) throw new Error("disabled");
}

// Bearer gate for every MCP transport endpoint; attaches the signed-in user's context.
async function requireMcpAuth(req: any, res: express.Response, next: express.NextFunction) {
  if (req.method === "OPTIONS") return next();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  let rec = null;
  try { rec = token ? await verifyAccessToken(token) : null; } catch (e: any) { console.error("[MCP auth]", e.message); }
  if (!rec) {
    res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${baseUrlOf(req)}/.well-known/oauth-protected-resource"`);
    return res.status(401).json({ error: "unauthorized", error_description: "Valid Bearer access token required." });
  }
  req.mcpCtx = { uid: rec.uid } as McpContext;
  next();
}
router.use(["/api/mcp/sse", "/api/mcp/messages", "/api/mcp/messages/"], requireMcpAuth);
router.use((req, res, next) => (req.path === "/api/mcp" || req.path === "/api/mcp/") ? requireMcpAuth(req, res, next) : next());

// Map to track active client SSE transports by their sessionId
const activeTransports = new Map<string, { transport: SSEServerTransport; uid: string }>();

// 1. List MCP Tools available on the server
const INFO_TOOL_SCHEMAS: any[] = [
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
        description: "Admin Capabilities Tool: Query current platform release version (v5.19.2) and full release changelog history.",
        inputSchema: {
          type: "object",
          properties: {
            version: {
              type: "string",
              description: "Optional version string to filter changelog notes for (e.g., 'v5.19.2', 'v5.19.1')."
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
const ADMIN_ONLY_INFO_TOOLS = new Set(["get_marketing_messaging_kit"]);

// Tools visible to the signed-in user: their own-data tools, docs, and (for admins) admin tools.
async function getMcpToolsList(ctx: McpContext) {
  const level = await getRoleLevel(ctx.uid);
  const isAdmin = level !== "user";
  return [
    ...userToolSchemas,
    ...(isAdmin ? adminToolSchemas.filter(t => t.name !== "update_user_plan" || level === "superAdmin") : []),
    ...INFO_TOOL_SCHEMAS.filter(t => isAdmin || !ADMIN_ONLY_INFO_TOOLS.has(t.name)),
  ];
}

// 2. Call/Execute MCP Tools
async function executeMcpTool(toolName: string, args: Record<string, any> = {}, ctx: McpContext) {
  if (SCOPED_USER_TOOLS.has(toolName) || SCOPED_ADMIN_TOOLS.has(toolName)) {
    return executeScopedTool(toolName, args, ctx);
  }
  if (ADMIN_ONLY_INFO_TOOLS.has(toolName) && (await getRoleLevel(ctx.uid)) === "user") {
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", message: "Access denied: administrators only." }) }] };
  }
  try {
    switch (toolName) {
      case "get_app_capabilities": {
        const capabilities = {
          name: "Packer Tools",
          version: "v5.19.2",
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
          content = "# Release Notes\n\nCurrent Version: v5.18.4";
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
          version: "v6.5.1",
          canonicalPositioning: "signed, bidirectional manifest",
          tagline: "Production Logistics OS for Professional Crews",
          valuePropositions: [
            "Signed, Bidirectional Manifests: Verifiable digital signatures and physical scan handoffs for every check-in, check-out, and site transfer.",
            "Multi-Industry Adaptability: Instantly adjusts terminology, icons, and workflows whether you manage camera trucks, construction rigs, athletic rosters, or auto repair bays.",
            "Visual 2D Foam CAD Organizer Designer: Design custom case inserts with magnetic snap alignment, shape grouping (Ctrl+G), box-select marquee, and high-res vector SVG/PNG CAD exports.",
            "Standalone Kiosk Mode: Fast touchscreen check-in/out with digital signatures and instant barcode verification.",
            "Systems Builder: Drag-and-drop visual connection maps for complex equipment setups and cable topologies.",
            "Offline PWA & Audit Trail: Works in remote field locations with zero data loss and automated maintenance interval calculations."
          ],
          industryAngles: {
            film: {
              audience: "1st/2nd Camera Assistants, DITs, Rental Houses, Sound Engineers",
              painPoint: "Leaving high-value lenses, wireless video transmitters, or specialized cables on location.",
              hook: "The lens didn't come back. Neither did a signature — until now.",
              keyFeatures: ["Visual Foam Organizer Designer", "Nested Kit Inclusions (Add-Ons)", "Kiosk Digital Signatures"]
            },
            construction: {
              audience: "Site Supervisors, Rigging Leads, Equipment Managers, Safety Officers",
              painPoint: "Lost heavy power tools, expired harness safety inspections, and site transfer confusion.",
              hook: "A lost $5k laser level is expensive. A missing inspection signature on a rigging harness is fatal.",
              keyFeatures: ["Maintenance Interval Audits", "QR Code Label Studio", "Bulk Site Allocation"]
            },
            automotive: {
              audience: "Shop Owners, Fleet Mechanics, Service Managers",
              painPoint: "Unaccounted diagnostic meters, pneumatic lifts, and expensive specialty wrenches.",
              hook: "Every socket set and diagnostic meter accounted for with digital mechanic handoff signatures.",
              keyFeatures: ["Tool Box Organizer", "Audit Mode", "Usage History"]
            },
            sports: {
              audience: "Athletic Directors, Equipment Managers, Team Trainers",
              painPoint: "Misplaced player jerseys, protective gear kits, and travel luggage mix-ups.",
              hook: "No more missing championship gear — signed gear manifests for every away game.",
              keyFeatures: ["Roster Assignment", "Packing Checklists", "Kiosk Check-Out"]
            },
            medical: {
              audience: "EMS Field Techs, Mobile Clinic Supervisors, Disaster Response Teams",
              painPoint: "Unverified field medical kits, missing sterilization logs, and expired supplies.",
              hook: "Life-saving diagnostic equipment tracked with bi-directional, verifiable chain-of-custody signatures.",
              keyFeatures: ["Passports & Public Share Links", "Maintenance Interval Logs", "Barcode Scanning"]
            },
            logistics: {
              audience: "Warehouse Managers, Cargo Handlers, Operations Directors",
              painPoint: "Inaccurate spreadsheet inventory, slow check-outs, and multi-tenant department chaos.",
              hook: "Zero lost freight ambiguity with real-time digital signature manifests.",
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
const ADMIN_ONLY_RESOURCES = new Set(["packer://marketing-playbook", "packer://agent-rules"]);
function getMcpResourcesList(isAdmin: boolean) {
  return ([
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
        description: "Official release notes, current build version (v5.19.2), and feature changelog history."
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
  ] as any[]).filter(r => isAdmin || !ADMIN_ONLY_RESOURCES.has(r.uri));
}

// 4. Read MCP Resources
async function readMcpResource(uri: string, ctx: McpContext) {
  if (ADMIN_ONLY_RESOURCES.has(uri) && (await getRoleLevel(ctx.uid)) === "user") {
    throw new Error("Resource not available.");
  }
  if (uri === "packer://app-capabilities") {
    const capabilities = {
      name: "Packer Tools",
      version: "v5.19.2",
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
      version: "v5.19.2",
      canonicalPositioning: "signed, bidirectional manifest",
      tagline: "Production Logistics OS for Professional Crews",
      mission: "To eliminate lost equipment, gear chaos, and spreadsheet downtime across high-consequence industries.",
      valuePropositions: [
        "Signed, Bidirectional Manifests: Verifiable digital signatures and physical scan handoffs for every check-in, check-out, and site transfer.",
        "Multi-Industry Adaptability: Instantly adjusts terminology, icons, and workflows whether you manage camera trucks, construction rigs, athletic rosters, or auto repair bays.",
        "Visual 2D Foam CAD Organizer Designer: Design custom case inserts with magnetic snap alignment, shape grouping (Ctrl+G), box-select marquee, and high-res vector SVG/PNG CAD exports.",
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
      content = "# Release Notes\n\nCurrent Version: v6.5.1";
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
      const uid = ctx.uid; // the signed-in user's own library only
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
function createMcpServer(ctx: McpContext): Server {
  const mcpServer = new Server(
    {
      name: "packer-tools-mcp",
      version: "6.5.1",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: await getMcpToolsList(ctx) };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await executeMcpTool(request.params.name, request.params.arguments || {}, ctx);
  });

  mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: getMcpResourcesList((await getRoleLevel(ctx.uid)) !== "user") };
  });

  mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return await readMcpResource(request.params.uri, ctx);
  });

  return mcpServer;
}

// 6. Legacy SSE transport (kept for older clients). Each stream is bound to the token's user.
router.get(["/api/mcp/sse"], async (req: any, res) => {
  const ctx: McpContext = req.mcpCtx;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const transport = new SSEServerTransport("/api/mcp/messages", res);
  const sessionId = transport.sessionId;
  activeTransports.set(sessionId, { transport, uid: ctx.uid });

  // Keep proxies (Cloud Run) from closing an idle stream
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    activeTransports.delete(sessionId);
  });

  await createMcpServer(ctx).connect(transport);
});

router.post(["/api/mcp/messages", "/api/mcp/messages/"], async (req: any, res) => {
  const entry = activeTransports.get(String(req.query.sessionId || ""));
  // The session must belong to the same user as the bearer token
  if (!entry || entry.uid !== req.mcpCtx.uid) {
    return res.status(404).json({ error: "Session not found or connection terminated." });
  }
  await entry.transport.handlePostMessage(req, res, req.body);
});

// 7. Streamable HTTP transport (current MCP standard), stateless: one server + transport per request.
router.post(["/api/mcp", "/api/mcp/"], async (req: any, res) => {
  try {
    const server = createMcpServer(req.mcpCtx);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error("[MCP Streamable HTTP] request failed:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

// Stateless mode has no server-initiated stream or sessions to delete.
router.all(["/api/mcp", "/api/mcp/"], (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).end();
  res.setHeader("Allow", "POST");
  return res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Use POST (Streamable HTTP), or /api/mcp/sse for legacy SSE." }, id: null });
});

export default router;
