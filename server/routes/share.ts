import express from "express";
import fs from "fs";
import path from "path";
import { dbAdmin } from "../firebaseAdmin";

const router = express.Router();

function getIndexHtmlPath() {
  const prodPath = path.join(process.cwd(), "dist", "index.html");
  if (fs.existsSync(prodPath)) {
    return prodPath;
  }
  return path.join(process.cwd(), "index.html");
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function injectOgTags(html: string, title: string, description: string, imageUrl: string, url: string): string {
  const entertainmentPlaceholder = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600";
  const finalImage = imageUrl || entertainmentPlaceholder;

  const escapedTitle = escapeHtml(title);
  const escapedDesc = escapeHtml(description);
  const escapedImg = escapeHtml(finalImage);
  const escapedUrl = escapeHtml(url);

  // Remove any existing title tag
  let cleanHtml = html.replace(/<title>.*?<\/title>/gi, "");

  const ogTags = `
    <title>${escapedTitle}</title>
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDesc}" />
    <meta property="og:image" content="${escapedImg}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapedUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDesc}" />
    <meta name="twitter:image" content="${escapedImg}" />
  `;

  // Inject right after <head>
  if (cleanHtml.includes("<head>")) {
    return cleanHtml.replace("<head>", `<head>${ogTags}`);
  }
  return ogTags + cleanHtml;
}

// Intercept gear path
router.get("/gear/:id", async (req, res, next) => {
  const { id } = req.params;
  const ownerId = req.query.owner as string;

  let title = "Packer Tools Gear Item";
  let description = "Check out this gear item on Packer Tools!";
  let imageUrl = ""; // fallback managed in injectOgTags

  try {
    let itemData: any = null;

    if (ownerId) {
      const docRef = dbAdmin.doc(`users/${ownerId}/gearLibrary/${id}`);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        itemData = docSnap.data();
      }
    }

    // Collection Group fallback if not found by specific owner
    if (!itemData) {
      try {
        const gearQuery = dbAdmin.collectionGroup('gearLibrary').where('id', '==', id);
        const querySnap = await gearQuery.get();
        if (!querySnap.empty) {
          itemData = querySnap.docs[0].data();
        }
      } catch (cgErr) {
        console.warn("Collection group query failed or index missing:", cgErr);
      }
    }

    if (itemData) {
      const brandStr = itemData.brand ? `${itemData.brand} ` : "";
      title = `${brandStr}${itemData.name || "Untitled Gear Item"}`;
      description = itemData.description || `Certified product asset: ${itemData.assetTag || id}. Certified under Packer Tools.`;
      if (itemData.photoUrls && itemData.photoUrls.length > 0) {
        imageUrl = itemData.photoUrls[0];
      }
    }
  } catch (err) {
    console.warn("Error fetching gear for OG tags:", err);
  }

  try {
    const htmlPath = getIndexHtmlPath();
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, "utf8");
      const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      html = injectOgTags(html, title, description, imageUrl, fullUrl);
      return res.send(html);
    }
  } catch (err) {
    console.error("Error reading index.html in share route:", err);
  }

  next();
});

// Intercept packing list paths
const handleListShare = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { id } = req.params;

  let title = "Packer Tools Packing List";
  let description = "Check out this packing list on Packer Tools!";
  let imageUrl = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=600"; // Packing/travel fallback placeholder

  try {
    const docRef = dbAdmin.doc(`packingLists/${id}`);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data) {
        title = data.name || "Untitled Packing List";
        description = data.description || `Check out this packing list with ${data.itemsCount || 0} items!`;
        if (data.coverUrl) {
          imageUrl = data.coverUrl;
        } else if (data.photoUrls && data.photoUrls.length > 0) {
          imageUrl = data.photoUrls[0];
        }
      }
    }
  } catch (err) {
    console.warn("Error fetching packing list for OG tags:", err);
  }

  try {
    const htmlPath = getIndexHtmlPath();
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, "utf8");
      const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      html = injectOgTags(html, title, description, imageUrl, fullUrl);
      return res.send(html);
    }
  } catch (err) {
    console.error("Error reading index.html in share route:", err);
  }

  next();
};

router.get("/p/:id", handleListShare);
router.get("/list/:id", handleListShare);

export default router;
