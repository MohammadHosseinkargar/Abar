import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
  color?: string;
  size?: string;
  isBookmark?: boolean;
};

export type AppliedDiscount = { code: string; percent: number; label: string };

type CartState = {
  items: CartItem[];
  discount: AppliedDiscount | null;
  setDiscount: (d: AppliedDiscount | null) => void;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (productId: string, color?: string, size?: string) => void;
  setQty: (productId: string, color: string | undefined, size: string | undefined, qty: number) => void;
  clear: () => void;
  totalItems: () => number;
  totalPrice: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      discount: null,
      setDiscount: (d) => set({ discount: d }),
      add: (item, qty = 1) =>
        set((s) => {
          const existing = s.items.find(
            (i) =>
              i.productId === item.productId &&
              i.color === item.color &&
              i.size === item.size,
          );
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === item.productId &&
                i.color === item.color &&
                i.size === item.size
                  ? { ...i, qty: i.qty + qty }
                  : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, qty }] };
        }),
      remove: (productId, color, size) =>
        set((s) => ({
          items: s.items.filter(
            (i) =>
              !(
                i.productId === productId &&
                i.color === color &&
                i.size === size
              ),
          ),
        })),
      setQty: (productId, color, size, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter(
                  (i) =>
                    !(
                      i.productId === productId &&
                      i.color === color &&
                      i.size === size
                    ),
                )
              : s.items.map((i) =>
                  i.productId === productId &&
                  i.color === color &&
                  i.size === size
                    ? { ...i, qty }
                    : i,
                ),
        })),
      clear: () => set({ items: [], discount: null }),
      totalItems: () => get().items.reduce((n, i) => n + i.qty, 0),
      totalPrice: () => get().items.reduce((n, i) => n + i.qty * i.price, 0),
    }),
    { name: "cart-store" },
  ),
);
