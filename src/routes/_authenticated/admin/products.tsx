import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Palette, Type } from "lucide-react";
import {
  adminListProducts,
  adminSaveProduct,
  adminDeleteProduct,
  adminListCategories,
} from "@/lib/admin.functions";
import { AdminHeader, Panel, Btn, Field, inputCls, Tag, num, Empty } from "@/components/admin/kit";
import { MediaListUpload } from "@/components/admin/media-list-upload";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: AdminProducts,
});

type Row = Awaited<ReturnType<typeof adminListProducts>>[number];

const blank = {
  id: null as string | null,
  slug: "",
  name: "",
  categorySlug: "",
  price: 0,
  costPrice: 0,
  compareAt: null as number | null,
  stock: 0,
  material: "",
  color: "",
  sizeMm: "",
  availableColors: [] as string[],
  availableSizes: [] as string[],
  description: "",
  imageUrls: [] as string[],
  imageMetadata: {} as Record<string, any>,
  modelUrls: [] as string[],
  modelMetadata: {} as Record<string, any>,
  featured: false,
  isActive: true,
  isBookmark: false,
};

function AdminProducts() {
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["admin-products"], queryFn: () => adminListProducts() });
  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminListCategories(),
  });
  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [only, setOnly] = useState<"all" | "low" | "inactive" | "featured">("all");

  const save = useMutation({
    mutationFn: (v: typeof blank) => adminSaveProduct({ data: v }),
    onSuccess: () => {
      setForm(null);
      setError("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteProduct({ data: { id } }),
    onMutate: () => setError(""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
    onError: (e: Error) => setError(e.message),
  });

  const edit = (p: Row) =>
    setForm({
      id: p.id,
      slug: p.slug,
      name: p.name,
      categorySlug: p.category_slug,
      price: p.price,
      costPrice: (p as any).cost_price ?? 0,
      compareAt: p.compare_at,
      stock: p.stock,
      material: p.material ?? "",
      color: p.color ?? "",
      sizeMm: p.size_mm ?? "",
      availableColors: (p as any).available_colors ?? [],
      availableSizes: (p as any).available_sizes ?? [],
      description: p.description ?? "",
      imageUrls: p.image_urls?.length ? p.image_urls : p.image_url ? [p.image_url] : [],
      imageMetadata: (p as any).image_metadata ?? {},
      modelUrls: p.model_urls?.length ? p.model_urls : p.model_url ? [p.model_url] : [],
      modelMetadata: (p as any).model_metadata ?? {},
      featured: p.featured,
      isActive: p.is_active,
      isBookmark: (p as any).is_bookmark ?? false,
    });

  const term = q.trim().toLowerCase();
  const rows = (products.data ?? []).filter((p) => {
    if (term && !`${p.name} ${p.slug}`.toLowerCase().includes(term)) return false;
    if (cat && p.category_slug !== cat) return false;
    if (only === "low" && p.stock > 3) return false;
    if (only === "inactive" && p.is_active) return false;
    if (only === "featured" && !p.featured) return false;
    return true;
  });

  return (
    <>
      <AdminHeader
        title="محصولات"
        subtitle="افزودن، ویرایش و مدیریت موجودی"
        action={
          <Btn
            onClick={() => {
              setForm({ ...blank, categorySlug: categories.data?.[0]?.slug ?? "" });
              setError("");
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus size={15} /> محصول جدید
            </span>
          </Btn>
        }
      />

      {form && (
        <Panel className="mb-6 p-4 animate-rise-in">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm">{form.id ? "ویرایش محصول" : "محصول جدید"}</h2>
            <button
              onClick={() => setForm(null)}
              aria-label="بستن"
              className="text-ink-3 hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="نام محصول">
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="اسلاگ (انگلیسی)">
              <input
                dir="ltr"
                className={inputCls}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </Field>
            <Field label="دسته‌بندی">
              <select
                className={inputCls}
                value={form.categorySlug}
                onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
              >
                <option value="">— انتخاب کنید —</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="قیمت (تومان)">
              <input
                type="number"
                dir="ltr"
                className={inputCls}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </Field>
            <Field label="قیمت قبل از تخفیف">
              <input
                type="number"
                dir="ltr"
                className={inputCls}
                value={form.compareAt ?? ""}
                onChange={(e) =>
                  setForm({ ...form, compareAt: e.target.value ? Number(e.target.value) : null })
                }
              />
            </Field>
            <Field label="موجودی">
              <input
                type="number"
                dir="ltr"
                className={inputCls}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
              />
            </Field>
            <Field label="جنس">
              <input
                className={inputCls}
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
              />
            </Field>
            <Field label="رنگ">
              <input
                className={inputCls}
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </Field>
            <Field label="ابعاد (mm)">
              <input
                dir="ltr"
                className={inputCls}
                value={form.sizeMm}
                onChange={(e) => setForm({ ...form, sizeMm: e.target.value })}
              />
            </Field>

            <div className="sm:col-span-2 lg:col-span-3 grid gap-4 md:grid-cols-2">
              <div className="nbh-border rounded-[6px] bg-muted p-4">
                <div className="mb-3 flex items-center gap-2 border-b-2 border-ink pb-2">
                  <Palette size={18} />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    رنگ‌های قابل انتخاب
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
                  {form.availableColors.map((color, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 nbh-border rounded-[4px] bg-white px-2 py-1 text-[10px] font-bold"
                    >
                      {color}
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            availableColors: form.availableColors.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-ink-3 hover:text-[var(--nb-danger)]"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {form.availableColors.length === 0 && (
                    <span className="text-[10px] text-ink-3 italic py-1">رنگی اضافه نشده است</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} h-9 text-xs`}
                    placeholder="نام رنگ جدید..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !form.availableColors.includes(val)) {
                          setForm({ ...form, availableColors: [...form.availableColors, val] });
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                  <Btn
                    className="h-9 shrink-0"

                    onClick={() => {
                      const input = document.querySelector(
                        'input[placeholder="نام رنگ جدید..."]',
                      ) as HTMLInputElement;
                      const val = input?.value.trim();
                      if (val && !form.availableColors.includes(val)) {
                        setForm({ ...form, availableColors: [...form.availableColors, val] });
                        if (input) input.value = "";
                      }
                    }}
                  >
                    افزودن
                  </Btn>
                </div>
              </div>

              <div className="nbh-border rounded-[6px] bg-muted p-4">
                <div className="mb-3 flex items-center gap-2 border-b-2 border-ink pb-2">
                  <Type size={18} />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    سایزهای قابل انتخاب
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
                  {form.availableSizes.map((size, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 nbh-border rounded-[4px] bg-white px-2 py-1 text-[10px] font-bold"
                    >
                      {size}
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            availableSizes: form.availableSizes.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-ink-3 hover:text-[var(--nb-danger)]"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {form.availableSizes.length === 0 && (
                    <span className="text-[10px] text-ink-3 italic py-1">سایزی اضافه نشده است</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} h-9 text-xs`}
                    placeholder="سایز جدید (مثلاً: L)..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !form.availableSizes.includes(val)) {
                          setForm({ ...form, availableSizes: [...form.availableSizes, val] });
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                  <Btn
                    className="h-9 shrink-0"

                    onClick={() => {
                      const input = document.querySelector(
                        'input[placeholder="سایز جدید (مثلاً: L)..."]',
                      ) as HTMLInputElement;
                      const val = input?.value.trim();
                      if (val && !form.availableSizes.includes(val)) {
                        setForm({ ...form, availableSizes: [...form.availableSizes, val] });
                        if (input) input.value = "";
                      }
                    }}
                  >
                    افزودن
                  </Btn>
                </div>
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <MediaListUpload
                kind="image"
                value={form.imageUrls}
                metadata={form.imageMetadata}
                onMetadataChange={(m) => setForm({ ...form, imageMetadata: m })}
                onChange={(urls) => setForm({ ...form, imageUrls: urls })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <MediaListUpload
                kind="model"
                value={form.modelUrls}
                metadata={form.modelMetadata}
                onMetadataChange={(m) => setForm({ ...form, modelMetadata: m })}
                onChange={(urls) => setForm({ ...form, modelUrls: urls })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="توضیحات">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              محصول ویژه
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isBookmark}
                onChange={(e) => setForm({ ...form, isBookmark: e.target.checked })}
              />
              محصول بوکمارک است
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              فعال در فروشگاه
            </label>
            <div className="ms-auto flex gap-2">
              <Btn variant="ghost" onClick={() => setForm(null)}>
                انصراف
              </Btn>
              <Btn onClick={() => save.mutate(form)} disabled={save.isPending}>
                {save.isPending ? "در حال ذخیره…" : "ذخیره"}
              </Btn>
            </div>
          </div>
          {error && (
            <p className="mt-3 border-2 border-ink bg-[var(--nb-danger)] px-3 py-2 text-xs font-bold">
              {error}
            </p>
          )}
        </Panel>
      )}

      <Panel className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className={inputCls}
            placeholder="جستجو در نام یا اسلاگ…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">همه دسته‌ها</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className={inputCls}
            value={only}
            onChange={(e) => setOnly(e.target.value as typeof only)}
          >
            <option value="all">همه محصولات</option>
            <option value="low">موجودی کم (≤۳)</option>
            <option value="inactive">غیرفعال</option>
            <option value="featured">ویژه</option>
          </select>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        {products.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : rows.length === 0 ? (
          <Empty text="محصولی با این شرایط پیدا نشد." />
        ) : (
          <ul className="divide-y-2 divide-ink">
            {rows.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden border-2 border-ink bg-white">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[9px] text-ink-3">NO IMG</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:truncate">{p.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-ink-3" dir="ltr">
                    {p.slug} · {p.category_slug}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:contents">
                  <span className="font-mono text-xs">{num(p.price)}</span>
                  <Tag tone={p.stock > 3 ? "muted" : "warn"}>موجودی {num(p.stock)}</Tag>
                  {(p as any).is_bookmark && <Tag tone="ok">بوکمارک</Tag>}
                  {p.featured && <Tag tone="ok">ویژه</Tag>}
                  {!p.is_active && <Tag tone="warn">غیرفعال</Tag>}
                  <div className="ms-auto flex gap-2.5 sm:ms-0">
                    <button
                      onClick={() => edit(p)}
                      aria-label="ویرایش"
                      className="grid h-11 w-11 place-items-center border-2 border-ink bg-white text-ink nb-sh-sm nb-lift sm:h-9 sm:w-9"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`محصول «${p.name}» برای همیشه حذف شود؟`)) remove.mutate(p.id);
                      }}
                      aria-label="حذف"
                      className="grid h-11 w-11 place-items-center border-2 border-ink bg-[var(--nb-danger)] text-ink nb-sh-sm nb-lift sm:h-9 sm:w-9"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
