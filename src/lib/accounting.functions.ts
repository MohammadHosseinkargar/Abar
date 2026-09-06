import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function db() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin as any; }
async function assertAdmin(supabase: any, userId: string) { const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" }); if (data !== true) throw new Error("دسترسی مدیریتی ندارید."); }
const money = z.number().int().min(0).max(9_000_000_000_000);
const paymentMethod = z.enum(["cash", "pos", "card_transfer", "gateway", "other"]).nullable().optional();
const invoiceSchema = z.object({ id:z.string().uuid().nullable().optional(), issuedAt:z.string().datetime().optional(), customerName:z.string().trim().min(1).max(160), customerPhone:z.string().trim().max(32).optional(), customerAddress:z.string().trim().max(600).optional(), customerPostalCode:z.string().trim().max(20).optional(), notes:z.string().trim().max(2000).optional(), discountAmount:money.optional(), shippingAmount:money.optional(), paidAmount:money.optional(), paymentStatus:z.enum(["unpaid","partial","paid","cancelled"]), paymentMethod, items:z.array(z.object({productId:z.string().uuid().nullable().optional(),productName:z.string().trim().min(1).max(240),quantity:z.number().int().min(1).max(100000),catalogUnitPrice:money,finalUnitPrice:money,unitCost:money.optional(),discountAmount:money.optional(),notes:z.string().trim().max(1000).optional()})).min(1).max(200) });
const receiptUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "receiptUrl must be a valid HTTPS URL" },
  )
  .optional();
