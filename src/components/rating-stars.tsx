import { Star } from "lucide-react";
import { toFa } from "@/lib/rtl";

export function RatingStars({
  rating,
  count,
  size = 14,
}: {
  rating: number;
  count?: number;
  size?: number;
}) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <div className="flex items-center gap-1 text-ink-2">
      <div className="flex" style={{ direction: "ltr" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className={i <= rounded ? "fill-ink text-ink" : "text-ink-3"}
          />
        ))}
      </div>
      <span className="font-mono text-xs tabular">
        {toFa(rating.toFixed(1))}
        {count !== undefined && (
          <span className="text-ink-3"> ({toFa(count)})</span>
        )}
      </span>
    </div>
  );
}
