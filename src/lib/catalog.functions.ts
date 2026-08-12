import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { Product } from "@/data/products";
import type { Category } from "@/data/categories";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type Row = Database["public"]["Tables"]["products"]["Row"];

export function mapProduct(r: Row): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category_slug,
    price: Number(r.price),
    compareAt: r.compare_at ? Number(r.compare_at) : undefined,
    stock: r.stock,
    rating: Number(r.rating),
    reviewsCount: r.reviews_count,
    material: r.material ?? "",
    color: r.color ?? "",
    sizeMm: r.size_mm ?? "",
    description: r.description ?? "",
    specs: Array.isArray(r.specs) ? (r.specs as { label: string; value: string }[]) : [],
    featured: r.featured,
    imageUrl: r.image_url ?? r.image_urls?.[0] ?? undefined,
    modelUrl: r.model_url ?? r.model_urls?.[0] ?? undefined,
    images: (r.image_urls ?? []).length ? r.image_urls : r.image_url ? [r.image_url] : [],
    models: (r.model_urls ?? []).length ? r.model_urls : r.model_url ? [r.model_url] : [],
    availableColors: r.available_colors ?? [],
    availableSizes: r.available_sizes ?? [],
  };
}

const PRODUCT_COLUMNS =
  "id, slug, name, category_slug, price, compare_at, stock, rating, reviews_count, material, color, size_mm, description, specs, image_url, model_url, image_urls, model_urls, available_colors, available_sizes, featured, is_active, created_at, updated_at";

export const listCategories = createServerFn({ method: "GET" }).handler(async (): Promise<Category[]> => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug, name, tagline, sort_order, image_url")
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const { data: counts } = await supabase.from("products").select("category_slug").eq("is_active", true);
  const byCat = new Map<string, number>();
  (counts ?? []).forEach((p) => byCat.set(p.category_slug, (byCat.get(p.category_slug) ?? 0) + 1));

  return (data ?? []).map((c) => ({
    slug: c.slug,
    name: c.name,
    tagline: c.tagline ?? "",
    count: byCat.get(c.slug) ?? 0,
    imageUrl: c.image_url ?? undefined,
  }));
});

export const listProducts = createServerFn({ method: "GET" }).handler(async (): Promise<Product[]> => {
  const { data, error } = await publicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapProduct(r as Row));
});

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;

    const product = mapProduct(row as Row);

    const [{ data: related }, { data: reviews }] = await Promise.all([
      supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("category_slug", product.category)
        .eq("is_active", true)
        .neq("id", product.id)
        .limit(4),
      supabase
        .from("reviews")
        .select("id, author_name, rating, body, created_at")
        .eq("product_id", product.id)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return {
      product,
      related: (related ?? []).map((r) => mapProduct(r as Row)),
      reviews: (reviews ?? []).map((r) => ({
        id: r.id,
        name: r.author_name ?? "کاربر",
        rating: r.rating,
        body: r.body ?? "",
      })),
    };
  });

export const validateDiscount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: z.string().trim().min(1).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row } = await publicClient()
      .from("discount_codes")
      .select("code, label, percent, active, expires_at")
      .ilike("code", data.code)
      .eq("active", true)
      .maybeSingle();
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
    return { code: row.code, percent: row.percent, label: row.label ?? `${row.percent}٪ تخفیف` };
  });
