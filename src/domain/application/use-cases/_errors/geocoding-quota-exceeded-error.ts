import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class GeocodingQuotaExceededError extends Error implements UseCaseError {
  readonly code = "GEOCODING_QUOTA_EXCEEDED";
  readonly retryAfterSeconds: number;

  constructor(
    message = "Limite de buscas de localização excedido. Aguarde antes de tentar novamente.",
    retryAfterSeconds = 3600,
  ) {
    super(message);
    this.name = "GeocodingQuotaExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
