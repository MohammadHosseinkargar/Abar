import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMyNotifications, markNotificationsRead } from "@/lib/notifications.functions";
import { useAuth } from "@/hooks/use-auth";
import { toFa } from "@/lib/rtl";

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "همین حالا";
  if (m < 60) return `${toFa(m)} دقیقه پیش`;
  const h = Math.round(m / 60);
  if (h < 24) return `${toFa(h)} ساعت پیش`;
  return `${toFa(Math.round(h / 24))} روز پیش`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listMyNotifications(),
    enabled: !!user,
    refetchInterval: 60_000,
    retry: false,
  });

  const markRead = useMutation({
    mutationFn: (id?: string) => markNotificationsRead({ data: id ? { id } : {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!user) return null;
  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="اعلان‌ها"
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-10 w-10 place-items-center rounded-sm hover:bg-muted"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1.5 end-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-hot px-1 font-mono text-[9px] text-white tabular">
            {toFa(unread)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-12 z-50 w-[min(88vw,340px)] overflow-hidden rounded-lg border border-line bg-surface shadow-xl rise-in">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ اعلان‌ها ]</p>
            {unread > 0 && (
              <button
                onClick={() => markRead.mutate(undefined)}
                className="text-[11px] text-ink-2 underline underline-offset-4 hover:text-ink"
              >
                خواندن همه
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto edge-fade">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-ink-3">فعلاً اعلانی نداری.</li>
            )}
            {items.map((n) => (
              <li key={n.id} className={n.read ? "" : "bg-muted/60"}>
                <Link
                  to={n.link ?? "/orders"}
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id);
                    setOpen(false);
                  }}
                  className="block px-4 py-3 hover:bg-muted"
                >
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  {n.body && <p className="mt-1 text-xs text-ink-2 leading-relaxed">{n.body}</p>}
                  <p className="mt-1.5 font-mono text-[10px] text-ink-3">{relTime(n.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
