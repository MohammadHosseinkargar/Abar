import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminTorobOverview } from "@/lib/admin.functions";
import { AdminHeader, Panel, Stat, num, Tag, Empty } from "@/components/admin/kit";

export const Route = createFileRoute("/_authenticated/admin/torob")({ component: TorobAdmin });

type SyncEvent = { created_at: string; success: boolean; message: string | null };

function TorobAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-torob"],
    queryFn: () => adminTorobOverview(),
    refetchInterval: 30_000,
  });
  return (
    <>
      <AdminHeader title="یکپارچه‌سازی ترب" subtitle="وضعیت API، صف webhook و پیکربندی سمت سرور" />
      {isLoading || !data ? (
        <p className="text-sm text-ink-3">در حال بارگذاری…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="PRODUCTS" value={num(data.productsAvailable)} hint="محصول قابل ارسال" />
            <Stat label="QUEUE" value={num(data.queuePending)} hint="در انتظار یا خطادار" />
            <Stat label="SENT" value={num(data.webhookSent)} hint="webhook ارسال‌شده" />
            <Stat
              label="CONFIG"
              value={data.configuration.publicKey ? "READY" : "INCOMPLETE"}
              hint="کلید عمومی JWT"
            />
          </div>
          <Panel className="mt-6 overflow-hidden">
            <div className="border-b-2 border-ink bg-[var(--nb-warning)] px-4 py-2.5">
              <h2 className="text-sm">پیکربندی</h2>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {Object.entries(data.configuration).map(([key, value]) => (
                <Tag key={key} tone={value ? "ok" : "warn"}>
                  {key}: {value ? "configured" : "missing/disabled"}
                </Tag>
              ))}
            </div>
          </Panel>
          <Panel className="mt-6 overflow-hidden">
            <div className="border-b-2 border-ink bg-[var(--nb-accent)] px-4 py-2.5">
              <h2 className="text-sm">آخرین رخدادها</h2>
            </div>
            {!data.recent.length ? (
              <Empty text="هنوز رخدادی ثبت نشده است." />
            ) : (
              <ul className="divide-y-2 divide-ink">
                {(data.recent as SyncEvent[]).map((event, index) => (
                  <li
                    key={`${event.created_at}-${index}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs"
                  >
                    <Tag tone={event.success ? "ok" : "warn"}>
                      {event.success ? "SUCCESS" : "FAILED"}
                    </Tag>
                    <span>{event.message || "—"}</span>
                    <span className="ms-auto font-mono">
                      {new Date(event.created_at).toLocaleString("fa-IR")}
                    </span>
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
