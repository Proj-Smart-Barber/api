export interface GeocodingResult {
  latitude: number;
  longitude: number;
  placeId: string;
  formattedAddress: string;
}

export interface GeocodingProvider {
  geocode(address: string): Promise<GeocodingResult[]>;
}
