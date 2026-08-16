import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Package, Layers, ShoppingBag, Users, Ticket, Star, Settings, ArrowRight, Activity } from "lucide-react";
import { getAdminAccess, claimFirstAdmin } from "@/lib/admin.functions";
import { Btn, Panel } from "@/components/admin/kit";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const nav: { to: string; label: string; icon: typeof LayoutGrid; exact?: boolean }[] = [
  { to: "/admin", label: "داشبورد", icon: LayoutGrid, exact: true },
  { to: "/admin/products", label: "محصولات", icon: Package },
  { to: "/admin/categories", label: "دسته‌ها", icon: Layers },
  { to: "/admin/orders", label: "سفارش‌ها", icon: ShoppingBag },
  { to: "/admin/users", label: "کاربران", icon: Users },
  { to: "/admin/discounts", label: "کدهای تخفیف", icon: Ticket },
  { to: "/admin/reviews", label: "نظرات", icon: Star },
  { to: "/admin/settings", label: "تنظیمات", icon: Settings },
  { to: "/admin/torob", label: "ترب", icon: Activity },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const access = useQuery({ queryKey: ["admin-access"], queryFn: () => getAdminAccess() });
  const claim = useMutation({
    mutationFn: () => claimFirstAdmin(),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (access.isLoading) {
    return (
      <div className="nb grid min-h-[70vh] place-items-center">
        <div className="border-2 border-ink bg-card px-6 py-4 text-sm font-bold uppercase nb-sh-md">
          در حال بررسی دسترسی…
        </div>
      </div>
    );
  }

  if (!access.data?.isAdmin) {
    return (
      <div className="nb grid min-h-[70vh] place-items-center px-4 py-10">
        <Panel className="w-full max-w-md p-6 text-center">
          <p className="inline-block border-2 border-ink bg-[var(--nb-danger)] px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.2em] uppercase nb-sh-sm">
            RESTRICTED
          </p>
          <h1 className="mt-4 text-xl">دسترسی مدیریتی ندارید</h1>
          {access.data && !access.data.adminExists ? (
            <>
              <p className="mt-3 text-sm font-medium text-ink-2">
                هنوز هیچ مدیری برای این فروشگاه تعیین نشده. می‌توانید حساب فعلی را مدیر کنید.
              </p>
              <Btn className="mt-5 w-full" onClick={() => claim.mutate()} disabled={claim.isPending}>
                {claim.isPending ? "در حال انجام…" : "مدیر شدن با این حساب"}
              </Btn>
              {claim.isError && (
                <p className="mt-3 border-2 border-ink bg-[var(--nb-danger)] px-3 py-2 text-xs font-bold">
                  {(claim.error as Error).message}
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm font-medium text-ink-2">
              برای دسترسی به پنل مدیریت با مدیر فروشگاه تماس بگیرید.
            </p>
          )}
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1 border-2 border-ink bg-white px-3 py-1.5 text-xs font-bold uppercase nb-sh-sm nb-lift"
          >
            بازگشت به فروشگاه <ArrowRight size={13} />
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="nb min-h-screen px-4 py-6 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center gap-3 border-2 border-ink bg-[var(--nb-primary)] px-4 py-3 nb-sh-lg">
          <span className="nb-display text-sm font-black tracking-tight text-white uppercase italic">
            Abar3D
          </span>
          <span className="border-2 border-ink bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase whitespace-nowrap">
            control panel
          </span>
          <Link
            to="/"
            className="ms-auto inline-flex items-center gap-1.5 border-2 border-ink bg-white px-3 py-1.5 text-xs font-bold uppercase nb-sh-sm nb-lift"
          >
            فروشگاه <ArrowRight size={13} />
          </Link>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[228px_minmax(0,1fr)]">
          <aside className="min-w-0 md:sticky md:top-6 md:self-start">
            <nav className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:flex-col md:gap-2.5 md:overflow-visible md:px-0 md:pb-0">
              {nav.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex min-h-11 shrink-0 items-center gap-2 border-2 border-ink px-3 py-2.5 text-sm font-bold nb-sh-sm nb-lift ${
                      active ? "bg-[var(--nb-accent)] text-ink" : "bg-white text-ink"
                    }`}
                  >
                    <item.icon size={16} strokeWidth={2.5} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
