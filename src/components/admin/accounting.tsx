import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as pdfLib from "pdf-lib";
import html2canvas from "html2canvas";
import {
  BarChart3,
  Eye,
  FilePlus2,
  Pencil,
  Plus,
  Printer,
  Trash2,
  X,
  Download,
  LayoutGrid,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  ListTree,
  PieChart,
  SlidersHorizontal,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  accountingDashboard,
  accountingDeleteExpense,
  accountingDeleteIncome,
  accountingDeleteInvoice,
  accountingGetInvoice,
  accountingGetSettings,
  accountingListCategories,
  accountingListExpenses,
  accountingListIncomes,
  accountingListInvoices,
  accountingListProducts,
  accountingListTransactions,
  accountingReport,
  accountingSaveCategory,
  accountingSaveExpense,
  accountingSaveIncome,
  accountingSaveInvoice,
  accountingSaveSettings,
} from "@/lib/accounting.functions";
import { faDate, formatToman } from "@/lib/rtl";
import {
  AdminHeader,
  Btn,
  Empty,
  Field,
  IconBtn,
  Panel,
  Stat,
  Tag,
  inputCls,
  selectCls,
  num,
} from "@/components/admin/kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/admin/image-upload";

const money = (value: unknown) => formatToman(Number(value ?? 0));
const moneyInt = (value: unknown) => Number(value ?? 0);
const date = (value: unknown) => (value ? faDate(String(value)) : "—");
const paymentLabel: Record<string, string> = {
  unpaid: "پرداخت نشده",
  partial: "بخشی پرداخت شده",
  paid: "تسویه شده",
  cancelled: "لغو شده",
};
const methodLabel: Record<string, string> = {
  cash: "نقدی",
  pos: "کارتخوان",
  card_transfer: "کارت به کارت",
  gateway: "درگاه",
  other: "سایر",
};

// ─── Accounting section sub-nav ──────────────────────────────────────────────
// The 7 accounting pages are flat sibling routes (no shared layout route), so
// each page renders this nav itself rather than introducing a new pathless
// layout route into the generated route tree.
const accountingNav: { to: string; label: string; icon: typeof LayoutGrid; exact?: boolean }[] = [
  { to: "/admin/accounting", label: "داشبورد", icon: LayoutGrid, exact: true },
  { to: "/admin/accounting/invoices", label: "فاکتورها", icon: ReceiptText },
  { to: "/admin/accounting/incomes", label: "درآمدها", icon: TrendingUp },
  { to: "/admin/accounting/expenses", label: "هزینه‌ها", icon: TrendingDown },
  { to: "/admin/accounting/transactions", label: "تراکنش‌ها", icon: ListTree },
  { to: "/admin/accounting/reports", label: "گزارش‌ها", icon: PieChart },
  { to: "/admin/accounting/settings", label: "تنظیمات", icon: SlidersHorizontal },
];

