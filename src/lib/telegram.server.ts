import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TELEGRAM_API = "https://api.telegram.org";
const TELEGRAM_TIMEOUT_MS = 10_000;

type OrderItem = {
  name: string;
  qty: number;
  price: number;
  product_id: string | null;
  product_slug: string | null;
};

type OrderForTelegram = {
  id: string;
  code: string;
  user_id: string;
  subtotal: number;
  shipping_amount: number;
  discount_amount: number;
  total: number;
  shipping_address: Record<string, unknown> | null;
  payment_status: string;
  paid_at: string | null;
};

export type TelegramOrderPayload = {
  order: OrderForTelegram;
  items: OrderItem[];
  customerName?: string | null;
  customerPhone?: string | null;
  imageUrls: string[];
};

function toman(value: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formatTelegramOrder(payload: TelegramOrderPayload): string {
  const { order, items } = payload;
  const address = order.shipping_address ?? {};
  const receiver = textValue(address.receiver) || payload.customerName;
  const phone = textValue(address.phone) || payload.customerPhone;
  const addressLine = [
    textValue(address.province),
    textValue(address.city),
    textValue(address.line),
    textValue(address.postalCode) || textValue(address.postal_code),
  ]
    .filter(Boolean)
    .join("، ");

  const productLines = items.flatMap((item, index) => [
    `${index + 1}) ${item.name}`,
    `تعداد: ${new Intl.NumberFormat("fa-IR").format(item.qty)}`,
    `قیمت واحد: ${toman(Number(item.price))}`,
    `مبلغ محصول: ${toman(Number(item.price) * item.qty)}`,
    "",
  ]);
  const customerLines = [
    receiver ? `نام: ${receiver}` : null,
    phone ? `شماره تماس: ${phone}` : null,
    addressLine ? `آدرس: ${addressLine}` : null,
  ].filter(Boolean);

  return [
    "🛍 خرید جدید",
    "━━━━━━━━━━━━━━",
    "محصولات:",
    "",
    ...productLines,
    "━━━━━━━━━━━━━━",
    `جمع محصولات: ${toman(Number(order.subtotal))}`,
    `هزینه ارسال: ${toman(Number(order.shipping_amount))}`,
    ...(Number(order.discount_amount) > 0
      ? [`تخفیف: ${toman(Number(order.discount_amount))}`]
      : []),
    `مبلغ نهایی: ${toman(Number(order.total))}`,
    ...(customerLines.length ? ["", "━━━━━━━━━━━━━━", "اطلاعات مشتری:", ...customerLines] : []),
    "",
    "━━━━━━━━━━━━━━",
    `شماره سفارش: ${order.code || order.id}`,
    "وضعیت پرداخت: پرداخت موفق ✅",
    ...(order.paid_at
      ? [
          `زمان خرید: ${new Intl.DateTimeFormat("fa-IR", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Tehran",
          }).format(new Date(order.paid_at))}`,
        ]
      : []),
  ].join("\n");
}

function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const rawChatIds =
    process.env.TELEGRAM_ADMIN_CHAT_IDS?.trim() || process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  const chatIds = [
    ...new Set(
      (rawChatIds ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^-?\d+$/.test(value)),
    ),
  ];
  if (!token || chatIds.length === 0) throw new Error("TELEGRAM_NOT_CONFIGURED");
  return { token, chatIds };
}

