import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { adminListCategories, adminSaveCategory, adminDeleteCategory } from "@/lib/admin.functions";
import { AdminHeader, Panel, Btn, Field, inputCls, Empty, num } from "@/components/admin/kit";
import { ImageUpload } from "@/components/admin/image-upload";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: AdminCategories,
});

const blank = { id: null as string | null, slug: "", name: "", tagline: "", sortOrder: 0, imageUrl: null as string | null };

function AdminCategories() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin-categories"], queryFn: () => adminListCategories() });
  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: (v: typeof blank) => adminSaveCategory({ data: v }),
    onSuccess: () => { setForm(null); setError(""); qc.invalidateQueries(); },
    onError: (e: Error) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteCategory({ data: { id } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <>
      <AdminHeader
        title="دسته‌بندی‌ها"
        subtitle="ساختار دسته‌های فروشگاه"
        action={<Btn onClick={() => { setForm(blank); setError(""); }}><span className="inline-flex items-center gap-1.5"><Plus size={15} /> دسته جدید</span></Btn>}
      />

      {form && (
        <Panel className="mb-6 p-4 animate-rise-in">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm">{form.id ? "ویرایش دسته" : "دسته جدید"}</h2>
            <button onClick={() => setForm(null)} aria-label="بستن" className="text-ink-3 hover:text-ink"><X size={16} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام دسته">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="اسلاگ (انگلیسی)">
              <input dir="ltr" className={inputCls} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </Field>
            <Field label="توضیح کوتاه">
              <input className={inputCls} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            </Field>
            <Field label="ترتیب نمایش">
              <input type="number" dir="ltr" className={inputCls} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </Field>
            <div className="sm:col-span-2">
              <ImageUpload label="تصویر دسته" value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setForm(null)}>انصراف</Btn>
            <Btn onClick={() => save.mutate(form)} disabled={save.isPending}>ذخیره</Btn>
          </div>
          {error && <p className="mt-3 border-2 border-ink bg-[var(--nb-danger)] px-3 py-2 text-xs font-bold">{error}</p>}
        </Panel>
      )}

      <Panel className="overflow-hidden">
        {list.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : (list.data ?? []).length === 0 ? (
          <Empty text="دسته‌ای وجود ندارد." />
        ) : (
          <ul className="divide-y-2 divide-ink">
            {(list.data ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden border-2 border-ink bg-white">
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[9px] text-ink-3">NO IMG</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{c.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-ink-3" dir="ltr">{c.slug}</p>
                </div>
                <span className="text-xs text-ink-3">{c.tagline}</span>
                <span className="font-mono text-[10px] text-ink-3">#{num(c.sort_order)}</span>
                <button
                  onClick={() => setForm({ id: c.id, slug: c.slug, name: c.name, tagline: c.tagline ?? "", sortOrder: c.sort_order, imageUrl: c.image_url ?? null })}
                  aria-label="ویرایش"
                  className="grid h-9 w-9 place-items-center border-2 border-ink bg-white text-ink nb-sh-sm nb-lift"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => { if (confirm(`حذف دسته «${c.name}»؟`)) remove.mutate(c.id); }}
                  aria-label="حذف"
                  className="grid h-9 w-9 place-items-center border-2 border-ink bg-[var(--nb-danger)] text-ink nb-sh-sm nb-lift"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
