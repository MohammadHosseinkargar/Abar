import { createFileRoute } from "@tanstack/react-router";
import { processZibalCallback } from "@/lib/payment-processing.server";

function resultRedirect(request: Request, params: Record<string, string>): Response {
  const target = new URL("/payment/callback", request.url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return Response.redirect(target, 303);
}

export const Route = createFileRoute("/api/payment/zibal/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orderId = url.searchParams.get("order") ?? "";
        const trackId = url.searchParams.get("trackId") ?? "";

        if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^\d{1,30}$/.test(trackId)) {
          console.warn("[payment:zibal] malformed callback received");
          return resultRedirect(request, { error: "PAYMENT_VERIFY_FAILED" });
        }

        try {
          await processZibalCallback(orderId, trackId);
          return resultRedirect(request, { order: orderId, trackId });
        } catch (error) {
          const code =
            error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
              ? error.message
              : "PAYMENT_VERIFY_FAILED";
          console.error("[payment:zibal] callback processing failed", { orderId, code });
          return resultRedirect(request, { order: orderId, trackId, error: code });
        }
      },
    },
  },
});
