import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const ModelViewer = lazy(() =>
  import("@/components/model-viewer").then((m) => ({ default: m.ModelViewer })),
);

const Fallback = () => (
  <div className="grid h-full w-full place-items-center font-mono text-[10px] tracking-widest text-ink-3 uppercase">
    LOADING 3D…
  </div>
);

/** SSR-safe wrapper around the rotating STL viewer. */
export function ModelShowcase({
  src,
  className = "",
  label,
  spin = true,
}: {
  src: string;
  className?: string;
  label?: string;
  spin?: boolean;
}) {
  return (
    <div className={className}>
      <ClientOnly fallback={<Fallback />}>
        <Suspense fallback={<Fallback />}>
          <ModelViewer src={src} label={label} spin={spin} className="h-full w-full" />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
