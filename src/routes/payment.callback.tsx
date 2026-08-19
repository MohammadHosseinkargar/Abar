import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { verifyPayment } from "@/lib/payment.functions";
import { normalizeError } from "@/lib/error-handler";
import { AppShell } from "@/components/app-shell";
import { toFa } from "@/lib/rtl";
import { Check, X, Loader2 } from "lucide-react";

type Search = {
  order?: string;
  trackId?: string;
  success?: string;
  status?: string;
  Authority?: string;
  Status?: string;
};

export const Route = createFileRoute("/payment/callback")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    order: typeof search.order === "string" ? search.order : undefined,
    trackId: typeof search.trackId === "string" ? search.trackId : undefined,
    success: typeof search.success === "string" ? search.success : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
    Authority: typeof search.Authority === "string" ? search.Authority : undefined,
    Status: typeof search.Status === "string" ? search.Status : undefined,
  }),

  head: () => ({
    meta: [
      { title: "نتیجه پرداخت — ابر تری دی" },
      { name: "description", content: "بررسی و تایید نتیجه پرداخت آنلاین سفارش شما." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "نتیجه پرداخت — ابر تری دی" },
      { property: "og:description", content: "بررسی و تایید نتیجه پرداخت آنلاین سفارش." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentCallback,
});

function PaymentCallback() {
  const search = useSearch({ from: "/payment/callback" });
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; code: string; orderId: string; refId: string | null }
    | { kind: "fail"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!search.order) {
        setState({ kind: "fail", message: "اطلاعات پرداخت ناقص است." });
        return;
      }
      try {
        const res = await verifyPayment({
          data: {
            orderId: search.order,
            trackId: search.trackId || search.Authority,
            success: search.success,
            status: search.status || search.Status,
          },
        });

        if (cancelled) return;
        setState({ kind: "ok", code: res.code, orderId: res.orderId, refId: res.refId ?? null });
      } catch (err: any) {
        if (!cancelled) {
          // Normalize the error to get the Persian message
          const normalized = normalizeError(err);
          setState({ kind: "fail", message: normalized.error.message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    search.order,
    search.trackId,
    search.success,
    search.status,
    search.Authority,
    search.Status,
  ]);

  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        {state.kind === "loading" && (
          <>
            <Loader2 className="mx-auto animate-spin text-ink-3" size={26} />
            <p className="mt-6 text-sm text-ink-2">در حال بررسی نتیجه پرداخت…</p>
          </>
        )}

        {state.kind === "ok" && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-ink">
              <Check size={22} />
            </div>
            <p className="mt-6 font-mono text-xs tracking-widest text-ink-3 uppercase">
              [ PAYMENT OK ]
            </p>
            <h1 className="mt-3 font-display text-3xl">پرداخت با موفقیت انجام شد</h1>
            <p className="mt-3 text-sm text-ink-2">
              کد سفارش: <span className="font-mono tabular">{toFa(state.code)}</span>
            </p>
            {state.refId && (
              <p className="mt-1 text-sm text-ink-3">
                شماره پیگیری بانکی: <span className="font-mono tabular">{toFa(state.refId)}</span>
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/orders/$id"
                params={{ id: state.orderId }}
                className="nbh-border nbh-sh-sm nbh-lift bg-ink px-5 py-2.5 text-sm font-bold text-primary-foreground uppercase"
              >
                پیگیری سفارش
              </Link>
              <Link
                to="/products"
                className="nbh-border nbh-sh-sm nbh-lift bg-surface px-5 py-2.5 text-sm font-bold uppercase"
              >
                ادامه خرید
              </Link>
            </div>
          </>
        )}

        {state.kind === "fail" && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-hot text-hot">
              <X size={22} />
            </div>
            <p className="mt-6 font-mono text-xs tracking-widest text-ink-3 uppercase">
              [ PAYMENT FAILED ]
            </p>
            <h1 className="mt-3 font-display text-3xl">پرداخت انجام نشد</h1>
            <p className="mt-3 text-sm text-ink-2">{state.message}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/orders"
                className="nbh-border nbh-sh-sm nbh-lift bg-ink px-5 py-2.5 text-sm font-bold text-primary-foreground uppercase"
              >
                سفارش‌های من
              </Link>
              <Link
                to="/cart"
                className="nbh-border nbh-sh-sm nbh-lift bg-surface px-5 py-2.5 text-sm font-bold uppercase"
              >
                بازگشت به سبد
              </Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
