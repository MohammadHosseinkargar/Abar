import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2, Undo2 } from "lucide-react";
import { adminListReviews, adminSetReviewApproval, adminDeleteReview } from "@/lib/admin.functions";
import { AdminHeader, Panel, Tag, Empty, num } from "@/components/admin/kit";
import { faDate } from "@/lib/rtl";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: AdminReviews,
});

function AdminReviews() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-reviews"], queryFn: () => adminListReviews() });
  const approve = useMutation({
    mutationFn: (v: { id: string; approved: boolean }) => adminSetReviewApproval({ data: v }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteReview({ data: { id } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <>
      <AdminHeader title="نظرات" subtitle="تأیید یا حذف دیدگاه مشتریان" />
      <Panel className="overflow-hidden">
        {list.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : (list.data ?? []).length === 0 ? (
          <Empty text="نظری ثبت نشده است." />
        ) : (
          <ul className="divide-y-2 divide-ink">
            {(list.data ?? []).map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">{r.author}</span>
                  <Tag>{num(r.rating)}/۵</Tag>
                  <span className="text-xs text-ink-3">{r.productName}</span>
                  {r.approved ? <Tag tone="ok">تأیید شده</Tag> : <Tag tone="warn">در انتظار</Tag>}
                  <span className="ms-auto text-[10px] text-ink-3">{faDate(r.createdAt)}</span>
                  <button
                    onClick={() => approve.mutate({ id: r.id, approved: !r.approved })}
                    aria-label={r.approved ? "لغو تأیید" : "تأیید"}
                    className="grid h-9 w-9 place-items-center border-2 border-ink bg-white text-ink nb-sh-sm nb-lift"
                  >
                    {r.approved ? <Undo2 size={14} /> : <Check size={14} />}
                  </button>
                  <button
                    onClick={() => { if (confirm("این نظر حذف شود؟")) remove.mutate(r.id); }}
                    aria-label="حذف"
                    className="grid h-9 w-9 place-items-center border-2 border-ink bg-[var(--nb-danger)] text-ink nb-sh-sm nb-lift"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {r.body && <p className="mt-2 text-sm leading-7 text-ink-2">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
