import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProductImage } from "@/components/product-image";
import { PriceTag } from "@/components/price-tag";
import { QuantityStepper } from "@/components/quantity-stepper";
import { useCart } from "@/lib/cart-store";
import { validateDiscount } from "@/lib/catalog.functions";
import { toFa } from "@/lib/rtl";
import { calculateShippingAmount } from "@/lib/shipping";
import { Trash2 } from "lucide-react";


export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "سبد خرید — ابر تری دی" },
      { name: "description", content: "سبد خرید شما." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const subtotal = useCart((s) => s.totalPrice());

  const [code, setCode] = useState("");
  const applied = useCart((s) => s.discount);
  const setApplied = useCart((s) => s.setDiscount);
  const [error, setError] = useState<string | null>(null);

  const shipping = calculateShippingAmount(items);
  
  const discount = applied ? Math.round((subtotal * applied.percent) / 100) : 0;
  const total = subtotal - discount + shipping;

  async function applyCode() {

    setError(null);
    const d = await validateDiscount({ data: { code } });
    if (!d) { setError("کد تخفیف نامعتبر است."); return; }
    setApplied(d);
  }

  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ CART ]</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">سبد خرید</h1>

        {items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-xs tracking-widest text-ink-3 uppercase">[ EMPTY ]</p>
            <p className="mt-3 text-sm text-ink-2">هنوز چیزی به سبد اضافه نکرده‌ای.</p>
            <Link to="/products" className="mt-6 inline-block rounded-sm bg-ink px-5 py-2.5 text-sm text-primary-foreground">
              مشاهده محصولات
            </Link>
          </div>
        ) : (
            <div className="mt-8 grid gap-8 md:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <div className="divide-y-2 divide-ink/10 border-y-2 border-ink">
                  {items.map((it) => (
                    <div key={`${it.productId}-${it.color}-${it.size}`} className="group relative flex gap-6 py-8 first:pt-4 last:pb-4">
                      <Link
                        to="/products/$slug"
                        params={{ slug: it.slug }}
                        className="h-32 w-32 md:h-40 md:w-40 shrink-0 overflow-hidden nbh-border nbh-sh-sm bg-muted"
                      >
                        <ProductImage src={it.image} slug={it.slug} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      </Link>
                      
                      <div className="flex flex-1 flex-col py-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <Link
                              to="/products/$slug"
                              params={{ slug: it.slug }}
                              className="font-display text-xl md:text-2xl hover:text-ink-3 transition-colors line-clamp-2"
                            >
                              {it.name}
                            </Link>
                            
                            {(it.color || it.size) && (
                              <div className="flex flex-wrap gap-3 pt-2">
                                {it.color && (
                                  <div className="flex items-baseline gap-2">
                                    <span className="font-mono text-[10px] text-ink-3 uppercase">Color</span>
                                    <span className="text-sm font-bold">{it.color}</span>
                                  </div>
                                )}
                                {it.size && (
                                  <div className="flex items-baseline gap-2">
                                    <span className="font-mono text-[10px] text-ink-3 uppercase">Size</span>
                                    <span className="text-sm font-bold">{it.size}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={() => remove(it.productId, it.color, it.size)}
                            className="text-ink-3 hover:text-hot transition-colors p-2 -m-2"
                            aria-label="حذف"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>

                        <div className="mt-auto pt-6 flex flex-wrap items-end justify-between gap-4">
                          <div className="space-y-4">
                            <div className="flex items-baseline gap-3">
                              <span className="font-mono text-[10px] text-ink-3 uppercase">Unit Price</span>
                              <PriceTag price={it.price} size="sm" />
                            </div>
                            <QuantityStepper
                              value={it.qty}
                              onChange={(n) => setQty(it.productId, it.color, it.size, n)}
                            />
                          </div>
                          <div className="text-left">
                            <p className="font-mono text-[10px] text-ink-3 uppercase mb-1">Subtotal</p>
                            <PriceTag price={it.price * it.qty} size="lg" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <button onClick={clear} className="font-mono text-[10px] tracking-widest text-ink-3 hover:text-hot transition-colors uppercase border-b border-transparent hover:border-hot pb-1">
                    [ CLEAR_ALL_ITEMS ]
                  </button>
                </div>
              </div>

            <aside className="nbh-card p-5 h-fit bg-surface md:sticky md:top-20">
              <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ SUMMARY ]</p>

              <div className="mt-4 space-y-2 text-sm">
                <Row label="جمع کالاها" value={subtotal} />
                <Row label="هزینه ارسال" value={shipping} />
                {applied && <Row label={`تخفیف (${applied.code})`} value={-discount} />}
              </div>

              <div className="mt-4 border-t-2 border-ink pt-4">
                <div className="flex items-center gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="کد تخفیف"
                    className="flex-1 nbh-border bg-background px-3 py-2 text-sm font-bold"
                  />
                  <button onClick={() => void applyCode()} className="nbh-border nbh-sh-sm nbh-lift px-3 py-2 text-sm font-bold">
                    اعمال
                  </button>
                </div>
                {error && <p className="mt-2 text-xs text-hot">{error}</p>}
                {applied && <p className="mt-2 text-xs text-ink-2">✓ {applied.label} اعمال شد.</p>}
              </div>

              <div className="mt-4 border-t-2 border-ink pt-4 flex items-baseline justify-between">
                <span className="font-mono text-[10px] font-bold tracking-widest text-ink-3 uppercase">TOTAL</span>
                <PriceTag price={total} size="lg" />
              </div>

              <Link to="/checkout" className="mt-5 block w-full text-center nbh-border nbh-sh-sm nbh-lift bg-ink py-3 text-sm font-bold text-primary-foreground uppercase">
                ادامه به پرداخت
              </Link>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-3">{label}</span>
      <span className="font-mono tabular">
        {value < 0 ? `- ${toFa(Math.abs(value).toLocaleString("en-US"))}` : toFa(value.toLocaleString("en-US"))}
      </span>
    </div>
  );
}
