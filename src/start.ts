import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { normalizeError } from "./lib/error-handler";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    const result = await next();
    return result;
  } catch (error) {
    // If it's a redirect or already structured response, let it through
    if (error instanceof Response) throw error;
    if (error != null && typeof error === "object" && "statusCode" in error) throw error;

    const normalized = normalizeError(error);
    console.error(`[Error ${normalized.requestId}]`, error);

    // If it's a server function call, return the normalized error as JSON
    // Otherwise return HTML error page
    return new Response(JSON.stringify(normalized), {
      status: normalized.error.code === "UNAUTHORIZED" ? 401 : 400,
      headers: { "content-type": "application/json" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
