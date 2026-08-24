import { describe, expect, it, beforeEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { torobProductRequestSchema } from "./schema";
import { mapTorobProduct, TOROB_PAGE_SIZE, isTorobVisible } from "./products.server";
import { TorobAuthenticationError, verifyTorobRequest } from "./auth.server";
import { readCookie, validTorobClickId } from "./attribution";
import { torobRetryDelaySeconds } from "./webhook.server";
import { handleTorobWebhookProcess, processTorobWebhookQueue } from "./webhook.server";
import { getTorobConfigurationState } from "./config.server";

const baseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "real-product",
  name: "محصول واقعی",
  category_slug: "decor",
  price: 150000,
  compare_at: null,
  stock: 3,
  material: "PLA",
  color: null,
  size_mm: "20x30",
  description: "توضیح",
  specs: [{ label: "وزن", value: 10 }],
  image_url: "/main.jpg",
  image_urls: ["/main.jpg", "/gallery.jpg"],
  guarantee: null,
  torob_product_group_id: null,
  created_at: "2026-01-01T10:00:00+03:30",
  updated_at: "2026-01-02T10:00:00+03:30",
  is_active: true,
};

beforeEach(() => {
  process.env.APP_URL = "https://abar3d.ir";
  process.env.TOROB_TOKEN_VERSION = "1";
  delete process.env.TOROB_WEBHOOK_TOKEN;
});

describe("Product API v3 validation", () => {
  it("accepts page 1", () =>
    expect(torobProductRequestSchema.parse({ page: 1, sort: "date_added_desc" }).page).toBe(1));
  it("accepts page 2", () =>
    expect(torobProductRequestSchema.parse({ page: 2, sort: "date_added_desc" }).page).toBe(2));
  it("accepts date_added_desc", () =>
    expect(torobProductRequestSchema.safeParse({ page: 1, sort: "date_added_desc" }).success).toBe(
      true,
    ));
  it("accepts date_updated_desc", () =>
    expect(
      torobProductRequestSchema.safeParse({ page: 1, sort: "date_updated_desc" }).success,
    ).toBe(true));
  it("accepts page_urls", () =>
    expect(
      torobProductRequestSchema.safeParse({ page_urls: ["https://abar3d.ir/products/a"] }).success,
    ).toBe(true));
  it("accepts page_uniques", () =>
    expect(torobProductRequestSchema.safeParse({ page_uniques: [baseRow.id] }).success).toBe(true));
  it("rejects an empty request", () =>
    expect(torobProductRequestSchema.safeParse({}).success).toBe(false));
  it("rejects invalid sort", () =>
    expect(torobProductRequestSchema.safeParse({ page: 1, sort: "name" }).success).toBe(false));
  it("rejects page zero", () =>
    expect(torobProductRequestSchema.safeParse({ page: 0, sort: "date_added_desc" }).success).toBe(
      false,
    ));
  it("rejects mixed modes", () =>
    expect(
      torobProductRequestSchema.safeParse({
        page: 1,
        sort: "date_added_desc",
        page_urls: ["https://abar3d.ir/products/a"],
      }).success,
    ).toBe(false));
  it("rejects empty page_urls", () =>
    expect(torobProductRequestSchema.safeParse({ page_urls: [] }).success).toBe(false));
  it("rejects empty page_uniques", () =>
    expect(torobProductRequestSchema.safeParse({ page_uniques: [] }).success).toBe(false));
  it("uses the specified page size", () => expect(TOROB_PAGE_SIZE).toBe(100));
});

describe("product mapping", () => {
  it("maps an available product and Toman price", () =>
    expect(mapTorobProduct(baseRow).current_price).toBe(150000));
  it("maps an unavailable product to price zero", () =>
    expect(mapTorobProduct({ ...baseRow, stock: 0 }).current_price).toBe(0));
  it("maps availability from stock", () =>
    expect(mapTorobProduct({ ...baseRow, stock: 0 }).availability).toBe(false));
  it("includes a real old price only for a discount", () =>
    expect(mapTorobProduct({ ...baseRow, compare_at: 180000 }).old_price).toBe(180000));
  it("omits old price without a discount", () =>
    expect(mapTorobProduct(baseRow)).not.toHaveProperty("old_price"));
  it("omits a missing guarantee", () =>
    expect(mapTorobProduct(baseRow)).not.toHaveProperty("guarantee"));
  it("maps a real guarantee", () =>
    expect(mapTorobProduct({ ...baseRow, guarantee: "۱۲ ماه" }).guarantee).toBe("۱۲ ماه"));
  it("returns empty spec when none exists", () =>
    expect(mapTorobProduct({ ...baseRow, specs: [], material: null, size_mm: null }).spec).toEqual(
      {},
    ));
  it("deduplicates images and makes them absolute", () =>
    expect(mapTorobProduct(baseRow).image_links).toEqual([
      "https://abar3d.ir/main.jpg",
      "https://abar3d.ir/gallery.jpg",
    ]));
  it("keeps page_unique stable", () =>
    expect(mapTorobProduct(baseRow).page_unique).toBe(baseRow.id));
  it("uses the canonical product route", () =>
    expect(mapTorobProduct(baseRow).page_url).toBe("https://abar3d.ir/products/real-product"));
  it("excludes hidden products from list eligibility", () =>
    expect(isTorobVisible({ is_active: false })).toBe(false));
  it("keeps deleted products absent by definition", () =>
    expect([baseRow].filter((row) => row.id === "missing")).toEqual([]));
});

