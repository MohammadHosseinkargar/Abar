import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertZibalVerifiedAmount,
  requestZibalPayment,
  tomanToRial,
  verifyZibalPayment,
} from "./zibal.server";

afterEach(() => vi.unstubAllGlobals());

describe("Zibal gateway boundary", () => {
  it("converts the trusted toman total to exact rial", () => {
    expect(tomanToRial(125_000)).toBe(1_250_000);
    expect(() => tomanToRial(1.5)).toThrow("PAYMENT_AMOUNT_MISMATCH");
  });

  it("rejects mismatched or absent verified amounts", () => {
    expect(() =>
      assertZibalVerifiedAmount({ result: 100, amount: 1_250_000 }, 125_000),
    ).not.toThrow();
    expect(() => assertZibalVerifiedAmount({ result: 100, amount: 125_000 }, 125_000)).toThrow(
      "PAYMENT_AMOUNT_MISMATCH",
    );
    expect(() => assertZibalVerifiedAmount({ result: 201 }, 125_000)).toThrow(
      "PAYMENT_AMOUNT_MISMATCH",
    );
  });

  it("sends the official request payload and endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ result: 100, trackId: 123 }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await requestZibalPayment({
      merchant: "merchant",
      amountRial: 10_000,
      callbackUrl: "https://shop.example/api/payment/zibal/callback?order=1",
      description: "order",
      orderId: "PR-1",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://gateway.zibal.ir/v1/request");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      merchant: "merchant",
      amount: 10_000,
      orderId: "PR-1",
    });
  });

  it("validates trackId before verify and maps network failures", async () => {
    expect(() => verifyZibalPayment("merchant", "not-a-track-id")).toThrow("PAYMENT_VERIFY_FAILED");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    await expect(verifyZibalPayment("merchant", "123")).rejects.toThrow("ZIBAL_UNAVAILABLE");
  });
});
