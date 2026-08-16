import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: unknown, userId: string) {
  const client = supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const { data } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("دسترسی مدیریتی ندارید.");
}


async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ---------------- access ---------------- */

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const db = await admin();
    const { count } = await db.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    return { isAdmin: data === true, adminExists: (count ?? 0) > 0 };
  });

/** First signed-in user can claim admin while no admin exists yet. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { count } = await db.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("مدیر قبلاً تعیین شده است.");
    const { error } = await db.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- dashboard ---------------- */

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const [orders, products, users, reviews] = await Promise.all([
      db.from("orders").select("id, code, total, status, payment_status, created_at").order("created_at", { ascending: false }),
      db.from("products").select("id, stock, is_active"),
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("reviews").select("id", { count: "exact", head: true }).eq("approved", false),
    ]);
    const rows = orders.data ?? [];
    const paid = rows.filter((o) => o.payment_status === "paid");
    return {
      revenue: paid.reduce((n, o) => n + Number(o.total), 0),
      ordersCount: rows.length,
      pendingCount: rows.filter((o) => o.status === "pending" || o.status === "processing").length,
      productsCount: (products.data ?? []).length,
      lowStock: (products.data ?? []).filter((p) => p.stock <= 3).length,
      usersCount: users.count ?? 0,
      pendingReviews: reviews.count ?? 0,
      recentOrders: rows.slice(0, 8).map((o) => ({
        id: o.id,
        code: o.code,
        total: Number(o.total),
        status: o.status,
        paymentStatus: o.payment_status,
        createdAt: o.created_at,
      })),
    };
  });

export const adminTorobOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const [products, pending, sent, recent] = await Promise.all([
      db.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      (db as any).from("torob_webhook_queue").select("id", { count: "exact", head: true }).in("status", ["pending", "processing", "failed"]),
      (db as any).from("torob_webhook_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
      (db as any).from("torob_sync_events").select("success,item_count,message,created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    return {
      productsAvailable: products.count ?? 0,
      queuePending: pending.count ?? 0,
      webhookSent: sent.count ?? 0,
      configuration: {
        publicKey: Boolean(process.env.TOROB_PUBLIC_KEY?.trim()),
        webhookToken: Boolean(process.env.TOROB_WEBHOOK_TOKEN?.trim()),
        queueSecret: Boolean(process.env.TOROB_QUEUE_SECRET?.trim()),
        orderTracking: process.env.TOROB_ORDER_TRACKING_ENABLED === "true",
      },
      recent: recent.data ?? [],
    };
  });

/* ---------------- products ---------------- */

export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data, error } = await db
      .from("products")
      .select("id, slug, name, category_slug, price, compare_at, stock, featured, is_active, material, color, size_mm, description, image_url, model_url, image_urls, model_urls, available_colors, available_sizes, is_bookmark")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((p) => ({ ...p, price: Number(p.price), compare_at: p.compare_at ? Number(p.compare_at) : null }));
  });

const productSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "اسلاگ فقط حروف انگلیسی کوچک و خط تیره"),
  name: z.string().trim().min(2).max(120),
  categorySlug: z.string().trim().min(1).max(60),
  price: z.number().int().min(0).max(1_000_000_000),
  compareAt: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  stock: z.number().int().min(0).max(100000),
  material: z.string().trim().max(60).optional().nullable(),
  color: z.string().trim().max(60).optional().nullable(),
  sizeMm: z.string().trim().max(60).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  modelUrl: z.string().trim().max(500).optional().nullable(),
  imageUrls: z.array(z.string().trim().max(500)).max(12).optional(),
  modelUrls: z.array(z.string().trim().max(500)).max(12).optional(),
  availableColors: z.array(z.string().trim().max(60)).optional(),
  availableSizes: z.array(z.string().trim().max(60)).optional(),
  featured: z.boolean(),
  isActive: z.boolean(),
  isBookmark: z.boolean().optional(),
  modelMetadata: z.record(z.any()).optional(),
  imageMetadata: z.record(z.any()).optional(),

});

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => productSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const row = {
      slug: data.slug,
      name: data.name,
      category_slug: data.categorySlug,
      price: data.price,
      compare_at: data.compareAt ?? null,
      stock: data.stock,
      material: data.material ?? null,
      color: data.color ?? null,
      size_mm: data.sizeMm ?? null,
      description: data.description ?? null,
      featured: data.featured,
      is_active: data.isActive,
      image_url: data.imageUrl ?? data.imageUrls?.[0] ?? null,
      model_url: data.modelUrl ?? data.modelUrls?.[0] ?? null,
      image_urls: data.imageUrls ?? [],
      model_urls: data.modelUrls ?? [],
      available_colors: data.availableColors ?? [],
      available_sizes: data.availableSizes ?? [],
      model_metadata: data.modelMetadata ?? {},
      image_metadata: data.imageMetadata ?? {},
      is_bookmark: data.isBookmark ?? false,
    };
    const { error } = data.id
      ? await db.from("products").update(row).eq("id", data.id)
      : await db.from("products").insert(row);
    if (error) throw error;
    return { ok: true };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db.from("products").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- categories ---------------- */

