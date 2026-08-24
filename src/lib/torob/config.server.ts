import "@tanstack/react-start/server-only";
import { createPublicKey, type KeyObject } from "node:crypto";

const DEFAULT_WEBHOOK_URL = "https://api.torob.com/update/webhook/v1/";

function configuredPublicKey(): string {
  return (process.env.TOROB_PUBLIC_KEY?.trim() || "").replace(/\\n/g, "\n");
}

export function getTorobVerificationKey(): KeyObject | null {
  const publicKey = configuredPublicKey();
  if (!publicKey) return null;
  try {
    const key = createPublicKey(publicKey);
    return key.asymmetricKeyType === "ed25519" ? key : null;
  } catch {
    return null;
  }
}

export function hasValidTorobPublicKey(): boolean {
  return getTorobVerificationKey() !== null;
}

export function getTorobConfig() {
  const appUrl = new URL(process.env.APP_URL?.trim() || "https://abar3d.ir");
  return {
    appUrl: appUrl.origin,
    apiHost: appUrl.host,
    publicKey: configuredPublicKey(),
    tokenVersion: process.env.TOROB_TOKEN_VERSION?.trim() || "",
    webhookToken: process.env.TOROB_WEBHOOK_TOKEN?.trim() || "",
    webhookUrl: process.env.TOROB_WEBHOOK_URL?.trim() || DEFAULT_WEBHOOK_URL,
    queueSecret: process.env.TOROB_QUEUE_SECRET?.trim() || "",
    orderTrackingEnabled: process.env.TOROB_ORDER_TRACKING_ENABLED === "true",
  };
}

export function getTorobConfigurationState() {
  const publicKey = Boolean(process.env.TOROB_PUBLIC_KEY?.trim());
  const validPublicKey = hasValidTorobPublicKey();
  const tokenVersion = process.env.TOROB_TOKEN_VERSION?.trim() === "1";
  const webhookToken = Boolean(process.env.TOROB_WEBHOOK_TOKEN?.trim());
  const queueSecret = Boolean(process.env.TOROB_QUEUE_SECRET?.trim());
  const productApiReady = validPublicKey && tokenVersion;
  return {
    ready: productApiReady,
    productApiReady,
    publicKey,
    validPublicKey,
    tokenVersion,
    webhookToken,
    webhookEnabled: webhookToken,
    queueSecret,
    orderTrackingEnabled: process.env.TOROB_ORDER_TRACKING_ENABLED === "true",
  };
}
