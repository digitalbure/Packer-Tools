# Super Admin Setup Guide

This document describes how to securely provision the first **Super Admin** role in Packer Tools using Firebase Authentication Custom Claims. It outlines the process of assigning claims, verifying them across frontend and backend boundaries, and highlights critical security boundaries for credential safety.

---

## 🔑 Assigning the First Super Admin Claim

Firebase Authentication custom claims are cryptographically signed tokens stored inside a user's ID token. Because these claims are managed server-side, they cannot be modified by the client, making them ideal for secure role-based access control (RBAC).

To assign the `superAdmin` role to a user, you must run the **Firebase Admin SDK** within a secure environment (such as a local administrative utility, backend hook, or Cloud Function).

### Node.js Admin Script Example

Create a temporary local administration script (e.g., `set-super-admin.ts`) to configure the target user:

```javascript
import admin from "firebase-admin";

// Initialize the Firebase Admin SDK
// Typically uses service account credentials under process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Assigns the superAdmin role to a target user UID
 * @param uid The exact Firebase Authentication UID of the target user
 */
async function grantSuperAdmin(uid) {
  try {
    // Set custom user claims
    await admin.auth().setCustomUserClaims(uid, { role: "superAdmin" });
    console.log(`[Success] Custom claim { role: "superAdmin" } assigned to UID: ${uid}`);
    
    // Retrieve user and print claims to verify
    const user = await admin.auth().getUser(uid);
    console.log("Current Custom Claims:", user.customClaims);
  } catch (error) {
    console.error("[Error] Failed to set superAdmin claims:", error);
  }
}

// Replace with the recipient's target user UID
const targetUid = "TARGET_USER_UID_HERE";
grantSuperAdmin(targetUid);
```

> **Note**: After running this command, the target user must sign out and sign back in (or force a token refresh on the client) for the new custom claim to be synced and active inside their session ID token.

---

## 🔎 Verifying Super Admin Claims

Once assigned, the custom claim must be validated across all application layers to secure data transit and layout rendering.

### 1. Server-Side Middleware & API Routes
In Express backend routers, decode and verify the authorization header token using the Firebase Admin SDK:

```typescript
import { Request, Response, NextFunction } from "express";
import { admin } from "../firebaseAdmin";

export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. Token missing." });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Check if the verified claim contains the superAdmin role
    if (decodedToken.role !== "superAdmin") {
      return res.status(403).json({ error: "Forbidden. Super Admin access required." });
    }
    
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized. Invalid token." });
  }
};
```

### 2. Database Layer (Firestore Security Rules)
Secure Firestore collections directly via `firestore.rules` using the custom claim variable:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Check if user has active superAdmin claim
    function isSuperAdmin() {
      return request.auth != null && request.auth.token.role == "superAdmin";
    }

    match /adminSettings/{document} {
      allow read, write: if isSuperAdmin();
    }
    
    match /users/{userId} {
      allow read, update: if request.auth.uid == userId || isSuperAdmin();
      allow create: if request.auth != null;
    }
  }
}
```

### 3. Frontend UI Layout Controls (React Environment)
Inside React hooks and components (such as `src/providers/AuthProvider.tsx`), check the refreshed token claims structure to toggle administrative panel availability dynamically:

```typescript
import { useEffect, useState } from "react";
import { getAuth, onIdTokenChanged } from "firebase/auth";

export function useAdminState() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    return onIdTokenChanged(auth, async (user) => {
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        // Check custom claim role value
        setIsSuperAdmin(idTokenResult.claims.role === "superAdmin");
      } else {
        setIsSuperAdmin(false);
      }
    });
  }, []);

  return { isSuperAdmin };
}
```

---

## ⚠️ Security Boundaries & Warnings

### 🚫 Never Hardcode Personal Names or Emails
Do not hardcode or commit personal email addresses (e.g., `jnakasamai@gmail.com`), hardcoded supervisor records, password hashes, or corporate admin addresses directly within public source code, build parameters, configuration scripts, or database safety rules. 

* **Why?** Hardcoding emails is a high-severity security anti-pattern. If a user changes their email, or the repository is exported/exposed, administrative access keys and personal identifiable information (PII) are permanently leaked, and the permissions cannot be adjusted without recompiling and redeploying the entire codebase.
* **Refined Alternative**: Always query database profile records, or depend purely on cryptographically verified custom claims matching the specific token payload.

### 🔒 Access Key Lifecycle Rules
1. Never commit the `service-account-key.json` file to git. Use environment variables (like `GOOGLE_APPLICATION_CREDENTIALS`) or container metadata instances to supply security tokens or database credentials.
2. Cleanly strip administrative scripts out of your active deployments prior to executing final production bundle builds.
