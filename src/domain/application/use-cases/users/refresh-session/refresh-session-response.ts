export interface RefreshSessionResponse {
  access_token: string;
  refresh_token: string;
  accessExpiresAt: string;
  sessionExpiresAt: string;
  serverTime: string;
}
