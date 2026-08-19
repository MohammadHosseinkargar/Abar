const ZIBAL_API = "https://gateway.zibal.ir/v1";
const DEFAULT_TIMEOUT_MS = 10_000;

export type ZibalRequestResponse = {
  result: number;
  trackId?: number;
  message?: string;
};

export type ZibalVerifyResponse = {
  result: number;
  amount?: number;
  refNumber?: number | string;
  paidAt?: string;
  status?: number;
  message?: string;
  orderId?: string;
};

async function postZibal<T>(
  path: "request" | "verify",
  payload: Record<string, unknown>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ZIBAL_API}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[payment:zibal] gateway request failed", {
      operation: path,
      reason: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("ZIBAL_UNAVAILABLE");
  }

  if (!response.ok) {
    console.error("[payment:zibal] gateway returned HTTP error", {
      operation: path,
      httpStatus: response.status,
    });
    throw new Error("ZIBAL_UNAVAILABLE");
  }

  try {
    return (await response.json()) as T;
  } catch {
    console.error("[payment:zibal] gateway returned invalid JSON", { operation: path });
    throw new Error("ZIBAL_UNAVAILABLE");
  }
}

export function tomanToRial(amount: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("PAYMENT_AMOUNT_MISMATCH");
  const rial = amount * 10;
  if (!Number.isSafeInteger(rial)) throw new Error("PAYMENT_AMOUNT_MISMATCH");
  return rial;
}

export function assertZibalVerifiedAmount(
  result: ZibalVerifyResponse,
  orderTotalToman: number,
): void {
  if (typeof result.amount !== "number" || !Number.isSafeInteger(result.amount)) {
    throw new Error("PAYMENT_AMOUNT_MISMATCH");
  }
  if (result.amount !== tomanToRial(orderTotalToman)) throw new Error("PAYMENT_AMOUNT_MISMATCH");
}

export function requestZibalPayment(input: {
  merchant: string;
  amountRial: number;
  callbackUrl: string;
  description: string;
  orderId: string;
}): Promise<ZibalRequestResponse> {
  return postZibal("request", {
    merchant: input.merchant,
    amount: input.amountRial,
    callbackUrl: input.callbackUrl,
    description: input.description,
    orderId: input.orderId,
  });
}

export function verifyZibalPayment(
  merchant: string,
  trackId: string,
): Promise<ZibalVerifyResponse> {
  const numericTrackId = Number(trackId);
  if (!Number.isSafeInteger(numericTrackId) || numericTrackId <= 0)
    throw new Error("PAYMENT_VERIFY_FAILED");
  return postZibal("verify", { merchant, trackId: numericTrackId });
}