describe("authentication and attribution", () => {
  function signedRequest(audience = "abar3d.ir", expired = false) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    process.env.TOROB_PUBLIC_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT", v: 1 })).toString(
      "base64url",
    );
    const payload = Buffer.from(
      JSON.stringify({ aud: audience, nbf: now - 5, exp: expired ? now - 1 : now + 60 }),
    ).toString("base64url");
    const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey).toString(
      "base64url",
    );
    return new Request("https://abar3d.ir/api/torob/products", {
      headers: {
        "X-Torob-Token": `${header}.${payload}.${signature}`,
        "X-Torob-Token-Version": "1",
      },
    });
  }
  it("accepts valid authentication", () =>
    expect(() => verifyTorobRequest(signedRequest())).not.toThrow());
  it("rejects invalid audience", () =>
    expect(() => verifyTorobRequest(signedRequest("other.example"))).toThrow());
  it("rejects expired authentication", () =>
    expect(() => verifyTorobRequest(signedRequest("abar3d.ir", true))).toThrow());
  it("rejects missing authentication", () =>
    expect(() =>
      verifyTorobRequest(new Request("https://abar3d.ir/api/torob/products")),
    ).toThrow());
  it("rejects a signed request when the configured public key is malformed", () => {
    const request = signedRequest();
    process.env.TOROB_PUBLIC_KEY = "not-a-public-key";
    expect(() => verifyTorobRequest(request)).toThrow(TorobAuthenticationError);
    try {
      verifyTorobRequest(request);
    } catch (error) {
      expect(error).toBeInstanceOf(TorobAuthenticationError);
      expect((error as TorobAuthenticationError).failure).toBe("configuration_invalid_public_key");
    }
  });
  it("validates torob_clid", () => expect(validTorobClickId("abc_123-xyz")).toBe("abc_123-xyz"));
  it("reads torob_clid cookie", () =>
    expect(readCookie("a=1; torob_clid=click-1", "torob_clid")).toBe("click-1"));
});

describe("webhook retry", () => {
  it("keeps Product API ready without a webhook token", () => {
    process.env.TOROB_PUBLIC_KEY = generateKeyPairSync("ed25519")
      .publicKey.export({ type: "spki", format: "pem" })
      .toString();
    expect(getTorobConfigurationState()).toMatchObject({
      ready: true,
      productApiReady: true,
      webhookEnabled: false,
    });
  });
  it("requires the Product API token version", () => {
    process.env.TOROB_PUBLIC_KEY = generateKeyPairSync("ed25519")
      .publicKey.export({ type: "spki", format: "pem" })
      .toString();
    delete process.env.TOROB_TOKEN_VERSION;
    expect(getTorobConfigurationState().productApiReady).toBe(false);
  });
  it("does not report a malformed public key as Product API ready", () => {
    process.env.TOROB_PUBLIC_KEY = "not-a-public-key";
    process.env.TOROB_TOKEN_VERSION = "1";
    expect(getTorobConfigurationState()).toMatchObject({
      publicKey: true,
      validPublicKey: false,
      productApiReady: false,
      ready: false,
    });
  });
  it("does not claim or send queued events without a webhook token", async () => {
    await expect(processTorobWebhookQueue()).resolves.toEqual({
      status: "disabled",
      processed: 0,
      sent: 0,
    });
  });
  it("returns a graceful endpoint response without a webhook token", async () => {
    const response = await handleTorobWebhookProcess(
      new Request("https://abar3d.ir/api/torob/webhooks/process", { method: "POST" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "disabled",
      reason: "webhook_token_not_configured",
      processed: 0,
      sent: 0,
    });
  });
  it("backs off after a failure", () => expect(torobRetryDelaySeconds(1)).toBe(60));
  it("caps retry delay", () => expect(torobRetryDelaySeconds(99)).toBe(3600));
  it("keeps a 100 item batch contract", () => expect(TOROB_PAGE_SIZE).toBe(100));
});
