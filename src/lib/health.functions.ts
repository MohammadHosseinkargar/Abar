import { createServerFn } from "@tanstack/react-start";

// Simple in-process request counter (resets on restart, good enough for
// a single-instance deployment to spot traffic spikes in logs).
let _reqCount = 0;
export function incrementRequestCount() { _reqCount++; }

export async function checkHealth() {
  const start = Date.now();
  try {
    // Use the public client — a missing service-role key must not report
    // the storefront as unhealthy.
    const { supabase } = await import("@/integrations/supabase/client");

    // Race the DB ping against a 5-second timeout so a hung Supabase
    // connection never blocks the health endpoint indefinitely.
    const dbResult = await Promise.race([
      supabase.from("categories").select("id").limit(1),
      new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("DB ping timeout")), 5_000),
      ),
    ]);

    if ("error" in dbResult && dbResult.error) throw dbResult.error;

    const mem = process.memoryUsage();
    const dbLatencyMs = Date.now() - start;

    return {
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      database: {
        status: "connected",
        latency_ms: dbLatencyMs,
      },
      memory: {
        // RSS is total memory allocated by the OS for the Node process
        rss_mb:        Math.round(mem.rss / 1024 / 1024),
        heap_used_mb:  Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      },
      requests_since_start: _reqCount,
      node_version: process.version,
    };
  } catch (err) {
    return {
      status: "error" as const,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      database: {
        status: "disconnected",
        latency_ms: Date.now() - start,
      },
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export const getHealth = createServerFn({ method: "GET" }).handler(checkHealth);
