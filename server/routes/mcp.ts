import express from "express";
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

// Define a central Model Context Protocol Server
const mcpServer = new Server(
  {
    name: "packer-tools-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Map to track active client SSE transports by their sessionId
const activeTransports = new Map<string, SSEServerTransport>();

// 1. List MCP Tools available on the server
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_gear",
        description: "List and search all gear/assets stored in the Packer Tools library for a given user.",
        inputSchema: {
          type: "object",
          properties: {
            uid: {
              type: "string",
              description: "The Firebase user ID (UID) of the operator. Defaults to 'demo-super-admin' if not provided."
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
          }
        }
      },
      {
        name: "add_gear_item",
        description: "Add or register a brand new equipment/gear asset into the user's Packer Tools library.",
        inputSchema: {
          type: "object",
          properties: {
            uid: {
              type: "string",
              description: "The Firebase user ID (UID) of the operator. Defaults to 'demo-super-admin' if not provided."
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
          required: ["name"]
        }
      },
      {
        name: "list_inventory_sheets",
        description: "List all active custom inventory checklists/sheets in the workspace.",
        inputSchema: {
          type: "object",
          properties: {
            uid: {
              type: "string",
              description: "The Firebase user ID (UID) of the operator. Defaults to 'demo-super-admin' if not provided."
            }
          }
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
      }
    ]
  };
});

// 2. Call/Execute MCP Tools
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments || {};

  try {
    switch (toolName) {
      case "list_gear": {
        const uid = (args.uid as string) || "demo-super-admin";
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
        const uid = (args.uid as string) || "demo-super-admin";
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
        const uid = (args.uid as string) || "demo-super-admin";
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
});

// 3. List MCP Resources
mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "packer://gear-summary",
        name: "Gear Library Summary Dashboard",
        mimeType: "text/markdown",
        description: "A summary dashboard of the gear library metrics, maintenance states, and health overview."
      }
    ]
  };
});

// 4. Read MCP Resources
mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

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
});

// 5. Mount SSE Endpoints
router.get("/api/mcp/sse", async (req, res) => {
  console.info("[MCP Router] Initializing new client SSE connection stream...");
  const transport = new SSEServerTransport("/api/mcp/messages", res);
  const sessionId = transport.sessionId;
  
  activeTransports.set(sessionId, transport);
  console.info(`[MCP Router] Registered active session sessionID: ${sessionId}`);

  req.on("close", () => {
    console.info(`[MCP Router] Client closed stream. Discarding sessionId: ${sessionId}`);
    activeTransports.delete(sessionId);
  });

  await mcpServer.connect(transport);
});

router.post("/api/mcp/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = activeTransports.get(sessionId);

  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    console.warn(`[MCP Router] Failed to route message. SessionId not active or stale: ${sessionId}`);
    res.status(404).json({ error: "Session not found or connection terminated." });
  }
});

export default router;
