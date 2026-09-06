import { describe, expect, it } from "vitest";
import { calculateInvoice, paymentStatus, profitSummary } from "./accounting";

describe("calculateInvoice", () => {
  it("basic: gross items, line discounts, invoice discount, shipping", () => {
    expect(
      calculateInvoice(
        [{ quantity: 2, finalUnitPrice: 2_200_000, discountAmount: 100_000, unitCost: 1_000_000 }],
        50_000,
        80_000,
      ),
    ).toEqual({
      itemsGross: 4_400_000,
      lineDiscounts: 100_000,
      discountAmount: 150_000,
      total: 4_330_000,
      costOfGoods: 2_000_000,
    });
  });

  it("total is clamped to 0 when discounts exceed gross", () => {
    const result = calculateInvoice(
      [{ quantity: 1, finalUnitPrice: 1_000, discountAmount: 500 }],
      2_000, // invoice discount alone exceeds gross
      0,
    );
    expect(result.total).toBe(0);
  });

  it("zero amount line contributes nothing", () => {
    const result = calculateInvoice([{ quantity: 5, finalUnitPrice: 0 }], 0, 0);
    expect(result.itemsGross).toBe(0);
    expect(result.total).toBe(0);
    expect(result.costOfGoods).toBe(0);
  });

  it("multiple lines sum correctly", () => {
    const result = calculateInvoice([
      { quantity: 3, finalUnitPrice: 10_000, discountAmount: 0,     unitCost: 5_000 },
      { quantity: 2, finalUnitPrice: 20_000, discountAmount: 5_000, unitCost: 8_000 },
    ], 0, 0);
    // gross = 3*10k + 2*20k = 70k
    // lineDiscounts = 0 + 5k = 5k
    // total = 70k - 5k = 65k
    // cogs = 3*5k + 2*8k = 31k
    expect(result.itemsGross).toBe(70_000);
    expect(result.lineDiscounts).toBe(5_000);
    expect(result.total).toBe(65_000);
    expect(result.costOfGoods).toBe(31_000);
  });

  it("shipping is added to total after discounts", () => {
    const result = calculateInvoice(
      [{ quantity: 1, finalUnitPrice: 100_000 }],
      10_000,  // invoice discount
      20_000,  // shipping
    );
    // gross=100k, discounts=10k, total = 100k-10k+20k = 110k
    expect(result.total).toBe(110_000);
  });

  it("no discounts, no shipping — total equals gross", () => {
    const result = calculateInvoice([{ quantity: 4, finalUnitPrice: 50_000 }], 0, 0);
    expect(result.total).toBe(200_000);
    expect(result.itemsGross).toBe(200_000);
    expect(result.lineDiscounts).toBe(0);
    expect(result.discountAmount).toBe(0);
  });

  it("unitCost defaults to 0 when omitted", () => {
    const result = calculateInvoice([{ quantity: 2, finalUnitPrice: 5_000 }]);
    expect(result.costOfGoods).toBe(0);
  });

  it("integer arithmetic — no floating-point drift", () => {
    // Values that would drift with floats
    const result = calculateInvoice(
      [{ quantity: 3, finalUnitPrice: 333_333, discountAmount: 1 }],
      2,
      1,
    );
    expect(Number.isInteger(result.total)).toBe(true);
    expect(result.total).toBe(3 * 333_333 - 1 - 2 + 1); // = 999_997
  });
});

describe("paymentStatus", () => {
  it("returns unpaid when paid is 0", () => {
    expect(paymentStatus(100, 0)).toBe("unpaid");
  });

  it("returns unpaid when paid is negative", () => {
    expect(paymentStatus(100, -1)).toBe("unpaid");
  });

  it("returns partial when paid is between 1 and total-1", () => {
    expect(paymentStatus(100, 1)).toBe("partial");
    expect(paymentStatus(100, 99)).toBe("partial");
  });

  it("returns paid when paid equals total", () => {
    expect(paymentStatus(100, 100)).toBe("paid");
  });

  it("returns paid when paid exceeds total", () => {
    // overpayment edge case — should still be 'paid'
    expect(paymentStatus(100, 200)).toBe("paid");
  });

  it("returns paid when total is 0 (free invoice)", () => {
    // zero-total invoice: any paid value >= 0 should be 'paid'
    expect(paymentStatus(0, 0)).toBe("paid");
  });
});

describe("profitSummary", () => {
  it("basic calculation", () => {
    expect(
      profitSummary({ grossSales: 1_000, discounts: 100, refunds: 50, costOfGoods: 400, otherExpenses: 120 }),
    ).toEqual({ netSales: 850, grossProfit: 450, netProfit: 330 });
  });

  it("net profit is negative when expenses exceed gross profit", () => {
    const r = profitSummary({ grossSales: 500, discounts: 0, refunds: 0, costOfGoods: 300, otherExpenses: 300 });
    expect(r.netProfit).toBe(-100);
  });

  it("refunds reduce net sales independently from discounts", () => {
    const r = profitSummary({ grossSales: 1_000, discounts: 0, refunds: 200, costOfGoods: 0, otherExpenses: 0 });
    expect(r.netSales).toBe(800);
    expect(r.grossProfit).toBe(800);
    expect(r.netProfit).toBe(800);
  });

  it("zero values produce zero results", () => {
    expect(profitSummary({ grossSales: 0, discounts: 0, refunds: 0, costOfGoods: 0, otherExpenses: 0 }))
      .toEqual({ netSales: 0, grossProfit: 0, netProfit: 0 });
  });

  it("all discounts — netSales can go negative", () => {
    // If discounts + refunds > grossSales the numbers go negative; this is a
    // data-entry error but the function should not clamp or throw.
    const r = profitSummary({ grossSales: 100, discounts: 60, refunds: 60, costOfGoods: 0, otherExpenses: 0 });
    expect(r.netSales).toBe(-20);
  });
});
