import crypto from "crypto";

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Returns the configured secret, or "" when unset. There are intentionally NO built-in default keys. */
export function getAdminApiKey(): string {
  return process.env.ADMIN_API_KEY || "";
}

export function getDeveloperApiKey(): string {
  return process.env.DEVELOPER_API_KEY || process.env.ADMIN_API_KEY || "";
}

export function randomToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString("hex")}`;
}
