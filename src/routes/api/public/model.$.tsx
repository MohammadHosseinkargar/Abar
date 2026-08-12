import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/model/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const marker = "/api/public/model/";
        const name = decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + marker.length));
        if (!name || name.includes("/") || name.includes("..") || !/\.stl$/i.test(name)) {
          return new Response("bad path", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("product-images").download(`models/${name}`);
        if (error || !data) return new Response("not found", { status: 404 });

        return new Response(data, {
          headers: {
            "Content-Type": "model/stl",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
