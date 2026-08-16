import { spawn } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import assert from "node:assert/strict";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !publishableKey)
  throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");

const port = 4317;
const host = `127.0.0.1:${port}`;
const apiUrl = `http://${host}/api/torob/products`;
const appUrl = "https://abar3d.ir";
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

const server = spawn(process.execPath, [".output/server/index.mjs"], {
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    APP_URL: appUrl,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    // The public key is intentionally used for this read-only integration test.
    SUPABASE_SERVICE_ROLE_KEY: publishableKey,
    TOROB_PUBLIC_KEY: publicPem,
    TOROB_TOKEN_VERSION: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk.toString()));
server.stderr.on("data", (chunk) => (serverLog += chunk.toString()));

function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT", v: 1 })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ aud: host, nbf: now - 5, exp: now + 60 })).toString(
    "base64url",
  );
  const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey).toString(
    "base64url",
  );
  return `${header}.${payload}.${signature}`;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://${host}/robots.txt`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start. ${serverLog.slice(-1000)}`);
}

async function post(body) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-torob-token": jwt(),
      "x-torob-token-version": "1",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  assert.equal(response.status, 200, JSON.stringify(json));
  return json;
}

function expectedSpec(row) {
  const result = {};
  for (const item of Array.isArray(row.specs) ? row.specs : []) {
    if (item?.label && (typeof item.value === "string" || typeof item.value === "number"))
      result[item.label] = item.value;
  }
  if (row.color && !result["رنگ"]) result["رنگ"] = row.color;
  if (row.size_mm && !result["ابعاد"]) result["ابعاد"] = row.size_mm;
  if (row.material && !result["جنس"]) result["جنس"] = row.material;
  return result;
}

function expectedImages(row) {
  return [...new Set([...(row.image_url ? [row.image_url] : []), ...(row.image_urls ?? [])])].map(
    (value) => new URL(value, appUrl).href,
  );
}

function audit(row, product, categoryName) {
  assert.equal(product.page_unique, row.id);
  assert.equal(product.page_url, `${appUrl}/products/${encodeURIComponent(row.slug)}`);
  assert.equal(product.product_group_id, row.id);
  assert.equal(product.title, row.name);
  assert.ok(product.title.trim().length > 0);
  assert.equal(product.current_price, row.stock > 0 ? Number(row.price) : 0);
  assert.equal(product.availability, row.stock > 0);
  assert.deepEqual(product.image_links, expectedImages(row));
  assert.ok(product.image_links.length > 0, `${row.slug} has no product image`);
  assert.deepEqual(product.spec, expectedSpec(row));
  assert.equal(product.category_name, categoryName);
  assert.equal(Object.hasOwn(product, "guarantee"), false);
  assert.equal(
    Object.hasOwn(product, "old_price"),
    row.compare_at != null && Number(row.compare_at) > Number(row.price),
  );
  if (Object.hasOwn(product, "old_price")) assert.equal(product.old_price, Number(row.compare_at));
  assert.ok(product.date_added.endsWith("Z"));
  assert.ok(product.date_updated.endsWith("Z"));
}

try {
  const select =
    "id,slug,name,price,compare_at,stock,is_active,category_slug,image_url,image_urls,specs,material,color,size_mm,description,created_at,updated_at";
  const sourceResponse = await fetch(
    `${supabaseUrl}/rest/v1/products?select=${select}&is_active=eq.true&order=created_at.desc&limit=100`,
    {
      headers: { apikey: publishableKey },
    },
  );
  assert.equal(sourceResponse.ok, true);
  const rows = await sourceResponse.json();
  const categoryResponse = await fetch(`${supabaseUrl}/rest/v1/categories?select=slug,name`, {
    headers: { apikey: publishableKey },
  });
  assert.equal(categoryResponse.ok, true);
  const categoryNames = new Map(
    (await categoryResponse.json()).map((category) => [category.slug, category.name]),
  );
  const available = rows.find((row) => row.stock > 0);
  const unavailable = rows.find((row) => row.stock <= 0);
  const third = rows.find((row) => row.stock > 0 && row.id !== available?.id);
  assert.ok(available && unavailable && third, "Three suitable real products were not found");
  const selected = [available, unavailable, third];

  await waitForServer();
  const healthResponse = await fetch(`http://${host}/api/torob/health`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.status, "ok");
  assert.equal(health.products_available, rows.length);

  const sitemapResponse = await fetch(`http://${host}/product-sitemap.xml`);
  assert.equal(sitemapResponse.status, 200);
  assert.match(sitemapResponse.headers.get("content-type") || "", /application\/xml/);
  const sitemap = await sitemapResponse.text();
  for (const row of rows) assert.ok(sitemap.includes(`${appUrl}/products/${row.slug}`));

  const robotsResponse = await fetch(`http://${host}/robots.txt`);
  assert.equal(robotsResponse.status, 200);
  assert.match(await robotsResponse.text(), /Sitemap: https:\/\/abar3d\.ir\/product-sitemap\.xml/);

  const page = await post({ page: 1, sort: "date_added_desc" });
  assert.equal(page.api_version, "torob_api_v3");
  assert.equal(page.total, rows.length);
  assert.equal(page.products.length, rows.length);
  for (const row of rows) {
    const product = page.products.find((item) => item.page_unique === row.id);
    assert.ok(product, `${row.id} is missing from pagination output`);
    audit(row, product, categoryNames.get(row.category_slug) || row.category_slug);
  }

  const byUrls = await post({ page_urls: selected.map((row) => `${appUrl}/products/${row.slug}`) });
  const byUniques = await post({ page_uniques: selected.map((row) => row.id) });
  assert.equal(byUrls.products.length, 3);
  assert.equal(byUniques.products.length, 3);

  const audited = selected.map((row) => {
    const urlProduct = byUrls.products.find((product) => product.page_unique === row.id);
    const uniqueProduct = byUniques.products.find((product) => product.page_unique === row.id);
    assert.ok(urlProduct && uniqueProduct);
    audit(row, urlProduct, categoryNames.get(row.category_slug) || row.category_slug);
    assert.deepEqual(uniqueProduct, urlProduct);
    return urlProduct;
  });

  for (const product of audited) {
    assert.ok(product.image_links.length > 0, `${product.page_unique} has no image`);
    for (const image of product.image_links) {
      const imageResponse = await fetch(image, { method: "HEAD" });
      assert.ok(imageResponse.ok, `${image} returned ${imageResponse.status}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        source_total: rows.length,
        smoke: {
          health: healthResponse.status,
          products_pagination: 200,
          products_page_urls: 200,
          products_page_uniques: 200,
          sitemap: sitemapResponse.status,
          robots: robotsResponse.status,
        },
        audited_products: audited,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill();
}
