import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTorobConfigurationState } from "@/lib/torob/config.server";

export const Route = createFileRoute("/api/torob/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { count, error } = await supabaseAdmin
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true);
          if (error) throw error;
          const config = getTorobConfigurationState();
          return Response.json(
            {
              status: config.ready ? "ok" : "configuration_required",
              products_available: count ?? 0,
              configuration: config.ready ? "ready" : "incomplete",
              product_api: config.productApiReady ? "ready" : "incomplete",
              webhook: config.webhookEnabled ? "ready" : "disabled",
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json({ status: "error", configuration: "unavailable" }, { status: 503 });
        }
      },
    },
  },
});
