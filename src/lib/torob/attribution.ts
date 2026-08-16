export const TOROB_CLICK_COOKIE = "torob_clid";

export function validTorobClickId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9_-]{1,200}$/.test(normalized) ? normalized : null;
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}
