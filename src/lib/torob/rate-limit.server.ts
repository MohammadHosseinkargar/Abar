import "@tanstack/react-start/server-only";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function allowTorobRequest(request: Request, limit = 120, windowMs = 60_000): boolean {
  const key =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
