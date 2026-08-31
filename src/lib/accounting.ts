export type InvoiceLineInput = { quantity: number; finalUnitPrice: number; discountAmount?: number; unitCost?: number };

/** Integer-toman invoice math. Inputs are validated separately at the API boundary. */
export function calculateInvoice(lines: InvoiceLineInput[], invoiceDiscount = 0, shipping = 0) {
  const itemsGross = lines.reduce((sum, line) => sum + line.quantity * line.finalUnitPrice, 0);
  const lineDiscounts = lines.reduce((sum, line) => sum + (line.discountAmount ?? 0), 0);
  const discountAmount = lineDiscounts + invoiceDiscount;
  const total = Math.max(0, itemsGross - discountAmount + shipping);
  const costOfGoods = lines.reduce((sum, line) => sum + line.quantity * (line.unitCost ?? 0), 0);
  return { itemsGross, lineDiscounts, discountAmount, total, costOfGoods };
}

export function paymentStatus(total: number, paid: number) {
  if (paid <= 0) return "unpaid" as const;
  return paid >= total ? ("paid" as const) : ("partial" as const);
}

export function profitSummary(input: { grossSales: number; discounts: number; refunds: number; costOfGoods: number; otherExpenses: number }) {
  const netSales = input.grossSales - input.discounts - input.refunds;
  const grossProfit = netSales - input.costOfGoods;
  return { netSales, grossProfit, netProfit: grossProfit - input.otherExpenses };
}
