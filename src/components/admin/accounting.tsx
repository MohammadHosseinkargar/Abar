import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Eye, FilePlus2, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
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
  num,
} from "@/components/admin/kit";

const money = (value: unknown) => formatToman(Number(value ?? 0));
const date = (value: unknown) => (value ? faDate(String(value)) : "—");
const selectCls = `${inputCls} py-2`;
const paymentLabel: Record<string, string> = {
  unpaid: "پرداخت نشده",
  partial: "بخشی پرداخت شده",
  paid: "تسویه شده",
  cancelled: "لغو شده",
};
const methodLabel: Record<string, string> = {
  cash: "نقدی",
  pos: "کارتخوان",
  card: "کارت به کارت",
  gateway: "درگاه",
  other: "سایر",
};

export function FinanceDashboard() {
  const [range, setRange] = useState("month");
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
      <AdminHeader
        title="داشبورد مالی"
        subtitle="تصویر روشن از جریان پول کسب‌وکار"
        action={
          <select value={range} onChange={(e) => setRange(e.target.value)} className={selectCls}>
            <option value="today">امروز</option>
            <option value="week">این هفته</option>
            <option value="month">این ماه</option>
            <option value="last_month">ماه قبل</option>
            <option value="year">امسال</option>
          </select>
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
  discount: number;
  note: string;
};
const newLine = (): Line => ({
  title: "",
  quantity: 1,
  list_price: 0,
  unit_price: 0,
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
          paymentMethod: form.paymentMethod === "card" ? "card_transfer" : form.paymentMethod,
          items: items.map((i) => ({
            productId: i.product_id,
            productName: i.title,
            quantity: i.quantity,
            catalogUnitPrice: i.list_price,
            finalUnitPrice: i.unit_price,
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
              <Btn variant="ghost" onClick={() => window.print()}>
                <span className="inline-flex gap-1">
                  <Printer size={15} />
                  چاپ
                </span>
              </Btn>
            )}
            <Btn onClick={() => save.mutate()} disabled={save.isPending}>
              ذخیره فاکتور
            </Btn>
          </>
        }
      />
      <Panel className="p-4 print:border-0 print:shadow-none">
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
  const [form, setForm] = useState<any | null>(null);
  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: isIncome
          ? {
              title: form.title,
              category: form.category,
              amount: form.amount,
              occurredAt: new Date(`${form.date}T00:00:00.000Z`).toISOString(),
              paymentMethod: form.payment_method === "card" ? "card_transfer" : form.payment_method,
              notes: form.notes,
            }
          : {
              title: form.title,
              totalAmount: form.amount,
              occurredAt: new Date(`${form.date}T00:00:00.000Z`).toISOString(),
              paymentMethod: form.payment_method === "card" ? "card_transfer" : form.payment_method,
              notes: form.notes,
            },
      } as any),
    onSuccess: () => {
      setForm(null);
      qc.invalidateQueries();
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } } as any),
    onSuccess: () => qc.invalidateQueries(),
  });
  const blank = {
    title: "",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    category: "other",
    notes: "",
  };
  return (
    <>
      <AdminHeader
        title={isIncome ? "درآمدها" : "هزینه‌ها"}
        subtitle={
          isIncome
            ? "ثبت دریافتی‌های دستی؛ مبالغ فاکتور دوباره شمرده نمی‌شوند"
            : "هزینه‌های واقعی روزمره کسب‌وکار"
        }
        action={
          <Btn onClick={() => setForm(blank)}>
            <Plus size={15} className="inline" /> ثبت {isIncome ? "درآمد" : "هزینه"}
          </Btn>
        }
      />
      {form && (
        <Panel className="mb-5 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="عنوان">
              <input
                className={inputCls}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="مبلغ">
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
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setForm(null)}>
              انصراف
            </Btn>
            <Btn onClick={() => save.mutate()}>ذخیره</Btn>
          </div>
        </Panel>
      )}
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
                <span className="text-xs text-ink-2">{date(x.occurred_at)}</span>
                <span className="ms-auto font-mono">
                  {money(isIncome ? x.amount : x.totalAmount)}
                </span>
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
      <AdminHeader title="تراکنش‌ها" subtitle="دفتر مرکزی تمام ورود و خروج‌های مالی" />
      <Panel className="overflow-hidden">
        {q.isLoading ? (
          <Empty text="در حال بارگذاری…" />
        ) : (q.data ?? []).length === 0 ? (
          <Empty text="تراکنشی وجود ندارد." />
        ) : (
          <ul className="divide-y-2 divide-ink">
            {(q.data ?? []).map((t: any) => (
              <li key={t.id} className="flex flex-wrap gap-3 p-3 text-sm">
                <Tag tone={t.type === "income" ? "ok" : "warn"}>
                  {t.type === "income" ? "درآمد" : "هزینه"}
                </Tag>
                <span className="font-bold">{t.title ?? t.source}</span>
                <span className="text-xs text-ink-2">
                  {date(t.date)} · {methodLabel[t.payment_method] ?? "—"}
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
  const q = useQuery({
    queryKey: ["accounting-report", range],
    queryFn: () => accountingReport({ data: { range } } as any),
  });
  const d: any = q.data ?? {};
  return (
    <>
      <AdminHeader
        title="گزارش‌های مالی"
        subtitle="جمع‌بندی فروش، هزینه و سود در بازه انتخابی"
        action={
          <select className={selectCls} value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="week">هفته</option>
            <option value="month">ماه</option>
            <option value="year">سال</option>
          </select>
        }
      />
      {q.isLoading ? (
        <Empty text="در حال تهیه گزارش…" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            ["درآمد", d.income],
            ["هزینه", d.expense],
            ["فروش ناخالص", d.grossSales],
            ["فروش خالص", d.netSales],
            ["سود ناخالص", d.grossProfit],
            ["سود خالص", d.netProfit],
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
    invoice_start: 1,
    footer_text: "",
  });
  useEffect(() => {
    if (q.data) setF({ ...f, ...q.data });
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
          invoiceNextNumber: Number(f.invoice_next_number ?? f.invoice_start ?? 1),
          footerText: f.footer_text ?? null,
          invoiceAccent: f.invoice_accent ?? "#f15832",
        },
      } as any),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <>
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
          <Field label="شماره شروع">
            <input
              type="number"
              className={inputCls}
              value={f.invoice_start ?? 1}
              onChange={(e) => setF({ ...f, invoice_start: Number(e.target.value) })}
            />
          </Field>
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
  const [name, setName] = useState("");
  const save = useMutation({
    mutationFn: () => accountingSaveCategory({ data: { name } } as any),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries();
    },
  });
  return (
    <>
      <AdminHeader title="دسته‌بندی هزینه‌ها" subtitle="مدیریت دسته‌بندی‌های گزارش هزینه" />
      <Panel className="p-4">
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام دسته جدید"
          />
          <Btn onClick={() => save.mutate()} disabled={!name}>
            افزودن
          </Btn>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(q.data ?? []).map((c: any) => (
            <Tag key={c.id}>{c.name}</Tag>
          ))}
        </div>
      </Panel>
    </>
  );
}
