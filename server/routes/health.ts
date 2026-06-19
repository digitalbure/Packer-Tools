import express from "express";
import axios from "axios";
import { authenticateUser } from "../middleware/auth";

const router = express.Router();

router.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0-beta.1",
    uptime: process.uptime()
  });
});

let gcpPricingCache: any = null;
let gcpPricingCacheTime = 0;
const GCP_PRICING_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

router.get("/api/gcp-pricing", authenticateUser, async (req, res) => {
  const defaultRates = {
    cloudRun: {
      cpuSecond: 0.000024,
      memoryGbSecond: 0.0000025,
      request: 0.0000004
    },
    firestore: {
      read: 0.0000006,
      write: 0.0000018,
      delete: 0.0000002,
      storageGbMonth: 0.18
    }
  };

  const now = Date.now();
  if (gcpPricingCache && (now - gcpPricingCacheTime < GCP_PRICING_CACHE_DURATION_MS)) {
    return res.json(gcpPricingCache);
  }

  const key = process.env.GCP_PRICING_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    const resultPayload = {
      status: "success",
      source: "GCP Pricing Engine (Active Fallback Rates)",
      rates: defaultRates,
      details: "No Google Cloud Billing API key configured. Utilizing cached default rates.",
      simulatedMetrics: {
        lastUpdated: new Date().toISOString()
      }
    };
    gcpPricingCache = resultPayload;
    gcpPricingCacheTime = now;
    return res.json(resultPayload);
  }

  try {
    const cloudRunUrl = `https://cloudbilling.googleapis.com/v1/services/6F81-5844-456A/skus?key=${key}`;
    const firestoreUrl = `https://cloudbilling.googleapis.com/v1/services/7FF8-D52A-3C66/skus?key=${key}`;

    const [runResponse, firestoreResponse] = await Promise.allSettled([
      axios.get(cloudRunUrl, { timeout: 4000 }),
      axios.get(firestoreUrl, { timeout: 4000 })
    ]);

    const finalRates = JSON.parse(JSON.stringify(defaultRates));
    let liveFetchedCount = 0;
    const logDetails: string[] = [];

    if (runResponse.status === "fulfilled" && runResponse.value?.data?.skus) {
      const skus = runResponse.value.data.skus;
      logDetails.push(`Loaded ${skus.length} Cloud Run SKUs`);
      const cpuSku = skus.find((s: any) => s.description?.toLowerCase().includes("cpu") && s.pricingInfo?.[0]?.pricingExpression?.tieredRates?.[0]?.unitPrice);
      if (cpuSku) {
        const rate = cpuSku.pricingInfo[0].pricingExpression.tieredRates[0].unitPrice;
        const nanosValue = Number(rate.nanos || 0) / 1000000000;
        const total = Number(rate.units || 0) + nanosValue;
        if (total > 0) {
          finalRates.cloudRun.cpuSecond = total;
          liveFetchedCount++;
        }
      }
      const memorySku = skus.find((s: any) => s.description?.toLowerCase().includes("memory") && s.pricingInfo?.[0]?.pricingExpression?.tieredRates?.[0]?.unitPrice);
      if (memorySku) {
        const rate = memorySku.pricingInfo[0].pricingExpression.tieredRates[0].unitPrice;
        const nanosValue = Number(rate.nanos || 0) / 1000000000;
        const total = Number(rate.units || 0) + nanosValue;
        if (total > 0) {
          finalRates.cloudRun.memoryGbSecond = total;
          liveFetchedCount++;
        }
      }
      const reqSku = skus.find((s: any) => s.description?.toLowerCase().includes("request") && s.pricingInfo?.[0]?.pricingExpression?.tieredRates?.[0]?.unitPrice);
      if (reqSku) {
        const rate = reqSku.pricingInfo[0].pricingExpression.tieredRates[0].unitPrice;
        const nanosValue = Number(rate.nanos || 0) / 1000000000;
        const total = (Number(rate.units || 0) + nanosValue) / 1000000;
        if (total > 0) {
          finalRates.cloudRun.request = total;
          liveFetchedCount++;
        }
      }
    } else {
      logDetails.push(`Cloud Run SKU fetch skipped or failed.`);
    }

    if (firestoreResponse.status === "fulfilled" && firestoreResponse.value?.data?.skus) {
      const skus = firestoreResponse.value.data.skus;
      logDetails.push(`Loaded ${skus.length} Cloud Firestore SKUs`);
      const readSku = skus.find((s: any) => s.description?.toLowerCase().includes("read") && s.pricingInfo?.[0]?.pricingExpression?.tieredRates?.[0]?.unitPrice);
      if (readSku) {
        const rate = readSku.pricingInfo[0].pricingExpression.tieredRates[0].unitPrice;
        const nanosValue = Number(rate.nanos || 0) / 1000000000;
        const total = (Number(rate.units || 0) + nanosValue) / 100000;
        if (total > 0) {
          finalRates.firestore.read = total;
          liveFetchedCount++;
        }
      }
      const writeSku = skus.find((s: any) => s.description?.toLowerCase().includes("write") && s.pricingInfo?.[0]?.pricingExpression?.tieredRates?.[0]?.unitPrice);
      if (writeSku) {
        const rate = writeSku.pricingInfo[0].pricingExpression.tieredRates[0].unitPrice;
        const nanosValue = Number(rate.nanos || 0) / 1000000000;
        const total = (Number(rate.units || 0) + nanosValue) / 100000;
        if (total > 0) {
          finalRates.firestore.write = total;
          liveFetchedCount++;
        }
      }
      const deleteSku = skus.find((s: any) => s.description?.toLowerCase().includes("delete") && s.pricingInfo?.[0]?.pricingExpression?.tieredRates?.[0]?.unitPrice);
      if (deleteSku) {
        const rate = deleteSku.pricingInfo[0].pricingExpression.tieredRates[0].unitPrice;
        const nanosValue = Number(rate.nanos || 0) / 1000000000;
        const total = (Number(rate.units || 0) + nanosValue) / 100000;
        if (total > 0) {
          finalRates.firestore.delete = total;
          liveFetchedCount++;
        }
      }
      const storageSku = skus.find((s: any) => s.description?.toLowerCase().includes("document storage") && s.pricingInfo?.[0]?.pricingExpression?.tieredRates?.[0]?.unitPrice);
      if (storageSku) {
        const rate = storageSku.pricingInfo[0].pricingExpression.tieredRates[0].unitPrice;
        const nanosValue = Number(rate.nanos || 0) / 1000000000;
        const total = Number(rate.units || 0) + nanosValue;
        if (total > 0) {
          finalRates.firestore.storageGbMonth = total;
          liveFetchedCount++;
        }
      }
    } else {
      logDetails.push(`Cloud Firestore SKU fetch skipped or failed.`);
    }

    const resultPayload = {
      status: "success",
      source: liveFetchedCount > 0 ? "GCP Pricing API (Live SKUs Synchronized)" : "GCP Pricing Engine (Active Fallback Rates)",
      rates: finalRates,
      details: logDetails.join("; "),
      simulatedMetrics: {
        lastUpdated: new Date().toISOString()
      }
    };
    gcpPricingCache = resultPayload;
    gcpPricingCacheTime = now;
    return res.json(resultPayload);

  } catch (error: any) {
    console.error("GCP Pricing API fetch returned error:", error.message);
    const resultPayload = {
      status: "success",
      source: "GCP Pricing Engine (Active Fallback Rates)",
      rates: defaultRates,
      details: `Exception handled: ${error.message}`,
      simulatedMetrics: {
        lastUpdated: new Date().toISOString()
      }
    };
    gcpPricingCache = resultPayload;
    gcpPricingCacheTime = now - GCP_PRICING_CACHE_DURATION_MS + 60000;
    return res.json(resultPayload);
  }
});

export default router;
