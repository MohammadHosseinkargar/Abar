import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { registerServiceWorker } from "@/lib/register-sw";
import { IosInstallPrompt } from "@/components/ios-install-prompt";

function NotFoundComponent() {
  return (
    <AppShell>
      <div className="min-h-[70vh] grid place-items-center px-4">
        <div className="text-center">
          <p className="font-mono text-xs tracking-widest text-ink-3 uppercase">[ 404 / NOT FOUND ]</p>
          <h1 className="mt-4 font-display text-6xl font-light">۴۰۴</h1>
          <p className="mt-4 text-sm text-ink-2">صفحه‌ای که دنبالش می‌گشتی پیدا نشد.</p>
          <a
            href="/"
            className="mt-8 inline-block rounded-sm bg-ink px-5 py-2.5 text-sm text-primary-foreground hover:opacity-90"
          >
            بازگشت به خانه
          </a>
        </div>
      </div>
    </AppShell>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs tracking-widest text-ink-3 uppercase">[ ERROR ]</p>
        <h1 className="mt-3 font-display text-xl">این صفحه بارگذاری نشد</h1>
        <p className="mt-2 text-sm text-ink-2">
          مشکلی پیش آمد. می‌توانی دوباره تلاش کنی یا به صفحه اصلی برگردی.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-sm bg-ink px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            تلاش مجدد
          </button>
          <a href="/" className="rounded-sm border border-line px-4 py-2 text-sm hover:bg-muted">
            خانه
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a0a" },
      { title: "ابر تری دی — فروشگاه محصولات چاپ سه‌بعدی" },
      { name: "description", content: "فروشگاه تخصصی محصولات چاپ سه‌بعدی. طراحی مدرن، کیفیت صنعتی، ارسال به سراسر ایران." },
      { property: "og:site_name", content: "ابر تری دی" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "ابر تری دی — فروشگاه محصولات چاپ سه‌بعدی" },
      { property: "og:description", content: "فروشگاه تخصصی محصولات چاپ سه‌بعدی." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Archivo+Black&display=swap" },
      // Preconnect for GA to reduce latency
      ...(GA_ID ? [{ rel: "preconnect" as const, href: "https://www.googletagmanager.com" }] : []),
    ],
    scripts: GA_ID
      ? [
          // Load the gtag.js library asynchronously — no render-blocking
          {
            tag: "script" as const,
            attrs: {
              async: true,
              src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`,
            },
          },
          // Inline initialisation — runs immediately after the library loads
          {
            tag: "script" as const,
            children: [
              "window.dataLayer = window.dataLayer || [];",
              "function gtag(){dataLayer.push(arguments);}",
              "gtag('js', new Date());",
              `gtag('config', '${GA_ID}', { send_page_view: false });`,
            ].join("\n"),
          },
        ]
      : [],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <IosInstallPrompt />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Fire GA4 page_view on every SPA navigation
  useEffect(() => {
    if (!GA_ID || typeof window === "undefined") return;

    // Send the initial page view on mount
    const sendPageView = (path: string) => {
      try {
        // gtag may be blocked by ad-blockers; guard with typeof check
        if (typeof window.gtag === "function") {
          window.gtag("event", "page_view", {
            page_path: path,
            page_location: window.location.href,
          });
        }
      } catch {
        // silently ignore — never crash the app due to Analytics
      }
    };

    sendPageView(router.state.location.pathname);

    const unsub = router.subscribe("onResolved", ({ toLocation }) => {
      sendPageView(toLocation.pathname);
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

