import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { placeOrder, getMyProfile } from "@/lib/account.functions";
import { startPayment, getPaymentGatewayInfo } from "@/lib/payment.functions";
import { normalizeError } from "@/lib/error-handler";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PriceTag } from "@/components/price-tag";
import { useCart } from "@/lib/cart-store";
import { toFa } from "@/lib/rtl";
import { AlertCircle, Check } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "پرداخت — ابر تری دی" },
      { name: "description", content: "تکمیل خرید و پرداخت." },
    ],
  }),
  component: CheckoutPage,
});

const steps = ["اطلاعات", "ارسال", "پرداخت"] as const;

type DeliveryField = "name" | "phone" | "province" | "city" | "postcode" | "address";
type DeliveryErrors = Partial<Record<DeliveryField, string>>;

const deliveryFields: DeliveryField[] = ["name", "phone", "province", "city", "postcode", "address"];

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function validateDeliveryField(field: DeliveryField, value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return field === "postcode" ? "لطفاً کد پستی را وارد کنید." :
      field === "phone" ? "لطفاً شماره موبایل را وارد کنید." :
      field === "address" ? "لطفاً آدرس دقیق را وارد کنید." :
      field === "name" ? "لطفاً نام تحویل‌گیرنده را وارد کنید." :
      `لطفاً ${field === "province" ? "استان" : "شهر"} را وارد کنید.`;
  }
  if (field === "name") {
    if (trimmed.length < 2) return "نام تحویل‌گیرنده باید حداقل ۲ حرف باشد.";
    if (!/[A-Za-z\u0600-\u06FF]/.test(trimmed)) return "لطفاً نام را با حروف وارد کنید.";
  }
  if ((field === "province" || field === "city") && trimmed.length < 2)
    return `${field === "province" ? "نام استان" : "نام شهر"} باید حداقل ۲ حرف باشد.`;
  if (field === "phone") {
    const phone = normalizeDigits(trimmed).replace(/[\s-]/g, "");
    if (!/^09\d{9}$/.test(phone)) return "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.";
  }
  if (field === "postcode") {
    const postcode = normalizeDigits(trimmed).replace(/[\s-]/g, "");
    if (!/^\d{10}$/.test(postcode)) return "کد پستی باید دقیقاً ۱۰ رقم باشد.";
  }
  if (field === "address" && trimmed.length < 10) return "آدرس باید حداقل ۱۰ کاراکتر و به‌اندازه کافی دقیق باشد.";
}

