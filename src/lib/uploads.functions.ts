import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only image upload. Accepts a data-URL and returns a public image path. */
export const adminUploadImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: z.string().min(32).max(12_000_000),
        filename: z.string().trim().min(1).max(120),
        metadata: z.any().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("دسترسی مدیریتی ندارید.");

    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("فایل تصویر نامعتبر است.");
    const contentType = match[1];
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
    if (!allowed.includes(contentType)) throw new Error("فقط فایل تصویری (JPG/PNG/WebP) مجاز است.");

    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength > 12_000_000) throw new Error("حجم تصویر نهایی باید کمتر از ۱۲ مگابایت باشد.");

    const ext = (data.filename.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(error.message);

    return { url: `/api/public/img/${path}` };
  });

/** Admin-only STL model upload. Accepts a data-URL and returns a public model path. */
export const adminUploadModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: z.string().min(32).max(40_000_000),
        filename: z.string().trim().min(1).max(120),
        metadata: z.any().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("دسترسی مدیریتی ندارید.");

    const match = /^data:([^;]*);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("فایل مدل نامعتبر است.");
    const contentType = match[1];
    const isStl = /\.stl$/i.test(data.filename);
    const isGlb = /\.glb$/i.test(data.filename);
    const isGltf = /\.gltf$/i.test(data.filename);

    if (!isStl && !isGlb && !isGltf) {
      throw new Error("فقط فایل با پسوند .stl، .glb یا .gltf مجاز است.");
    }

    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength > 40_000_000) throw new Error("حجم مدل نهایی باید کمتر از ۴۰ مگابایت باشد.");

    const ext = data.filename.split(".").pop()?.toLowerCase() || (isStl ? "stl" : isGlb ? "glb" : "gltf");
    const path = `models/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, bytes, { 
        contentType: contentType || (isStl ? "model/stl" : isGlb ? "model/gltf-binary" : "model/gltf+json"), 
        upsert: false 
      });
    if (error) throw new Error(error.message);

    return { url: `/api/public/model/${path.split("/").pop()}` };
  });
