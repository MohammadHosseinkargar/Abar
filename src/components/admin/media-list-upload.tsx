import { useRef, useState, useEffect } from "react";
import { Box, ImagePlus, Loader2, Trash2, ArrowRight, ArrowLeft, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { adminUploadImage, adminUploadModel } from "@/lib/uploads.functions";
import { optimizeMedia, type OptimizationResult } from "@/lib/media-optimizer";
import { num } from "./kit";

interface UploadTask {
  id: string;
  file: File;
  status: "idle" | "optimizing" | "uploading" | "success" | "error";
  progress: number;
  result?: OptimizationResult;
  error?: string;
  url?: string;
}

/** Robust multi-file uploader with optimization, progress, and drag & drop. */
export function MediaListUpload({
  kind,
  value,
  onChange,
  onMetadataChange,
  metadata,
  label,
  max = 12,
}: {
  kind: "image" | "model";
  value: string[];
  onChange: (urls: string[]) => void;
  onMetadataChange?: (metadata: Record<string, any>) => void;
  metadata?: Record<string, any>;
  label?: string;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isOver, setIsOver] = useState(false);
  const isImage = kind === "image";

  // Cleanup successful tasks after some time
  useEffect(() => {
    const timer = setTimeout(() => {
      setTasks(prev => prev.filter(t => t.status !== "success"));
    }, 5000);
    return () => clearTimeout(timer);
  }, [tasks]);

  const addFiles = (files: File[]) => {
    const newTasks: UploadTask[] = files.slice(0, max - value.length).map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: "idle",
      progress: 0,
    }));
    setTasks(prev => [...prev, ...newTasks]);
    newTasks.forEach(processTask);
  };

  const processTask = async (task: UploadTask) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "optimizing", progress: 20 } : t));

    try {
      // 1. Optimize
      const opt = await optimizeMedia(task.file, kind);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "uploading", progress: 60, result: opt } : t));

      // 2. Upload
      const dataUrl = await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.readAsDataURL(opt.blob);
      });

      const out = isImage
        ? await adminUploadImage({ data: { dataUrl, filename: task.file.name, metadata: opt.metadata } })
        : await adminUploadModel({ data: { dataUrl, filename: task.file.name, metadata: opt.metadata } });

      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "success", progress: 100, url: out.url } : t));
      
      // Update parent value and metadata
      if (onMetadataChange && metadata) {
        onMetadataChange({ ...metadata, [out.url]: opt.metadata });
      }
      onChange([...value, out.url]);
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "error", error: err instanceof Error ? err.message : "خطا در بارگذاری" } : t));
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">
          {label ?? (isImage ? "تصاویر محصول (گالری)" : "مدل‌های سه‌بعدی (STL)")}
        </span>
        <span className="font-mono text-[10px] text-ink-3 tabular">{value.length}/{max}</span>
      </div>

      <div className="flex flex-wrap gap-4">
        {value.map((url, i) => (
          <div key={url} className="group relative w-28">
            <div className="nbh-card overflow-hidden h-28 w-28 bg-white flex items-center justify-center">
              {isImage ? (
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Box size={32} className="text-ink-3" />
              )}
            </div>
            
            <div className="mt-2 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="grid h-7 w-7 place-items-center border-2 border-ink bg-white hover:bg-muted disabled:opacity-30">
                <ArrowRight size={12} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === value.length - 1} className="grid h-7 w-7 place-items-center border-2 border-ink bg-white hover:bg-muted disabled:opacity-30">
                <ArrowLeft size={12} />
              </button>
              <button onClick={() => onChange(value.filter((_, k) => k !== i))} className="grid h-7 w-7 place-items-center border-2 border-ink bg-[var(--nb-danger)] hover:opacity-80">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {value.length < max && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
            onDragLeave={() => setIsOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              relative grid h-28 w-28 cursor-pointer place-items-center rounded-sm border-2 border-dashed border-ink transition-colors
              ${isOver ? "bg-muted border-primary scale-95" : "bg-white hover:bg-muted"}
              ${tasks.some(t => t.status !== "success" && t.status !== "error") ? "pointer-events-none opacity-60" : ""}
            `}
          >
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Upload size={20} className={isOver ? "animate-bounce" : ""} />
              <span className="text-[10px] font-bold">افزودن فایل</span>
              <span className="text-[8px] text-ink-3 px-1 leading-tight">یا رها کردن فایل</span>
            </div>
          </div>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map(t => (
            <div key={t.id} className="nbh-card p-3 animate-rise-in flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-bold truncate">{t.file.name}</p>
                  <span className="text-[9px] font-mono text-ink-3">
                    {t.status === "optimizing" ? "بهینه‌سازی..." : 
                     t.status === "uploading" ? "بارگذاری..." : 
                     t.status === "success" ? "موفق" : 
                     t.status === "error" ? "خطا" : "آماده"}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted border border-ink overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${t.status === "error" ? "bg-[var(--nb-danger)]" : "bg-ink"}`} 
                    style={{ width: `${t.progress}%` }} 
                  />
                </div>
                {t.result && (
                  <p className="mt-1 text-[9px] font-mono text-ink-3">
                    کاهش حجم: %{t.result.ratio} ({num(Math.round(t.result.optimizedSize / 1024))}KB از {num(Math.round(t.result.originalSize / 1024))}KB)
                  </p>
                )}
                {t.error && <p className="mt-1 text-[9px] text-[var(--nb-danger)] font-bold">{t.error}</p>}
              </div>
              {t.status === "success" && <CheckCircle2 size={16} className="text-[var(--nb-success)]" />}
              {t.status === "error" && <AlertCircle size={16} className="text-[var(--nb-danger)]" />}
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={isImage ? "image/jpeg,image/png,image/webp,image/avif,image/gif" : ".stl,model/stl,application/sla"}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) addFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
