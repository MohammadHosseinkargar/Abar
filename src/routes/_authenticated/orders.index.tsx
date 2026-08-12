import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PriceTag } from "@/components/price-tag";
import { orderStatusFa } from "@/data/orders";
import { listMyOrders } from "@/lib/account.functions";
import { toFa, faDate } from "@/lib/rtl";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "سفارش‌های من — ابر تری دی" },
      { name: "description", content: "لیست سفارش‌ها و پیگیری وضعیت آن‌ها." },
      { property: "og:title", content: "سفارش‌های من — ابر تری دی" },
      { property: "og:description", content: "لیست سفارش‌ها و پیگیری وضعیت." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { data, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: () => listMyOrders() });

  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ ORDERS ]</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">سفارش‌های من</h1>

        {isLoading && <div className="nbh-card mt-8 p-6 text-sm text-ink-3">در حال بارگذاری…</div>}

        {data && data.length === 0 && (
          <div className="nbh-card mt-8 px-5 py-16 text-center">
            <p className="font-mono text-xs tracking-widest text-ink-3 uppercase">[ EMPTY ]</p>
            <p className="mt-3 text-sm text-ink-2">هنوز سفارشی ثبت نکرده‌اید.</p>
            <Link to="/products" className="mt-6 inline-block nbh-border nbh-sh-sm nbh-lift bg-ink px-5 py-2.5 text-sm font-bold text-primary-foreground uppercase">
              مشاهده محصولات
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {(data ?? []).map((o) => (
            <Link
              key={o.id}
              to="/orders/$id"
              params={{ id: o.id }}
              className="nbh-card nbh-lift block p-4 transition-colors sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-sm tabular">{toFa(o.code)}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {faDate(o.createdAt)} · {toFa(o.itemsCount)} قلم
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end sm:gap-4">
                  <span className="rounded-pill border-2 border-ink bg-muted px-3 py-1.5 font-mono text-[10px] font-bold tracking-widest uppercase">
                    {o.paymentMethod !== "cod" && o.paymentStatus !== "paid"
                      ? "در انتظار پرداخت"
                      : orderStatusFa[o.status as keyof typeof orderStatusFa] ?? o.status}
                  </span>
                  <PriceTag price={o.total} size="sm" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
