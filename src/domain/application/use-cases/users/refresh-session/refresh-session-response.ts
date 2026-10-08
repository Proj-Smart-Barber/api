import type { AuthUser } from "../../../gateways/auth-gateway";

export interface RefreshSessionResponse {
  token: string;
  /** Alias mantido para compatibilidade com os clientes atuais. */
  access_token: string;
  user: AuthUser;
  expiresAt: Date;
  setCookies: string[];
  authToken?: string;
}
