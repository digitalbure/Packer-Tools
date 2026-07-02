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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global Middlewares
  // Note: Webhook routers internally read and parse raw body, so we place JSON parser AFTER webhook routes 
  // or handle parsing contextually.
  
  // Webhooks first to prevent body parser interference with signature verifications
  app.use(webhooksRouter);

  // Parse remaining JSON requests
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Mount modular route namespaces
  app.use(healthRouter);
  app.use(billingRouter);
  app.use(aiRouter);
  app.use(emailRouter);
  app.use(developerRouter);
  app.use(googleChatRouter);
  app.use(mcpRouter);
  app.use(shareRouter);

  // Vite development middleware vs Static Production bundle
  if (process.env.NODE_ENV !== "production") {
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
