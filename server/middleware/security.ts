import express from "express";
import { dbAdmin } from "../firebaseAdmin";

/** Baseline hardening headers (no external dependency). CSP is intentionally left to the hosting layer. */
export function securityHeaders(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  res.removeHeader("X-Powered-By");
  next();
}

interface Bucket { count: number; resetAt: number }

/** Fixed-window in-memory rate limiter (per instance). key defaults to authenticated uid, else client IP. */
export function rateLimit(name: string, max: number, windowMs: number, keyFn?: (req: any) => string) {
  const buckets = new Map<string, Bucket>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }, windowMs).unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${name}:${keyFn ? keyFn(req) : ((req as any).user?.uid || req.ip)}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count++;
    if (b.count > max) {
      res.setHeader("Retry-After", Math.ceil((b.resetAt - now) / 1000).toString());
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }
    next();
  };
}

/** Must run after authenticateUser. Admin = custom claim or users/{uid}.role/isSuperAdmin (Admin SDK read). */
export async function requireAdmin(req: any, res: express.Response, next: express.NextFunction) {
  try {
    const claims = req.user || {};
    if (claims.role === "superAdmin" || claims.role === "admin") return next();
    const snap = await dbAdmin.collection("users").doc(claims.uid).get();
    const d = snap.data();
    if (d && (d.isSuperAdmin === true || d.role === "admin")) return next();
    return res.status(403).json({ error: "Forbidden. Administrator access required." });
  } catch (e: any) {
    console.error("[requireAdmin]", e.message);
    return res.status(500).json({ error: "Authorization check failed." });
  }
}

const escapeMap: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
export const escapeHtml = (v: string) => v.replace(/[&<>"']/g, c => escapeMap[c]);

/** Recursively HTML-escapes every string in a payload. `skip` lists top-level keys left untouched. */
export function escapeDeep(value: any, skip: string[] = [], depth = 0): any {
  if (depth > 8) return undefined;
  if (typeof value === "string") return escapeHtml(value);
  if (Array.isArray(value)) return value.slice(0, 500).map(v => escapeDeep(v, [], depth + 1));
  if (value && typeof value === "object") {
    const out: any = {};
    for (const k of Object.keys(value)) {
      out[k] = skip.includes(k) ? value[k] : escapeDeep(value[k], [], depth + 1);
    }
    return out;
  }
  return value;
}

/** Only http(s)/mailto URLs survive; anything else (javascript:, data:) becomes "#". Input may already be HTML-escaped. */
export function safeHref(u: any): string {
  const s = String(u ?? "").replace(/&amp;/g, "&").trim();
  return /^(https?:\/\/|mailto:)/i.test(s) ? escapeHtml(s) : "#";
}

/** Strips scripts, iframes, event handlers and javascript: URLs from admin-authored HTML. */
export function sanitizeRichHtml(html: any): string {
  return String(html ?? "")
    .replace(/<\s*(script|iframe|object|embed|style|link|meta|form)[\s\S]*?(<\/\s*\1\s*>|$)/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, '$1="#"');
}

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
export const isValidEmail = (e: any): e is string => typeof e === "string" && e.length <= 254 && EMAIL_RE.test(e);