function CheckoutPage() {
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.totalPrice());
  const clear = useCart((s) => s.clear);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", phone: "", city: "", province: "", address: "", postcode: "",
    shipping: "standard" as "standard" | "express",
    payment: "gateway" as "gateway" | "cod",
  });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState<{ id: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DeliveryErrors>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<DeliveryField, boolean>>>({});
  const [advanceAttempted, setAdvanceAttempted] = useState(false);
  const discountApplied = useCart((s) => s.discount);
  const account = useQuery({ queryKey: ["account"], queryFn: () => getMyProfile(), retry: false });
  const gateway = useQuery({ queryKey: ["payment-gateway"], queryFn: () => getPaymentGatewayInfo() });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth", search: { redirect: "/checkout" }, replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    const a = account.data?.addresses?.[0];
    if (a) {
      setForm((f) =>
        f.name || f.address
          ? f
          : {
              ...f,
              name: a.receiver,
              phone: a.phone,
              city: a.city,
              province: a.province,
              address: a.line,
              postcode: a.postal_code ?? "",
            },
      );
    } else if (account.data?.profile) {
      setForm((f) => (f.name ? f : { ...f, name: account.data.profile.fullName, phone: account.data.profile.phone }));
    }
  }, [account.data]);

  function validateDelivery() {
    const errors: DeliveryErrors = {};
    for (const field of deliveryFields) {
      const message = validateDeliveryField(field, form[field]);
      if (message) errors[field] = message;
    }
    setFieldErrors(errors);
    return errors;
  }

  function focusFirstInvalid(errors: DeliveryErrors) {
    const first = deliveryFields.find((field) => errors[field]);
    if (first) requestAnimationFrame(() => document.getElementById(`checkout-${first}`)?.focus());
  }

  function updateDeliveryField(field: DeliveryField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (advanceAttempted || touchedFields[field]) {
      setFieldErrors((current) => ({ ...current, [field]: validateDeliveryField(field, value) }));
    }
  }

  function blurDeliveryField(field: DeliveryField) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
    setFieldErrors((current) => ({ ...current, [field]: validateDeliveryField(field, form[field]) }));
  }

  function goToNextStep() {
    if (step === 0) {
      setAdvanceAttempted(true);
      const errors = validateDelivery();
      if (Object.keys(errors).length) {
        focusFirstInvalid(errors);
        return;
      }
    }
    setStep((current) => current + 1);
  }

  async function submitOrder() {
    const deliveryErrors = validateDelivery();
    if (Object.keys(deliveryErrors).length) {
      setAdvanceAttempted(true);
      setStep(0);
      focusFirstInvalid(deliveryErrors);
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const res = await placeOrder({
        data: {
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          shipping: form.shipping,
          payment: form.payment,
          discountCode: discountApplied?.code ?? null,
          address: {
            receiver: form.name,
            phone: form.phone,
            province: form.province || form.city,
            city: form.city,
            line: form.address,
            postalCode: form.postcode || undefined,
          },
        },
      });
      if (form.payment === "gateway") {
        const callbackUrl = window.location.origin.includes("localhost") || window.location.origin.includes("lovable.app")
          ? `${window.location.origin}/payment/callback`
          : "https://abar3d.ir/payment/callback";
          
        const pay = await startPayment({
          data: { orderId: res.id, callbackUrl },
        });
        if (pay.mode === "redirect") {
          clear();
          window.location.href = pay.url;
          return;
        }
      }
      clear();
      setDone(res);
    } catch (err) {
      const normalized = normalizeError(err);
      setError(normalized.error.message);
    } finally {
      setPlacing(false);
    }
  }

  const shipping = form.shipping === "express" ? 120000 : 65000;
  const discountValue = discountApplied ? Math.round((subtotal * discountApplied.percent) / 100) : 0;
  const total = subtotal - discountValue + shipping;

  if (items.length === 0 && !done) {
    return (
      <AppShell variant="nbh">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center nbh">
          <p className="font-mono text-xs tracking-widest text-ink-3 uppercase">[ EMPTY CART ]</p>
          <p className="mt-4 text-sm font-black text-ink">سبد خرید شما در حال حاضر خالی است.</p>
          <Link to="/products" className="mt-8 inline-block border-2 border-ink bg-ink px-8 py-3 text-xs font-black text-white nbh-sh-sm nbh-lift uppercase tracking-widest">
            مشاهده محصولات
          </Link>
        </div>
      </AppShell>
    );
  }

  if (done) {
    return (
      <AppShell variant="nbh">
        <div className="mx-auto max-w-xl px-4 py-24 text-center nbh">
          <div className="mx-auto grid h-16 w-16 place-items-center border-2 border-ink bg-[var(--nbh-surface-alt)] nbh-sh-sm mb-8">
            <Check size={32} className="text-ink" strokeWidth={3} />
          </div>
          <p className="font-mono text-xs tracking-widest text-ink-3 uppercase">[ ORDER PLACED ]</p>
          <h1 className="mt-4 font-display text-4xl">سفارش شما ثبت شد</h1>
          <p className="mt-4 text-sm font-bold text-ink-2">
            کد رهگیری سفارش: <span className="font-mono tabular font-black text-ink bg-ink/5 px-2 py-1 border border-ink/10">{toFa(done.code)}</span>
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/orders" className="border-2 border-ink bg-ink px-8 py-3 text-xs font-black text-white nbh-sh-sm nbh-lift uppercase tracking-widest">
              پیگیری سفارش‌ها
            </Link>
            <Link to="/products" className="border-2 border-ink bg-white px-8 py-3 text-xs font-black text-ink nbh-sh-sm nbh-lift uppercase tracking-widest">
              ادامه خرید
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell variant="nbh">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12 nbh">
        <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ CHECKOUT ]</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">پرداخت</h1>

        {/* Stepper */}
        <ol className="mt-8 flex items-center gap-3 overflow-x-auto pb-4 md:overflow-visible no-scrollbar">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 flex-1 min-w-fit">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center border-2 border-ink text-sm font-mono tabular nbh-sh-sm transition-colors duration-300 ${
                  i <= step ? "bg-ink text-white" : "bg-white text-ink"
                }`}
              >
                {toFa(i + 1)}
              </span>
              <span className={`text-sm font-black whitespace-nowrap ${i === step ? "text-ink" : "text-ink-3"}`}>{s}</span>
              {i < steps.length - 1 && <span className="hidden md:block flex-1 h-[2px] bg-ink/20" />}
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="nbh-card p-6 md:p-8 overflow-hidden bg-white">
              <div
                key={step}
                className="animate-in fade-in slide-in-from-left-4 duration-500 ease-out"
              >
                {step === 0 && (
                  <div className="space-y-5">
                    <Field name="name" label="نام و نام خانوادگی تحویل‌گیرنده" value={form.name} onChange={(v) => updateDeliveryField("name", v)} onBlur={() => blurDeliveryField("name")} error={fieldErrors.name} autoComplete="name" placeholder="مثلاً: علی رضایی" />
                    <Field name="phone" label="شماره موبایل جهت هماهنگی" value={form.phone} onChange={(v) => updateDeliveryField("phone", v)} onBlur={() => blurDeliveryField("phone")} error={fieldErrors.phone} inputMode="tel" autoComplete="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field name="province" label="استان" value={form.province} onChange={(v) => updateDeliveryField("province", v)} onBlur={() => blurDeliveryField("province")} error={fieldErrors.province} autoComplete="address-level1" placeholder="تهران" />
                      <Field name="city" label="شهر" value={form.city} onChange={(v) => updateDeliveryField("city", v)} onBlur={() => blurDeliveryField("city")} error={fieldErrors.city} autoComplete="address-level2" placeholder="تهران" />
                    </div>
                    <div className="grid grid-cols-1 gap-5">
                      <Field name="postcode" label="کد پستی (۱۰ رقمی)" value={form.postcode} onChange={(v) => updateDeliveryField("postcode", v)} onBlur={() => blurDeliveryField("postcode")} error={fieldErrors.postcode} inputMode="numeric" autoComplete="postal-code" placeholder="۱۲۳۴۵۶۷۸۹۰" />
                    </div>
                    <Field name="address" label="آدرس دقیق پستی" value={form.address} onChange={(v) => updateDeliveryField("address", v)} onBlur={() => blurDeliveryField("address")} error={fieldErrors.address} autoComplete="street-address" multiline placeholder="خیابان، کوچه، پلاک، واحد..." />
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <p className="font-mono text-[10px] font-bold tracking-widest text-ink-3 uppercase mb-2">[ انتخاب شیوه ارسال ]</p>
                    {[
                      { id: "standard", title: "ارسال استاندارد پستی", body: "تحویل ظرف ۳ تا ۵ روز کاری", price: 65000 },
                      { id: "express",  title: "ارسال ویژه (تیپاکس / پیک)",     body: "تحویل سریع ظرف ۱ تا ۲ روز کاری", price: 120000 },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between gap-4 border-2 p-5 cursor-pointer transition-all duration-300 nbh-lift group ${
                          form.shipping === opt.id ? "bg-ink/5 border-ink nbh-sh-sm" : "bg-white border-ink/10 hover:border-ink/30"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-5 h-5 border-2 border-ink grid place-items-center transition-colors ${form.shipping === opt.id ? "bg-ink" : "bg-white"}`}>
                            {form.shipping === opt.id && <Check size={12} className="text-white" />}
                          </div>
                          <input
                            type="radio" name="shipping" value={opt.id}
                            checked={form.shipping === opt.id}
                            onChange={() => setForm({ ...form, shipping: opt.id as never })}
                            className="sr-only"
                          />
                          <div>
                            <p className="text-sm font-black text-ink">{opt.title}</p>
                            <p className="text-xs font-bold text-ink-3 group-hover:text-ink-2 transition-colors">{opt.body}</p>
                          </div>
                        </div>
                        <PriceTag price={opt.price} size="sm" />
                      </label>
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <p className="font-mono text-[10px] font-bold tracking-widest text-ink-3 uppercase mb-2">[ انتخاب درگاه پرداخت ]</p>
                    {[
                      ...(gateway.data?.enabled
                        ? [
                            {
                              id: "gateway" as const,
                              title: "پرداخت امن آنلاین (زیبال)",
                              body: "اتصال به درگاه بانکی مستقیم",
                            },
                          ]
                        : [
                            {
                              id: "gateway" as const,
                              title: "پرداخت امن آنلاین",
                              body: "اتصال به درگاه بانکی (زرین‌پال)",
                            },
                          ]),
                      { id: "cod" as const, title: "پرداخت در محل (COD)", body: "تسویه نقدی هنگام تحویل کالا" },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-4 border-2 p-5 cursor-pointer transition-all duration-300 nbh-lift group ${
                          form.payment === opt.id ? "bg-ink/5 border-ink nbh-sh-sm" : "bg-white border-ink/10 hover:border-ink/30"
                        }`}
                      >
                        <div className={`w-5 h-5 border-2 border-ink grid place-items-center transition-colors ${form.payment === opt.id ? "bg-ink" : "bg-white"}`}>
                          {form.payment === opt.id && <Check size={12} className="text-white" />}
                        </div>
                        <input
                          type="radio" name="payment" value={opt.id}
                          checked={form.payment === opt.id}
                          onChange={() => setForm({ ...form, payment: opt.id })}
                          className="sr-only"
                        />
                        <div>
                          <p className="text-sm font-black text-ink">{opt.title}</p>
                          <p className="text-xs font-bold text-ink-3 group-hover:text-ink-2 transition-colors">{opt.body}</p>
                        </div>
                      </label>
                    ))}
                    <div className="mt-6 border-2 border-dashed border-ink/10 p-5 bg-muted/20 text-center">
                      <p className="font-mono text-[10px] font-black tracking-widest text-ink/40 uppercase">
                        [ SECURE 256-BIT ENCRYPTION ]
                      </p>
                    </div>
                    {error && (
                      <div className="mt-4 border-2 border-ink bg-hot/10 p-3 text-center animate-in fade-in zoom-in-95 duration-300">
                        <p className="text-xs font-black text-hot leading-relaxed">{error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => (step === 0 ? navigate({ to: "/cart" }) : setStep(step - 1))}
                className="px-6 py-3 text-xs font-black border-2 border-ink bg-white nbh-sh-sm nbh-lift uppercase tracking-widest"
              >
                ← بازگشت
              </button>
              {step < steps.length - 1 ? (
                <button
                  onClick={goToNextStep}
                  className="px-8 py-3 text-xs font-black border-2 border-ink bg-ink text-white nbh-sh-sm nbh-lift uppercase tracking-widest"
                >
                  مرحله بعد →
                </button>
              ) : (
                <button
                  disabled={placing}
                  onClick={() => void submitOrder()}
                  className="px-10 py-4 text-xs font-black border-2 border-ink bg-ink text-white nbh-sh-md nbh-lift uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {placing ? "در حال پردازش..." : "تأیید و پرداخت نهایی"}
                </button>
              )}
            </div>
          </div>

          <aside className="nbh-card p-6 md:p-8 h-fit sticky top-24 bg-white">
            <p className="font-mono text-[10px] font-black tracking-widest text-ink-3 uppercase border-b-2 border-ink/5 pb-3 mb-5">[ خلاصه خرید ]</p>
            <ul className="space-y-4 text-sm">
              {items.map((it) => (
                <li key={it.productId} className="flex items-start justify-between gap-4">
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-black text-ink text-sm leading-tight">{it.name}</span>
                    <span className="font-mono text-[10px] text-ink-3 font-bold uppercase tracking-widest mt-0.5">
                      تعداد: {toFa(it.qty)}
                    </span>
                  </div>
                  <span className="font-mono tabular text-xs font-black shrink-0 pt-0.5 text-ink">
                    {toFa((it.price * it.qty).toLocaleString("en-US"))}
                  </span>
                </li>
              ))}
            </ul>
            
            <div className="mt-8 border-t-2 border-ink/5 pt-5 space-y-3 text-sm">
              <div className="flex justify-between items-center text-ink-2">
                <span className="font-bold">مجموع کالاها</span>
                <span className="font-mono tabular font-black">{toFa(subtotal.toLocaleString("en-US"))}</span>
              </div>
              <div className="flex justify-between items-center text-ink-2">
                <span className="font-bold">هزینه ارسال</span>
                <span className="font-mono tabular font-black">{toFa(shipping.toLocaleString("en-US"))}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between items-center text-hot">
                  <span className="font-bold">تخفیف ویژه</span>
                  <span className="font-mono tabular font-black">-{toFa(discountValue.toLocaleString("en-US"))}</span>
                </div>
              )}
            </div>
            
            <div className="mt-8 border-t-2 border-ink pt-6 flex justify-between items-center">
              <div>
                <span className="font-mono text-[10px] font-black tracking-widest text-ink-3 uppercase block mb-1">FINAL TOTAL</span>
                <span className="text-[10px] font-black text-ink-2 bg-muted px-1.5 py-0.5 rounded-sm">تومان</span>
              </div>
              <PriceTag price={total} size="xl" />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  name, label, value, onChange, onBlur, error, multiline, placeholder, inputMode, autoComplete,
}: {
  name: DeliveryField; label: string; value: string; onChange: (v: string) => void; onBlur: () => void;
  error?: string; multiline?: boolean; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  const inputId = `checkout-${name}`;
  const errorId = `${inputId}-error`;
  const fieldClass = `w-full border-2 px-4 py-3 text-sm font-black text-ink placeholder:text-ink/20 focus:outline-none transition-colors duration-200 ${
    error ? "border-hot bg-hot/5 focus:bg-hot/10" : "border-ink bg-white focus:bg-ink/5"
  }`;
  return (
    <div className="block">
      <label htmlFor={inputId} className="block font-mono text-[10px] font-black tracking-widest text-ink-3 uppercase mb-2">{label}</label>
      {multiline ? (
        <textarea
          id={inputId} name={name} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          rows={3} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined} className={`${fieldClass} resize-none`}
        />
      ) : (
        <input
          id={inputId} name={name} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete} aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined} className={fieldClass}
        />
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-bold leading-5 text-hot animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
