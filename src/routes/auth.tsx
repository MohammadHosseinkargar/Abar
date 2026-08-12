import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "ورود و ثبت‌نام — ابر تری دی" },
      { name: "description", content: "ورود به حساب کاربری فروشگاه چاپ سه‌بعدی." },
      { property: "og:title", content: "ورود و ثبت‌نام — ابر تری دی" },
      { property: "og:description", content: "ورود به حساب کاربری فروشگاه چاپ سه‌بعدی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/profile", replace: true });
    });
  }, [navigate, redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        setInfo("حساب ساخته شد. اگر تایید ایمیل فعال باشد، ایمیل خود را بررسی کنید.");
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: redirect ?? "/profile", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: redirect ?? "/profile", replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? persianAuthError(err.message) : "خطایی رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("ورود با گوگل ناموفق بود.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: redirect ?? "/profile", replace: true });
  }

  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-md px-4 py-12 md:py-20 rise-in">
        <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ ACCOUNT ]</p>
        <h1 className="mt-2 font-display text-3xl">{mode === "signin" ? "ورود" : "ثبت‌نام"}</h1>
        <p className="mt-2 text-sm text-ink-2">
          برای ثبت سفارش و پیگیری آن وارد حساب خود شوید.
        </p>

        <button
          onClick={onGoogle}
          className="mt-8 w-full nbh-border nbh-sh-sm nbh-lift px-4 py-3 text-sm font-bold"
        >
          ادامه با گوگل
        </button>

        <div className="my-6 flex items-center gap-3 text-ink-3">
          <span className="h-px flex-1 bg-line" />
          <span className="font-mono text-[10px] tracking-widest uppercase">OR</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <Field label="نام و نام خانوادگی" value={fullName} onChange={setFullName} />
          )}
          <Field label="ایمیل" value={email} onChange={setEmail} type="email" />
          <Field label="رمز عبور" value={password} onChange={setPassword} type="password" />
          {error && <p className="text-xs text-hot">{error}</p>}
          {info && <p className="text-xs text-ink-2">{info}</p>}
          <button
            disabled={busy}
            className="w-full nbh-border nbh-sh-sm nbh-lift bg-ink py-3 text-sm font-bold text-primary-foreground uppercase disabled:opacity-60"
          >
            {busy ? "..." : mode === "signin" ? "ورود" : "ساخت حساب"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 w-full text-sm text-ink-2 hover:text-ink underline underline-offset-4"
        >
          {mode === "signin" ? "حساب ندارید؟ ثبت‌نام کنید" : "حساب دارید؟ وارد شوید"}
        </button>
      </div>
    </AppShell>
  );
}

function persianAuthError(msg: string) {
  if (msg.includes("Invalid login")) return "ایمیل یا رمز عبور نادرست است.";
  if (msg.includes("already registered")) return "این ایمیل قبلاً ثبت شده است.";
  if (msg.toLowerCase().includes("password")) return "رمز عبور باید حداقل ۶ کاراکتر باشد.";
  return "خطایی رخ داد. دوباره تلاش کنید.";
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">{label}</span>
      <input
        type={type}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full nbh-border bg-background px-3 py-2.5 text-sm font-bold outline-none"
      />
    </label>
  );
}
