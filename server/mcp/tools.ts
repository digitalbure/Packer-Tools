import crypto from "crypto";
import { admin, dbAdmin } from "../firebaseAdmin";
import { getServerPlan, sanitizeSeats } from "../utils/plans";

/** Every scoped tool runs as the signed-in user. There is no `uid` argument anywhere: identity comes from the OAuth token. */
export interface McpContext { uid: string }

const ok = (data: unknown) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (message: string) => ({ isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", message }, null, 2) }] });

const GEAR_STATUS = ["available", "in_use", "maintenance", "retired", "missing"];
const GEAR_CONDITION = ["new", "good", "fair", "poor"];
const DEFAULT_GEAR_LIMITS: Record<string, number> = { free: 25, pro: 500, enterprise: 10000 };

// ---------- role checks (fresh on every admin call; never trusted from the token) ----------
export async function getRoleLevel(uid: string): Promise<"user" | "admin" | "superAdmin"> {
  try {
    const u = await admin.auth().getUser(uid);
    if (u.disabled) return "user";
    const claim = (u.customClaims || {}).role;
    if (claim === "superAdmin") return "superAdmin";
    if (claim === "admin") return "admin";
  } catch { /* fall through to Firestore */ }
  const d = (await dbAdmin.collection("users").doc(uid).get()).data();
  if (!d) return "user";
  if (d.isSuperAdmin === true) return "superAdmin";
  if (d.role === "admin") return "admin";
  return "user";
}

const str = (v: any, max: number, fallback = "") => (typeof v === "string" ? v.trim().slice(0, max) : fallback);
const num = (v: any, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

async function gearLimitFor(uid: string): Promise<number | null> {
  const user = (await dbAdmin.collection("users").doc(uid).get()).data() || {};
  const planId = String(user.plan || "free");
  const planDoc = (await dbAdmin.collection("plans").doc(planId).get()).data();
  if (planDoc && typeof planDoc.maxGearItems === "number") return planDoc.maxGearItems;
  return DEFAULT_GEAR_LIMITS[planId] ?? null;
}

async function orgIdOf(uid: string): Promise<string> {
  const d = (await dbAdmin.collection("users").doc(uid).get()).data();
  return d && typeof d.orgId === "string" ? d.orgId : "";
}

const PUBLIC_USER_FIELDS = ["uid", "email", "displayName", "plan", "role", "subscriptionStatus", "extraSeats", "trialActive",
  "trialEndDate", "orgId", "createdAt", "updatedAt", "manualPaymentPending", "manualPaymentRequestedPlan"];
const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter(k => o && o[k] !== undefined).map(k => [k, o[k]]));

// ---------- schemas ----------
export const userToolSchemas = [
  {
    name: "get_account_summary",
    description: "Show the signed-in user's plan, gear usage against their plan limit, and counts of lists and inventory sheets.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_gear",
    description: "List and search the signed-in user's gear library.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter (e.g. 'Camera', 'Lens', 'Audio', 'Lighting', 'Support')." },
        search: { type: "string", description: "Optional text matching name, brand, model, serial number or description." },
        status: { type: "string", enum: GEAR_STATUS },
        limit: { type: "number", description: "Max items to return (1-200, default 50)." },
      },
    },
  },
  {
    name: "add_gear_item",
    description: "Add a piece of equipment to the signed-in user's gear library (respects the plan's gear limit).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Item name (required, max 99 chars)." },
        brand: { type: "string" }, model: { type: "string" }, modelNumber: { type: "string" }, serialNumber: { type: "string" },
        primaryCategory: { type: "string" },
        quantity: { type: "number", description: "Whole number >= 1." },
        price: { type: "number" },
        condition: { type: "string", enum: GEAR_CONDITION },
        status: { type: "string", enum: GEAR_STATUS },
        notes: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_gear_item",
    description: "Update fields on one of the signed-in user's gear items (status, condition, notes, quantity, price, name, category).",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Gear item ID from list_gear." },
        name: { type: "string" }, status: { type: "string", enum: GEAR_STATUS }, condition: { type: "string", enum: GEAR_CONDITION },
        notes: { type: "string" }, quantity: { type: "number" }, price: { type: "number" }, primaryCategory: { type: "string" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "list_packing_lists",
    description: "List the signed-in user's packing lists (owned or shared with them). Read-only.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max lists (1-100, default 50)." } } },
  },
  {
    name: "get_packing_list",
    description: "Get one packing list and its items. Only lists the user owns or collaborates on. Read-only.",
    inputSchema: { type: "object", properties: { listId: { type: "string" } }, required: ["listId"] },
  },
  {
    name: "list_inventory_sheets",
    description: "List inventory sheets the signed-in user owns or that belong to their organization.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_inventory_sheet_items",
    description: "Get the items on one inventory sheet the user owns or that belongs to their organization.",
    inputSchema: { type: "object", properties: { sheetId: { type: "string" } }, required: ["sheetId"] },
  },
];

