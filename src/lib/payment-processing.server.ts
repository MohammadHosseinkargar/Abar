import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { assertZibalVerifiedAmount, verifyZibalPayment } from "@/lib/zibal.server";
import type { SupabaseClient } from "@supabase/supabase-js";

type PaymentDatabaseAccess = {
  from: (table: "payment_attempts") => {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error: { code?: string } | null }>;
  };
  rpc: (
    name: "finalize_zibal_payment",
    args: Record<string, unknown>,
  ) => Promise<{
    data: { paid?: boolean; code?: string; ref_id?: string | null } | null;
    error: Error | null;
  }>;
};

const paymentDatabase = supabaseAdmin as unknown as PaymentDatabaseAccess;

export async function getZibalSettings(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["zibalEnabled", "zibalMerchant", "zibalSandbox"]);
  if (error) throw error;
  const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  const sandbox = settings.zibalSandbox === true;
  return {
    enabled: settings.zibalEnabled === true,
    sandbox,
    merchant: sandbox
      ? "zibal"
      : String(settings.zibalMerchant || process.env.ZIBAL_MERCHANT || "").trim(),
  };
}

export async function recordPaymentAttempt(
  trackId: string,
  orderId: string,
  state: string,
  gatewayResult?: number,
) {
  const { error } = await paymentDatabase.from("payment_attempts").upsert(
    {
      provider: "zibal",
      track_id: trackId,
      order_id: orderId,
      state,
      gateway_result: gatewayResult ?? null,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "provider,track_id" },
  );
  if (error)
    console.error("[payment:zibal] could not record payment attempt", {
      orderId,
      state,
      code: error.code,
    });
}

export async function processZibalCallback(orderId: string, trackId: string) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, code, total, payment_status, payment_authority, payment_ref_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) throw new Error("PAYMENT_ORDER_NOT_FOUND");
  if (String(order.payment_authority ?? "") !== trackId) {
    console.warn("[payment:zibal] callback trackId mismatch", { orderId });
    throw new Error("PAYMENT_VERIFY_FAILED");
  }

  if (order.payment_status === "paid") {
    return { ok: true as const, code: order.code, orderId: order.id, refId: order.payment_ref_id };
  }

  const settings = await getZibalSettings(supabaseAdmin);
  if (!settings.enabled || !settings.merchant) throw new Error("ZIBAL_INVALID_MERCHANT");

  await recordPaymentAttempt(trackId, order.id, "verifying");
  const result = await verifyZibalPayment(settings.merchant, trackId);

  if (result.result !== 100 && result.result !== 201) {
    await recordPaymentAttempt(
      trackId,
      order.id,
      result.result === 202 ? "failed" : "verify_error",
      result.result,
    );
    console.warn("[payment:zibal] verification rejected", {
      orderId,
      gatewayResult: result.result,
    });
    throw new Error(`ZIBAL_ERROR_${result.result}`);
  }

  // Result 201 means Zibal has already verified the transaction. It is only
  // recoverable while our order is unpaid when Zibal still returns the amount.
  assertZibalVerifiedAmount(result, Number(order.total));

  const { data: finalized, error: finalizeError } = await paymentDatabase.rpc(
    "finalize_zibal_payment",
    {
      _order_id: order.id,
      _track_id: trackId,
      _amount_rial: result.amount,
      _ref_number: result.refNumber == null ? null : String(result.refNumber),
      _paid_at: result.paidAt || new Date().toISOString(),
    },
  );
  if (finalizeError) throw finalizeError;
  if (!finalized?.paid) throw new Error("PAYMENT_VERIFY_FAILED");

  await recordPaymentAttempt(trackId, order.id, "paid", result.result);
  console.info("[payment:zibal] order payment finalized", {
    orderId,
    gatewayResult: result.result,
  });
  return {
    ok: true as const,
    code: String(finalized.code ?? order.code),
    orderId: order.id,
    refId: finalized.ref_id == null ? null : String(finalized.ref_id),
  };
}
