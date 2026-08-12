import { toFa } from "@/lib/rtl";

export function PriceTag({
  price,
  compareAt,
  size = "md",
}: {
  price: number;
  compareAt?: number;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeCls =
    size === "xl"
      ? "text-3xl"
      : size === "lg"
        ? "text-2xl"
        : size === "sm"
          ? "text-sm"
          : "text-base";
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular font-mono">
      <span className={`${sizeCls} shrink-0 whitespace-nowrap font-bold text-ink`}>
        {toFa(price.toLocaleString("en-US"))}
      </span>
      {compareAt && compareAt > price && (
        <span className="shrink-0 whitespace-nowrap text-xs text-ink-3 line-through">
          {toFa(compareAt.toLocaleString("en-US"))}
        </span>
      )}
      <span className="shrink-0 whitespace-nowrap text-[10px] font-bold tracking-widest text-ink-3 uppercase">
        تومان
      </span>
    </div>
  );
}
