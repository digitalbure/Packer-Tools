import express from "express";

const router = express.Router();

// Proxy fetching Google Chat spaces
router.get("/api/googlechat/spaces", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  try {
    const response = await fetch("https://chat.googleapis.com/v1/spaces", {
      headers: {
        "Authorization": authHeader,
      },
    });

    const status = response.status;
    const contentType = response.headers.get("content-type") || "";
    let data: any = null;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: { message: text.substring(0, 500) || `HTTP Error ${status}` } };
    }

    if (!response.ok) {
      return res.status(status).json({
        error: data.error?.message || `Failed to fetch spaces from Google Chat API (Status ${status})`,
        details: data
      });
    }

    return res.json(data);
  } catch (err: any) {
    console.error("Google Chat Spaces Proxy Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error during proxy request" });
  }
});

function extractSpaceIdFromInput(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const pathname = url.pathname;
      const segments = pathname.split("/").filter(Boolean);
      
      // Look for explicit "spaces" keyword segment
      const spacesIndex = segments.indexOf("spaces");
      if (spacesIndex !== -1 && spacesIndex + 1 < segments.length) {
        return `spaces/${segments[spacesIndex + 1]}`;
      }
      
      // Look for explicit "chat" keyword segment
      const chatIndex = segments.indexOf("chat");
      if (chatIndex !== -1 && chatIndex + 1 < segments.length) {
        return `spaces/${segments[chatIndex + 1]}`;
      }

      // Look for explicit "room" keyword segment
      const roomIndex = segments.indexOf("room");
      if (roomIndex !== -1 && roomIndex + 1 < segments.length) {
        return `spaces/${segments[roomIndex + 1]}`;
      }

      // Fallback: return the last segment
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        return `spaces/${lastSegment}`;
      }
    } catch (e) {
      // If parsing fails, fall back to default cleaning
    }
  }

  let cleaned = trimmed.replace(/^\/+|\/+$/g, "");
  if (cleaned && !cleaned.startsWith("spaces/")) {
    cleaned = `spaces/${cleaned}`;
  }
  return cleaned;
}

// Proxy sending Google Chat messages
router.post("/api/googlechat/message", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const { spaceName, text } = req.body;

  if (!spaceName) {
    return res.status(400).json({ error: "Missing spaceName in request body" });
  }
  if (!text) {
    return res.status(400).json({ error: "Missing text in request body" });
  }

  const isWebhook = spaceName.trim().startsWith("https://chat.googleapis.com/");

  if (!isWebhook && !authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  try {
    let response: Response;
    let status: number;
    let contentType: string;
    let data: any = null;

    if (isWebhook) {
      // Direct Webhook dispatch - no OAuth headers required!
      const webhookUrl = spaceName.trim();
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      status = response.status;
      contentType = response.headers.get("content-type") || "";
    } else {
      // Standard API OAuth dispatch
      const cleanedSpaceName = extractSpaceIdFromInput(spaceName);
      const url = `https://chat.googleapis.com/v1/${cleanedSpaceName}/messages`;

      response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": authHeader!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      status = response.status;
      contentType = response.headers.get("content-type") || "";
    }

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const textResponse = await response.text();
      data = { error: { message: textResponse.substring(0, 500) || `HTTP Error ${status}` } };
    }

    if (!response.ok) {
      let errorMessage = data.error?.message || `Failed to send message via Google Chat API (Status ${status})`;
      
      // Enhance common Workspace API errors with suggestions
      if (errorMessage.includes("Google Chat app not found") || errorMessage.includes("Chat app not found")) {
        errorMessage = "Google Chat app not found. To resolve this, you can either: 1) Enable and configure a Chat App in the Google Cloud Console for your OAuth project, OR 2) Create an 'Incoming Webhook' in your Google Chat space and paste that Webhook URL as your manual space setting (Highly Recommended as it bypasses GCP app configuration completely!).";
      }

      return res.status(status).json({
        error: errorMessage,
        details: data
      });
    }

    return res.json(data);
  } catch (err: any) {
    console.error("Google Chat Send Message Proxy Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error during message delivery" });
  }
});

export default router;
