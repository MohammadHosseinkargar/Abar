import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { adminListOrders, adminUpdateOrder } from "@/lib/admin.functions";
import { AdminHeader, Panel, Btn, Field, inputCls, Tag, num, Empty } from "@/components/admin/kit";
import { orderStatusFa, type OrderStatus } from "@/data/orders";
import { faDate } from "@/lib/rtl";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

const paymentFa: Record<string, string> = { unpaid: "پرداخت نشده", paid: "پرداخت شده", refunded: "بازگشت وجه" };

function AdminOrders() {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["admin-orders"], queryFn: () => adminListOrders() });
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const update = useMutation({
    mutationFn: (v: { id: string; status: OrderStatus; paymentStatus: "unpaid" | "paid" | "refunded"; trackingCode: string }) =>
      adminUpdateOrder({ data: v }),
    onSuccess: () => qc.invalidateQueries(),
  });

  const rows = (orders.data ?? []).filter((o) => filter === "all" || o.status === filter);

  return (
    <>
      <AdminHeader
        title="سفارش‌ها"
        subtitle="وضعیت سفارش‌ها و کد رهگیری"
        action={
          <select className={`${inputCls} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">همه وضعیت‌ها</option>
            {Object.entries(orderStatusFa).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        }
      />

      <Panel className="overflow-hidden">
        {orders.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : rows.length === 0 ? (
          <Empty text="سفارشی یافت نشد." />
        ) : (
          <ul className="divide-y-2 divide-ink">
            {rows.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => setOpen(open === o.id ? null : o.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50"
                >
                  <span className="font-mono text-xs">{o.code}</span>
                  <Tag>{orderStatusFa[o.status as OrderStatus] ?? o.status}</Tag>
                  <Tag tone={o.paymentStatus === "paid" ? "ok" : "warn"}>{paymentFa[o.paymentStatus]}</Tag>
                  <span className="text-xs text-ink-3">{o.address?.receiver ?? "—"}</span>
                  <span className="ms-auto text-xs text-ink-3">{faDate(o.createdAt)}</span>
                  <span className="font-mono text-xs">{num(o.total)}</span>
                  <ChevronDown size={14} className={`transition-transform ${open === o.id ? "rotate-180" : ""}`} />
                </button>
                {open === o.id && <OrderEditor order={o} onSave={(v) => update.mutate({ id: o.id, ...v })} saving={update.isPending} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

type OrderRow = Awaited<ReturnType<typeof adminListOrders>>[number];

function OrderEditor({
  order,
  onSave,
  saving,
}: {
  order: OrderRow;
  onSave: (v: { status: OrderStatus; paymentStatus: "unpaid" | "paid" | "refunded"; trackingCode: string }) => void;
  saving: boolean;
}) {
  const [status, setStatus] = useState(order.status as OrderStatus);
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus as "unpaid" | "paid" | "refunded");
  const [trackingCode, setTrackingCode] = useState(order.trackingCode ?? "");

  return (
    <div className="border-t border-line bg-muted/30 px-4 py-4 animate-rise-in">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ ITEMS ]</p>
          <ul className="space-y-1 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex flex-col border-b border-ink/5 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{i.name} × {num(i.qty)}</span>
                  <span className="font-mono text-xs">{num(i.price * i.qty)}</span>
                </div>
                {(i.color || i.size) && (
                  <div className="flex gap-2 text-[10px] text-ink-3 font-bold">
                    {i.color && <span>رنگ: {i.color}</span>}
                    {i.size && <span>سایز: {i.size}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {order.address && (
            <p className="mt-3 text-xs leading-6 text-ink-2">
              {order.address.receiver} — {order.address.phone}
              <br />
              {order.address.province}، {order.address.city}، {order.address.line}
            </p>
          )}
        </div>
        <div className="grid gap-3">
          <Field label="وضعیت سفارش">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {Object.entries(orderStatusFa).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="وضعیت پرداخت">
            <select className={inputCls} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as "unpaid" | "paid" | "refunded")}>
              {Object.entries(paymentFa).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="کد رهگیری پستی">
            <input dir="ltr" className={inputCls} value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} />
          </Field>
          <Btn onClick={() => onSave({ status, paymentStatus, trackingCode })} disabled={saving}>
            {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
