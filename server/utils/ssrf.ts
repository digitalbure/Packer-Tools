import { URL } from "url";
import net from "net";
import dns from "dns";
import http from "http";
import https from "https";

/**
 * Validates whether a given URL string is safe from SSRF vulnerabilities.
 * Blocks non-HTTP(S) protocols, metadata services, and private/local/loopback/carrier IP ranges.
 */
export function isSafeUrl(urlString: string): { safe: boolean; reason?: string; url?: URL } {
  if (!urlString || typeof urlString !== "string") {
    return { safe: false, reason: "Invalid or empty URL." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { safe: false, reason: "Malformed URL syntax." };
  }

  // Enforce http and https protocols only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: "Forbidden URL scheme. Only HTTP and HTTPS protocols are allowed." };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // Strip IPv6 brackets if present

  // Block localhost and standard internal/cloud metadata hostnames
  if (
    hostname === "localhost" ||
    hostname === "metadata" ||
    hostname === "metadata.google" ||
    hostname === "metadata.google.internal" ||
    hostname === "instance-data" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.includes("169.254.169.254") ||
    hostname.includes("127.0.0.1")
  ) {
    return { safe: false, reason: "Access to local, internal, or cloud metadata hostnames is restricted." };
  }

  // Parse decimal IP representations (e.g., http://2130706433/ or http://017700000001/)
  const numericIp = parseAlternativeIpNotation(hostname);
  const effectiveIp = numericIp || hostname;

  // Check if effective hostname is an IP address
  if (net.isIP(effectiveIp)) {
    if (isPrivateIp(effectiveIp)) {
      return { safe: false, reason: "Access to private, loopback, or internal IP ranges is restricted." };
    }
  }

  return { safe: true, url: parsed };
}

/**
 * Normalizes decimal, hex, or octal IP strings into standard dotted IPv4 format if applicable.
 */
function parseAlternativeIpNotation(hostname: string): string | null {
  // Pure integer dword notation e.g., "2130706433" -> "127.0.0.1"
  if (/^\d+$/.test(hostname)) {
    const num = parseInt(hostname, 10);
    if (num >= 0 && num <= 0xffffffff) {
      return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
    }
  }
  // Hex notation e.g., "0x7f000001" -> "127.0.0.1"
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    const num = parseInt(hostname, 16);
    if (num >= 0 && num <= 0xffffffff) {
      return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
    }
  }
  return null;
}

/**
 * Helper to check if an IP address falls within private/reserved/loopback CIDR blocks.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:a.b.c.d or ::ffff:7f00:1) -> evaluate the embedded IPv4 address
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  const mappedHex = ip.toLowerCase().match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16), lo = parseInt(mappedHex[2], 16);
    return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 100.64.0.0/10 (CGNAT / Shared space)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud Metadata Server 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (parts[0] >= 224) return true;
  } else if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // Loopback ::1, ::, IPv4-mapped, site-local, unique local
    if (
      normalized === "::1" ||
      normalized === "::" ||
      /^fe[89ab][0-9a-f]:/.test(normalized) || // fe80::/10 link-local
      /^f[cd][0-9a-f]{2}:/.test(normalized) || // fc00::/7 unique local
      normalized.startsWith("ff") || // multicast
      normalized.startsWith("64:ff9b:") || // NAT64
      normalized.startsWith("2002:") || // 6to4
      normalized.includes("127.0.0.1") ||
      normalized.includes("169.254.169.254")
    ) {
      return true;
    }
  }
  return false;
}

const ALLOWED_IMAGE_DOMAINS = [
  "unsplash.com",
  "images.unsplash.com",
  "pexels.com",
  "images.pexels.com",
  "media-amazon.com",
  "m.media-amazon.com",
  "amazon.com",
  "bhphotovideo.com",
  "media.bhphotovideo.com",
  "shopify.com",
  "cdn.shopify.com",
  "imgur.com",
  "i.imgur.com",
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
  "githubusercontent.com",
  "raw.githubusercontent.com",
  "wikimedia.org",
  "upload.wikimedia.org",
  "flickr.com",
  "staticflickr.com",
  "live.staticflickr.com",
  "cloudinary.com",
  "res.cloudinary.com",
  "fastly.net",
  "akamaihd.net",
  "ebayimg.com",
  "i.ebayimg.com",
  "ytimg.com",
  "img.youtube.com",
  "s3.amazonaws.com",
  "ctfassets.net",
  "images.ctfassets.net",
  "pinimg.com",
  "i.pinimg.com",
  "gravatar.com",
  "wp.com",
  "wordpress.com",
  "scene7.com"
];

const ALLOWED_IMAGE_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".bmp", ".tiff", ".ico"
];

/**
 * Validates whether a parsed URL originates from an allowlisted image domain
 * or contains a recognized image extension in its pathname or search params.
 */
export function isAllowlistedImageSource(parsedUrl: URL): boolean {
  const hostname = parsedUrl.hostname.toLowerCase();

  // Prohibit raw IP addresses from image proxy requests
  if (net.isIP(hostname)) {
    return false;
  }

  // Check if domain or parent domain is in the explicit allowlist
  const domainMatches = ALLOWED_IMAGE_DOMAINS.some(
    allowed => hostname === allowed || hostname.endsWith("." + allowed)
  );
  if (domainMatches) {
    return true;
  }

  // Check if pathname ends with a recognized image extension
  const pathname = parsedUrl.pathname.toLowerCase();
  const hasImageExt = ALLOWED_IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext));
  if (hasImageExt) {
    return true;
  }

  // Check if search parameters specify a valid image format
  const search = parsedUrl.search.toLowerCase();
  if (
    search.includes("format=jpg") ||
    search.includes("format=jpeg") ||
    search.includes("format=png") ||
    search.includes("format=webp") ||
    search.includes("fm=jpg") ||
    search.includes("fm=jpeg") ||
    search.includes("fm=png") ||
    search.includes("fm=webp")
  ) {
    return true;
  }

  return false;
}



/**
 * DNS lookup guard: resolves the hostname and refuses to connect if ANY resolved address is private/internal.
 * Applied at connect time, so it also covers DNS rebinding and every redirect hop.
 */
const guardedLookup: any = (hostname: string, options: any, callback: any) => {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "function" ? {} : options;
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses: any) => {
    if (err) return cb(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: net.isIP(addresses) }];
    if (list.length === 0 || list.some((a: any) => isPrivateIp(a.address))) {
      return cb(new Error(`SSRF guard: ${hostname} resolves to a restricted address.`));
    }
    if (opts && opts.all) return cb(null, list);
    return cb(null, list[0].address, list[0].family);
  });
};

export const ssrfHttpAgent = new http.Agent({ lookup: guardedLookup });
export const ssrfHttpsAgent = new https.Agent({ lookup: guardedLookup });

/** Spread into axios config for any server-side fetch of a user-supplied URL. */
export const ssrfSafeAxiosOptions = {
  httpAgent: ssrfHttpAgent,
  httpsAgent: ssrfHttpsAgent,
  maxRedirects: 3,
  maxContentLength: 10 * 1024 * 1024,
  beforeRedirect: (options: any) => {
    const target = `${options.protocol}//${options.hostname}${options.path || ""}`;
    const check = isSafeUrl(target);
    if (!check.safe) throw new Error(`SSRF guard: redirect blocked (${check.reason})`);
  },
};
