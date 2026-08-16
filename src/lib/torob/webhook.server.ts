import "@tanstack/react-start/server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTorobConfig } from "./config.server";

type QueueRow = { id: number; page_unique: string; page_url: string; attempts: number };

export const torobRetryDelaySeconds = (attempts: number) =>
  Math.min(3600, 30 * 2 ** Math.min(attempts, 7));

export async function handleTorobWebhookProcess(request: Request): Promise<Response> {
  const config = getTorobConfig();
  if (!config.webhookToken) {
    return Response.json({
      status: "disabled",
      reason: "webhook_token_not_configured",
      processed: 0,
      sent: 0,
    });
  }
  if (
    !config.queueSecret ||
    request.headers.get("authorization") !== `Bearer ${config.queueSecret}`
  )
    return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(await processTorobWebhookQueue());
  } catch {
    return Response.json({ error: "webhook processing failed" }, { status: 502 });
  }
}

export async function processTorobWebhookQueue() {
  const config = getTorobConfig();
  // Queue writes are database-triggered and remain active without this token.
  // Do not claim rows until delivery is configured, so pending events stay intact.
  if (!config.webhookToken) return { status: "disabled" as const, processed: 0, sent: 0 };
  const { data, error } = await (supabaseAdmin as any).rpc("claim_torob_webhook_batch", {
    batch_size: 100,
  });
  if (error) throw error;
  const rows = (data ?? []) as QueueRow[];
  if (!rows.length) return { status: "ok" as const, processed: 0, sent: 0 };

  const items = rows.map((row) => ({
    page_url: new URL(row.page_url, config.appUrl).href,
    page_unique: row.page_unique,
  }));
  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${config.webhookToken}`,
      },
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Torob webhook returned HTTP ${response.status}`);
    const ids = rows.map((row) => row.id);
    const now = new Date().toISOString();
    const { error: updateError } = await (supabaseAdmin as any)
      .from("torob_webhook_queue")
      .update({ status: "sent", sent_at: now, locked_at: null, last_error: null })
      .in("id", ids);
    if (updateError) throw updateError;
    await (supabaseAdmin as any).from("torob_sync_events").insert({
      event_type: "webhook",
      success: true,
      item_count: rows.length,
      message: "Webhook accepted by Torob",
    });
    console.info("[Torob Webhook] sent", { products: rows.length });
    return { status: "ok" as const, processed: rows.length, sent: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "unknown webhook error";
    await Promise.all(
      rows.map((row) => {
        const delaySeconds = torobRetryDelaySeconds(row.attempts);
        return (supabaseAdmin as any)
          .from("torob_webhook_queue")
          .update({
            status: "failed",
            locked_at: null,
            last_error: message,
            next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
          })
          .eq("id", row.id);
      }),
    );
    await (supabaseAdmin as any)
      .from("torob_sync_events")
      .insert({ event_type: "webhook", success: false, item_count: rows.length, message });
    console.error("[Torob Webhook] failed", { products: rows.length, error: message });
    throw error;
  }
}
