import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export async function checkHealth() {
    try {
      // Basic check: can we query the DB?
      // Use the public client so a missing server-only admin key does not make
      // the storefront unhealthy. Privileged operations validate that key separately.
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.from("categories").select("id").limit(1);
      
      if (error) throw error;
      
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "connected",
        uptime: process.uptime(),
      };
    } catch (err) {
      return {
        status: "error",
        database: "disconnected",
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
}

export const getHealth = createServerFn({ method: "GET" }).handler(checkHealth);
