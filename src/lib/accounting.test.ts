import { describe, expect, it } from "vitest";
import { calculateInvoice, paymentStatus, profitSummary } from "./accounting";

describe("accounting calculations", () => {
  it("uses immutable invoice prices, per-line discounts and integer toman totals", () => {
    expect(calculateInvoice([{ quantity: 2, finalUnitPrice: 2_200_000, discountAmount: 100_000, unitCost: 1_000_000 }], 50_000, 80_000)).toEqual({ itemsGross: 4_400_000, lineDiscounts: 100_000, discountAmount: 150_000, total: 4_330_000, costOfGoods: 2_000_000 });
  });
  it("derives payment state without rounding", () => {
    expect(paymentStatus(100, 0)).toBe("unpaid"); expect(paymentStatus(100, 99)).toBe("partial"); expect(paymentStatus(100, 100)).toBe("paid");
  });
  it("separates refunds, COGS and operating costs in profit", () => {
    expect(profitSummary({ grossSales: 1_000, discounts: 100, refunds: 50, costOfGoods: 400, otherExpenses: 120 })).toEqual({ netSales: 850, grossProfit: 450, netProfit: 330 });
  });
});
