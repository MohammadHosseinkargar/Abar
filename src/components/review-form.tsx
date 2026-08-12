import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star, Loader2, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitReview } from "@/lib/account.functions";
import { useAuth } from "@/hooks/use-auth";
import { normalizeError } from "@/lib/error-handler";

export function ReviewForm({ productId }: { productId: string }) {
  const { session } = useAuth();
  const send = useServerFn(submitReview);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-line bg-surface p-5 text-center">
        <p className="text-sm text-ink-2">برای ثبت نظر ابتدا وارد حساب خود شوید.</p>
        <Link
          to="/auth"
          search={{ redirect: undefined }}
          className="mt-3 inline-flex rounded-sm border border-ink px-4 py-2 text-sm hover:bg-ink hover:text-primary-foreground transition-colors"
        >
          ورود / ثبت‌نام
        </Link>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="mt-8 rounded-lg border border-line bg-surface p-5 flex items-center gap-3">
        <Check size={16} />
        <p className="text-sm text-ink-2">نظر شما ثبت شد و پس از تأیید مدیر نمایش داده می‌شود.</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 3) {
      setError("متن نظر خیلی کوتاه است.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      await send({ data: { productId, rating, body: body.trim(), authorName: name.trim() || undefined } });
      setState("done");
    } catch (err) {
      setState("idle");
      const normalized = normalizeError(err);
      setError(normalized.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded-lg border border-line bg-surface p-5">
      <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ WRITE REVIEW ]</p>

      <div className="mt-4 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`امتیاز ${n}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              size={20}
              className={(hover || rating) >= n ? "fill-ink text-ink" : "text-ink-3"}
            />
          </button>
        ))}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="نام نمایشی (اختیاری)"
        maxLength={60}
        className="mt-4 w-full rounded-sm border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-ink transition-colors"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="تجربه‌تان از کیفیت چاپ، بسته‌بندی و ارسال را بنویسید…"
        rows={4}
        maxLength={600}
        className="mt-3 w-full resize-none rounded-sm border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-ink transition-colors"
      />

      {error && <p className="mt-2 text-xs text-hot">{error}</p>}

      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-4 inline-flex items-center gap-2 rounded-sm bg-ink px-5 py-2.5 text-sm text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {state === "sending" && <Loader2 size={14} className="animate-spin" />}
        ثبت نظر
      </button>
    </form>
  );
}