const expenseSchema = z.object({id:z.string().uuid().nullable().optional(),title:z.string().trim().min(1).max(160),categoryId:z.string().uuid().nullable().optional(),quantity:z.number().int().min(1).nullable().optional(),unit:z.string().trim().max(30).optional(),unitPrice:money.nullable().optional(),totalAmount:money.refine(v=>v>0),occurredAt:z.string().datetime(),paymentMethod,notes:z.string().trim().max(2000).optional(),receiptUrl:receiptUrlSchema});
const incomeSchema = z.object({id:z.string().uuid().nullable().optional(),title:z.string().trim().min(1).max(160),category:z.string().trim().min(1).max(80),amount:money.refine(v=>v>0),occurredAt:z.string().datetime(),paymentMethod,notes:z.string().trim().max(2000).optional()});
const auth = [requireSupabaseAuth] as const;
export const accountingListProducts=createServerFn({method:"GET"}).middleware(auth).handler(async({context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{data,error}=await d.from("products").select("id,name,price,cost_price,is_active").order("name");if(error)throw error;return(data??[]).map((p:any)=>({...p,price:Number(p.price),costPrice:Number(p.cost_price??0)}));});
export const accountingListInvoices=createServerFn({method:"GET"}).middleware(auth).handler(async({context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{data,error}=await d.from("invoices").select("id,invoice_number,issued_at,customer_name,customer_phone,total_amount,paid_amount,payment_status,payment_method").order("issued_at",{ascending:false});if(error)throw error;return(data??[]).map((v:any)=>({...v,totalAmount:Number(v.total_amount),paidAmount:Number(v.paid_amount)}));});
export const accountingGetInvoice=createServerFn({method:"GET"}).middleware(auth).inputValidator((i:unknown)=>z.object({id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{data:row,error}=await d.from("invoices").select("*,invoice_items(*)").eq("id",data.id).single();if(error)throw error;return row;});
export const accountingSaveInvoice=createServerFn({method:"POST"}).middleware(auth).inputValidator((i:unknown)=>invoiceSchema.parse(i)).handler(async({data,context})=>{
  await assertAdmin(context.supabase,context.userId);
  // Must use the user-scoped client (context.supabase), NOT supabaseAdmin, so
  // that auth.uid() inside the save_accounting_invoice function resolves to the
  // actual user and the has_role('admin') check passes.
  const {items,...invoice}=data;
  const{data:id,error}=await context.supabase.rpc("save_accounting_invoice",{_invoice:invoice,_items:items});
  if(error)throw error;
  return{id};
});
export const accountingDeleteInvoice=createServerFn({method:"POST"}).middleware(auth).inputValidator((i:unknown)=>z.object({id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{error}=await d.from("invoices").delete().eq("id",data.id);if(error)throw error;return{ok:true};});
export const accountingListCategories=createServerFn({method:"GET"}).middleware(auth).handler(async({context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{data,error}=await d.from("expense_categories").select("*").order("name");if(error)throw error;return data??[];});
export const accountingSaveCategory=createServerFn({method:"POST"}).middleware(auth).inputValidator((i:unknown)=>z.object({id:z.string().uuid().nullable().optional(),name:z.string().trim().min(1).max(80),isRefund:z.boolean().optional()}).parse(i)).handler(async({data,context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const row={name:data.name,is_refund:data.isRefund??false};const{error}=data.id?await d.from("expense_categories").update(row).eq("id",data.id):await d.from("expense_categories").insert(row);if(error)throw error;return{ok:true};});
export const accountingListIncomes=createServerFn({method:"GET"}).middleware(auth).handler(async({context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{data,error}=await d.from("manual_incomes").select("*").order("occurred_at",{ascending:false});if(error)throw error;return(data??[]).map((r:any)=>({...r,amount:Number(r.amount)}));});
export const accountingSaveIncome=createServerFn({method:"POST"}).middleware(auth).inputValidator((i:unknown)=>incomeSchema.parse(i)).handler(async({data,context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const row={title:data.title,category:data.category,amount:data.amount,occurred_at:data.occurredAt,payment_method:data.paymentMethod??null,notes:data.notes??null,created_by:context.userId};const{error}=data.id?await d.from("manual_incomes").update(row).eq("id",data.id):await d.from("manual_incomes").insert(row);if(error)throw error;return{ok:true};});
export const accountingDeleteIncome=createServerFn({method:"POST"}).middleware(auth).inputValidator((i:unknown)=>z.object({id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{error}=await d.from("manual_incomes").delete().eq("id",data.id);if(error)throw error;return{ok:true};});
export const accountingListExpenses=createServerFn({method:"GET"}).middleware(auth).handler(async({context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{data,error}=await d.from("expenses").select("*,expense_categories(name,is_refund)").order("occurred_at",{ascending:false});if(error)throw error;return(data??[]).map((r:any)=>({...r,totalAmount:Number(r.total_amount),unitPrice:r.unit_price===null?null:Number(r.unit_price)}));});
export const accountingSaveExpense=createServerFn({method:"POST"}).middleware(auth).inputValidator((i:unknown)=>expenseSchema.parse(i)).handler(async({data,context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const row={title:data.title,category_id:data.categoryId??null,quantity:data.quantity??null,unit:data.unit??null,unit_price:data.unitPrice??null,total_amount:data.totalAmount,occurred_at:data.occurredAt,payment_method:data.paymentMethod??null,notes:data.notes??null,receipt_url:data.receiptUrl??null,created_by:context.userId};const{error}=data.id?await d.from("expenses").update(row).eq("id",data.id):await d.from("expenses").insert(row);if(error)throw error;return{ok:true};});
export const accountingDeleteExpense=createServerFn({method:"POST"}).middleware(auth).inputValidator((i:unknown)=>z.object({id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{error}=await d.from("expenses").delete().eq("id",data.id);if(error)throw error;return{ok:true};});
const rangeSchema=z.object({from:z.string().datetime().optional(),to:z.string().datetime().optional(),range:z.enum(["today","week","month","last_month","year"]).optional()});
function resolveRange(input: z.infer<typeof rangeSchema> | undefined) {
  if (input?.from || input?.to || !input?.range) return input;
  const now = new Date();
  const start = new Date();
  const end = new Date();

  if (input.range === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (input.range === "week") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (input.range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (input.range === "last_month") {
    // First day of previous month
    start.setMonth(start.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    // Last day of previous month at EOD
    end.setDate(0); // moves to last day of previous month
    end.setHours(23, 59, 59, 999);
  } else {
    // year: Jan 1 of current year → now
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { from: start.toISOString(), to: end.toISOString() };
}
export const accountingListTransactions=createServerFn({method:"GET"}).middleware(auth).inputValidator((i:unknown)=>rangeSchema.optional().parse(i)).handler(async({data,context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();let q=d.from("financial_transactions").select("*").order("occurred_at",{ascending:false});if(data?.from)q=q.gte("occurred_at",data.from);if(data?.to)q=q.lte("occurred_at",data.to);const{data:rows,error}=await q;if(error)throw error;return(rows??[]).map((r:any)=>({...r,amount:Number(r.amount)}));});
export const accountingDashboard=createServerFn({method:"GET"}).middleware(auth).inputValidator((i:unknown)=>rangeSchema.optional().parse(i)).handler(async({data,context})=>{
  await assertAdmin(context.supabase,context.userId);
  const d = await db();
  data = resolveRange(data);

  // Three parallel queries: invoices (with items for COGS), expenses, transactions
  let iq = d.from("invoices")
    .select("id,issued_at,subtotal,discount_amount,total_amount,paid_amount,payment_status,invoice_items(quantity,unit_cost)")
    .neq("payment_status","cancelled");
  let eq = d.from("expenses")
    .select("total_amount,occurred_at,expense_categories(is_refund)");
  let tq = d.from("financial_transactions")
    .select("transaction_type,amount,occurred_at,category");

  if (data?.from) { iq=iq.gte("issued_at",data.from); eq=eq.gte("occurred_at",data.from); tq=tq.gte("occurred_at",data.from); }
  if (data?.to)   { iq=iq.lte("issued_at",data.to);   eq=eq.lte("occurred_at",data.to);   tq=tq.lte("occurred_at",data.to);   }

  const [ir,er,tr] = await Promise.all([iq,eq,tq]);
  if (ir.error) throw ir.error;
  if (er.error) throw er.error;
  if (tr.error) throw tr.error;

  const invoices: any[] = ir.data ?? [];
  const expenses: any[] = er.data ?? [];
  const tx:       any[] = tr.data ?? [];

  // ── Financial aggregates ─────────────────────────────────────────────────
  // grossSales: sum of invoice subtotals.  After the 20260906100000 migration
  // subtotal = sum(qty * final_unit_price) — the true gross before any discounts.
  const grossSales     = invoices.reduce((s,i) => s + Number(i.subtotal), 0);
  const discounts      = invoices.reduce((s,i) => s + Number(i.discount_amount), 0);
  const cogs           = invoices.reduce((s,i) => s + (i.invoice_items ?? []).reduce((a:number,x:any) => a + Number(x.quantity)*Number(x.unit_cost), 0), 0);
  const refunds        = expenses.filter((e:any) => (e.expense_categories as any)?.is_refund).reduce((s,e) => s + Number(e.total_amount), 0);
  const totalExpenses  = expenses.reduce((s,e) => s + Number(e.total_amount), 0);
  const otherExpenses  = totalExpenses - refunds;
  const netSales       = grossSales - discounts - refunds;
  const grossProfit    = netSales - cogs;
  const received       = tx.filter(x => x.transaction_type==="income" ).reduce((s,x) => s + Number(x.amount), 0);
  const paidOut        = tx.filter(x => x.transaction_type==="expense").reduce((s,x) => s + Number(x.amount), 0);
  const unreceived     = invoices.reduce((s,i) => s + Math.max(0, Number(i.total_amount) - Number(i.paid_amount)), 0);
  const netProfit      = grossProfit - otherExpenses;

  // ── Chart data (daily buckets within the queried range) ──────────────────
  // Group financial_transactions by calendar date (Asia/Tehran) into buckets.
  // Each bucket: { label: "۱۴۰۳/۰۱/۰۱", income, expense, profit }
  const buckets: Record<string, { income: number; expense: number }> = {};
  const fmt = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  for (const t of tx) {
    const label = fmt.format(new Date(t.occurred_at));
    if (!buckets[label]) buckets[label] = { income: 0, expense: 0 };
    if (t.transaction_type === "income")  buckets[label].income  += Number(t.amount);
    else                                  buckets[label].expense += Number(t.amount);
  }
  const chart = Object.entries(buckets)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([label, v]) => ({
      label,
      income:  v.income,
      expense: v.expense,
      profit:  v.income - v.expense,
    }));

  return {
    grossSales, discounts, refunds, netSales,
    costOfGoods: cogs, grossProfit, totalExpenses,
    netProfit, received, income: received,
    expense: paidOut, unreceived, chart,
    transactions: tx.map((x:any) => ({ ...x, amount: Number(x.amount) })),
  };
});
export const accountingReport=accountingDashboard;
export const accountingGetSettings=createServerFn({method:"GET"}).middleware(auth).handler(async({context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{data,error}=await d.from("financial_settings").select("*").eq("id",true).single();if(error)throw error;return data;});
export const accountingSaveSettings=createServerFn({method:"POST"}).middleware(auth).inputValidator((i:unknown)=>z.object({businessName:z.string().trim().max(160),logoUrl:z.string().trim().max(500).optional().nullable(),phone:z.string().trim().max(40).optional().nullable(),address:z.string().trim().max(600).optional().nullable(),postalCode:z.string().trim().max(20).optional().nullable(),currency:z.string().trim().min(1).max(20),invoicePrefix:z.string().trim().max(30),invoiceNextNumber:z.number().int().min(1),footerText:z.string().trim().max(1000).optional().nullable(),invoiceAccent:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).parse(i)).handler(async({data,context})=>{await assertAdmin(context.supabase,context.userId);const d=await db();const{error}=await d.from("financial_settings").update({business_name:data.businessName,logo_url:data.logoUrl??null,phone:data.phone??null,address:data.address??null,postal_code:data.postalCode??null,currency:data.currency,invoice_prefix:data.invoicePrefix,invoice_next_number:data.invoiceNextNumber,footer_text:data.footerText??null,invoice_accent:data.invoiceAccent}).eq("id",true);if(error)throw error;return{ok:true};});
