import { createFileRoute } from "@tanstack/react-router";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyTorobRequest, unauthorized } from "@/lib/torob/auth.server";
import { getTorobConfig } from "@/lib/torob/config.server";
import { allowTorobRequest } from "@/lib/torob/rate-limit.server";

const querySchema = z.object({
  purchase_timestamp_gt: z.string().datetime({ offset: true }),
  limit: z.coerce.number().int().min(1).max(1000),
});

export const Route = createFileRoute("/api/torob/v1/orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          verifyTorobRequest(request);
        } catch {
          return unauthorized();
        }
        if (!allowTorobRequest(request))
          return Response.json(
            { error: "rate limit exceeded" },
            { status: 429, headers: { "Retry-After": "60" } },
          );
        if (!getTorobConfig().orderTrackingEnabled)
          return Response.json({ error: "order tracking access is disabled" }, { status: 403 });
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
          purchase_timestamp_gt: url.searchParams.get("purchase_timestamp_gt"),
          limit: url.searchParams.get("limit"),
        });
        if (!parsed.success)
          return Response.json(
            { error: parsed.error.issues[0]?.message || "invalid request" },
            { status: 400 },
          );
        try {
          const { data, error } = await (supabaseAdmin as any)
            .from("orders")
            .select(
              "created_at,updated_at,torob_clid,status,payment_status,payment_method,subtotal,discount_amount,shipping_amount,shipping_address,order_items(product_slug,price,qty)",
            )
            .not("torob_clid", "is", null)
            .gt("created_at", new Date(parsed.data.purchase_timestamp_gt).toISOString())
            .order("created_at", { ascending: true })
            .limit(parsed.data.limit);
          if (error) throw error;
          const base = getTorobConfig().appUrl;
          const orders = (data ?? []).map((order: any) => ({
            purchase_timestamp: new Date(order.created_at).toISOString(),
            last_updated_timestamp: new Date(order.updated_at).toISOString(),
            torob_clid: order.torob_clid,
            status:
              order.status === "cancelled" || order.payment_status === "refunded"
                ? "cancelled"
                : "completed",
            ...(order.payment_method ? { psp: String(order.payment_method) } : {}),
            order_value: Math.max(
              0,
              Math.trunc(Number(order.subtotal) - Number(order.discount_amount)),
            ),
            shipping_amount: Math.trunc(Number(order.shipping_amount)),
            ...(order.shipping_address?.phone
              ? { phone_number: String(order.shipping_address.phone) }
              : {}),
            products: (order.order_items ?? [])
              .filter((item: any) => item.product_slug)
              .map((item: any) => ({
                product_url: new URL(`/products/${encodeURIComponent(item.product_slug)}`, base)
                  .href,
                product_price: Math.trunc(Number(item.price)),
                quantity: item.qty,
              })),
          }));
          return Response.json(
            { success: true, data: orders },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          console.error("[Torob Order API] request failed", {
            error: error instanceof Error ? error.message : "unknown error",
          });
          return Response.json({ error: "internal server error" }, { status: 500 });
        }
      },
    },
  },
});
