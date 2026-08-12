import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { normalizeError } from "@/lib/error-handler";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { toFa } from "@/lib/rtl";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyProfile,
  updateMyProfile,
  addMyAddress,
  deleteMyAddress,
  listMyOrders,
} from "@/lib/account.functions";
import { Package, MapPin, LogOut, Trash2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "حساب کاربری — ابر تری دی" },
      { name: "description", content: "پروفایل، آدرس‌ها و تنظیمات حساب کاربری." },
      { property: "og:title", content: "حساب کاربری — ابر تری دی" },
      { property: "og:description", content: "پروفایل، آدرس‌ها و تنظیمات حساب." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const account = useQuery({ queryKey: ["account"], queryFn: () => getMyProfile() });
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: () => listMyOrders() });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (account.data) {
      setFullName(account.data.profile.fullName);
      setPhone(account.data.profile.phone);
    }
  }, [account.data]);

  const save = useMutation({
    mutationFn: () => updateMyProfile({ data: { fullName, phone } }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (err) => {
      const normalized = normalizeError(err);
      toast.error(normalized.error.message);
    },
  });

  const [addr, setAddr] = useState({
    receiver: "", phone: "", province: "", city: "", line: "", postalCode: "",
  });
  const addAddress = useMutation({
    mutationFn: () => addMyAddress({ data: addr }),
    onSuccess: () => {
      setAddr({ receiver: "", phone: "", province: "", city: "", line: "", postalCode: "" });
      qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (err) => {
      const normalized = normalizeError(err);
      toast.error(normalized.error.message);
    },
  });
  const removeAddress = useMutation({
    mutationFn: (id: string) => deleteMyAddress({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account"] }),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  }

  const initial = (fullName || "م").trim().charAt(0);

  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ ACCOUNT ]</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">حساب کاربری</h1>

        <div className="nbh-card mt-8 flex items-center gap-4 p-4 sm:p-6">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-ink text-primary-foreground font-display text-lg">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-medium">{fullName || "کاربر"}</p>
            <p className="mt-0.5 font-mono text-xs text-ink-3 tabular">{phone ? toFa(phone) : "بدون شماره"}</p>
          </div>
          <button onClick={signOut} className="ms-auto inline-flex min-h-11 items-center gap-2 nbh-border nbh-sh-sm nbh-lift bg-surface px-3 text-sm font-bold text-ink">
            <LogOut size={14} /> خروج
          </button>
        </div>

        {account.data?.isAdmin && (
          <Link
            to="/admin"
            className="mt-6 flex min-h-11 items-center gap-2 nbh-border nbh-sh-sm nbh-lift bg-surface px-4 py-3 text-sm font-bold"
          >
            <ShieldCheck size={15} /> ورود به پنل مدیریت
          </Link>
        )}


        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link to="/orders" className="nbh-card nbh-lift group p-5 transition-colors">
            <div className="grid h-10 w-10 place-items-center rounded-sm border border-line group-hover:border-ink transition-colors">
              <Package size={16} />
            </div>
            <p className="mt-4 text-sm font-medium">سفارش‌های من</p>
            <p className="mt-1 text-xs text-ink-3">{toFa(orders.data?.length ?? 0)} سفارش ثبت‌شده</p>
          </Link>
          <div className="nbh-card p-5">
            <div className="grid h-10 w-10 place-items-center rounded-sm border border-line"><MapPin size={16} /></div>
            <p className="mt-4 text-sm font-medium">آدرس‌ها</p>
            <p className="mt-1 text-xs text-ink-3">{toFa(account.data?.addresses.length ?? 0)} آدرس ذخیره‌شده</p>
          </div>
                  </div>

        {/* PROFILE FORM */}
        <section className="nbh-card mt-10 p-4 sm:p-6">
          <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ PROFILE ]</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="نام و نام خانوادگی" value={fullName} onChange={setFullName} />
            <Field label="شماره موبایل" value={phone} onChange={setPhone} />
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mt-5 min-h-11 nbh-border nbh-sh-sm nbh-lift bg-ink px-5 py-2.5 text-sm font-bold text-primary-foreground uppercase disabled:opacity-60"
          >
            {save.isPending ? "..." : saved ? "ذخیره شد ✓" : "ذخیره تغییرات"}
          </button>
        </section>

        {/* ADDRESSES */}
        <section className="nbh-card mt-8 p-4 sm:p-6">
          <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ ADDRESSES ]</p>
          <div className="mt-4 space-y-3">
            {(account.data?.addresses ?? []).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-muted p-4">
                <div className="text-sm">
                  <p className="font-medium">{a.receiver} — {a.city}</p>
                  <p className="mt-1 text-xs text-ink-2 leading-relaxed">{a.province}، {a.line}</p>
                  <p className="mt-1 font-mono text-xs text-ink-3 tabular">{toFa(a.phone)}</p>
                </div>
                <button onClick={() => removeAddress.mutate(a.id)} className="grid h-11 w-11 shrink-0 place-items-center border-2 border-ink bg-surface text-ink-3 hover:bg-ink hover:text-primary-foreground" aria-label="حذف آدرس">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {account.data && account.data.addresses.length === 0 && (
              <p className="text-sm text-ink-3">هنوز آدرسی ثبت نکرده‌اید.</p>
            )}
          </div>

          <div className="mt-6 grid gap-4 border-t-2 border-ink pt-6 md:grid-cols-2">
            <Field label="نام گیرنده" value={addr.receiver} onChange={(v) => setAddr({ ...addr, receiver: v })} />
            <Field label="شماره تماس" value={addr.phone} onChange={(v) => setAddr({ ...addr, phone: v })} />
            <Field label="استان" value={addr.province} onChange={(v) => setAddr({ ...addr, province: v })} />
            <Field label="شهر" value={addr.city} onChange={(v) => setAddr({ ...addr, city: v })} />
            <Field label="کد پستی" value={addr.postalCode} onChange={(v) => setAddr({ ...addr, postalCode: v })} />
            <div className="md:col-span-2">
              <Field label="آدرس دقیق" value={addr.line} onChange={(v) => setAddr({ ...addr, line: v })} />
            </div>
            <button
              onClick={() => addAddress.mutate()}
              disabled={addAddress.isPending}
              className="min-h-11 justify-self-start nbh-border nbh-sh-sm nbh-lift bg-surface px-5 py-2.5 text-sm font-bold uppercase disabled:opacity-60"
            >
              افزودن آدرس
            </button>
            {addAddress.isError && <p className="text-xs text-hot md:col-span-2">{normalizeError(addAddress.error).error.message}</p>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 min-h-11 w-full nbh-border bg-background px-3 py-2.5 text-sm font-bold outline-none"
      />
    </label>
  );
}
