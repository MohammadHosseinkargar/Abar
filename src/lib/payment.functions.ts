import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Zibal payment gateway.
 * Merchant code is read from site_settings (DB) or fallback to process.env.
 */

async function getPaymentSettings(supabase: any) {
  const { data } = await supabase.from("site_settings").select("key, value");
  const settings: Record<string, any> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }
  return {
    enabled: settings.zibalEnabled ?? false,
    merchant: settings.zibalMerchant || process.env.ZIBAL_MERCHANT || "zibal",
    sandbox: settings.zibalSandbox ?? true,
  };
}

type ZibalVerifyResponse = {
  result: number;
  amount?: number;
  refNumber?: number;
  message?: string;
  orderId?: string;
};

async function verifyWithZibal(merchant: string, trackId: string): Promise<ZibalVerifyResponse> {
  const res = await fetch("https://gateway.zibal.ir/v1/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ merchant, trackId: Number(trackId) }),
  });
  if (!res.ok) throw new Error("ZIBAL_UNAVAILABLE");
  return (await res.json()) as ZibalVerifyResponse;
}

function assertVerifiedAmount(result: ZibalVerifyResponse, orderTotal: number) {
  if (result.result === 201) return;
  const amount = Math.round(result.amount || 0);
  const expected = Math.round(orderTotal * 10);
  const legacy = Math.round(orderTotal);
  if (amount !== expected && amount !== legacy) throw new Error("PAYMENT_AMOUNT_MISMATCH");
}

async function markOrderPaid(supabase: any, orderId: string, result: ZibalVerifyResponse) {
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "processing",
      ...(result.refNumber ? { payment_ref_id: String(result.refNumber) } : {}),
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("payment_status", "unpaid");
  if (error) throw error;
}

export const getPaymentGatewayInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getPaymentSettings(context.supabase);
  });

export const adminTestZibal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Basic check if user is admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("دسترسی غیرمجاز");

    const settings = await getPaymentSettings(context.supabase);
    
    // Zibal doesn't have a dedicated health check endpoint, 
    // but we can try to request a 1000 Toman transaction and see if merchant is valid result 100 or specific error
    const res = await fetch("https://gateway.zibal.ir/v1/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchant: settings.merchant,
        amount: 1000,
        callbackUrl: "https://example.com",
        description: "Test Connection",
      }),
    });

    const json = (await res.json()) as { result: number; message?: string };
    
    // Result 100 means merchant is valid and can create requests
    // Result 102 (invalid merchant) or others
    if (json.result === 100 || json.result === 102 || json.result === 103) {
      return { 
        ok: json.result === 100, 
        result: json.result, 
        message: json.result === 100 ? "اتصال برقرار است و کد پذیرنده معتبر می‌باشد." : `کد پذیرنده نامعتبر است (${json.result})`
      };
    }
    
    return { ok: false, result: json.result, message: json.message || "خطا در برقراری ارتباط با زیبال" };
  });


const startSchema = z.object({
  orderId: z.string().uuid(),
  callbackUrl: z.string().url().max(300),
});

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

    const settings = await getPaymentSettings(context.supabase);

    // Reconcile the previous attempt before issuing another payment request.
    if (order.payment_authority) {
      const previous = await verifyWithZibal(settings.merchant, String(order.payment_authority));
      if (previous.result === 100 || previous.result === 201) {
        assertVerifiedAmount(previous, Number(order.total));
        await markOrderPaid(context.supabase, order.id, previous);
        return { mode: "already-paid" as const };
      }
    }

    // If both disabled and no merchant, or explicitly disabled
    if (!settings.enabled && settings.merchant === "zibal") {
       // Simulated payment fallback if not configured
       await context.supabase
         .from("orders")
         .update({ payment_status: "paid", status: "processing", paid_at: new Date().toISOString() })
         .eq("id", order.id);
       return { mode: "simulated" as const };
    }

    const isAllowedDomain = data.callbackUrl.includes("abar3d.ir") || 
      data.callbackUrl.includes("localhost") || 
      data.callbackUrl.includes("lovable.app");

    if (!/^https?:\/\//.test(data.callbackUrl) || !data.callbackUrl.includes("/payment/callback") || !isAllowedDomain) {
      throw new Error("آدرس بازگشت نامعتبر است.");
    }

    const API_URL = "https://gateway.zibal.ir/v1/request";
    // Application prices are in toman; Zibal's API amount is in rial.
    const amount = Math.round(Number(order.total) * 10);
    
    // Official Zibal V1 request
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchant: settings.merchant,
        amount: amount,
        callbackUrl: `${data.callbackUrl}?order=${order.id}`,
        description: `سفارش ${order.code} — عبر تری دی`,
        orderId: order.code,
      }),
    });

    const json = (await res.json()) as { result: number; trackId?: number; message?: string };
    
    if (json.result !== 100 || !json.trackId) {
      const errorCode = `ZIBAL_ERROR_${json.result}`;
      throw new Error(errorCode);
    }

    await context.supabase
      .from("orders")
      .update({ 
        payment_authority: String(json.trackId), 
        payment_method: "zibal" 
      })
      .eq("id", order.id);

    const redirectUrl = `https://gateway.zibal.ir/start/${json.trackId}`;
    return { mode: "redirect" as const, url: redirectUrl };
  });

const verifySchema = z.object({
  orderId: z.string().uuid(),
  trackId: z.string().trim().min(1),
  success: z.string().optional(),
  status: z.string().optional(),
});

export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => {
    // A bank callback must not depend on the customer's access token surviving
    // an external browser/app round-trip. Zibal remains the source of truth.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, code, total, payment_status, payment_authority")
      .eq("id", data.orderId)
      .maybeSingle();

    if (error) throw error;
    if (!order) throw new Error("سفارش پیدا نشد.");
    
    // Check if already paid (idempotency)
    if (order.payment_status === "paid") {
      return { ok: true as const, code: order.code, orderId: order.id, refId: null };
    }

    if (String(order.payment_authority) !== data.trackId) {
      throw new Error("PAYMENT_VERIFY_FAILED");
    }

    const settings = await getPaymentSettings(supabaseAdmin);
    const json = await verifyWithZibal(settings.merchant, data.trackId);

    // 201 is also safe: the same transaction was already verified by an earlier callback.
    if (json.result !== 100 && json.result !== 201) {
      const errorCode = `ZIBAL_ERROR_${json.result}`;
      throw new Error(errorCode);
    }

    assertVerifiedAmount(json, Number(order.total));
    await markOrderPaid(supabaseAdmin, order.id, json);

    return {
      ok: true as const,
      code: order.code,
      orderId: order.id,
      refId: json.refNumber ? String(json.refNumber) : null,
    };
  });
