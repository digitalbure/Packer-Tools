import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Import modular routes
import healthRouter from "./routes/health";
import billingRouter from "./routes/billing";
import webhooksRouter from "./routes/webhooks";
import aiRouter from "./routes/ai";
import emailRouter from "./routes/email";
import developerRouter from "./routes/developer";
import googleChatRouter from "./routes/googleChat";
import mcpRouter from "./routes/mcp";
import shareRouter from "./routes/share";
import labelsRouter from "./routes/labels";
import { securityHeaders, rateLimit } from "./middleware/security";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Behind Cloud Run / a load balancer: trust one proxy hop so req.ip and rate limits use the real client IP
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(securityHeaders);
  // Coarse per-IP ceiling on the API surface (per-route limits are stricter)
  app.use("/api", rateLimit("api-global", 600, 60 * 1000, (req) => req.ip || "unknown"));

  // Global Middlewares
  // Note: Webhook routers internally read and parse raw body, so we place JSON parser AFTER webhook routes 
  // or handle parsing contextually.
  
  // Webhooks first to prevent body parser interference with signature verifications
  app.use(webhooksRouter);

  // Parse remaining JSON requests
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // Mount modular route namespaces
  app.use(healthRouter);
  app.use(billingRouter);
  app.use(aiRouter);
  app.use(emailRouter);
  app.use(developerRouter);
  app.use(googleChatRouter);
  app.use(mcpRouter);
  app.use(shareRouter);
  app.use(labelsRouter);

  // Vite development middleware vs Static Production bundle
  if (process.env.NODE_ENV !== "production") { // NOTE: set NODE_ENV=production in deployed environments
    console.info("[Vite Developer Engine] Orchestrating server middleware pipelines...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.info("[Production Bundle Console] Mounting pre-compiled assets directories...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // Explicitly return 404 for missing static assets instead of serving index.html
    app.use("/assets", (req, res) => {
      res.status(404).send("Asset not found");
    });

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Packer Network Server] Service listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