function publicImageUrl(value: string): string | null {
  try {
    const url = new URL(value, process.env.APP_URL?.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function telegramCall(method: "sendMessage" | "sendPhoto" | "sendMediaGroup", body: object) {
  const { token } = telegramConfig();
  let response: Response;
  try {
    response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      error instanceof DOMException && error.name === "TimeoutError"
        ? "TELEGRAM_TIMEOUT"
        : "TELEGRAM_UNAVAILABLE",
    );
  }

  let result: { ok?: boolean; error_code?: number; description?: string };
  try {
    result = (await response.json()) as typeof result;
  } catch {
    throw new Error(`TELEGRAM_HTTP_${response.status}`);
  }
  if (!response.ok || !result.ok) {
    const code = result.error_code || response.status;
    throw new Error(`TELEGRAM_API_${code}`);
  }
}

export async function sendTelegramOrder(
  payload: TelegramOrderPayload,
  recipientChatId?: string,
): Promise<void> {
  const { chatIds } = telegramConfig();
  const chatId = recipientChatId ?? chatIds[0];
  const text = formatTelegramOrder(payload);
  const images = [
    ...new Set(payload.imageUrls.map(publicImageUrl).filter((url): url is string => Boolean(url))),
  ].slice(0, 10);

  if (images.length === 0) {
    await telegramCall("sendMessage", { chat_id: chatId, text });
  } else if (images.length === 1) {
    await telegramCall("sendPhoto", {
      chat_id: chatId,
      photo: images[0],
      ...(text.length <= 1024 ? { caption: text } : {}),
    });
    if (text.length > 1024) await telegramCall("sendMessage", { chat_id: chatId, text });
  } else {
    await telegramCall("sendMediaGroup", {
      chat_id: chatId,
      media: images.map((media, index) => ({
        type: "photo",
        media,
        ...(index === 0 && text.length <= 1024 ? { caption: text } : {}),
      })),
    });
    if (text.length > 1024) await telegramCall("sendMessage", { chat_id: chatId, text });
  }
}

async function loadOrderPayload(orderId: string): Promise<TelegramOrderPayload> {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(
      "id,code,user_id,subtotal,shipping_amount,discount_amount,total,shipping_address,payment_status,paid_at",
    )
    .eq("id", orderId)
    .single();
  if (orderError) throw orderError;
  if (order.payment_status !== "paid") throw new Error("TELEGRAM_ORDER_NOT_PAID");

  const [{ data: items, error: itemsError }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from("order_items")
      .select("name,qty,price,product_id,product_slug")
      .eq("order_id", orderId),
    supabaseAdmin.from("profiles").select("full_name,phone").eq("id", order.user_id).maybeSingle(),
  ]);
  if (itemsError) throw itemsError;

  const productIds = [
    ...new Set((items ?? []).map((item) => item.product_id).filter(Boolean)),
  ] as string[];
  const { data: products, error: productsError } = productIds.length
    ? await supabaseAdmin.from("products").select("id,image_url,image_urls").in("id", productIds)
    : { data: [], error: null };
  if (productsError) throw productsError;

  return {
    order: { ...order, shipping_address: order.shipping_address as Record<string, unknown> | null },
    items: (items ?? []).map((item) => ({ ...item, price: Number(item.price) })),
    customerName: profile?.full_name,
    customerPhone: profile?.phone,
    imageUrls: (products ?? []).flatMap((product) =>
      product.image_urls?.length
        ? product.image_urls.slice(0, 1)
        : product.image_url
          ? [product.image_url]
          : [],
    ),
  };
}

export async function deliverTelegramOrderNotification(orderId: string): Promise<boolean> {
  const { chatIds } = telegramConfig();
  const recipientRows = chatIds.map((chatId) => ({ order_id: orderId, chat_id: chatId }));
  const { error: recipientError } = await supabaseAdmin
    .from("telegram_order_notification_recipients" as never)
    .upsert(recipientRows as never, { onConflict: "order_id,chat_id", ignoreDuplicates: true });
  if (recipientError) throw recipientError;

  const payload = await loadOrderPayload(orderId);
  let delivered = false;
  let anyFailed = false;

  for (const chatId of chatIds) {
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc(
      "claim_telegram_order_notification_recipient" as never,
      { _order_id: orderId, _chat_id: chatId } as never,
    );
    if (claimError) throw claimError;
    if (!claimed) continue;

    try {
      await sendTelegramOrder(payload, chatId);
      const { error: sentError } = await supabaseAdmin
        .from("telegram_order_notification_recipients" as never)
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null } as never)
        .eq("order_id", orderId)
        .eq("chat_id", chatId);
      if (sentError) throw sentError;
      delivered = true;
      console.info("[telegram:order] recipient notified", { orderId });
    } catch (error) {
      anyFailed = true;
      const code =
        error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
          ? error.message
          : "TELEGRAM_DELIVERY_FAILED";
      const { error: failedError } = await supabaseAdmin
        .from("telegram_order_notification_recipients" as never)
        .update({ status: "failed", last_error: code } as never)
        .eq("order_id", orderId)
        .eq("chat_id", chatId);
      if (failedError)
        console.error("[telegram:order] could not persist recipient failure", { orderId });
      console.error("[telegram:order] recipient notification failed", { orderId, code });
    }
  }

  if (!delivered && !anyFailed) return false;
  const { error: aggregateError } = await supabaseAdmin
    .from("telegram_order_notifications" as never)
    .update({
      status: anyFailed ? "failed" : "sent",
      sent_at: anyFailed ? null : new Date().toISOString(),
      last_error: anyFailed ? "TELEGRAM_RECIPIENT_FAILED" : null,
    } as never)
    .eq("order_id", orderId);
  if (aggregateError) throw aggregateError;
  return delivered;
}

export async function deliverTelegramOrderNotificationSafely(orderId: string): Promise<void> {
  try {
    await deliverTelegramOrderNotification(orderId);
  } catch {
    // Payment is already committed. Notification failure must never roll it back.
  }
}
