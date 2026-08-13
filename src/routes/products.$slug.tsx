import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProductImage } from "@/components/product-image";
import { ProductCard } from "@/components/product-card";
import { PriceTag } from "@/components/price-tag";
import { RatingStars } from "@/components/rating-stars";
import { QuantityStepper } from "@/components/quantity-stepper";
import { productQuery } from "@/lib/queries";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCart } from "@/lib/cart-store";
import { toFa } from "@/lib/rtl";
import { Check, ShoppingBag, ArrowLeft } from "lucide-react";
import { ReviewForm } from "@/components/review-form";
import { ModelShowcase } from "@/components/model-showcase";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.product.name, description: data.product.description };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.name} — ابر تری دی` },
      { name: "description", content: loaderData.description },
      { property: "og:title", content: loaderData.name },
      { property: "og:description", content: loaderData.description },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ] : [{ title: "محصول — ابر تری دی" }],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(slug));
  const product = data!.product;
  const related = data!.related;
  const reviews = data!.reviews;
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [color, setColor] = useState<string>("");
  const [size, setSize] = useState<string>("");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const images: string[] = product.images?.length
    ? product.images
    : product.imageUrl
      ? [product.imageUrl]
      : [];
  const models: string[] = product.models?.length
    ? product.models
    : product.modelUrl
      ? [product.modelUrl]
      : [];
  const media: { kind: "image" | "model"; url?: string }[] = [
    ...(images.length ? images.map((url) => ({ kind: "image" as const, url })) : [{ kind: "image" as const }]),
    ...models.map((url) => ({ kind: "model" as const, url })),
  ];
  const [active, setActive] = useState(models.length ? images.length || 1 : 0);
  const current = media[Math.min(active, media.length - 1)]!;



  function handleAdd() {
    if (product.availableColors && product.availableColors.length > 0 && !color) {
      setError("لطفاً رنگ را انتخاب کنید.");
      return;
    }
    if (product.availableSizes && product.availableSizes.length > 0 && !size) {
      setError("لطفاً سایز را انتخاب کنید.");
      return;
    }
    setError("");
    add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.imageUrl,
        color: color || undefined,
        size: size || undefined,
        isBookmark: product.isBookmark,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-12">
        <nav className="mb-5 flex items-center gap-2 overflow-x-auto whitespace-nowrap font-mono text-[10px] tracking-widest text-ink-3 uppercase md:mb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link to="/" className="shrink-0 hover:text-ink">HOME</Link>
          <span className="shrink-0">/</span>
          <Link to="/products" className="shrink-0 hover:text-ink">CATALOG</Link>
          <span className="shrink-0">/</span>
          <span className="shrink-0 text-ink">{product.slug}</span>
        </nav>

        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <div className="min-w-0 md:sticky md:top-24 md:self-start">
            <div className="aspect-square max-h-[70vh] w-full overflow-hidden rounded-[6px] border-2 border-ink bg-surface nbh-sh-md">
              {current.kind === "model" && current.url ? (
                <ModelShowcase src={current.url} label={product.name} className="h-full w-full" />
              ) : (
                <ProductImage src={current.url} slug={product.slug} variant="hero" className="h-full w-full" />
              )}
            </div>

            {current.kind === "model" && (
              <p className="mt-2 font-mono text-[10px] tracking-widest text-ink-3 uppercase">
                [ برای چرخش، مدل را بکشید ]
              </p>
            )}

            {media.length > 1 && (
              <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {media.map((m, i) => (
                  <button
                    key={`${m.kind}-${i}`}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={m.kind === "model" ? "مدل سه‌بعدی" : "تصویر محصول"}
                    className={`relative aspect-square w-16 shrink-0 overflow-hidden rounded-[6px] border-2 border-ink transition-transform active:translate-x-[2px] active:translate-y-[2px] sm:w-auto ${
                      i === Math.min(active, media.length - 1) ? "nbh-sh-sm" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {m.kind === "model" ? (
                      <span className="grid h-full w-full place-items-center bg-surface font-mono text-[9px] tracking-widest text-ink-2">
                        3D
                      </span>
                    ) : (
                      <ProductImage src={m.url} slug={`${product.slug}-${i}`} className="h-full w-full" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>



          <div className="min-w-0 rounded-[6px] border-2 border-ink bg-surface p-4 nbh-sh-md sm:p-6">
            <p className="truncate font-mono text-[10px] tracking-widest text-ink-3 uppercase">
              [ MODEL / {toFa(product.id.toUpperCase())} ]
            </p>
            <h1 className="mt-3 font-display text-2xl font-light sm:text-3xl md:text-4xl">{product.name}</h1>

            <div className="mt-3">
              <RatingStars rating={product.rating} count={product.reviewsCount} />
            </div>

            <div className="mt-6">
              <PriceTag price={product.price} compareAt={product.compareAt} size="lg" />
            </div>

            <p className="mt-6 text-sm text-ink-2 leading-relaxed">{product.description}</p>

            {/* Selection Options */}
            <div className="mt-8 space-y-6">
              {product.availableColors && product.availableColors.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase mb-3">[ SELECT COLOR / انتخاب رنگ ]</p>
                  <div className="flex flex-wrap gap-2">
                    {product.availableColors.map((c: string) => (
                      <button
                        key={c}
                        onClick={() => { setColor(c); setError(""); }}
                        className={`nbh-border px-4 py-2 text-xs font-bold transition-all ${
                          color === c ? "bg-ink text-white nbh-sh-sm" : "bg-white text-ink hover:bg-ink/5"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {product.availableSizes && product.availableSizes.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase mb-3">[ SELECT SIZE / انتخاب سایز ]</p>
                  <div className="flex flex-wrap gap-2">
                    {product.availableSizes.map((s: string) => (
                      <button
                        key={s}
                        onClick={() => { setSize(s); setError(""); }}
                        className={`nbh-border px-4 py-2 text-xs font-bold transition-all ${
                          size === s ? "bg-ink text-white nbh-sh-sm" : "bg-white text-ink hover:bg-ink/5"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <dl className="mt-8 divide-y-2 divide-ink rounded-[6px] border-2 border-ink bg-background px-3 nbh-sh-sm">
              {product.specs.map((s: { label: string; value: string }) => (
                <div key={s.label} className="flex items-start justify-between gap-3 py-3">
                  <dt className="shrink-0 font-mono text-[10px] tracking-widest text-ink-3 uppercase">
                    {s.label}
                  </dt>
                  <dd className="min-w-0 text-end text-sm text-ink">{s.value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between py-3">
                <dt className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">موجودی</dt>
                <dd className="text-sm">
                  {product.stock > 20 ? (
                    <span className="text-ink">موجود</span>
                  ) : product.stock > 0 ? (
                    <span className="text-hot">فقط {toFa(product.stock)} عدد</span>
                  ) : (
                    <span className="text-ink-3">ناموجود</span>
                  )}
                </dd>
              </div>
            </dl>

            {error && (
              <p className="mt-4 text-xs font-bold text-hot animate-pulse">{error}</p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <QuantityStepper value={qty} onChange={setQty} />
              <button
                onClick={handleAdd}
                disabled={product.stock === 0}
                className="inline-flex min-h-12 flex-1 basis-40 items-center justify-center gap-2 nbh-border nbh-sh-sm nbh-lift bg-ink px-5 py-3 text-sm font-bold text-primary-foreground uppercase disabled:cursor-not-allowed disabled:opacity-40"
              >
                {added ? (<><Check size={16} /> افزوده شد</>) : (<><ShoppingBag size={16} /> افزودن به سبد</>)}
              </button>
            </div>


            <p className="mt-4 font-mono text-[10px] tracking-widest text-ink-3 uppercase">
              [ ارسال ۲ تا ۵ روز کاری · ضمانت کیفیت چاپ ]
            </p>
          </div>
        </div>

        {/* REVIEWS */}
        <section className="mt-16 rounded-[8px] border-2 border-ink bg-background p-5 md:p-7 nbh-sh-md">
          <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ REVIEWS ]</p>
          <h2 className="mt-2 font-display text-2xl">نظرات مشتریان</h2>
          {reviews.length === 0 ? (
            <div className="mt-4 rounded-[6px] border-2 border-ink bg-surface p-4 nbh-sh-sm">
              <p className="text-sm text-ink-3">هنوز نظری برای این محصول ثبت نشده است.</p>
            </div>
          ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-[6px] border-2 border-ink bg-surface p-4 nbh-sh-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{r.name}</p>
                  <RatingStars rating={r.rating} />
                </div>
                <p className="mt-2 text-sm text-ink-2 leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
          )}

          <ReviewForm productId={product.id} />
        </section>

        {related.length > 0 && (
          <section className="mt-8 rounded-[8px] border-2 border-ink bg-background p-5 md:p-7 nbh-sh-md">
            <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ RELATED ]</p>
            <h2 className="mt-2 font-display text-2xl">محصولات مرتبط</h2>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </section>
        )}


        <div className="mt-12">
          <Link to="/products" className="inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
            <ArrowLeft size={14} /> بازگشت به کاتالوگ
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
