export type OrderStatus = "pending" | "processing" | "printing" | "shipped" | "delivered" | "cancelled";

export const orderStatusFa: Record<OrderStatus, string> = {
  pending: "در انتظار پرداخت",
  processing: "در حال آماده‌سازی",
  printing: "در حال چاپ",
  shipped: "ارسال شده",
  delivered: "تحویل داده شده",
  cancelled: "لغو شده",
};

export const orderStatusSteps = [
  "pending",
  "processing",
  "printing",
  "shipped",
  "delivered",
] as const;
