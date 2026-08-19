export const REGULAR_SHIPPING_TOMAN = 180_000;
export const BOOKMARK_ONLY_SHIPPING_TOMAN = 160_000;

type ShippingItem = {
  isBookmark?: boolean | null;
};

function normalizeCity(city: string): string {
  return city
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasFreeMashhadShipping(city?: string | null): boolean {
  if (!city) return false;
  const normalized = normalizeCity(city);
  return normalized === "مشهد" || normalized === "مشهد مقدس";
}

/**
 * Shipping is cheaper only when every product in the order is a bookmark.
 * An empty cart has no shipping charge.
 */
export function calculateShippingAmount(items: ShippingItem[], destinationCity?: string | null): number {
  if (items.length === 0) return 0;
  if (hasFreeMashhadShipping(destinationCity)) return 0;
  return items.every((item) => item.isBookmark === true)
    ? BOOKMARK_ONLY_SHIPPING_TOMAN
    : REGULAR_SHIPPING_TOMAN;
}
