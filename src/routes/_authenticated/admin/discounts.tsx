import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { adminListDiscounts, adminSaveDiscount, adminDeleteDiscount } from "@/lib/admin.functions";
import { AdminHeader, Panel, Btn, Field, inputCls, Tag, num, Empty } from "@/components/admin/kit";

export const Route = createFileRoute("/_authenticated/admin/discounts")({
  component: AdminDiscounts,
});

const blank = {
  id: null as string | null,
  code: "",
  label: "",
  percent: 10,
  active: true,
  maxUses: null as number | null,
};

function AdminDiscounts() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-discounts"], queryFn: () => adminListDiscounts() });
  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: (v: typeof blank) => adminSaveDiscount({ data: v }),
    onSuccess: () => { setForm(null); setError(""); qc.invalidateQueries(); },
    onError: (e: Error) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteDiscount({ data: { id } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <>
      <AdminHeader
        title="کدهای تخفیف"
        subtitle="ساخت و مدیریت کمپین‌های تخفیف"
        action={<Btn onClick={() => { setForm(blank); setError(""); }}><span className="inline-flex items-center gap-1.5"><Plus size={15} /> کد جدید</span></Btn>}
      />

      {form && (
        <Panel className="mb-6 p-4 animate-rise-in">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm">{form.id ? "ویرایش کد" : "کد تخفیف جدید"}</h2>
            <button onClick={() => setForm(null)} aria-label="بستن" className="text-ink-3 hover:text-ink"><X size={16} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="کد (انگلیسی)">
              <input dir="ltr" className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="عنوان">
              <input className={inputCls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </Field>
            <Field label="درصد تخفیف">
              <input type="number" dir="ltr" className={inputCls} value={form.percent} onChange={(e) => setForm({ ...form, percent: Number(e.target.value) })} />
            </Field>
            <Field label="حداکثر استفاده (خالی = نامحدود)">
              <input type="number" dir="ltr" className={inputCls} value={form.maxUses ?? ""} onChange={(e) => setForm({ ...form, maxUses: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              فعال
            </label>
            <div className="ms-auto flex gap-2">
              <Btn variant="ghost" onClick={() => setForm(null)}>انصراف</Btn>
              <Btn onClick={() => save.mutate(form)} disabled={save.isPending}>ذخیره</Btn>
            </div>
          </div>
          {error && <p className="mt-3 border-2 border-ink bg-[var(--nb-danger)] px-3 py-2 text-xs font-bold">{error}</p>}
        </Panel>
      )}

      <Panel className="overflow-hidden">
        {list.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : (list.data ?? []).length === 0 ? (
          <Empty text="کد تخفیفی ثبت نشده است." />
        ) : (
          <ul className="divide-y-2 divide-ink">
            {(list.data ?? []).map((d) => (
              <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <div className="flex flex-wrap items-center gap-2 sm:contents">
                  <span className="font-mono text-xs" dir="ltr">{d.code}</span>
                  <Tag tone="ok">{num(d.percent)}٪</Tag>
                  {!d.active && <Tag tone="warn">غیرفعال</Tag>}
                  <span className="text-xs text-ink-2">{d.label}</span>
                  <span className="ms-auto text-[10px] text-ink-3">
                    استفاده: {num(d.used_count)}{d.max_uses ? ` / ${num(d.max_uses)}` : ""}
                  </span>
                </div>
                <div className="flex gap-2.5 sm:contents">
                  <button
                    onClick={() => setForm({ id: d.id, code: d.code, label: d.label ?? "", percent: d.percent, active: d.active, maxUses: d.max_uses })}
                    aria-label="ویرایش"
                    className="grid h-11 w-11 place-items-center border-2 border-ink bg-white text-ink nb-sh-sm nb-lift sm:h-9 sm:w-9"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`حذف کد ${d.code}؟`)) remove.mutate(d.id); }}
                    aria-label="حذف"
                    className="grid h-11 w-11 place-items-center border-2 border-ink bg-[var(--nb-danger)] text-ink nb-sh-sm nb-lift sm:h-9 sm:w-9"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
