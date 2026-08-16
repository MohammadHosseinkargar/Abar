import { createFileRoute } from "@tanstack/react-router";
import { getTorobConfig } from "@/lib/torob/config.server";
import { processTorobWebhookQueue } from "@/lib/torob/webhook.server";

export const Route = createFileRoute("/api/torob/webhooks/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = getTorobConfig().queueSecret;
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
          return Response.json({ error: "unauthorized" }, { status: 401 });
        try {
          return Response.json({ status: "ok", ...(await processTorobWebhookQueue()) });
        } catch {
          return Response.json({ error: "webhook processing failed" }, { status: 502 });
        }
      },
    },
  },
});
