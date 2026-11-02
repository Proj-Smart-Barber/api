import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { EXPLORE_RANKING_VERSION } from "./explore-ranking-engine";

const localSecret = randomBytes(32).toString("hex");
function signingSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production")
    throw new Error("Cursor signing is not configured");
  return localSecret;
}
export const EXPLORE_CURSOR_TTL_MS = 15 * 60 * 1000; // 15 minutos

export class InvalidExploreCursorError extends Error {
  constructor(
    message = "Cursor do feed explorar é inválido ou foi adulterado.",
  ) {
    super(message);
    this.name = "InvalidExploreCursorError";
  }
}

export class ExpiredExploreCursorError extends Error {
  constructor(
    message = "Sessão do feed explorar expirou. Atualize a lista para carregar novos resultados.",
  ) {
    super(message);
    this.name = "ExpiredExploreCursorError";
  }
}

export interface ExploreCursorPayload {
  offset: number;
  sessionId: string;
  filtersHash: string;
  createdAt: number;
  expiresAt: number;
  rankingVersion: string;
}

export function computeFiltersHash(params: {
  mode: "ALL" | "NEARBY";
  q?: string;
  radiusKm?: number;
  regionKey?: string;
  latBucket?: number;
  lngBucket?: number;
}): string {
  const normalized = {
    mode: params.mode,
    q: params.q?.trim().toLowerCase() ?? "",
    radiusKm: params.radiusKm ?? 0,
    regionKey: params.regionKey ?? "",
    latBucket: params.latBucket ?? null,
    lngBucket: params.lngBucket ?? null,
  };

  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .slice(0, 16);
}

export function createExploreCursor(
  input: {
    offset: number;
    sessionId: string;
    filtersHash: string;
    expiresAt?: number;
  },
  secret: string = signingSecret(),
): string {
  const now = Date.now();
  const payload: ExploreCursorPayload = {
    offset: input.offset,
    sessionId: input.sessionId,
    filtersHash: input.filtersHash,
    createdAt: now,
    expiresAt: input.expiresAt ?? now + EXPLORE_CURSOR_TTL_MS,
    rankingVersion: EXPLORE_RANKING_VERSION,
  };

  const json = JSON.stringify(payload);
  const base64Payload = Buffer.from(json, "utf-8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(base64Payload)
    .digest("base64url");

  return `${base64Payload}.${signature}`;
}

export function verifyAndParseExploreCursor(
  cursorString: string,
  expectedFiltersHash?: string,
  secret: string = signingSecret(),
  now: number = Date.now(),
): ExploreCursorPayload {
  const parts = cursorString.split(".");
  if (parts.length !== 2) {
    throw new InvalidExploreCursorError("Formato do cursor inválido.");
  }

  const [base64Payload, signature] = parts;
  const expectedSignature = createHmac("sha256", secret)
    .update(base64Payload)
    .digest("base64url");

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new InvalidExploreCursorError("Assinatura do cursor não confere.");
  }

  let payload: ExploreCursorPayload;
  try {
    const raw = Buffer.from(base64Payload, "base64url").toString("utf-8");
    payload = JSON.parse(raw);
  } catch {
    throw new InvalidExploreCursorError(
      "Conteúdo do cursor não pôde ser decodificado.",
    );
  }

  if (
    !Number.isSafeInteger(payload.offset) ||
    payload.offset < 0 ||
    payload.rankingVersion !== EXPLORE_RANKING_VERSION ||
    !payload.sessionId ||
    !payload.filtersHash ||
    !payload.expiresAt ||
    !payload.createdAt
  ) {
    throw new InvalidExploreCursorError(
      "Campos obrigatórios ausentes no cursor.",
    );
  }

  if (now > payload.expiresAt) {
    throw new ExpiredExploreCursorError();
  }

  if (expectedFiltersHash && payload.filtersHash !== expectedFiltersHash) {
    throw new InvalidExploreCursorError(
      "O cursor não pertence aos filtros da requisição atual.",
    );
  }

  return payload;
}
