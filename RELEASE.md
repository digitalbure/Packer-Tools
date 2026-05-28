# 🚀 Release Information & Beta Build Guild

## Current Application Version: `v1.0.0-beta.1`
**Status:** Active Beta Testing / User Feedback Loop  
**Environment:** GCP Cloud Run Container (Vite Node Proxy)  
**Database/Backend:** Google Firestore + Firebase Authentication

This document provides complete instructions on how to build, run, and tag this repository for production deployment or continuous integration. 

---

## 📦 Release Log: v1.0.0-beta.1

### Key Beta Features Loaded:
1. **Physical QR Label Sticker Templates:**
   - Multi-size label presets added to `QRPrintModal` dynamically adjusting dimensions automatically for:
     - **Dymo 30334** (2.25" x 1.25" asset sizing)
     - **Brother TZe** (12mm Tape / Wrap)
     - **Brother TZe** (24mm Ribbon)
     - **Standard Avery A4** (63.5mm x 33.9mm)
     - Fully customizable dimensions input and dynamic sheet calculation on-the-fly.

2. **Google Cloud Stack Resource & Cost Analyzer:**
   - Interactive Recharts area/bar metrics visualizing monthly Cloud Run compute calculations, dynamic Firestore operations, and active Gemini API inference pricing models.
   - Live **traffic stress multiplier** dynamically predicting global budget scaling (Baseline up to 100x stress sizing).

3. **Logistics & Rack Space Organization:**
   - Modular packing list organizers, qr-scanners integrations, multi-person real-time list allocation checks, physical storage shelf racks mapping.

---

## 🛠️ Local Build & Compilation Guide

To run or custom build this beta version of the application, follow these guidelines:

### Prerequisites:
- **Node.js** v18+ or v20+
- **npm** or **yarn**

### 1. Repository Configuration
Add local environment vars inside your `.env` file from the referenced `.env.example`:
```env
# Required for database connections
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here

# Required for server-side operations
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Dependency Setup
Install code declarations and workspace modules:
```bash
npm install
```

### 3. Running in Development (HMR & Node Host Proxy)
Spins up the fast Node/Express server routing static requests:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the live responsive interface.

### 4. Code Quality & Formatting Check
Verify syntax and correct typings before committing changes:
```bash
npm run lint
```

### 5. Production Compilation
Bundle the full-stack single entry point and client-side files:
```bash
npm run build
```
The resulting build directory will be generated inside `/dist/`.

---

## 🔗 How to Release & Tag on GitHub
When promoting this trial sandbox version to candidate status on telemetry channels, tag it on GitHub via git CLI:

```bash
# 1. Commit any current beta changes
git add .
git commit -m "release: v1.0.0-beta.1 integration of qr-sticker templates and cost matrices"

# 2. Add an annotated lightweight version tag
git tag -a v1.0.0-beta.1 -m "Active beta tag for tests"

# 3. Ship changes & push tags upstream to origin matching pipelines
git push origin main
git push origin v1.0.0-beta.1
```

Once pushed, GitHub Actions or Google Cloud Build can intercept this semantic version pattern (`v*`) to auto-ship binaries safely!
