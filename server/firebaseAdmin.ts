import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

// The app uses a NAMED Firestore database (see firebase-applet-config.json); the project has no "(default)" database.
let firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || "";
let firebaseAdminProjectId = process.env.VITE_FIREBASE_PROJECT_ID || "ai-studio-8af96458-c1d9-4cdf-9c9a-815dee7f9c70";
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!firestoreDatabaseId && config.firestoreDatabaseId) {
      firestoreDatabaseId = config.firestoreDatabaseId;
    }
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
const dbAdmin = firestoreDatabaseId ? getFirestore(admin.app(), firestoreDatabaseId) : getFirestore(admin.app());
console.log("[Firebase Admin] Firestore database:", firestoreDatabaseId || "(default)");

export { admin, dbAdmin };
