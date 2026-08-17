export const REGULAR_SHIPPING_TOMAN = 180_000;
export const BOOKMARK_ONLY_SHIPPING_TOMAN = 160_000;

type ShippingItem = {
  isBookmark?: boolean | null;
};

/**
 * Shipping is cheaper only when every product in the order is a bookmark.
 * An empty cart has no shipping charge.
 */
export function calculateShippingAmount(items: ShippingItem[]): number {
  if (items.length === 0) return 0;
  return items.every((item) => item.isBookmark === true)
    ? BOOKMARK_ONLY_SHIPPING_TOMAN
    : REGULAR_SHIPPING_TOMAN;
}
