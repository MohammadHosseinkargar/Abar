import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function callbackUrlFromEnvironment(): string {
  const raw = process.env.APP_URL?.trim();
  if (!raw) throw new Error("PAYMENT_CALLBACK_NOT_CONFIGURED");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("PAYMENT_CALLBACK_NOT_CONFIGURED");
  }
  url.pathname = "/api/payment/zibal/callback";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export const getPaymentGatewayInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getZibalSettings } = await import("@/lib/payment-processing.server");
    const settings = await getZibalSettings(context.supabase);
    return { enabled: settings.enabled };
  });

export const adminTestZibal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("دسترسی غیرمجاز");

    const [{ getZibalSettings }, { requestZibalPayment }] = await Promise.all([
      import("@/lib/payment-processing.server"),
      import("@/lib/zibal.server"),
    ]);
    const settings = await getZibalSettings(context.supabase);
    if (!settings.enabled || !settings.merchant) throw new Error("ZIBAL_INVALID_MERCHANT");
    const json = await requestZibalPayment({
      merchant: settings.merchant,
      amountRial: 10_000,
      callbackUrl: callbackUrlFromEnvironment(),
      description: "Zibal connection test",
      orderId: `test-${Date.now()}`,
    });
    return {
      ok: json.result === 100,
      result: json.result,
      message:
        json.result === 100
          ? "اتصال به زیبال برقرار است."
          : json.message || `خطای زیبال (${json.result})`,
    };
  });

const startSchema = z.object({ orderId: z.string().uuid() });

export const startPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, code, total, payment_status, payment_authority")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("سفارش پیدا نشد.");
    if (order.payment_status === "paid") return { mode: "already-paid" as const };

    const [{ getZibalSettings, processZibalCallback, recordPaymentAttempt }, zibal] =
      await Promise.all([import("@/lib/payment-processing.server"), import("@/lib/zibal.server")]);
    const settings = await getZibalSettings(context.supabase);
    if (!settings.enabled || !settings.merchant) throw new Error("ZIBAL_INVALID_MERCHANT");

    if (order.payment_authority) {
      try {
        await processZibalCallback(order.id, String(order.payment_authority));
        return { mode: "already-paid" as const };
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "ZIBAL_ERROR_202") throw error;
      }
    }

    const json = await zibal.requestZibalPayment({
      merchant: settings.merchant,
      amountRial: zibal.tomanToRial(Number(order.total)),
      callbackUrl: `${callbackUrlFromEnvironment()}?order=${encodeURIComponent(order.id)}`,
      description: `سفارش ${order.code} — ابر تری دی`,
      orderId: order.code,
    });
    if (json.result !== 100 || !json.trackId) throw new Error(`ZIBAL_ERROR_${json.result}`);

    const trackId = String(json.trackId);
    let updateQuery = context.supabase
      .from("orders")
      .update({ payment_authority: trackId, payment_method: "zibal" })
      .eq("id", order.id)
      .eq("payment_status", "unpaid");
    updateQuery = order.payment_authority
      ? updateQuery.eq("payment_authority", order.payment_authority)
      : updateQuery.is("payment_authority", null);
    const { data: updated, error: updateError } = await updateQuery.select("id").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) throw new Error("PAYMENT_REQUEST_CONFLICT");

    await recordPaymentAttempt(trackId, order.id, "requested");

    return { mode: "redirect" as const, url: `https://gateway.zibal.ir/start/${trackId}` };
  });

const verifySchema = z.object({
  orderId: z.string().uuid(),
  trackId: z.string().regex(/^\d{1,30}$/),
  success: z.string().optional(),
  status: z.string().optional(),
});

export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => {
    const { processZibalCallback } = await import("@/lib/payment-processing.server");
    return processZibalCallback(data.orderId, data.trackId);
  });
