import { describe, expect, it } from "vitest";
import {
  BOOKMARK_ONLY_SHIPPING_TOMAN,
  calculateShippingAmount,
  REGULAR_SHIPPING_TOMAN,
} from "./shipping";

describe("calculateShippingAmount", () => {
  it("does not charge an empty cart", () => {
    expect(calculateShippingAmount([])).toBe(0);
  });

  it("uses the bookmark rate when every item is a bookmark", () => {
    expect(calculateShippingAmount([{ isBookmark: true }, { isBookmark: true }])).toBe(
      BOOKMARK_ONLY_SHIPPING_TOMAN,
    );
  });

  it("uses the regular rate for regular and mixed carts", () => {
    expect(calculateShippingAmount([{ isBookmark: false }])).toBe(REGULAR_SHIPPING_TOMAN);
    expect(calculateShippingAmount([{ isBookmark: true }, { isBookmark: false }])).toBe(
      REGULAR_SHIPPING_TOMAN,
    );
  });

  it("treats missing bookmark metadata as a regular product", () => {
    expect(calculateShippingAmount([{}])).toBe(REGULAR_SHIPPING_TOMAN);
  });
});
