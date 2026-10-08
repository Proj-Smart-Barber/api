import type { AuthUser } from "../../../gateways/auth-gateway";

export interface SignInUserResponse {
  /** Alias mantido para compatibilidade com os clientes atuais. */
  access_token: string;
  token: string;
  user: AuthUser;
  expiresAt: Date;
  setCookies: string[];
  authToken?: string;
}
