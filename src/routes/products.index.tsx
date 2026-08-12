import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProductCard } from "@/components/product-card";
import { productsQuery, categoriesQuery } from "@/lib/queries";
import { toFa } from "@/lib/rtl";

type Search = { cat?: string; sort?: "new" | "price-asc" | "price-desc" | "rating"; q?: string };

export const Route = createFileRoute("/products/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    cat: typeof s.cat === "string" ? s.cat : undefined,
    sort: (s.sort as Search["sort"]) ?? "new",
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "محصولات — ابر تری دی" },
      { name: "description", content: "همه محصولات چاپ سه‌بعدی: فیگور، دکور، قطعات کاربردی." },
      { property: "og:title", content: "محصولات — ابر تری دی" },
      { property: "og:description", content: "کاتالوگ کامل محصولات چاپ سه‌بعدی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
    ]);
  },
  component: ProductsPage,
});

function ProductsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [inStock, setInStock] = useState(false);
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);

  const filtered = useMemo(() => {
    let list = [...products];

    if (search.cat) list = list.filter((p) => p.category === search.cat);
    if (search.q) {
      const q = search.q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (inStock) list = list.filter((p) => p.stock > 0);
    switch (search.sort) {
      case "price-asc":  list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "rating":     list.sort((a, b) => b.rating - a.rating); break;
      default: break;
    }
    return list;
  }, [search, inStock]);

  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ CATALOG ]</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">محصولات</h1>
        <p className="mt-1 font-mono text-xs text-ink-3 tabular">
          {toFa(filtered.length)} کالا
        </p>

        {/* Category chips */}
        <div className="mt-6 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-3 pt-1">
            <button
              onClick={() => navigate({ search: (s: Search) => ({ ...s, cat: undefined }) })}
              className={`nbh-border nbh-sh-sm nbh-lift rounded-[6px] px-4 py-2 text-xs font-bold whitespace-nowrap ${
                !search.cat ? "bg-ink text-primary-foreground" : "bg-surface text-ink"
              }`}
            >
              همه
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => navigate({ search: (s: Search) => ({ ...s, cat: c.slug }) })}
                className={`nbh-border nbh-sh-sm nbh-lift rounded-[6px] px-4 py-2 text-xs font-bold whitespace-nowrap ${
                  search.cat === c.slug ? "bg-ink text-primary-foreground" : "bg-surface text-ink"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Sort + filter row */}
        <div className="nbh-border nbh-sh-sm mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-surface px-4 py-3">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
              className="h-4 w-4 accent-black"
            />
            فقط موجود
          </label>

          <select
            value={search.sort}
            onChange={(e) => navigate({ search: (s: Search) => ({ ...s, sort: e.target.value as Search["sort"] }) })}
            className="nbh-border nbh-sh-sm rounded-[6px] bg-surface px-3 py-2 text-sm font-bold"
          >
            <option value="new">جدیدترین</option>
            <option value="price-asc">ارزان‌ترین</option>
            <option value="price-desc">گران‌ترین</option>
            <option value="rating">بیشترین امتیاز</option>
          </select>
        </div>


        {filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-xs tracking-widest text-ink-3 uppercase">[ NO RESULTS ]</p>
            <p className="mt-3 text-sm text-ink-2">محصولی با این فیلترها پیدا نشد.</p>
            <Link to="/products" className="mt-6 inline-block text-sm underline underline-offset-4">
              پاک کردن فیلترها
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
