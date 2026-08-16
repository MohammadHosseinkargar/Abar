import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";
import { verifyTorobRequest, unauthorized } from "@/lib/torob/auth.server";
import { fetchTorobProducts } from "@/lib/torob/products.server";
import { torobProductRequestSchema } from "@/lib/torob/schema";
import { allowTorobRequest } from "@/lib/torob/rate-limit.server";

export const Route = createFileRoute("/api/torob/products")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        try {
          verifyTorobRequest(request);
        } catch {
          return unauthorized();
        }
        if (!allowTorobRequest(request))
          return Response.json(
            { error: "rate limit exceeded" },
            { status: 429, headers: { "Retry-After": "60" } },
          );
        try {
          if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
            return Response.json(
              { error: "content-type must be application/json" },
              { status: 400 },
            );
          }
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json({ error: "invalid JSON body" }, { status: 400 });
          }
          const input = torobProductRequestSchema.parse(body);
          const response = await fetchTorobProducts(input);
          console.info("[Torob Product API]", {
            type: "page" in input ? "pagination" : "page_urls" in input ? "urls" : "uniques",
            page: "page" in input ? input.page : 1,
            products: response.products.length,
            durationMs: Date.now() - started,
          });
          return Response.json(response, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          if (error instanceof ZodError)
            return Response.json(
              { error: error.issues[0]?.message || "invalid request" },
              { status: 400 },
            );
          console.error("[Torob Product API] request failed", {
            durationMs: Date.now() - started,
            error: error instanceof Error ? error.message : "unknown error",
          });
          return Response.json({ error: "internal server error" }, { status: 500 });
        }
      },
    },
  },
});
