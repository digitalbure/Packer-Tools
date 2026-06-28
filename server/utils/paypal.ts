import axios from "axios";
import { dbAdmin } from "../firebaseAdmin";

export interface PayPalConfig {
  clientId: string;
  secretKey: string;
  sandboxMode: boolean;
  enabled: boolean;
}

export const getPayPalConfig = async (): Promise<PayPalConfig> => {
  let clientId = process.env.VITE_PAYPAL_CLIENT_ID || "";
  let secretKey = process.env.PAYPAL_SECRET_KEY || "";
  let sandboxMode = true;
  let enabled = true;

  try {
    const docSnap = await dbAdmin.collection("adminSettings").doc("global").get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const config = data?.integrationConfig;
      if (config) {
        if (config.paypalClientId) {
          clientId = config.paypalClientId;
        }
        if (config.paypalSecretKey) {
          secretKey = config.paypalSecretKey;
        }
        if (config.paypalSandboxMode !== undefined) {
          sandboxMode = !!config.paypalSandboxMode;
        }
        if (config.paypalEnabled !== undefined) {
          enabled = !!config.paypalEnabled;
        }
      }
    }
  } catch (error: any) {
    console.error("[PayPal config error] Failed to load config from Firestore, falling back to env:", error.message);
  }

  return { clientId, secretKey, sandboxMode, enabled };
};

export const getPayPalAccessToken = async () => {
  const config = await getPayPalConfig();
  const { clientId, secretKey, sandboxMode } = config;

  if (!clientId || !secretKey) {
    throw new Error("PayPal Client ID and Secret Key are not configured in Admin Settings or Environment variables.");
  }

  const auth = Buffer.from(`${clientId}:${secretKey}`).toString("base64");
  const host = sandboxMode ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

  const response = await axios.post(
    `${host}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data.access_token;
};