export const adminToolSchemas = [
  {
    name: "lookup_user",
    description: "Admin: look up a user's account profile by email or UID (sensitive fields such as API keys are never returned).",
    inputSchema: { type: "object", properties: { email: { type: "string" }, uid: { type: "string" } } },
  },
  {
    name: "list_organizations",
    description: "Admin: list organizations.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "1-100, default 20." } } },
  },
  {
    name: "get_system_telemetry",
    description: "Admin: platform counts (users, organizations, inventories).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_user_plan",
    description: "Super-admin only: change a user's plan, extra seats or subscription status. Every change is written to the admin audit log.",
    inputSchema: {
      type: "object",
      properties: {
        uid: { type: "string" },
        plan: { type: "string", enum: ["free", "pro", "enterprise"] },
        extraSeats: { type: "number" },
        subscriptionStatus: { type: "string", enum: ["active", "trialing", "past_due", "canceled", "unpaid"] },
      },
      required: ["uid"],
    },
  },
];

export const SCOPED_USER_TOOLS = new Set(userToolSchemas.map(t => t.name));
export const SCOPED_ADMIN_TOOLS = new Set(adminToolSchemas.map(t => t.name));

// ---------- execution ----------
export async function executeScopedTool(name: string, args: Record<string, any>, ctx: McpContext) {
  const uid = ctx.uid;
  try {
    if (SCOPED_ADMIN_TOOLS.has(name)) {
      const level = await getRoleLevel(uid);
      if (level === "user") return fail("Access denied: this tool requires an administrator account.");
      if (name === "update_user_plan" && level !== "superAdmin") return fail("Access denied: changing plans requires a super-admin.");
      return await executeAdminTool(name, args, uid);
    }

    switch (name) {
      case "get_account_summary": {
        const user = (await dbAdmin.collection("users").doc(uid).get()).data() || {};
        const gearCount = (await dbAdmin.collection("users").doc(uid).collection("gearLibrary").count().get()).data().count;
        const listCount = (await dbAdmin.collection("packingLists").where("ownerId", "==", uid).count().get()).data().count;
        const sheetCount = (await dbAdmin.collection("inventories").where("ownerId", "==", uid).count().get()).data().count;
        return ok({
          status: "success",
          account: pick({ ...user, uid }, PUBLIC_USER_FIELDS),
          usage: { gearItems: gearCount, gearLimit: await gearLimitFor(uid), packingLists: listCount, inventorySheets: sheetCount },
        });
      }

      case "list_gear": {
        const limit = Math.floor(num(args.limit, 1, 200, 50));
        let q: admin.firestore.Query = dbAdmin.collection("users").doc(uid).collection("gearLibrary");
        const category = str(args.category, 60);
        if (category) q = q.where("primaryCategory", "==", category);
        const status = str(args.status, 20);
        if (status && GEAR_STATUS.includes(status)) q = q.where("status", "==", status);
        const search = str(args.search, 100).toLowerCase();
        // With a text search we must scan client-side, so read a bounded window
        const snap = await q.limit(search ? 1000 : limit).get();
        let items: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (search) {
          items = items.filter(i => [i.name, i.brand, i.model, i.serialNumber, i.description].some(f => String(f || "").toLowerCase().includes(search))).slice(0, limit);
        }
        return ok({ status: "success", totalCount: items.length, items });
      }

      case "add_gear_item": {
        const itemName = str(args.name, 99);
        if (!itemName) return fail("'name' is required (max 99 characters).");
        const col = dbAdmin.collection("users").doc(uid).collection("gearLibrary");
        const limit = await gearLimitFor(uid);
        if (limit !== null) {
          const count = (await col.count().get()).data().count;
          if (count >= limit) return fail(`Gear limit reached for your plan (${limit} items). Upgrade to add more.`);
        }
        const condition = GEAR_CONDITION.includes(args.condition) ? args.condition : "good";
        const status = GEAR_STATUS.includes(args.status) ? args.status : "available";
        const category = str(args.primaryCategory, 60, "Other") || "Other";
        const now = new Date().toISOString();
        const item = {
          ownerId: uid,
          name: itemName,
          assetTag: `PT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          brand: str(args.brand, 100), model: str(args.model, 100), modelNumber: str(args.modelNumber, 100),
          serialNumber: str(args.serialNumber, 100),
          primaryCategory: category, category,
          quantity: Math.floor(num(args.quantity, 1, 100000, 1)),
          price: num(args.price, 0, 1e9, 0),
          condition, status, notes: str(args.notes, 2000),
          createdAt: now, updatedAt: now,
          lastMaintenanceDate: now.split("T")[0], maintenanceIntervalDays: 90,
        };
        const ref = await col.add(item);
        return ok({ status: "success", message: "Item added to your gear library.", itemId: ref.id, item });
      }

      case "update_gear_item": {
        const itemId = str(args.itemId, 128);
        if (!itemId || itemId.includes("/")) return fail("Valid 'itemId' is required.");
        const ref = dbAdmin.collection("users").doc(uid).collection("gearLibrary").doc(itemId);
        const snap = await ref.get();
        if (!snap.exists) return fail("Gear item not found in your library.");
        const patch: Record<string, any> = {};
        if (args.name !== undefined) { const n = str(args.name, 99); if (!n) return fail("'name' cannot be empty."); patch.name = n; }
        if (args.status !== undefined) { if (!GEAR_STATUS.includes(args.status)) return fail("Invalid status."); patch.status = args.status; }
        if (args.condition !== undefined) { if (!GEAR_CONDITION.includes(args.condition)) return fail("Invalid condition."); patch.condition = args.condition; }
        if (args.notes !== undefined) patch.notes = str(args.notes, 2000);
        if (args.quantity !== undefined) patch.quantity = Math.floor(num(args.quantity, 1, 100000, 1));
        if (args.price !== undefined) patch.price = num(args.price, 0, 1e9, 0);
        if (args.primaryCategory !== undefined) { patch.primaryCategory = str(args.primaryCategory, 60, "Other"); patch.category = patch.primaryCategory; }
        if (Object.keys(patch).length === 0) return fail("No valid fields to update.");
        patch.updatedAt = new Date().toISOString();
        await ref.update(patch);
        return ok({ status: "success", itemId, updated: patch });
      }

      case "list_packing_lists": {
        const limit = Math.floor(num(args.limit, 1, 100, 50));
        const owned = await dbAdmin.collection("packingLists").where("ownerId", "==", uid).limit(limit).get();
        const shared = await dbAdmin.collection("packingLists").where("collaboratorIds", "array-contains", uid).limit(limit).get();
        const seen = new Set<string>();
        const lists: any[] = [];
        for (const d of [...owned.docs, ...shared.docs]) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          const x = d.data();
          lists.push({ id: d.id, name: x.name, description: x.description, status: x.status, ownerId: x.ownerId, isOwner: x.ownerId === uid, updatedAt: x.updatedAt });
        }
        return ok({ status: "success", totalCount: lists.length, lists: lists.slice(0, limit) });
      }

      case "get_packing_list": {
        const listId = str(args.listId, 128);
        if (!listId || listId.includes("/")) return fail("Valid 'listId' is required.");
        const ref = dbAdmin.collection("packingLists").doc(listId);
        const snap = await ref.get();
        const data = snap.data();
        const allowed = !!data && (data.ownerId === uid || (Array.isArray(data.collaboratorIds) && data.collaboratorIds.includes(uid)));
        if (!allowed) return fail("Packing list not found."); // same message for missing and forbidden
        const items = await ref.collection("items").limit(500).get();
        return ok({ status: "success", list: { id: listId, ...data }, itemCount: items.size, items: items.docs.map(d => ({ id: d.id, ...d.data() })) });
      }

      case "list_inventory_sheets": {
        const orgId = await orgIdOf(uid);
        const queries = [dbAdmin.collection("inventories").where("ownerId", "==", uid).get()];
        if (orgId) queries.push(dbAdmin.collection("inventories").where("orgId", "==", orgId).get());
        const seen = new Set<string>();
        const sheets: any[] = [];
        for (const snap of await Promise.all(queries)) {
          for (const d of snap.docs) if (!seen.has(d.id)) { seen.add(d.id); sheets.push({ id: d.id, ...d.data() }); }
        }
        return ok({ status: "success", totalCount: sheets.length, sheets });
      }

      case "get_inventory_sheet_items": {
        const sheetId = str(args.sheetId, 128);
        if (!sheetId || sheetId.includes("/")) return fail("Valid 'sheetId' is required.");
        const ref = dbAdmin.collection("inventories").doc(sheetId);
        const data = (await ref.get()).data();
        const orgId = await orgIdOf(uid);
        const allowed = !!data && (data.ownerId === uid || (!!orgId && data.orgId === orgId));
        if (!allowed) return fail("Inventory sheet not found.");
        const snap = await ref.collection("items").limit(1000).get();
        return ok({ status: "success", sheetId, totalCount: snap.size, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
    }
    return fail(`Unknown tool: ${name}`);
  } catch (e: any) {
    console.error(`[MCP tool ${name}]`, e.message);
    return fail("The tool failed to run. Please try again.");
  }
}

async function executeAdminTool(name: string, args: Record<string, any>, actorUid: string) {
  switch (name) {
    case "lookup_user": {
      const email = str(args.email, 254), uid = str(args.uid, 128);
      if (!email && !uid) return fail("Provide 'email' or 'uid'.");
      let doc: FirebaseFirestore.DocumentSnapshot | undefined;
      if (uid && !uid.includes("/")) doc = await dbAdmin.collection("users").doc(uid).get();
      else {
        const s = await dbAdmin.collection("users").where("email", "==", email).limit(1).get();
        doc = s.docs[0];
      }
      if (!doc || !doc.exists) return ok({ status: "not_found" });
      return ok({ status: "success", user: pick({ ...doc.data(), uid: doc.id }, PUBLIC_USER_FIELDS) });
    }
    case "list_organizations": {
      const snap = await dbAdmin.collection("organizations").limit(Math.floor(num(args.limit, 1, 100, 20))).get();
      return ok({ status: "success", totalCount: snap.size, organizations: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    case "get_system_telemetry": {
      const c = async (n: string) => (await dbAdmin.collection(n).count().get()).data().count;
      return ok({ status: "success", timestamp: new Date().toISOString(), metrics: { totalUsers: await c("users"), totalOrganizations: await c("organizations"), totalInventories: await c("inventories") } });
    }
    case "update_user_plan": {
      const uid = str(args.uid, 128);
      if (!uid || uid.includes("/")) return fail("Valid 'uid' is required.");
      const ref = dbAdmin.collection("users").doc(uid);
      const before = (await ref.get()).data();
      if (!before) return fail("User not found.");
      const patch: Record<string, any> = {};
      if (args.plan !== undefined) {
        const plan = await getServerPlan(args.plan);
        if (!plan) return fail("Unknown plan.");
        patch.plan = plan.id;
      }
      if (args.extraSeats !== undefined) patch.extraSeats = sanitizeSeats(args.extraSeats);
      if (args.subscriptionStatus !== undefined) {
        if (!["active", "trialing", "past_due", "canceled", "unpaid"].includes(args.subscriptionStatus)) return fail("Invalid subscriptionStatus.");
        patch.subscriptionStatus = args.subscriptionStatus;
      }
      if (Object.keys(patch).length === 0) return fail("Nothing to change.");
      patch.updatedAt = new Date().toISOString();
      patch.updatedBy = `mcp:${actorUid}`;
      await ref.update(patch);
      await dbAdmin.collection("adminAuditLogs").add({
        actorUid, action: "mcp.update_user_plan", targetUid: uid, at: new Date().toISOString(),
        before: pick(before, ["plan", "extraSeats", "subscriptionStatus"]), after: pick(patch, ["plan", "extraSeats", "subscriptionStatus"]),
      });
      return ok({ status: "success", uid, applied: pick(patch, ["plan", "extraSeats", "subscriptionStatus"]) });
    }
  }
  return fail(`Unknown tool: ${name}`);
}
