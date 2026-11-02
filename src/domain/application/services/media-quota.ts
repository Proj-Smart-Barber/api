export const DEFAULT_MEDIA_GLOBAL_BUDGET_BYTES=1_000_000_000;
export const DEFAULT_MEDIA_SHOP_BUDGET_BYTES=100_000_000;
export interface MediaQuota {
  reserve(input: {
    mediaId: string;
    scope: string;
    bytes: number;
    stagingKey?: string;
  }): Promise<void>;
  release(mediaId: string): Promise<void>;
}
export function uploadReservationBytes(size: number, video: boolean): number {
  if (!Number.isSafeInteger(size) || size <= 0)
    throw new Error("Tamanho de mídia inválido.");
  return size + (video ? 21 * 1024 * 1024 : 2 * 1024 * 1024);
}
