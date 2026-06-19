import admin from "firebase-admin";
import path from "path";
import fs from "fs";

let firebaseAdminProjectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-8af96458-c1d9-4cdf-9c9a-815dee7f9c70";
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.projectId) {
      firebaseAdminProjectId = config.projectId;
      console.log("[Firebase Admin] Loaded projectId from firebase-applet-config.json:", firebaseAdminProjectId);
    }
  }
} catch (e: any) {
  console.warn("[Firebase Admin] Failed static configuration loading, using fallback projectId:", e.message);
}

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseAdminProjectId
  });
}
const dbAdmin = admin.firestore();

export { admin, dbAdmin };