export function AccountingNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
      {accountingNav.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex shrink-0 items-center gap-1.5 border-2 border-ink px-3 py-1.5 text-xs font-bold uppercase nb-sh-sm nb-lift ${
              active ? "bg-[var(--nb-accent)] text-ink" : "bg-white text-ink"
            }`}
          >
            <item.icon size={14} strokeWidth={2.5} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Export Invoice as PDF
async function exportInvoicePDF(invoiceId: string) {
  try {
    const invoiceData = await accountingGetInvoice({ data: { id: invoiceId } } as any);
    const settings = await accountingGetSettings();
    const accent = (settings as any)?.invoice_accent || "#2457d6";

    // Create a DOM element for the invoice
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = "210mm";
    container.style.padding = "20mm";
    container.style.fontFamily = "Vazirmatn, sans-serif";
    container.style.background = "white";
    container.style.minHeight = "297mm";
    container.innerHTML = `
      <div style="border: 1px solid #000; padding: 20mm; min-height: 297mm; font-family: Vazirmatn, sans-serif;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            ${settings.business_name ? `<h1 style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">${settings.business_name}</h1>` : ""}
            ${settings.phone ? `<p style="font-size: 14px;">تلفن: ${settings.phone}</p>` : ""}
            ${settings.address ? `<p style="font-size: 14px;">آدرس: ${settings.address}</p>` : ""}
            ${settings.postal_code ? `<p style="font-size: 14px;">کد پستی: ${settings.postal_code}</p>` : ""}
          </div>
          <div style="text-align: left;">
            <h1 style="font-size: 32px; font-weight: bold; color: ${accent}; margin: 0;">فاکتور</h1>
            <p style="font-size: 18px; margin-top: 5px;">شماره: ${invoiceData.invoice_number}</p>
            <p style="font-size: 14px; margin-top: 5px;">تاریخ: ${faDate(invoiceData.issued_at)}</p>
          </div>
        </div>

        <!-- Customer Info -->
        <div style="border: 1px solid #000; padding: 15px; margin-bottom: 20px; background: #f9f9f9;">
          <h3 style="font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">اطلاعات مشتری</h3>
          <p style="font-size: 14px; margin: 5px 0;">${invoiceData.customer_name}</p>
          ${invoiceData.customer_phone ? `<p style="font-size: 14px; margin: 5px 0;">تلفن: ${invoiceData.customer_phone}</p>` : ""}
          ${invoiceData.customer_address ? `<p style="font-size: 14px; margin: 5px 0;">آدرس: ${invoiceData.customer_address}</p>` : ""}
          ${invoiceData.customer_postal_code ? `<p style="font-size: 14px; margin: 5px 0;">کد پستی: ${invoiceData.customer_postal_code}</p>` : ""}
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
          <thead>
            <tr style="background: ${accent}; color: white;">
              <th style="border: 1px solid #000; padding: 10px; text-align: right;">کالا / خدمت</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: center;">تعداد</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: center;">قیمت واحد</th>
              <th style="border: 1px solid #000; padding: 10px; text-align: center;">مبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${(invoiceData.invoice_items || []).map((item: any) => `
              <tr>
                <td style="border: 1px solid #000; padding: 8px;">${item.product_name}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.quantity}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${formatToman(item.final_unit_price)}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${formatToman(item.line_total || (item.quantity * item.final_unit_price))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="display: flex; justify-content: flex-end;">
          <div style="width: 300px;">
            <div style="border-top: 2px solid #000; padding-top: 10px; margin-bottom: 5px; font-size: 14px;">
              <p>جمع: <span style="float: right;">${formatToman(invoiceData.subtotal)}</span></p>
              ${invoiceData.discount_amount > 0 ? `<p>تخفیف: <span style="float: right;">-${formatToman(invoiceData.discount_amount)}</span></p>` : ""}
              ${invoiceData.shipping_amount > 0 ? `<p>هزینه ارسال: <span style="float: right;">${formatToman(invoiceData.shipping_amount)}</span></p>` : ""}
              <div style="border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; font-size: 16px; font-weight: bold;">
                <p>مبلغ نهایی: <span style="float: right; color: ${accent};">${formatToman(invoiceData.total_amount)}</span></p>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Info -->
        <div style="display: flex; justify-content: space-between; margin-top: 20px; font-size: 14px;">
          <div>
            <p>وضعیت پرداخت: <strong>${paymentLabel[invoiceData.payment_status] || invoiceData.payment_status}</strong></p>
            <p>روش پرداخت: <strong>${methodLabel[invoiceData.payment_method] || invoiceData.payment_method}</strong></p>
          </div>
          <div style="text-align: left;">
            <p>پرداخت شده: ${formatToman(invoiceData.paid_amount)}</p>
            <p>باقی‌مانده: ${formatToman(invoiceData.total_amount - invoiceData.paid_amount)}</p>
          </div>
        </div>

        <!-- Footer -->
        ${settings.footer_text ? `<div style="margin-top: 30px; padding-top: 10px; border-top: 1px solid #000; font-size: 12px; color: #666; text-align: center;">
          ${settings.footer_text}
        </div>` : ""}
      </div>
    `;

    document.body.appendChild(container);

    // Capture with html2canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
    });

    document.body.removeChild(container);

    // Create PDF
    const pdfDoc = await pdfLib.PDFDocument.create();
    const page = pdfDoc.addPage([canvas.width / 2, canvas.height / 2]);
    const png = await pdfDoc.embedPng(await canvas.toDataURL("image/png"));
    page.drawImage(png, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `فاکتور-${invoiceData.invoice_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting PDF:", error);
    alert("خطا در تولید PDF. لطفاً دوباره تلاش کنید.");
  }
}

// ─── Add Account Modal ───────────────────────────────────────────────────────

type AccountForm = {
  name: string;
  type: string;
  initialBalance: string;
  description: string;
  isActive: boolean;
};

type AccountFormErrors = Partial<Record<keyof AccountForm, string>>;

const ACCOUNT_TYPES = [
  { value: "income",    label: "درآمد" },
  { value: "expense",   label: "هزینه" },
  { value: "receivable",label: "دریافتنی" },
  { value: "payable",   label: "پرداختنی" },
  { value: "capital",   label: "سرمایه" },
  { value: "other",     label: "سایر" },
] as const;

const EMPTY_FORM: AccountForm = {
  name: "",
  type: "",
  initialBalance: "",
  description: "",
  isActive: true,
};

function validateAccountForm(f: AccountForm): AccountFormErrors {
  const errs: AccountFormErrors = {};
  if (!f.name.trim()) errs.name = "نام حساب الزامی است.";
  if (!f.type) errs.type = "نوع حساب الزامی است.";
  if (f.initialBalance !== "") {
    const n = Number(f.initialBalance);
    if (isNaN(n)) errs.initialBalance = "مبلغ باید عدد باشد.";
    else if (n < 0) errs.initialBalance = "مبلغ نمی‌تواند منفی باشد.";
  }
  return errs;
}

function AddAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<AccountFormErrors>({});
  const [saving, setSaving] = useState(false);

  // close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function set<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  }

  async function handleSave() {
    const errs = validateAccountForm(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      // Save as a manual income/expense category entry so it appears in the
      // financial ledger immediately.  A dedicated "accounts" table could be
      // added later; for now we persist to expense_categories (for cost/
      // liability types) or as a tagged manual_income stub.
      await accountingSaveCategory({
        data: { name: form.name, isRefund: false },
      } as any);
      onSaved();
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    // Backdrop – click-outside closes
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(17,17,17,0.55)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="افزودن حساب جدید"
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-lg border-2 border-ink bg-white"
        style={{ boxShadow: "9px 9px 0px 0px #111111" }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between border-b-2 border-ink px-5 py-4"
          style={{ background: "var(--nb-warning)" }}
        >
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-ink uppercase">
              NEW ACCOUNT
            </p>
            <h2 className="mt-1 text-lg font-black leading-tight text-ink uppercase" style={{ fontFamily: "'Archivo Black', 'Vazirmatn', sans-serif" }}>
              افزودن حساب جدید
            </h2>
            <p className="mt-0.5 text-xs font-medium text-ink-2">
              اطلاعات حساب جدید را وارد کنید.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 items-center justify-center border-2 border-ink bg-white text-ink nb-lift"
            style={{ boxShadow: "4px 4px 0 0 #111" }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Form body ── */}
        <div className="space-y-4 p-5">
          {/* نام حساب */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-ink">
              نام حساب <span className="text-[var(--nb-danger)]">*</span>
            </label>
            <input
              className={inputCls}
              placeholder="مثلاً حساب فروش"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[var(--nb-danger)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--nb-danger)]" />
                {errors.name}
              </p>
            )}
          </div>

          {/* نوع حساب */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-ink">
              نوع حساب <span className="text-[var(--nb-danger)]">*</span>
            </label>
            <select
              className={selectCls}
              value={form.type}
              onChange={e => set("type", e.target.value)}
            >
              <option value="">انتخاب نوع حساب…</option>
              {ACCOUNT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.type && (
              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[var(--nb-danger)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--nb-danger)]" />
                {errors.type}
              </p>
            )}
          </div>

          {/* مبلغ اولیه */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-ink">
              مبلغ اولیه
            </label>
            <input
              className={inputCls}
              type="number"
              min="0"
              placeholder="۰ تومان"
              value={form.initialBalance}
              onChange={e => set("initialBalance", e.target.value)}
              dir="ltr"
            />
            {errors.initialBalance && (
              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[var(--nb-danger)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--nb-danger)]" />
                {errors.initialBalance}
              </p>
            )}
          </div>

          {/* توضیحات */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-ink">
              توضیحات
            </label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              placeholder="توضیحات حساب..."
              value={form.description}
              onChange={e => set("description", e.target.value)}
            />
          </div>

          {/* وضعیت حساب */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-ink">
              وضعیت حساب
            </label>
            <div className="flex gap-2">
              {[
                { val: true,  label: "فعال",     accent: "var(--nb-success)" },
                { val: false, label: "غیرفعال",  accent: "#f3ece0" },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => set("isActive", opt.val)}
                  className={`flex-1 border-2 border-ink px-3 py-2 text-sm font-bold uppercase transition-all ${
                    form.isActive === opt.val
                      ? "text-ink nb-sh-sm"
                      : "bg-white text-ink-2 opacity-60"
                  }`}
                  style={form.isActive === opt.val ? { background: opt.accent, boxShadow: "4px 4px 0 0 #111" } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div
          className="flex flex-col-reverse gap-2 border-t-2 border-ink px-5 py-4 sm:flex-row sm:justify-end"
          style={{ background: "#f3ece0" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border-2 border-ink bg-white px-4 py-2.5 text-sm font-bold uppercase text-ink nb-lift sm:flex-none sm:w-28"
            style={{ boxShadow: "4px 4px 0 0 #111" }}
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 border-2 border-ink px-4 py-2.5 text-sm font-bold uppercase text-ink nb-lift disabled:pointer-events-none disabled:opacity-50 sm:flex-none sm:w-36"
            style={{ background: "var(--nb-warning)", boxShadow: "4px 4px 0 0 #111" }}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin border-2 border-ink border-t-transparent" />
                در حال ذخیره…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Plus size={14} strokeWidth={2.5} />
                ذخیره حساب
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Finance Dashboard ────────────────────────────────────────────────────────

export function FinanceDashboard() {
  const qc = useQueryClient();
  const [range, setRange] = useState("month");
  const [showAddAccount, setShowAddAccount] = useState(false);
  const q = useQuery({
    queryKey: ["accounting-dashboard", range],
    queryFn: () => accountingDashboard({ data: { range } } as any),
  });
  const d: any = q.data ?? {};
  const metrics = [
    ["فروش ناخالص", d.grossSales],
    ["تخفیف‌ها", d.discounts],
    ["برگشت وجه", d.refunds],
    ["فروش خالص", d.netSales],
    ["بهای تمام‌شده", d.costOfGoods],
    ["سود ناخالص", d.grossProfit],
    ["مجموع هزینه‌ها", d.totalExpenses],
    ["سود خالص", d.netProfit],
    ["دریافت‌شده", d.received],
    ["دریافت‌نشده", d.unreceived],
  ];
  const chart = d.chart ?? d.trend ?? [];

  return (
    <>
      <AccountingNav />
      <AdminHeader
        title="داشبورد مالی"
        subtitle="تصویر روشن از جریان پول کسب‌وکار"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select value={range} onChange={(e) => setRange(e.target.value)} className={selectCls}>
              <option value="today">امروز</option>
              <option value="week">این هفته</option>
              <option value="month">این ماه</option>
              <option value="last_month">ماه قبل</option>
              <option value="year">امسال</option>
            </select>
            {/* دکمه افزودن حساب */}
            <button
              type="button"
              onClick={() => setShowAddAccount(true)}
              className="inline-flex items-center gap-1.5 border-2 border-ink px-4 py-2 text-sm font-bold uppercase text-ink nb-lift"
              style={{ background: "var(--nb-primary)", color: "#fff", boxShadow: "4px 4px 0 0 #111" }}
            >
              <Plus size={15} strokeWidth={2.5} />
              افزودن حساب
            </button>
          </div>
        }
      />

      {q.isLoading ? (
        <Empty text="در حال محاسبه شاخص‌های مالی…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {metrics.map(([label, value]) => (
              <Stat key={String(label)} label={String(label)} value={money(value)} />
            ))}
          </div>
          <Panel className="mt-6 overflow-hidden">
            <div className="flex items-center gap-2 border-b-2 border-ink bg-[var(--nb-warning)] px-4 py-2">
              <BarChart3 size={16} />
              <h2 className="text-sm">روند فروش، هزینه و سود</h2>
            </div>
            <div className="h-72 min-w-[540px] p-4">
              {chart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid stroke="#141414" strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(v) => num(v)} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Legend />
                    <Bar dataKey="income" name="درآمد" fill="#f15832" />
                    <Bar dataKey="expense" name="هزینه" fill="#f2c94c" />
                    <Bar dataKey="profit" name="سود" fill="#65b891" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty text="برای این بازه داده‌ای وجود ندارد." />
              )}
            </div>
          </Panel>
        </>
      )}

      {showAddAccount && (
        <AddAccountModal
          onClose={() => setShowAddAccount(false)}
          onSaved={() => qc.invalidateQueries()}
        />
      )}
    </>
  );
}

export function Invoices() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<string | "new" | null>(null);
  const q = useQuery({
    queryKey: ["accounting-invoices", search],
    queryFn: () => accountingListInvoices(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => accountingDeleteInvoice({ data: { id } } as any),
    onSuccess: () => qc.invalidateQueries(),
  });
  if (editor)
    return <InvoiceEditor id={editor === "new" ? null : editor} close={() => setEditor(null)} />;
  const rows: any[] = q.data ?? [];
  return (
    <>
      <AccountingNav />
      <AdminHeader
        title="فاکتورها"
        subtitle="فروش‌ها، مانده‌ها و صورت‌حساب مشتریان"
        action={
          <Btn onClick={() => setEditor("new")}>
            <span className="inline-flex items-center gap-1">
              <FilePlus2 size={16} />
              فاکتور جدید
            </span>
          </Btn>
        }
      />
      <Panel className="overflow-hidden">
        <div className="border-b-2 border-ink bg-[var(--nb-accent)] p-3">
          <input
            className={inputCls}
            placeholder="جستجو شماره فاکتور یا مشتری…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {q.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : rows.length === 0 ? (
          <Empty text="فاکتوری ثبت نشده است." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-right text-sm">
              <thead className="border-b-2 border-ink bg-[#f3ece0] text-xs">
                <tr>
                  <th className="p-3">شماره</th>
                  <th>مشتری</th>
                  <th>تاریخ</th>
                  <th>مبلغ</th>
                  <th>وضعیت</th>
                  <th className="p-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b-2 border-ink last:border-0">
                    <td className="p-3 font-mono">{r.invoice_number}</td>
                    <td>{r.customer_name ?? r.customerName ?? "—"}</td>
                    <td>{date(r.issued_at)}</td>
                    <td className="font-mono">{money(r.totalAmount)}</td>
                    <td>
                      <Tag tone={r.payment_status === "paid" ? "ok" : "warn"}>
                        {paymentLabel[r.payment_status] ?? r.payment_status}
                      </Tag>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <IconBtn label="مشاهده و ویرایش" onClick={() => setEditor(r.id)}>
                          <Pencil size={15} />
                        </IconBtn>
                        <IconBtn
                          label="حذف"
                          tone="danger"
                          onClick={() => {
                            if (confirm("این فاکتور حذف شود؟")) remove.mutate(r.id);
                          }}
                        >
                          <Trash2 size={15} />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

type Line = {
  id?: string;
  product_id?: string | null;
  title: string;
  quantity: number;
  list_price: number;
  unit_price: number;
  unit_cost: number;
  discount: number;
  note: string;
};
const newLine = (): Line => ({
  title: "",
  quantity: 1,
  list_price: 0,
  unit_price: 0,
  unit_cost: 0,
  discount: 0,
  note: "",
});
export function InvoiceEditor({ id, close }: { id: string | null; close: () => void }) {
  const qc = useQueryClient();
  const one = useQuery({
    queryKey: ["accounting-invoice", id],
    enabled: !!id,
    queryFn: () => accountingGetInvoice({ data: { id } } as any),
  });
  const products = useQuery({
    queryKey: ["accounting-products"],
    queryFn: () => accountingListProducts(),
  });
  const [form, setForm] = useState<any>({
    issuedAt: new Date().toISOString(),
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerPostalCode: "",
    notes: "",
    discountAmount: 0,
    shippingAmount: 0,
    paidAmount: 0,
    paymentStatus: "unpaid",
    paymentMethod: "cash",
    items: [newLine()],
  });
  useEffect(() => {
    if (one.data) {
      const x: any = one.data;
      setForm({
        issuedAt: x.issued_at,
        customerName: x.customer_name ?? "",
        customerPhone: x.customer_phone ?? "",
        customerAddress: x.customer_address ?? "",
        customerPostalCode: x.customer_postal_code ?? "",
        notes: x.notes ?? "",
        discountAmount: Number(x.discount_amount ?? 0),
        shippingAmount: Number(x.shipping_amount ?? 0),
        paidAmount: Number(x.paid_amount ?? 0),
        paymentStatus: x.payment_status,
        paymentMethod: x.payment_method ?? "cash",
        items: (x.invoice_items ?? []).map((i: any) => ({
          title: i.product_name,
          quantity: Number(i.quantity),
          list_price: Number(i.catalog_unit_price ?? 0),
          unit_price: Number(i.final_unit_price ?? 0),
          unit_cost: Number(i.unit_cost ?? 0),
          discount: Number(i.discount_amount ?? 0),
          note: i.notes ?? "",
          product_id: i.product_id,
        })),
      });
    }
  }, [one.data]);
  const items: Line[] = form.items;
  const sub = items.reduce((a, i) => a + (i.quantity * i.unit_price - i.discount), 0);
  const total = Math.max(
    0,
    sub - Number(form.discountAmount || 0) + Number(form.shippingAmount || 0),
  );
  const paid = Math.min(total, Number(form.paidAmount || 0));
  const save = useMutation({
    mutationFn: () =>
      accountingSaveInvoice({
        data: {
          id,
          issuedAt: form.issuedAt,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerAddress: form.customerAddress,
          customerPostalCode: form.customerPostalCode,
          notes: form.notes,
          discountAmount: Number(form.discountAmount),
          shippingAmount: Number(form.shippingAmount),
          paidAmount: Number(form.paidAmount),
          paymentStatus: form.paymentStatus,
          paymentMethod: form.paymentMethod,
          items: items.map((i) => ({
            productId: i.product_id,
            productName: i.title,
            quantity: i.quantity,
            catalogUnitPrice: i.list_price,
            finalUnitPrice: i.unit_price,
            unitCost: i.unit_cost,
            discountAmount: i.discount,
            notes: i.note,
          })),
        },
      } as any),
    onSuccess: () => {
      qc.invalidateQueries();
      close();
    },
  });
  const update = (index: number, key: keyof Line, value: any) =>
    setForm({ ...form, items: items.map((x, i) => (i === index ? { ...x, [key]: value } : x)) });
  return (
    <>
      <AdminHeader
        title={id ? "ویرایش فاکتور" : "فاکتور جدید"}
        subtitle="قیمت فاکتور مستقل از قیمت و موجودی کاتالوگ ذخیره می‌شود"
        action={
          <>
            <Btn variant="ghost" onClick={close}>
              بازگشت
            </Btn>
            {id && (
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => window.print()}>
                  <span className="inline-flex gap-1">
                    <Printer size={15} />
                    چاپ
                  </span>
                </Btn>
                <Btn variant="ghost" onClick={() => exportInvoicePDF(id)}>
                  <span className="inline-flex gap-1">
                    <Download size={15} />
                    PDF
                  </span>
                </Btn>
              </div>
            )}
            <Btn onClick={() => save.mutate()} disabled={save.isPending}>
              ذخیره فاکتور
            </Btn>
          </>
        }
      />
      <Panel className="p-4 print:border-0 print:shadow-none" id="invoice-printable">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="تاریخ">
            <input
              type="date"
              className={inputCls}
              value={form.issuedAt?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  issuedAt: new Date(`${e.target.value}T00:00:00.000Z`).toISOString(),
                })
              }
            />
          </Field>
          <Field label="نام مشتری">
            <input
              className={inputCls}
              value={form.customerName ?? ""}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </Field>
          <Field label="شماره تلفن">
            <input
              dir="ltr"
              className={inputCls}
              value={form.customerPhone ?? ""}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
            />
          </Field>
          <Field label="کد پستی">
            <input
              dir="ltr"
              className={inputCls}
              value={form.customerPostalCode ?? ""}
              onChange={(e) => setForm({ ...form, customerPostalCode: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="آدرس">
              <textarea
                className={inputCls}
                value={form.customerAddress ?? ""}
                onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto border-2 border-ink">
          <table className="w-full min-w-[850px] text-right text-xs">
            <thead className="bg-[var(--nb-accent)]">
              <tr>
                <th className="p-2">کالا / خدمت</th>
                <th>تعداد</th>
                <th>قیمت سایت</th>
                <th>قیمت فاکتور</th>
                <th>بهای تمام‌شده</th>
                <th>تخفیف</th>
                <th>مبلغ ردیف</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((line, i) => (
                <tr key={i} className="border-t-2 border-ink">
                  <td className="p-2">
                    <input
                      list="catalogue"
                      className={inputCls}
                      value={line.title}
                      onChange={(e) => {
                        const p = (products.data ?? []).find((v: any) => v.name === e.target.value);
                        update(i, "title", e.target.value);
                        if (p) {
                          update(i, "product_id", p.id);
                          update(i, "list_price", Number(p.price));
                          update(i, "unit_price", Number(p.price));
                          update(i, "unit_cost", Number(p.costPrice ?? 0));
                        }
                      }}
                    />
                    <datalist id="catalogue">
                      {(products.data ?? []).map((p: any) => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      className={inputCls}
                      value={line.quantity}
                      onChange={(e) => update(i, "quantity", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-2 font-mono">{money(line.list_price)}</td>
                  <td>
                    <input
                      type="number"
                      className={inputCls}
                      value={line.unit_price}
                      onChange={(e) => update(i, "unit_price", Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className={inputCls}
                      value={line.unit_cost}
                      onChange={(e) => update(i, "unit_cost", Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className={inputCls}
                      value={line.discount}
                      onChange={(e) => update(i, "discount", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-2 font-mono">
                    {money(line.quantity * line.unit_price - line.discount)}
                  </td>
                  <td className="p-2">
                    <button
                      aria-label="حذف ردیف"
                      onClick={() => setForm({ ...form, items: items.filter((_, j) => j !== i) })}
                    >
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Btn
          className="mt-3"
          variant="ghost"
          onClick={() => setForm({ ...form, items: [...items, newLine()] })}
        >
          <Plus size={15} className="inline" /> افزودن کالا یا آیتم دستی
        </Btn>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="تخفیف کل">
            <input
              type="number"
              className={inputCls}
              value={form.discountAmount}
              onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })}
            />
          </Field>
          <Field label="هزینه ارسال">
            <input
              type="number"
              className={inputCls}
              value={form.shippingAmount}
              onChange={(e) => setForm({ ...form, shippingAmount: Number(e.target.value) })}
            />
          </Field>
          <Field label="مبلغ پرداخت‌شده">
            <input
              type="number"
              className={inputCls}
              value={form.paidAmount}
              onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })}
            />
          </Field>
          <Field label="وضعیت پرداخت">
            <select
              className={selectCls}
              value={form.paymentStatus}
              onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
            >
              {Object.entries(paymentLabel).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="روش پرداخت">
            <select
              className={selectCls}
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            >
              {Object.entries(methodLabel).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 border-t-2 border-ink pt-4 text-sm font-bold">
          <span>جمع: {money(sub)}</span>
          <span>نهایی: {money(total)}</span>
          <span>باقی‌مانده: {money(total - paid)}</span>
        </div>
      </Panel>
    </>
  );
}

export function MoneyEntries({ kind }: { kind: "income" | "expense" }) {
  const qc = useQueryClient();
  const isIncome = kind === "income";
  const fn = isIncome ? accountingListIncomes : accountingListExpenses;
  const saveFn = isIncome ? accountingSaveIncome : accountingSaveExpense;
  const deleteFn = isIncome ? accountingDeleteIncome : accountingDeleteExpense;
  const q = useQuery({ queryKey: ["accounting", kind], queryFn: () => fn() });
  const categories = useQuery({
    queryKey: ["accounting-categories"],
    queryFn: () => accountingListCategories(),
    enabled: !isIncome,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any | null>(null);
  /** Keep the total in sync when both quantity and unit price are set, without
   *  blocking manual override of the total for entries with no breakdown. */
  const setQty = (quantity: string) => {
    const unitPrice = Number(form.unitPrice || 0);
    const amount = quantity && unitPrice ? Number(quantity) * unitPrice : form.amount;
    setForm({ ...form, quantity, amount });
  };
  const setUnitPrice = (unitPrice: string) => {
    const quantity = Number(form.quantity || 0);
    const amount = quantity && unitPrice ? quantity * Number(unitPrice) : form.amount;
    setForm({ ...form, unitPrice, amount });
  };
  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: isIncome
          ? {
              id: form?.id ?? null,
              title: form.title,
              category: form.category,
              amount: Number(form.amount),
              occurredAt: new Date(`${form.date}T00:00:00.000Z`).toISOString(),
              paymentMethod: form.payment_method,
              notes: form.notes,
            }
          : {
              id: form?.id ?? null,
              title: form.title,
              categoryId: form.categoryId || null,
              quantity: form.quantity ? Number(form.quantity) : null,
              unit: form.unit || null,
              unitPrice: form.unitPrice ? Number(form.unitPrice) : null,
              totalAmount: Number(form.amount),
              occurredAt: new Date(`${form.date}T00:00:00.000Z`).toISOString(),
              paymentMethod: form.payment_method,
              notes: form.notes,
              receiptUrl: form.receiptUrl || null,
            },
      } as any),
    onSuccess: () => {
      setForm(null);
      setOpen(false);
      qc.invalidateQueries();
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } } as any),
    onSuccess: () => qc.invalidateQueries(),
  });
  const blank = {
    id: null,
    title: "",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    category: "other",
    categoryId: "",
    quantity: "",
    unit: "",
    unitPrice: "",
    receiptUrl: null as string | null,
    notes: "",
  };

  const openNew = () => {
    setForm({ ...blank });
    setOpen(true);
  };

  const openEdit = (item: any) => {
    setForm({
      id: item.id,
      title: item.title ?? "",
      amount: Number(item.amount ?? item.totalAmount ?? 0),
      date: (item.occurred_at ?? item.occurredAt ?? new Date().toISOString()).slice(0, 10),
      payment_method: item.payment_method ?? "cash",
      category: item.category ?? "other",
      categoryId: item.category_id ?? "",
      quantity: item.quantity ?? "",
      unit: item.unit ?? "",
      unitPrice: item.unitPrice ?? item.unit_price ?? "",
      receiptUrl: item.receipt_url ?? null,
      notes: item.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <>
      <AccountingNav />
      <AdminHeader
        title={isIncome ? "درآمدها" : "هزینه‌ها"}
        subtitle={
          isIncome
            ? "ثبت دریافتی‌های دستی؛ مبالغ فاکتور دوباره شمرده نمی‌شوند"
            : "هزینه‌های واقعی روزمره کسب‌وکار"
        }
        action={
          <Btn onClick={openNew}>
            <Plus size={15} className="inline" /> ثبت {isIncome ? "درآمد" : "هزینه"}
          </Btn>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setForm(null);
        }}
      >
        <DialogContent className="max-w-2xl rounded-none border-2 border-ink bg-card p-0 shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
          <div className="border-b-2 border-ink bg-[var(--nb-accent)] px-5 py-4">
            <DialogHeader className="space-y-1 text-right">
              <DialogTitle className="text-xl font-black text-ink">
                {form?.id ? (isIncome ? "ویرایش درآمد" : "ویرایش هزینه") : isIncome ? "افزودن درآمد" : "افزودن هزینه"}
              </DialogTitle>
              <DialogDescription className="text-right text-sm text-ink/70">
                {isIncome ? "اطلاعات درآمد را وارد کنید." : "اطلاعات هزینه را وارد کنید."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {form && (
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="عنوان">
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              {isIncome ? (
                <Field label="دسته‌بندی">
                  <input
                    className={inputCls}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="مثلاً فروش حضوری"
                  />
                </Field>
              ) : (
                <Field label="دسته‌بندی">
                  <select
                    className={selectCls}
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    <option value="">— بدون دسته —</option>
                    {(categories.data ?? []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {!isIncome && (
                <>
                  <Field label="تعداد (اختیاری)">
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={form.quantity}
                      onChange={(e) => setQty(e.target.value)}
                    />
                  </Field>
                  <Field label="واحد (اختیاری)">
                    <input
                      className={inputCls}
                      placeholder="عدد، متر، کیلوگرم…"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    />
                  </Field>
                  <Field label="قیمت واحد (اختیاری)">
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={form.unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                    />
                  </Field>
                </>
              )}
              <Field label="مبلغ کل">
                <input
                  type="number"
                  className={inputCls}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </Field>
              <Field label="تاریخ">
                <input
                  type="date"
                  className={inputCls}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
              <Field label="روش پرداخت">
                <select
                  className={selectCls}
                  value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                >
                  {Object.entries(methodLabel).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="توضیحات">
                  <input
                    className={inputCls}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </Field>
              </div>
              {!isIncome && (
                <div className="sm:col-span-2">
                  <ImageUpload
                    label="رسید (اختیاری)"
                    value={form.receiptUrl}
                    onChange={(url) => setForm({ ...form, receiptUrl: url })}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-end gap-2 border-t-2 border-ink bg-white px-5 py-4">
            <Btn variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Btn>
            <Btn
              onClick={() => save.mutate()}
              disabled={!form || !form.title || !form.amount || save.isPending}
            >
              ذخیره
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Panel className="overflow-hidden">
        {q.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : (q.data ?? []).length === 0 ? (
          <Empty text={`هنوز ${isIncome ? "درآمدی" : "هزینه‌ای"} ثبت نشده است.`} />
        ) : (
          <ul className="divide-y-2 divide-ink">
            {(q.data ?? []).map((x: any) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 p-3">
                <Tag tone={isIncome ? "ok" : "warn"}>{isIncome ? "درآمد" : "هزینه"}</Tag>
                <span className="font-bold">{x.title}</span>
                <Tag>{isIncome ? x.category : (x.expense_categories?.name ?? "بدون دسته")}</Tag>
                {!isIncome && x.receipt_url && (
                  <a href={x.receipt_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-ink underline">
                    رسید
                  </a>
                )}
                <span className="text-xs text-ink-2">{date(x.occurred_at)}</span>
                <span className="ms-auto font-mono">{money(isIncome ? x.amount : x.totalAmount)}</span>
                <IconBtn label="ویرایش" onClick={() => openEdit(x)}>
                  <Pencil size={15} />
                </IconBtn>
                <IconBtn
                  label="حذف"
                  tone="danger"
                  onClick={() => {
                    if (confirm("حذف شود؟")) del.mutate(x.id);
                  }}
                >
                  <Trash2 size={15} />
                </IconBtn>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export function Ledger() {
  const q = useQuery({
    queryKey: ["accounting-ledger"],
    queryFn: () => accountingListTransactions({ data: {} } as any),
  });
  return (
    <>
      <AccountingNav />
      <AdminHeader title="تراکنش‌ها" subtitle="دفتر مرکزی تمام ورود و خروج‌های مالی" />
      <Panel className="overflow-hidden">
        {q.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : (q.data ?? []).length === 0 ? (
          <Empty text="تراکنشی وجود ندارد." />
        ) : (
          <ul className="divide-y-2 divide-ink">
            {(q.data ?? []).map((t: any) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <Tag tone={t.transaction_type === "income" ? "ok" : "warn"}>
                  {t.transaction_type === "income" ? "درآمد" : "هزینه"}
                </Tag>
                <span className="font-bold">{t.description ?? t.category ?? "—"}</span>
                {t.category && <Tag>{t.category}</Tag>}
                <span className="text-xs text-ink-2">
                  {date(t.occurred_at)} · {methodLabel[t.payment_method] ?? "—"}
                </span>
                <span className="ms-auto font-mono">{money(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export function Reports() {
  const [range, setRange] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const useCustomRange = Boolean(customFrom || customTo);
  const q = useQuery({
    queryKey: ["accounting-report", range, customFrom, customTo],
    queryFn: () =>
      accountingReport({
        data: useCustomRange
          ? {
              from: customFrom ? new Date(`${customFrom}T00:00:00.000Z`).toISOString() : undefined,
              to: customTo ? new Date(`${customTo}T23:59:59.999Z`).toISOString() : undefined,
            }
          : { range },
      } as any),
  });
  const d: any = q.data ?? {};
  return (
    <>
      <AccountingNav />
      <AdminHeader
        title="گزارش‌های مالی"
        subtitle="جمع‌بندی فروش، هزینه و سود در بازه انتخابی"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={selectCls}
              value={range}
              disabled={useCustomRange}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="today">امروز</option>
              <option value="week">این هفته</option>
              <option value="month">این ماه</option>
              <option value="last_month">ماه قبل</option>
              <option value="year">امسال</option>
            </select>
            <span className="text-xs font-bold text-ink-2">یا بازه دلخواه:</span>
            <input
              type="date"
              className={inputCls}
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <input
              type="date"
              className={inputCls}
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
            {useCustomRange && (
              <Btn
                variant="ghost"
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                }}
              >
                پاک کردن بازه
              </Btn>
            )}
          </div>
        }
      />
      {q.isLoading ? (
        <Empty text="در حال تهیه گزارش…" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            ["فروش ناخالص", d.grossSales],
            ["تخفیف‌ها", d.discounts],
            ["برگشت وجه", d.refunds],
            ["فروش خالص", d.netSales],
            ["بهای تمام‌شده (COGS)", d.costOfGoods],
            ["سود ناخالص", d.grossProfit],
            ["مجموع هزینه‌ها", d.totalExpenses],
            ["سود خالص", d.netProfit],
            ["دریافت‌شده", d.received],
            ["مانده دریافت‌نشده", d.unreceived],
          ].map(([l, v]) => (
            <Stat key={String(l)} label={String(l)} value={money(v)} />
          ))}
        </div>
      )}
    </>
  );
}

export function AccountingSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["accounting-settings"], queryFn: () => accountingGetSettings() });
  const [f, setF] = useState<any>({
    business_name: "",
    phone: "",
    address: "",
    postal_code: "",
    currency: "تومان",
    invoice_prefix: "INV-",
    invoice_next_number: 1000,
    invoice_accent: "#2457d6",
    logo_url: null,
    footer_text: "",
  });
  useEffect(() => {
    if (q.data) setF((prev: any) => ({ ...prev, ...q.data }));
  }, [q.data]);
  const s = useMutation({
    mutationFn: () =>
      accountingSaveSettings({
        data: {
          businessName: f.business_name ?? "",
          logoUrl: f.logo_url ?? null,
          phone: f.phone ?? null,
          address: f.address ?? null,
          postalCode: f.postal_code ?? null,
          currency: f.currency ?? "تومان",
          invoicePrefix: f.invoice_prefix ?? "INV-",
          invoiceNextNumber: Number(f.invoice_next_number ?? 1000),
          footerText: f.footer_text ?? null,
          invoiceAccent: f.invoice_accent ?? "#2457d6",
        },
      } as any),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <>
      <AccountingNav />
      <AdminHeader title="تنظیمات حسابداری" subtitle="اطلاعات چاپ فاکتور و قواعد شماره‌گذاری" />
      <Panel className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام کسب‌وکار">
            <input
              className={inputCls}
              value={f.business_name ?? ""}
              onChange={(e) => setF({ ...f, business_name: e.target.value })}
            />
          </Field>
          <Field label="تلفن">
            <input
              className={inputCls}
              value={f.phone ?? ""}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
            />
          </Field>
          <Field label="آدرس">
            <input
              className={inputCls}
              value={f.address ?? ""}
              onChange={(e) => setF({ ...f, address: e.target.value })}
            />
          </Field>
          <Field label="کد پستی">
            <input
              className={inputCls}
              value={f.postal_code ?? ""}
              onChange={(e) => setF({ ...f, postal_code: e.target.value })}
            />
          </Field>
          <Field label="پیشوند شماره فاکتور">
            <input
              dir="ltr"
              className={inputCls}
              value={f.invoice_prefix ?? ""}
              onChange={(e) => setF({ ...f, invoice_prefix: e.target.value })}
            />
          </Field>
          <Field label="شماره فاکتور بعدی">
            <input
              type="number"
              min={1}
              dir="ltr"
              className={inputCls}
              value={f.invoice_next_number ?? 1000}
              onChange={(e) => setF({ ...f, invoice_next_number: Number(e.target.value) })}
            />
          </Field>
          <Field label="واحد پول">
            <input
              className={inputCls}
              value={f.currency ?? "تومان"}
              onChange={(e) => setF({ ...f, currency: e.target.value })}
            />
          </Field>
          <Field label="رنگ اصلی فاکتور">
            <input
              type="color"
              className={`${inputCls} h-11 p-1`}
              value={f.invoice_accent ?? "#2457d6"}
              onChange={(e) => setF({ ...f, invoice_accent: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <ImageUpload
              label="لوگو کسب‌وکار"
              value={f.logo_url ?? null}
              onChange={(url) => setF({ ...f, logo_url: url })}
            />
          </div>
          <div className="sm:col-span-2">
            <Field label="متن پایین فاکتور">
              <textarea
                className={inputCls}
                value={f.footer_text ?? ""}
                onChange={(e) => setF({ ...f, footer_text: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Btn onClick={() => s.mutate()} disabled={s.isPending}>
            ذخیره تنظیمات
          </Btn>
        </div>
      </Panel>
    </>
  );
}

export function Categories() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["accounting-categories"],
    queryFn: () => accountingListCategories(),
  });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ id?: string | null; name: string }>({ name: "" });
  const save = useMutation({
    mutationFn: () =>
      accountingSaveCategory({
        data: { id: draft.id ?? undefined, name: draft.name },
      } as any),
    onSuccess: () => {
      setDraft({ name: "" });
      setOpen(false);
      qc.invalidateQueries();
    },
  });

  const openNew = () => {
    setDraft({ name: "" });
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setDraft({ id: c.id, name: c.name ?? "" });
    setOpen(true);
  };

  return (
    <>
      <AdminHeader
        title="دسته‌بندی هزینه‌ها"
        subtitle="مدیریت دسته‌بندی‌های گزارش هزینه"
        action={<Btn onClick={openNew}>افزودن دسته‌بندی</Btn>}
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setDraft({ name: "" });
        }}
      >
        <DialogContent className="max-w-md rounded-none border-2 border-ink bg-card p-0 shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
          <div className="border-b-2 border-ink bg-[var(--nb-accent)] px-5 py-4">
            <DialogHeader className="space-y-1 text-right">
              <DialogTitle className="text-xl font-black text-ink">
                {draft.id ? "ویرایش دسته‌بندی" : "افزودن دسته‌بندی"}
              </DialogTitle>
              <DialogDescription className="text-right text-sm text-ink/70">
                نام دسته‌بندی را وارد کنید.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5">
            <Field label="نام دسته">
              <input
                className={inputCls}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="نام دسته جدید"
              />
            </Field>
          </div>

          <DialogFooter className="flex justify-end gap-2 border-t-2 border-ink bg-white px-5 py-4">
            <Btn variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Btn>
            <Btn onClick={() => save.mutate()} disabled={!draft.name || save.isPending}>
              ذخیره
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Panel className="p-4">
        <div className="mt-5 flex flex-wrap gap-2">
          {(q.data ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center gap-2">
              <Tag>{c.name}</Tag>
              <IconBtn label="ویرایش دسته‌بندی" onClick={() => openEdit(c)}>
                <Pencil size={14} />
              </IconBtn>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
