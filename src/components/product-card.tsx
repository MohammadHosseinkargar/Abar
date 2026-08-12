import { Link } from "@tanstack/react-router";
import { Product } from "@/data/products";
import { ProductImage } from "./product-image";
import { PriceTag } from "./price-tag";
import { RatingStars } from "./rating-stars";

export function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const onSale = product.compareAt && product.compareAt > product.price;
  return (
    <Link
      to="/products/$slug"
      params={{ slug: product.slug }}
      className="group block rise-in"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="relative overflow-hidden border-line border-2 bg-surface">
        <ProductImage
          src={product.imageUrl}
          slug={product.slug}
          label={product.name}
          className="aspect-square w-full transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]"
          loading={index < 4 ? "eager" : "lazy"}
          priority={index < 2}
        />

        {onSale && (
          <span className="absolute top-2 end-2 bg-ink px-2 py-1 font-mono text-[10px] tracking-widest text-primary-foreground uppercase">
            SALE
          </span>
        )}
        {product.stock <= 5 && product.stock < 999 && (
          <span className="absolute bottom-2 start-2 border-line border-2 bg-surface/90 px-2 py-1 font-mono text-[10px] tracking-widest text-ink-2 uppercase backdrop-blur">
            {product.stock === 0 ? "ناموجود" : "موجودی محدود"}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-ink group-hover:underline underline-offset-4 decoration-1">
            {product.name}
          </h3>
          <p className="mt-1 text-xs text-ink-3 truncate">{product.material}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <PriceTag price={product.price} compareAt={product.compareAt} size="sm" />
        <RatingStars rating={product.rating} count={product.reviewsCount} size={12} />
      </div>
    </Link>
  );
}
