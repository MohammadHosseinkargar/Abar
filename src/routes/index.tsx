import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Package, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { ModelShowcase } from "@/components/model-showcase";
import { productsQuery, categoriesQuery } from "@/lib/queries";
import { adminGetSettings } from "@/lib/admin.functions";
import { toFa } from "@/lib/rtl";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ابر تری دی — فروشگاه محصولات چاپ سه‌بعدی" },
      { name: "description", content: "دکور، فیگور و قطعات کاربردی از ابر تری دی." },
      { property: "og:title", content: "ابر تری دی — فروشگاه محصولات چاپ سه‌بعدی" },
      { property: "og:description", content: "دکور، فیگور، قطعات کاربردی." },
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
  component: HomePage,
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-block nbh-border nbh-sh-sm rounded-[6px] bg-surface px-2.5 py-1 font-mono text-[10px] tracking-widest text-ink uppercase">
      {children}
    </p>
  );
}

function HomePage() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: siteSettings } = useQuery({ queryKey: ["admin-settings"], queryFn: () => adminGetSettings() });
  
  const featured = products.filter((p) => p.featured);
  const latest = products.slice(0, 4);
  const heroModelFromSettings = siteSettings?.heroModelUrl;
  const heroModel = heroModelFromSettings || products.find((p) => p.featured && (p.models?.length || p.modelUrl))?.modelUrl;


  return (
    <AppShell variant="nbh">
      {/* HERO */}
      <section className="relative border-b-2 border-ink overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-24 grid gap-10 md:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="rise-in">
            <p className="mt-6 max-w-md nbh-border nbh-sh-sm rounded-[6px] bg-surface p-4 text-sm md:text-base text-ink-2 leading-relaxed">
              محصولات چاپ‌شده با پرینترهای دقیق و متریال مقاوم.
              از دکور مینیمال تا قطعات کاربردی و سفارش‌های اختصاصی.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/products"
                className="nbh-border nbh-sh-md nbh-lift inline-flex items-center gap-2 rounded-[6px] bg-ink px-6 py-3.5 text-sm font-bold text-primary-foreground uppercase"
              >
                مشاهده محصولات
                <ArrowLeft size={16} strokeWidth={2.5} />
              </Link>
              <a
                href="tel:+989152844711"
                className="nbh-border nbh-sh-sm nbh-lift inline-flex items-center gap-2 rounded-[6px] bg-surface px-6 py-3.5 text-sm font-bold uppercase"
              >
                تماس با ما
              </a>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 max-w-md">
              {[
                { label: "محصول فعال", value: toFa(products.length) },
                { label: "دسته‌بندی", value: toFa(categories.length) },
                { label: "امتیاز مشتری", value: "۴٫۸" },
              ].map((s) => (
                <div key={s.label} className="nbh-border nbh-sh-sm rounded-[6px] bg-surface p-3">
                  <p className="font-mono text-2xl tabular">{s.value}</p>
                  <p className="mt-1 font-mono text-[10px] tracking-widest text-ink-3 uppercase">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-square rounded-[6px] overflow-hidden nbh-border nbh-sh-lg bg-surface">
              {heroModel ? (
                <ModelShowcase src={typeof heroModel === 'string' ? heroModel : (heroModel as any).models?.[0] || (heroModel as any).modelUrl!} label="Hero Model" className="h-full w-full" />

              ) : (
                <ProductImage slug="hero-showcase-object" variant="hero" className="h-full w-full" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="border-b-2 border-ink overflow-hidden bg-ink">
        <div className="flex whitespace-nowrap py-3 marquee font-mono text-xs font-bold tracking-widest text-primary-foreground uppercase">
          {[...Array(2)].map((_, k) => (
            <div key={k} className="flex shrink-0 items-center gap-8 pe-8">
              <span>[ PLA ]</span><span>· PETG ·</span><span>[ RESIN ]</span>
              <span>· ارسال به سراسر ایران ·</span><span>[ ۰٫۱ mm ]</span>
              <span>· طراحی اختصاصی ·</span><span>[ SUB-D ]</span>
              <span>· ضمانت کیفیت ·</span>
            </div>
          ))}
        </div>
      </div>


      {/* CATEGORIES */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <SectionLabel>[ 01 / CATEGORIES ]</SectionLabel>
            <h2 className="mt-3 font-display text-2xl md:text-3xl">دسته‌بندی‌ها</h2>
          </div>
          <Link
            to="/products"
            className="nbh-border nbh-sh-sm nbh-lift hidden md:inline-block rounded-[6px] bg-surface px-4 py-2.5 text-sm font-bold uppercase"
          >
            همه محصولات
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {categories.map((c, i) => (
            <Link
              key={c.slug}
              to="/products"
              search={{ cat: c.slug } as never}
              className="nbh-card nbh-lift group relative overflow-hidden p-3 rise-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="aspect-[4/3] mb-3 overflow-hidden rounded-[4px] border-2 border-ink">
                <ProductImage src={c.imageUrl} slug={`cat-${c.slug}`} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
              </div>
              <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">
                {toFa(String(c.count).padStart(2, "0"))} — CAT
              </p>
              <h3 className="mt-1 text-sm font-bold">{c.name}</h3>
              <p className="mt-0.5 text-xs text-ink-3 line-clamp-1">{c.tagline}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20 border-t-2 border-ink">
        <div className="mb-8">
          <SectionLabel>[ 02 / FEATURED ]</SectionLabel>
          <h2 className="mt-3 font-display text-2xl md:text-3xl">پیشنهاد ویژه</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {featured.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="border-t-2 border-ink bg-muted">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-16 grid md:grid-cols-3 gap-6">
          {[
            { icon: Sparkles, title: "کیفیت صنعتی", body: "لایه ۰٫۱ میلی‌متر با پرینترهای کالیبره‌شده." },
            { icon: Package,  title: "بسته‌بندی ایمن", body: "ارسال با بسته‌بندی مقاوم و پیگیری کامل." },
            { icon: Zap,      title: "ارسال سریع", body: "آماده‌سازی و ارسال در کوتاه‌ترین زمان." },
          ].map((v) => {
            const Icon = v.icon;
            return (
              <div key={v.title} className="nbh-card nbh-lift flex gap-4 p-5">
                <div className="shrink-0 grid h-12 w-12 place-items-center rounded-[4px] border-2 border-ink bg-ink text-primary-foreground">
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-display text-base">{v.title}</h3>
                  <p className="mt-1 text-sm text-ink-2 leading-relaxed">{v.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* LATEST */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20 border-t-2 border-ink">
        <div className="flex items-end justify-between mb-8">
          <div>
            <SectionLabel>[ 03 / LATEST ]</SectionLabel>
            <h2 className="mt-3 font-display text-2xl md:text-3xl">تازه‌ترین‌ها</h2>
          </div>
          <Link
            to="/products"
            className="nbh-border nbh-sh-sm nbh-lift rounded-[6px] bg-surface px-4 py-2.5 text-sm font-bold uppercase"
          >
            همه
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {latest.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t-2 border-ink">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <div className="nbh-border nbh-sh-lg rounded-[6px] bg-ink px-6 py-10 md:px-12 md:py-14 text-center">
            <p className="font-mono text-[10px] tracking-[0.3em] text-primary-foreground/70 uppercase">
              [ ABAR 3D / ORDER ]
            </p>
            <h2 className="mt-4 font-display text-2xl md:text-4xl text-primary-foreground">
              ایده‌ات را چاپ کنیم؟
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-primary-foreground/80 leading-relaxed">
              کاتالوگ را ببین یا مستقیم تماس بگیر — مشاوره متریال و کیفیت چاپ رایگان است.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                to="/products"
                className="nbh-border nbh-sh-sm nbh-lift inline-flex items-center gap-2 rounded-[6px] bg-surface px-6 py-3.5 text-sm font-bold uppercase text-ink"
              >
                مشاهده محصولات
                <ArrowLeft size={16} strokeWidth={2.5} />
              </Link>
              <a
                href="tel:+989152844711"
                dir="ltr"
                className="nbh-border nbh-sh-sm nbh-lift inline-flex items-center gap-2 rounded-[6px] bg-accent px-6 py-3.5 font-mono text-sm font-bold tabular text-ink"
              >
                +98 915 284 4711
              </a>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