export const adminListCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data, error } = await db
      .from("categories")
      .select("id, slug, name, tagline, sort_order, image_url")
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional().nullable(),
        slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/),
        name: z.string().trim().min(1).max(80),
        tagline: z.string().trim().max(140).optional().nullable(),
        sortOrder: z.number().int().min(0).max(999),
        imageUrl: z.string().trim().max(500).optional().nullable(),

      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const row = { slug: data.slug, name: data.name, tagline: data.tagline ?? null, sort_order: data.sortOrder, image_url: data.imageUrl ?? null };
    const { error } = data.id
      ? await db.from("categories").update(row).eq("id", data.id)
      : await db.from("categories").insert(row);
    if (error) throw error;
    return { ok: true };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db.from("categories").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- orders ---------------- */

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data, error } = await db
      .from("orders")
      .select("id, code, created_at, status, payment_status, total, tracking_code, shipping_address, order_items(id, name, qty, price, color, size)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((o) => ({
      id: o.id,
      code: o.code,
      createdAt: o.created_at,
      status: o.status,
      paymentStatus: o.payment_status,
      total: Number(o.total),
      trackingCode: o.tracking_code,
      address: o.shipping_address as Record<string, string> | null,
      items: (o.order_items ?? []).map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: Number(i.price), color: i.color, size: i.size })),
    }));
  });

export const adminUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "processing", "printing", "shipped", "delivered", "cancelled"]),
        paymentStatus: z.enum(["unpaid", "paid", "refunded"]),
        trackingCode: z.string().trim().max(60).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db
      .from("orders")
      .update({
        status: data.status,
        payment_status: data.paymentStatus,
        tracking_code: data.trackingCode || null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- users ---------------- */

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const [{ data: profiles }, { data: roles }, { data: orders }, list] = await Promise.all([
      db.from("profiles").select("id, full_name, phone, created_at").order("created_at", { ascending: false }),
      db.from("user_roles").select("user_id, role"),
      db.from("orders").select("user_id, total, payment_status"),
      db.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);
    const emails = new Map((list.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    return (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name ?? "",
      phone: p.phone ?? "",
      email: emails.get(p.id) ?? "",
      createdAt: p.created_at,
      isAdmin: (roles ?? []).some((r) => r.user_id === p.id && r.role === "admin"),
      ordersCount: (orders ?? []).filter((o) => o.user_id === p.id).length,
      spent: (orders ?? [])
        .filter((o) => o.user_id === p.id && o.payment_status === "paid")
        .reduce((n, o) => n + Number(o.total), 0),
    }));
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.makeAdmin) {
      throw new Error("نمی‌توانید دسترسی مدیریت خودتان را حذف کنید.");
    }
    const db = await admin();
    if (data.makeAdmin) {
      const { error } = await db
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw error;
    } else {
      const { error } = await db.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw error;
    }
    return { ok: true };
  });

/* ---------------- discounts ---------------- */

export const adminListDiscounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data, error } = await db
      .from("discount_codes")
      .select("id, code, label, percent, active, max_uses, used_count, expires_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const adminSaveDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional().nullable(),
        code: z.string().trim().min(2).max(40),
        label: z.string().trim().max(80).optional().nullable(),
        percent: z.number().int().min(1).max(90),
        active: z.boolean(),
        maxUses: z.number().int().min(0).max(100000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const row = {
      code: data.code.toUpperCase(),
      label: data.label ?? null,
      percent: data.percent,
      active: data.active,
      max_uses: data.maxUses ?? null,
    };
    const { error } = data.id
      ? await db.from("discount_codes").update(row).eq("id", data.id)
      : await db.from("discount_codes").insert(row);
    if (error) throw error;
    return { ok: true };
  });

export const adminDeleteDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db.from("discount_codes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- reviews ---------------- */

export const adminListReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data, error } = await db
      .from("reviews")
      .select("id, rating, body, author_name, approved, created_at, products(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body ?? "",
      author: r.author_name ?? "کاربر",
      approved: r.approved,
      createdAt: r.created_at,
      productName: (r.products as { name: string } | null)?.name ?? "—",
    }));
  });

export const adminSetReviewApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), approved: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db.from("reviews").update({ approved: data.approved }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const adminDeleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { error } = await db.from("reviews").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- settings ---------------- */

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data } = await db.from("site_settings").select("key, value");
    const map: Record<string, string | number> = {};
    for (const row of data ?? []) {
      const v = row.value;
      map[row.key] = typeof v === "number" || typeof v === "string" ? v : String(v ?? "");
    }
    return map;
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeName: z.string().trim().max(80),
        supportPhone: z.string().trim().max(30),
        supportEmail: z.string().trim().max(120),
        announcement: z.string().trim().max(200),
        shippingStandard: z.number().int().min(0).max(10_000_000),
        shippingExpress: z.number().int().min(0).max(10_000_000),
        freeShippingOver: z.number().int().min(0).max(100_000_000),
        zibalEnabled: z.boolean(),
        zibalMerchant: z.string().trim().max(100),
        zibalSandbox: z.boolean(),
        heroModelUrl: z.string().trim().max(500).optional().nullable(),
      })

      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const rows = Object.entries(data).map(([key, value]) => ({ key, value: value as never }));
    const { error } = await db.from("site_settings").upsert(rows, { onConflict: "key" });
    if (error) throw error;
    return { ok: true };
  });
