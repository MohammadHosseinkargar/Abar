import { Link } from "@tanstack/react-router";
import { ShoppingBag, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-store";
import { PriceTag } from "./price-tag";
import { QuantityStepper } from "./quantity-stepper";
import { ProductImage } from "./product-image";
import { toFa } from "@/lib/rtl";
import { useState, useEffect } from "react";

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

export function CartDrawer({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const totalItems = useCart((s) => s.totalItems());
  const totalPrice = useCart((s) => s.totalPrice());
  const hydrated = useHydrated();
  
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label="سبد خرید"
            className="relative grid h-10 w-10 place-items-center rounded-sm hover:bg-muted transition-colors"
          >
            <ShoppingBag size={18} />
            {hydrated && totalItems > 0 && (
              <span className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 font-mono text-[10px] text-primary-foreground tabular">
                {toFa(totalItems)}
              </span>
            )}
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md flex flex-col border-ink !p-0 gap-0">
        <SheetHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-xl md:text-2xl">
              سبد خرید
            </SheetTitle>
            {hydrated && totalItems > 0 && (
              <span className="font-mono text-[10px] tabular text-ink-3">
                [{toFa(totalItems)} کالا]
              </span>
            )}
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5">
            <div className="relative">
              <div className="absolute inset-0 bg-ink/5 blur-2xl rounded-full" />
              <ShoppingBag size={48} className="relative text-ink-3 opacity-20" />
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[9px] tracking-widest text-ink-3 uppercase">[ EMPTY_STATE ]</p>
              <h3 className="font-display text-lg">سبد شما خالی است</h3>
              <p className="text-xs text-ink-3 max-w-[200px] mx-auto leading-relaxed">
                هنوز هیچ محصولی به سبد خرید خود اضافه نکرده‌اید.
              </p>
            </div>
            <Link
              to="/products"
              onClick={() => setOpen(false)}
              className="nbh-border nbh-sh-sm nbh-lift bg-ink px-6 py-2.5 text-xs font-bold text-primary-foreground uppercase"
            >
              مشاهده محصولات
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 scrollbar-none">
              {items.map((it) => (
                <div key={`${it.productId}-${it.color}-${it.size}`} className="group relative flex gap-3 p-2 nbh-border bg-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="h-20 w-20 shrink-0 overflow-hidden border border-ink/10 bg-muted rounded-sm">
                    <ProductImage src={it.image} slug={it.slug} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  
                  <div className="flex flex-1 flex-col justify-between py-0.5">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold leading-tight line-clamp-2">{it.name}</h4>
                        <button
                          onClick={() => remove(it.productId, it.color, it.size)}
                          className="text-ink-3 hover:text-hot transition-colors p-1"
                          aria-label="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      {(it.color || it.size) && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {it.color && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] text-ink-3 font-mono border border-ink/5 bg-ink/5 uppercase">
                              {it.color}
                            </span>
                          )}
                          {it.size && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] text-ink-3 font-mono border border-ink/5 bg-ink/5 uppercase">
                              {it.size}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <PriceTag price={it.price} size="sm" />
                      <div className="scale-75 origin-right -mr-2">
                        <QuantityStepper
                          value={it.qty}
                          onChange={(n) => setQty(it.productId, it.color, it.size, n)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 bg-surface border-t-2 border-ink space-y-4 shadow-[0_-4px_0_0_rgba(0,0,0,0.05)]">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-ink-3">
                  <span className="font-mono text-[9px] tracking-widest uppercase">Subtotal</span>
                  <span className="font-mono text-xs tabular">{toFa(totalPrice.toLocaleString())}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-base">جمع کل</span>
                  <PriceTag price={totalPrice} size="lg" />
                </div>
              </div>

              <div className="grid gap-2 pt-1">
                <Link
                  to="/checkout"
                  onClick={() => setOpen(false)}
                  className="w-full nbh-border nbh-sh-sm nbh-lift bg-ink py-3.5 text-center text-xs font-bold text-primary-foreground uppercase"
                >
                  تکمیل سفارش →
                </Link>
                <Link
                  to="/cart"
                  onClick={() => setOpen(false)}
                  className="w-full py-1.5 text-center text-[9px] font-mono tracking-widest text-ink-3 hover:text-ink transition-colors uppercase"
                >
                  [ FULL_VIEW ]
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
