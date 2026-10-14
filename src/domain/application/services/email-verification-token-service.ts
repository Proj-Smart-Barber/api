import ms from "ms";
import type { StringValue } from "ms";
import { generateOpaqueToken, hashToken } from "../../../core/crypto/token";
import { env } from "../../../infra/env";

const DEFAULT_TTL_IN_MS = 24 * 60 * 60 * 1000;

export interface IssuedEmailVerificationToken {
  plainToken: string;
  tokenHash: string;
  expiresAt: Date;
  expiresInHours: number;
}

function resolveTtlInMs(expiresIn?: string): number {
  return (
    ms((expiresIn ?? env.VERIFICATION_TOKEN_EXPIRES_IN) as StringValue) ??
    DEFAULT_TTL_IN_MS
  );
}

export function createEmailVerificationToken(
  expiresIn?: string,
): IssuedEmailVerificationToken {
  const plainToken = generateOpaqueToken();
  const ttlInMs = resolveTtlInMs(expiresIn);

  return {
    plainToken,
    tokenHash: hashToken(plainToken),
    expiresAt: new Date(Date.now() + ttlInMs),
    expiresInHours: Math.max(1, Math.round(ttlInMs / (60 * 60 * 1000))),
  };
}

export function buildEmailVerificationUrl(
  plainToken: string,
  options?: {
    baseUrl?: string;
    nodeEnv?: string;
  },
): string {
  const configuredUrl =
    options?.baseUrl ?? env.EMAIL_VERIFICATION_URL ?? env.FRONTEND_URL;

  if (!configuredUrl || !configuredUrl.trim()) {
    throw new Error(
      "Frontend URL for email verification is not configured. Define EMAIL_VERIFICATION_URL or FRONTEND_URL.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error(`Malformed email verification URL: "${configuredUrl}"`);
  }

  // Se veio de FRONTEND_URL ou a URL não tem pathname definido (ou é apenas '/'), appenda /verify-email
  const isDedicatedVerificationUrl = Boolean(
    options?.baseUrl ?? env.EMAIL_VERIFICATION_URL,
  );
  if (
    !isDedicatedVerificationUrl ||
    parsed.pathname === "/" ||
    !parsed.pathname
  ) {
    parsed.pathname = "/verify-email";
  }

  // Validação de segurança de protocolo: HTTP é restrito a desenvolvimento local
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    throw new Error(
      `Insecure or unsupported protocol "${protocol}" in email verification URL. Only http and https are allowed.`,
    );
  }

  const isLocalHost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]" ||
    parsed.hostname.endsWith(".localhost");

  if (protocol === "http:" && !isLocalHost) {
    throw new Error(
      "Insecure HTTP protocol is not permitted for remote hosts. HTTP is only permitted for local development on localhost. Use HTTPS.",
    );
  }

  const currentEnv = options?.nodeEnv ?? env.NODE_ENV;
  if (currentEnv === "production" && protocol !== "https:") {
    throw new Error(
      "Insecure HTTP protocol is not permitted for email verification links in production. Use HTTPS.",
    );
  }

  // Rejeição de credenciais embutidas
  if (parsed.username || parsed.password) {
    throw new Error(
      "Email verification URL must not contain embedded user credentials.",
    );
  }

  // Limpa parâmetros arbitrários anteriores e hash, garantindo exclusivamente o token
  parsed.search = "";
  parsed.searchParams.set("token", plainToken);
  parsed.hash = "";

  return parsed.toString();
}
