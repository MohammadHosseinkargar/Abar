import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminGetSettings, adminSaveSettings } from "@/lib/admin.functions";
import { adminTestZibal } from "@/lib/payment.functions";
import { normalizeError } from "@/lib/error-handler";
import { toast } from "sonner";

import { AdminHeader, Panel, Btn, Field, inputCls } from "@/components/admin/kit";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettings,
});

const defaults = {
  storeName: "عبر تری دی",
  supportPhone: "+98 915 284 4711",
  supportEmail: "",
  announcement: "",
  shippingStandard: 65000,
  shippingExpress: 120000,
  freeShippingOver: 0,
  zibalEnabled: false,
  zibalMerchant: "",
  zibalSandbox: true,
};


function AdminSettings() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: () => adminGetSettings() });
  const [form, setForm] = useState(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    const s = settings.data;
    setForm({
      storeName: String(s.storeName ?? defaults.storeName),
      supportPhone: String(s.supportPhone ?? ""),
      supportEmail: String(s.supportEmail ?? ""),
      announcement: String(s.announcement ?? ""),
      shippingStandard: Number(s.shippingStandard ?? defaults.shippingStandard),
      shippingExpress: Number(s.shippingExpress ?? defaults.shippingExpress),
      freeShippingOver: Number(s.freeShippingOver ?? 0),
      zibalEnabled: Boolean(s.zibalEnabled ?? false),
      zibalMerchant: String(s.zibalMerchant ?? ""),
      zibalSandbox: Boolean(s.zibalSandbox ?? true),

    });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => adminSaveSettings({ data: form }),
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ["admin-settings"] }); setTimeout(() => setSaved(false), 2500); },
  });

  const testZibal = useMutation({
    mutationFn: () => adminTestZibal(),
    onSuccess: (res) => {
      toast.info(res.message);
    },
    onError: (err) => {
      const normalized = normalizeError(err);
      toast.error(normalized.error.message);
    }
  });

  return (

    <>
      <AdminHeader title="تنظیمات سایت" subtitle="اطلاعات فروشگاه و هزینه ارسال" />
      <Panel className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام فروشگاه">
            <input className={inputCls} value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
          </Field>
          <Field label="تلفن پشتیبانی">
            <input dir="ltr" className={inputCls} value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} />
          </Field>
          <Field label="ایمیل پشتیبانی">
            <input dir="ltr" className={inputCls} value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
          </Field>
          <Field label="پیام نوار اعلان">
            <input className={inputCls} value={form.announcement} onChange={(e) => setForm({ ...form, announcement: e.target.value })} />
          </Field>
          <Field label="هزینه ارسال عادی (تومان)">
            <input type="number" dir="ltr" className={inputCls} value={form.shippingStandard} onChange={(e) => setForm({ ...form, shippingStandard: Number(e.target.value) })} />
          </Field>
          <Field label="هزینه ارسال سریع (تومان)">
            <input type="number" dir="ltr" className={inputCls} value={form.shippingExpress} onChange={(e) => setForm({ ...form, shippingExpress: Number(e.target.value) })} />
          </Field>
          <Field label="ارسال رایگان از (۰ = غیرفعال)">
            <input type="number" dir="ltr" className={inputCls} value={form.freeShippingOver} onChange={(e) => setForm({ ...form, freeShippingOver: Number(e.target.value) })} />
          </Field>
        </div>

        <div className="mt-8 border-t-2 border-ink/5 pt-6">
          <h3 className="font-display text-xl mb-4">تنظیمات درگاه پرداخت زیبال</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 border-2 border-ink p-4 bg-white nbh-sh-sm">
              <input 
                type="checkbox" 
                id="zibalEnabled"
                className="w-5 h-5 border-2 border-ink text-ink focus:ring-0"
                checked={form.zibalEnabled} 
                onChange={(e) => setForm({ ...form, zibalEnabled: e.target.checked })} 
              />
              <label htmlFor="zibalEnabled" className="text-sm font-black cursor-pointer">فعال‌سازی درگاه زیبال</label>
            </div>
            
            <div className="flex items-center gap-3 border-2 border-ink p-4 bg-white nbh-sh-sm">
              <input 
                type="checkbox" 
                id="zibalSandbox"
                className="w-5 h-5 border-2 border-ink text-ink focus:ring-0"
                checked={form.zibalSandbox} 
                onChange={(e) => setForm({ ...form, zibalSandbox: e.target.checked })} 
              />
              <label htmlFor="zibalSandbox" className="text-sm font-black cursor-pointer">حالت آزمایشی (Sandbox)</label>
            </div>

            <Field label="کد پذیرنده (Merchant Code)">
              <input 
                dir="ltr" 
                className={inputCls} 
                value={form.zibalMerchant} 
                onChange={(e) => setForm({ ...form, zibalMerchant: e.target.value })} 
                placeholder="zibal"
              />
            </Field>
            
            <div className="flex items-end pb-1">
              <Btn 
                type="button"
                variant="ghost" 
                onClick={() => testZibal.mutate()} 
                disabled={testZibal.isPending}
                className="w-full text-xs"
              >


                {testZibal.isPending ? "در حال تست..." : "تست اتصال به زیبال"}
              </Btn>
            </div>
          </div>
        </div>


        <div className="mt-8 flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-ink-2">ذخیره شد ✓</span>}
          <Btn onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "در حال ذخیره…" : "ذخیره تنظیمات"}
          </Btn>
        </div>
      </Panel>

    </>
  );
}
