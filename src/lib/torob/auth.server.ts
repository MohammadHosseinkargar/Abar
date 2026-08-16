import "@tanstack/react-start/server-only";
import { createPublicKey, verify } from "node:crypto";
import { getTorobConfig } from "./config.server";

function decodeJsonPart(part: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("invalid JWT encoding");
  }
}

function audienceMatches(value: unknown, expected: string): boolean {
  return typeof value === "string"
    ? value === expected
    : Array.isArray(value) && value.some((item) => item === expected);
}

export function verifyTorobRequest(request: Request): void {
  const config = getTorobConfig();
  if (!config.publicKey) throw new Error("Torob public key is not configured");
  const version = request.headers.get("x-torob-token-version");
  const token = request.headers.get("x-torob-token")?.trim();
  if (version !== config.tokenVersion || !token)
    throw new Error("missing or invalid Torob authentication headers");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid JWT");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader!);
  const payload = decodeJsonPart(encodedPayload!);
  if (
    header.alg !== "EdDSA" ||
    (header.v !== undefined && String(header.v) !== config.tokenVersion)
  ) {
    throw new Error("invalid JWT algorithm or version");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || now >= payload.exp) throw new Error("expired JWT");
  if (typeof payload.nbf !== "number" || now < payload.nbf) throw new Error("inactive JWT");
  const host = new URL(request.url).host;
  if (!audienceMatches(payload.aud, host)) throw new Error("invalid JWT audience");

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
  if (!valid) throw new Error("invalid JWT signature");
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
