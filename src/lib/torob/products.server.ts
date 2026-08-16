import "@tanstack/react-start/server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTorobConfig } from "./config.server";
import type { TorobProduct, TorobProductRequest } from "./schema";

export const TOROB_PAGE_SIZE = 100;
export const isTorobVisible = (product: { is_active: boolean }) => product.is_active;

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  price: number;
  compare_at: number | null;
  stock: number;
  material: string | null;
  color: string | null;
  size_mm: string | null;
  description: string | null;
  specs: unknown;
  image_url: string | null;
  image_urls: string[] | null;
  guarantee: string | null;
  torob_product_group_id: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

const COLUMNS =
  "id,slug,name,category_slug,price,compare_at,stock,material,color,size_mm,description,specs,image_url,image_urls,guarantee,torob_product_group_id,created_at,updated_at,is_active";
const LEGACY_COLUMNS =
  "id,slug,name,category_slug,price,compare_at,stock,material,color,size_mm,description,specs,image_url,image_urls,created_at,updated_at,is_active";

async function queryProducts(factory: (columns: string) => PromiseLike<any>) {
  const current = await factory(COLUMNS);
  if (!current.error) return current;
  const message = String(current.error.message ?? "");
  if (!message.includes("guarantee") && !message.includes("torob_product_group_id")) return current;
  return factory(LEGACY_COLUMNS);
}

function absoluteUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function specObject(row: ProductRow): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  if (Array.isArray(row.specs)) {
    for (const entry of row.specs) {
      if (entry && typeof entry === "object") {
        const label = "label" in entry ? String(entry.label ?? "").trim() : "";
        const value = "value" in entry ? entry.value : undefined;
        if (label && (typeof value === "string" || typeof value === "number"))
          result[label] = value;
      }
    }
  }
  if (row.color && !result["رنگ"]) result["رنگ"] = row.color;
  if (row.size_mm && !result["ابعاد"]) result["ابعاد"] = row.size_mm;
  if (row.material && !result["جنس"]) result["جنس"] = row.material;
  return result;
}

export function mapTorobProduct(row: ProductRow, categoryName?: string): TorobProduct {
  const base = getTorobConfig().appUrl;
  const availability = row.is_active && row.stock > 0;
  const main = row.image_url ? [row.image_url] : [];
  const images = [...main, ...(row.image_urls ?? [])]
    .map((url) => absoluteUrl(url, base))
    .filter((url): url is string => Boolean(url));
  const uniqueImages = [...new Set(images)];
  const result: TorobProduct = {
    page_unique: row.id,
    page_url: new URL(`/products/${encodeURIComponent(row.slug)}`, base).href,
    product_group_id: row.torob_product_group_id || row.id,
    title: row.name.slice(0, 500),
    current_price: availability ? Math.trunc(Number(row.price)) : 0,
    availability,
    category_name: categoryName || row.category_slug,
    image_links: uniqueImages,
    spec: specObject(row),
    short_desc: row.description?.slice(0, 500) || undefined,
    date_added: new Date(row.created_at).toISOString(),
    date_updated: new Date(row.updated_at).toISOString(),
  };
  const oldPrice = row.compare_at == null ? null : Math.trunc(Number(row.compare_at));
  if (oldPrice != null && oldPrice > Number(row.price)) result.old_price = oldPrice;
  if (row.guarantee?.trim()) result.guarantee = row.guarantee.trim().slice(0, 200);
  return result;
}

async function categoriesFor(rows: ProductRow[]) {
  const slugs = [...new Set(rows.map((row) => row.category_slug))];
  if (!slugs.length) return new Map<string, string>();
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("slug,name")
    .in("slug", slugs);
  if (error) throw error;
  return new Map((data ?? []).map((category) => [category.slug, category.name]));
}

async function mapRows(rows: ProductRow[]) {
  const categories = await categoriesFor(rows);
  return rows.map((row) => mapTorobProduct(row, categories.get(row.category_slug)));
}

function slugsFromUrls(urls: string[]): string[] {
  const baseHost = new URL(getTorobConfig().appUrl).host;
  return urls.flatMap((value) => {
    const url = new URL(value);
    if (url.host !== baseHost) return [];
    const match = url.pathname.match(/^\/products\/([^/]+)\/?$/);
    return match ? [decodeURIComponent(match[1]!)] : [];
  });
}

export async function fetchTorobProducts(input: TorobProductRequest) {
  let rows: ProductRow[] = [];
  let total = 0;
  let currentPage = 1;

  if ("page" in input) {
    currentPage = input.page;
    const from = (input.page - 1) * TOROB_PAGE_SIZE;
    const column = input.sort === "date_updated_desc" ? "updated_at" : "created_at";
    const { data, error, count } = await queryProducts((columns) =>
      supabaseAdmin
        .from("products")
        .select(columns, { count: "exact" })
        .eq("is_active", true)
        .order(column, { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + TOROB_PAGE_SIZE - 1),
    );
    if (error) throw error;
    rows = (data ?? []) as unknown as ProductRow[];
    total = count ?? 0;
  } else if ("page_uniques" in input) {
    const { data, error } = await queryProducts((columns) =>
      supabaseAdmin
        .from("products")
        .select(columns)
        .eq("is_active", true)
        .in("id", input.page_uniques),
    );
    if (error) throw error;
    rows = (data ?? []) as unknown as ProductRow[];
    total = rows.length;
  } else {
    const slugs = slugsFromUrls(input.page_urls);
    if (slugs.length) {
      const { data, error } = await queryProducts((columns) =>
        supabaseAdmin.from("products").select(columns).eq("is_active", true).in("slug", slugs),
      );
      if (error) throw error;
      rows = (data ?? []) as unknown as ProductRow[];
    }
    total = rows.length;
  }

  return {
    api_version: "torob_api_v3" as const,
    current_page: currentPage,
    total,
    max_pages: Math.max(1, Math.ceil(total / TOROB_PAGE_SIZE)),
    products: await mapRows(rows),
  };
}
