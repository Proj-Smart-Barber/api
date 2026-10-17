import type {
  GeocodingProvider,
  GeocodingResult,
} from "../../domain/application/services/geocoding-provider";

export class GoogleGeocodingProvider implements GeocodingProvider {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ??
      process.env.GOOGLE_MAPS_API_KEY ??
      process.env.GOOGLE_GEOCODING_API_KEY;
  }

  async geocode(address: string): Promise<GeocodingResult[]> {
    if (!this.apiKey) {
      // Quando a chave não estiver configurada no ambiente local, gera candidato de demonstração consistente em São Paulo
      return [
        {
          latitude: -23.55052,
          longitude: -46.633308,
          placeId: `mock_place_${Buffer.from(address).toString("hex").slice(0, 16)}`,
          formattedAddress: address,
        },
      ];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", address);
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("region", "br");
      url.searchParams.set("language", "pt-BR");

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as any;
      if (data.status !== "OK" || !Array.isArray(data.results)) {
        return [];
      }

      return data.results.slice(0, 5).map((r: any) => ({
        latitude: r.geometry.location.lat,
        longitude: r.geometry.location.lng,
        placeId: r.place_id,
        formattedAddress: r.formatted_address,
      }));
    } catch (_error) {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}
