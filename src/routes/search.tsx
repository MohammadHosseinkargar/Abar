import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProductCard } from "@/components/product-card";
import { productsQuery } from "@/lib/queries";
import { Search as SearchIcon } from "lucide-react";
import { toFa } from "@/lib/rtl";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "جستجو — ابر تری دی" },
      { name: "description", content: "جستجوی محصولات چاپ سه‌بعدی." },
      { property: "og:title", content: "جستجو — ابر تری دی" },
      { property: "og:description", content: "جستجوی محصولات چاپ سه‌بعدی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const { data: products } = useSuspenseQuery(productsQuery);
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s),
    );
  }, [q, products]);


  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ SEARCH ]</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">جستجو</h1>

        <div className="mt-6 flex items-center gap-2 rounded-[6px] border-2 border-ink bg-surface px-3 nbh-sh-sm">
          <SearchIcon size={20} className="text-ink-3 shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="نام محصول، دسته‌بندی..."
            className="w-full min-w-0 border-0 bg-transparent py-3 text-lg placeholder:text-ink-3 focus:outline-none"
            style={{ border: "none", boxShadow: "none", outline: "none" }}
          />

        </div>

        {q.trim() && (
          <p className="mt-4 font-mono text-xs text-ink-3 tabular">
            {toFa(results.length)} نتیجه
          </p>
        )}

        {q.trim() === "" ? (
          <p className="mt-16 text-center text-sm text-ink-3">برای شروع، چیزی تایپ کن.</p>
        ) : results.length === 0 ? (
          <p className="mt-16 text-center text-sm text-ink-3">نتیجه‌ای پیدا نشد.</p>
        ) : (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {results.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
