import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function escapeXml(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]!,
  );
}

export const Route = createFileRoute("/product-sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { data, error } = await supabaseAdmin
          .from("products")
          .select("slug,updated_at")
          .eq("is_active", true)
          .order("updated_at", { ascending: false });
        if (error) return new Response("sitemap unavailable", { status: 503 });
        const configured = process.env.APP_URL?.trim();
        const origin = configured ? new URL(configured).origin : new URL(request.url).origin;
        const urls = (data ?? [])
          .map(
            (row) =>
              `<url><loc>${escapeXml(new URL(`/products/${encodeURIComponent(row.slug)}`, origin).href)}</loc><lastmod>${new Date(row.updated_at).toISOString()}</lastmod></url>`,
          )
          .join("");
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
          {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});
