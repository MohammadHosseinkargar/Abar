import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminOverview } from "@/lib/admin.functions";
import { AdminHeader, Panel, Stat, num, Tag, Empty } from "@/components/admin/kit";
import { orderStatusFa, type OrderStatus } from "@/data/orders";
import { faDate } from "@/lib/rtl";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-overview"], queryFn: () => adminOverview() });

  return (
    <>
      <AdminHeader title="داشبورد" subtitle="نمای کلی فروشگاه" />
      {isLoading || !data ? (
        <p className="text-sm text-ink-3">در حال بارگذاری…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="REVENUE" value={`${num(data.revenue)} تومان`} hint="مجموع پرداخت‌شده" />
            <Stat label="ORDERS" value={num(data.ordersCount)} hint={`${num(data.pendingCount)} در جریان`} />
            <Stat label="PRODUCTS" value={num(data.productsCount)} hint={`${num(data.lowStock)} کم‌موجود`} />
            <Stat label="USERS" value={num(data.usersCount)} hint={`${num(data.pendingReviews)} نظر در انتظار`} />
          </div>

          <Panel className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b-2 border-ink bg-[var(--nb-warning)] px-4 py-2.5">
              <h2 className="text-sm">آخرین سفارش‌ها</h2>
              <Link to="/admin/orders" className="border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold uppercase nb-sh-sm nb-lift">
                همه سفارش‌ها
              </Link>
            </div>
            {data.recentOrders.length === 0 ? (
              <Empty text="هنوز سفارشی ثبت نشده است." />
            ) : (
              <ul className="divide-y-2 divide-ink">
                {data.recentOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
                    <span className="font-mono text-xs">{o.code}</span>
                    <Tag>{orderStatusFa[o.status as OrderStatus] ?? o.status}</Tag>
                    <Tag tone={o.paymentStatus === "paid" ? "ok" : "warn"}>
                      {o.paymentStatus === "paid" ? "پرداخت شده" : "پرداخت نشده"}
                    </Tag>
                    <span className="ms-auto text-xs text-ink-3">{faDate(o.createdAt)}</span>
                    <span className="font-mono text-xs">{num(o.total)}</span>
                  </li>

                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
