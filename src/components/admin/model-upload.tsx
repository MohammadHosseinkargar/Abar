import { useRef, useState } from "react";
import { Box, Loader2, Trash2 } from "lucide-react";
import { adminUploadModel } from "@/lib/uploads.functions";

export function ModelUpload({
  value,
  onChange,
  label = "مدل سه‌بعدی (STL)",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pick = async (file: File) => {
    setErr("");
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error("خواندن فایل ناموفق بود."));
        fr.readAsDataURL(file);
      });
      const out = await adminUploadModel({ data: { dataUrl, filename: file.name } });
      onChange(out.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "بارگذاری ناموفق بود.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] tracking-widest text-ink-3 uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center border-2 border-ink bg-white">
          <Box size={20} className={value ? "text-ink" : "text-ink-3"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-11 items-center gap-1.5 border-2 border-ink bg-white px-3 text-xs font-bold nb-sh-sm nb-lift sm:h-9"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Box size={14} />}
            {busy ? "در حال بارگذاری…" : value ? "تغییر مدل" : "انتخاب فایل STL"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex h-11 items-center gap-1.5 border-2 border-ink bg-[var(--nb-danger)] px-3 text-xs font-bold nb-sh-sm nb-lift sm:h-9"
            >
              <Trash2 size={14} /> حذف
            </button>
          )}
        </div>
      </div>
      {value && (
        <p className="mt-2 truncate font-mono text-[10px] text-ink-3" dir="ltr">
          {value}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stl"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
        }}
      />
      {err && <p className="mt-2 border-2 border-ink bg-[var(--nb-danger)] px-2 py-1 text-[11px] font-bold">{err}</p>}
    </label>
  );
}
