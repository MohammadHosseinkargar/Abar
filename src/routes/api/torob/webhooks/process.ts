import { createFileRoute } from "@tanstack/react-router";
import { handleTorobWebhookProcess } from "@/lib/torob/webhook.server";

export const Route = createFileRoute("/api/torob/webhooks/process")({
  server: {
    handlers: {
      POST: async ({ request }) => handleTorobWebhookProcess(request),
    },
  },
});
