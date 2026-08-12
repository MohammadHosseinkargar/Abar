import { createFileRoute } from "@tanstack/react-router";
import { checkHealth } from "@/lib/health.functions";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const health = await checkHealth();
        return new Response(JSON.stringify(health), {
          status: health.status === "ok" ? 200 : 503,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
