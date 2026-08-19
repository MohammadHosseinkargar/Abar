import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PriceTag } from "@/components/price-tag";
import { orderStatusFa, orderStatusSteps } from "@/data/orders";
import { getMyOrder } from "@/lib/account.functions";
import { startPayment } from "@/lib/payment.functions";
import { normalizeError } from "@/lib/error-handler";
import { toFa, faDate } from "@/lib/rtl";
import { Check, CreditCard, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: () => ({
    meta: [
      { title: "پیگیری سفارش — ابر تری دی" },
      { name: "description", content: "جزئیات و پیگیری وضعیت سفارش." },
      { property: "og:title", content: "پیگیری سفارش — ابر تری دی" },
      { property: "og:description", content: "جزئیات و پیگیری وضعیت سفارش." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { data: order, isLoading } = useQuery({
    queryKey: ["my-order", id],
    queryFn: () => getMyOrder({ data: { id } }),
  });
  const retryPayment = useMutation({
    mutationFn: async (orderId: string) => {
      return startPayment({ data: { orderId } });
    },
    onMutate: () => setPaymentError(null),
    onSuccess: (result) => {
      if (result.mode === "redirect") window.location.href = result.url;
      else window.location.reload();
    },
    onError: (error) => setPaymentError(normalizeError(error).error.message),
  });

  if (isLoading) {
    return (
      <AppShell variant="nbh">
        <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-ink-3">در حال بارگذاری…</div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell variant="nbh">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="font-mono text-xs tracking-widest text-ink-3 uppercase">[ NOT FOUND ]</p>
          <p className="mt-3 text-sm text-ink-2">سفارشی با این شناسه پیدا نشد.</p>
          <Link to="/orders" className="mt-6 inline-block nbh-border nbh-sh-sm nbh-lift bg-ink px-5 py-2.5 text-sm font-bold text-primary-foreground uppercase">
            سفارش‌های من
          </Link>
        </div>
      </AppShell>
    );
  }

  const awaitingOnlinePayment = order.paymentMethod !== "cod" && order.paymentStatus !== "paid";
  const currentIdx = orderStatusSteps.indexOf(order.status as (typeof orderStatusSteps)[number]);

  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <Link to="/orders" className="font-mono text-[10px] tracking-widest text-ink-3 uppercase hover:text-ink">
          ← ORDERS
        </Link>
        <h1 className="mt-3 font-display text-3xl">سفارش {toFa(order.code)}</h1>
        <p className="mt-1 text-xs text-ink-3">
          ثبت‌شده در {faDate(order.createdAt)} ·{" "}
          {order.paymentStatus === "paid" ? "پرداخت‌شده" : "در انتظار پرداخت"}
        </p>

        {awaitingOnlinePayment ? (
          <div className="nbh-card mt-8 p-4 text-sm sm:p-6">
            <p>این سفارش هنوز پرداخت نشده و وارد مرحله آماده‌سازی نشده است.</p>
            <button
              type="button"
              onClick={() => retryPayment.mutate(order.id)}
              disabled={retryPayment.isPending}
              className="nbh-border nbh-sh-sm nbh-lift mt-4 inline-flex items-center gap-2 bg-ink px-5 py-2.5 font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-60"
            >
              {retryPayment.isPending ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              {retryPayment.isPending ? "در حال اتصال به درگاه…" : "پرداخت مجدد"}
            </button>
            {paymentError && <p className="mt-3 text-hot">{paymentError}</p>}
          </div>
        ) : order.status === "cancelled" ? (
          <p className="nbh-card mt-8 p-4 text-sm">این سفارش لغو شده است.</p>
        ) : (
          <ol className="nbh-card mt-8 grid grid-cols-5 gap-2 p-4 sm:p-6">
            {orderStatusSteps.map((s, i) => {
              const done = i <= currentIdx;
              const current = i === currentIdx;
              return (
                <li key={s} className="text-center">
                  <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs ${
                    done ? "bg-ink text-primary-foreground" : "border border-line text-ink-3"
                  }`}>
                    {done ? <Check size={14} /> : toFa(i + 1)}
                  </div>
                  <p className={`mt-2 text-[10px] leading-tight ${current ? "text-ink" : "text-ink-3"}`}>
                    {orderStatusFa[s]}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        <div className="nbh-card mt-8 divide-y-2 divide-ink px-4 sm:px-6">
          {order.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm">{it.name}</p>
                <p className="mt-0.5 font-mono text-xs text-ink-3 tabular">×{toFa(it.qty)}</p>
              </div>
              <PriceTag price={it.price * it.qty} size="sm" />
            </div>
          ))}
        </div>

        <div className="nbh-card mt-6 p-4 sm:p-6">
          <div className="space-y-3 text-sm">
            <Row label="جمع کالاها" value={order.subtotal} />
            <Row label="هزینه ارسال" value={order.shipping} />
            {order.discount > 0 && <Row label={`تخفیف (${order.discountCode ?? ""})`} value={-order.discount} />}
          </div>
          <div className="mt-4 flex items-center justify-between border-t-2 border-ink pt-4">
            <span className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">مبلغ نهایی</span>
            <PriceTag price={order.total} size="lg" />
          </div>
        </div>

        {order.shippingAddress && (
          <div className="nbh-card mt-6 p-4 text-sm sm:p-6">
            <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ SHIPPING ]</p>
            <p className="mt-2">{order.shippingAddress.receiver} — {order.shippingAddress.city}</p>
            <p className="mt-1 text-ink-2 leading-relaxed">
              {order.shippingAddress.province}، {order.shippingAddress.line}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-3 tabular">{toFa(order.shippingAddress.phone ?? "")}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-3">{label}</span>
      <span className="font-mono tabular">
        {value < 0 ? `- ${toFa(Math.abs(value).toLocaleString("en-US"))}` : toFa(value.toLocaleString("en-US"))}
      </span>
    </div>
  );
}
