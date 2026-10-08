import type { RequestHeaders } from "../../../gateways/auth-gateway";

export interface RefreshSessionDTO {
  /** Sessão nativa (SecureStore): token explícito. Web usa o cookie. */
  token?: string;
  headers?: RequestHeaders;
}
