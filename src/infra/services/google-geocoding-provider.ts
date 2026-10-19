import type {
  GeocodingProvider,
  GeocodingResult,
} from "../../domain/application/services/geocoding-provider";
import { LocationServiceUnavailableError } from "../../domain/application/use-cases/_errors/location-service-unavailable-error";

export class GoogleGeocodingProvider implements GeocodingProvider {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ??
      process.env.GOOGLE_MAPS_API_KEY ??
      process.env.GOOGLE_GEOCODING_API_KEY;
  }

  async geocode(address: string): Promise<GeocodingResult[]> {
    if (!this.apiKey || this.apiKey.trim() === "") {
      throw new LocationServiceUnavailableError(
        "Serviço de geocodificação não configurado no servidor (chave ausente).",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", address);
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("region", "br");
      url.searchParams.set("language", "pt-BR");

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          signal: controller.signal,
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          throw new LocationServiceUnavailableError(
            "Tempo limite excedido na consulta à API de geocodificação.",
          );
        }
        throw new LocationServiceUnavailableError(
          "Falha na comunicação com o serviço de geocodificação.",
        );
      }

      if (!response.ok) {
        throw new LocationServiceUnavailableError(
          `Serviço de geocodificação indisponível (HTTP ${response.status}).`,
        );
      }

      const data = (await response.json()) as any;

      if (data.status === "ZERO_RESULTS") {
        return [];
      }

      if (data.status === "OVER_QUERY_LIMIT") {
        throw new LocationServiceUnavailableError(
          "Limite de consultas do provedor de geocodificação foi atingido.",
        );
      }

      if (data.status === "REQUEST_DENIED") {
        throw new LocationServiceUnavailableError(
          "Acesso negado à API de geocodificação (credencial inválida ou sem permissão).",
        );
      }

      if (data.status !== "OK" || !Array.isArray(data.results)) {
        throw new LocationServiceUnavailableError(
          `Erro retornado pelo provedor de geocodificação: ${data.status ?? "UNKNOWN"}.`,
        );
      }

      return data.results.slice(0, 5).map((r: any) => ({
        latitude: r.geometry.location.lat,
        longitude: r.geometry.location.lng,
        placeId: r.place_id,
        formattedAddress: r.formatted_address,
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}
