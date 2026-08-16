import "@tanstack/react-start/server-only";

const DEFAULT_WEBHOOK_URL = "https://api.torob.com/update/webhook/v1/";

export function getTorobConfig() {
  const appUrl = new URL(process.env.APP_URL?.trim() || "https://abar3d.ir");
  return {
    appUrl: appUrl.origin,
    publicKey: (process.env.TOROB_PUBLIC_KEY?.trim() || "").replace(/\\n/g, "\n"),
    tokenVersion: process.env.TOROB_TOKEN_VERSION?.trim() || "1",
    webhookToken: process.env.TOROB_WEBHOOK_TOKEN?.trim() || "",
    webhookUrl: process.env.TOROB_WEBHOOK_URL?.trim() || DEFAULT_WEBHOOK_URL,
    queueSecret: process.env.TOROB_QUEUE_SECRET?.trim() || "",
    orderTrackingEnabled: process.env.TOROB_ORDER_TRACKING_ENABLED === "true",
  };
}

export function getTorobConfigurationState() {
  const publicKey = Boolean(process.env.TOROB_PUBLIC_KEY?.trim());
  const webhookToken = Boolean(process.env.TOROB_WEBHOOK_TOKEN?.trim());
  const queueSecret = Boolean(process.env.TOROB_QUEUE_SECRET?.trim());
  return {
    ready: publicKey,
    publicKey,
    webhookToken,
    queueSecret,
    orderTrackingEnabled: process.env.TOROB_ORDER_TRACKING_ENABLED === "true",
  };
}
