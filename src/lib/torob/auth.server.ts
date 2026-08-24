import "@tanstack/react-start/server-only";
import { createPublicKey, verify } from "node:crypto";
import { getTorobConfig, hasValidTorobPublicKey } from "./config.server";

export type TorobAuthenticationFailure =
  | "configuration_invalid_public_key"
  | "missing_or_invalid_headers"
  | "invalid_jwt"
  | "invalid_algorithm_or_version"
  | "expired_jwt"
  | "inactive_jwt"
  | "invalid_audience"
  | "invalid_signature";

export class TorobAuthenticationError extends Error {
  constructor(readonly failure: TorobAuthenticationFailure) {
    super(failure);
  }
}

function decodeJsonPart(part: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new TorobAuthenticationError("invalid_jwt");
  }
}

function audienceMatches(value: unknown, expected: string): boolean {
  return typeof value === "string"
    ? value === expected
    : Array.isArray(value) && value.some((item) => item === expected);
}

export function verifyTorobRequest(request: Request): void {
  const config = getTorobConfig();
  if (!config.publicKey || !hasValidTorobPublicKey())
    throw new TorobAuthenticationError("configuration_invalid_public_key");
  const version = request.headers.get("x-torob-token-version");
  const token = request.headers.get("x-torob-token")?.trim();
  if (version !== config.tokenVersion || !token)
    throw new TorobAuthenticationError("missing_or_invalid_headers");

  const parts = token.split(".");
  if (parts.length !== 3) throw new TorobAuthenticationError("invalid_jwt");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader!);
  const payload = decodeJsonPart(encodedPayload!);
  if (
    header.alg !== "EdDSA" ||
    (header.v !== undefined && String(header.v) !== config.tokenVersion)
  ) {
    throw new TorobAuthenticationError("invalid_algorithm_or_version");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || now >= payload.exp)
    throw new TorobAuthenticationError("expired_jwt");
  if (typeof payload.nbf !== "number" || now < payload.nbf)
    throw new TorobAuthenticationError("inactive_jwt");
  const host = new URL(request.url).host;
  if (!audienceMatches(payload.aud, host)) throw new TorobAuthenticationError("invalid_audience");

  let valid = false;
  try {
    valid = verify(
      null,
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      createPublicKey(config.publicKey),
      Buffer.from(encodedSignature!, "base64url"),
    );
  } catch {
    valid = false;
  }
  if (!valid) throw new TorobAuthenticationError("invalid_signature");
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
