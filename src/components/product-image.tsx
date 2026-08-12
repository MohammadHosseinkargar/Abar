import { useMemo } from "react";

/** Deterministic monochrome SVG "product photo" based on slug. */
export function ProductImage({
  slug,
  label,
  className = "",
  variant = "grid",
  src,
  loading = "lazy",
  priority = false,
}: {
  slug: string;
  label?: string;
  className?: string;
  variant?: "grid" | "hero";
  src?: string | null;
  loading?: "lazy" | "eager";
  priority?: boolean;
}) {
  const seed = useMemo(() => {
    let h = 0;
    for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
    return h;
  }, [slug]);

  if (src) {
    return (
      <img
        src={src}
        alt={label ?? slug}
        loading={priority ? undefined : loading}
        fetchPriority={priority ? "high" : "auto"}
        className={`object-cover ${className}`}
      />
    );
  }


  const shape = seed % 5;
  const rotate = (seed >> 3) % 45;
  const tone1 = 180 + ((seed >> 5) % 60); // 180-240
  const tone2 = 40 + ((seed >> 7) % 40);  // 40-80

  const fg = `rgb(${tone2},${tone2},${tone2})`;
  const mid = `rgb(${tone1 - 40},${tone1 - 40},${tone1 - 40})`;
  const bg = `rgb(${tone1},${tone1},${tone1})`;

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      aria-label={label ?? slug}
      role="img"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="400" height="400" fill={bg} />
      {/* grid backdrop */}
      <g opacity="0.35" stroke="rgb(0,0,0)" strokeOpacity="0.06">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={"h" + i} x1={0} y1={i * 50} x2={400} y2={i * 50} />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={"v" + i} x1={i * 50} y1={0} x2={i * 50} y2={400} />
        ))}
      </g>

      <g transform={`translate(200 210) rotate(${rotate})`}>
        {shape === 0 && (
          <>
            <polygon points="-90,80 0,-100 90,80" fill={fg} />
            <polygon points="-50,80 0,-30 50,80" fill={mid} />
          </>
        )}
        {shape === 1 && (
          <>
            <circle r="100" fill={fg} />
            <circle r="55" fill={mid} />
            <circle r="18" fill={bg} />
          </>
        )}
        {shape === 2 && (
          <>
            <rect x="-95" y="-95" width="190" height="190" fill={fg} />
            <rect x="-45" y="-45" width="90" height="90" fill={mid} />
          </>
        )}
        {shape === 3 && (
          <>
            <polygon points="0,-100 87,-50 87,50 0,100 -87,50 -87,-50" fill={fg} />
            <polygon points="0,-55 48,-27 48,27 0,55 -48,27 -48,-27" fill={mid} />
          </>
        )}
        {shape === 4 && (
          <>
            <path d="M -95 40 Q 0 -140 95 40 L 60 90 L -60 90 Z" fill={fg} />
            <circle cx="0" cy="20" r="26" fill={mid} />
          </>
        )}
      </g>

      {variant === "hero" && (
        <g fontFamily="Space Mono, monospace" fontSize="10" fill="rgb(0,0,0)" fillOpacity="0.4">
          <text x="16" y="24">[ 3D PRINT ]</text>
          <text x="16" y="384">MODEL / {slug.toUpperCase().slice(0, 24)}</text>
        </g>
      )}
    </svg>
  );
}
