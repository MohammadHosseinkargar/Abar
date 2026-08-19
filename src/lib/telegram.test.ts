import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatTelegramOrder,
  sendTelegramOrder,
  type TelegramOrderPayload,
} from "./telegram.server";

const payload: TelegramOrderPayload = {
  order: {
    id: "order-id",
    code: "PR-1405-123456",
    user_id: "user-id",
    subtotal: 446_000,
    shipping_amount: 50_000,
    discount_amount: 40_000,
    total: 456_000,
    shipping_address: {
      receiver: "علی رضایی",
      phone: "09120000000",
      province: "تهران",
      city: "تهران",
      line: "خیابان نمونه",
    },
    payment_status: "paid",
    paid_at: "2026-08-20T10:00:00.000Z",
  },
  items: [
    { name: "محصول اول", qty: 2, price: 98_000, product_id: "p1", product_slug: "one" },
    { name: "محصول دوم", qty: 1, price: 250_000, product_id: "p2", product_slug: "two" },
  ],
  imageUrls: ["https://cdn.example/one.jpg", "https://cdn.example/two.jpg"],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Telegram paid-order notification", () => {
  it("formats real order, customer and product totals", () => {
    const text = formatTelegramOrder(payload);
    expect(text).toContain("محصول اول");
    expect(text).toContain("تعداد: ۲");
    expect(text).toContain("۴۵۶٬۰۰۰ تومان");
    expect(text).toContain("علی رضایی");
    expect(text).toContain("پرداخت موفق ✅");
  });

  it("uses a media group for multiple unique public images", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "secret-token");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_IDS", "123,456");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendTelegramOrder({
      ...payload,
      imageUrls: [...payload.imageUrls, payload.imageUrls[0]],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/sendMediaGroup");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.media).toHaveLength(2);
  });

  it("can target a specific admin from a multi-admin configuration", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "secret-token");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_IDS", "123, 456,123");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendTelegramOrder({ ...payload, imageUrls: [] }, "456");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chat_id).toBe("456");
  });

  it("sends text when no product image exists", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "secret-token");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_IDS", "123");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendTelegramOrder({ ...payload, imageUrls: [] });
    expect(fetchMock.mock.calls[0][0]).toContain("/sendMessage");
  });

  it("resolves uploaded relative image paths against APP_URL", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "secret-token");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_IDS", "123");
    vi.stubEnv("APP_URL", "https://abar3d.ir");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendTelegramOrder({ ...payload, imageUrls: ["/api/public/img/product.jpg"] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.photo).toBe("https://abar3d.ir/api/public/img/product.jpg");
  });

  it("does not expose Telegram API descriptions in thrown errors", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "secret-token");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_IDS", "123");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ ok: false, error_code: 400, description: "sensitive response" }),
            { status: 400 },
          ),
        ),
    );
    await expect(sendTelegramOrder(payload)).rejects.toThrow("TELEGRAM_API_400");
  });
});
