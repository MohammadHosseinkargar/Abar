import { type ReactNode } from "react";
import { toFa } from "@/lib/rtl";

export function AdminHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 animate-rise-in sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <p className="inline-block border-2 border-ink bg-[var(--nb-accent)] px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.2em] text-ink uppercase nb-sh-sm">
          ADMIN
        </p>
        <h1 className="mt-3 text-xl leading-tight sm:text-2xl sm:leading-none">{title}</h1>
        {subtitle && <p className="mt-2 text-sm font-medium text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}


export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border-2 border-ink bg-card nb-sh-md ${className}`}>{children}</div>;
}

const statTones = ["var(--nb-primary)", "var(--nb-success)", "var(--nb-warning)", "var(--nb-accent)"];

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  const hash = [...label].reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = tone ?? statTones[hash % statTones.length];
  return (
    <div className="border-2 border-ink bg-card nb-sh-md nb-lift">
      <div className="border-b-2 border-ink px-3 py-1.5" style={{ background: bg }}>
        <p className="font-mono text-[10px] font-bold tracking-widest text-ink uppercase">{label}</p>
      </div>
      <div className="p-4">
        <p className="nb-num text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-1.5 text-xs font-medium text-ink-2">{hint}</p>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-ink uppercase">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full border-2 border-ink bg-white px-3 py-2 text-sm font-medium text-ink outline-none placeholder:text-ink-3";

export const selectCls =
  "w-full border-2 border-ink bg-white px-3 py-2 text-sm font-medium text-ink outline-none cursor-pointer";

export function Btn({
  children,
  onClick,
  type = "button",
  variant = "solid",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "solid" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const styles =
    variant === "solid"
      ? "bg-[var(--nb-primary)] text-white"
      : variant === "danger"
        ? "bg-[var(--nb-danger)] text-ink"
        : "bg-white text-ink";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`border-2 border-ink px-4 py-2 text-sm font-bold uppercase nb-sh-sm nb-lift disabled:pointer-events-none disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  children,
  onClick,
  label,
  tone = "default",
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center border-2 border-ink nb-sh-sm nb-lift ${
        tone === "danger" ? "bg-[var(--nb-danger)] text-ink" : "bg-white text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "ok" | "warn" }) {
  const bg =
    tone === "ok" ? "var(--nb-success)" : tone === "warn" ? "var(--nb-warning)" : "#f3ece0";
  return (
    <span
      className="inline-block border-2 border-ink px-2 py-0.5 font-mono text-[10px] font-bold text-ink"
      style={{ background: bg }}
    >
      {children}
    </span>
  );
}

export function num(v: number) {
  return toFa(v.toLocaleString("en-US"));
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="mx-auto mb-4 h-10 w-10 border-2 border-ink bg-[var(--nb-warning)] nb-sh-sm" />
      <p className="text-sm font-bold text-ink uppercase">{text}</p>
    </div>
  );
}
