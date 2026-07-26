import { URL } from "url";
import net from "net";

/**
 * Validates whether a given URL string is safe from SSRF vulnerabilities.
 * Blocks non-HTTP(S) protocols and private/local/loopback/metadata IP address ranges.
 */
export function isSafeUrl(urlString: string): { safe: boolean; reason?: string; url?: URL } {
  if (!urlString || typeof urlString !== "string") {
    return { safe: false, reason: "Invalid or empty URL." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, reason: "Malformed URL syntax." };
  }

  // Enforce http and https protocols only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: "Forbidden URL scheme. Only HTTP and HTTPS protocols are allowed." };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and standard loopback hostnames
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return { safe: false, reason: "Access to local/internal hostnames is restricted." };
  }

  // Check if hostname is an IP address
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: "Access to private/internal IP ranges is restricted." };
    }
  }

  return { safe: true, url: parsed };
}

/**
 * Helper to check if an IP address falls within private/reserved/loopback CIDR blocks.
 */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud Metadata Server 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (parts[0] >= 224) return true;
  } else if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // Loopback ::1 or IPv4-mapped loopback ::ffff:127.0.0.1
    if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc00:") || normalized.startsWith("fd00:")) {
      return true;
    }
  }
  return false;
}
