import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, ChevronLeft, ChevronRight } from "lucide-react";
import { adminListUsers, adminSetRole } from "@/lib/admin.functions";
import { AdminHeader, Panel, Tag, num, Empty } from "@/components/admin/kit";
import { faDate } from "@/lib/rtl";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

const PAGE_SIZE = 50;

function AdminUsers() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const users = useQuery({
    queryKey: ["admin-users", page],
    queryFn: () => adminListUsers({ data: { page, limit: PAGE_SIZE } }),
    placeholderData: (prev) => prev,
  });

  const setRole = useMutation({
    mutationFn: (v: { userId: string; makeAdmin: boolean }) => adminSetRole({ data: v }),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => alert(e.message),
  });

  const rows = users.data?.users ?? [];
  const total = users.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminHeader title="کاربران" subtitle={`${total} کاربر ثبت‌نام کرده`} />
      <Panel className="overflow-hidden">
        {users.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : rows.length === 0 ? (
          <Empty text="کاربری ثبت نشده است." />
        ) : (
          <>
            <ul className="divide-y-2 divide-ink">
              {rows.map((u) => (
                <li key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{u.fullName || "بدون نام"}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-ink-3" dir="ltr">{u.email || u.phone || "—"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:contents">
                    {u.isAdmin && <Tag tone="ok">مدیر</Tag>}
                    <span className="text-xs text-ink-3">{num(u.ordersCount)} سفارش</span>
                    <span className="font-mono text-xs">{num(u.spent)}</span>
                    <span className="text-[10px] text-ink-3">{faDate(u.createdAt)}</span>
                    <button
                      onClick={() => setRole.mutate({ userId: u.id, makeAdmin: !u.isAdmin })}
                      className="ms-auto inline-flex min-h-11 items-center gap-1.5 border-2 border-ink bg-white px-2.5 py-1.5 text-xs font-bold nb-sh-sm nb-lift sm:ms-0 sm:min-h-9"
                    >
                      {u.isAdmin ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                      {u.isAdmin ? "حذف دسترسی مدیر" : "مدیر کن"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 border-t-2 border-ink px-4 py-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="disabled:opacity-30"
                  aria-label="صفحه قبل"
                >
                  <ChevronRight size={18} />
                </button>
                <span className="font-mono text-xs">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="disabled:opacity-30"
                  aria-label="صفحه بعد"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
