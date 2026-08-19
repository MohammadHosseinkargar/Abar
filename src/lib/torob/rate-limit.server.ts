import "@tanstack/react-start/server-only";

const buckets = new Map<string, { count: number; resetAt: number }>();

function requestIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function isKnownTorobIp(ip: string): boolean {
  if (["91.107.165.81", "188.121.119.29", "195.201.30.135"].includes(ip)) return true;
  const match = ip.match(/^81\.12\.31\.(\d{1,3})$/);
  if (!match) return false;
  const lastOctet = Number(match[1]);
  return lastOctet >= 192 && lastOctet <= 254;
}

export function allowTorobRequest(request: Request, limit = 120, windowMs = 60_000): boolean {
  const key = requestIp(request);
  // Authentication is still enforced with Torob's signed JWT. Exempt only its
  // documented crawler addresses from throttling during catalogue syncs.
  if (isKnownTorobIp(key)) return true;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
