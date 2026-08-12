import { Minus, Plus } from "lucide-react";
import { toFa } from "@/lib/rtl";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center border border-line rounded-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-11 w-11 place-items-center text-ink-2 hover:bg-muted"
        aria-label="کاهش"
      >
        <Minus size={14} />
      </button>
      <span className="grid h-11 w-10 place-items-center font-mono text-sm tabular">
        {toFa(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid h-11 w-11 place-items-center text-ink-2 hover:bg-muted"
        aria-label="افزایش"
      >
        <Plus size={14} />
      </button>
    </div>

  );
}
