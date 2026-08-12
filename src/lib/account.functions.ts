import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrderSummary = {
  id: string;
  code: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  total: number;
  itemsCount: number;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: addresses } = await context.supabase
      .from("addresses")
      .select("id, title, receiver, phone, province, city, line, postal_code, is_default")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return {
      profile: { fullName: data?.full_name ?? "", phone: data?.phone ?? "" },
      addresses: addresses ?? [],
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().trim().max(80),
        phone: z.string().trim().max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ id: context.userId, full_name: data.fullName, phone: data.phone });
    if (error) throw error;
    return { ok: true };
  });

const addressSchema = z.object({
  title: z.string().trim().max(40).optional(),
  receiver: z.string().trim().min(2, "نام گیرنده باید حداقل ۲ کاراکتر باشد").max(80),
  phone: z.string().trim().min(6, "شماره تماس باید حداقل ۶ رقم باشد").max(20),
  province: z.string().trim().min(2, "نام استان باید حداقل ۲ کاراکتر باشد").max(40),
  city: z.string().trim().min(2, "نام شهر باید حداقل ۲ کاراکتر باشد").max(40),
  line: z.string().trim().min(5, "آدرس پستی باید حداقل ۵ کاراکتر باشد").max(300),
  postalCode: z.string().trim().max(20).optional().nullable(),
});

export const addMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addressSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("addresses").insert({
      user_id: context.userId,
      title: data.title ?? "آدرس من",
      receiver: data.receiver,
      phone: data.phone,
      province: data.province,
      city: data.city,
      line: data.line,
      postal_code: data.postalCode ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("addresses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrderSummary[]> => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, code, created_at, status, payment_status, payment_method, total, order_items(id)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((o) => ({
      id: o.id,
      code: o.code,
      createdAt: o.created_at,
      status: o.status,
      paymentStatus: o.payment_status,
      paymentMethod: o.payment_method,
      total: Number(o.total),
      itemsCount: (o.order_items as { id: string }[] | null)?.length ?? 0,
    }));
  });

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select(
        "id, code, created_at, status, payment_status, subtotal, shipping_amount, discount_amount, discount_code, total, tracking_code, shipping_address, payment_method, order_items(id, name, qty, price, product_slug)",
      )
      .eq("user_id", context.userId)
      .or(`id.eq.${/^[0-9a-f-]{36}$/i.test(data.id) ? data.id : "00000000-0000-0000-0000-000000000000"},code.eq.${data.id}`)
      .maybeSingle();
    if (error) throw error;
    if (!order) return null;
    return {
      id: order.id,
      code: order.code,
      createdAt: order.created_at,
      status: order.status,
      paymentStatus: order.payment_status,
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping_amount),
      discount: Number(order.discount_amount),
      discountCode: order.discount_code,
      total: Number(order.total),
      trackingCode: order.tracking_code,
      paymentMethod: order.payment_method,
      shippingAddress: order.shipping_address as Record<string, string> | null,
      items: (order.order_items ?? []).map((it) => ({
        id: it.id,
        name: it.name,
        qty: it.qty,
        price: Number(it.price),
        slug: it.product_slug,
      })),
    };
  });

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        items: z
          .array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(50) }))
          .min(1)
          .max(50),
        shipping: z.enum(["standard", "express"]),
        payment: z.enum(["gateway", "cod"]),
        discountCode: z.string().trim().max(40).optional().nullable(),
        address: addressSchema,
        note: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const ids = data.items.map((i) => i.productId);
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, name, slug, price, stock, is_active")
      .in("id", ids);
    if (pErr) throw pErr;

    const lines = data.items.map((i) => {
      const p = (products ?? []).find((x) => x.id === i.productId);
      if (!p || !p.is_active) throw new Error("یکی از محصولات دیگر موجود نیست.");
      if (p.stock < i.qty) throw new Error(`موجودی «${p.name}» کافی نیست.`);
      return { product: p, qty: i.qty };
    });

    const subtotal = lines.reduce((n, l) => n + Number(l.product.price) * l.qty, 0);
    const shipping = data.shipping === "express" ? 120000 : 65000;

    let discount = 0;
    let discountCode: string | null = null;
    if (data.discountCode) {
      const { data: dc } = await supabase
        .from("discount_codes")
        .select("code, percent, active, expires_at")
        .ilike("code", data.discountCode)
        .eq("active", true)
        .maybeSingle();
      if (dc && (!dc.expires_at || new Date(dc.expires_at) > new Date())) {
        discount = Math.round((subtotal * dc.percent) / 100);
        discountCode = dc.code;
      }
    }

    const total = Math.max(0, subtotal - discount) + shipping;
    const code = `PR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`;

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .insert({
        user_id: context.userId,
        code,
        subtotal,
        shipping_amount: shipping,
        discount_amount: discount,
        discount_code: discountCode,
        total,
        payment_method: data.payment,
        payment_status: "unpaid",
        status: data.payment === "cod" ? "processing" : "pending",
        note: data.note ?? null,
        shipping_address: data.address,
      })
      .select("id, code")
      .single();
    if (oErr) throw oErr;

    const { error: iErr } = await supabase.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product.id,
        product_slug: l.product.slug,
        name: l.product.name,
        price: Number(l.product.price),
        qty: l.qty,
      })),
    );
    if (iErr) throw iErr;

    await supabase.rpc("apply_order_stock", { _order_id: order.id });

    return { id: order.id, code: order.code };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        body: z.string().trim().min(3).max(600),
        authorName: z.string().trim().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: bought } = await context.supabase
      .from("order_items")
      .select("id, orders!inner(user_id)")
      .eq("product_id", data.productId)
      .eq("orders.user_id", context.userId)
      .limit(1);

    const { error } = await context.supabase.from("reviews").insert({
      product_id: data.productId,
      user_id: context.userId,
      rating: data.rating,
      body: data.body,
      author_name: data.authorName || "کاربر ابر تری دی",
      approved: false,
    });
    if (error) throw error;
    return { ok: true, verifiedBuyer: (bought ?? []).length > 0 };
  });
