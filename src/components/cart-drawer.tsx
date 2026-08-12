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
import { useState } from "react";

export function CartDrawer({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const totalItems = useCart((s) => s.totalItems());
  const totalPrice = useCart((s) => s.totalPrice());

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
            {totalItems > 0 && (
              <span className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 font-mono text-[10px] text-primary-foreground tabular">
                {toFa(totalItems)}
              </span>
            )}
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md flex flex-col nbh-border border-e-2 border-ink !p-0">
        <SheetHeader className="border-b-2 border-ink p-4">
          <SheetTitle className="font-display text-lg text-start">
            سبد خرید <span className="text-ink-3 font-mono text-sm tabular">[{toFa(totalItems)}]</span>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 grid place-items-center p-10 text-center">
            <div>
              <p className="font-mono text-xs tracking-widest text-ink-3 uppercase">[ EMPTY ]</p>
              <p className="mt-3 text-sm text-ink-2">سبد شما خالی است.</p>
              <Link
                to="/products"
                onClick={() => setOpen(false)}
                className="mt-6 inline-block rounded-sm bg-ink px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
              >
                مشاهده محصولات
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto divide-y-2 divide-ink">
              {items.map((it) => (
                <div key={it.productId} className="flex gap-3 p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden border-2 border-ink">
                    <ProductImage src={it.image} slug={it.slug} className="h-full w-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium truncate">{it.name}</h4>
                      <button
                        onClick={() => remove(it.productId)}
                        className="text-ink-3 hover:text-ink"
                        aria-label="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <PriceTag price={it.price} size="sm" />
                    <div className="mt-2">
                      <QuantityStepper value={it.qty} onChange={(n) => setQty(it.productId, n)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-ink p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-widest text-ink-3 uppercase">
                  TOTAL
                </span>
                <PriceTag price={totalPrice} size="lg" />
              </div>
              <Link
                to="/checkout"
                onClick={() => setOpen(false)}
                className="block w-full nbh-border nbh-sh-sm nbh-lift bg-ink py-3 text-center text-sm font-bold text-primary-foreground uppercase"
              >
                ادامه به پرداخت →
              </Link>
              <Link
                to="/cart"
                onClick={() => setOpen(false)}
                className="block w-full text-center text-xs text-ink-3 hover:text-ink underline underline-offset-4"
              >
                مشاهده سبد کامل
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
